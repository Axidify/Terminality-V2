import { apiRequest } from './api'

export type ChangelogSectionKey = 'added' | 'changed' | 'fixed' | 'breaking'

export interface ChangelogSections {
  added: string[]
  changed: string[]
  fixed: string[]
  breaking: string[]
}

export interface ChangelogLink {
  label: string
  url: string
}

export interface ChangelogEntry {
  version: string
  date: string
  summary: string
  highlight?: string
  spotlight?: string
  sections: ChangelogSections
  tags?: string[]
  links?: ChangelogLink[]
}

export interface ChangelogResponse {
  entries: ChangelogEntry[]
  latest: ChangelogEntry | null
}

export interface ChangelogMutationResponse extends ChangelogResponse {
  entry: ChangelogEntry
}

export const createEmptyChangelogEntry = (): ChangelogEntry => ({
  version: '',
  date: new Date().toISOString().slice(0, 10),
  summary: '',
  highlight: '',
  spotlight: '',
  sections: { added: [], changed: [], fixed: [], breaking: [] },
  tags: [],
  links: []
})

export async function fetchChangelog(): Promise<ChangelogResponse> {
  try {
    return await apiRequest<ChangelogResponse>('/api/changelog')
  } catch (_err) {
    return { entries: [], latest: null }
  }
}

export async function fetchChangelogMarkdown(): Promise<string> {
  return apiRequest<string>('/api/changelog/markdown')
}

export async function createChangelogEntry(entry: ChangelogEntry): Promise<ChangelogMutationResponse> {
  return apiRequest<ChangelogMutationResponse>('/api/changelog', {
    method: 'POST',
    auth: true,
    body: { entry }
  })
}

export async function updateChangelogEntry(originalVersion: string, entry: ChangelogEntry): Promise<ChangelogMutationResponse> {
  return apiRequest<ChangelogMutationResponse>(`/api/changelog/${encodeURIComponent(originalVersion)}`, {
    method: 'PUT',
    auth: true,
    body: { entry }
  })
}

export async function deleteChangelogEntry(version: string): Promise<ChangelogResponse> {
  return apiRequest<ChangelogResponse>(`/api/changelog/${encodeURIComponent(version)}`, {
    method: 'DELETE',
    auth: true
  })
}
