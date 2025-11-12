import { apiRequest } from './api'
import { isLoggedIn as hasToken } from './auth'

export interface DesktopState {
  windowMemory?: Record<string, { x: number; y: number; width: number; height: number }>
  icons?: Record<string, { x: number; y: number }>
  theme?: string
  // Persisted in-memory filesystem snapshot
  fs?: { nodes: Record<string, any> }
  // Recycle bin metadata
  recycleBin?: Array<{ recyclePath: string; originalPath: string; name: string; deletedAt: string }>
  // Desktop personalization
  wallpaper?: string
  // System specs
  computerSpecs?: Record<string, any>
  // Notifications (timestamps as ISO strings)
  notifications?: Array<{ id: string; title: string; message: string; timestamp: string; read: boolean; type?: string }>
  // Notepad recent files
  notepadRecent?: string[]
  // Music playlists and state
  musicPlaylists?: any
  musicState?: any
  // SystemInfo monitor UI state
  systemInfoLayout?: boolean // true = horizontal, false = vertical
  systemInfoPosition?: { x: number; y: number }
  systemInfoSnappedEdge?: 'left' | 'right' | 'top' | 'bottom' | null
  systemInfoCollapsed?: boolean
  // Economy / store state
  credits?: number
  bankTransactions?: Array<{ id: string; date: string; description: string; amount: number; type: 'credit' | 'debit' }>
  playerCurrency?: number
  installedTools?: string[]
  // Design scenarios (admin)
  scenarios?: Array<{ id: string; name: string; description: string; created: string; state?: Record<string, any> }>
  // Player progression & settings
  playerLevel?: number
  playerExperience?: number
  soundEffectsEnabled?: boolean
  // Lock screen persisted flag
  isLocked?: boolean
}

export interface UnifiedState {
  version: number
  desktop: DesktopState
  story: Record<string, any>
}

// In-memory cache of server state to allow merging partial updates
let cachedState: UnifiedState | null = null
// Shared promise to dedupe concurrent hydration requests
let hydrationPromise: Promise<UnifiedState> | null = null

export async function hydrateFromServer(): Promise<UnifiedState> {
  // Return cached state if available (avoids unnecessary fetch attempts)
  if (cachedState) return cachedState
  // If not logged-in, avoid network call and return cached or default immediately
  if (!hasToken()) {
    if (cachedState) return cachedState
    const s: UnifiedState = { version: 1, desktop: {}, story: {} }
    cachedState = s
    return s
  }
  // If a hydration request is already in flight, return that promise
  if (hydrationPromise) return hydrationPromise

  hydrationPromise = (async () => {
    try {
      const out = await apiRequest<{ session_id: number; state: UnifiedState }>('/api/state', { auth: true })
      const s = out.state
      // Ensure keys
      s.version = s.version || 1
      s.desktop = s.desktop || {}
      s.story = s.story || {}
      cachedState = s
      return s
    } catch (_e: any) {
      // If API is unreachable (eg. local dev without server), return cached state or a default
      if (cachedState) return cachedState
      const s: UnifiedState = { version: 1, desktop: {}, story: {} }
      cachedState = s
      return s
    } finally {
      hydrationPromise = null
    }
  })()

  return hydrationPromise
}

export async function saveDesktopState(partial: Partial<DesktopState>): Promise<UnifiedState> {
  // Ensure cache
  if (!cachedState) {
    // If the user is not logged in, update only the local cache and avoid network calls
    if (!hasToken()) {
      const base = cachedState || { version: 1, desktop: {}, story: {} }
      cachedState = { version: base.version || 1, desktop: { ...(base.desktop || {}), ...partial }, story: base.story || {} }
      return cachedState
    }
    try { await hydrateFromServer() } catch { /* ignore to allow best-effort */ }
  }
  const base: UnifiedState = cachedState || { version: 1, desktop: {}, story: {} }
  const next: UnifiedState = {
    version: base.version || 1,
    desktop: { ...(base.desktop || {}), ...partial },
    story: base.story || {}
  }
  const out = await apiRequest<{ session_id: number; state: UnifiedState }>(
    '/api/state',
    { method: 'PUT', auth: true, body: { state: next } }
  )
  cachedState = out.state
  return cachedState
}

export function getCachedDesktop(): DesktopState | undefined {
  return cachedState?.desktop
}
