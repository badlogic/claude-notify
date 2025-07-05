### Completed

### Open
- [ ] Sessions in control window should be sorted by:
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
- [ ] We should track when we started monitoring a session and display for how long it has been running already
- [ ] Clear all should be "Clear exited".