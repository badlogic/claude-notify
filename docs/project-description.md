# Project: Claude Code Notifications

A cross-platform notification system for Claude Code that provides real-time status tracking and alerts when Claude needs user attention. Integrates with Claude Code's hook system to monitor session activity.

## Features
- System notifications when Claude stops or needs input
- macOS: Menu bar icon with session tracking and control center
- Linux/Windows: Desktop notifications with sound alerts
- Multi-session support with individual mute controls
- Automatic dead session cleanup
- Environment variable `CLAUDE_NOTIFY_OFF` to temporarily disable all notifications

## Architecture
- **Hooks**: Claude Code triggers hooks (PreToolUse, PostToolUse, Stop) that call `claude-notify`
- **CLI**: `claude-notify` receives hook events and either:
  - macOS: Sends updates to daemon via Unix socket at `~/.claude-notify/notifications.sock`
  - Linux/Windows: Shows notifications directly using `node-notifier`
- **Daemon** (macOS only): Long-running Swift app that:
  - Maintains session state across all Claude Code instances
  - Shows menu bar icon with active session count
  - Displays control center UI with all sessions
  - Handles system notifications when Claude needs attention

## Commands
- **Check**: `npm run check` (Biome lint/format + TypeScript typecheck)
- **Build**: `npm run build` (TypeScript + Swift daemon)
- **Development**: `npm run dev` (Watch mode with auto-rebuild)
- **Clean**: `npm run clean` (Remove build artifacts and logs)
- **Test notification**: `claude-notify -test`
- **Disable notifications**: Set `CLAUDE_NOTIFY_OFF=1` environment variable

## Structure
src/cli.ts              # CLI entry point (receives hook events)
src/notifications.ts    # Core notification logic
src/mac/daemon.swift    # macOS menu bar daemon (maintains state)
src/daemon-client.ts    # Unix socket client (communicates with daemon)
src/transcript.ts       # Claude transcript parsing
src/settings.ts         # Hook configuration

## Notes
- TypeScript with strict type checking
- Swift daemon for macOS with SwiftUI control center
- No automated tests currently