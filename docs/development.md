# Development Guide

This guide covers development setup and workflow for Claude Notify.

## Project Structure

```
claude-notify/
├── src/                    # TypeScript source code
│   ├── cli.ts             # CLI entry point and command handling
│   ├── daemon-client.ts   # Unix socket client for macOS daemon
│   ├── logger.ts          # Logging utilities
│   ├── notifications.ts   # Cross-platform notification handling
│   ├── settings.ts        # Claude Code hook installation/management
│   ├── sound.ts          # Sound playback utilities
│   ├── transcript.ts     # Claude Code transcript parsing
│   └── mac/              # macOS-specific Swift daemon
│       ├── daemon.swift  # SwiftUI daemon application
│       ├── Info.plist    # App bundle configuration
│       └── *.entitlements # Security entitlements
├── scripts/               # Build scripts
│   └── build-daemon.sh   # macOS daemon build script
├── dist/                  # Compiled output
├── docs/                  # Documentation
├── Package.swift         # Swift Package Manager configuration
├── tsup.config.ts        # TypeScript bundler configuration
└── package.json          # Node.js project configuration
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/mariozechner/claude-notify.git
cd claude-notify

# Install dependencies
npm install

# Link the package globally for testing
npm link

# Run in development mode (watches for changes and rebuilds automatically)
npm run dev

# In another terminal, test the CLI
claude-notify --help

# Run checks (linting, formatting, type checking)
npm run check

# Build for production
npm run build

# Unlink when done testing
npm unlink -g @mariozechner/claude-notify
```

## Development Workflow

### TypeScript Development

1. **Development Mode**: Run `npm run dev` to start the TypeScript watcher with automatic rebuilds
2. **Code Quality**: Run `npm run check` to run Biome linter/formatter and TypeScript type checking
3. **Building**: Run `npm run build` to create production builds (both TypeScript and macOS daemon)

### macOS Daemon Development

The macOS daemon is built with Swift Package Manager and requires Xcode Command Line Tools:

```bash
# Build debug version (ad-hoc signing)
npm run build:daemon

# Build release version (requires Developer ID certificate)
bash scripts/build-daemon.sh release

# Kill running daemon (useful during development)
npm run kill-daemon
```

### NPM Scripts

- `npm run build` - Full production build (TypeScript + daemon)
- `npm run build:daemon` - Build macOS daemon only (debug mode)
- `npm run clean` - Remove build artifacts and logs
- `npm run dev` - Development mode with file watching
- `npm run kill-daemon` - Stop running daemon process
- `npm run check` - Run linting and type checking

## Architecture

### Cross-Platform Design

Claude Notify uses different architectures for macOS vs Linux/Windows:

#### macOS Architecture
- **TypeScript Hook Handler**: Receives hooks from Claude Code via stdin
- **Unix Socket Client**: Forwards messages to daemon via socket at `~/.claude-notify/notifications.sock`
- **Swift Daemon**: Long-running background process that:
  - Manages menu bar icon with session count badge
  - Shows SwiftUI control center with active sessions
  - Monitors process PIDs to clean up dead sessions
  - Handles system notifications
- **Communication**: Newline-delimited JSON over Unix domain socket

#### Linux/Windows Architecture
- **TypeScript Hook Handler**: Receives hooks and handles everything directly
- **node-notifier**: Shows system notifications
- **play-sound**: Plays notification sounds

### Key Components

#### Hook Processing Flow
1. Claude Code executes hook command with JSON input via stdin
2. CLI parses hook type and input data
3. Transcript is parsed to extract session info
4. Platform-specific notification handling:
   - macOS: Forward to daemon via socket
   - Others: Show notification directly

#### Session Management (macOS)
- Sessions tracked by unique session ID from Claude Code
- Each session stores: PID, working directory, last message, status
- PID monitoring removes dead sessions automatically
- Sessions sorted by timestamp (newest first)

#### Unix Socket Protocol (macOS)
Messages are JSON objects with newline delimiters:
```json
{
  "type": "hook",
  "hookType": "Stop",
  "sessionId": "abc123",
  "pid": 12345,
  "cwd": "/Users/name/project",
  "message": "Task completed successfully",
  "timestamp": 1704067200000
}
```

## Build System

### TypeScript Build
- **Bundler**: tsup (esbuild-based)
- **Entry Points**: `src/cli.ts` (marked as executable)
- **Output Formats**: CommonJS and ESM
- **Features**: Source maps, type declarations, tree shaking

### Swift Build
- **Tool**: Swift Package Manager
- **Target**: macOS 12.0+
- **Executable**: ClaudeNotifyDaemon
- **Code Signing**: 
  - Debug: Ad-hoc signing or Apple Development certificate
  - Release: Developer ID certificate for distribution
- **Entitlements**: Disabled app sandbox for Unix socket access

## Testing

### Testing with Claude Code

1. Install globally: `npm link`
2. Start dev mode: `npm run dev`
3. Install hooks: `claude-notify -install`
4. Test with Claude Code - notifications should appear
5. Make code changes - auto-rebuild via dev mode
6. Test changes without reinstalling hooks

### Manual Testing

```bash
# Test notification system
claude-notify -test

# Test hook processing (requires JSON input)
echo '{"session_id":"test","transcript_path":"path.jsonl"}' | claude-notify Stop

# Verify daemon is running (macOS)
ps aux | grep ClaudeNotifyDaemon
```

## Debugging

### Log Files
- **TypeScript logs**: `~/.claude-notify/log.txt`
- **Daemon logs** (macOS): `~/.claude-notify/daemon.log`

```bash
# Watch TypeScript logs
tail -f ~/.claude-notify/log.txt

# Watch daemon logs (macOS)
tail -f ~/.claude-notify/daemon.log
```

### Common Issues

1. **Daemon not starting** (macOS):
   - Check if daemon binary exists: `dist/ClaudeNotifyDaemon.app`
   - Verify code signing: `codesign -dv dist/ClaudeNotifyDaemon.app`
   - Check daemon logs for errors

2. **Notifications not appearing**:
   - Verify hooks are installed: Check `~/.claude/settings.json`
   - Check system notification permissions
   - Review logs for errors

3. **Socket connection errors** (macOS):
   - Ensure daemon is running: `ps aux | grep ClaudeNotifyDaemon`
   - Check socket exists: `ls ~/.claude-notify/notifications.sock`
   - Kill and restart daemon: `npm run kill-daemon && npm run dev`

## Security Considerations

### macOS Code Signing
- Debug builds use ad-hoc signing or development certificates
- Release builds require Developer ID certificate
- App sandbox is disabled to allow Unix socket communication
- Hardened runtime enabled for release builds

### Hook Security
- Hooks execute with user permissions
- Input validation in transcript parsing
- Socket communication restricted to user's home directory

## Contributing

1. Follow existing code style (enforced by Biome)
2. Add types for all new code
3. Test on target platforms
4. Update documentation for new features