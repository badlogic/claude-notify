#!/usr/bin/env node

import { handleStopHook } from './index'
import { installStopHook } from './settings'
import type { HookInput } from './types'

async function main() {
  const args = process.argv.slice(2)

  // Handle -install flag
  if (args.includes('-install') || args.includes('--install')) {
    installStopHook()
    process.exit(0)
  }

  // Handle -help flag
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`claude-notify - Notification handler for Claude Code hooks

Usage:
  claude-notify              Handle Claude Code stop hook (expects JSON via stdin)
  claude-notify -install     Install claude-notify as a Stop hook in Claude Code
  claude-notify -h, --help   Show this help message

When used as a hook, claude-notify displays:
  - The current working directory
  - The last message from Claude
  - Plays a notification sound`)
    process.exit(0)
  }

  try {
    const input = process.stdin.isTTY ? null : await readStdin()

    if (!input) {
      console.error('No input provided. This tool expects JSON input via stdin.')
      console.error('Run "claude-notify --help" for usage information.')
      process.exit(1)
    }

    const hookData: HookInput = JSON.parse(input)
    await handleStopHook(hookData)
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

function readStdin(): Promise<string> {
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

main()
