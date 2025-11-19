import type { QuestDefinition } from './terminalQuests/types'

export type DesignerQuest = QuestDefinition & { __unsaved?: boolean }

export const applyQuestOrderFromStorage = (
  entries: DesignerQuest[],
  storedOrder: string[] | null | undefined
): DesignerQuest[] => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries
  }
  if (!storedOrder || storedOrder.length === 0) {
    return [...entries]
  }

  const seen = new Set<string>()
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const ordered: DesignerQuest[] = []

  storedOrder.forEach(id => {
    if (seen.has(id)) return
    const match = byId.get(id)
    if (!match) return
    seen.add(id)
    ordered.push(match)
  })

  entries.forEach(entry => {
    if (seen.has(entry.id)) return
    ordered.push(entry)
  })

  return ordered
}

export const reorderQuestSequence = (
  entries: DesignerQuest[],
  sourceId: string,
  targetId: string | null
): DesignerQuest[] => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries
  }
  if (!sourceId || sourceId === targetId) {
    return entries
  }
  const currentIndex = entries.findIndex(entry => entry.id === sourceId)
  if (currentIndex === -1) {
    return entries
  }
  const updated = entries.slice()
  const [removed] = updated.splice(currentIndex, 1)
  if (!removed) {
    return entries
  }
  if (!targetId) {
    updated.push(removed)
    return updated
  }
  const targetIndex = updated.findIndex(entry => entry.id === targetId)
  if (targetIndex === -1) {
    updated.push(removed)
    return updated
  }
  updated.splice(targetIndex, 0, removed)
  return updated
}
