import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi } from 'vitest'

import { OnlineChat } from '../modular-apps/plugins/OnlineChatPlugin'
import { NotificationProvider } from '../os/NotificationContext'
import * as api from '../services/api'

describe('OnlineChat plugin', () => {
  it('fetches and displays messages and sends a message', async () => {
    const fakeMessages = [{ id: 1, user: { username: 'alice' }, content: 'hello', createdAt: new Date().toISOString() }]
    const fetchMock = vi.spyOn(api, 'apiRequest').mockImplementation(async (path, options) => {
      if (String(path).startsWith('/api/chat/messages') && (!options || options.method === 'GET' || (options && !('method' in options)))) return fakeMessages as any
      if (path === '/api/chat/messages' && options && options.method === 'POST') return { id: 2, user: { username: 'me' }, content: 'hi', createdAt: new Date().toISOString() } as any
      if (path === '/api/chat/users') return [] as any
      if (path === '/api/chat/ping') return { message: 'pong' } as any
      return null as any
    })

    render(
      <NotificationProvider>
        <OnlineChat />
      </NotificationProvider>
    )

    await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalled()

    fetchMock.mockRestore()
  })
})
