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
  message: string
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

export function getTranscriptInfo(
  transcriptPath: string,
  hookType?: string,
  hookData?: Record<string, unknown>,
): TranscriptInfo {
  const entries = parseTranscript(transcriptPath)

  let message = 'No message'

  // Generate contextual messages for PreToolUse and PostToolUse hooks
  if (hookType === 'PreToolUse' && hookData?.tool_name) {
    const toolName = hookData.tool_name as string
    const toolInput = hookData.tool_input || {}
    const inputStr = JSON.stringify(toolInput)
    message = `${toolName}: ${inputStr}`
  } else if (hookType === 'PostToolUse' && hookData?.tool_name) {
    const toolName = hookData.tool_name as string
    const toolInput = hookData.tool_input || {}
    const inputStr = JSON.stringify(toolInput)
    const toolResponse = hookData.tool_response as Record<string, unknown> | undefined
    const success =
      toolResponse?.success !== undefined
        ? toolResponse.success
          ? 'success'
          : 'failure'
        : 'completed'
    message = `${toolName}: ${inputStr} - ${success}`
  } else if (hookType === 'Notification' && hookData?.message) {
    // Use the notification message if available
    message = hookData.message as string
  } else {
    // Fall back to transcript parsing for other hooks
    message = getLastAssistantMessage(entries) || 'No message'
  }

  return {
    cwd: getCurrentWorkingDirectory(entries) || process.cwd(),
    message,
    sessionId: entries[entries.length - 1].sessionId,
  }
}
