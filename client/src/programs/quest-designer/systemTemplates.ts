import type { QuestSystemDefinition, SystemDifficulty } from '../../types/quest'
import { generateId } from './id'
import { DEFAULT_SYSTEM_TEMPLATE, cloneSystemForQuest } from './systemDefaults'

export interface QuestSystemTemplate {
  id: string
  name: string
  description?: string
  difficulty: SystemDifficulty
  system: QuestSystemDefinition
}

export interface SystemTemplateService {
  listTemplates(): Promise<QuestSystemTemplate[]>
  saveTemplate(template: QuestSystemTemplate): Promise<void>
  deleteTemplate(id: string): Promise<void>
}

const STORAGE_KEY = 'terminality:quest-designer:v2:system-templates'

const cloneTemplate = (template: QuestSystemTemplate): QuestSystemTemplate => ({
  ...template,
  system: JSON.parse(JSON.stringify(template.system))
})

const readTemplates = (): QuestSystemTemplate[] => {
  if (typeof window === 'undefined' || !window.localStorage) return seedTemplates()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedTemplates()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return seedTemplates()
    return parsed
  } catch (err) {
    console.warn('[system templates] failed to parse cache', err)
    return seedTemplates()
  }
}

const writeTemplates = (templates: QuestSystemTemplate[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch (err) {
    console.warn('[system templates] failed to persist cache', err)
  }
}

const seedTemplates = (): QuestSystemTemplate[] => [
  {
    id: generateId('template'),
    name: 'Relay Outpost',
    description: 'Baseline relay system with telemetry leak and messy filesystem.',
    difficulty: DEFAULT_SYSTEM_TEMPLATE.difficulty,
    system: cloneSystemForQuest(DEFAULT_SYSTEM_TEMPLATE, 'template_seed')
  }
]

class LocalSystemTemplateService implements SystemTemplateService {
  private cache: QuestSystemTemplate[]

  constructor() {
    this.cache = readTemplates()
  }

  async listTemplates() {
    this.cache = readTemplates()
    return this.cache.map(cloneTemplate)
  }

  async saveTemplate(template: QuestSystemTemplate) {
    const filtered = this.cache.filter(entry => entry.id !== template.id)
    filtered.push(cloneTemplate(template))
    this.cache = filtered
    writeTemplates(this.cache)
  }

  async deleteTemplate(id: string) {
    this.cache = this.cache.filter(entry => entry.id !== id)
    writeTemplates(this.cache)
  }
}

export const createSystemTemplateService = (): SystemTemplateService => new LocalSystemTemplateService()
