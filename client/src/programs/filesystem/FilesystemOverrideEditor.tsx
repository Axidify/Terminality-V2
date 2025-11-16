import React, { useEffect, useMemo, useState } from 'react'

import {
  cloneFilesystemMap,
  createEmptyFilesystemMap,
  getParentPath,
  listChildPaths,
  normalizeFilesystemPath
} from '../filesystemUtils'

import type { FilesystemMap } from '../filesystemUtils'

interface FilesystemOverrideEditorProps {
  systemId: string
  value?: FilesystemMap
  onChange: (next: FilesystemMap) => void
}

const sortChildPaths = (map: FilesystemMap, paths: string[]) => {
  return [...paths].sort((a, b) => {
    const nodeA = map[a]
    const nodeB = map[b]
    if (!nodeA || !nodeB) return 0
    if (nodeA.type !== nodeB.type) {
      return nodeA.type === 'dir' ? -1 : 1
    }
    return (nodeA.name || '').localeCompare(nodeB.name || '', undefined, { sensitivity: 'base' })
  })
}

const ensureParentDirectory = (map: FilesystemMap, path: string) => {
  const normalized = normalizeFilesystemPath(path)
  const existing = map[normalized]
  if (existing && existing.type === 'dir') {
    if (!existing.children) existing.children = []
    return existing
  }
  const name = normalized === '/' ? '/' : normalized.split('/').pop() || '/'
  map[normalized] = { type: 'dir', name, path: normalized, children: [] }
  return map[normalized]
}

