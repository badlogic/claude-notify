# @mariozechner/claude-notify

A Node.js notification handler for Claude Code hooks that displays notifications with the assistant's last message and current working directory when a Claude Code session stops.

## Features

- Native macOS notifications showing Claude's last message
- Displays current working directory in notifications
- Customizable sound playback
- TypeScript support
- Fast and lightweight

## Installation

```bash
npm install -g @mariozechner/claude-notify
```

## Usage

### Quick Setup

The easiest way to set up claude-notify is to use the automatic installation:

```bash
claude-notify -install
```

This will automatically add claude-notify as a Stop hook in your Claude Code settings.

### Manual Setup

Alternatively, you can set up the hook manually:

1. Open Claude Code and run the `/hooks` slash command
2. Select the `Stop` hook event
3. Add a new hook with the following command:

```bash
claude-notify
```

4. Save your configuration to user settings

The hook configuration in your `~/.claude/settings.json` should look like:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify"
          }
        ]
      }
    ]
  }
}
```

### Custom Sound

You can specify a custom sound file by modifying the hook command:

```bash
claude-notify --sound /path/to/sound.aiff
```

## Development

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

### Testing with Claude Code

1. Run `npm link` to make `claude-notify` available globally
2. Run `npm run dev` to watch for changes
3. Install the hook: `claude-notify -install`
4. Test by running Claude Code and waiting for it to stop
5. Make changes to the source - they'll be automatically rebuilt
6. Test again without reinstalling

### Debugging

Logs are written to `~/.claude-notify/log.txt`. Check this file if notifications aren't working as expected:

```bash
tail -f ~/.claude-notify/log.txt
```

## API

### `handleStopHook(input: HookInput, options?: { soundPath?: string })`

Main function that processes the Claude Code stop hook data.

- `input`: The hook input data from Claude Code containing session ID and transcript path
- `options.soundPath`: Optional path to a custom sound file

### `parseTranscript(transcriptPath: string): TranscriptEntry[]`

Parses a Claude Code transcript JSONL file.

### `getLastAssistantMessage(entries: TranscriptEntry[]): string | null`

Extracts the last assistant message from transcript entries.

### `getCurrentWorkingDirectory(entries: TranscriptEntry[]): string | null`

Gets the current working directory from transcript entries.

## License

MIT