import { exec } from 'node:child_process'
import { platform } from 'node:os'
import { promisify } from 'node:util'
import { log } from './logger'

export async function playSound(): Promise<void> {
  try {
    const execAsync = promisify(exec)
    if (platform() === 'darwin') {
      await execAsync('afplay /System/Library/Sounds/Glass.aiff')
    } else if (platform() === 'linux') {
      await execAsync('echo -e "\\a"')
    } else if (platform() === 'win32') {
      await execAsync('powershell -c "[console]::beep()"')
    } else {
      log(`Sound playback not implemented for ${platform()}`)
    }
  } catch (error) {
    log(`Failed to play sound: ${error}`)
  }
}
