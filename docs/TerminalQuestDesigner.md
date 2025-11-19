# Terminal Quest Designer & Terminal App Architecture

## 1. High-Level Overview

### 1.1 Purpose of the Terminal Quest Designer

The **Terminal Quest Designer** is an internal authoring tool for building and managing “Operations” (a.k.a. quests) that drive narrative and progression inside **Terminality OS**. An Operation defines:

- What the player sees:
  - Secure Inbox subjects + bodies.
  - Terminal narrative and handler personas.
- What the player must do:
  - Concrete terminal actions (scan host, connect, delete file, acknowledge command, etc.).
- When it happens:
  - Triggers based on flags, previous operations, or first-time events.
- What it changes:
  - Player flags and credits.
  - Host/filesystem layouts via overrides.

Designers work entirely in the Quest Designer UI; the **Terminal app** consumes the published Operation definitions via backend APIs and enforces them at runtime.

### 1.2 Operations/Quests in Terminality OS

Within Terminality OS, Operations act as:

- **Narrative Units**:
  - Each Operation represents a single mission/quest (e.g. “Scan Relay SR-201”).
  - It includes an associated Secure Inbox thread (subject/body, handler name), and optional follow-up messages.
- **Progression Units**:
  - Operations encode gating logic (prerequisite flags and quests).
  - Completion outputs new flags and credits.
- **Interaction Specs**:
  - Each step specifies a concrete action the player must perform in the terminal.
  - Steps are validated against the current game state (flags, filesystem, commands issued).

They tie into:

- **Secure Inbox**: frontdoor for narrative. Operations drive which messages appear and when.
- **Terminal Commands**: each step is basically a contract like “run a scan against host X”, “connect to host Y”, “delete file at path Z”.
- **Flags**: game state is largely described via key/value flags (e.g. `quest_SR201_completed=true`).

### 1.3 Relationship Between Components

Conceptually:

- **Quest/Operation Designer (Admin UI)**
  - A React app (`QuestDesignerApp`) used by designers.
  - Talks to backend admin APIs:
    - List/create/update/delete Operations.
    - Manage system profiles and filesystem templates.
  - Stores/publishes Operations into the DB.

- **Terminal App (Player UI)**
  - Another app in the same OS (a program in the desktop).
  - Talks to player-facing APIs:
    - Fetch available Operations for this player.
    - Fetch the Secure Inbox messages.
    - Report actions (commands, file operations).
    - Receive state updates (flags, credits, filesystem).

- **Backend API**
  - Single source of truth for:
    - Operation definitions (quests).
    - Player state (flags, credits, progression).
    - Filesystem snapshots/overrides.
  - Exposes:
    - Admin endpoints (Quest Designer).
    - Player endpoints (Terminal app).

- **Database**
  - Stores persistent data:
    - Operation definitions and metadata.
    - Internal narratives and triggers.
    - Player-specific quest state, flags, and credits.
    - Host/filesystem baselines and overrides.

Data flow:

1. Designer edits/publishes Operations in the Quest Designer (admin client).
2. Backend writes those to DB.
3. Terminal app fetches Operations + inbox content based on player state.
4. Player actions hit backend APIs which:
   - Validate against OperationSteps.
   - Update flags and rewards.
   - Potentially unlock new Operations or messages.

---

## 2. Data Model & Schema

Below models are described conceptually in TypeScript-like notation and mapped to typical DB structures (e.g. Prisma/SQL tables or JSON documents).

### 2.1 Operation (Quest)

**Conceptual TypeScript:**

```ts
type QuestStatus = 'draft' | 'published';

interface Operation {
  id: string;                // internal ID, unique and stable
  title: string;             // player-facing title
  description: string;       // player-facing description
  trigger: OperationTrigger; // when this Operation activates
  steps: OperationStep[];    // ordered list of required actions
  rewards: OperationRewards; // credits + flags
  requirements: OperationRequirements; // prereq flags/quests
  default_system_id?: string;          // default host/system
  embedded_filesystems: Record<string, HostOverride>; // per-system overrides
  completion_flag?: string;           // set when completed
  status: QuestStatus;                // draft/published
}
```

