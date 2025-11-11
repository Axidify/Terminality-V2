// Simple in-memory file system now persisted via server state (no direct localStorage writes)
export interface FSNodeBase { name: string; path: string; parent: string | null }
export interface FSFile extends FSNodeBase { type: 'file'; content: string }
export interface FSDir extends FSNodeBase { type: 'dir'; children: string[] }
export type FSNode = FSFile | FSDir

export interface FileSystemAPI {
  list: (path: string) => FSNode[]
  read: (path: string) => FSFile | null
  write: (path: string, content: string) => void
  mkdir: (path: string) => void
  touch: (path: string) => void
  remove: (path: string) => void
  move: (from: string, to: string) => void
  exists: (path: string) => boolean
  ensurePath: (path: string) => void
  countFilesByExt: (ext: string, basePath?: string) => number
}

// Legacy storage key retained for fallback only
const STORAGE_KEY = 'terminality.fs'
import { hydrateFromServer, saveDesktopState, getCachedDesktop } from '../services/saveService'

interface Snapshot { nodes: Record<string, FSNode> }

function initialFS(): Snapshot {
  const root: FSDir = { type: 'dir', name: '', path: '/', parent: null, children: [] }
  const home: FSDir = { type: 'dir', name: 'home', path: '/home', parent: '/', children: [] }
  const usr: FSDir = { type: 'dir', name: 'usr', path: '/usr', parent: '/', children: [] }
  const bin: FSDir = { type: 'dir', name: 'bin', path: '/usr/bin', parent: '/usr', children: [] }
  const var_: FSDir = { type: 'dir', name: 'var', path: '/var', parent: '/', children: [] }
  const log: FSDir = { type: 'dir', name: 'log', path: '/var/log', parent: '/var', children: [] }
  const etc: FSDir = { type: 'dir', name: 'etc', path: '/etc', parent: '/', children: [] }
  
  const player: FSDir = { type: 'dir', name: 'player', path: '/home/player', parent: '/home', children: [] }
  const notes: FSFile = { type: 'file', name: 'notes.txt', path: '/home/player/notes.txt', parent: '/home/player', content: 'Welcome to Terminality OS.\nYou can edit this file.' }
  
  // Hidden files and system files
  const syslog: FSFile = { type: 'file', name: 'system.log', path: '/var/log/system.log', parent: '/var/log', content: '[2025-11-10 08:23:15] System initialized\n[2025-11-10 08:23:16] Network interface up\n[2025-11-10 08:23:18] Unknown connection attempt from 192.168.1.254\n[2025-11-10 08:23:19] Connection blocked by firewall' }
  const authlog: FSFile = { type: 'file', name: 'auth.log', path: '/var/log/auth.log', parent: '/var/log', content: '[2025-11-10 08:20:01] Login attempt: user=admin FAILED\n[2025-11-10 08:20:15] Login attempt: user=admin FAILED\n[2025-11-10 08:20:32] Login attempt: user=root FAILED\n[2025-11-10 08:23:10] Login: user=player SUCCESS' }
  const netlog: FSFile = { type: 'file', name: '.nethistory', path: '/var/log/.nethistory', parent: '/var/log', content: 'PING 192.168.1.1 - SUCCESS\nPING 192.168.1.254 - TIMEOUT\nSCAN 192.168.1.0/24 - 3 hosts found\nCONNECT 192.168.1.254:22 - REFUSED' }
  
  const scanner: FSFile = { type: 'file', name: 'netscan', path: '/usr/bin/netscan', parent: '/usr/bin', content: '#!/bin/bash\n# Network Scanner v2.1\necho "Scanning network..."\necho "Found: 192.168.1.1 (Router)"\necho "Found: 192.168.1.100 (Unknown)"\necho "Found: 192.168.1.254 (???)"' }
  const decrypt: FSFile = { type: 'file', name: 'decrypt', path: '/usr/bin/decrypt', parent: '/usr/bin', content: '#!/bin/bash\n# File Decryption Tool\nif [ -z "$1" ]; then\n  echo "Usage: decrypt <file>"\nelse\n  echo "Decrypting $1..."\n  echo "[████████████] 100%"\n  echo "Decryption complete"\nfi' }
  
  const hosts: FSFile = { type: 'file', name: 'hosts', path: '/etc/hosts', parent: '/etc', content: '127.0.0.1 localhost\n192.168.1.1 gateway\n192.168.1.254 mystery.local\n10.0.0.1 secure-server.net' }
  const passwd: FSFile = { type: 'file', name: 'passwd', path: '/etc/passwd', parent: '/etc', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:Player:/home/player:/bin/bash\nadmin:x:1001:1001:Admin:/home/admin:/bin/bash\nguest:x:1002:1002:Guest:/home/guest:/bin/nologin' }
  const secret: FSFile = { type: 'file', name: '.secret', path: '/etc/.secret', parent: '/etc', content: 'ACCESS_CODE=ALPHA-7829\nSERVER_KEY=mystery.local:2222\nDECRYPT_PASS=hidden' }
  
  // Build tree
  home.children.push(player.path)
  player.children.push(notes.path)
  usr.children.push(bin.path)
  bin.children.push(scanner.path, decrypt.path)
  var_.children.push(log.path)
  log.children.push(syslog.path, authlog.path, netlog.path)
  etc.children.push(hosts.path, passwd.path, secret.path)
  
  root.children.push(home.path, usr.path, var_.path, etc.path)
  
  return { 
    nodes: { 
      [root.path]: root, 
      [home.path]: home, 
      [usr.path]: usr,
      [bin.path]: bin,
      [var_.path]: var_,
      [log.path]: log,
      [etc.path]: etc,
      [player.path]: player, 
      [notes.path]: notes,
      [syslog.path]: syslog,
      [authlog.path]: authlog,
      [netlog.path]: netlog,
      [scanner.path]: scanner,
      [decrypt.path]: decrypt,
      [hosts.path]: hosts,
      [passwd.path]: passwd,
      [secret.path]: secret
    } 
  }
}

function loadSnapshot(): Snapshot {
  // Prefer server cached desktop.fs
  const cached = getCachedDesktop()
  if (cached?.fs?.nodes) {
    try {
      return { nodes: cached.fs.nodes as Record<string, FSNode> }
    } catch { /* fall back */ }
  }
  // Fallback to legacy localStorage (one-time migration) then push to server
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.nodes) {
        // schedule migration
        saveDesktopState({ fs: { nodes: parsed.nodes } }).catch(() => {})
        return parsed
      }
    }
  } catch { /* ignore: operation failed */ }
  return initialFS()
}

