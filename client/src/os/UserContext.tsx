import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { isLoggedIn as hasToken, me as fetchMe, login as authLogin, logout as authLogout, MeOut } from '../services/auth'

export interface User {
  id: number
  username: string
  isAdmin: boolean
}

interface UserContextValue {
  user: User | null
  loading: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

function toUser(me: MeOut): User {
  return { id: me.id, username: me.username, isAdmin: !!me.is_admin }
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const refresh = useCallback(async () => {
    if (!hasToken()) { setUser(null); return }
    try {
      const profile = await fetchMe()
      setUser(toUser(profile))
    } catch {
      // token invalid or server unavailable; treat as logged out
      setUser(null)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    await authLogin(username, password)
    await refresh()
  }, [refresh])

  const logout = useCallback(() => {
    try { authLogout() } finally { setUser(null) }
  }, [])

  useEffect(() => {
    // On mount, try hydrating user if a token exists
    (async () => {
      setLoading(true)
      try { await refresh() } finally { setLoading(false) }
    })()

    // Listen for auth token changes (set/remove) to auto-refresh user state
    const handler = () => { refresh() }
    window.addEventListener('authTokenChanged', handler as EventListener)
    return () => window.removeEventListener('authTokenChanged', handler as EventListener)
  }, [refresh])

  return (
    <UserContext.Provider value={{ user, loading, isAdmin: !!user?.isAdmin, login, logout, refresh }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within a UserProvider')
  return ctx
}
