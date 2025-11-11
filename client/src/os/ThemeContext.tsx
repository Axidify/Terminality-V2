import React, { createContext, useContext, useState, useEffect } from 'react'
import { saveDesktopState, getCachedDesktop } from '../services/saveService'

export interface Theme {
  name: string
  colors: {
    primary: string
    secondary: string
    accent?: string
    background: string
    surface: string
    surfaceHover?: string
    text: string
    textDim: string
    border: string
    shadow: string
  }
}

export const themes: Record<string, Theme> = {
  green: {
    name: 'Classic Green',
    colors: {
      primary: '#00d992',
      secondary: '#00a372',
      background: '#000000',
      surface: '#0a120e',
      text: '#00d992',
      textDim: '#007a52',
      border: '#00a372',
      shadow: 'rgba(0, 217, 146, 0.2)'
    }
  },
  amber: {
    name: 'Amber CRT',
    colors: {
      primary: '#ffb000',
      secondary: '#cc8800',
      background: '#0f0a00',
      surface: '#1a1200',
      text: '#ffb000',
      textDim: '#996600',
      border: '#cc8800',
      shadow: 'rgba(255, 176, 0, 0.2)'
    }
  },
  white: {
    name: 'White Phosphor',
    colors: {
      primary: '#e8e8e8',
      secondary: '#b0b0b0',
      background: '#0a0a0a',
      surface: '#141414',
      text: '#e8e8e8',
      textDim: '#808080',
      border: '#b0b0b0',
      shadow: 'rgba(232, 232, 232, 0.15)'
    }
  },
  blue: {
    name: 'Blue Terminal',
    colors: {
      primary: '#00bfff',
      secondary: '#0088cc',
      background: '#000508',
      surface: '#0a1418',
      text: '#00bfff',
      textDim: '#006699',
      border: '#0088cc',
      shadow: 'rgba(0, 191, 255, 0.2)'
    }
  },
  purple: {
    name: 'Purple Haze',
    colors: {
      primary: '#a855f7',
      secondary: '#7c3aed',
      background: '#0a0012',
      surface: '#1a0f2e',
      surfaceHover: '#251a3a',
      text: '#a855f7',
      textDim: '#6b21a8',
      border: '#7c3aed',
      shadow: 'rgba(168, 85, 247, 0.2)'
    }
  },
  red: {
    name: 'Red Alert',
    colors: {
      primary: '#ff3b5c',
      secondary: '#cc2e49',
      background: '#0f0000',
      surface: '#1a0505',
      surfaceHover: '#250a0a',
      text: '#ff3b5c',
      textDim: '#991829',
      border: '#cc2e49',
      shadow: 'rgba(255, 59, 92, 0.2)'
    }
  },
  cyan: {
    name: 'Cyan Matrix',
    colors: {
      primary: '#00ffff',
      secondary: '#00cccc',
      background: '#000a0a',
      surface: '#0a1a1a',
      surfaceHover: '#0f2525',
      text: '#00ffff',
      textDim: '#008888',
      border: '#00cccc',
      shadow: 'rgba(0, 255, 255, 0.2)'
    }
  },
  pink: {
    name: 'Hot Pink',
    colors: {
      primary: '#ff00ff',
      secondary: '#cc00cc',
      background: '#0f000f',
      surface: '#1a0a1a',
      surfaceHover: '#250f25',
      text: '#ff00ff',
      textDim: '#990099',
      border: '#cc00cc',
      shadow: 'rgba(255, 0, 255, 0.2)'
    }
  },
  orange: {
    name: 'Orange Glow',
    colors: {
      primary: '#ff8c00',
      secondary: '#cc7000',
      background: '#0f0800',
      surface: '#1a1200',
      surfaceHover: '#251a0a',
      text: '#ff8c00',
      textDim: '#995400',
      border: '#cc7000',
      shadow: 'rgba(255, 140, 0, 0.2)'
    }
  },
  teal: {
    name: 'Teal Dream',
    colors: {
      primary: '#14b8a6',
      secondary: '#0d9488',
      background: '#00080a',
      surface: '#0a1a1a',
      surfaceHover: '#0f2525',
      text: '#14b8a6',
      textDim: '#0f766e',
      border: '#0d9488',
      shadow: 'rgba(20, 184, 166, 0.2)'
    }
  },
  lime: {
    name: 'Lime Electric',
    colors: {
      primary: '#84cc16',
      secondary: '#65a30d',
      background: '#050a00',
      surface: '#0f1a0a',
      surfaceHover: '#1a250f',
      text: '#84cc16',
      textDim: '#4d7c0f',
      border: '#65a30d',
      shadow: 'rgba(132, 204, 22, 0.2)'
    }
  },
  duotone_purple_cyan: {
    name: 'Purple/Cyan Dual',
    colors: {
      primary: '#a855f7',
      secondary: '#00ffff',
      accent: '#00ffff',
      background: '#05000a',
      surface: '#120a1a',
      surfaceHover: '#1a0f25',
      text: '#a855f7',
      textDim: '#00cccc',
      border: '#7c3aed',
      shadow: 'rgba(168, 85, 247, 0.3)'
    }
  },
  duotone_pink_blue: {
    name: 'Pink/Blue Dual',
    colors: {
      primary: '#ff00ff',
      secondary: '#00bfff',
      accent: '#00bfff',
      background: '#05000a',
      surface: '#150a1a',
      surfaceHover: '#200f25',
      text: '#ff00ff',
      textDim: '#0088cc',
      border: '#cc00cc',
      shadow: 'rgba(255, 0, 255, 0.3)'
    }
  },
  duotone_orange_teal: {
    name: 'Orange/Teal Dual',
    colors: {
      primary: '#ff8c00',
      secondary: '#14b8a6',
      accent: '#14b8a6',
      background: '#050a08',
      surface: '#1a1512',
      surfaceHover: '#251f1a',
      text: '#ff8c00',
      textDim: '#0d9488',
      border: '#cc7000',
      shadow: 'rgba(255, 140, 0, 0.3)'
    }
  },
  duotone_red_lime: {
    name: 'Red/Lime Dual',
    colors: {
      primary: '#ff3b5c',
      secondary: '#84cc16',
      accent: '#84cc16',
      background: '#0a0500',
      surface: '#1a0f0a',
      surfaceHover: '#250f0f',
      text: '#ff3b5c',
      textDim: '#65a30d',
      border: '#cc2e49',
      shadow: 'rgba(255, 59, 92, 0.3)'
    }
  },
  duotone_amber_blue: {
    name: 'Amber/Blue Dual',
    colors: {
      primary: '#ffb000',
      secondary: '#00bfff',
      accent: '#00bfff',
      background: '#050508',
      surface: '#1a1418',
      surfaceHover: '#251f25',
      text: '#ffb000',
      textDim: '#0088cc',
      border: '#cc8800',
      shadow: 'rgba(255, 176, 0, 0.3)'
    }
  }
}