function saveSnapshotDebouncedFactory() {
  let handle: number | undefined
  return (s: Snapshot) => {
    if (handle) window.clearTimeout(handle)
    handle = window.setTimeout(() => {
      saveDesktopState({ fs: { nodes: s.nodes } }).catch(() => {})
    }, 250)
  }
}
const saveSnapshot = saveSnapshotDebouncedFactory()

export function createFileSystem(): FileSystemAPI {
  let snap = loadSnapshot()
  // Hydrate from server async; replace snapshot if valid
  hydrateFromServer().then(s => {
    const nodes = s.desktop?.fs?.nodes
    if (nodes && nodes['/']) {
  try { snap = { nodes: nodes as Record<string, FSNode> } } catch { /* ignore */ }
    }
  }).catch(() => {})

  const list = (path: string): FSNode[] => {
    const node = snap.nodes[path]
    if (!node || node.type !== 'dir') return []
    return node.children.map(p => snap.nodes[p]).filter(Boolean)
  }

  const read = (path: string): FSFile | null => {
    const n = snap.nodes[path]
    return n && n.type === 'file' ? n : null
  }

  const write = (path: string, content: string) => {
    const n = snap.nodes[path]
    if (!n || n.type !== 'file') throw new Error('Not a file')
    n.content = content
  saveSnapshot(snap)
  }

  const mkdir = (path: string) => {
    if (snap.nodes[path]) return
    const parentPath = path.split('/').slice(0, -1).join('/') || '/'
    const name = path.split('/').pop() || ''
    const parent = snap.nodes[parentPath]
    if (!parent || parent.type !== 'dir') throw new Error('Parent not dir')
    // Enforce nesting limit under /home: prevent creating folders deeper than 1 level under /home
    if (path.startsWith('/home')) {
      const parts = path.split('/').filter(Boolean)
      // parts example: ['home','player','newfolder',...]
      if (parts.length > 3) throw new Error('Folder nesting limit exceeded')
    }
    const dir: FSDir = { type: 'dir', name, path, parent: parentPath, children: [] }
    parent.children.push(path)
    snap.nodes[path] = dir
  saveSnapshot(snap)
  }

  const touch = (path: string) => {
    if (snap.nodes[path]) return
    const parentPath = path.split('/').slice(0, -1).join('/') || '/'
    const name = path.split('/').pop() || ''
    const parent = snap.nodes[parentPath]
    if (!parent || parent.type !== 'dir') throw new Error('Parent not dir')
    const file: FSFile = { type: 'file', name, path, parent: parentPath, content: '' }
    parent.children.push(path)
    snap.nodes[path] = file
  saveSnapshot(snap)
  }

  const countFilesByExt = (ext: string, basePath?: string) => {
    const nodes = Object.values(snap.nodes)
    return nodes.filter(n => n.type === 'file' && n.name.endsWith(ext) && (!basePath || n.path.startsWith(basePath))).length
  }

  const remove = (path: string) => {
    const n = snap.nodes[path]
    if (!n) return
    if (n.type === 'dir') {
      // recursive remove
      [...n.children].forEach(child => remove(child))
    }
    const parent = n.parent ? snap.nodes[n.parent] : null
    if (parent && parent.type === 'dir') parent.children = parent.children.filter(c => c !== path)
    delete snap.nodes[path]
  saveSnapshot(snap)
  }

  const move = (from: string, to: string) => {
    const node = snap.nodes[from]
    if (!node) throw new Error('Source does not exist')
    if (snap.nodes[to]) throw new Error('Destination already exists')
    
    const newParentPath = to.split('/').slice(0, -1).join('/') || '/'
    const newName = to.split('/').pop() || ''
    const newParent = snap.nodes[newParentPath]
    if (!newParent || newParent.type !== 'dir') throw new Error('Destination parent not a directory')
    
    // Remove from old parent
    const oldParent = node.parent ? snap.nodes[node.parent] : null
    if (oldParent && oldParent.type === 'dir') {
      oldParent.children = oldParent.children.filter(c => c !== from)
    }
    
    // Update node
    node.name = newName
    node.path = to
    node.parent = newParentPath
    
    // Add to new parent
    newParent.children.push(to)
    
    // Update in nodes map
    delete snap.nodes[from]
    snap.nodes[to] = node
    
    // If it's a directory, recursively update all children paths
    if (node.type === 'dir') {
      const updateChildPaths = (dir: FSDir, oldBasePath: string, newBasePath: string) => {
        dir.children.forEach(childPath => {
          const child = snap.nodes[childPath]
          if (child) {
            const newChildPath = childPath.replace(oldBasePath, newBasePath)
            child.path = newChildPath
            child.parent = newBasePath
            delete snap.nodes[childPath]
            snap.nodes[newChildPath] = child
            
            if (child.type === 'dir') {
              updateChildPaths(child, childPath, newChildPath)
            }
          }
        })
        // Update children array with new paths
        dir.children = dir.children.map(c => c.replace(oldBasePath, newBasePath))
      }
      updateChildPaths(node, from, to)
    }
    
  saveSnapshot(snap)
  }

  const exists = (path: string) => !!snap.nodes[path]

  const ensurePath = (path: string) => {
    const parts = path.split('/').filter(Boolean)
    let cur = ''
    for (const part of parts.slice(0, -1)) {
      cur += '/' + part
      if (!exists(cur)) mkdir(cur)
    }
  }

  return { list, read, write, mkdir, touch, remove, move, exists, ensurePath, countFilesByExt }
  // Note: countFilesByExt added below for TS compatibility
}

export const fs = createFileSystem()
