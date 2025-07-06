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
- [x] Update HookInput interface in cli.ts to include all hook data fields (cli.ts:7-11)
- [x] Modify getTranscriptInfo to accept full hook data instead of just transcript_path (transcript.ts:62)
- [x] Add logic to generate contextual messages for PreToolUse/PostToolUse hooks (transcript.ts:62-69)
- [x] Rename lastMessage to message in TranscriptInfo interface (transcript.ts:21)
- [x] Update all references to lastMessage throughout the codebase (cli.ts, notifications.ts, daemon-client.ts)
- [x] Automated test: Run npm run check to ensure TypeScript compilation passes
- [x] User test: Run claude-notify -test to verify notifications still work  
- [x] User test: Test with actual Claude Code session to see working state messages

## Notes
- Simplified message format to not include hook type prefix (e.g., "Read: {file_path...}" instead of "PreToolUse: Read - {file_path...}")
- Discovered that PostToolUse hooks DO include full tool_input data (documentation was incomplete)
- Implemented showing tool input context in PostToolUse messages (e.g., "Grep: {"pattern":"test"} - success" instead of just "Grep: success")
- Moved 200 char limit from transcript.ts to notification layer:
  - macOS system notifications: truncated to 200 chars with "..."
  - macOS control window: full message displayed with no character limit
  - Linux/Windows notifications: truncated to 200 chars with "..."
- Fixed SwiftUI Text view to properly display newlines in control window messages