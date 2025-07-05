import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

interface HookConfig {
  matcher: string
  hooks: Array<{
    type: string
    command: string
  }>
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookConfig[]
    PostToolUse?: HookConfig[]
    Stop?: HookConfig[]
    SubagentStop?: HookConfig[]
    Notification?: HookConfig[]
  }
}

const HOOK_TYPES = ['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop', 'Notification'] as const
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

function readSettings(): ClaudeSettings {
  let settings: ClaudeSettings = {}
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      const content = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8')
      settings = JSON.parse(content)
    } catch (error) {
      console.error(`Error reading settings file: ${error}`)
      process.exit(1)
    }
  }
  return settings
}

export function installAllHooks(): void {
  uninstallAllHooks(false)
  const settings = readSettings()
  if (!settings.hooks) {
    settings.hooks = {}
  }

  for (const hookType of HOOK_TYPES) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = []
    }

    const command = settings.hooks[hookType]!.push({
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: `claude-notify ${hookType}`,
        },
      ],
    })
  }

  try {
    writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2))
    console.log('✓ Successfully installed claude-notify hooks')
    console.log(`  Settings file: ${CLAUDE_SETTINGS_PATH}`)
  } catch (error) {
    console.error(`Error writing settings file: ${error}`)
    process.exit(1)
  }
}

export function uninstallAllHooks(log = true) {
  const settings = readSettings()
  for (const hookType of HOOK_TYPES) {
    if (!settings.hooks || !settings.hooks[hookType]) {
      continue
    }

    settings.hooks[hookType] = settings.hooks[hookType]!.filter(
      (hookConfig) =>
        !hookConfig.hooks.some(
          (hook) => hook.type === 'command' && hook.command.startsWith('claude-notify '),
        ),
    )
  }

  try {
    writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2))
    if (log) {
      console.log('✓ Successfully uninstalled claude-notify hooks')
      console.log(`  Settings file: ${CLAUDE_SETTINGS_PATH}`)
    }
  } catch (error) {
    console.error(`Error writing settings file: ${error}`)
    process.exit(1)
  }
}
