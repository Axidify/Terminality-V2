import type { FileSystemNode } from './terminalQuests/types'

export type FilesystemMap = Record<string, FileSystemNode>

export const normalizeFilesystemPath = (input: string): string => {
  if (!input) return '/'
  const trimmed = input.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!trimmed) return '/'
  let normalized = trimmed
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized || '/'
}

export const normalizeFilesystemMap = (filesystem: unknown): FilesystemMap => {
  if (!filesystem || typeof filesystem !== 'object') return {}
  const normalized: FilesystemMap = {}
  Object.entries(filesystem as Record<string, FileSystemNode | null | undefined>).forEach(([key, node]) => {
    if (!node) return
    const normalizedPath = normalizeFilesystemPath(node.path || key)
    const normalizedChildren = Array.isArray(node.children)
      ? node.children.map(childPath => normalizeFilesystemPath(childPath))
      : undefined
    normalized[normalizedPath] = {
      ...node,
      name: node.name || (normalizedPath === '/' ? '/' : normalizedPath.split('/').pop() || '/'),
      path: normalizedPath,
      children: normalizedChildren
    }
  })
  if (!normalized['/']) {
    normalized['/'] = { type: 'dir', name: '/', path: '/', children: [] }
  }
  return normalized
}

export const createEmptyFilesystemMap = (): FilesystemMap => ({
  '/': { type: 'dir', name: '/', path: '/', children: [] }
})

export const cloneFilesystemMap = (map: FilesystemMap): FilesystemMap => {
  const next: FilesystemMap = {}
  Object.entries(map).forEach(([path, node]) => {
    next[path] = {
      ...node,
      children: node.children ? [...node.children] : undefined,
      content: node.content ?? undefined
    }
  })
  if (!next['/']) {
    next['/'] = { type: 'dir', name: '/', path: '/', children: [] }
  }
  return next
}

export const getParentPath = (path: string): string => {
  const normalized = normalizeFilesystemPath(path)
  if (normalized === '/') return '/'
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length <= 1) return '/'
  return `/${segments.slice(0, -1).join('/')}`
}

export const listChildPaths = (map: FilesystemMap, parentPath: string): string[] => {
  const normalizedParent = normalizeFilesystemPath(parentPath)
  const parentNode = map[normalizedParent]
  if (parentNode?.children?.length) {
    return parentNode.children.filter(child => !!map[child])
  }
  return Object.values(map)
    .filter(node => node.path !== normalizedParent && getParentPath(node.path) === normalizedParent)
    .map(node => node.path)
}
