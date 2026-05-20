# Writeback Mapping

This document defines how confirmed memory candidates map to OC Workbench and SillyTavern assets.

## Writeback Targets

### OC Workbench

OC Workbench is the long-term source of truth.

Targets:

- `Character`
- `Item`
- `CharacterRelationship`

Relevant `Item.itemType` values:

- `profile`
- `snippet`
- `reference`
- `state_card`

### SillyTavern

SillyTavern receives operational memory for better roleplay continuity.

Targets:

- prompt injection for immediate current-chat continuity
- World Info / Lorebook entries
- character-bound lorebook
- character card fields
- optional chat metadata for plugin sync state

## General Rule

OC Workbench stores structured durable memory. SillyTavern stores compact generation-facing memory.

If a candidate is useful for future asset management, write it to OC Workbench.

If a candidate is useful for the model to remember during generation, also write it to Tavern.

## Candidate Type Mapping

| Candidate type | Meaning | OC Workbench target | Tavern target | Default |
| --- | --- | --- | --- | --- |
| `event` | Plot event or key chat development | `Item(snippet)` | World Info entry + prompt injection | Write both |
| `relationship` | Relationship status or change | `CharacterRelationship` + `Item(profile)` | World Info entry + character card notes if current char | Write both |
| `persona_anchor` | Stable character trait, voice, taboo, behavior logic | `Item(profile)` or `Item(state_card)` | Character card personality/description patch + World Info | Write both |
| `ooc_guardrail` | Anti-drift instruction, banned tone, style constraint | `Item(state_card)` | prompt injection + character card notes | Tavern-heavy |
| `worldbuilding` | New setting, faction, location, rule, timeline fact | `Item(reference)` linked to relevant characters | World Info entry | Write both |
| `state` | Current phase, mood, injury, goal, temporary but important state | `Item(state_card)` | prompt injection, optionally World Info if durable | Review |
| `style_example` | Good few-shot style sample | `Item(reference)` | character card example dialogue / mesExample | Review |

## Tavern Writeback Details

### Prompt Injection

Use prompt injection for immediately needed memory.

Recommended section:

```text
<OCMemoryLayer>
Confirmed continuity memory:
- ...
</OCMemoryLayer>
```

Prompt injection should be regenerated from accepted memory, not manually appended forever.

### World Info / Lorebook

Worldbook is the primary Tavern long-term writeback target.

Recommended entry convention:

```text
comment: [OCML][event] Short title
key: ["character name", "important keyword"]
content: memory body
```

Recommended metadata in `extensions` when supported by the local entry object:

```json
{
  "oc_memory_layer": {
    "candidateId": "cand_1",
    "ocItemId": "item_id_1",
    "type": "event",
    "updatedAt": "2026-05-21T00:00:00.000Z"
  }
}
```

This allows later sync to update an existing entry instead of creating duplicates.

Worldbook selection strategy:

1. If current character has a character-bound lorebook, prefer it.
2. Else if current chat has a chat lorebook, use it for chat-local memory.
3. Else create or reuse a global book named `OC Memory Layer`.

### Character Card

Character card writes must be conservative.

Recommended approach:

- append to marked plugin sections
- never overwrite full description/personality/scenario fields without explicit user approval
- keep stable anchors short

Suggested marked sections:

```text
[OCML: Personality Anchors]
- ...
[/OCML: Personality Anchors]

[OCML: OOC Guardrails]
- ...
[/OCML: OOC Guardrails]

[OCML: Relationship State]
- ...
[/OCML: Relationship State]
```

Field suggestions:

| Memory | Character card field |
| --- | --- |
| stable personality | `personality` |
| background fact | `description` |
| current setup | `scenario` |
| style example | `mes_example` |
| anti-OOC rule | `extensions.depth_prompt` or notes-like field if available |

If the local SillyTavern version exposes safer character merge APIs, use them. Otherwise, keep character card writes behind a separate confirmation.

## OC Workbench Writeback Details

### Event

Create `Item`:

```json
{
  "itemType": "snippet",
  "title": "event title",
  "content": "confirmed event memory",
  "characterIds": ["..."]
}
```

Use `fictionalStage` when the candidate contains a clear phase label.

### Relationship

Create or update `CharacterRelationship`:

```json
{
  "fromId": "角色A",
  "toId": "角色B",
  "label": "同伴",
  "note": "relationship detail"
}
```

Also create `Item(profile)` for asymmetric relationship memory when each side perceives the relationship differently.

### Persona Anchor

Create `Item(profile)`:

```json
{
  "itemType": "profile",
  "title": "人格锚点",
  "content": "stable trait / voice / behavior logic",
  "characterIds": ["..."]
}
```

If the content describes current phase rather than stable identity, use `state_card` instead.

### OOC Guardrail

Create or update `Item(state_card)`:

```json
{
  "itemType": "state_card",
  "title": "OOC 约束",
  "content": "Do not drift into therapist/customer-service tone..."
}
```

These should be short and generation-facing.

### Worldbuilding

Create `Item(reference)`:

```json
{
  "itemType": "reference",
  "title": "setting title",
  "content": "setting fact",
  "characterIds": ["relevant characters"]
}
```

Future OC Workbench can add true world objects. First version uses character-linked references.

## Conflict and Duplicate Handling

The bridge should return possible duplicates when it detects:

- same title and same type
- highly similar content
- same relationship triple
- existing worldbook entry with matching `oc_memory_layer.candidateId` or `ocItemId`

Plugin UI should show:

- create new
- update existing
- skip

## Writeback Order

1. Validate selected candidates.
2. Resolve or create OC Workbench characters.
3. Commit OC Workbench writes.
4. Apply SillyTavern worldbook writes.
5. Apply character card patches, if selected.
6. Refresh prompt injection.
7. Save plugin sync metadata.

If step 3 fails, do not write Tavern long-term assets. Prompt injection may still be allowed as a temporary local fallback.

## Minimal Data Stored in Plugin Settings

The plugin should store only integration state:

```json
{
  "bridgeUrl": "http://127.0.0.1:3000/api/tavern",
  "lastBatchId": "ocmem_...",
  "autoInject": true,
  "defaultWorldbook": "OC Memory Layer",
  "sync": {
    "candidateId": {
      "ocItemId": "...",
      "worldbook": "OC Memory Layer",
      "worldEntryUid": 123
    }
  }
}
```

It should not store the whole OC database.
