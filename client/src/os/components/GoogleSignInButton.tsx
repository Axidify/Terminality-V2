import React, { useEffect, useRef } from 'react'
import { VITE_GOOGLE_CLIENT_ID as _unused } from '/@env'

declare global {
  interface Window {
    google?: any
  }
}

interface Props {
  onSuccess: (idToken: string) => void
  onError?: (err: any) => void
  disabled?: boolean
}

const GoogleSignInButton: React.FC<Props> = ({ onSuccess, onError, disabled }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const render = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res: any) => {
            if (res && res.credential) {
              onSuccess(res.credential)
            } else {
              onError && onError(new Error('No credential returned'))
            }
          }
        })
        if (containerRef.current) {
          window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large' })
        }
      } catch (e) {
        onError && onError(e)
      }
    }
    if (window.google && window.google.accounts && containerRef.current) {
      render()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => render()
    s.onerror = (e) => onError && onError(e)
    document.head.appendChild(s)
    return () => {
      // remove script? keep it
    }
  }, [onSuccess, onError])

  return (
    <div ref={containerRef} aria-hidden={disabled}></div>
  )
}

export default GoogleSignInButton
