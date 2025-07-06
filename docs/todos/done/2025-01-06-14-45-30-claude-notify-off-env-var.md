# If a special env var is present (.e.g CLAUDE_NOTIFY_OFF), do not process hooks in cli.ts.

**Status:** In Progress
**Created:** 2025-01-06T14:45:30
**Started:** 2025-01-06T21:45:00Z
**Agent PID:** 49960

## Original Todo
- [ ] If a special env var is present (.e.g CLAUDE_NOTIFY_OFF), do not process hooks in cli.ts.

## Description
Add support for an environment variable `CLAUDE_NOTIFY_OFF` that, when set, will cause claude-notify to exit immediately without processing any hooks. This provides users with a quick way to temporarily disable all Claude notifications without needing to modify their Claude settings or uninstall hooks.

## Implementation Plan
- [x] Add environment variable check at the beginning of main() function (src/cli.ts:72-75)
  - Check for `process.env.CLAUDE_NOTIFY_OFF`
  - Exit with status 0 if present (any truthy value)
  - Place before any hook processing or argument parsing
- [x] Automated test: Run `npm run check` to verify TypeScript and linting pass
- [ ] User test: Set `CLAUDE_NOTIFY_OFF=1` and verify claude-notify exits silently
- [ ] User test: Run without the env var and verify normal operation continues

## Notes