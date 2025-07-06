# Improve logging to ~/.claude-notify/log.txt. No need to show the daemon shit. Hook shows pid/ppid, sessionId, and should show first 100 chars of message if any (last user message for Stop/Notification, tool name + input + result, whatever we can get)

**Status:** Refining
**Created:** 2025-07-07T00:57:00Z
**Agent PID:** 77782

## Description
The current logging implementation logs too many daemon connection status messages and doesn't include the actual message content that Claude is processing. This makes logs verbose with unhelpful information while missing the crucial details needed for debugging.

The improvement will:
1. Only log daemon start and daemon-related errors (removing "Daemon is already running", "Connected to daemon", "Message sent to daemon")
2. Add the message content (first 100 characters) to the existing hook log line in sendNotification()
3. Keep logs concise and informative for debugging

## Implementation Plan
- [ ] Remove/comment log line "Daemon is already running" (src/daemon-client.ts:76)
- [ ] Remove/comment log line "Connected to daemon" (src/daemon-client.ts:134)
- [ ] Remove/comment log line "Message sent to daemon" (src/daemon-client.ts:64)
- [ ] Keep "Starting daemon..." and "Daemon started with PID:" logs (src/daemon-client.ts:106,125)
- [ ] Keep all error logs in daemon-client.ts
- [ ] Update hook log line in sendNotification to include message preview (src/notifications.ts:13-15)
- [ ] Truncate message to first 100 characters if longer
- [ ] Add message at end of existing log line format
- [ ] Automated test: Run npm run check to ensure no TypeScript/lint errors
- [ ] User test: Trigger various Claude hooks and verify log output shows message content
- [ ] User test: Verify daemon logs only appear on startup and errors

## Original Todo
- [ ] Improve logging to ~/.claude-notify/log.txt. No need to show the daemon shit. Hook shows pid/ppid, sessionId, and should show first 100 chars of message if any (last user message for Stop/Notification, tool name + input + result, whatever we can get)
    [2025-07-06T22:48:51.104Z] Daemon is already running
    [2025-07-06T22:48:51.105Z] Connected to daemon
    [2025-07-06T22:48:51.105Z] Message sent to daemon