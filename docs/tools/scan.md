# Scan Tool Specification

## 0. Tool Overview
- **Name:** `scan`
- **Category:** Recon
- **Fantasy:** Network sweep to discover live hosts and surface basic telemetry.
- **Player Role:** First move when the operator needs bearings—maps the nearby subnet, primes later exploits, and feeds discovery-driven quests.

## 1. Player-Facing Behavior

### 1.1 Syntax (Tier 1)
```
scan
scan <cidr>
scan <cidr> --deep
```
- Bare `scan` sweeps the quest-recommended range or the operator's home subnet.
- `<cidr>` must be valid notation (e.g., `10.0.0.0/24`). Tier caps gate how large a range the player can target.
- `--deep` unlocks at Tier 2, trading heavier trace for richer host intel.

### 1.2 Standard Output
```
> scan 10.0.0.0/24
Scanning 10.0.0.0/24...
Found 3 hosts:

[0] 10.0.0.5   corp-fw01       security: HIGH     open: 22, 443
[1] 10.0.0.12  corp-web01      security: MEDIUM   open: 80
[2] 10.0.0.23  lab-sandbox01   security: LOW      open: 22

TRACE +6 (network activity detected)
```
Rules:
- Always prints enumerated hosts with IP, hostname (if known), coarse security grade, and a short port list.
- If nothing is alive, emit `No live hosts detected.` plus the trace summary (`TRACE +2 (noisy sweep)`).
- Re-scanning a fully known range should say `No new hosts discovered. (N previously known)` and reduce trace impact.

### 1.3 Deep Output (`--deep`)
```
> scan 10.0.0.0/24 --deep
Deep scanning 10.0.0.0/24...
Found 2 hosts:

[0] 10.0.0.5   corp-fw01
    security: HIGH
    services:
      22/tcp   ssh        OpenSSH_8.8p1
      443/tcp  https      nginx 1.20.1
    notes:
      - potential VPN gateway
      - elevated logging
```
Differences:
- Multi-line blocks per host.
- `services` list includes protocol, service name, and version when visibility allows.
- Optional `notes` comes from host metadata (quest designers can add narrative hints).

### 1.4 Error / Edge Responses
- Invalid CIDR → `scan: invalid IP range "foo". Use CIDR, e.g. scan 10.0.0.0/24`
- Range exceeds tier cap → `scan: range too large. Max allowed is /24 for this tool tier.`
- Missing permission → `scan: you do not have recon tier 2. Complete more contracts to unlock wider scans.`
- Host already known → `No new hosts discovered. (3 previously known)` with diminished trace.

## 2. Internal Model & Runtime Integration

### 2.1 Tool Registry
```ts
export type ToolId = 'scan' | 'deep_scan' | 'bruteforce' | 'clean_logs' | 'backdoor_install'

export interface ToolDefinition {
  id: ToolId
  category: 'recon' | 'access' | 'forensics' | 'persistence' | 'utility'
  minTier: number
  maxTier: number
  baseTraceCost: number
}

export const SCAN_TOOL: ToolDefinition = {
  id: 'scan',
  category: 'recon',
  minTier: 1,
  maxTier: 3,
  baseTraceCost: 2
}
```
- Player profile tracks current tier: `tools.scan = 1..3`.
- Runtime checks `playerProfile.tools.scan >= requiredTierFor(range, flags)` before executing.

### 2.2 Command Binding
- Terminal parser in `client/src/programs/terminalRuntime.ts` routes `scan ...` to `handleScanCommand(args, ctx)`.
- Context supplies `playerProfile`, `questSession`, `worldState`, `traceState`, `hostRegistry`, `discoveryLog`.
- Handler returns `{ lines, traceDelta, events }` so the terminal UI can append text, apply trace, and emit quest telemetry.

### 2.3 Execution Flow
1. **Validate availability** (`>= tier 1`).
2. **Parse args** → determine CIDR (or default), detect `--deep` flag.
3. **Validate range** vs tier caps (T1: ≤/28, T2: ≤/24, T3: internal ranges allowed).
4. **Query host registry**: `const hosts = getHostsInRange(range)`.
5. **Apply fog**: clamp info by tier (`infoLevel = 'basic' | 'deep'`).
6. **Compute trace** (see §3) and clamp by current trace meter.
7. **Generate lines** per host format plus trace summary.
8. **Emit events**: `SCAN_PERFORMED`, `HOST_DISCOVERED` (only for newly seen hosts), high-trace warnings.
9. **Update discovery state**.

## 3. Trace Mechanics
```
traceDelta = baseTrace
           + hostCount * 1
           + (deep ? 4 : 0)
           + max(0, avgSecurityLevel - 1) * 2
```
Where security LOW=1, MED=2, HIGH=3 (clamp averages). Examples:
- Small low-sec sweep (H=2, avg=1, basic) → `2 + 2 = 4`.
- Deep corp sweep (H=5, avg≈2.5, deep) → `2 + 5 + 4 + 2 = 13`.

