### Completed
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
- [ ] When we detect a session has exited, we need to immediately resort the session list
- [ ] We should track when we started monitoring a session and display for how long it has been running already
- [ ] We should be able to say "do not display notifications for this session" in the control window