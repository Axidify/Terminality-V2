import {
  type QuestSystemDefinition,
  type QuestSystemDoor,
  type QuestSystemFilesystemNode,
  type QuestSystemSecurityRules,
  type SystemDifficulty
} from '../../types/quest'
import { generateId } from './id'

const COMMON_PORTS = [22, 23, 25, 53, 80, 110, 135, 443, 465, 587, 993, 1433, 3306, 3389, 5021, 8080, 31337]

const randomOctet = (min = 0, max = 255) => {
  const clampedMin = Math.max(0, min)
  const clampedMax = Math.min(255, max)
  const span = clampedMax - clampedMin + 1
  return clampedMin + Math.floor(Math.random() * Math.max(1, span))
}

export const generateRandomIp = () => `10.${randomOctet(0, 199)}.${randomOctet(0, 254)}.${randomOctet(2, 250)}`

export const suggestPort = (doors: QuestSystemDoor[]) => {
  for (const port of COMMON_PORTS) {
    if (!doors.some(door => door.port === port)) {
      return port
    }
  }
  const fallback = doors.reduce((highest, door) => Math.max(highest, door.port), 1024) + 1
  return fallback > 65535 ? 60000 : fallback
}

const createDoor = (overrides: Partial<QuestSystemDoor>): QuestSystemDoor => ({
  id: generateId('door'),
  name: 'New Door',
  port: 0,
  status: 'locked',
  description: '',
  unlockCondition: { type: 'always_open', data: {} },
  ...overrides
})

export const createDefaultDoors = (): QuestSystemDoor[] => [
  createDoor({
    name: 'Maintenance SSH',
    port: 22,
    status: 'locked',
    description: 'Legacy SSH endpoint maintained by Atlas custodians.',
    unlockCondition: { type: 'after_command_used', data: { command: 'deep_scan' } }
  }),
  createDoor({
    name: 'Telemetry Relay',
    port: 8080,
    status: 'weak_spot',
    description: 'Unpatched relay streaming anonymized metrics out of the cluster.',
    unlockCondition: { type: 'always_open', data: {} }
  }),
  createDoor({
    name: 'Ops Backdoor',
    port: 31337,
    status: 'backdoor',
    description: 'Quiet admin tunnel left behind by the ops crew.',
    unlockCondition: { type: 'trace_below', data: { maxTrace: 40 } }
  })
]

const createFilesystemNode = (node: Partial<QuestSystemFilesystemNode>): QuestSystemFilesystemNode => ({
  id: generateId(node.type === 'folder' ? 'folder' : 'file'),
  name: node.name || 'node',
  type: node.type || 'file',
  children: node.children,
  content: node.content,
  tags: node.tags,
  logOptions: node.logOptions
})

export const createDefaultFilesystem = (): QuestSystemFilesystemNode => {
  const authLog = createFilesystemNode({
    type: 'file',
    name: 'auth.log',
    tags: ['log'],
    content: '00:14 failed password from relay.\n00:21 atlas override accepted.\n',
    logOptions: {
      recordFailedLogins: true,
      recordSuccessfulLogins: true,
      recordFileDeletions: false
    }
  })

  const opsNotes = createFilesystemNode({
    type: 'file',
    name: 'ops_notes.txt',
    tags: ['clue'],
    content: 'Ops reminder: temp passwords rotate every 6 hours. Clean up sloppy dumps!',
    logOptions: undefined
  })

  const contractsFolder = createFilesystemNode({
    type: 'folder',
    name: 'contracts',
    children: []
  })

  const secureFolder = createFilesystemNode({
    type: 'folder',
    name: 'secure',
    children: [contractsFolder]
  })

  const homeFolder = createFilesystemNode({
    type: 'folder',
    name: 'home',
    children: [opsNotes]
  })

  const logsFolder = createFilesystemNode({
    type: 'folder',
    name: 'logs',
    children: [authLog]
  })

  return {
    id: generateId('folder'),
    name: '/',
    type: 'folder',
    children: [logsFolder, homeFolder, secureFolder]
  }
}

export const createDefaultSecurityRules = (): QuestSystemSecurityRules => ({
  maxTrace: 100,
  nervousThreshold: 50,
  panicThreshold: 80,
  nervousEffect: 'tighten_doors',
  panicEffect: 'kick_user',
  actionTraceCosts: {
    scan: 3,
    deepScan: 10,
    bruteforce: 15,
    deleteSensitiveFile: 5,
    openTrapFile: 20
  }
})

export const createDefaultSystemDefinition = (
  questId: string,
  overrides?: Partial<QuestSystemDefinition>
): QuestSystemDefinition => ({
  id: overrides?.id || `${questId}_system`,
  label: overrides?.label || 'Unnamed Node',
  ip: overrides?.ip || generateRandomIp(),
  difficulty: overrides?.difficulty || 'easy',
  personalityBlurb: overrides?.personalityBlurb || '',
  doors: overrides?.doors || createDefaultDoors(),
  filesystemRoot: overrides?.filesystemRoot || createDefaultFilesystem(),
  securityRules: overrides?.securityRules || createDefaultSecurityRules(),
  templateId: overrides?.templateId ?? null
})

const cloneFilesystemNode = (node: QuestSystemFilesystemNode): QuestSystemFilesystemNode => ({
  ...node,
  id: generateId(node.type === 'folder' ? 'folder' : 'file'),
  children: node.children?.map(child => cloneFilesystemNode(child))
})

export const cloneSystemForQuest = (
  system: QuestSystemDefinition,
  questId: string,
  overrides?: Partial<QuestSystemDefinition>
): QuestSystemDefinition => ({
  ...system,
  id: `${questId}_system`,
  doors: system.doors.map(door => ({ ...door, id: generateId('door') })),
  filesystemRoot: cloneFilesystemNode(system.filesystemRoot),
  templateId: overrides?.templateId ?? system.templateId ?? null,
  ...overrides
})

export const DEFAULT_SYSTEM_TEMPLATE: QuestSystemDefinition = createDefaultSystemDefinition('template_seed', {
  label: 'Atlas Relay – Sector 12',
  difficulty: 'easy',
  personalityBlurb: 'Paranoid relay hub with lots of redundant logging and messy scratch space.',
  ip: '10.14.6.23'
})

export const SYSTEM_DIFFICULTY_OPTIONS: SystemDifficulty[] = ['tutorial', 'easy', 'medium', 'hard', 'boss']
