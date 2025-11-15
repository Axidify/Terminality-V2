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
  scanTargets: ScanTarget[]
}

export interface ScanTarget {
  id: string
  label: string
  description: string
  intel: string
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
  scanResults: Array<{ id: string; timestamp: number }>
}

export const TERMINAL_BASELINE_MISSION: TerminalMission = {
  codename: '',
  tagline: '',
  briefing: [],
  objectives: [],
  nodes: [],
  puzzles: [],
  finaleCipher: {
    id: 'finale',
    type: 'cipher',
    prompt: '',
    solution: '',
    hints: [],
    reward: ''
  },
  scanTargets: []
}

export const createInitialGameState = (mission: TerminalMission = TERMINAL_BASELINE_MISSION): TerminalGameState => ({
  mission,
  stage: 'briefing',
  solvedNodeIds: [],
  collectedIntel: [],
  activePuzzleId: null,
  hintsUsed: {},
  suspicion: 5,
  notes: [],
  timeline: ['Terminal session initialized'],
  scanResults: []
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
