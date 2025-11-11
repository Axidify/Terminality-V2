import { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  children: ReactNode
}

export function ContextMenuPortal({ children }: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
