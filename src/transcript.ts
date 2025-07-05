import { readFileSync } from 'node:fs'

export interface TranscriptEntry {
  parentUuid: string | null
  isSidechain: boolean
  userType: string
  cwd: string
  sessionId: string
  version: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_response' | string
  message?: {
    role: string
    content: string | Array<{ type: string; text?: string }>
  }
  uuid: string
  timestamp: string
}

export interface TranscriptInfo {
  cwd: string
  lastMessage: string
  sessionId: string
}

function parseTranscript(transcriptPath: string): TranscriptEntry[] {
  try {
    const content = readFileSync(transcriptPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.map((line) => JSON.parse(line))
  } catch (error) {
    console.error(`Failed to parse transcript: ${error}`)
    return []
  }
}

function getLastAssistantMessage(entries: TranscriptEntry[]): string | null {
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

function getCurrentWorkingDirectory(entries: TranscriptEntry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].cwd) {
      return entries[i].cwd
    }
  }
  return null
}

export function getTranscriptInfo(transcriptPath: string): TranscriptInfo {
  const entries = parseTranscript(transcriptPath)
  return {
    cwd: getCurrentWorkingDirectory(entries) || process.cwd(),
    lastMessage: getLastAssistantMessage(entries) || 'No message',
    sessionId: entries[entries.length - 1].sessionId,
  }
}
