# If the control window has focus, pressing escape should close it

**Status:** Refining
**Created:** 2025-07-07T01:41:43Z
**Agent PID:** 99863

## Original Todo
- [ ] If the control window has focus, pressing escape should close it

## Description
The control window (the floating window that appears when clicking the menu bar icon) currently lacks keyboard support. When the window has keyboard focus, users should be able to press the Escape key to close it, providing a quick keyboard-based way to dismiss the window without using the mouse.

Currently, the window can only be closed by:
- Clicking outside the window (loses focus)
- Clicking the close button in the window title bar
- Clicking the menu bar icon again

Adding Escape key support will improve the user experience by providing a standard macOS keyboard shortcut for dismissing floating windows.

## Implementation Plan
- [ ] Add `.focusable()` modifier to ControlCenterView to enable keyboard input (src/mac/daemon.swift:~460)
- [ ] Add `.onExitCommand` modifier to handle Escape key press (src/mac/daemon.swift:~461)
- [ ] Inside onExitCommand, call the existing hideControlCenter() method (src/mac/daemon.swift:~461)
- [ ] Automated test: Build the daemon to ensure no compilation errors
- [ ] Automated test: Run type checking to verify Swift syntax
- [ ] User test: Click menu bar icon to open control window
- [ ] User test: Press Escape key while window has focus - window should close
- [ ] User test: Verify clicking outside window still closes it (existing behavior)
- [ ] User test: Verify clicking menu bar icon still toggles window (existing behavior)