**DB Mapping (example SQL):**

- Table: `operations`
  - `id` (PK, string)
  - `title` (string)
  - `description` (text)
  - `trigger` (JSON)
  - `steps` (JSON)
  - `rewards` (JSON)
  - `requirements` (JSON)
  - `default_system_id` (string, FK → `systems.id`)
  - `embedded_filesystems` (JSON)  // keyed by systemId → filesystem tree
  - `completion_flag` (string)
  - `status` (enum: draft/published)

**Internal vs Player-Facing:**

- Player-facing:
  - `title`, `description`, some `rewards` (credits), some flags (if surfaced in UI).
- Internal:
  - `id`, `trigger`, `requirements`, `embedded_filesystems`, `completion_flag`, low-level step metadata.

### 2.2 OperationNarrative

Narrative governs Secure Inbox messages and handler persona.

**Conceptual:**

```ts
interface OperationNarrative {
  operationId: string;
  handlerName: string;       // e.g. "Atlas Control"
  inboxSubject: string;      // initial subject
  inboxBody: string;         // initial message body (markdown/plain)
  completionSubject?: string;
  completionBody?: string;
  failureSubject?: string;
  failureBody?: string;
}
```

**DB:**

- Table: `operation_narratives`
  - `operation_id` (PK/FK → `operations.id`)
  - `handler_name`
  - `inbox_subject`
  - `inbox_body`
  - `completion_subject`, `completion_body`
  - `failure_subject`, `failure_body`

**Visibility:**

- Entirely player-facing content (but never editable by player).

### 2.3 OperationTrigger

Defines when an Operation becomes active.

**Conceptual:**

```ts
type OperationTriggerType =
  | 'ON_FIRST_TERMINAL_OPEN'
  | 'ON_QUEST_COMPLETION'
  | 'ON_FLAG_SET';

interface OperationTriggerBase {
  type: OperationTriggerType;
}

interface OnFirstTerminalOpenTrigger extends OperationTriggerBase {
  type: 'ON_FIRST_TERMINAL_OPEN';
}

interface OnQuestCompletionTrigger extends OperationTriggerBase {
  type: 'ON_QUEST_COMPLETION';
  quest_ids?: string[];  // which quests must complete
}

interface OnFlagSetTrigger extends OperationTriggerBase {
  type: 'ON_FLAG_SET';
  flag_key?: string;     // watched flag
  flag_value?: string;   // optional value match
}

type OperationTrigger =
  | OnFirstTerminalOpenTrigger
  | OnQuestCompletionTrigger
  | OnFlagSetTrigger;
```

**DB:**

- In `operations.trigger` JSON:
  - `{ type: 'ON_QUEST_COMPLETION', quest_ids: ['quest_intro'] }`
  - `{ type: 'ON_FLAG_SET', flag_key: 'quest_SR201_completed', flag_value: 'true' }`

**Internal vs Player-Facing:**

- Entirely internal; players don’t see triggers explicitly.

### 2.4 OperationStep

Steps define the required actions. In the designer, these appear as “Steps” with type, system target, etc.

**Conceptual:**

```ts
type StepType = 'SCAN_HOST' | 'CONNECT_HOST' | 'DELETE_FILE' | 'DISCONNECT_HOST' | 'ACK_COMMAND';

interface OperationStep {
  id: string;                  // internal ID, unique within operation
  type: StepType;              // what kind of action is required
  target_system_id?: string;   // if omitted, uses Operation.default_system_id
  auto_advance?: boolean;      // default true
  params?: {
    target_ip?: string;
    file_path?: string;
    // other step-specific params...
  };
  hints?: {
    prompt?: string;           // hint text
    command_example?: string;  // example command shown to player
  };
}
```

**DB:**

- `operations.steps` JSON array, each element shaped as above.

**Internal vs Player-Facing:**

- Player-facing:
  - `hints.prompt`, `hints.command_example` if surfaced by the terminal help UI.
