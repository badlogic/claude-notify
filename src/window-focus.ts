import { execSync } from 'node:child_process'
import { log } from './logger'

export function focusTerminalByTTY(tty: string): boolean {
  try {
    // Extract the terminal device number from TTY (e.g., "s001" -> "1")
    const ttyMatch = tty.match(/s(\d+)/)
    if (!ttyMatch) {
      log(`Invalid TTY format: ${tty}`)
      return false
    }

    const ttyNum = ttyMatch[1]

    // AppleScript to find and focus the terminal window with matching TTY
    const appleScript = `
tell application "Terminal"
    set targetTTY to "ttys${ttyNum.padStart(3, '0')}"
    
    -- Check all windows
    repeat with w in windows
        repeat with t in tabs of w
            -- Get the tty of this tab
            set tabTTY to (tty of t)
            
            if tabTTY contains targetTTY then
                -- Found the window, bring it to front
                set frontmost of w to true
                set selected of t to true
                activate
                return "Found and focused window with TTY " & targetTTY
            end if
        end repeat
    end repeat
    
    return "No window found with TTY " & targetTTY
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
    // AppleScript to find and focus terminal by working directory
    const appleScript = `
tell application "Terminal"
    -- Check all windows
    repeat with w in windows
        repeat with t in tabs of w
            -- Check if this tab's current directory matches
            do script "pwd" in t
            delay 0.1
            set tabPwd to (history of t)
            
            if tabPwd contains "${cwd}" then
                -- Found the window, bring it to front
                set frontmost of w to true
                set selected of t to true
                activate
                return "Found and focused window with CWD ${cwd}"
            end if
        end repeat
    end repeat
    
    return "No window found with CWD ${cwd}"
end tell
`

    const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf-8' })
    log('AppleScript result:', result.trim())

    return result.includes('Found and focused')
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
