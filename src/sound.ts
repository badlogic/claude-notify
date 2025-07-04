import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export async function playSound(soundPath?: string): Promise<void> {
  const defaultSound = '/System/Library/Sounds/Glass.aiff'
  const sound = soundPath && existsSync(soundPath) ? soundPath : defaultSound

  try {
    await execAsync(`afplay "${sound}"`)
  } catch (error) {
    console.error(`Failed to play sound: ${error}`)
  }
}
