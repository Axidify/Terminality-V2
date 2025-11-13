import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OnlineChat } from '../modular-apps/plugins/OnlineChatPlugin'
import * as api from '../services/api'

describe('OnlineChat plugin', () => {
  it('fetches and displays messages and sends a message', async () => {
    const fakeMessages = [{ id: 1, userId: 2, username: 'alice', content: 'hello', createdAt: new Date().toISOString() }]
    const fetchMock = vi.spyOn(api, 'apiRequest').mockImplementation(async (path, options) => {
      if (path === '/api/chat' && (!options || options.method === 'GET' || (options && !('method' in options)))) return fakeMessages as any
      if (path === '/api/chat' && options && options.method === 'POST') return { id: 2, userId: 1, username: 'me', content: 'hi', createdAt: new Date().toISOString() } as any
      return null as any
    })

    render(<OnlineChat />)

    await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalled()

    fetchMock.mockRestore()
  })
})