- Internal:
  - `id`, `type`, `params`, `target_system_id` (used for validation only).

### 2.5 StepValidation

Validation is implicit in the step type + params, but conceptually:

```ts
interface StepValidation {
  expected_ip?: string;
  expected_file_path?: string;
  expected_flag_changes?: Record<string, string | boolean>;
  // there may be more rule-like validations
}
```

In practice:

- Validation logic lives in backend code that inspects:
  - Step `type` & `params`.
  - Player’s current filesystem state.
  - Commands executed (e.g. recorded as events).
- DB: encoded inside `steps` JSON or in supporting tables for analytics.

### 2.6 OperationFlags

Flags are used both for prereqs and outputs.

**Conceptual:**

```ts
interface OperationRequirements {
  required_flags: string[];  // e.g. ['quest_intro_completed=true']
  required_quests: string[]; // Operation IDs that must be completed
}

interface OperationRewardFlag {
  key: string;   // e.g. 'quest_SR201_completed'
  value?: string; // often 'true'
}

interface OperationRewards {
  credits?: number;
  flags?: OperationRewardFlag[];
  unlocks_commands?: string[]; // optional: commands unlocked by completion
}
```

**DB:**

- `operations.requirements` JSON:
  - `{ required_flags: ['quest_intro_completed=true'], required_quests: ['quest_intro'] }`
- Also `operations.completion_flag` (single, canonical completion flag).

**Internal vs Player-Facing:**

- Flags are mostly internal.
- Credits and unlocked commands may be surfaced.

### 2.7 HostOverride & FilesystemNode

Filesystem overrides allow each Operation to alter the filesystem for specific systems.

**Conceptual Nodes:**

```ts
export interface FileSystemNode {
  type: 'dir' | 'file';
  name: string;
  path: string;        // absolute path
  children?: string[]; // for 'dir', list of child ids or paths
  content?: string;    // for 'file'
}

export type FilesystemMap = Record<string, FileSystemNode>;

interface HostOverride {
  // for a given systemId, a map of nodes
  [path: string]: FileSystemNode;
}
```

In the Quest Designer:

- `embedded_filesystems: Record<systemId, FilesystemMap>`

**DB:**

- `operations.embedded_filesystems` JSON:
  - Keys are `systemId`, values are filesystem maps.

**Internal vs Player-Facing:**

- Entirely internal, but their effect is visible to the player as the host filesystem.

---

## 3. Quest Designer UI Flow

### 3.1 Creating a New Operation

In `QuestDesignerApp`:

1. Designer clicks **“+ New”** in the sidebar.
2. A new draft Operation is created with:
   - Generated `id` (`quest_<timestamp>`).
   - Default trigger: `ON_FIRST_TERMINAL_OPEN`.
   - Empty steps, zero credits, no flags.
   - Status: `draft`.
3. Draft appears in the quest list and as a full editable form in the editor.

### 3.2 Setting Narrative

Narrative fields are configured via:

- **Title** & **Description**:
  - Player-facing; map to `operations.title` and `operations.description`.
- Secure Inbox–related narrative is modeled conceptually in the backend via `OperationNarrative` (handler, subject/body). In practice, these are either:
  - Part of the Operation’s extended schema (or a separate, linked table).
  - Authored via fields in the designer (e.g. handler name, subject/body text areas).

The designer:

- Enters handler name and message content (if available in current UI).
- Associates them with the Operation ID for message generation in the Terminal app.

### 3.3 Configuring Triggers & Prerequisites

Fields in the **Quest Info** section:

- **Trigger** select:
  - `On First Terminal Open` → `ON_FIRST_TERMINAL_OPEN`.
  - `On Quest Completion` → `ON_QUEST_COMPLETION` with `quest_ids`.
  - `On Flag Set` → `ON_FLAG_SET` with `flag_key` and optional `flag_value`.
- **Completion Quests**:
  - Multi-select for quest IDs that must complete before this Operation triggers.
