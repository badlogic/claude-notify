# @mariozechner/claude-notify

A comprehensive notification system for Claude Code that tracks session status and displays notifications when Claude is waiting for input.

## Features

### macOS
- **Menu Bar Icon**: Shows Claude session count with badge
- **Control Center**: View all active sessions in one place
- **System Notifications**: Get notified when Claude is waiting
- **Session Tracking**: Automatically tracks working/idle status
- **Sound Alerts**: Plays Glass sound when Claude needs attention
- **Auto-Cleanup**: Removes dead sessions automatically

### Linux/Windows
- **Desktop Notifications**: Shows notifications with Claude's last message
- **Sound Alerts**: Plays system beep
- **Context Aware**: Displays the current working directory
- **Persistent Notifications**: On macOS with built-in alerter

## Platform Support

- **macOS**: Full daemon support with menu bar icon and control center
- **Linux**: Notifications (requires `notify-send`) and system beep
- **Windows**: Notifications with system beep

## Requirements

### macOS
- Works out of the box with built-in daemon and notifications
- Menu bar icon shows session count
- Control center accessible via menu bar click

### Linux
- **Notifications**: Requires `notify-send` (usually pre-installed with desktop environments)

### Windows
- Notifications work out of the box

## Installation

```bash
npm install -g @mariozechner/claude-notify
```

## Usage

### Quick Setup

After installation, run:

```bash
claude-notify -install
```

This will automatically add claude-notify to all Claude Code hooks (PreToolUse, PostToolUse, Stop, SubagentStop, and Notification).

### How It Works

#### On macOS
1. Claude Notify runs a background daemon that:
   - Shows a menu bar icon with the number of waiting sessions
   - Tracks all Claude Code sessions by PID
   - Updates session status based on hook activity
   - Sends system notifications when Claude is waiting
   - Provides a control center UI to view all sessions

2. Click the menu bar icon to:
   - View all active sessions
   - See session status (green = working, yellow = waiting)
   - Clear all sessions
   - Quit the daemon

#### On Linux/Windows
- Shows desktop notifications when Claude stops or sends notifications
- Plays notification sounds
- No daemon or menu bar (uses simple notifications)

### Test Notifications

To test if notifications are working correctly:

```bash
claude-notify -test
```

This will send a test notification and check your system configuration.

### Manual Setup

If you prefer to set it up manually, add this to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify PreToolUse"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify PostToolUse"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify Stop"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify SubagentStop"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify Notification"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

1. **Daemon not starting (macOS)**: Check daemon logs at `~/.claude-notify/daemon.log`
2. **Menu bar icon not appearing**: Ensure the daemon is running (`ps aux | grep ClaudeNotifyDaemon`)
3. **Notifications not appearing**: Check logs at `~/.claude-notify/log.txt`
4. **Sound not playing**: The tool uses system sounds (Glass on macOS, beep on Linux/Windows)
5. **Hook not triggering**: Verify hooks are properly configured in your Claude Code settings

## Development

See [docs/development.md](docs/development.md) for development setup and [docs/build.md](docs/build.md) for build instructions.

## License

MIT