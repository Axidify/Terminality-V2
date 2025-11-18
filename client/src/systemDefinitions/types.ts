import type { FilesystemMap } from '../programs/filesystemUtils'

export type SystemType = 'terminal_host' | 'filesystem' | 'tool' | 'composite' | 'one_off'

export type SystemScope = 'global' | 'quest_template' | 'quest_instance'

export type LegacySystemDefinitionKind = 'profile' | 'template'

export interface ResolutionContext {
  questId?: string
  questTemplateId?: string
  questInstanceId?: string
  [key: string]: string | undefined
}

export interface BaseSystemDefinition {
  id: string
  /**
   * Human-friendly key/slug that other systems reference.
   * Backwards compatible alias of the legacy "label" field.
   */
  key: string
  /**
   * Display name for UI. Mirrors "label" to keep existing consumers working.
   */
  name: string
  description?: string
  type: SystemType
  scope: SystemScope
  extendsSystemId?: string
  tags?: string[]
  isActive?: boolean
  isOverride?: boolean
}

export interface SystemNetworkBindings {
  primaryIp?: string
  ips: string[]
  hostnames: string[]
}

export interface SystemCredentials {
  username: string
  startingPath: string
  password?: string
}

export interface SystemDefinitionMetadata {
  description?: string
  footprint?: string
  tags?: string[]
  [key: string]: unknown
}

export interface FilesystemConfig {
  rootPath: string
  templateKey?: string
  readOnly?: boolean
  /**
   * Canonical snapshot that mirrors the legacy filesystem map.
   */
  snapshot: FilesystemMap
  /**
   * Optional overrides layered on top of the snapshot.
   */
  overrides?: FilesystemMap
}

export interface ToolBindingConfig {
  tools: Array<{
    id: string
    name: string
    command: string
    description?: string
    inputSchema?: Record<string, unknown>
    options?: Record<string, unknown>
  }>
}

export interface TerminalHostConfig {
  hostId: string
  address?: string
  port?: number
  protocol?: 'ssh' | 'ws' | 'local'
  openPorts?: string[]
  flags?: Record<string, boolean>
}

export interface SystemDefinition extends BaseSystemDefinition {
  /**
   * Legacy label consumers still rely on. Kept in sync with key/name.
   */
  label: string
  /**
   * Legacy kind that maps to scope for backwards compatibility.
   */
  kind?: LegacySystemDefinitionKind
  network: SystemNetworkBindings
  credentials: SystemCredentials
  metadata: SystemDefinitionMetadata
  filesystem?: FilesystemConfig
  tools?: ToolBindingConfig
  host?: TerminalHostConfig
  /**
   * Optional context binding describing when this scoped system applies.
   */
  appliesTo?: ResolutionContext
}

export interface ResolvedSystemInstance {
  definition: SystemDefinition
  filesystem: FilesystemMap
  source: 'definition' | 'override'
}

export interface SystemResolutionInput {
  definition: SystemDefinition
  override?: FilesystemMap | null
}
