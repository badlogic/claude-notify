# Claude Notify - Architecture Plan

## Overview
A notification system for Claude Code that tracks session status and displays notifications when Claude is waiting for input. On macOS, uses a menu bar app with a control center. On Linux/Windows, uses native notifications.

## Current State
We've built a macOS notification system with:
- Custom Swift alerter that creates persistent notifications
- Minimal, system-like design (280x65px)
- Stacking support for multiple notifications
- Automatic sliding when notifications above are dismissed
- 200-character preview with expand/collapse functionality
- Inter-process coordination via `~/.claude-notify/notification-positions.json`

## Issues with Current Approach
1. Multiple notification windows are spawned (one per process)
2. Scrollbar issues in expanded view (both horizontal and vertical scroll)
3. Collapsed view only shows "..." instead of first 200 chars
4. Each hook spawn creates a new process/window

## Proposed New Architecture

### Core Design
- **Control Center Window** showing all active sessions and their status
- **Swift daemon** (macOS) that manages session tracking and notifications
- **IPC via Unix Domain Sockets** with message framing (newline-delimited JSON)
- **Menu bar icon** with Claude logo and waiting session count badge
- **System notifications** for Stop/Notification hooks (ephemeral, click to open control center)
- **Sound playback** when session becomes idle

### Components

#### 1. Swift Daemon (macOS only) - `macos-daemon.swift`
- Runs as background process with menu bar icon
- Menu bar icon: Claude Code logo (SVG provided, adapted for light/dark theme)
- Listens on Unix socket: `~/.claude-notify/notifications.sock`
- Manages single notification center window
- Auto-starts when first notification arrives
- Auto-exits when no notifications remain (optional)
- Shows menu bar with:
  - Click to toggle notification center
  - Badge with notification count
  - Right-click menu: Clear All, Quit

#### 2. TypeScript Client
- Receives hooks from Claude Code
- On macOS: 
  - Checks if daemon is running
  - Starts daemon if needed
  - Sends notification via Unix socket
- On Linux/Windows: Uses native notify-send
- Handles concurrent connections properly

#### 3. Control Center Window (SwiftUI)
- Single window (400px wide, up to 80% screen height)
- Opens below menu bar icon
- Dismisses when clicking outside
- Shows list of active sessions with:
  - Working directory (abbreviated with ~)
  - Last assistant message (full text, scrollable)
  - Session status (🟢 working, 🟡 waiting for input)
  - Auto-removes when PID no longer exists
- Clicking system notification highlights corresponding session

### Hook Integration
- **Stop & Notification hooks**: Session is waiting for input (idle)
  - Trigger system notification
  - Play sound
  - Update menu bar badge
  - Show first 200 chars in notification
- **All other hooks**: Session is working
  - Update session status to working
  - No notification/sound
- Track sessions by PID to detect when they end

### IPC Protocol
Newline-delimited JSON over Unix socket:
```json
{
  "type": "hook",
  "hookType": "Stop",
  "sessionId": "uuid",
  "pid": 12345,
  "cwd": "/path/to/project",
  "message": "Assistant message...",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Development Workflow
- TypeScript checks if daemon is running (via socket connection)
- Auto-starts daemon if not running
- IPC failure handling: kill daemon, restart, retry 3 times
- Debug logging to `~/.claude-notify/daemon.log`
- Dev mode: Kill daemon on rebuild


## Implementation Checklist

### Phase 1: Core Infrastructure
- [x] Create `macos-daemon.swift` with basic structure
- [x] Implement Unix socket server in Swift
- [x] Implement Unix socket client in TypeScript
- [x] Add message framing (newline-delimited JSON)
- [x] Create signed executable with embedded Info.plist and entitlements
- [ ] Test concurrent message handling
- [x] Add daemon lifecycle management in TypeScript

### Phase 2: Menu Bar & Basic UI
- [x] Add NSStatusItem with Claude logo (using system symbol)
- [ ] Implement SVG → NSImage with theme support
- [x] Add number badge for waiting sessions
- [x] Create basic SwiftUI window
- [x] Implement click to toggle window
- [x] Add click-outside to dismiss

### Phase 3: Session Management
- [x] Track sessions by PID
- [x] Implement PID monitoring
- [x] Store session state (working/idle)
- [x] Store last assistant message
- [x] Auto-remove dead sessions
- [x] Update UI with session list

### Phase 4: Notifications & Sound
- [x] Implement system notifications in Swift
- [ ] Add sound playback to daemon
- [x] Show first 200 chars in notification
- [ ] Handle notification click → highlight session
- [x] Update menu bar badge count

### Phase 5: Hook Integration
- [x] Update TypeScript to forward all hooks
- [x] Parse hook types and update session state
- [ ] Test with real Claude Code sessions
- [ ] Handle edge cases (daemon crash, etc.)

### Phase 6: Polish & Testing
- [x] Add proper error handling
- [x] Implement daemon logging
- [ ] Test concurrent sessions
- [x] Add Linux/Windows fallback
- [ ] Update installation docs
- [ ] Create demo video

### Phase 7: Code Signing & Distribution
- [ ] Set up code signing with dev account (like screeny2)
- [ ] Add notarization for distribution builds
- [ ] Create separate dev/dist build configurations

## Bugs

### Critical Issues

- [x] **Daemon crashes when control center window is closed**
  - ~~Closing the control center window causes the entire daemon to terminate~~
  - ~~The menu bar icon disappears~~
  - ~~Likely related to window retain count or SwiftUI/NSHostingView lifecycle~~
  - ~~`applicationShouldTerminateAfterLastWindowClosed` is not being called~~
  - ~~Need to investigate window delegate methods and retain cycles~~
  - **Fix**: Added `isReleasedWhenClosed = false`, properly remove notification observers, and clear delegates to prevent retain cycles

- [ ] **Sessions show "No message" for all entries**
  - The transcript parsing doesn't handle Claude Code's actual format
  - Real transcript entries have content as arrays with text objects: `[{"type":"text","text":"..."}]`
  - Current parser expects simple string content
  - Need to update `getLastAssistantMessage` to handle nested content structure

- [ ] **Session tracking uses wrong PID**
  - Using `process.ppid` gets the parent PID, but this varies:
    - Real Claude Code hooks: ppid=4781 (Claude Code process)
    - Test hooks: ppid=shell process ID
  - Sessions get removed after 5 seconds by PID monitoring because the claude-notify CLI process exits
  - Need a better way to identify the Claude Code process

### Minor Issues

- [ ] **No notification click handling**
  - Clicking on notifications doesn't highlight the session in control center
  - Need to implement UNUserNotificationCenterDelegate

- [ ] **No sound playback**
  - Sound playback is not implemented yet
  - Should play sound when session becomes idle (Stop/Notification hooks)