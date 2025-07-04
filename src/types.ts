export interface HookInput {
  session_id: string
  transcript_path: string
  stop_hook_active?: boolean
}

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

export interface NotificationOptions {
  title: string
  message: string
  sound?: string
  timeout?: number
  wait?: boolean
}
