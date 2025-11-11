import React, { useState } from 'react'
import { requestReset, confirmReset } from '../services/auth'

export const ResetPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [byEmail, setByEmail] = useState(false)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [stage, setStage] = useState<'request' | 'confirm'>('request')

  const doRequest = async () => {
    setMessage(null)
    try {
  const res: any = await requestReset(byEmail ? { email } : username)
      setToken(res.reset_token || '')
      setStage('confirm')
      setMessage('Reset token created (dev).')
    } catch (e: any) { setMessage(e?.message || 'Request failed') }
  }

  const doConfirm = async () => {
    setMessage(null)
    try {
      await confirmReset(token, password)
      setMessage('Password reset successfully')
      setStage('request')
      setUsername('')
      setToken('')
      setPassword('')
    } catch (e: any) { setMessage(e?.message || 'Reset failed') }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Password Reset</h2>
      {stage === 'request' && (
        <div>
          <label>
            <input type="checkbox" checked={byEmail} onChange={e => setByEmail(e.target.checked)} /> Send via email
          </label>
          {!byEmail && (
            <>
              <label>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} />
            </>
          )}
          {byEmail && (
            <>
              <label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} />
            </>
          )}
          <div style={{ marginTop: 8 }}>
            <button onClick={doRequest}>Request Reset</button>
          </div>
        </div>
      )}
      {stage === 'confirm' && (
        <div>
          <label>Token</label>
          <input value={token} onChange={e => setToken(e.target.value)} />
          <label>New Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <button onClick={doConfirm}>Confirm Reset</button>
          </div>
        </div>
      )}
      {message && <div style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}

export default ResetPage
