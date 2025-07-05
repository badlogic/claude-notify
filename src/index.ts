import { readFileSync } from 'node:fs'
import notifier from 'node-notifier'
import { log } from './logger'
import { playSound } from './sound'
import type { HookInput, TranscriptEntry } from './types'

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

export async function handleStopHook(input: HookInput): Promise<void> {
  try {
    const entries = parseTranscript(input.transcript_path)
    const lastMessage = getLastAssistantMessage(entries)
    const cwd = getCurrentWorkingDirectory(entries)

    if (!lastMessage) {
      log('No assistant message found. Last assistant entry:', lastMessage)
      return
    }

    const displayCwd = cwd ? cwd.replace(process.env.HOME || '', '~') : 'Unknown'

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        notifier.notify(
          {
            title: 'Claude Code',
            message: `${displayCwd}\n\n${lastMessage}`,
            sound: false, // We'll play our own sound separately
            wait: true,
          },
          (err) => {
            if (err) reject(err)
            else resolve()
          },
        )
      }),
      playSound(),
    ])
  } catch (error) {
    log('Error in handleStopHook:', error)
    throw error
  }
}
