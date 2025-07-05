#!/usr/bin/env node

import { sendNotification } from './notifications'
import { installAllHooks, uninstallAllHooks } from './settings'
import { getTranscriptInfo } from './transcript'

export interface HookInput {
  session_id: string
  transcript_path: string
  stop_hook_active?: boolean
}

async function processArgs(args: string[]): Promise<void> {
  if (args.includes('-install') || args.includes('--install')) {
    installAllHooks()
    process.exit(0)
  }

  if (args.includes('-uninstall') || args.includes('--uninstall')) {
    uninstallAllHooks()
    process.exit(0)
  }

  if (args.includes('-test') || args.includes('--test')) {
    console.log('Testing claude-notify notification system...\n')
    console.log(`Platform: ${process.platform}`)

    await sendNotification('Notification', {
      cwd: process.cwd(),
      lastMessage:
        'This is a test notification.\n\nYou should see a notification in the top right corner of your screen.',
      sessionId: 'test-session',
    })

    console.log('\nTest notification sent!')
    console.log('\nFor more information, visit:')
    console.log('https://github.com/mariozechner/claude-notify')
    process.exit(0)
  }

  if (args.includes('-h') || args.includes('--help')) {
    console.log(`claude-notify - Notification handler for Claude Code hooks

Usage:
  claude-notify <hook-type>  Handle Claude Code hook (expects JSON via stdin)
  claude-notify -install     Install claude-notify hooks in Claude Code
  claude-notify -uninstall   Remove all claude-notify hooks from Claude Code
  claude-notify -test        Test notification system
  claude-notify -h, --help   Show this help message

Hook types:
  PreToolUse     Called before tool execution
  PostToolUse    Called after tool execution
  Stop           Called when Claude stops responding
  SubagentStop   Called when a subagent stops
  Notification   Called for notifications

On macOS, claude-notify runs a daemon that:
  - Shows a menu bar icon with session count
  - Displays a control center with all active sessions
  - Sends system notifications when Claude is waiting
  - Tracks session status (working/idle)

On Linux/Windows, claude-notify:
  - Shows notifications when Claude stops or sends notifications
  - Plays notification sounds`)
    process.exit(0)
  }
}

async function main() {
  const args = process.argv.slice(2)

  // Process args if any. Exits process if args are processed.
  await processArgs(args)

  try {
    const hookType = args[0]
    if (!hookType) {
      console.error('Error: Hook type must be specified as first argument')
      console.error('Run "claude-notify --help" for usage information.')
      process.exit(1)
    }

    const readStdin = (): Promise<string> => {
      return new Promise((resolve) => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
          data += chunk
        })
        process.stdin.on('end', () => {
          resolve(data)
        })
      })
    }

    const input = process.stdin.isTTY ? null : await readStdin()
    if (!input) {
      console.error('No input provided. This tool expects JSON input via stdin.')
      console.error('Run "claude-notify --help" for usage information.')
      process.exit(1)
    }

    const hookData: HookInput = JSON.parse(input)
    await sendNotification(hookType, getTranscriptInfo(hookData.transcript_path))
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
