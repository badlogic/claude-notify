# we also want to display something instead of no message when a session is in the working state

**Status:** In Progress
**Created:** 2025-07-06T23:13:52
**Started:** 2025-01-06T23:21:00Z
**Agent PID:** 56810

## Original Todo
- [ ] we also want to display something instead of no message when a session is in the working state

## Description
Currently, `getTranscriptInfo` only reads the transcript file. When Claude is in the "working" state, we have no context about what's happening.

We should:
1. Pass the full hook data to `getTranscriptInfo` (not just transcript_path)
2. For PreToolUse/PostToolUse hooks: Create a simple message like:
   - `"PreToolUse: [tool_name] - [first 200 chars of JSON.stringify(tool_input)]"`
   - `"PostToolUse: [tool_name] - [success/failure if available]"`
3. For other hooks: Fall back to transcript parsing as before
4. Rename `lastMessage` to `message` in the TranscriptInfo interface
5. Truncate any message to ~200 characters with "..." if needed

This gives users a generic but informative view of what's happening during the working state, without needing to know about specific tools.

## Implementation Plan
- [ ] Update HookInput interface in cli.ts to include all hook data fields (cli.ts:7-11)
- [ ] Modify getTranscriptInfo to accept full hook data instead of just transcript_path (transcript.ts:62)
- [ ] Add logic to generate contextual messages for PreToolUse/PostToolUse hooks (transcript.ts:62-69)
- [ ] Rename lastMessage to message in TranscriptInfo interface (transcript.ts:21)
- [ ] Update all references to lastMessage throughout the codebase (cli.ts, notifications.ts, daemon-client.ts)
- [ ] Automated test: Run npm run check to ensure TypeScript compilation passes
- [ ] User test: Run claude-notify -test to verify notifications still work
- [ ] User test: Test with actual Claude Code session to see working state messages

## Notes