- **Trigger Flag Key / Required Value**:
  - For `ON_FLAG_SET`, the key/value to watch.
- **Required Quests / Required Flags**:
  - Under **Requirements** section, designer chooses:
    - Prior quests that must be completed.
    - Flags that must be present before the operation can unlock.

### 3.4 Adding Steps & Validation

Under **Steps**:

- Designer can:
  - Click **“+ Add Step”** to append a step.
  - For each step:
    - Set Step ID (internal).
    - Choose Step Type (`SCAN_HOST`, `CONNECT_HOST`, `DELETE_FILE`, `DISCONNECT_HOST`, `ACK_COMMAND`, etc.).
    - Choose **Target System**:
      - Per-step override or default system.
    - Set Params:
      - `Target IP` for host-related steps.
      - `File Path` for `DELETE_FILE`.
    - Configure hints:
      - **Hint Prompt**.
      - **Command Example**.

Validation is handled by:

- Backend logic ensures:
  - Required params are present (e.g. `target_ip`, `file_path`).
  - Steps have valid types.

The **Validate Quest** button:

- Sends the assembled Operation payload to the backend for validation.
- Displays errors/warnings in the UI.

### 3.5 Setting Flags & Rewards

In **Requirements** and **Rewards** sections:

- Designer defines:
  - **Completion Flag**:
    - Auto-set when operation completes (e.g. `quest_SR201_completed`).
  - **Required Flags**:
    - Flags which must already be set.
  - **Required Quests**:
    - Quests which must be completed.
  - **Rewards**:
    - Credits.
    - Reward flags (e.g. `quest_SR201_completed=true`).
    - Unlock commands (optional, if supported by runtime).

### 3.6 Defining Filesystem Overrides via GUI

Under **Filesystem** section:

- Tabs:
  - **Overrides**:
    - Shows a card per system currently in use by the quest:
      - via `default_system_id`.
      - via any step `target_system_id`.
  - **Systems**:
    - Used to create/edit/delete system profiles for reuse.

In the **Overrides** tab:

For each `systemId` in use:

- A card shows:
  - System label + ID.
  - If an override is applied, an **“Override Applied”** pill.
  - Controls:
    - Apply template (drop-down).
    - **Apply Override**: copy working filesystem map into `embedded_filesystems[systemId]`.
    - **Remove Override**: clear `embedded_filesystems[systemId]`.
  - **Save as Template**: snapshot current working filesystem as a reusable template.
  - A tree/content editor (`FilesystemOverrideEditor`) to:
    - Add/remove files or directories.
    - Change content.

The designer can also:

- Edit the per-card **System ID** (for the quest-level override mapping):
  - Inline editor that renames `systemId` within:
    - Steps’ `target_system_id`.
    - `default_system_id`.
    - `embedded_filesystems` keys.
- Manage templates:
  - Open **Template Library**, view saved filesystem templates, delete templates.

### 3.7 Saving Drafts, Publishing, Snapshots

Top-level controls:

- **Save Draft**:
  - Validates the Operation locally.
  - If new, POSTs to backend.
  - If existing, PUTs to backend.
  - Keeps `status = draft`.
- **Publish**:
  - Same as save, but with `status = published`.
  - Backend persists as published version.
  - Emits an event (`terminalQuestsUpdated`) for live environments.
- **Delete**:
  - Deletes a published/draft quest (with confirmation).
- **Snapshots**:
  - Quest list shows lifecycle status snapshot (Not Started / Active / Completed) based on latest player state snapshot.
  - Designer can click **Refresh Status** to re-fetch.

Sidebar features:

- Quest list with:
  - Search box (filter by title/id).
  - Status filter chips (All, Active, Completed, Not Started).
  - Lifecycle and publish status icons.
  - Draggable ordering (persisted per designer in local storage).

---

## 4. Terminal App Interaction

### 4.1 Secure Inbox & Operations

The Terminal app combines:

- **Secure Inbox UI**:
  - Shows messages derived from `OperationNarrative` and active operations.
