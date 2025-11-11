import { apiRequest } from './api'

export interface AdminUser {
  id: number
  username: string
  is_admin: boolean
}

export async function listUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>('/api/admin/users', { auth: true })
}

export async function updateUser(userId: number, data: { is_admin?: boolean }): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/admin/users/${userId}`, { method: 'PATCH', auth: true, body: data })
}

export async function resetUserPassword(userId: number, newPassword: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}/password`, { 
    method: 'PATCH', 
    auth: true, 
    body: { new_password: newPassword } 
  })
}

export async function deleteUser(userId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}`, { method: 'DELETE', auth: true })
}
