# MVP Scope

## Goal

Build a lightweight SillyTavern extension that turns an active Tavern chat into confirmed long-term OC memory.

The first version must support writing back to more than prompt injection. It should cover:

- OC Workbench assets
- SillyTavern World Info / Lorebook
- SillyTavern character card fields
- prompt injection for immediate continuity

## Non-Goals

The first version does not build a full workbench UI inside SillyTavern.

It also does not:

- continuously analyze private chat in the background
- write unreviewed AI output into long-term memory
- replace SillyTavern's native chat, character, or worldbook editors
- require the user to understand OC Workbench internals

## User Flow

1. User chats in SillyTavern.
2. User opens OC Memory Layer panel.
3. User clicks Extract.
4. Plugin sends selected chat range and current Tavern asset metadata to OC Workbench bridge API.
5. OC Workbench returns memory candidates and a proposed writeback plan.
6. User reviews, edits, deletes, or changes target for each candidate.
7. User clicks Write Back.
8. Plugin applies Tavern-side writes and calls OC Workbench bridge API to persist OC-side assets.
9. Plugin refreshes prompt injection so the current chat immediately benefits from confirmed memory.

## Plugin UI

Keep the UI close to popular SillyTavern tools:

- compact drawer in the extensions panel
- status line: connected / extracting / ready / failed
- endpoint setting
- range selector: last N messages / selected messages / whole chat
- candidate list with checkboxes and edit textareas
- target chips: OC, Worldbook, Character Card, Prompt
- writeback preview

Avoid a heavy dashboard. Deep editing stays in OC Workbench or native Tavern editors.

## Slash Commands

Suggested:

```text
/ocmem-extract range=80
/ocmem-writeback
/ocmem-preview
/ocmem-inject on|off
```

Slash commands are optional convenience paths, not the primary UX.

## Safety Rules

- AI output is candidate memory until confirmed by the user.
- Every writeback must be previewable.
- If multiple targets are selected, OC Workbench is written first, then Tavern assets.
- Character card writes should append or patch marked sections, not overwrite whole fields blindly.
- World Info entries should include stable metadata so future sync can update existing entries instead of duplicating them.
