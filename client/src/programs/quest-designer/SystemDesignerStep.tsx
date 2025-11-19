import React, { useEffect, useMemo, useState } from 'react'

import type {
  DoorUnlockCondition,
  FileTag,
  QuestSystemDefinition,
  QuestSystemDoor,
  QuestSystemFilesystemNode,
  SystemDifficulty
} from '../../types/quest'
import {
  createDefaultSecurityRules,
  createDefaultSystemDefinition,
  generateRandomIp,
  suggestPort,
  SYSTEM_DIFFICULTY_OPTIONS,
  cloneSystemForQuest
} from './systemDefaults'
import { generateId } from './id'
import type { QuestSystemTemplate, SystemTemplateService } from './systemTemplates'

interface SystemDesignerStepProps {
  questId: string
  system?: QuestSystemDefinition
  errors: string[]
  templateService: SystemTemplateService
  onChange(system: QuestSystemDefinition | undefined): void
}

const DOOR_STATUS_LABELS: Record<QuestSystemDoor['status'], string> = {
  locked: 'Locked',
  guarded: 'Guarded (firewalled)',
  weak_spot: 'Weak Spot (vulnerable)',
  backdoor: 'Backdoor (easy access)'
}

const DOOR_CONDITION_LABELS: Record<DoorUnlockCondition['type'], string> = {
  always_open: 'Always open',
  after_file_read: 'Opens after reading a file',
  after_door_used: 'Opens after using another door',
  after_command_used: 'Opens after running a command',
  trace_below: 'Opens if trace is low'
}

const TOOL_COMMAND_OPTIONS = ['scan', 'deep_scan', 'bruteforce', 'clean_logs', 'backdoor_install']

const FILE_TAGS: Array<{ id: FileTag; label: string; hint: string }> = [
  { id: 'clue', label: 'Clue', hint: 'Contains puzzle hints or intel.' },
  { id: 'lore', label: 'Lore', hint: 'Adds flavor and backstory.' },
  { id: 'objective', label: 'Objective', hint: 'Players must interact with this.' },
  { id: 'sensitive', label: 'Sensitive', hint: 'Deleting or exfiltrating may trigger responses.' },
  { id: 'trap', label: 'Trap', hint: 'Raises trace or spawns alarms when touched.' },
  { id: 'log', label: 'Log', hint: 'Acts as a logging destination.' }
]

interface TemplateModalState {
  mode: 'load' | 'save'
  open: boolean
}

interface TemplateFormState {
  name: string
  description: string
  difficulty: SystemDifficulty
}

