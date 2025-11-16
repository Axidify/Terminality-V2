import React, { useEffect, useRef } from 'react'

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
  // Keep latest callbacks without causing re-initialization
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const render = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res: any) => {
            try {
              if (res && res.credential) {
                if (onSuccessRef.current) {
                  onSuccessRef.current(res.credential)
                }
              } else if (onErrorRef.current) {
                onErrorRef.current(new Error('No credential returned'))
              }
            } catch (e) {
              if (onErrorRef.current) {
                onErrorRef.current(e)
              }
            }
          },
          auto_select: false
        })
        if (containerRef.current) {
          // Ensure the container is empty before rendering the button once
          containerRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large' })
        }
      } catch (e) {
        if (onErrorRef.current) {
          onErrorRef.current(e)
        }
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
    s.onerror = (e) => {
      if (onErrorRef.current) {
        onErrorRef.current(e)
      }
    }
    document.head.appendChild(s)
    return () => {
      // remove script? keep it
    }
  // Run only once on mount; callbacks are kept fresh via refs above
  }, [])

  return (
    <div ref={containerRef} aria-hidden={disabled}></div>
  )
}

export default GoogleSignInButton