export const FilesystemOverrideEditor: React.FC<FilesystemOverrideEditorProps> = ({ systemId, value, onChange }) => {
  const safeValue = useMemo(() => {
    if (value && Object.keys(value).length) {
      return value
    }
    return createEmptyFilesystemMap()
  }, [value])

  const [selectedPath, setSelectedPath] = useState<string>('/')
  const [lastSelection, setLastSelection] = useState<string>('/')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['/']))
  const [newItemName, setNewItemName] = useState('')
  const [renameValue, setRenameValue] = useState('/')
  const [contentDraft, setContentDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!safeValue[selectedPath]) {
      setSelectedPath('/')
      setLastSelection('/')
    }
  }, [safeValue, selectedPath])

  useEffect(() => {
    if (selectedPath === lastSelection) return
    const node = safeValue[selectedPath] || safeValue['/']
    if (!node) return
    setLastSelection(selectedPath)
    setRenameValue(node.name || (node.path === '/' ? '/' : node.path.split('/').pop() || '/'))
    setContentDraft(node.type === 'file' ? node.content || '' : '')
  }, [safeValue, selectedPath, lastSelection])

  useEffect(() => {
    const node = safeValue[selectedPath]
    if (node?.type === 'file' && node.content !== contentDraft) {
      setContentDraft(node.content || '')
    }
  }, [safeValue, selectedPath, contentDraft])

  const selectedNode = safeValue[selectedPath] || safeValue['/']
  const targetDirectoryPath = selectedNode?.type === 'dir' ? selectedNode.path : getParentPath(selectedNode?.path || '/')

  const commitChange = (next: FilesystemMap) => {
    setMessage(null)
    onChange(next)
  }

  const handleToggle = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleCreate = (kind: 'dir' | 'file') => {
    const name = newItemName.trim()
    if (!name) {
      setMessage('Enter a name before creating a new item.')
      return
    }
    const parentPath = targetDirectoryPath || '/'
    const newPath = normalizeFilesystemPath(parentPath === '/' ? `/${name}` : `${parentPath}/${name}`)
    if (safeValue[newPath]) {
      setMessage('An item with that name already exists in this directory.')
      return
    }
    const next = cloneFilesystemMap(safeValue)
    const parent = ensureParentDirectory(next, parentPath)
    parent.children = Array.from(new Set([...(parent.children || []), newPath]))
    next[newPath] = kind === 'dir'
      ? { type: 'dir', name, path: newPath, children: [] }
      : { type: 'file', name, path: newPath, content: '' }
    commitChange(next)
    setNewItemName('')
    setSelectedPath(newPath)
    setExpandedPaths(prev => new Set(prev).add(parentPath))
  }

  const handleRename = () => {
    if (!selectedNode || selectedNode.path === '/') {
      setMessage('Root directory cannot be renamed.')
      return
    }
    const name = renameValue.trim()
    if (!name) {
      setMessage('Name cannot be empty.')
      return
    }
    const parentPath = getParentPath(selectedNode.path)
    const newPath = normalizeFilesystemPath(parentPath === '/' ? `/${name}` : `${parentPath}/${name}`)
    if (newPath !== selectedNode.path && safeValue[newPath]) {
      setMessage('Another item already uses that name.')
      return
    }
    const next = cloneFilesystemMap(safeValue)
    const renameMap = new Map<string, string>()
    Object.keys(next).forEach(path => {
      if (path === selectedNode.path || path.startsWith(`${selectedNode.path}/`)) {
        const suffix = path.slice(selectedNode.path.length)
        const updated = path === selectedNode.path ? newPath : `${newPath}${suffix}`
        renameMap.set(path, normalizeFilesystemPath(updated))
      }
    })
    renameMap.forEach((updatedPath, oldPath) => {
      const node = next[oldPath]
      if (!node) return
      delete next[oldPath]
      next[updatedPath] = {
        ...node,
        name: updatedPath === '/' ? '/' : updatedPath.split('/').pop() || '/',
        path: updatedPath,
        children: node.children ? node.children.map(child => renameMap.get(child) || child) : undefined
      }
    })
    Object.values(next).forEach(node => {
      if (node.children) {
        node.children = node.children.map(child => renameMap.get(child) || child).filter(child => !!next[child])
      }
    })
    const parent = next[parentPath]
    if (parent?.children) {
      parent.children = parent.children.map(child => (child === selectedNode.path ? newPath : child))
    }
    commitChange(next)
    setSelectedPath(newPath)
  }

  const handleDelete = () => {
    if (!selectedNode || selectedNode.path === '/') {
      setMessage('Root directory cannot be deleted.')
      return
    }
    const confirmed = typeof window === 'undefined' ? true : window.confirm(`Delete ${selectedNode.name}? This removes all nested items.`)
    if (!confirmed) return
    const next = cloneFilesystemMap(safeValue)
    Object.keys(next).forEach(path => {
      if (path === selectedNode.path || path.startsWith(`${selectedNode.path}/`)) {
        delete next[path]
      }
    })
    Object.values(next).forEach(node => {
      if (node.children) {
        node.children = node.children.filter(child => !(child === selectedNode.path || child.startsWith(`${selectedNode.path}/`)))
      }
    })
    const parentPath = getParentPath(selectedNode.path)
    const parent = next[parentPath]
    if (parent?.children) {
      parent.children = parent.children.filter(child => child !== selectedNode.path)
    }
    commitChange(next)
    setSelectedPath(parentPath)
  }

  const handleContentChange = (content: string) => {
    if (!selectedNode || selectedNode.type !== 'file') return
    const next = cloneFilesystemMap(safeValue)
    next[selectedNode.path] = { ...selectedNode, content }
    setContentDraft(content)
    commitChange(next)
  }

  const renderNode = (path: string, depth = 0): React.ReactNode => {
    const node = safeValue[path]
    if (!node) return null
    const isDir = node.type === 'dir'
    const childPaths = isDir ? sortChildPaths(safeValue, listChildPaths(safeValue, path)) : []
    const isExpanded = expandedPaths.has(path)
    const isSelected = selectedPath === path
    
    return (
      <div key={path} className="fs-tree-item">
        <div 
          className={`fs-tree-row ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {isDir ? (
            <button
              type="button"
              className="fs-tree-toggle"
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              onClick={() => handleToggle(path)}
            >
              {childPaths.length ? (isExpanded ? '▾' : '▸') : '○'}
            </button>
          ) : (
            <span className="fs-tree-toggle spacer" />
          )}
          <button
            type="button"
            className="fs-tree-node"
            onClick={() => setSelectedPath(path)}
          >
            {isDir ? (
              <svg className="fs-tree-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/>
              </svg>
            ) : (
              <svg className="fs-tree-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z"/>
              </svg>
            )}
            <span className="fs-tree-label">{node.name || (node.path === '/' ? '/' : node.path.split('/').pop())}</span>
          </button>
        </div>
        {isDir && isExpanded && childPaths.length > 0 && (
          <div className="fs-tree-children">
            {childPaths.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fs-override-editor" aria-label={`Filesystem override for ${systemId}`}>
      <div className="fs-editor-panel">
        <div className="fs-tree-tools">
          <input
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            placeholder="New item name"
          />
          <button type="button" onClick={() => handleCreate('dir')} disabled={!targetDirectoryPath}>
            + Folder
          </button>
          <button type="button" onClick={() => handleCreate('file')} disabled={!targetDirectoryPath}>
            + File
          </button>
        </div>
        <div className="fs-tree">
          {renderNode('/')}
        </div>
      </div>
      <div className="fs-details-panel">
        {selectedNode ? (
          <>
            <div className="fs-detail-header">
              <div className="fs-detail-title">
                <div className="fs-detail-icon">
                  {selectedNode.type === 'dir' ? (
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z"/>
                    </svg>
                  )}
                </div>
                <div className="fs-detail-name-editor">
                  <input 
                    value={renameValue} 
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename()}
                    disabled={selectedNode.path === '/'}
                    className="fs-name-input"
                  />
                  <button 
                    type="button" 
                    onClick={handleRename} 
                    disabled={selectedNode.path === '/'}
                    className="fs-rename-btn"
                    title="Rename"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="fs-detail-meta">
                <span>{selectedNode.path}</span>
                <span className="fs-type-badge">{selectedNode.type}</span>
              </div>
            </div>
            {selectedNode.type === 'file' && (
              <div className="fs-field">
                <div className="fs-field-label">Contents</div>
                <textarea value={contentDraft} onChange={e => handleContentChange(e.target.value)} rows={10} className="fs-content-editor" aria-label="File contents" />
              </div>
            )}
            {message && <div className="fs-feedback">{message}</div>}
            {selectedNode.path !== '/' && (
              <div className="fs-detail-actions">
                <button type="button" className="fs-delete-btn" onClick={handleDelete}>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 011.492.149l-.66 6.6A1.75 1.75 0 0110.595 15h-5.19a1.75 1.75 0 01-1.741-1.575l-.66-6.6a.75.75 0 111.492-.15zM6.5 1.75V3h3V1.75a.25.25 0 00-.25-.25h-2.5a.25.25 0 00-.25.25z"/>
                  </svg>
                  Delete {selectedNode.type === 'dir' ? 'Folder' : 'File'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="fs-empty">Select a file or folder to edit.</div>
        )}
      </div>
    </div>
  )
}
