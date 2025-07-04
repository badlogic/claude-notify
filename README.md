# @mariozechner/claude-notify

A Node.js notification handler for Claude Code hooks that displays notifications with the assistant's last message and current working directory when a Claude Code session stops.

## Features

- Cross-platform notifications showing Claude's last message
- **Click notifications to focus the originating terminal window** (macOS only)
- Displays current working directory in notifications  
- Customizable sound playback
- TypeScript support
- Fast and lightweight

## Platform Support

- **macOS**: Full support including click-to-focus window functionality
- **Linux**: Notifications and sound (requires `notify-send` and audio player)
- **Windows**: Basic notification support

## Requirements

### macOS

#### Accessibility Permissions

For the click-to-focus feature to work, you need to grant accessibility permissions to your terminal application:

1. Open **System Settings** → **Privacy & Security** → **Privacy**
2. Select **Accessibility** from the list
3. Click the lock icon to make changes
4. Add and enable the application where you run Claude Code:
   - **Cursor**: If using Cursor's integrated terminal
   - **Terminal.app**: If using macOS Terminal
   - **iTerm2**: If using iTerm2
   - **VS Code**: If using VS Code's integrated terminal
   - Or whichever terminal application you use

**Note**: The notification may show "Terminal" as the app name, but you need to grant permissions to the actual application where Claude Code is running.

### Linux

- **Notifications**: Requires `notify-send` (usually pre-installed with desktop environments)
- **Sound**: Optional - supports `paplay` (PulseAudio), `aplay` (ALSA), or `play` (SoX)

### Windows

- Notifications work out of the box
- Sound uses system beep

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

### Troubleshooting

#### Click-to-focus not working

1. **Check accessibility permissions**: The most common issue is missing accessibility permissions. You'll see this error in the logs:
   ```
   System Events got an error: osascript is not allowed assistive access. (-25211)
   ```
   Solution: Grant accessibility permissions to your terminal app (see Requirements section above)

2. **Multiple windows**: If you have multiple Cursor/VS Code windows open, the tool tries to match by workspace name. Make sure your workspace folders have distinct names.

3. **Window title detection**: The tool looks for the workspace name in the window title. Some configurations might not show the workspace name clearly.

4. **Check logs**: Run `tail -f ~/.claude-notify/log.txt` to see detailed information about window detection and focusing attempts.

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