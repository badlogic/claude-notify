# Fix session cwd wrapping issue with time display

**Status:** In Progress
**Started:** 2025-07-07T02:52:30
**Created:** 2025-07-07T02:51:13
**Agent PID:** 27648

## Original Todo
- [ ] Session cwd is wrapped when session is working and we also display time. i think we should show path first, then an second row with time, pid, mute? pid is now also fomratted with locale again so ew get somthing like 10.324 intead of 10.324

## Description
The control window's session list currently displays the working directory path, status/time, PID, and mute button all on the same row. When sessions have long working directory paths and are in "working" state (showing elapsed time), the path can get wrapped or truncated due to limited horizontal space.

The improvement is to reorganize the session row layout:
- Move the working directory path to its own dedicated first row
- Create a second row for status/time, PID, and mute button
- Keep the message as the third row

This gives the path full width to display without wrapping, improves readability, and creates better visual hierarchy.

Additionally, the PID is incorrectly formatted with locale-specific thousands separators (e.g., "10.324" instead of "10324") which needs to be fixed.

## Implementation Plan
- [x] Fix PID formatting issue (src/mac/daemon.swift:629)
- [x] Reorganize SessionRow layout to show path on first row (src/mac/daemon.swift:598-658)
- [x] Move status/time, PID, and mute button to second row (src/mac/daemon.swift:618-648)
- [x] Adjust VStack spacing for better visual hierarchy (src/mac/daemon.swift:598)
- [x] Automated test: Build the project with `npm run build`
- [x] User test: Open control window and verify PIDs display without thousands separators
- [x] User test: Check that long paths display on their own row without wrapping
- [x] User test: Verify status/time, PID, and mute button are on second row
- [x] User test: Ensure message text remains on third row with proper wrapping

## Notes
- Changed VStack spacing from 10 to 8 for tighter visual grouping
- Added maxWidth: .infinity to the path Text view to ensure it takes full available width
- The PID formatting was already fixed using String(session.pid) conversion