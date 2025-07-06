# @mariozechner/claude-notify

Get system notifications when Claude Code needs your input.

## Installation

```bash
npm install -g @mariozechner/claude-notify
claude-notify -install
```

That's it. Test with `claude-notify -test`.

## What it does

- System notifications when Claude stops and needs input
- Shows Claude's last message
- Plays notification sound

### macOS extras
- Menu bar icon with session count waiting for input
- Control center to view all sessions
- Session status tracking (working/waiting)

## Disable for a session

```bash
CLAUDE_NOTIFY_OFF=1 claude [your command]
```

## Troubleshooting

- **Not working**: Check `~/.claude-notify/log.txt`
- **macOS daemon issues**: Check `~/.claude-notify/daemon.log`
- **Linux notifications**: Requires `notify-send`

## Development

See [docs/development.md](docs/development.md) for development setup and [docs/build.md](docs/build.md) for build instructions.

## License

MIT