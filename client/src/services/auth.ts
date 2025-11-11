import { apiRequest, setToken, getToken } from './api'

export interface TokenOut { access_token: string }
export interface MeOut { id: number; username: string; is_admin?: boolean }

export async function register(username: string, password: string): Promise<void> {
  const res = await apiRequest<TokenOut>('/api/auth/register', { method: 'POST', body: { username, password } })
  setToken(res.access_token)
}

export async function login(username: string, password: string): Promise<void> {
  const params = new URLSearchParams()
  params.set('username', username)
  params.set('password', password)
  // OAuth2PasswordRequestForm requires content-type x-www-form-urlencoded
  const token = await apiRequest<TokenOut>('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
  setToken(token.access_token)
}

export async function me(): Promise<MeOut> {
  return apiRequest<MeOut>('/api/auth/me', { auth: true })
}

export function logout() {
  setToken(null)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}
