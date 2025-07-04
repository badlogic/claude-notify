import { readFileSync } from 'node:fs'
import notifier from 'node-notifier'
import { playSound } from './sound'
import type { HookInput, NotificationOptions, TranscriptEntry } from './types'

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
        timeout: options.timeout || 10,
        wait: options.wait || false,
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
  const entries = parseTranscript(input.transcript_path)
  const lastMessage = getLastAssistantMessage(entries)
  const cwd = getCurrentWorkingDirectory(entries)

  if (!lastMessage) {
    console.error('No assistant message found in transcript')
    return
  }

  const truncatedMessage =
    lastMessage.length > 200 ? `${lastMessage.slice(0, 197)}...` : lastMessage
  const displayCwd = cwd ? cwd.replace(process.env.HOME || '', '~') : 'Unknown'

  await Promise.all([
    sendNotification({
      title: 'Claude Code',
      message: `📁 ${displayCwd}\n\n${truncatedMessage}`,
      sound: 'Glass', // We'll play our own sound separately
    }),
    playSound(options?.soundPath),
  ])
}
