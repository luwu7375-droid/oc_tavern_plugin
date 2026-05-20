# Bridge API Design

OC Workbench needs a dedicated bridge API for the SillyTavern plugin.

The bridge API is separate from the authenticated web app API. It is intended for local, single-user Tavern integration and does not require Clerk login.

## Base URL

Default local development URL:

```text
http://127.0.0.1:3000/api/tavern
```

The plugin should allow the user to configure this URL.

## Authentication

First version:

- no Clerk
- no browser login dependency
- optional shared secret later

Recommended optional header for future hardening:

```http
X-OC-Bridge-Token: <local shared token>
```

If no token is configured in OC Workbench, requests are accepted.

## Existing OC Workbench State

The `origin/feature/mvp-p0` branch already defines these relevant objects:

- `Character`
- `Item`
- `CharacterRelationship`
- `CharacterGroup`

Relevant item types:

- `profile`
- `snippet`
- `reference`
- `image`
- `state_card`

Existing app APIs use Clerk auth. The bridge API should call the same DB helpers or equivalent service code, but with a local bridge user strategy.

## Bridge User Strategy

Because current schema has `Character.userId`, bridge writes still need a `userId`.

Recommended first version:

```text
OC_TAVERN_BRIDGE_USER_ID=local-tavern-user
```

All unauthenticated Tavern bridge writes use this configured user id.

If the env var is absent, default to:

```text
local-tavern-user
```

## Endpoint Summary

```text
GET  /api/tavern/health
POST /api/tavern/context/resolve
POST /api/tavern/memory/extract
POST /api/tavern/memory/commit
POST /api/tavern/writeback/plan
```

Only `extract` and `commit` are required for the first working loop. The rest make the plugin safer and easier to debug.

## GET /api/tavern/health

Purpose: let the plugin check connection and feature compatibility.

Response:

```json
{
  "data": {
    "ok": true,
    "service": "oc_workbench",
    "bridgeVersion": 1,
    "features": ["extract", "commit", "writeback_plan"],
    "itemTypes": ["profile", "snippet", "reference", "image", "state_card"]
  },
  "error": null
}
```

## POST /api/tavern/context/resolve

Purpose: map Tavern character names to OC Workbench character IDs.

Request:

```json
{
  "tavern": {
    "characterName": "角色名",
    "characterAvatar": "avatar.png",
    "chatId": "角色名 - 2026-05-21",
    "groupId": null
  },
  "participants": [
    { "name": "角色A", "avatar": "a.png" },
    { "name": "角色B", "avatar": "b.png" }
  ],
  "createMissing": false
}
```

Response:

```json
{
  "data": {
    "matches": [
      {
        "tavernName": "角色A",
        "ocCharacterId": "clx...",
        "ocName": "角色A",
        "confidence": 1,
        "created": false
      }
    ],
    "unmatched": []
  },
  "error": null
}
```

## POST /api/tavern/memory/extract

Purpose: extract candidate long-term memory and return a writeback plan.

Request:

```json
{
  "source": "sillytavern",
  "schemaVersion": 1,
  "tavern": {
    "chatId": "current chat id",
    "characterName": "current character",
    "characterAvatar": "avatar.png",
    "groupId": null
  },
  "assets": {
    "characterCard": {
      "name": "current character",
      "description": "...",
      "personality": "...",
      "scenario": "...",
      "mesExample": "..."
    },
    "worldbooks": [
      {
        "name": "Current Worldbook",
        "entries": [
          {
            "uid": 1,
            "key": ["keyword"],
            "comment": "entry title",
            "content": "entry body"
          }
        ]
      }
    ],
    "promptInjection": {
      "currentMemory": "existing OC memory injection, if any"
    }
  },
  "messages": [
    {
      "index": 10,
      "role": "user",
      "name": "User",
      "content": "message text"
    },
    {
      "index": 11,
      "role": "assistant",
      "name": "Character",
      "content": "message text"
    }
  ],
  "options": {
    "createMissingCharacters": true,
    "targetMode": "review_first",
    "language": "zh-CN"
  }
}
```

Response:

```json
{
  "data": {
    "batchId": "ocmem_20260521_001",
    "candidates": [
      {
        "id": "cand_1",
        "type": "event",
        "title": "关键事件标题",
        "content": "可确认的记忆正文",
        "characters": ["角色A", "角色B"],
        "confidence": 0.86,
        "evidence": {
          "messageIndexes": [10, 11],
          "quote": "short supporting quote"
        },
        "suggestedTargets": ["oc_item", "worldbook", "prompt"],
        "writeback": [
          {
            "target": "oc_item",
            "operation": "create",
            "payload": {
              "itemType": "snippet",
              "characterNames": ["角色A", "角色B"],
              "title": "关键事件标题",
              "content": "可确认的记忆正文"
            }
          },
          {
            "target": "worldbook",
            "operation": "upsert_entry",
            "payload": {
              "bookStrategy": "character_or_oc_memory",
              "key": ["角色A", "关键事件标题"],
              "comment": "[OCML][event] 关键事件标题",
              "content": "可确认的记忆正文"
            }
          }
        ]
      }
    ],
    "warnings": []
  },
  "error": null
}
```

## POST /api/tavern/writeback/plan

Purpose: produce a writeback plan from edited candidates without committing to OC Workbench.

This is useful when the plugin lets the user edit candidates locally before writeback.

Request:

```json
{
  "batchId": "ocmem_20260521_001",
  "candidates": [
    {
      "id": "cand_1",
      "accepted": true,
      "type": "event",
      "title": "edited title",
      "content": "edited content",
      "characters": ["角色A"],
      "targets": ["oc_item", "worldbook", "prompt"]
    }
  ]
}
```

Response:

```json
{
  "data": {
    "operations": [
      {
        "id": "op_1",
        "target": "oc_item",
        "operation": "create",
        "preview": "Create snippet Item for 角色A"
      }
    ]
  },
  "error": null
}
```

## POST /api/tavern/memory/commit

Purpose: persist accepted memory into OC Workbench.

Tavern-side writes are still performed by the plugin because the OC Workbench server cannot directly edit the user's local SillyTavern files.

Request:

```json
{
  "batchId": "ocmem_20260521_001",
  "acceptedCandidates": [
    {
      "id": "cand_1",
      "type": "event",
      "title": "关键事件标题",
      "content": "确认后的内容",
      "characters": ["角色A", "角色B"],
      "ocTargets": [
        {
          "target": "item",
          "itemType": "snippet"
        }
      ],
      "relationshipTargets": []
    }
  ]
}
```

Response:

```json
{
  "data": {
    "created": {
      "characters": [],
      "items": ["item_id_1"],
      "relationships": []
    },
    "updated": {
      "characters": [],
      "items": [],
      "relationships": []
    },
    "tavernOperations": [
      {
        "candidateId": "cand_1",
        "target": "worldbook",
        "operation": "upsert_entry",
        "status": "plugin_should_apply"
      }
    ]
  },
  "error": null
}
```

## Candidate Types

Required first-version types:

- `event`
- `relationship`
- `persona_anchor`
- `ooc_guardrail`
- `worldbuilding`
- `state`

Optional later:

- `style_example`
- `timeline`
- `branch`
- `reference`

## Error Format

All bridge APIs should use:

```json
{
  "data": null,
  "error": {
    "code": "invalid_payload",
    "message": "Readable error message"
  }
}
```

The current OC Workbench app APIs often return `error` as a string. The bridge can keep string errors for consistency, but structured errors will make plugin UI easier.
