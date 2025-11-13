export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const DEFAULT_BASE = 'http://localhost:3000'

// Resolve API base with fallbacks and a runtime override for production debugging.
// Order of precedence (highest first):
// 1) localStorage 'API_BASE_OVERRIDE' (set via ?api=... or manual)
// 2) window.__API_BASE__ (if injected by hosting)
// 3) VITE_API_BASE (baked at build time)
// 4) DEFAULT_BASE
function resolveApiBase(): string {
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const isDev = !!((import.meta as any)?.env?.DEV)
      let ls: string | null = null
      let global: string | null = null
      const baked = (import.meta as any)?.env?.VITE_API_BASE
      if (isDev) {
        const qp = url.searchParams.get('api')
        if (qp) {
          try { window.localStorage.setItem('API_BASE_OVERRIDE', qp) } catch { /* ignore */ }
        }
        ls = (() => { try { return window.localStorage.getItem('API_BASE_OVERRIDE') } catch { return null } })()
        global = (window as any).__API_BASE__
      }
      // Project-specific safe fallback: if hosted on terminality.onrender.com and no config provided,
      // default to the known backend domain to avoid localhost in production.
      const host = window.location.hostname
      const hostFallbacks: Record<string, string> = {
        // Production host → API host mapping (safety net when VITE_API_BASE/overrides are absent)
        'terminality.onrender.com': 'https://terminality-api.onrender.com',
      }
      const fallback = hostFallbacks[host]
      const chosen = (isDev ? (ls || global || baked) : baked) || fallback || DEFAULT_BASE
      return String(chosen).replace(/\/$/, '')
    }
  } catch { /* ignore */ }
  const baked = (import.meta as any)?.env?.VITE_API_BASE
  return String(baked || DEFAULT_BASE).replace(/\/$/, '')
}

const API_BASE = resolveApiBase()

export function getApiBase(): string {
  // Ensure no trailing slash
  return (API_BASE as string).replace(/\/$/, '')
}

export function getToken(): string | null {
  try { return localStorage.getItem('authToken') } catch { /* ignore: localStorage unavailable */ return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem('authToken', token)
    else localStorage.removeItem('authToken')
    // Dispatch a custom event so auth-aware contexts can refresh without polling
    window.dispatchEvent(new Event('authTokenChanged'))
  } catch { /* ignore: localStorage unavailable */ }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json().catch(() => null) as any
    const newTok = data && (data.access_token as string)
    if (newTok) setToken(newTok)
    return newTok || null
  } catch {
    return null
  }
}

export async function apiRequest<T>(path: string, options: { method?: HttpMethod; headers?: Record<string, string>; body?: any; auth?: boolean } = {}): Promise<T> {
  const method = options.method || 'GET'
  const headers: Record<string, string> = { ...(options.headers || {}) }
  const token = options.auth ? getToken() : null
  if (token) headers['Authorization'] = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body && typeof options.body === 'object' && !(options.body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  } else if (options.body) {
    body = options.body as any
  }

  // Short-circuit requests if API has been recently offline to avoid spamming console and network
  const now = Date.now()
  // If the browser is offline, avoid attempting fetch and mark API offline
  try {
    if (typeof navigator !== 'undefined' && !(navigator as any).onLine) {
      ;(apiRequest as any)._offlineUntil = Date.now() + 5000
      throw new Error('Browser seems offline')
    }
  } catch (_e) {
    /* ignore: navigator may be absent in some environments */
  }
  if ((apiRequest as any)._offlineUntil && now < (apiRequest as any)._offlineUntil) {
    throw new Error('API seems offline')
  }
  let res: Response
  const doFetch = async (withAuthHeaders: Record<string, string>) => {
    return fetch(`${getApiBase()}${path}`, { method, headers: withAuthHeaders, body, credentials: 'omit' })
  }
  try {
    // We use Authorization header tokens for normal calls; cookies only for refresh
    res = await doFetch(headers)
  } catch (_err) {
    // Mark API as offline for a short duration to prevent repeated retries
    ;(apiRequest as any)._offlineUntil = Date.now() + 5000
    throw new Error('Network error')
  }
  if (res.status === 401) {
    // Try to refresh once
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`
      res = await doFetch(headers)
    }
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('sessionExpired', { detail: { path, status: 401 } }))
      const text = await res.text().catch(() => '')
      throw new Error(text || 'Session expired')
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return (await res.text()) as unknown as T
}
