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
// Debounce/queue for desktop state saves to avoid spamming network and to allow offline/unauthenticated buffering
let pendingDesktopMerge: Partial<DesktopState> | null = null
let flushTimer: number | null = null
let listenersBound = false

function ensureAuthListeners() {
  if (listenersBound) return
  listenersBound = true
  try {
    // When auth token changes (e.g., user logs in), flush any pending buffered desktop changes
    window.addEventListener('authTokenChanged', () => {
      if (hasToken()) {
        // Try a fast flush when token appears
        void flushPendingSaves()
      }
    })
  } catch {
    /* no-op: window may be unavailable in some environments */
  }
}

async function flushPendingSaves(): Promise<void> {
  // Nothing to do
  if (!pendingDesktopMerge) return
  // Don't attempt network without a token
  if (!hasToken()) return
  const base: UnifiedState = cachedState || { version: 1, desktop: {}, story: {} }
  const next: UnifiedState = {
    version: base.version || 1,
    desktop: { ...(base.desktop || {}), ...pendingDesktopMerge },
    story: base.story || {}
  }
  try {
    const out = await apiRequest<{ session_id: number; state: UnifiedState }>(
      '/api/state',
      { method: 'PUT', auth: true, body: { state: next } }
    )
    cachedState = out.state
    pendingDesktopMerge = null
  } catch (_e) {
    // Keep pending to retry later (e.g., when connectivity/auth is restored)
  }
}

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
  ensureAuthListeners()
  // Ensure cache
  if (!cachedState) {
    // If the user is not logged in, update only the local cache and avoid network calls
    if (!hasToken()) {
      const base = cachedState || { version: 1, desktop: {}, story: {} }
      cachedState = { version: base.version || 1, desktop: { ...(base.desktop || {}), ...partial }, story: base.story || {} }
      // Buffer pending to flush upon login
      pendingDesktopMerge = { ...(pendingDesktopMerge || {}), ...partial }
      return cachedState
    }
    try { await hydrateFromServer() } catch { /* ignore to allow best-effort */ }
  }
  // Merge into local cache immediately for responsive UX
  const base: UnifiedState = cachedState || { version: 1, desktop: {}, story: {} }
  cachedState = {
    version: base.version || 1,
    desktop: { ...(base.desktop || {}), ...partial },
    story: base.story || {}
  }

  // Accumulate pending changes
  pendingDesktopMerge = { ...(pendingDesktopMerge || {}), ...partial }

  // If not logged-in, don't attempt a network call now; return cached state and keep pending for later
  if (!hasToken()) {
    return cachedState
  }

  // Debounce the actual network PUT to batch rapid updates (e.g., mount effects)
  if (flushTimer) {
    try { clearTimeout(flushTimer) } catch { /* ignore */ }
    flushTimer = null
  }
  flushTimer = setTimeout(() => { void flushPendingSaves() }, 300) as unknown as number
  return cachedState
}

export function getCachedDesktop(): DesktopState | undefined {
  return cachedState?.desktop
}