const SystemDesignerStep: React.FC<SystemDesignerStepProps> = ({ questId, system, errors, templateService, onChange }) => {
  const [expandedDoorId, setExpandedDoorId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(system?.filesystemRoot.id || null)
  const [templates, setTemplates] = useState<QuestSystemTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateModal, setTemplateModal] = useState<TemplateModalState>({ mode: 'load', open: false })
  const [templateForm, setTemplateForm] = useState<TemplateFormState>({
    name: '',
    description: '',
    difficulty: system?.difficulty ?? 'easy'
  })
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!system) {
      setSelectedNodeId(null)
      return
    }
    setSelectedNodeId(prev => {
      if (prev && findFilesystemNode(system.filesystemRoot, prev)) return prev
      return system.filesystemRoot.id
    })
  }, [system])

  const filesystemFiles = useMemo(() => {
    if (!system) return []
    return flattenFilesystem(system.filesystemRoot).filter(entry => entry.node.type === 'file')
  }, [system])

  const selectedNode = useMemo(() => {
    if (!system || !selectedNodeId) return null
    return findFilesystemNode(system.filesystemRoot, selectedNodeId)
  }, [system, selectedNodeId])

  const selectedNodePath = useMemo(() => {
    if (!system || !selectedNodeId) return '/'
    return computeNodePath(system.filesystemRoot, selectedNodeId) || '/'
  }, [system, selectedNodeId])

  const refreshTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const list = await templateService.listTemplates()
      setTemplates(list)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const createSystemFromDefaults = (message?: string) => {
    const next = createDefaultSystemDefinition(questId)
    onChange(next)
    if (message) setFeedback(message)
  }

  const openTemplateModal = (mode: TemplateModalState['mode']) => {
    setTemplateModal({ mode, open: true })
    refreshTemplates().catch(() => setFeedback('Unable to load templates right now.'))
  }

  const closeTemplateModal = () => {
    setTemplateModal(prev => ({ ...prev, open: false }))
    setTemplateForm({ name: '', description: '', difficulty: system?.difficulty ?? 'easy' })
  }

  const handleCreateSystem = () => {
    createSystemFromDefaults('Default system created. Customize it to match your quest tone.')
  }

  const handleResetSystem = () => {
    if (!window.confirm('Reset this system back to the default layout? This will wipe your edits.')) return
    createSystemFromDefaults('System reset to default layout. Adjust the files and doors to match your scenario.')
  }

  const handleClearSystem = () => {
    if (!window.confirm('Remove the system from this quest? You will need to rebuild it later.')) return
    onChange(undefined)
  }

  const handleApplyTemplate = (template: QuestSystemTemplate) => {
    const cloned = cloneSystemForQuest(template.system, questId, { templateId: template.id })
    onChange(cloned)
    setTemplateModal(prev => ({ ...prev, open: false }))
    setFeedback(`Applied template “${template.name}”.`)
  }

  const handleSaveTemplate = async () => {
    if (!system) return
    const trimmedName = templateForm.name.trim()
    if (!trimmedName) {
      setFeedback('Template name is required.')
      return
    }
    const systemCopy: QuestSystemDefinition = JSON.parse(JSON.stringify(system))
    const templateId = generateId('system_template')
    systemCopy.templateId = templateId
    const template: QuestSystemTemplate = {
      id: templateId,
      name: trimmedName,
      description: templateForm.description.trim() || undefined,
      difficulty: templateForm.difficulty,
      system: systemCopy
    }
    await templateService.saveTemplate(template)
    setFeedback('Template saved locally.')
    closeTemplateModal()
    refreshTemplates().catch(() => undefined)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    await templateService.deleteTemplate(templateId)
    refreshTemplates().catch(() => undefined)
  }

  const updateSystem = (patch: Partial<QuestSystemDefinition>) => {
    if (!system) return
    onChange({ ...system, ...patch })
  }

  const updateDoor = (doorId: string, patch: Partial<QuestSystemDoor>) => {
    if (!system) return
    const nextDoors = system.doors.map(door => (door.id === doorId ? { ...door, ...patch } : door))
    updateSystem({ doors: nextDoors })
  }

  const removeDoor = (doorId: string) => {
    if (!system) return
    if (!window.confirm('Delete this door? Players will lose access to that entry point.')) return
    const nextDoors = system.doors.filter(door => door.id !== doorId)
    updateSystem({ doors: nextDoors })
    if (expandedDoorId === doorId) setExpandedDoorId(null)
  }

  const addDoor = () => {
    if (!system) return
    const port = suggestPort(system.doors)
    const nextDoor: QuestSystemDoor = {
      id: generateId('door'),
      name: 'New Door',
      port,
      status: 'locked',
      description: '',
      unlockCondition: { type: 'always_open', data: {} }
    }
    updateSystem({ doors: [...system.doors, nextDoor] })
    setExpandedDoorId(nextDoor.id)
  }

  const updateFilesystemRoot = (updater: (root: QuestSystemFilesystemNode) => QuestSystemFilesystemNode) => {
    if (!system) return
    const nextRoot = updater(system.filesystemRoot)
    updateSystem({ filesystemRoot: nextRoot })
  }

  const handleAddNode = (type: 'folder' | 'file') => {
    if (!system || !selectedNode) return
    const baseFolderId = selectedNode.type === 'folder' ? selectedNode.id : findParentId(system.filesystemRoot, selectedNode.id) || system.filesystemRoot.id
    const newNode: QuestSystemFilesystemNode = {
      id: generateId(type === 'folder' ? 'folder' : 'file'),
      name: type === 'folder' ? 'new-folder' : 'file.txt',
      type,
      children: type === 'folder' ? [] : undefined,
      content: type === 'file' ? '' : undefined,
      tags: type === 'file' ? [] : undefined
    }
    updateFilesystemRoot(root => insertNode(root, baseFolderId, newNode))
    setSelectedNodeId(newNode.id)
  }

  const handleDeleteNode = () => {
    if (!system || !selectedNode) return
    if (selectedNode.id === system.filesystemRoot.id) return
    if (!window.confirm('Delete this node and everything inside it?')) return
    const parentId = findParentId(system.filesystemRoot, selectedNode.id) || system.filesystemRoot.id
    updateFilesystemRoot(root => removeNode(root, selectedNode.id))
    setSelectedNodeId(parentId)
  }

  const handleRenameNode = (name: string) => {
    if (!system || !selectedNode) return
    updateFilesystemRoot(root => updateNode(root, selectedNode.id, node => ({ ...node, name })))
  }

  const handleFileContentChange = (content: string) => {
    if (!system || !selectedNode || selectedNode.type !== 'file') return
    updateFilesystemRoot(root => updateNode(root, selectedNode.id, node => ({ ...node, content })))
  }

  const handleToggleTag = (tag: FileTag) => {
    if (!system || !selectedNode || selectedNode.type !== 'file') return
    const tags = new Set(selectedNode.tags || [])
    if (tags.has(tag)) tags.delete(tag)
    else tags.add(tag)
    const nextTags = Array.from(tags)
    updateFilesystemRoot(root =>
      updateNode(root, selectedNode.id, node => ({
        ...node,
        tags: nextTags,
        logOptions:
          tag === 'log'
            ? nextTags.includes('log')
              ? {
                recordFailedLogins: node.logOptions?.recordFailedLogins ?? true,
                recordSuccessfulLogins: node.logOptions?.recordSuccessfulLogins ?? false,
                recordFileDeletions: node.logOptions?.recordFileDeletions ?? false
              }
              : undefined
            : node.logOptions
      }))
    )
  }

  const handleLogOptionChange = (field: keyof NonNullable<QuestSystemFilesystemNode['logOptions']>, value: boolean) => {
    if (!system || !selectedNode || selectedNode.type !== 'file') return
    updateFilesystemRoot(root =>
      updateNode(root, selectedNode.id, node => ({
        ...node,
        logOptions: {
          recordFailedLogins: node.logOptions?.recordFailedLogins ?? false,
          recordSuccessfulLogins: node.logOptions?.recordSuccessfulLogins ?? false,
          recordFileDeletions: node.logOptions?.recordFileDeletions ?? false,
          [field]: value
        }
      }))
    )
  }

  const handleSecurityToggle = () => {
    if (!system) return
    if (system.securityRules) {
      updateSystem({ securityRules: undefined })
    } else {
      updateSystem({ securityRules: createDefaultSecurityRules() })
    }
  }

  const renderDoorUnlockFields = (door: QuestSystemDoor) => {
    const type = door.unlockCondition?.type || 'always_open'
    switch (type) {
      case 'after_file_read':
        return (
          <label>
            Choose file
            <select
              value={door.unlockCondition?.data?.filePath || ''}
              onChange={e => updateDoor(door.id, { unlockCondition: { type, data: { filePath: e.target.value } } })}
            >
              <option value="">Select file…</option>
              {filesystemFiles.map(entry => (
                <option key={entry.node.id} value={entry.path}>{entry.path}</option>
              ))}
            </select>
          </label>
        )
      case 'after_door_used':
        return (
          <label>
            Unlocks after door
            <select
              value={door.unlockCondition?.data?.doorId || ''}
              onChange={e => updateDoor(door.id, { unlockCondition: { type, data: { doorId: e.target.value } } })}
            >
              <option value="">Select door…</option>
              {system?.doors
                .filter(entry => entry.id !== door.id)
                .map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.name || entry.port}</option>
                ))}
            </select>
          </label>
        )
      case 'after_command_used':
        return (
          <label>
            Command
            <select
              value={door.unlockCondition?.data?.command || ''}
              onChange={e => updateDoor(door.id, { unlockCondition: { type, data: { command: e.target.value } } })}
            >
              <option value="">Select command…</option>
              {TOOL_COMMAND_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        )
      case 'trace_below':
        return (
          <label>
            Max trace
            <input
              type="number"
              min={0}
              value={door.unlockCondition?.data?.maxTrace ?? ''}
              onChange={e => updateDoor(door.id, { unlockCondition: { type, data: { maxTrace: Number(e.target.value) } } })}
            />
          </label>
        )
      default:
        return null
    }
  }

    const loadModal =
      templateModal.open &&
      templateModal.mode === 'load' && (
        <TemplateModal title="Load system template" onClose={closeTemplateModal}>
          {templatesLoading && <p className="muted">Loading templates…</p>}
          {!templatesLoading && templates.length === 0 && <p className="muted">No templates saved yet.</p>}
          <ul className="template-list">
            {templates.map(template => (
              <li key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <p className="muted">{template.description || 'No description'}</p>
                </div>
                <div className="inline-actions">
                  <button type="button" onClick={() => handleApplyTemplate(template)}>Use Template</button>
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => {
                      if (!window.confirm('Delete this template?')) return
                      handleDeleteTemplate(template.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </TemplateModal>
      )

    const saveModal =
      templateModal.open &&
      templateModal.mode === 'save' &&
      system && (
        <TemplateModal title="Save as template" onClose={closeTemplateModal}>
          <label>
            Template name
            <input value={templateForm.name} onChange={e => setTemplateForm(form => ({ ...form, name: e.target.value }))} />
          </label>
          <label>
            Description (optional)
            <textarea rows={3} value={templateForm.description} onChange={e => setTemplateForm(form => ({ ...form, description: e.target.value }))} />
          </label>
          <label>
            Difficulty reference
            <select
              value={templateForm.difficulty}
              onChange={e => setTemplateForm(form => ({ ...form, difficulty: e.target.value as SystemDifficulty }))}
            >
              {SYSTEM_DIFFICULTY_OPTIONS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <div className="inline-actions right">
            <button type="button" className="ghost" onClick={closeTemplateModal}>Cancel</button>
            <button type="button" className="primary" onClick={handleSaveTemplate}>Save Template</button>
          </div>
        </TemplateModal>
      )

  if (!system) {
    return (
      <div className="system-designer">
        {errors.length > 0 && (
          <div className="inline-alert error" role="alert">
            <strong>System incomplete</strong>
            <ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
          </div>
        )}
        <div className="system-empty-state">
          <h3>Create a target system</h3>
          <p className="muted">Design a hackable host with doors, files, and trace behavior.</p>
          <div className="inline-actions">
            <button type="button" className="primary" onClick={handleCreateSystem}>Create System</button>
            <button type="button" className="ghost" onClick={() => openTemplateModal('load')}>Load template</button>
          </div>
        </div>
        {loadModal}
        {feedback && <p className="inline-hint">{feedback}</p>}
      </div>
    )
  }

  const doorPortCollisions = findDuplicatePorts(system.doors)

  return (
    <div className="system-designer">
      {errors.length > 0 && (
        <div className="inline-alert error" role="alert">
          <strong>System incomplete</strong>
          <ul>{errors.map(err => <li key={err}>{err}</li>)}</ul>
        </div>
      )}
      {feedback && <div className="inline-hint">{feedback}</div>}
      <div className="system-toolbar">
        <div>
          <h3>System Identity</h3>
          <p className="muted">Give the target host a vibe and baseline info.</p>
        </div>
        <div className="inline-actions">
          <button type="button" onClick={() => openTemplateModal('load')}>Load template</button>
          <button type="button" onClick={() => openTemplateModal('save')} disabled={!system}>Save as template</button>
          <button type="button" className="ghost" onClick={handleResetSystem}>Reset defaults</button>
          <button type="button" className="ghost danger" onClick={handleClearSystem}>Clear</button>
        </div>
      </div>
      <section className="system-panel identity">
        <div className="field-grid two-columns">
          <label>
            System Name
            <input value={system.label} onChange={e => updateSystem({ label: e.target.value })} placeholder="Atlas Relay – Sector 12" />
          </label>
          <label>
            IP Address
            <div className="inline-input">
              <input value={system.ip} onChange={e => updateSystem({ ip: e.target.value })} placeholder="10.14.6.23" />
              <button type="button" className="ghost" onClick={() => updateSystem({ ip: generateRandomIp() })}>Random IP</button>
            </div>
          </label>
          <label>
            Difficulty
            <select value={system.difficulty} onChange={e => updateSystem({ difficulty: e.target.value as typeof system.difficulty })}>
              {SYSTEM_DIFFICULTY_OPTIONS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            System Personality / Vibe
            <textarea
              rows={3}
              value={system.personalityBlurb || ''}
              onChange={e => updateSystem({ personalityBlurb: e.target.value })}
              placeholder="Paranoid research node with overkill logging and sloppy temp files."
            />
          </label>
        </div>
      </section>

      <section className="system-panel doors">
        <header>
          <h4>Doors (Entry Points)</h4>
          <button type="button" className="ghost" onClick={addDoor}>+ Add Door</button>
        </header>
        {system.doors.length === 0 && <p className="muted">No doors yet. Add at least one entry point.</p>}
        {system.doors.length > 0 && (
          <table className="door-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Port</th>
                <th>Status</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {system.doors.map((door, index) => {
                const doorLabel = door.name?.trim() || `Door ${index + 1}`
                return (
                <React.Fragment key={door.id}>
                  <tr className={doorPortCollisions.has(door.port) ? 'door-row conflict' : 'door-row'}>
                    <td>
                        <input
                          value={door.name}
                          onChange={e => updateDoor(door.id, { name: e.target.value })}
                          aria-label={`Door name (${doorLabel})`}
                        />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={door.port}
                        min={1}
                        max={65535}
                        onChange={e => updateDoor(door.id, { port: Number(e.target.value) })}
                          aria-label={`Door port (${doorLabel})`}
                      />
                      {doorPortCollisions.has(door.port) && <span className="muted warning-text">Duplicate port</span>}
                    </td>
                    <td>
                        <select
                          value={door.status}
                          onChange={e => updateDoor(door.id, { status: e.target.value as QuestSystemDoor['status'] })}
                          aria-label={`Door status (${doorLabel})`}
                        >
                        {Object.entries(DOOR_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={door.description || ''}
                        placeholder="Short flavor"
                        onChange={e => updateDoor(door.id, { description: e.target.value })}
                          aria-label={`Door description (${doorLabel})`}
                      />
                    </td>
                    <td className="door-actions">
                      <button type="button" onClick={() => setExpandedDoorId(prev => (prev === door.id ? null : door.id))}>
                        {expandedDoorId === door.id ? 'Hide details' : 'Configure'}
                      </button>
                      <button type="button" className="ghost danger" onClick={() => removeDoor(door.id)}>Delete</button>
                    </td>
                  </tr>
                  {expandedDoorId === door.id && (
                    <tr className="door-detail-row">
                      <td colSpan={5}>
                        <div className="door-detail">
                          <label>
                            How does this door open?
                            <select
                              value={door.unlockCondition?.type || 'always_open'}
                              onChange={e =>
                                updateDoor(door.id, {
                                  unlockCondition: { type: e.target.value as DoorUnlockCondition['type'], data: {} }
                                })
                              }
                            >
                              {Object.entries(DOOR_CONDITION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          {renderDoorUnlockFields(door)}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="system-panel filesystem">
        <header>
          <h4>Files &amp; Folders</h4>
          <div className="inline-actions">
            <button type="button" className="ghost" onClick={() => handleAddNode('folder')}>+ Folder</button>
            <button type="button" className="ghost" onClick={() => handleAddNode('file')}>+ File</button>
            <button type="button" className="ghost danger" onClick={handleDeleteNode} disabled={selectedNode?.id === system.filesystemRoot.id}>Delete</button>
          </div>
        </header>
        <div className="filesystem-grid">
          <div className="filesystem-tree" role="tree">
            {renderTree(system.filesystemRoot, selectedNodeId, nodeId => setSelectedNodeId(nodeId))}
          </div>
          <div className="filesystem-details">
            {!selectedNode && <p className="muted">Select a node to edit.</p>}
            {selectedNode && selectedNode.type === 'folder' && (
              <div>
                <label>
                  Folder name
                  <input
                    value={selectedNode.name}
                    onChange={e => handleRenameNode(e.target.value)}
                    disabled={selectedNode.id === system.filesystemRoot.id}
                  />
                </label>
                <p className="muted">Path: {selectedNodePath}</p>
                <p className="muted">Contains {selectedNode.children?.length || 0} items.</p>
              </div>
            )}
            {selectedNode && selectedNode.type === 'file' && (
              <div className="file-details">
                <label>
                  File name
                  <input value={selectedNode.name} onChange={e => handleRenameNode(e.target.value)} />
                </label>
                <p className="muted">Path: {selectedNodePath}</p>
                <label>
                  Content
                  <textarea
                    rows={6}
                    value={selectedNode.content || ''}
                    onChange={e => handleFileContentChange(e.target.value)}
                  />
                </label>
                <fieldset>
                  <legend>Tags</legend>
                  <div className="tag-grid">
                    {FILE_TAGS.map(tag => {
                      const checked = selectedNode.tags?.includes(tag.id)
                      return (
                        <label key={tag.id} className="tag-checkbox">
                          <input
                            type="checkbox"
                            checked={checked || false}
                            onChange={() => handleToggleTag(tag.id)}
                          />
                          <span>{tag.label}</span>
                          <small className="muted">{tag.hint}</small>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                {selectedNode.tags?.includes('log') && (
                  <div className="log-options">
                    <p className="muted">Log options</p>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!selectedNode.logOptions?.recordFailedLogins}
                        onChange={e => handleLogOptionChange('recordFailedLogins', e.target.checked)}
                      />
                      Record failed login attempts
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!selectedNode.logOptions?.recordSuccessfulLogins}
                        onChange={e => handleLogOptionChange('recordSuccessfulLogins', e.target.checked)}
                      />
                      Record successful logins
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!selectedNode.logOptions?.recordFileDeletions}
                        onChange={e => handleLogOptionChange('recordFileDeletions', e.target.checked)}
                      />
                      Record file deletions
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="system-panel security">
        <header>
          <h4>Security &amp; Trace</h4>
          <button type="button" className="ghost" onClick={handleSecurityToggle}>
            {system.securityRules ? 'Disable rules' : 'Enable rules'}
          </button>
        </header>
        {!system.securityRules && <p className="muted">Enable stealth tuning to define trace behavior for this system.</p>}
        {system.securityRules && (
          <div className="security-grid">
            <label>
              Max trace
              <input
                type="number"
                min={10}
                value={system.securityRules.maxTrace}
                onChange={e => updateSystem({ securityRules: { ...system.securityRules!, maxTrace: Number(e.target.value) } })}
              />
            </label>
            <label>
              Nervous threshold
              <input
                type="number"
                min={0}
                value={system.securityRules.nervousThreshold}
                onChange={e => updateSystem({ securityRules: { ...system.securityRules!, nervousThreshold: Number(e.target.value) } })}
              />
            </label>
            <label>
              Panic threshold
              <input
                type="number"
                min={0}
                value={system.securityRules.panicThreshold}
                onChange={e => updateSystem({ securityRules: { ...system.securityRules!, panicThreshold: Number(e.target.value) } })}
              />
            </label>
            <label>
              When nervous
              <select
                value={system.securityRules.nervousEffect}
                onChange={e => updateSystem({ securityRules: { ...system.securityRules!, nervousEffect: e.target.value as typeof system.securityRules.nervousEffect } })}
              >
                <option value="tighten_doors">Tighten doors</option>
                <option value="kick_user">Kick player</option>
                <option value="log_only">Log only</option>
              </select>
            </label>
            <label>
              When panicking
              <select
                value={system.securityRules.panicEffect}
                onChange={e => updateSystem({ securityRules: { ...system.securityRules!, panicEffect: e.target.value as typeof system.securityRules.panicEffect } })}
              >
                <option value="kick_user">Kick player</option>
                <option value="lockout">Lockout new connections</option>
                <option value="log_only">Log only</option>
              </select>
            </label>
            <div className="trace-costs">
              <h5>Trace costs</h5>
              {TRACE_COST_FIELDS.map(field => (
                <label key={field.key}>
                  {field.label}
                  <input
                    type="number"
                    min={0}
                    value={system.securityRules?.actionTraceCosts[field.key] ?? field.default}
                    onChange={e =>
                      updateSystem({
                        securityRules: {
                          ...system.securityRules!,
                          actionTraceCosts: {
                            ...system.securityRules!.actionTraceCosts,
                            [field.key]: Number(e.target.value)
                          }
                        }
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {loadModal}
      {saveModal}
    </div>
  )
}

interface TemplateModalProps {
  title: string
  children: React.ReactNode
  onClose(): void
}

const TemplateModal: React.FC<TemplateModalProps> = ({ title, children, onClose }) => (
  <div className="quest-modal-overlay" role="dialog" aria-modal="true">
    <div className="quest-modal large">
      <header>
        <h3>{title}</h3>
      </header>
      <div className="modal-body">{children}</div>
      <footer>
        <button type="button" className="ghost" onClick={onClose}>Close</button>
      </footer>
    </div>
  </div>
)

const TRACE_COST_FIELDS: Array<{ key: keyof NonNullable<QuestSystemDefinition['securityRules']>['actionTraceCosts']; label: string; default: number }> = [
  { key: 'scan', label: 'Scan', default: 3 },
  { key: 'deepScan', label: 'Deep scan', default: 10 },
  { key: 'bruteforce', label: 'Bruteforce', default: 15 },
  { key: 'deleteSensitiveFile', label: 'Delete sensitive file', default: 5 },
  { key: 'openTrapFile', label: 'Open trap file', default: 20 }
]

const flattenFilesystem = (
  node: QuestSystemFilesystemNode,
  currentPath = '/'
): Array<{ node: QuestSystemFilesystemNode; path: string }> => {
  const resolvedPath = node.name === '/' ? '/' : currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`
  const entries: Array<{ node: QuestSystemFilesystemNode; path: string }> = [{ node, path: resolvedPath }]
  if (node.type === 'folder' && node.children) {
    node.children.forEach(child => {
      entries.push(...flattenFilesystem(child, resolvedPath === '/' ? '/' : resolvedPath))
    })
  }
  return entries
}

const findFilesystemNode = (node: QuestSystemFilesystemNode, id: string): QuestSystemFilesystemNode | null => {
  if (node.id === id) return node
  if (node.type === 'folder' && node.children) {
    for (const child of node.children) {
      const found = findFilesystemNode(child, id)
      if (found) return found
    }
  }
  return null
}

const computeNodePath = (node: QuestSystemFilesystemNode, targetId: string, parents: string[] = []): string | null => {
  const nextParents = node.name === '/' ? [] : [...parents, node.name]
  if (node.id === targetId) {
    return node.name === '/' ? '/' : `/${nextParents.join('/')}`
  }
  if (node.type === 'folder' && node.children) {
    for (const child of node.children) {
      const match = computeNodePath(child, targetId, nextParents)
      if (match) return match
    }
  }
  return null
}

const updateNode = (
  node: QuestSystemFilesystemNode,
  targetId: string,
  updater: (node: QuestSystemFilesystemNode) => QuestSystemFilesystemNode
): QuestSystemFilesystemNode => {
  if (node.id === targetId) {
    return updater(node)
  }
  if (node.type !== 'folder' || !node.children) return node
  let changed = false
  const children = node.children.map(child => {
    const nextChild = updateNode(child, targetId, updater)
    if (nextChild !== child) changed = true
    return nextChild
  })
  if (!changed) return node
  return { ...node, children }
}

const insertNode = (
  node: QuestSystemFilesystemNode,
  parentId: string,
  newNode: QuestSystemFilesystemNode
): QuestSystemFilesystemNode => {
  if (node.id === parentId && node.type === 'folder') {
    const nextChildren = [...(node.children || []), newNode]
    return { ...node, children: nextChildren }
  }
  if (node.type !== 'folder' || !node.children) return node
  const children = node.children.map(child => insertNode(child, parentId, newNode))
  const changed = children.some((child, index) => child !== node.children![index])
  return changed ? { ...node, children } : node
}

const removeNode = (node: QuestSystemFilesystemNode, targetId: string): QuestSystemFilesystemNode => {
  if (node.type !== 'folder' || !node.children) return node
  const filtered = node.children.filter(child => child.id !== targetId)
  if (filtered.length !== (node.children?.length || 0)) {
    return { ...node, children: filtered }
  }
  const nextChildren = node.children.map(child => removeNode(child, targetId))
  const changed = nextChildren.some((child, index) => child !== node.children![index])
  return changed ? { ...node, children: nextChildren } : node
}

const findParentId = (
  node: QuestSystemFilesystemNode,
  targetId: string,
  parentId: string | null = null
): string | null => {
  if (node.id === targetId) return parentId
  if (node.type === 'folder' && node.children) {
    for (const child of node.children) {
      const found = findParentId(child, targetId, node.id)
      if (found) return found
    }
  }
  return null
}

const renderTree = (
  node: QuestSystemFilesystemNode,
  selectedId: string | null,
  onSelect: (id: string) => void,
  depth = 0
): React.ReactNode => {
  const isSelected = node.id === selectedId
  return (
    <div key={node.id} className={`tree-node ${isSelected ? 'selected' : ''}`} style={{ paddingLeft: depth * 12 }}>
      <button type="button" onClick={() => onSelect(node.id)}>
        {node.type === 'folder' ? '[DIR]' : '[FILE]'} {node.name}
        {node.type === 'file' && node.tags && node.tags.length > 0 && (
          <span className="tag-badge">{node.tags.join(', ')}</span>
        )}
      </button>
      {node.type === 'folder' && node.children && (
        <div>
          {node.children.map(child => renderTree(child, selectedId, onSelect, depth + 1))}
        </div>
      )}
    </div>
  )
}

const findDuplicatePorts = (doors: QuestSystemDoor[]) => {
  const seen = new Map<number, number>()
  doors.forEach(door => {
    seen.set(door.port, (seen.get(door.port) || 0) + 1)
  })
  return new Set(Array.from(seen.entries()).filter(([, count]) => count > 1).map(([port]) => port))
}

export { SystemDesignerStep }
