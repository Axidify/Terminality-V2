export type TerminalStage = 'briefing' | 'investigation' | 'infiltration' | 'decryption' | 'complete'

export interface TerminalPuzzle {
  id: string
  type: 'cipher' | 'logic' | 'forensics'
  prompt: string
  solution: string
  hints: string[]
  reward: string
}

export interface TerminalNode {
  id: string
  label: string
  description: string
  exposures: string[]
  requiredTool: string
  puzzleId: string
}

export interface TerminalObjective {
  id: string
  text: string
}

export interface TerminalMission {
  codename: string
  tagline: string
  briefing: string[]
  objectives: TerminalObjective[]
  nodes: TerminalNode[]
  puzzles: TerminalPuzzle[]
  finaleCipher: TerminalPuzzle
}

export interface TerminalGameState {
  mission: TerminalMission
  stage: TerminalStage
  solvedNodeIds: string[]
  collectedIntel: string[]
  activePuzzleId: string | null
  hintsUsed: Record<string, number>
  suspicion: number
  notes: { id: string; text: string; createdAt: number }[]
  timeline: string[]
}

export const OPERATION_TOUCHSTONE: TerminalMission = {
  codename: 'OPERATION TOUCHSTONE',
  tagline: 'Trace the phantom broker hopping between abandoned relays.',
  briefing: [
    'Intel division intercepted three bursts traced to the abandoned Atlas uplink.',
    'We believe a phantom broker is staging dead drops through our sandbox servers.',
    'Use the investigative terminal to sweep the network, drain cover traffic, and surface the broker\'s true destination.'
  ],
  objectives: [
    { id: 'brief', text: 'Review the briefing and accept the contract' },
    { id: 'investigate', text: 'Map the relay chain and collect intel fragments' },
    { id: 'breach', text: 'Pierce the broker\'s vault without triggering counter traces' },
    { id: 'decrypt', text: 'Solve the finale cipher and expose the broadcast target' }
  ],
  nodes: [
    {
      id: 'ghost-relay',
      label: 'Ghost Relay',
      description: 'Sealed telemetry repeater still mirroring citizens\' data.',
      exposures: ['Telemetry bus bleeds keystream offsets', 'Operator left a diagnostic shell open'],
      requiredTool: 'pulse-scan',
      puzzleId: 'cipher-offset'
    },
    {
      id: 'midnight-cache',
      label: 'Midnight Cache',
      description: 'Encrypted message queue disguised as weather data.',
      exposures: ['Queue accepts malformed cron expressions', 'Messages stored with reversible obfuscation'],
      requiredTool: 'chrono-weave',
      puzzleId: 'logic-sequencer'
    },
    {
      id: 'vault-core',
      label: 'Vault Core',
      description: 'Final broker vault routing packets through a quantum decoy.',
      exposures: ['Fake TLS banner reveals a substitution key', 'Heartbeat includes ritual phrasing'],
      requiredTool: 'veiled-sigil',
      puzzleId: 'forensic-ritual'
    }
  ],
  puzzles: [
    {
      id: 'cipher-offset',
      type: 'cipher',
      prompt: 'Intercepted string: VCTXJ \u2192 shift by alternating offsets (1,3,1,3,...) to recover the access mnemonic.',
      solution: 'PHASE',
      hints: [
        'Write the alphabet twice and step backwards 1 then 3 positions repeatedly.',
        'Group the corrected characters into a common sci-fi security word.'
      ],
      reward: 'Intel: Telemetry offsets leak every eight seconds.'
    },
    {
      id: 'logic-sequencer',
      type: 'logic',
      prompt: 'Cron artifact: */7 3-6 ? * 2#1. Derive the only hour in which the queue opens and express it as HHMM (24h).',
      solution: '0314',
      hints: [
        '2#1 means the first Monday of the month.',
        'Queue opens at 03:14 once per week; combine digits without separators.'
      ],
      reward: 'Intel: Queue unlocks at 03:14 on first Mondays only.'
    },
    {
      id: 'forensic-ritual',
      type: 'forensics',
      prompt: 'TLS banner spells R G V B Y in sequence. Convert the color initials to keypad numbers and deliver the five-digit code.',
      solution: '74229',
      hints: [
        'Use phone keypad: R=7, G=4, V=8, B=2, Y=9.',
        'One letter repeats as you convert; do not remove duplicates.'
      ],
      reward: 'Intel: Broker handshake requires color keypad code 74229.'
    }
  ],
  finaleCipher: {
    id: 'finale',
    type: 'cipher',
    prompt: 'Combine your intel. Arrange the first letters of each intel reward to form the final passphrase.',
    solution: 'ITB',
    hints: [
      'Take each intel reward phrase and capture the first letter of the key noun.',
      'Three intel drops spell the broker\'s target acronym.'
    ],
    reward: 'Reveals the broadcast coordinates for extraction.'
  }
}

export const createInitialGameState = (mission: TerminalMission = OPERATION_TOUCHSTONE): TerminalGameState => ({
  mission,
  stage: 'briefing',
  solvedNodeIds: [],
  collectedIntel: [],
  activePuzzleId: null,
  hintsUsed: {},
  suspicion: 5,
  notes: [],
  timeline: ['Mission spool created']
})

export const getPuzzleById = (mission: TerminalMission, id: string | null) => (
  id ? mission.puzzles.find(p => p.id === id) || (mission.finaleCipher.id === id ? mission.finaleCipher : null) : null
)

export const getNodeById = (mission: TerminalMission, id: string) => mission.nodes.find(n => n.id === id) || null

export const formatIntel = (intel: string[]) => (
  intel.length ? intel.map((entry, idx) => `${idx + 1}. ${entry}`).join('\n') : 'No intel recovered yet.'
)

const randomId = () => Math.random().toString(36).slice(2, 10)

export const createNote = (text: string) => ({ id: randomId(), text, createdAt: Date.now() })
