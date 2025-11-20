# Quest Designer: Objective & Accept Hint Guide

This short guide explains how designers can author an operation's short objective and intro email acceptance hint and how those fields surface in the Terminal runtime and the in-game inbox.

## Fields

- `objectiveShort` (Quest): A one-line objective shown in the Terminal header and the introductory lines when a player accepts a quest. Provide a concise, single-line instruction (e.g. `Wipe /logs/auth/trace.log on 10.23.4.8`). The designer UI shows this as `Objective (short)`.
- `introEmail` (Quest; Mail Template): Draft the agent briefing (subject, body) that appears as an inbox message. The intro email has additional controls:
  - `showAcceptHint` (boolean): When true (default), the intro email preview and the player's Terminal welcome show a short hint with instructions for accepting the contract.
  - `acceptHintOverride` (optional string): A custom string that replaces the default acceptance example. If omitted, the default hint `To accept this contract, run:\n\nquest start <questId>` is appended.

## Runtime behavior
- When a player accepts a quest, the Terminal displays:
  - `Quest accepted: <title>`
  - `Briefing: <introEmail.preheader or first non-empty line of body>`
  - `Objective: <objectiveShort or shortDescription or first step description>`
  - `To accept this contract, run: quest start <questId>` (if `showAcceptHint` enabled). If an override is provided, that text is shown instead.

- The intro mail's body also includes the acceptance hint when `showAcceptHint` is enabled. If `acceptHintOverride` is specified, the override text is used there too.

## Designer UX notes
- `Objective (short)` is validated to be non-empty in the Quest Details step — this helps Terminal UI and list views show concise objectives.
- The accept hint is enabled by default; designers can uncheck `Show "how to accept" hint in this email` in the Intro Email step if they don't want the hint to appear.
- Avoid writing very long multi-line objectives — the runtime will sanitize newlines into a single line for display.

## Testing & QA
- Use the Quest Designer to create a draft and preview the intro mail in the `Mail` workspace. The inbox preview and terminal welcome should both contain the same acceptance hint text when enabled.

## Implementation notes (for devs)
- Terminal and mail preview logic reads these fields directly from the quest definitions. The terminal runtime sanitizes objective text and appends the acceptance hint using the intro email config.
