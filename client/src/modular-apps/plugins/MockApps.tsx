import React from 'react'

import { ModularAppManifest } from '../types'

// Simple placeholder component for mockup apps
const MockAppComponent: React.FC<{ appName?: string }> = ({ appName }) => (
  <div style={{ padding: 20 }}>
    <h2>{appName || 'App'}</h2>
    <p>This is a mockup application placeholder.</p>
  </div>
)

export const mockApps: ModularAppManifest[] = [
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Scientific calculator with advanced functions',
    version: '1.0.0',
    author: 'Terminality',
    category: 'utilities',
    rating: 4.8,
    downloads: 5200,
    featured: true,
    component: () => <MockAppComponent appName="Calculator" />
  },
  {
    id: 'todo-pro',
    name: 'Todo Pro',
    description: 'Advanced task management with reminders',
    version: '2.1.0',
    author: 'Productivity Labs',
    category: 'productivity',
    rating: 4.5,
    downloads: 3100,
    featured: true,
    component: () => <MockAppComponent appName="Todo Pro" />
  },
  {
    id: 'note-sync',
    name: 'Note Sync',
    description: 'Fast note-taking app with cloud sync',
    version: '1.5.2',
    author: 'CloudNotes Inc',
    category: 'productivity',
    rating: 4.6,
    downloads: 2800,
    component: () => <MockAppComponent appName="Note Sync" />
  },
  {
    id: 'paint-lite',
    name: 'Paint Lite',
    description: 'Simple drawing and painting tool',
    version: '1.0.0',
    author: 'Graphics Studio',
    category: 'utilities',
    rating: 4.2,
    downloads: 1900,
    component: () => <MockAppComponent appName="Paint Lite" />
  },
  {
    id: 'weather-dash',
    name: 'Weather Dash',
    description: 'Real-time weather updates and forecast',
    version: '2.0.0',
    author: 'Weather Corp',
    category: 'utilities',
    rating: 4.7,
    downloads: 4100,
    featured: true,
    component: () => <MockAppComponent appName="Weather Dash" />
  },
  {
    id: 'pixel-game',
    name: 'Pixel Runner',
    description: 'Classic retro pixel-art platformer game',
    version: '1.2.0',
    author: 'Indie Games',
    category: 'games',
    rating: 4.4,
    downloads: 2200,
    component: () => <MockAppComponent appName="Pixel Runner" />
  },
  {
    id: 'code-viewer',
    name: 'Code Viewer',
    description: 'Lightweight code editor with syntax highlight',
    version: '1.3.1',
    author: 'Dev Tools',
    category: 'utilities',
    rating: 4.9,
    downloads: 6500,
    featured: true,
    component: () => <MockAppComponent appName="Code Viewer" />
  },
  {
    id: 'timer-app',
    name: 'Timer Plus',
    description: 'Stopwatch and countdown timer',
    version: '1.0.0',
    author: 'Clock Makers',
    category: 'utilities',
    rating: 4.3,
    downloads: 1500,
    component: () => <MockAppComponent appName="Timer Plus" />
  }
]
