import { apiRequest } from './api'

import type { MailMessageDefinition } from '../programs/mailSystem'

interface MailListResponse {
  messages: MailMessageDefinition[]
}

export async function listPublishedTerminalMail(): Promise<MailMessageDefinition[]> {
  const res = await apiRequest<MailListResponse>('/api/terminal-mail')
  return res?.messages ?? []
}

export async function listAdminTerminalMail(): Promise<MailMessageDefinition[]> {
  const res = await apiRequest<MailListResponse>('/api/admin/terminal-mail', { auth: true })
  return res?.messages ?? []
}

export async function createTerminalMail(mail: Partial<MailMessageDefinition>): Promise<MailMessageDefinition> {
  const res = await apiRequest<{ mail: MailMessageDefinition }>('/api/admin/terminal-mail', {
    method: 'POST',
    auth: true,
    body: { mail }
  })
  return res.mail
}

export async function updateTerminalMail(id: string, mail: Partial<MailMessageDefinition>): Promise<MailMessageDefinition> {
  const res = await apiRequest<{ mail: MailMessageDefinition }>(`/api/admin/terminal-mail/${id}`, {
    method: 'PUT',
    auth: true,
    body: { mail }
  })
  return res.mail
}

export async function deleteTerminalMail(id: string): Promise<void> {
  await apiRequest(`/api/admin/terminal-mail/${id}`, {
    method: 'DELETE',
    auth: true
  })
}

export interface MailValidationResult {
  mail: MailMessageDefinition
  errors: string[]
}

export async function validateTerminalMail(mail: Partial<MailMessageDefinition>): Promise<MailValidationResult> {
  const res = await apiRequest<{ mail: MailMessageDefinition; errors?: string[] }>('/api/admin/terminal-mail/validate', {
    method: 'POST',
    auth: true,
    body: { mail }
  })
  return {
    mail: res.mail,
    errors: res.errors || []
  }
}
