import { readFileSync } from 'node:fs'
import notifier from 'node-notifier'
import { log } from './logger'
import { getSession, saveSession } from './sessions'
import { playSound } from './sound'
import type { HookInput, NotificationOptions, TranscriptEntry } from './types'
import { focusTerminalWindow } from './window-focus'

export function parseTranscript(transcriptPath: string): TranscriptEntry[] {
  try {
    const content = readFileSync(transcriptPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.map((line) => JSON.parse(line))
  } catch (error) {
    console.error(`Failed to parse transcript: ${error}`)
    return []
  }
}

export function getLastAssistantMessage(entries: TranscriptEntry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry.type === 'assistant' && entry.message?.content) {
      const content = entry.message.content
      if (typeof content === 'string') {
        return content
      }
      if (Array.isArray(content)) {
        const textContent = content.find((c) => c.type === 'text' && c.text)
        return textContent?.text || null
      }
    }
  }
  return null
}

export function getCurrentWorkingDirectory(entries: TranscriptEntry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].cwd) {
      return entries[i].cwd
    }
  }
  return null
}

export function sendNotification(options: NotificationOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    notifier.notify(
      {
        title: options.title,
        message: options.message,
        sound: options.sound || 'Glass',
        timeout: options.timeout !== undefined ? options.timeout : false, // Disable auto-dismiss by default
        wait: options.wait !== undefined ? options.wait : true, // Keep notification until clicked by default
      },
      (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      },
    )
  })
}

export async function handleStopHook(
  input: HookInput,
  options?: { soundPath?: string },
): Promise<void> {
  try {
    log('=== Claude Notify Hook Triggered ===')
    log('Input:', input)

    const entries = parseTranscript(input.transcript_path)

    log(`Parsed ${entries.length} entries from transcript`)
    log(
      'Last 3 entry types:',
      entries.slice(-3).map((e) => e.type),
    )

    const lastMessage = getLastAssistantMessage(entries)
    const cwd = getCurrentWorkingDirectory(entries)

    if (!lastMessage) {
      // Show what we found to help debug
      const lastAssistant = entries
        .slice()
        .reverse()
        .find((e) => e.type === 'assistant')
      log('No assistant message found. Last assistant entry:', lastAssistant)
      return
    }

    log('Found message:', lastMessage)
    log('CWD:', cwd)

    // Save session info for window focus
    if (cwd) {
      saveSession(input.session_id, cwd)
    }

    const truncatedMessage =
      lastMessage.length > 200 ? `${lastMessage.slice(0, 197)}...` : lastMessage
    const displayCwd = cwd ? cwd.replace(process.env.HOME || '', '~') : 'Unknown'

    // Create a promise that resolves when notification is interacted with
    const notificationPromise = new Promise<void>((resolve) => {
      // Remove any existing listeners to prevent duplicates
      notifier.removeAllListeners('click')
      notifier.removeAllListeners('timeout')
      
      // Set up click handler
      notifier.once('click', (notifierObject, options, event) => {
        log('Notification clicked, attempting to focus window')
        const sessionInfo = getSession(input.session_id)

        if (sessionInfo) {
          log(`Found session info: TTY=${sessionInfo.tty}, CWD=${sessionInfo.cwd}`)
          const focused = focusTerminalWindow(sessionInfo.tty, sessionInfo.cwd)
          if (focused) {
            log('Successfully focused terminal window')
          } else {
            log('Failed to focus terminal window')
          }
        } else {
          log('No session info found for focus')
        }
        resolve()
      })
      
      // Also handle timeout
      notifier.once('timeout', () => {
        log('Notification timed out')
        resolve()
      })
    })

    await Promise.all([
      sendNotification({
        title: 'Claude Code',
        message: `${displayCwd}\n\n${truncatedMessage}`,
        sound: 'Glass', // We'll play our own sound separately
        wait: true, // This is crucial for click events
      }),
      playSound(options?.soundPath),
    ])

    log('Notification sent successfully')
  } catch (error) {
    log('Error in handleStopHook:', error)
    throw error
  }
}
export * from './sessions'
export * from './window-focus'
