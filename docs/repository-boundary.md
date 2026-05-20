# Repository Boundary

This project is deliberately split into two repositories.

## oc_workbench

Owns:

- Next.js app
- Prisma schema and migrations
- OC data model
- AI extraction prompts
- bridge API under `/api/tavern/*`
- persistence into Character / Item / CharacterRelationship

Does not own:

- SillyTavern extension manifest
- SillyTavern extension UI
- Tavern worldbook mutation code
- Tavern character card mutation code

## oc_tavern_plugin

Owns:

- SillyTavern third-party extension files
- extension settings drawer
- Tavern context collection
- review UI
- writeback preview UI
- calls to OC Workbench bridge API
- Tavern-side adapters:
  - prompt injection
  - World Info / Lorebook upsert
  - character card patching
  - slash commands

Does not own:

- OC Workbench database schema
- OC Workbench web app pages
- OC Workbench AI service internals

## Shared Contract

The shared contract is documentation and JSON API payloads, not copied code.

Recommended shared artifacts:

- API examples in `docs/bridge-api.md`
- candidate type names
- writeback target names
- schema version numbers

Avoid importing source files across repositories.

## Implementation Sequence

1. Add `/api/tavern/*` bridge routes to `oc_workbench`.
2. Build plugin read-only extraction call in `oc_tavern_plugin`.
3. Add candidate review UI in `oc_tavern_plugin`.
4. Add OC Workbench commit route.
5. Add Tavern worldbook writeback.
6. Add character card patching behind explicit confirmation.
7. Add prompt injection refresh.

This keeps the source of truth clear at every step.
