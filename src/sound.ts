import { exec } from 'node:child_process'
import { platform } from 'node:os'
import { promisify } from 'node:util'
import { log } from './logger'

const execAsync = promisify(exec)
const IS_MACOS = platform() === 'darwin'
const IS_LINUX = platform() === 'linux'
const IS_WINDOWS = platform() === 'win32'

export async function playSound(): Promise<void> {
  try {
    if (IS_MACOS) {
      // Play Glass sound on macOS
      await execAsync('afplay /System/Library/Sounds/Glass.aiff')
    } else if (IS_LINUX) {
      // Use system beep/bell on Linux
      await execAsync('echo -e "\\a"')
    } else if (IS_WINDOWS) {
      // Windows PowerShell beep
      await execAsync('powershell -c "[console]::beep()"')
    } else {
      log(`Sound playback not implemented for ${platform()}`)
    }
  } catch (error) {
    log(`Failed to play sound: ${error}`)
  }
}
