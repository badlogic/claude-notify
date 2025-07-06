import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { type Socket, createConnection } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { log } from './logger'

const SOCKET_PATH = join(homedir(), '.claude-notify', 'notifications.sock')
const DAEMON_PATH = join(
  __dirname,
  '..',
  'dist',
  'ClaudeNotifyDaemon.app',
  'Contents',
  'MacOS',
  'ClaudeNotifyDaemon',
)

export interface DaemonMessage {
  type: string
  hookType: string
  sessionId: string
  pid: number
  cwd: string
  message: string
  timestamp: number
}

export class DaemonClient {
  private socket: Socket | null = null

  constructor() {
    process.on('exit', () => {
      if (this.socket) {
        this.socket.end()
        this.socket = null
      }
    })
  }

  async sendMessage(message: DaemonMessage): Promise<void> {
    // Start daemon if needed
    await this.ensureDaemonRunning()

    // Connect to socket
    await this.connect()

    // Send message
    const jsonMessage = `${JSON.stringify(message)}\n`
    return new Promise((resolve) => {
      if (!this.socket) {
        const error = new Error('Socket not connected')
        log('Error:', error)
        console.error('Error:', error)
        process.exit(1)
      }

      this.socket.write(jsonMessage, (err) => {
        if (err) {
          log('Failed to send message:', err)
          console.error('Failed to send message:', err)
          process.exit(1)
        } else {
          resolve()
        }
      })
    })
  }

  private async ensureDaemonRunning(): Promise<void> {
    // Check if daemon is already running using ps
    const isDaemonRunning = await this.checkDaemonProcess()

    if (isDaemonRunning) {
      return
    }

    // Daemon not running, start it
    await this.startDaemon()
  }

  private async checkDaemonProcess(): Promise<boolean> {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['aux'])
      let output = ''

      ps.stdout?.on('data', (data: Buffer) => {
        output += data.toString()
      })

      ps.on('close', () => {
        const isRunning = output.includes('ClaudeNotifyDaemon')
        resolve(isRunning)
      })

      ps.on('error', () => {
        // If ps fails, assume daemon is not running
        resolve(false)
      })
    })
  }

  private async startDaemon(): Promise<void> {
    log('Starting daemon...')

    // Check if daemon executable exists
    if (!existsSync(DAEMON_PATH)) {
      const error = new Error(
        `Daemon executable not found at ${DAEMON_PATH}. Run 'npm run build' first.`,
      )
      log('Error:', error)
      console.error('Error:', error)
      process.exit(1)
    }

    // Spawn daemon process
    const daemon = spawn(DAEMON_PATH, [], {
      detached: true,
      stdio: 'ignore',
    })

    daemon.unref()
    log('Daemon started with PID:', daemon.pid)

    // Give daemon time to start up
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  private async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.socket = createConnection(SOCKET_PATH, () => {
        resolve()
      })

      this.socket.on('error', (error) => {
        log('Socket connection error:', error)
        console.error('Failed to connect to daemon:', error)
        process.exit(1)
      })

      this.socket.on('close', () => {
        log('Connection to daemon closed')
        this.socket = null
      })
    })
  }
}
