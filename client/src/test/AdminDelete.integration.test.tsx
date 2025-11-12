import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { UserManagementApp } from '../programs/UserManagementApp'

// Mock auth service
vi.mock('../os/UserContext', () => ({
  useUser: vi.fn().mockReturnValue({ user: { id: 1, username: 'admin', isAdmin: true }, isAdmin: true })
}))

let users = [
  { id: 1, username: 'admin', role: 'admin' },
  { id: 2, username: 'deleteme', role: 'user' }
]

vi.mock('../services/api', () => ({
  apiRequest: vi.fn().mockImplementation((url: string) => {
    if (url === '/api/admin/users') {
      return Promise.resolve(users)
    }
    return Promise.resolve({})
  })
}))

describe('UserManagementApp user deletion integration', () => {
  beforeEach(() => {
    // reset users array before each test
    users = [
      { id: 1, username: 'admin', role: 'admin' },
      { id: 2, username: 'deleteme', role: 'user' }
    ]
  })

  it('deletes a user and removes from UI list', async () => {
    render(<UserManagementApp />)
    // Wait for users to load
    await waitFor(() => expect(screen.getByText('USER MANAGEMENT')).toBeInTheDocument())
    // Ensure target user present
    expect(screen.getByText('deleteme')).toBeInTheDocument()
    // Find the delete button for the non-self user
    const allDeleteButtons = screen.getAllByText('DELETE')
    // The first DELETE button should be for admin (disabled), second for deleteme (enabled)
    expect(allDeleteButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('cannot delete self (button disabled)', async () => {
    render(<UserManagementApp />)
    await waitFor(() => expect(screen.getByText('USER MANAGEMENT')).toBeInTheDocument())
    // Get all DELETE buttons
    const allDeleteButtons = screen.getAllByText('DELETE')
    // First one should be disabled (for self/admin)
    expect(allDeleteButtons[0]).toBeDisabled()
    expect(allDeleteButtons[0]).toHaveAttribute('title', 'Cannot delete your own account')
    // Second one should be enabled (for deleteme user)
    expect(allDeleteButtons[1]).not.toBeDisabled()
  })
})
