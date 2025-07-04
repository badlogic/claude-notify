import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { IS_LINUX, IS_MACOS, IS_WINDOWS, getPlatformName } from './platform'
import { log } from './logger'

const execAsync = promisify(exec)

export async function playSound(soundPath?: string): Promise<void> {
  try {
    if (IS_MACOS) {
      const defaultSound = '/System/Library/Sounds/Glass.aiff'
      const sound = soundPath && existsSync(soundPath) ? soundPath : defaultSound
      await execAsync(`afplay "${sound}"`)
    } else if (IS_LINUX) {
      // Try common Linux sound players
      if (soundPath && existsSync(soundPath)) {
        try {
          // Try paplay (PulseAudio)
          await execAsync(`paplay "${soundPath}"`)
        } catch {
          try {
            // Try aplay (ALSA)
            await execAsync(`aplay "${soundPath}"`)
          } catch {
            // Try play (SoX)
            await execAsync(`play "${soundPath}"`)
          }
        }
      } else {
        // Use system beep/bell
        await execAsync('echo -e "\\a"')
      }
    } else if (IS_WINDOWS) {
      // Windows PowerShell beep
      await execAsync('powershell -c "[console]::beep()"')
    } else {
      log(`Sound playback not implemented for ${getPlatformName()}`)
    }
  } catch (error) {
    log(`Failed to play sound: ${error}`)
  }
}
