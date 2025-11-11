export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const DEFAULT_BASE = 'http://localhost:8000'
const API_BASE = (import.meta as any)?.env?.VITE_API_BASE || DEFAULT_BASE

export function getApiBase(): string {
  // Ensure no trailing slash
  return (API_BASE as string).replace(/\/$/, '')
}

export function getToken(): string | null {
  try { return localStorage.getItem('authToken') } catch { return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem('authToken', token)
    else localStorage.removeItem('authToken')
    // Dispatch a custom event so auth-aware contexts can refresh without polling
    window.dispatchEvent(new Event('authTokenChanged'))
  } catch {}
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

  const res = await fetch(`${getApiBase()}${path}`, { method, headers, body, credentials: 'include' })
  if (res.status === 401) {
    // Dispatch immersive session expiry event
    window.dispatchEvent(new CustomEvent('sessionExpired', { detail: { path, status: 401 } }))
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Session expired')
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
