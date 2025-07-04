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
      // For VS Code/Cursor, we just activate the app for now
      // The window matching will be done separately
      const appleScript = `
tell application "${appName}"
    activate
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

export function focusCursorWindowByCWD(cwd: string): boolean {
  try {
    log(`Attempting to focus Cursor window with workspace containing: ${cwd}`)

    // Extract the workspace folder from the CWD
    // For example: /Users/badlogic/workspaces/claude-hooks/claude-notify -> claude-notify
    const pathParts = cwd.split('/')
    let workspaceName = ''

    // Try to find a meaningful workspace name
    if (cwd.includes('/workspaces/')) {
      const idx = pathParts.indexOf('workspaces')
      if (idx >= 0 && idx < pathParts.length - 1) {
        workspaceName = pathParts[idx + 1]
      }
    } else {
      // Use the last two parts of the path
      workspaceName = pathParts.slice(-2).join('/')
    }
    
    log(`Extracted workspace name: "${workspaceName}" from CWD: "${cwd}"`)

    const appleScript = `
tell application "System Events"
    tell process "Cursor"
        set allWindows to windows
        set windowTitles to {}
        repeat with w in allWindows
            set windowTitle to name of w
            set end of windowTitles to windowTitle
            if windowTitle contains "${workspaceName}" then
                set frontmost of w to true
                tell application "Cursor" to activate
                return "Found and focused window: " & windowTitle & " | All windows: " & (windowTitles as string)
            end if
        end repeat
        return "No window found containing: ${workspaceName} | All windows: " & (windowTitles as string)
    end tell
end tell
`

    const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf-8' })
    log('Window focus result:', result.trim())

    return result.includes('Found and focused')
  } catch (error) {
    log('Error focusing Cursor window by CWD:', error)
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
    `Attempting to focus terminal - PID: ${sessionInfo.pid}, App: ${sessionInfo.app}, TTY: ${sessionInfo.tty}, CWD: ${sessionInfo.cwd}`,
  )

  // For Cursor/Code, try to focus the specific window by workspace
  if ((sessionInfo.app === 'Cursor' || sessionInfo.app === 'Code') && sessionInfo.cwd) {
    if (focusCursorWindowByCWD(sessionInfo.cwd)) {
      return true
    }
  }

  // First try focusing by PID (most reliable for regular terminals)
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
