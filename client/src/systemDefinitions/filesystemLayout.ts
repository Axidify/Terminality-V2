import {
  cloneFilesystemMap,
  createEmptyFilesystemMap,
  getParentPath,
  normalizeFilesystemPath,
  scaffoldFilesystemDirectories,
  type FilesystemMap
} from '../programs/filesystemUtils'

import type { SystemScope } from './types'

export interface SystemFilesystemLayoutOptions {
  systemId: string
  scope: SystemScope
  rootPath?: string
  templateKey?: string
  templateSnapshot?: FilesystemMap | null
}

const ensureDirectoryPresence = (map: FilesystemMap, directories: string[]): FilesystemMap => {
  if (!directories.length) return map
  return scaffoldFilesystemDirectories(map, directories)
}

const addFileNode = (map: FilesystemMap, filePath: string, content: string): FilesystemMap => {
  const normalized = normalizeFilesystemPath(filePath)
  const parentPath = getParentPath(normalized)
  const next = ensureDirectoryPresence(map, parentPath && parentPath !== '/' ? [parentPath] : [])
  const parent = next[parentPath]
  if (!parent || parent.type !== 'dir') {
    return next
  }
  parent.children = Array.from(new Set([...(parent.children || []), normalized]))
  next[normalized] = {
    type: 'file',
    name: normalized.split('/').pop() || 'file.txt',
    path: normalized,
    content
  }
  return next
}

const defaultReadme = (systemId: string, scope: SystemScope) => (
  [`System: ${systemId}`, `Scope: ${scope}`, '', 'Customize this host to guide the quest narrative.'].join('\n')
)

const defaultConfig = (systemId: string) => JSON.stringify({ systemId, version: 1 }, null, 2)

export const createSystemFilesystemLayout = (options: SystemFilesystemLayoutOptions): FilesystemMap => {
  const { systemId, scope, rootPath = '/', templateSnapshot } = options
  if (templateSnapshot && Object.keys(templateSnapshot).length) {
    return cloneFilesystemMap(templateSnapshot)
  }
  const normalizedRoot = normalizeFilesystemPath(rootPath)
  const base = createEmptyFilesystemMap()
  const directories = [normalizedRoot, `${normalizedRoot}/config`, `${normalizedRoot}/logs`]
  let layout = ensureDirectoryPresence(base, directories.filter(dir => dir !== '/'))
  layout = addFileNode(layout, `${normalizedRoot}/README.txt`, defaultReadme(systemId, scope))
  layout = addFileNode(layout, `${normalizedRoot}/config/system.json`, defaultConfig(systemId))
  layout = addFileNode(layout, `${normalizedRoot}/logs/.gitkeep`, '')
  return layout
}
