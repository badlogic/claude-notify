import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

interface ClaudeSettings {
  hooks?: {
    Stop?: Array<{
      matcher: string
      hooks: Array<{
        type: string
        command: string
      }>
    }>
  }
}

export function installStopHook(): void {
  const settingsPath = join(homedir(), '.claude', 'settings.json')

  // Ensure settings file exists
  let settings: ClaudeSettings = {}
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8')
      settings = JSON.parse(content)
    } catch (error) {
      console.error(`Error reading settings file: ${error}`)
      process.exit(1)
    }
  }

  // Initialize hooks structure if needed
  if (!settings.hooks) {
    settings.hooks = {}
  }
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = []
  }

  // Check if claude-notify is already installed
  const existingHook = settings.hooks.Stop.find((stopHook) =>
    stopHook.hooks.some((hook) => hook.type === 'command' && hook.command === 'claude-notify'),
  )

  if (existingHook) {
    console.log('✓ claude-notify is already installed as a Stop hook')
    return
  }

  // Add claude-notify hook
  settings.hooks.Stop.push({
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: 'claude-notify',
      },
    ],
  })

  // Write settings back
  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    console.log('✓ Successfully installed claude-notify as a Stop hook')
    console.log(`  Settings file: ${settingsPath}`)
  } catch (error) {
    console.error(`Error writing settings file: ${error}`)
    process.exit(1)
  }
}