- **Operation Controller**:
  - Tracks which Operations are:
    - Available (trigger + prerequisites satisfied).
    - Active (started but not completed).
    - Completed.

#### Batch 5: Designer-driven quest mail

- **Quest Designer wizard** now contains dedicated **Intro** and **Completion** email steps powered by the shared `QuestIntroEmailConfig`/`QuestCompletionEmailConfig` types. Authors can:
  - Pick handler personas, prefill Atlas templates, and insert structured tokens from the intro step.
  - Compose default completion mail plus per-outcome variants, each with trace/bonus/trap delivery conditions.
- **Validation** enforces sender/subject/body requirements across intro + completion mails and ensures every completion variant declares at least one valid condition payload.
- **Mail sync bridge** (`client/src/services/questMailSync.ts`) converts every saved quest into deterministic preview messages:
  - Intro mail → `quest_preview_intro_<questId>`.
  - Completion default + each variant → `quest_preview_completion_*` IDs.
  - Previews persist existing read/archive state when quests are re-saved and are deleted automatically when drafts are removed.
- **EmailApp integration** seeds preview mail on launch and listens for the `terminality:quest-mail-sync` event so the inbox refreshes as soon as designers press **Save** in Quest Designer.

The Terminal app:

1. Fetches player state (flags, completed operations).
2. Fetches published Operations.
3. Evaluates triggers to determine:
   - Which operations should be active.
4. Builds Secure Inbox threads:
   - For each active Operation, create or update a thread with handler + subject/body.

### 4.2 Trigger Evaluation

Key trigger types:

- `ON_FIRST_TERMINAL_OPEN`:
  - When the player opens the terminal for the first time:
    - Backend sets a flag like `terminal_opened=true`.
    - Any Operation with this trigger and satisfied prerequisites becomes active.
- `ON_QUEST_COMPLETION`:
  - Backend listens for operations completing:
    - When Operation A completes, it checks for operations triggered by `ON_QUEST_COMPLETION` with `quest_ids` that include A.
- `ON_FLAG_SET`:
  - On any flag change:
    - Backend scans for operations with a matching `flag_key` and matching `flag_value` (if specified).

Once an Operation becomes active:

- A new Secure Inbox message is generated (from `OperationNarrative`) and delivered to the player.

### 4.3 Player Actions & Step Validation

Player interaction flow:

1. Player reads inbox instructions (handler, subject, body).
2. Player issues commands in the Terminal app (SCAN, CONNECT, RM/DELETE, etc.).
3. Terminal app sends those actions to backend endpoints:
   - e.g. `POST /api/terminal/command` with `{ command, args, current_system, current_path }`.

Backend:

- Looks up:
  - Active Operation(s).
  - Current step for each Operation.
- For each command:
  - Validates against the current step:
    - `SCAN_HOST`: command must target `params.target_ip`.
    - `CONNECT_HOST`: successful connection to the specified IP.
    - `DELETE_FILE`: file at `params.file_path` must be removed.
    - `ACK_COMMAND`: acknowledging with some pattern.
- On successful validation:
  - Marks the step complete.
  - If `auto_advance = true`, moves to next step.

### 4.4 Completion Flags & Rewards

When the last step completes:

- Backend:
  - Applies:
    - `OperationRewards.credits`: increments player credits.
    - Reward flags (`OperationRewards.flags`).
    - `completion_flag` (canonical).
  - Marks Operation as completed for this player.

Non-repeatable enforcement:

- Each Operation has `completion_flag` and/or appears in player’s `completed_operations`:
  - Before re-activating, backend checks:
    - If `completion_flag` is set.
    - If `isRepeatable` is false (or implied by absence of repeat logic).
  - If already completed and non-repeatable, Operation is not re-added to active list.

Completion also:

- Can trigger new Operations (via `ON_QUEST_COMPLETION` or `ON_FLAG_SET` triggers).
- May spawn completion inbox messages.

### 4.5 HostOverride / FilesystemNode in the Terminal

For each host/system the player connects to:

