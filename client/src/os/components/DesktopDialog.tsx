import React from 'react'
import { createPortal } from 'react-dom'
import './DesktopDialog.css'

interface DesktopDialogProps {
  title: string
  message?: React.ReactNode
  mode?: 'input' | 'confirm'
  value?: string
  onValueChange?: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel?: string
  cancelLabel?: string
  error?: string | null
  placeholder?: string
}

export const DesktopDialog: React.FC<DesktopDialogProps> = ({
  title,
  message,
  mode = 'confirm',
  value = '',
  onValueChange,
  onSubmit,
  onCancel,
  submitLabel = 'OK',
  cancelLabel = 'Cancel',
  error,
  placeholder
}) => {
  const dialogRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const shouldRenderInput = mode === 'input'

  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => {
      if (shouldRenderInput && inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      } else {
        dialogRef.current?.focus()
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
      previouslyFocused?.focus?.()
    }
  }, [shouldRenderInput])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    if (e.key === 'Enter' && shouldRenderInput) {
      e.preventDefault()
      onSubmit()
    }
  }

  const body = (
    <div className="desktop-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="desktop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="desktop-dialog-header">
          <h2 id="desktop-dialog-title">{title}</h2>
          <button className="desktop-dialog-close" onClick={onCancel} aria-label="Close dialog">×</button>
        </header>
        <div className="desktop-dialog-content">
          {message && <div className="desktop-dialog-message">{message}</div>}
          {shouldRenderInput && (
            <input
              ref={inputRef}
              className="desktop-dialog-input"
              value={value}
              onChange={(e) => onValueChange?.(e.target.value)}
              placeholder={placeholder}
              spellCheck={false}
            />
          )}
          {error && <div className="desktop-dialog-error">{error}</div>}
        </div>
        <footer className="desktop-dialog-footer">
          {cancelLabel && (
            <button className="desktop-dialog-btn secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button className="desktop-dialog-btn primary" onClick={onSubmit}>
            {submitLabel}
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
