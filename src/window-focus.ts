import { execSync } from 'node:child_process'
import { log } from './logger'

export function focusTerminalByTTY(tty: string): boolean {
  try {
    // TTY comes in format like "ttys005", we need to match it exactly
    log(`Searching for terminal with TTY: ${tty}`)

    // AppleScript to find and focus the terminal window with matching TTY
    const appleScript = `
tell application "Terminal"
    -- Check all windows
    repeat with w in windows
        repeat with t in tabs of w
            -- Get the tty of this tab
            set tabTTY to (tty of t)
            
            if tabTTY contains "${tty}" then
                -- Found the window, bring it to front
                set frontmost of w to true
                set selected of t to true
                activate
                return "Found and focused window with TTY ${tty}"
            end if
        end repeat
    end repeat
    
    return "No window found with TTY ${tty}"
end tell
`

    const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf-8' })
    log('AppleScript result:', result.trim())

    return result.includes('Found and focused')
  } catch (error) {
    log('Error focusing terminal:', error)
    return false
  }
}

export function focusTerminalByCWD(cwd: string): boolean {
  try {
    log(`Searching for terminal with CWD: ${cwd}`)
    
    // For now, let's disable CWD-based focusing as it's unreliable
    // The `do script` command creates new output in terminals which is intrusive
    log('CWD-based focusing is currently disabled')
    return false
  } catch (error) {
    log('Error focusing terminal by CWD:', error)
    return false
  }
}

export function focusTerminalWindow(tty: string, cwd?: string): boolean {
  log(`Attempting to focus terminal - TTY: ${tty}, CWD: ${cwd}`)

  // First try focusing by TTY
  if (focusTerminalByTTY(tty)) {
    return true
  }

  // If that fails and we have a CWD, try by working directory
  if (cwd && focusTerminalByCWD(cwd)) {
    return true
  }

  return false
}
