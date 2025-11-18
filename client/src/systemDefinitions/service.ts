import { definitionToProfileDto, profilesToDefinitions, profileDtoToDefinition } from './adapters'
import {
  deleteSystemProfile,
  listSystemProfiles,
  saveSystemProfile,
  SystemProfilesResponse,
  updateSystemProfile
} from '../services/systemProfiles'

import type { SystemDefinition } from './types'

export interface SystemDefinitionsResponse extends SystemProfilesResponse {
  systems: SystemDefinition[]
  systemTemplates: SystemDefinition[]
}

export const listSystemDefinitions = async (): Promise<SystemDefinitionsResponse> => {
  const payload = await listSystemProfiles()
  return {
    ...payload,
    systems: profilesToDefinitions(payload.profiles || [], 'profile'),
    systemTemplates: profilesToDefinitions(payload.templates || [], 'template')
  }
}

export const saveSystemDefinition = async (definition: SystemDefinition, options: { template?: boolean } = {}) => {
  const dto = definitionToProfileDto(definition)
  const response = await saveSystemProfile(dto, options)
  return {
    ...response,
    definition: profileDtoToDefinition(response.profile, options.template ? 'template' : 'profile')
  }
}

export const updateSystemDefinition = async (
  id: string,
  definition: SystemDefinition,
  options: { template?: boolean } = {}
) => {
  const dto = definitionToProfileDto(definition)
  const response = await updateSystemProfile(id, dto, options)
  return {
    ...response,
    definition: profileDtoToDefinition(response.profile, options.template ? 'template' : 'profile')
  }
}

export const deleteSystemDefinition = async (id: string, options: { template?: boolean } = {}) => {
  const response = await deleteSystemProfile(id, options)
  return {
    ...response,
    definition: response.profile ? profileDtoToDefinition(response.profile, options.template ? 'template' : 'profile') : undefined
  }
}
