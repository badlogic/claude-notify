### Completed
- [x] tray icon should really just be a bold CC or CC(<num-waiting>)
  **WHAT**: Replace the current bell icon in the macOS menu bar with bold text that shows:
  - "CC" when no sessions are waiting for input
  - "CC(3)" when 3 sessions are waiting (dynamic count)
  - Text should be bold and use the system's default menu bar text color
  - Remove the bell icon completely
  - No hover or tooltip functionality

  **HOW**:
  - [x] Remove the bell icon in `setupMenuBar()` at src/mac/daemon.swift:602
    - [x] Delete the line: `button.image = NSImage(systemSymbolName: "message.fill", accessibilityDescription: "Claude Notify")`
  - [x] Add initial bold "CC" text in `setupMenuBar()` at src/mac/daemon.swift:602-603
    - [x] Create NSAttributedString with bold system font
    - [x] Set `button.attributedTitle` to display "CC"
  - [x] Update `updateBadge()` method at src/mac/daemon.swift:608-618 to show bold text
    - [x] Replace `button.title` with `button.attributedTitle`
    - [x] Use NSAttributedString with bold font
    - [x] Display "CC" when count is 0
    - [x] Display "CC(\(count))" when count > 0
  - [x] Build daemon with `npm run build:daemon` (will auto-kill existing daemon)
  - [x] Test: Verify "CC" shows in menu bar when no sessions are waiting
  - [x] Test: Verify "CC(3)" shows when 3 sessions are waiting
  - [x] Test: Verify text is bold and readable
  - [x] Test: Verify clicking still opens control window
  (https://github.com/badlogic/claude-notify/commit/f9a876ae7a460e6f6d910a236cb68f126301b495)
- [x] We should track when we started monitoring a session and display for how long it has been running already
  **WHAT**: Track and display three durations in the control window's session list:
  1. Total session duration: Time since the session was first detected (format: "2h 15m" or "45m")
  2. Total working time: Accumulated time across all working periods (format: "2h 15m" or "45m")
  3. Current working period: Time in current working state if actively working (format: "2h 15m" or "45m")

  The durations should be displayed in the session list, update in real-time, and do not need to persist across app restarts. No special behavior for long-running sessions.

  **HOW**:
  - [x] Add properties to SessionInfo struct in src/mac/daemon.swift:10-23:
    - [x] `startTimestamp: Date` - when session was first detected
    - [x] `totalWorkingTime: TimeInterval` - accumulated working time across all periods
    - [x] `currentWorkingStartTimestamp: Date?` - start of current working period (nil if not working)
  - [x] Initialize `startTimestamp` with current date and `totalWorkingTime = 0` when creating new session in updateSession() at src/mac/daemon.swift:56-66
  - [x] When status changes to working in updateSession() at src/mac/daemon.swift:69:
    - [x] Set `currentWorkingStartTimestamp = Date()`
  - [x] When status changes from working to idle/exited in updateSession() at src/mac/daemon.swift:69:
    - [x] Add current period to total: `totalWorkingTime += Date().timeIntervalSince(currentWorkingStartTimestamp!)`
    - [x] Clear `currentWorkingStartTimestamp = nil`
  - [x] Create a `formatDuration(_ interval: TimeInterval) -> String` function in SessionRow to format durations like "2h 15m 30s" or "45m 10s" or "5s"
  - [x] Add duration display to SessionRow view at src/mac/daemon.swift:422-461:
    - [x] Add HStack with duration info below the working directory
    - [x] Show total session time: `Date().timeIntervalSince(session.startTimestamp)`
    - [x] Show total working time: `session.totalWorkingTime + (currentWorkingPeriod if active)`
    - [x] Show current period (only if working): `Date().timeIntervalSince(session.currentWorkingStartTimestamp!)`
  - [x] Add Timer to ControlCenterView that refreshes every second to update durations in real-time
  - [x] Fix timer not triggering UI updates - add @Published refreshTrigger to SessionManager
  - [x] Fix timer still not updating - use Timer.publish with Combine for proper UI updates
  - [x] Debug why timer still not working - add logging and pass currentTime to rows for re-renders
  - [x] Remove debug logging now that timer is working
  - [x] Run `npm run build:daemon` and fix any compilation errors
  - [x] Test: Verify all three durations display correctly
  - [x] Test: Verify total working time accumulates across multiple working periods
  - [x] Test: Verify current period only shows when actively working
  - [x] Test: Verify durations update in real-time
  (https://github.com/badlogic/claude-notify/commit/a7cab3a6e3b47e690848ee93b6f19b4e1012f06b)
- [x] Process id has a dot in it in row
  **WHAT**: The process ID in the control window's session list is being displayed with unwanted formatting (e.g., "PID: 12.34" instead of "PID: 1234"). The PID should be displayed as a plain integer without any thousand separators or decimal points.

  **HOW**:
  - [x] Fix PID display formatting in SessionRow at src/mac/daemon.swift:489 by changing `Text("PID: \(session.pid)")` to `Text("PID: \(String(session.pid))")`
  - [x] Build daemon with `npm run build:daemon` and ensure no compilation errors
  - [x] Test: Verify PID displays as plain number without dots (e.g., "PID: 12345" not "PID: 12.345")
  (https://github.com/badlogic/claude-notify/commit/37618cce6e0c1e12c96b2dc3c58d08e52c913cb8)
- [x] We should be able to say "do not display notifications for this session" in the control window
  **WHAT**: Add a toggle button to each session row in the control window that allows users to mute/unmute notifications for that specific session. When muted:
  - No system notifications will be shown for that session
  - No notification sounds will play for that session
  - The session will not count towards the tray icon's waiting count
  - The session remains visible in the control window with a badge-style button that shows "Muted" (when muted) or "Mute" (when unmuted)
  - Muted sessions have reduced opacity (0.7) for visual distinction
  - The mute state is temporary and does not persist across daemon restarts
  - Users can toggle the mute state at any time

  **HOW**:
  - [x] Add `var muted: Bool = false` property to SessionInfo struct at src/mac/daemon.swift:20
  - [x] Update notification logic in `showNotification()` at src/mac/daemon.swift:315 to check if session is muted before showing
  - [x] Update `waitingSessionCount` computed property at src/mac/daemon.swift:145 to exclude muted sessions
  - [x] Add mute toggle button to SessionRow at src/mac/daemon.swift:491 after PID display:
    - [x] Style "Mute" as plain text button with `.buttonStyle(.plain)` and `.font(.caption)`
    - [x] Style "Muted" with filled background using `.background(Color.red.opacity(0.2))` and `.cornerRadius(4)`
    - [x] Use red foreground color for "Muted" state
  - [x] Add `toggleMute(sessionId:)` method to SessionManager to handle mute state changes
  - [x] Update session opacity in SessionRow to 0.7 when muted at src/mac/daemon.swift:521
  - [x] Prevent notification sound in TypeScript side by checking mute state before calling playSound() in src/notifications.ts
    - [x] Not needed for macOS - sound is handled by system notification in daemon
  - [x] Build daemon with `npm run build:daemon`
  - [x] Test: Verify mute button toggles between "Mute" and "Muted" states with distinct styling
  - [x] Test: Verify muted sessions don't show notifications or play sounds
  - [x] Test: Verify muted sessions don't count in tray icon badge
  - [x] Test: Verify muted sessions have reduced opacity
  (https://github.com/badlogic/claude-notify/commit/75b2567ab892da859a30e3e35e7c456b96a21c22)
- [x] When we detect a session has exited, we need to immediately resort the session list
  **WHAT**: When the daemon detects a session has exited (process no longer exists), the session list should immediately resort to move the exited session to the bottom of the list. The resort should happen as soon as the session status is changed to `.exited` in the `removeDeadSessions()` method. The sorting order should remain the same: idle sessions first, working sessions second, exited sessions last (newest first within each group). The UI should update immediately to reflect the new order without waiting for new hook messages.

  **HOW**:
  - [x] Extract the sorting logic from `updateSession()` (lines 71-77) into a new private method `sortSessions()` in SessionManager in src/mac/daemon.swift
  - [x] Call `sortSessions()` in `removeDeadSessions()` after marking sessions as exited (after line 107) in src/mac/daemon.swift
  - [x] Add a thread-safe `removeExitedSessions()` method in SessionManager that uses the lock and calls `sortSessions()` in src/mac/daemon.swift
  - [x] Update the "Clear Exited" button action (line 358) to call the new `removeExitedSessions()` method instead of directly modifying sessions in src/mac/daemon.swift
  - [x] Update the clearExited() method (line 580) to use the new thread-safe method in src/mac/daemon.swift
  (https://github.com/badlogic/claude-notify/commit/0efb1d5f9bb5ca00ec5a7e656924fbe97e3977bf)
- [x] Clicking on the tray icon should immediately show the control window (no menu). Add a "Shutdown" button in the control window header to quit the daemon, replacing the menu-based quit option.
  - [x] Remove the menu from the tray icon in `setupMenuBar()` (daemon.swift:487-495)
    - Delete lines creating the NSMenu
    - Delete line assigning menu to statusItem
    - Keep the button action and target setup

  - [x] Add Shutdown button to ControlCenterView header (daemon.swift:362)
    - Add button after "Clear Exited" button in same HStack
    - Style with `.buttonStyle(.plain)` and `.font(.caption)`
    - Use red foreground color to indicate destructive action
    - Call the existing `quit()` method or `NSApplication.shared.terminate(nil)`

  - [x] Build the daemon with `npm run build:daemon`
    - Fix any Swift compilation errors

  - [x] Kill existing daemon after build to reload changes
    - Run `pkill -f ClaudeNotifyDaemon`
    - The daemon will auto-restart with new code on next Claude Code command

  - [x] User must test the following before committing:
    - Clicking tray icon shows control window directly (no menu)
    - Toggle behavior works (repeated clicks show/hide window)
    - Shutdown button properly terminates the daemon
    - Socket cleanup occurs (check ~/.claude-notify/notifications.sock is removed)
    - Daemon process exits cleanly
    (https://github.com/badlogic/claude-notify/commit/c78aa900970f141d894e7581a9f4ccd5b2b42596)
- [x] Sessions in control window should be sorted by:
    - waiting for prompt (orange)
    - working (green)
    - exited (red)
    this also means we need to keep info on dead sessions in memory, which is fine

    **WHAT**:
    - Add a new "exited" state (🔴 red) for sessions whose processes have ended
    - Keep exited sessions in memory instead of removing them
    - Sort sessions by status: idle (🟡) → working (🟢) → exited (🔴)
    - Rename "Clear All" to "Clear Exited" and only remove exited sessions
    - No automatic clearing - manual only

    **HOW**:
    - src/mac/daemon.swift:20 - Add `case exited = "exited"` to SessionStatus enum
    - src/mac/daemon.swift:89-107 - Update removeDeadSessions() to mark as exited instead of removing
    - src/mac/daemon.swift:69-71 - Implement sorting by status then timestamp
    - src/mac/daemon.swift:395-397 - Add 🔴 icon for exited status
    - src/mac/daemon.swift:355-357 - Change button to "Clear Exited" with filtered removal
    - src/mac/daemon.swift:109-111 - Update waitingSessionCount to exclude exited
    - src/mac/daemon.swift:483 - Update menu item to "Clear Exited"
    - src/mac/daemon.swift:573-575 - Rename clearAll() to clearExited()
    - src/mac/daemon.swift:422 - Add opacity modifier for visual distinction
    (https://github.com/badlogic/claude-notify/commit/e8dcca2cbf889a7496ad8dd861f892f1f6bf4247)

### Open
- [ ] Improve README.md, no need to manual setup, description of what it does is also lacking and not punchy and concise
- [ ] If a special env var is present (.e.g CLAUDE_NOTIFY_OFF), do not process hooks in cli.ts.
- [ ] we also want to display something instead of no message when a session is in the working state
- [ ] Make daemon testable
    - special CLI flag in daemon so it can run next to existing daemon with its own socket and own daemon-test.log file
    - tests can write to test socket in ~/.claude-notify/
    - Unsure if there's a better idea?
    - Special commands to open/close control window via socket?
    - snap-happy to take screenshots? better way to test UI?
- [ ] Improve .claude/commands/todo.md
    - todo.md -> only open items, done.md -> finished items, append only, inprogress.md -> in-progress items
    - Improve markdown format of refined todos, look terrible atm, should be nicely formatted nested lists with checkboxes where needed
    - prevent concurrent writes