import type { QuestDefinition } from '../../types/quest'

export interface QuestStorageService {
  listQuests(): Promise<QuestDefinition[]>
  getQuest(id: string): Promise<QuestDefinition | null>
  saveQuest(quest: QuestDefinition): Promise<void>
  deleteQuest(id: string): Promise<void>
}

const STORAGE_KEY = 'terminality:quest-designer:v2:quests'

const cloneQuest = (quest: QuestDefinition): QuestDefinition => JSON.parse(JSON.stringify(quest))

const readFromLocalStorage = (): QuestDefinition[] => {
  if (typeof window === 'undefined' || !window.localStorage) return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (err) {
    console.warn('[quest designer] unable to parse stored quests', err)
    return []
  }
}

const writeToLocalStorage = (quests: QuestDefinition[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(quests))
  } catch (err) {
    console.warn('[quest designer] unable to persist quests', err)
  }
}

class LocalQuestStorageService implements QuestStorageService {
  private cache: QuestDefinition[]

  constructor() {
    this.cache = readFromLocalStorage()
  }

  async listQuests() {
    this.cache = readFromLocalStorage()
    return this.cache.map(cloneQuest)
  }

  async getQuest(id: string) {
    const quest = this.cache.find(entry => entry.id === id)
    return quest ? cloneQuest(quest) : null
  }

  async saveQuest(quest: QuestDefinition) {
    const next = this.cache.filter(entry => entry.id !== quest.id)
    next.push(cloneQuest(quest))
    this.cache = next
    writeToLocalStorage(next)
  }

  async deleteQuest(id: string) {
    const next = this.cache.filter(entry => entry.id !== id)
    this.cache = next
    writeToLocalStorage(next)
  }
}

export const createQuestStorageService = (): QuestStorageService => new LocalQuestStorageService()
