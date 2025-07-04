import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const logDir = join(homedir(), '.claude-notify')
const logFile = join(logDir, 'log.txt')

// Ensure log directory exists
try {
  mkdirSync(logDir, { recursive: true })
} catch (error) {
  // Ignore if already exists
}

export function log(...args: any[]): void {
  const timestamp = new Date().toISOString()
  const message = `[${timestamp}] ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')}\n`
  
  try {
    appendFileSync(logFile, message)
  } catch (error) {
    // Fail silently
  }
}