1. Backend computes the effective filesystem:
   - Base system profile filesystem (from system profile).
   - Overlays Operation-specific `embedded_filesystems[systemId]` where this Operation is active.
2. The Terminal app receives this as a filesystem tree:
   - Directory listing commands show the overridden structure.
   - File read/write commands operate against the overlay.

Key idea:

- HostOverride is just a specialized delta applied atop the base host filesystem for as long as the Operation is active (or until overridden again).

---

## 5. API & Backend Flow

### 5.1 Conceptual Endpoints

Admin / Quest Designer (secured):

- `GET /api/terminal-quests?includeDrafts=true`
  - List all quests (Operations) for authoring UI.
- `POST /api/terminal-quests`
  - Create a new quest.
- `PUT /api/terminal-quests/:id`
  - Update existing quest.
- `DELETE /api/terminal-quests/:id`
  - Delete quest.
- `GET /api/terminal-systems`
  - List system profiles and filesystem templates.
- `POST /api/terminal-systems`
  - Create system profile or template.
- `PUT /api/terminal-systems/:id`
  - Update system profile or template.
- `DELETE /api/terminal-systems/:id`
  - Delete profile or template (with `?template=true` support).

Player-facing:

- `GET /api/player/operations`
  - List available/active operations for this player (only `published` ones, filtered by triggers and prereqs).
- `GET /api/player/inbox`
  - List Secure Inbox threads/messages, often derived from OperationNarratives.
- `POST /api/player/command`
  - Submit a terminal command; backend validates against active OperationSteps.
- `POST /api/player/operations/:id/complete` (conceptual)
  - Mark operation complete; apply rewards.
- `GET /api/player/filesystem?systemId=...`
  - Return effective filesystem for given host, incorporating overrides.
- `GET /api/player/state`
  - Return flags, credits, completed operations.

### 5.2 Typical Flow

**Designer → Backend → Terminal → Backend → Terminal**

1. **Designer publishes an Operation**
   - Quest Designer UI:
     - Sends `POST` or `PUT` with Operation payload to admin API.
   - Backend:
     - Validates and writes to `operations` table.
     - Optionally records snapshots/history.
   - Operation is now `status = 'published'`.

2. **Terminal app fetches operations/messages**
   - On session start or refresh:
     - Terminal calls `GET /api/player/state`.
     - Terminal calls `GET /api/player/operations`.
   - Backend:
     - Loads all `published` Operations.
     - Applies triggers & prereqs based on player state.
     - Returns only the relevant Operations.

3. **Terminal builds inbox & UI**
   - For each active Operation:
     - Attaches `OperationNarrative`.
   - Shows appropriate Secure Inbox threads.
   - Presents steps as invisible scaffolding; player just sees instructions.

4. **Player performs actions**
   - Player types commands (e.g. `scan 10.0.0.5`). Terminal:
     - Sends `POST /api/player/command`.
   - Backend:
     - Validates command against the current step.
     - If successful, marks step complete; may advance to next step.
     - If last step, marks operation complete and applies rewards/flags.

5. **Backend updates state**
   - On completion:
     - Sets `completion_flag`.
     - Adds entry to player’s completed operations set.
     - Adjusts credits.
   - New flags may activate additional Operations.

6. **Terminal refreshes view**
   - On next state fetch, Terminal:
     - Receives updated operations list and inbox messages.
     - Some operations may disappear from active list.
     - New operations may appear, triggered by completion.

---

## 6. State, Sessions, and Timeouts

### 6.1 Session State

Client side (Terminality OS):

- Uses a **Desktop Save Service** (e.g. `saveService`) to persist:
  - Open apps/windows.
  - Layout and positions.
  - Some app-specific state (e.g. which quest is selected in designer).

On load:

- OS hydrates from server snapshot (or local cache) to restore the desktop and open apps.

### 6.2 Inactivity Timeout

Session activity is signaled with utilities like `signalSessionActivity`, e.g.:

