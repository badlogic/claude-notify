import { execSync } from 'node:child_process'
import { log } from './logger'

export function focusTerminalByPID(pid: number, appName: string): boolean {
  try {
    log(`Attempting to focus ${appName} window with PID: ${pid}`)

    // Use different approaches based on the terminal app
    if (appName === 'Terminal') {
      // For Terminal.app, we use System Events to focus by process ID
      const appleScript = `
tell application "System Events"
    set terminalProcess to first process whose unix id is ${pid}
    set frontmost of terminalProcess to true
end tell

tell application "Terminal"
    activate
end tell
`
      const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf-8' })
      log('AppleScript result:', result.trim())
      return true
    }
    
    if (appName === 'Cursor' || appName === 'Code') {
      // For VS Code/Cursor, we need to use System Events to focus by PID
      const appleScript = `
tell application "System Events"
    set targetProcess to first process whose unix id is ${pid}
    set frontmost of targetProcess to true
    
    -- Also try to activate by name as backup
    if name of targetProcess is "Cursor" then
        tell application "Cursor" to activate
    else if name of targetProcess contains "Code" then
        tell application "Visual Studio Code" to activate
    end if
end tell
`
      const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf-8' })
      log('AppleScript result:', result.trim())
      return true
    }
    
    // For other apps, try to activate by name
    const appleScript = `
tell application "${appName}"
    activate
end tell
`
    const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf-8' })
    log('AppleScript result:', result.trim())
    return true
  } catch (error) {
    log('Error focusing terminal by PID:', error)
    return false
  }
}

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

export function focusTerminalWindow(sessionInfo: {
  pid: number
  tty: string
  app: string
  cwd?: string
}): boolean {
  log(
    `Attempting to focus terminal - PID: ${sessionInfo.pid}, App: ${sessionInfo.app}, TTY: ${sessionInfo.tty}`,
  )

  // First try focusing by PID (most reliable)
  if (focusTerminalByPID(sessionInfo.pid, sessionInfo.app)) {
    return true
  }

  // Fallback to TTY matching if PID doesn't work
  if (focusTerminalByTTY(sessionInfo.tty)) {
    return true
  }

  // Last resort: try CWD matching if available
  if (sessionInfo.cwd && focusTerminalByCWD(sessionInfo.cwd)) {
    return true
  }

  return false
}
