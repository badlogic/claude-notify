# Make the control window and session rows prettier

**Status:** Refining
**Created:** 2025-07-07T02:11:14
**Agent PID:** 10154

## Original Todo
- [ ] Make the control window and session rows prettier

## Description
The control window currently uses basic system styling with minimal visual design. This task will transform it into a modern, visually appealing interface inspired by the VibeTunnel design. Key improvements will include:

- **Semi-transparent Dark Background**: Dark window background with subtle transparency to let desktop show through
- **Modern Window Design**: Rounded corners with proper shadows and refined spacing
- **Better Status Indicators**: Replace emoji (🟢🟡🔴) with subtle colored dots for session states
- **Enhanced Typography**: 
  - Clean, readable session information
  - Better hierarchy for directory paths, PIDs, and duration info
  - Improved contrast against dark background
- **Visual Organization**: 
  - Clear "Active Sessions" section header with count
  - Proper spacing between session rows
  - Subtle divider lines for visual separation
- **Refined Session Rows**:
  - Colored dots for working/idle/exited states
  - Clean layout for session info (directory, PID, duration, message)
  - Better use of space and alignment
- **Modern Bottom Toolbar**: Action buttons (Clear Exited, Shutdown) in a clean bottom bar
- **Polish Details**: Consistent spacing, smooth transparency, proper visual feedback

The goal is to create a professional, modern interface that feels native to macOS while being visually clean and easy to scan.

## Implementation Plan
- [ ] Define custom color scheme and theme constants (src/mac/daemon.swift:400-403)
- [ ] Update ControlCenterView window background with semi-transparency (src/mac/daemon.swift:404-469)
- [ ] Redesign header section with modern styling (src/mac/daemon.swift:410-425)
- [ ] Create custom status dot view to replace emoji indicators (src/mac/daemon.swift:470)
- [ ] Refactor SessionRow layout for better visual hierarchy (src/mac/daemon.swift:471-559)
- [ ] Style session information with improved typography (src/mac/daemon.swift:490-510)
- [ ] Update mute button with modern design (src/mac/daemon.swift:515-530)
- [ ] Add subtle divider lines between sections (src/mac/daemon.swift:460)
- [ ] Create bottom toolbar for action buttons (src/mac/daemon.swift:426-440)
- [ ] Apply consistent spacing and padding throughout (src/mac/daemon.swift:404-559)
- [ ] Add visual feedback for interactive elements (src/mac/daemon.swift:515-530)
- [ ] Update window styling for rounded corners (src/mac/daemon.swift:641-680)
- [ ] Automated test: Build the Swift daemon successfully
- [ ] User test: Launch daemon and verify new UI appears correctly
- [ ] User test: Test with multiple sessions to verify layout
- [ ] User test: Verify all interactive elements work (buttons, keyboard shortcuts)
- [ ] User test: Check visual appearance with different desktop wallpapers