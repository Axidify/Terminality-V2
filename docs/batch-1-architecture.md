# Terminality Rebuild — Batch 1 Architecture

## 1. Why rebuild?
- **Narrative-first hacking**: the quest/software design workflow needs to feel like writing cinematic missions, not configuring literal networking.
- **Approachable tooling**: both designers and players should immediately understand what to click/type without deep technical knowledge.
- **Data-driven & extensible**: quests, systems, and emails must exist as structured objects so that runtime tooling, future automation, and new hacking commands can plug in without rewrites.

Batch 1 focuses on defining the target architecture and domain contracts so that future batches (UI implementation, runtime hooks, persistence) share the same vocabulary.

## 2. Core Type System
- Added `client/src/types/quest.ts` with the enums and interfaces specified in the brief (system difficulty, door states, filesystem nodes, bonus objectives, intro/completion email configs, etc.).
- `QuestStepDefinition` is intentionally minimal for now; a richer command taxonomy will be defined in later batches when we tackle quest logic.
- This file becomes the single source of truth for both the authoring tools (Quest Designer, System Designer, Email UI) and the runtime (terminal, quest engine).

## 3. High-Level UI Architecture

### 3.1 Quest Designer Shell
- **Layout**: two-pane application (left: quest list & filters, right: active quest workspace).
- **Navigation**: top-level tabs/sections (Overview, Systems, Steps, Mail, Rewards) plus a primary “Guided Wizard” entry point for structured creation.
- **State**: local React state per quest draft, persisted via existing quest APIs. All quest drafts conform to the shared `QuestDefinition` types.
- **Validation**: inline validation per section + aggregate summary before saving/publishing.

### 3.2 System Designer (Wizard Step + Standalone Section)
- **Panels**: Identity, Doors, Files & Folders, Security/Trace, plus future expansions (Automations, Sensors).
- **Data binding**: the wizard edits a `QuestSystemDefinition` attached to the quest draft; the standalone Systems section provides the same editor for post-wizard tweaking.
- **Filesystem editor**: tree-based UI backed by `QuestSystemFilesystemNode`, supporting tags/log behaviors to drive runtime log generation.
- **Door modeling**: each door has status, optional unlock condition, and descriptive text so players know how to approach it.

### 3.3 Email UI (Inbox + Composer)
- **Inbox**: cinematic mail client that surfaces quest emails, lore, and side jobs. Uses `QuestIntroEmailConfig`/`QuestCompletionEmailConfig` snapshots to preview outcomes.
- **Composer**: standalone tool for writing reusable lore/quest mails with status (draft/published), foldering, and preview state (delivered/read/archived).
- **Quest wizard integration**: Intro/Completion email steps directly edit the structured configs; designers can also link reusable mails from the library.

## 4. Data Flow & Persistence
- **Authoring**: UI components manipulate in-memory `QuestDefinition` objects; saves/updates hit the existing quest API (to be adapted to the new schema once backend is ready).
- **Runtime**: terminal/quest engine loads serialized quests and systems using the shared types, so commands (scan, connect, brute-force) can reference the same doors/filesystem definitions.
- **Mail**: quest intro/completion configs live with the quest; the separate mail library remains as reusable lore content.

## 5. Extensibility Guidelines
- **Tooling**: `HackingToolId` enum enables gating quests on future commands (e.g., `packet_sniffer`) without schema changes.
- **Security rules**: `QuestSystemSecurityRules` keeps trace mechanics data-driven; new actions simply add keys to `actionTraceCosts`.
- **Completion variants**: `QuestCompletionEmailConfig` includes conditional variants so narrative consequences react to player performance (trace thresholds, bonus objectives, traps triggered).

## 6. Next Steps (Upcoming Batches)
1. **Batch 2 – Quest Designer UI**: rebuild the shell + wizard scaffolding using the new types; include section tabs, empty states, and stub data sources.
2. **Batch 3 – System Designer UX**: implement the four-panel experience inside the wizard plus standalone section, with filesystem/door editors powered by the shared schema.
3. **Batch 4 – Email UI**: recreate Inbox + Composer with cinematic styling, integrating intro/completion configs and reusable mail templates.
4. **Batch 5 – Runtime Alignment**: update terminal hosts, quest progression, and mail delivery to consume the new JSON contracts.
5. **Batch 6 – Polish & Extensibility**: add advanced tooling (templates, cloning, analytics) and prep for new hacking commands/quest types.

This document, alongside the shared `types/quest.ts`, establishes the canonical vocabulary for the rebuild so designers, engineers, and narrative leads stay aligned as we implement the new authoring and runtime experiences.