- On key actions (save quest, publish, validate, etc.), the client calls `signalSessionActivity('quest-save-attempt')` (or similar tokens).
- Backend:
  - Tracks last-activity timestamps.
  - May log out / destroy sessions after inactivity to prevent stale state.

Effect on operations & terminal:

- Operations themselves are not directly timed out.
- Session timeout may:
  - Require re-authentication.
  - Possibly cause the terminal to re-fetch state upon reconnect.
- Persistent state (quests, flags, credits, filesystem) live in DB and are unaffected by session boundaries.

### 6.3 DB vs Client/Session State

- **Persisted in DB:**
  - Operation definitions, narratives, triggers, steps.
  - System profiles and filesystem templates.
  - Player flags, credits, completed operations.
  - Per-player filesystem state (baseline) and saved override effects if needed.

- **Client-only or session-based:**
  - Quest Designer sidebar filters and search.
  - Quest ordering preferences (per designer).
  - UI-level toggles: template manager open, tab selection, etc.
  - Tooltip positions, editing mode states.

---

## 7. Examples & Diagrams

### 7.1 Example Operation: “SR-201: Relay Scan”

#### 7.1.1 Designer’s Operation Definition

**Operation:**

```ts
const operation_SR201: Operation = {
  id: 'SR-201',
  title: 'Relay SR-201 Scan',
  description: 'Scan relay SR-201 and report its current status.',
  trigger: { type: 'ON_FIRST_TERMINAL_OPEN' },
  requirements: {
    required_flags: [],
    required_quests: []
  },
  default_system_id: 'relay_sr201',
  steps: [
    {
      id: 'step_scan',
      type: 'SCAN_HOST',
      target_system_id: 'relay_sr201',
      auto_advance: true,
      params: {
        target_ip: '10.0.0.5'
      },
      hints: {
        prompt: 'Use the scan command to probe the relay.',
        command_example: 'scan 10.0.0.5'
      }
    }
  ],
  rewards: {
    credits: 200,
    flags: [{ key: 'quest_SR201_completed', value: 'true' }],
    unlocks_commands: []
  },
  embedded_filesystems: {
    relay_sr201: {
      '/': { type: 'dir', name: '/', path: '/', children: ['/logs'] },
      '/logs': { type: 'dir', name: 'logs', path: '/logs', children: ['/logs/status.txt'] },
      '/logs/status.txt': {
        type: 'file',
        name: 'status.txt',
        path: '/logs/status.txt',
        content: 'Relay SR-201 nominal.'
      }
    }
  },
  completion_flag: 'quest_SR201_completed',
  status: 'published'
};
```

**Narrative:**

```ts
const narrative_SR201: OperationNarrative = {
  operationId: 'SR-201',
  handlerName: 'Atlas Control',
  inboxSubject: 'SR-201: Initial Diagnostics',
  inboxBody: `
We need a health check on relay SR-201.

1. Open the terminal.
2. Scan host 10.0.0.5 and report the result.

– Atlas Control
  `,
  completionSubject: 'SR-201: Diagnostics Received',
  completionBody: `
Good work. Relay SR-201 is responding nominally.

Your account has been credited.

– Atlas Control
  `
};
```

#### 7.1.2 DB Representation (Simplified)

- `operations` row:

```json
{
  "id": "SR-201",
  "title": "Relay SR-201 Scan",
  "description": "Scan relay SR-201 and report its current status.",
  "trigger": { "type": "ON_FIRST_TERMINAL_OPEN" },
  "steps": [
    {
      "id": "step_scan",
      "type": "SCAN_HOST",
      "target_system_id": "relay_sr201",
      "auto_advance": true,
      "params": { "target_ip": "10.0.0.5" },
      "hints": {
        "prompt": "Use the scan command to probe the relay.",
        "command_example": "scan 10.0.0.5"
      }
    }
  ],
  "rewards": {
    "credits": 200,
    "flags": [{ "key": "quest_SR201_completed", "value": "true" }],
    "unlocks_commands": []
  },
  "requirements": { "required_flags": [], "required_quests": [] },
  "default_system_id": "relay_sr201",
  "embedded_filesystems": {
    "relay_sr201": {
      "/": { "type": "dir", "name": "/", "path": "/", "children": ["/logs"] },
      "/logs": { "type": "dir", "name": "logs", "path": "/logs", "children": ["/logs/status.txt"] },
      "/logs/status.txt": {
        "type": "file",
        "name": "status.txt",
        "path": "/logs/status.txt",
        "content": "Relay SR-201 nominal."
      }
    }
  },
  "completion_flag": "quest_SR201_completed",
  "status": "published"
}
```

