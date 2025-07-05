# Development Guide

This guide covers development setup and workflow for Claude Notify.

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

## Testing with Claude Code

1. Run `npm link` to make `claude-notify` available globally
2. Run `npm run dev` to watch for changes
3. Install the hooks: `claude-notify -install`
4. Test by running Claude Code and watching the menu bar (macOS) or notifications
5. Make changes to the source - they'll be automatically rebuilt
6. Test again without reinstalling

## Building

See [build.md](build.md) for detailed build instructions.

## Debugging

### TypeScript Logs
Logs are written to `~/.claude-notify/log.txt`. Check this file if notifications aren't working as expected:

```bash
tail -f ~/.claude-notify/log.txt
```

### Daemon Logs (macOS)
The daemon logs are written to `~/.claude-notify/daemon.log`:

```bash
tail -f ~/.claude-notify/daemon.log
```

## Architecture

### macOS
- **TypeScript Client**: Receives hooks from Claude Code and forwards to daemon
- **Swift Daemon**: Runs in background, manages UI and notifications
- **Unix Socket**: IPC between TypeScript and Swift using newline-delimited JSON
- **SwiftUI**: Control center window for viewing sessions
- **Menu Bar**: NSStatusItem with session count badge

### Linux/Windows
- **TypeScript Client**: Receives hooks and shows notifications directly
- **node-notifier**: Cross-platform notification library
- **play-sound**: Cross-platform sound playback

## API

### `handleHook(hookType: string, input: HookInput)`

Main function that processes Claude Code hook data for any hook type.

- `hookType`: The type of hook (PreToolUse, PostToolUse, Stop, etc.)
- `input`: The hook input data from Claude Code containing session ID and transcript path

### `parseTranscript(transcriptPath: string): TranscriptEntry[]`

Parses a Claude Code transcript JSONL file.

### `getLastAssistantMessage(entries: TranscriptEntry[]): string | null`

Extracts the last assistant message from transcript entries.

### `getCurrentWorkingDirectory(entries: TranscriptEntry[]): string | null`

Gets the current working directory from transcript entries.