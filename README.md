# OC Tavern Plugin

SillyTavern plugin design and implementation workspace for connecting SillyTavern to OC Workbench.

This repository is intentionally separate from `oc_workbench`.

- `oc_workbench` owns character assets, long-term memory, relationships, items, and AI extraction.
- `oc_tavern_plugin` owns the SillyTavern extension UI, writeback orchestration, and Tavern-side adapters.

## Current Phase

Documentation first. No plugin implementation is committed yet.

The first implementation should stay lightweight and follow the common SillyTavern plugin style:

- one compact extension settings drawer
- one extract/review button
- one writeback button
- optional slash commands
- no full workbench UI inside Tavern

## Documents

- [Bridge API Design](docs/bridge-api.md)
- [Writeback Mapping](docs/writeback-mapping.md)
- [MVP Scope](docs/mvp-scope.md)
- [Repository Boundary](docs/repository-boundary.md)

## Product Principle

Tavern performs. OC Workbench remembers.

The plugin should not become a second OC Workbench. It should only collect Tavern context, show a small review surface, and write confirmed memory back to the correct assets.