- `operation_narratives` row:

```json
{
  "operation_id": "SR-201",
  "handler_name": "Atlas Control",
  "inbox_subject": "SR-201: Initial Diagnostics",
  "inbox_body": "We need a health check on relay SR-201...\n",
  "completion_subject": "SR-201: Diagnostics Received",
  "completion_body": "Good work. Relay SR-201 is responding nominally...\n"
}
```

#### 7.1.3 Player Flow (Bullet Sequence)

1. **Designer**:
   - Creates “SR-201” Operation in Quest Designer, sets trigger, steps, overrides, rewards, narrative.
   - Publishes Operation.

2. **Backend**:
   - Stores Operation and narrative in DB.
   - Marks it as `published`.

3. **Player first opens Terminal**:
   - Terminal app:
     - Calls `GET /api/player/state` and `GET /api/player/operations`.
   - Backend:
     - Sees `ON_FIRST_TERMINAL_OPEN` Operations (including SR-201).
     - Marks SR-201 as active for this player.
   - Inbox:
     - `GET /api/player/inbox` returns a thread for SR-201 with `Atlas Control` message.

4. **Player reads Secure Inbox**:
   - Sees instructions: scan `10.0.0.5`.

5. **Player runs terminal command**:
   - `scan 10.0.0.5`.
   - Terminal app sends `POST /api/player/command` with context.

6. **Backend validates**:
   - Finds SR-201 active and on step `step_scan`.
   - Confirms:
     - Command is `scan`.
     - Target IP equals `10.0.0.5` (from `params.target_ip`).
   - Marks step complete.

7. **Operation completion**:
   - No further steps → Operation SR-201 complete.
   - Backend:
     - Sets `quest_SR201_completed=true`.
     - Adds `SR-201` to player’s completed operations.
     - Adds `200` credits.

8. **Inbox update**:
   - Next `GET /api/player/inbox` includes completion message from `narrative_SR201`.

9. **Future triggers**:
   - Any other Operation triggered on:
     - `ON_QUEST_COMPLETION` with `quest_ids: ['SR-201']`, or
     - `ON_FLAG_SET` with `flag_key: 'quest_SR201_completed'`
   - can now activate.

#### 7.1.4 Sequence Diagram (Textual Markdown)

```text
Designer               Backend                    Terminal App              DB
   |                      |                            |                     |
   |-- publish SR-201 --> |                            |                     |
   |                      |-- write Operation -------> | operations table    |
   |                      |-- write Narrative -------> | operation_narratives|
   |                      |                            |                     |
   |                      |                            |-- open terminal --> |
   |                      |<-- GET /player/state ----- |                     |
   |                      |<-- GET /player/operations-|                     |
   |                      |-- evaluate triggers -----> |                     |
   |                      |-- respond active SR-201 -->|                     |
   |                      |                            |                     |
   |                      |<-- GET /player/inbox -----|                     |
   |                      |-- respond SR-201 msg ---->|                     |
   |                      |                            |-- player runs scan->|
   |                      |<-- POST /player/command --|                     |
   |                      |-- validate vs SR-201 ---->|                     |
   |                      |-- update flags/credits -->| player_flags, etc.  |
   |                      |                            |                     |
   |                      |<-- GET /player/inbox -----|                     |
   |                      |-- respond completion msg->|                     |
```

---

If you’d like, the next iteration of this document can include actual endpoint signatures and any Prisma schema excerpts so another developer can jump straight into the codebase and match these conceptual structures to real types.