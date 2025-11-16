import React, { useEffect, useState } from 'react'

import { SettingsIcon } from './Icons'
import { logout } from '../../services/auth'


export const SessionExpiredOverlay: React.FC = () => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onExpire = () => {
      setShow(true)
      // Auto redirect after a brief delay to give the overlay a chance to show
      setTimeout(() => {
        try { logout() } catch { /* ignore */ }
        window.location.href = '/'
      }, 1200)
    }
    window.addEventListener('sessionExpired', onExpire as EventListener)
    return () => window.removeEventListener('sessionExpired', onExpire as EventListener)
  }, [])

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Session expired"
      className="session-expired-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 200000,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85), rgba(0,0,0,0.95))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)'
      }}
      onClick={() => setShow(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          border: '2px solid var(--color-primary)',
          boxShadow: '0 0 30px rgba(var(--color-primary-rgb), 0.5), inset 0 0 20px rgba(0,0,0,0.6)',
          background: 'var(--color-surface)',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'Courier New, monospace',
          animation: 'fadeIn 200ms ease-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 12 }}>
          <SettingsIcon size={22} />
          <span style={{ letterSpacing: 3, color: 'var(--color-primary)' }}>SYSTEM NOTICE</span>
        </div>
        <h3 style={{ margin: '8px 0 2px 0' }}>SESSION EXPIRED</h3>
        <p style={{ margin: 0, color: 'var(--color-textDim)' }}>Your secure session has timed out. Please sign in again to continue.</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => { window.location.href = '/login' }} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}>Go to Login</button>
          <button onClick={() => setShow(false)} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' }}>Dismiss</button>
        </div>
        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--color-textDim)' }}>
          Tip: Save your work frequently to avoid losing progress.
        </div>
      </div>
    </div>
  )
}

export default SessionExpiredOverlay
