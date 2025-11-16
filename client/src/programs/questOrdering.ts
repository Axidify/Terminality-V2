import type { QuestDefinition } from './terminalQuests/types'

export interface DesignerQuest extends QuestDefinition {
  __unsaved?: boolean
}

export const sortQuests = (entries: DesignerQuest[]): DesignerQuest[] => (
  [...entries].sort((a, b) => {
    const nameA = (a.title || a.id).toLowerCase()
    const nameB = (b.title || b.id).toLowerCase()
    if (nameA === nameB) return a.id.localeCompare(b.id)
    return nameA.localeCompare(nameB)
  })
)

export const applyQuestOrderFromStorage = (entries: DesignerQuest[], storedOrder: string[]): DesignerQuest[] => {
  const alphabetical = sortQuests(entries)
  if (!storedOrder.length) return alphabetical
  const byId = new Map(alphabetical.map(quest => [quest.id, quest]))
  const ordered: DesignerQuest[] = []
  storedOrder.forEach(id => {
    const quest = byId.get(id)
    if (quest) {
      ordered.push(quest)
      byId.delete(id)
    }
  })
  ordered.push(...byId.values())
  return ordered
}

export const reorderQuestSequence = (entries: DesignerQuest[], sourceId: string, targetId: string | null): DesignerQuest[] => {
  if (!entries.length || sourceId === targetId) return entries
  const next = [...entries]
  const sourceIndex = next.findIndex(q => q.id === sourceId)
  if (sourceIndex === -1) return entries
  const [moved] = next.splice(sourceIndex, 1)
  let destinationIndex = typeof targetId === 'string' ? next.findIndex(q => q.id === targetId) : next.length
  if (destinationIndex < 0) destinationIndex = next.length
  next.splice(destinationIndex, 0, moved)
  return next
}
