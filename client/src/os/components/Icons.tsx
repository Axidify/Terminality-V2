import React from 'react'

interface IconProps {
  size?: number
  color?: string
}

export const TerminalIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="20" height="18" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M7 8L10 11L7 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="14" x2="17" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const FolderIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7V19C3 19.5523 3.44772 20 4 20H20C20.5523 20 21 19.5523 21 19V9C21 8.44772 20.5523 8 20 8H11L9 6H4C3.44772 6 3 6.44772 3 7Z" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M3 7C3 6.44772 3.44772 6 4 6H9L11 8H20C20.5523 8 21 8.44772 21 9" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const NotepadIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M14 2V7H19" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="17" x2="13" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const BrowserIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" fill="none"/>
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.5" fill="none"/>
    <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5"/>
    <path d="M12 3C14.5 5.5 16 8.5 16 12C16 15.5 14.5 18.5 12 21" stroke={color} strokeWidth="1.5"/>
    <path d="M12 3C9.5 5.5 8 8.5 8 12C8 15.5 9.5 18.5 12 21" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const RecycleBinIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6H21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19 6L18 20C18 20.5523 17.5523 21 17 21H7C6.44772 21 6 20.5523 6 20L5 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const MailIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M2 7L12 13L22 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const MusicIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="17" r="3" stroke={color} strokeWidth="1.5" fill="none"/>
    <circle cx="17" cy="15" r="3" stroke={color} strokeWidth="1.5" fill="none"/>
    <line x1="10" y1="17" x2="10" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="20" y1="15" x2="20" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 5L20 3V8L10 10V5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
  </svg>
)

export const SettingsIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const ChatIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 11.5C21 16.7467 16.9706 21 12 21C10.6134 21 9.29553 20.7144 8.09944 20.1967L3 21L4.30745 16.6689C3.47505 15.3729 3 13.8878 3 12.3333C3 7.73096 7.02944 4 12 4C16.9706 4 21 7.73096 21 12.3333V11.5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <circle cx="8.5" cy="12" r="0.5" fill={color}/>
    <circle cx="12" cy="12" r="0.5" fill={color}/>
    <circle cx="15.5" cy="12" r="0.5" fill={color}/>
  </svg>
)

export const StoreIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9L5 3H19L21 9M3 9V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V9M3 9H21" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <path d="M9 9V21M15 9V21" stroke={color} strokeWidth="1.5"/>
    <circle cx="12" cy="15" r="2" stroke={color} strokeWidth="1.5" fill="none"/>
  </svg>
)

export const QuestIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="15" y="3" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="3" y="15" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
    <rect x="15" y="15" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
    <path d="M9 6H15M6 9V15M18 9V15M9 18H15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

// Generic context/action icons
export const RefreshIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12a9 9 0 0 1 15.3-6.364" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 12a9 9 0 0 1-15.3 6.364" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 5H4V10" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 19h5v-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const ArrangeIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="7" height="7" stroke={color} strokeWidth="1.5"/>
    <rect x="14" y="3" width="7" height="7" stroke={color} strokeWidth="1.5"/>
    <rect x="3" y="14" width="7" height="7" stroke={color} strokeWidth="1.5"/>
    <rect x="14" y="14" width="7" height="7" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const VolumeOffIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M16 9L20 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M20 9L16 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const InfoIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/>
    <line x1="12" y1="8" x2="12" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M11 11h2v7h-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const ResetIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4H10V10H4V4Z" stroke={color} strokeWidth="1.5"/>
    <path d="M14 4H20V10H14V4Z" stroke={color} strokeWidth="1.5"/>
    <path d="M4 14H10V20H4V14Z" stroke={color} strokeWidth="1.5"/>
    <path d="M20 14L14 14V20H20V14Z" stroke={color} strokeWidth="1.5"/>
    <path d="M14 10L10 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 10L14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const CopyIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="11" height="11" rx="2" stroke={color} strokeWidth="1.5"/>
    <rect x="4" y="4" width="11" height="11" rx="2" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const PasteIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 4H6C5.44772 4 5 4.44772 5 5V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V5C19 4.44772 18.5523 4 18 4H16" stroke={color} strokeWidth="1.5"/>
    <rect x="10" y="2" width="4" height="4" rx="1" stroke={color} strokeWidth="1.5"/>
    <path d="M9 9H15V15H9V9Z" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const ClearIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6H21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5 6L6 20C6 20.5523 6.44772 21 7 21H17C17.5523 21 18 20.5523 18 20L19 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 11L10 17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M14 11L14 17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const BackIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 19L5 12L12 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const ForwardIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12H19" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 5L19 12L12 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const HomeIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11L12 3L21 11V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V11Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M9 21V13H15V21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const DeleteIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6H21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 6L7 20C7 20.5523 7.44772 21 8 21H16C16.5523 21 17 20.5523 17 20L18 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 11L10 17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M14 11L14 17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const SaveIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4H16L20 8V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V4Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M8 4V10H16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="8" y="13" width="8" height="6" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const SelectAllIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" stroke={color} strokeWidth="1.5" strokeDasharray="4 3"/>
    <path d="M7 12H17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 7V17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

// Music Player Controls
export const PlayIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5L19 12L8 19V5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
  </svg>
)

export const PauseIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="4" height="14" stroke={color} strokeWidth="1.5" fill="none"/>
    <rect x="14" y="5" width="4" height="14" stroke={color} strokeWidth="1.5" fill="none"/>
  </svg>
)

export const SkipBackIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 18L9 12L19 6V18Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <line x1="5" y1="6" x2="5" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const SkipForwardIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 6L15 12L5 18V6Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <line x1="19" y1="6" x2="19" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const ShuffleIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 3H21V8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 20L21 3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M21 16V21H16" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 15L21 21M4 4L9 9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const RepeatIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 2L21 6L17 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 11V9C3 7.89543 3.89543 7 5 7H21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 22L3 18L7 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 13V15C21 16.1046 20.1046 17 19 17H3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const RepeatOneIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 2L21 6L17 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 11V9C3 7.89543 3.89543 7 5 7H21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 22L3 18L7 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 13V15C21 16.1046 20.1046 17 19 17H3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="12" y="15" fontSize="8" fill={color} textAnchor="middle" fontFamily="monospace">1</text>
  </svg>
)

export const VolumeIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const NoteIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="5.5" cy="17.5" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M8 17V6C8 5.44772 8.44772 5 9 5H18C18.5523 5 19 5.44772 19 6V7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="6" x2="8" y2="17" stroke={color} strokeWidth="1.5"/>
  </svg>
)

export const AdminIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 6V11C4 16.5 8 20.5 12 22C16 20.5 20 16.5 20 11V6L12 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M7 16C7.5 14.5 9.5 13.5 12 13.5C14.5 13.5 16.5 14.5 17 16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const UserManagementIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