interface ThemeContextValue {
  currentTheme: Theme
  themeName: string
  setTheme: (name: keyof typeof themes) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<string>(() => {
    return getCachedDesktop()?.theme || 'green'
  })

  const currentTheme = themes[themeName] || themes.green

  useEffect(() => {
  // Persist theme selection to server state
  saveDesktopState({ theme: themeName }).catch(() => {})
    
    // Apply CSS variables
    const root = document.documentElement
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(`--color-${key}`, value)
      }
    })
    
    // Set defaults for optional properties
    if (!currentTheme.colors.accent) {
      root.style.setProperty('--color-accent', currentTheme.colors.secondary)
    }
    if (!currentTheme.colors.surfaceHover) {
      root.style.setProperty('--color-surfaceHover', currentTheme.colors.surface)
    }
    
    // Extract RGB values from primary color for gradients
    const primaryRgb = currentTheme.colors.primary.match(/\w\w/g)?.map(x => parseInt(x, 16)).join(', ') || '0, 217, 146'
    root.style.setProperty('--color-primary-rgb', primaryRgb)
    
    // Extract RGB values from secondary color for dual-tone effects
    const secondaryRgb = currentTheme.colors.secondary.match(/\w\w/g)?.map(x => parseInt(x, 16)).join(', ') || '0, 163, 114'
    root.style.setProperty('--color-secondary-rgb', secondaryRgb)
  }, [themeName, currentTheme])

  const setTheme = (name: keyof typeof themes) => {
    setThemeName(name)
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
