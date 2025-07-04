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

export function getClaudeProcessInfo(): { pid: number; tty: string } | null {
  try {
    // Get the parent process ID (Claude Code)
    const ppid = process.ppid

    // Get process info using ps
    const psOutput = execSync(`ps -p ${ppid} -o pid=,tty=`, { encoding: 'utf-8' })
    const [pid, tty] = psOutput.trim().split(/\s+/)

    if (pid && tty && tty !== '??') {
      return { pid: Number.parseInt(pid), tty }
    }

    // Fallback: search for Claude process
    const claudeProcesses = execSync('ps aux | grep -i "claude" | grep -v grep', {
      encoding: 'utf-8',
    })
    const lines = claudeProcesses.trim().split('\n')

    for (const line of lines) {
      const parts = line.split(/\s+/)
      const pid = Number.parseInt(parts[1])
      const tty = parts[6]

      if (tty && tty !== '??' && tty.startsWith('s')) {
        return { pid, tty }
      }
    }

    return null
  } catch (error) {
    log('Error getting Claude process info:', error)
    return null
  }
}

export function saveSession(sessionId: string, cwd: string): void {
  const processInfo = getClaudeProcessInfo()
  if (!processInfo) {
    log('Could not get Claude process info')
    return
  }

  const sessions = loadSessions()
  sessions[sessionId] = {
    sessionId,
    pid: processInfo.pid,
    tty: processInfo.tty,
    cwd,
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
  log(`Saved session ${sessionId} with TTY ${processInfo.tty}`)
}

export function getSession(sessionId: string): SessionInfo | null {
  const sessions = loadSessions()
  return sessions[sessionId] || null
}