Threshold hooks tied to the active trace meter:
- ≥30%: remind player trace is climbing.
- ≥60% during scan: emit `HIGH_RISK_RECON` event.
- ≥90%: emit `TRACE_CRITICAL` which can fail stealth objectives immediately.

## 4. Host & World Integration
- Host metadata (`HostDefinition`) includes `securityLevel`, `services[]`, optional `scanNotes`, and `scanVisibility` (`full | limited | hidden`).
- `PlayerDiscoveryState` records `knownHosts[hostId] = { infoLevel, firstSeenAt, lastScannedAt }`.
- Re-scans upgrade `infoLevel` to `deep` when successful.

## 5. Quest Integration

### 5.1 Quest Schema Additions
```ts
interface QuestDefinition {
  reconRequirements?: {
    mustDiscoverHosts?: string[]
    allowedRanges?: string[]
    forbiddenRanges?: string[]
    mustUseScan?: boolean
  }
  objectives: QuestObjective[] // add SCAN_DISCOVERY, SCAN_STEALTH
}
```
- `SCAN_DISCOVERY` objective references a hostId plus optional range hint.
- `SCAN_STEALTH` objective describes allowed/forbidden ranges and max trace during recon.

### 5.2 Runtime Hooks
- `handleScanCommand` emits:
  - `SCAN_PERFORMED { range, deep, hosts }`
  - `HOST_DISCOVERED { hostId, range, deep }`
- Quest session listens:
  - Completes `SCAN_DISCOVERY` when matching host discovered via scan.
  - Evaluates `SCAN_STEALTH` when `SCAN_PERFORMED` occurs (range + trace compliance).

### 5.3 Narrative Branching
- Mail variants and rewards can respond to recon performance: stealth completion yields “impressed” copy; reckless scans drop the bonus but can still progress the quest.

## 6. Designer Workflow
Add a **Recon & Discovery** wizard step to `client/src/programs/QuestDesignerApp.tsx`:
- Toggle: “Does this quest involve discovering a target via recon?”
- Multi-select: Target hosts to discover, each with optional `rangeHint` text.
- Optional stealth constraints: allowed ranges, forbidden ranges, max trace slider.
- Wizard writes `reconRequirements` and auto-inserts `SCAN_DISCOVERY` / `SCAN_STEALTH` objectives.
- Warnings:
  - Missing hint when stealth objective enabled → “Consider adding a range hint…”.
  - Host outside any quest-defined ranges → highlight potential designer mistake.

## 7. Upgrade Path
- **Tier 1 (Basic):** Ranges up to /28, coarse info, medium trace.
- **Tier 2 (Advanced):** Unlocks `/24`, `--deep`, lower base trace (2→1), deep penalty (4→3), reveals host notes.
- **Tier 3 (Ghost):** Access to internal ranges, `--stealth` flag, reveals versions & vulnerability hints, trace becomes contextual (low on low-sec, still noticeable on corp nets).

Example Tier-3 command:
```
> scan 10.42.0.0/24 --stealth
Performing stealth recon on 10.42.0.0/24...
Found 1 host:

[0] 10.42.0.10  corp-internal-db01
    security: VERY HIGH
    services:
      5432/tcp  postgres  14.4
      22/tcp    ssh       OpenSSH_9.2p1
Notes:
  - internal-only segment, heavy logging likely

TRACE +2 (stealth scan)
```

## 8. Events & Telemetry
- `SCAN_FORBIDDEN_RANGE`: emitted when player hits forbidden subnet, lets narrative respond (“What were you doing there?”).
- `HOST_DISCOVERED` on lore hosts can trigger scripted mails.
- Dev telemetry (`SCAN_DEBUG_LOG`) should capture playerId, questId, range, hosts for debugging future live issues.

## 9. Edge Cases & Safeguards
- **Scan spam:** track recency; repeated scans of the same range produce reduced trace and the “No new hosts” message.
- **Huge networks:** enforce tier caps with friendly error copy.
- **Legacy quests:** if `reconRequirements` absent, scan acts as a generic quality-of-life tool.
- **Pre-known hosts:** if a quest requires discovery but the player already learned the host elsewhere, either auto-complete the objective or surface a note to the designer to adjust requirements.

## Appendix: Current Tool Catalog
| Tool ID           | Category  | Summary                           |
|-------------------|-----------|-----------------------------------|
| `scan`            | Recon     | Subnet sweeps, feeds host intel.  |
| `deep_scan`       | Recon     | Heavy probe w/ security readouts. |
| `bruteforce`      | Access    | Break guarded/locked doors.       |
| `clean_logs`      | Forensics | Scrub log files / cleanup ops.    |
| `backdoor_install`| Persistence| Implant persistent access.       |

(Quest Designer now shows these five options with descriptions in the Required Tools dropdown sourced from `client/src/programs/QuestDesignerApp.tsx`.)
