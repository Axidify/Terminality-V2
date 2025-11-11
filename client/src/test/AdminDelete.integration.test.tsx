import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { AdminApp } from '../programs/AdminApp'

// Mock auth and admin services
vi.mock('../services/auth', () => ({
  me: vi.fn().mockResolvedValue({ id: 1, username: 'rootadmin', is_admin: true })
}))

let users = [
  { id: 1, username: 'rootadmin', is_admin: true },
  { id: 2, username: 'deleteme', is_admin: false }
]

vi.mock('../services/admin', () => ({
  listUsers: vi.fn().mockImplementation(() => Promise.resolve(users)),
  updateUser: vi.fn(),
  resetUserPassword: vi.fn(),
  deleteUser: vi.fn().mockImplementation((id: number) => {
    users = users.filter(u => u.id !== id)
    return Promise.resolve({ message: 'User deleted successfully' })
  })
}))

describe('AdminApp user deletion integration', () => {
  beforeEach(() => {
    // reset users array before each test
    users = [
      { id: 1, username: 'rootadmin', is_admin: true },
      { id: 2, username: 'deleteme', is_admin: false }
    ]
  })

  it('deletes a user and removes from UI list', async () => {
    render(<AdminApp />)
    // Wait for users to load
    await waitFor(() => expect(screen.getByText('User Access Management')).toBeInTheDocument())
    // Ensure target user present
    expect(screen.getByText('deleteme')).toBeInTheDocument()

    // Click Delete button for user deleteme
  const deleteBtn = screen.getAllByText('Delete').find((btn: HTMLElement) => btn instanceof HTMLButtonElement && btn.title === 'Delete user account') as HTMLButtonElement
    expect(deleteBtn).toBeTruthy()
    await userEvent.click(deleteBtn)

    // Modal appears
    // Ensure modal content appears by querying heading specifically
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { name: 'Delete User' })
      expect(headings.length).toBeGreaterThan(0)
    })

    // Confirm delete
    const confirm = screen.getAllByRole('button', { name: /Delete User/i })
      .find((b: HTMLElement) => b.className.includes('admin-modal-btn-delete')) as HTMLButtonElement
    await userEvent.click(confirm)

  // After confirmation, list reloads; ensure user is gone
  await waitFor(() => expect(screen.queryByText('deleteme')).toBeNull())
  })

  it('cannot delete self (button disabled)', async () => {
    render(<AdminApp />)
    await waitFor(() => expect(screen.getByText('rootadmin')).toBeInTheDocument())
  const selfDeleteBtn = screen.getAllByText('Delete').find((btn: HTMLElement) => btn instanceof HTMLButtonElement && btn.title === 'Cannot delete your own account') as HTMLButtonElement
    expect(selfDeleteBtn).toBeTruthy()
    expect(selfDeleteBtn).toBeDisabled()
  })
})
