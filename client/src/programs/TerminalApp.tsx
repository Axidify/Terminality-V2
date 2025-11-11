import React, { useEffect, useRef, useState } from 'react'

// useWindowManager intentionally not used in TerminalApp
import { fs } from './FileSystem'
import './TerminalApp.css'
import { ContextMenuPortal } from '../os/components/ContextMenuPortal'
import { CopyIcon, PasteIcon, ClearIcon, InfoIcon } from '../os/components/Icons'
import { useContextMenuPosition } from '../os/hooks/useContextMenuPosition'
import { apiRequest } from '../services/api'

// Use centralized API client for auth and error handling

type Line = { role: 'system' | 'user'; text: string }

export const TerminalApp: React.FC = () => {
  // Keep useWindowManager import commented out for potential future use
  const [lines, setLines] = useState<Line[]>([
    { role: 'system', text: 'Terminal ready. Type help.' }
  ])
  const [cwd, setCwd] = useState('/home/player')
  const [buffer, setBuffer] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { ref: menuRef, pos: menuPos } = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (contextMenu) {
      const handler = () => setContextMenu(null)
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [contextMenu])

  const print = (role: Line['role'], text: string) => setLines(l => [...l, { role, text }])

  const help = `Commands: help, ls, cat <file>, edit <file>, touch <file>, mkdir <dir>, rm <path>, cd <dir>, api <command>
Discovery: find <path>, grep <pattern> <file>, file <path>, strings <file>, ps, netstat`

  const resolve = (p: string) => {
    if (!p.startsWith('/')) p = (cwd.replace(/\/$/, '')) + '/' + p
    // collapse .. and .
    const parts = [] as string[]
    for (const part of p.split('/')) {
      if (!part || part === '.') continue
      if (part === '..') parts.pop(); else parts.push(part)
    }
    return '/' + parts.join('/')
  }

  const handleLocal = async (cmd: string) => {
    const [name, ...rest] = cmd.split(/\s+/)
    const arg = rest.join(' ')
    switch (name) {
      case 'help': print('system', help); break
      case 'ls': {
        fs.ensurePath(cwd + '/dummy') // ensure path except file part
        const list = fs.list(cwd)
        print('system', list.map(n => n.type === 'dir' ? n.name + '/' : n.name).join('  '));
        break
      }
      case 'cd': {
        if (!arg) return print('system', 'cd: missing path')
        const target = resolve(arg)
        const dir = fs.list(target) // list returns [] if not dir or missing
        if (dir.length || target === '/' || fs.exists(target)) {
          setCwd(target)
        } else print('system', 'cd: no such directory')
        break
      }
      case 'cat': {
        if (!arg) return print('system', 'cat: file required')
        const file = fs.read(resolve(arg))
        if (!file) return print('system', 'cat: not a file')
        print('system', file.content || '(empty)')
        break
      }
      case 'edit': {
        if (!arg) return print('system', 'edit: file required')
        const path = resolve(arg)
        if (!fs.exists(path)) fs.touch(path)
        const file = fs.read(path)!
        const newContent = prompt(`Edit ${path}`, file.content)
        if (newContent !== null) { fs.write(path, newContent); print('system', 'saved.') }
        break
      }
      case 'touch': if (arg) { fs.touch(resolve(arg)); print('system', 'ok') } else print('system', 'touch: file required'); break
      case 'mkdir': if (arg) { fs.mkdir(resolve(arg)); print('system', 'ok') } else print('system', 'mkdir: dir required'); break
      case 'rm': if (arg) { fs.remove(resolve(arg)); print('system', 'ok') } else print('system', 'rm: path required'); break
      case 'api': {
        const command = arg
        if (!command) return print('system', 'api: command required')
        try {
          const data = await apiRequest<{ output: string }>(
            '/api/command',
            { method: 'POST', auth: true, body: { player_name: 'player1', session_id: null, command } }
          )
          print('system', data.output)
        } catch (e: any) {
          print('system', `api error: ${e?.message || 'unknown'}`)
        }
        break
      }
      case 'find': {
        const searchPath = arg || cwd
        const results: string[] = []
        const search = (path: string) => {
          try {
            const items = fs.list(path)
            items.forEach(item => {
              results.push(item.path)
              if (item.type === 'dir') search(item.path)
            })
          } catch { /* ignore: permission or path errors */ }
        }
        search(resolve(searchPath))
        if (results.length === 0) {
          print('system', 'find: no files found')
        } else {
          print('system', results.slice(0, 50).join('\n') + (results.length > 50 ? `\n... (${results.length - 50} more)` : ''))
        }
        break
      }
      case 'grep': {
        const parts = rest
        if (parts.length < 2) return print('system', 'grep: usage: grep <pattern> <file>')
        const pattern = parts[0]
        const filePath = resolve(parts[1])
        const file = fs.read(filePath)
        if (!file) return print('system', 'grep: file not found')
        const lines = file.content.split('\n')
        const matches = lines.filter(line => line.toLowerCase().includes(pattern.toLowerCase()))
        if (matches.length === 0) {
          print('system', 'grep: no matches found')
        } else {
          print('system', matches.join('\n'))
        }
        break
      }
      case 'file': {
        if (!arg) return print('system', 'file: path required')
        const path = resolve(arg)
        const file = fs.read(path)
        if (!file) {
          const dir = fs.list(path)
          if (dir.length > 0 || path === '/') {
            print('system', `${path}: directory`)
          } else {
            print('system', 'file: not found')
          }
        } else {
          const hasScript = file.content.includes('#!/')
          const hasBinary = file.content.includes('\x00') || file.name.endsWith('.bin')
          const type = hasScript ? 'executable script' : hasBinary ? 'binary data' : 'text file'
          print('system', `${path}: ${type}`)
        }
        break
      }
      case 'strings': {
        if (!arg) return print('system', 'strings: file required')
        const file = fs.read(resolve(arg))
        if (!file) return print('system', 'strings: file not found')
        const strings = file.content.split(/[\n\r]+/).filter(s => s.length >= 4)
        print('system', strings.join('\n'))
        break
      }
      case 'ps': {
        const processes = [
          'PID  USER     COMMAND',
          '1    root     /sbin/init',
          '42   root     /usr/sbin/sshd',
          '103  player   /bin/bash',
          '234  player   terminal',
          '421  root     /usr/bin/netmon',
          '422  root     /usr/sbin/firewalld',
          '500  ???      /usr/bin/.hidden_proc'
        ]
        print('system', processes.join('\n'))
        break
      }
      case 'netstat': {
        const connections = [
          'Active Internet connections',
          'Proto Local Address      Foreign Address    State',
          'tcp   127.0.0.1:8000     0.0.0.0:*          LISTEN',
          'tcp   0.0.0.0:22         0.0.0.0:*          LISTEN',
          'tcp   192.168.1.100:45234 192.168.1.1:80    ESTABLISHED',
          'tcp   192.168.1.100:52891 192.168.1.254:??? SYN_SENT',
          'udp   0.0.0.0:53         0.0.0.0:*          '
        ]
        print('system', connections.join('\n'))
        break
      }
      default:
        print('system', `Unknown command: ${name}`)
    }
  }

  const run = async () => {
    const cmd = buffer.trim()
    if (!cmd) return
    setBuffer('')
    
    print('user', cmd)
    await handleLocal(cmd)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCopy = async () => {
    const selected = window.getSelection()?.toString()
    if (selected) {
      await navigator.clipboard.writeText(selected)
      print('system', 'Copied to clipboard')
    }
    setContextMenu(null)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setBuffer(prev => prev + text)
      inputRef.current?.focus()
    } catch {
      print('system', 'Paste failed')
    }
    setContextMenu(null)
  }

  const handleClear = () => {
    setLines([{ role: 'system', text: 'Terminal ready. Type help.' }])
    setContextMenu(null)
  }

  return (
    <div className="terminal-container" onContextMenu={handleContextMenu}>
      <div className="terminal-output">
        {lines.map((l, i) => (
          <div key={i} className={`terminal-line ${l.role}`}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">{cwd}$</span>
        <input 
          ref={inputRef} 
          value={buffer} 
          onChange={e => setBuffer(e.target.value)} 
          onKeyDown={e => { if (e.key === 'Enter') run() }} 
          className="terminal-input"
        />
      </div>

      {contextMenu && (
        <ContextMenuPortal>
          <div
            ref={menuRef}
            className="terminal-context-menu"
            style={{
              position: 'fixed',
              left: menuPos.left,
              top: menuPos.top,
              zIndex: 10001
            }}
          >
            <div className="terminal-context-item" onClick={handleCopy}><CopyIcon size={14}/> Copy</div>
            <div className="terminal-context-item" onClick={handlePaste}><PasteIcon size={14}/> Paste</div>
            <div className="terminal-context-divider" />
            <div className="terminal-context-item" onClick={handleClear}><ClearIcon size={14}/> Clear Terminal</div>
            <div className="terminal-context-divider" />
            <div className="terminal-context-item" onClick={() => { alert('Terminality Terminal v1.0\nSecure command-line interface'); setContextMenu(null) }}><InfoIcon size={14}/> About</div>
          </div>
        </ContextMenuPortal>
      )}
    </div>
  )
}
