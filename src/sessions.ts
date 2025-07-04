import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { log } from './logger'

export interface SessionInfo {
  sessionId: string
  pid: number
  tty: string
  cwd: string
  app: string
  timestamp: number
}

const SESSION_FILE = join(homedir(), '.claude-notify', 'sessions.json')

function ensureSessionDir(): void {
  const dir = join(homedir(), '.claude-notify')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function loadSessions(): Record<string, SessionInfo> {
  ensureSessionDir()
  if (!existsSync(SESSION_FILE)) {
    return {}
  }
  try {
    const content = readFileSync(SESSION_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    log('Error loading sessions:', error)
    return {}
  }
}

export function saveSessions(sessions: Record<string, SessionInfo>): void {
  ensureSessionDir()
  try {
    writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2))
  } catch (error) {
    log('Error saving sessions:', error)
  }
}

export interface ProcessInfo {
  pid: number
  ppid: number
  command: string
  tty?: string
}

function getProcessInfo(pid: number): ProcessInfo | null {
  try {
    const output = execSync(`ps -p ${pid} -o pid=,ppid=,tty=,command=`, { encoding: 'utf-8' })
    const parts = output.trim().split(/\s+/)
    if (parts.length >= 4) {
      const [pidStr, ppidStr, tty, ...commandParts] = parts
      return {
        pid: Number.parseInt(pidStr),
        ppid: Number.parseInt(ppidStr),
        tty: tty !== '??' ? tty : undefined,
        command: commandParts.join(' '),
      }
    }
    return null
  } catch (error) {
    return null
  }
}

function getProcessTree(startPid: number): ProcessInfo[] {
  const tree: ProcessInfo[] = []
  let currentPid = startPid

  // Walk up the process tree
  for (let i = 0; i < 10; i++) {
    // Limit to 10 levels to prevent infinite loops
    const info = getProcessInfo(currentPid)
    if (!info || info.ppid === 1 || info.ppid === 0) break

    tree.push(info)
    currentPid = info.ppid
  }

  return tree
}

export function getTerminalProcessInfo(): { pid: number; tty: string; app: string } | null {
  try {
    // Start from current process
    const currentPid = process.pid
    log(`Starting process tree walk from PID: ${currentPid}`)

    const tree = getProcessTree(currentPid)
    log(
      'Process tree:',
      tree.map((p) => `${p.pid} (${p.ppid}) - ${p.command.substring(0, 50)}`),
    )

    // Look for terminal applications in the process tree
    for (const proc of tree) {
      const cmd = proc.command.toLowerCase()

      // Check for common terminal applications
      if (
        cmd.includes('terminal.app') ||
        cmd.includes('iterm2') ||
        cmd.includes('iterm.app') ||
        cmd.includes('alacritty') ||
        cmd.includes('kitty') ||
        cmd.includes('wezterm') ||
        cmd.includes('hyper')
      ) {
        log(`Found terminal process: PID=${proc.pid}, Command=${proc.command}`)

        // For Terminal.app, we need to find the actual window process
        if (cmd.includes('terminal.app')) {
          // Terminal.app windows are child processes of the main Terminal process
          // We'll use the TTY from a child process that has one
          const ttyProc = tree.find((p) => p.tty)
          if (ttyProc?.tty) {
            return { pid: proc.pid, tty: ttyProc.tty, app: 'Terminal' }
          }
        }

        // For other terminals, return the process info directly
        if (proc.tty) {
          let app = 'Unknown'
          if (cmd.includes('iterm')) app = 'iTerm'
          else if (cmd.includes('alacritty')) app = 'Alacritty'
          else if (cmd.includes('kitty')) app = 'kitty'
          else if (cmd.includes('wezterm')) app = 'WezTerm'
          else if (cmd.includes('hyper')) app = 'Hyper'

          return { pid: proc.pid, tty: proc.tty, app }
        }
      }
    }

    // Fallback: Look for any process with a TTY
    const ttyProc = tree.find((p) => p.tty)
    if (ttyProc?.tty) {
      log(`Using fallback TTY process: PID=${ttyProc.pid}, TTY=${ttyProc.tty}`)
      return { pid: ttyProc.pid, tty: ttyProc.tty, app: 'Unknown' }
    }

    return null
  } catch (error) {
    log('Error getting terminal process info:', error)
    return null
  }
}

export function saveSession(sessionId: string, cwd: string): void {
  const processInfo = getTerminalProcessInfo()
  if (!processInfo) {
    log('Could not get terminal process info')
    return
  }

  const sessions = loadSessions()
  sessions[sessionId] = {
    sessionId,
    pid: processInfo.pid,
    tty: processInfo.tty,
    cwd,
    app: processInfo.app,
    timestamp: Date.now(),
  }

  // Clean up old sessions (older than 24 hours)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  for (const [id, session] of Object.entries(sessions)) {
    if (session.timestamp < oneDayAgo) {
      delete sessions[id]
    }
  }

  saveSessions(sessions)
  log(
    `Saved session ${sessionId} - PID: ${processInfo.pid}, App: ${processInfo.app}, TTY: ${processInfo.tty}`,
  )
}

export function getSession(sessionId: string): SessionInfo | null {
  const sessions = loadSessions()
  return sessions[sessionId] || null
}
