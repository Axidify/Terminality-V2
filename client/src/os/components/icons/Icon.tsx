import React from 'react'

export type IconName =
  | 'arrow-right'
  | 'star'
  | 'search'
  | 'monitor'
  | 'user'
  | 'chart'
  | 'trophy'
  | 'bolt'
  | 'speaker'
  | 'check'

export interface IconProps {
  name: IconName
  size?: number | string
  weight?: 'thin' | 'normal' | 'bold'
  className?: string
}

export const Icon: React.FC<IconProps> = ({ name, size = 16, weight = 'normal', className }) => {
  const common = { width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size, stroke: 'currentColor', fill: 'none' }
  switch (name) {
    case 'arrow-right':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 12h11" strokeWidth={weight === 'bold' ? 2.2 : weight === 'thin' ? 1 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 6l6 6-6 6" strokeWidth={weight === 'bold' ? 2.2 : weight === 'thin' ? 1 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'star':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2l2.6 5.4L20 9l-4 3.1L17 19l-5-2.8L7 19l1-6.9L4 9l5.4-1.6L12 2z" fill="currentColor" />
        </svg>
      )
    case 'search':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="6" strokeWidth={weight === 'bold' ? 2 : 1.4} />
          <rect x="16.5" y="16" width="6" height="1.8" rx="0.9" transform="rotate(45 16.5 16)" fill="currentColor" />
        </svg>
      )
    case 'monitor':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="4" width="18" height="12" rx="1" strokeWidth={weight === 'bold' ? 2 : 1.4} />
          <rect x="7" y="17" width="10" height="1.6" rx="0.8" fill="currentColor" />
        </svg>
      )
      case 'user':
        return (
          <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor" />
          </svg>
        )
    case 'chart':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="12" width="3" height="8" strokeWidth={1} fill="currentColor" />
          <rect x="9" y="8" width="3" height="12" strokeWidth={1} fill="currentColor" />
          <rect x="14" y="4" width="3" height="16" strokeWidth={1} fill="currentColor" />
        </svg>
      )
    case 'trophy':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 4v2a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V4" strokeWidth={1.4} />
          <path d="M6 19a6 6 0 0 0 12 0" strokeWidth={1.4} />
        </svg>
      )
    case 'bolt':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'speaker':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 9v6h4l5 3V6L9 9H5z" strokeWidth={1.2} />
        </svg>
      )
    case 'check':
      return (
        <svg className={className} {...common} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M20 6L9 17l-5-5" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}

export default Icon
