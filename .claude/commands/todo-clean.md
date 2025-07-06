# Todo Implementation Program

A structured workflow for implementing todo items from `docs/todo.md`. Each todo is worked on in isolation with full tracking inside `work/`, then moved to `done/` with commit history when complete. Enables concurrent work on multiple todos.

**IMPORTANT**: DO NOT use TodoRead/TodoWrite tools during this workflow. All task tracking happens through the filesystem.

## Inputs

**docs/todo.md** - User's todo list (any format):
```markdown
- Add dark mode toggle to settings
  - Should persist across sessions
  - Use system preference as default

Fix memory leak in WebSocket handler
  See issue #123
```

**docs/project-description.md** - Project context and commands (auto-generated, user-editable):
```markdown
# Project: Claude Code notifications

Shows system notifications when Claude Code sessions need user input.
TypeScript/Swift CLI tool with macOS daemon.

## Commands
- **Check**: `npm run check`
- **Test**: `npm test`
- **Build**: `npm run build`

## Structure
src/cli.ts          # CLI entry
src/mac/daemon.swift # Menu bar app
src/notifications.ts # Core logic
```

## State

**todos/work/[task-name]/task.md** - Active work in dedicated folders:
```markdown
# Add dark mode toggle to settings

**Status:** Refining -> In Progress -> Done
**Started:** 2025-01-06T10:45:00Z

## Description
Add theme toggle that persists using localStorage.

## Implementation Plan
- [x] Add toggle UI component (src/components/Settings.tsx:45)
- [x] Create theme context provider (src/components/ContextProvider.tsx - new file)
- [ ] Implement localStorage persistence
- [ ] Automated test: Verify persistence across sessions
- [ ] User test: Open app, verify toggle works

## Notes
- Found existing CSS variables to reuse
```

## Output
**project-description.md** - On first run, or any time the user asks to regenerate it
**todos/done/[task-name].md** - Completed task with history + commit link
**Git commits** - One commit per task with descriptive message
**Updated todo.md** - Completed items removed

## Workflow

### Phase 0: SETUP

1. **Read project description**: Read docs/project-description.md in full using Read tool

2. **If project description is missing**, create it:
   - Use parallel Task agents to analyze the codebase:
     - Detect language, framework, and build tools
     - Map directory structure and key files
     - Find entry points (main, index, app files)
     - Locate test files and test commands
     - Extract available commands from package.json/Makefile/etc
   - Present proposed project-description.md content to user
   - STOP: "Does this project description look correct? Any corrections needed?"
   - Write confirmed content to docs/project-description.md
   - Read docs/project-description.md in full using Read tool

3. **Ensure directory structure and check for orphaned tasks**:
   ```bash
   mkdir -p docs todos/work todos/done
   for d in todos/work/*/task.md; do
     [ -f "$d" ] || continue
     pid=$(grep "^**Claude PID:" "$d" | cut -d' ' -f3)
     [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1 && continue
     echo "- $(basename $(dirname "$d")): $(head -1 "$d" | sed 's/^# //')"
   done
   ```
   - If orphaned tasks exist, STOP: "Resume, reset, or ignore? (resume [task-name] / reset [task-name] / ignore all)"
     - **resume [task-name]**: Read task.md, check Status field:
       - If "Refining": Continue from Phase 2 where it left off
       - If "In Progress": Continue from Phase 3, first unchecked item
     - **reset [task-name]**: Delete todos/work/[task-name]/, add todo back to docs/todo.md, continue to Phase 1
     - **ignore all**: Continue to Phase 1 (leaves orphaned tasks as-is)

### Phase 1: SELECT

1. **Read todos**: Read docs/todo.md in full using Read tool

2. **Present todos**: Present numbered one-line summaries of each todo to user

3. **Get user selection**:
   - STOP:
      - If no todos: "No todos found in docs/todo.md"
      - Otherwise: "Which todo would you like to work on? (enter number)"

4. **Generate task folder name**:
   Create unique folder name with format: `YYYY-MM-DD-HH-MM-SS-brief-task-title`
   Example: `2025-01-06-14-30-45-add-dark-mode-toggle`

5. **Initialize work folder**:
   - Create todos/work/[task-name]/ directory
   - Create todos/work/[task-name]/task.md with:
     ```markdown
     # [Original todo text]

     **Status:** Refining
     **Created:** [timestamp]
     **Claude PID:** $PPID

     ## Original Todo
     [Full original todo including any sub-items]
     ```
   - Remove selected todo from docs/todo.md
   - TODO: Handle concurrent edits to todo.md (file locking?). Low probability.

### Phase 2: REFINE

1. **Refine Description (WHAT)**:
   - Use parallel Task agents to understand current functionality:
     * "What does the app currently do regarding [feature/bug area]?"
     * "What existing features might be related?"
   - Ask clarifying questions based on findings
   - Present description to the user
   - STOP: "Use this description? (y/n)"

2. **Define implementation plan (HOW)**:
   - Use parallel Task agents to investigate:
     * Where in the codebase changes are needed
     * What patterns/structures exist
     * Which files need modification
   - Ask clarifying questions based on findings
   - Present implementation plan to user
     * Code modifications steps: "- [ ] ... (src/file.ts:90-102)"
     * Automated test steps: "- [ ] Automated test: ..."
     * User test steps: "- [ ] User test: ..."
   - STOP: "Use this implementation plan? (y/n)"

3. **Final confirmation**:
   - Present the full task.md content to user
   - STOP: "Use this description and implementation plan? (y/n)"
   - Update task.md with refined Description and Implementation Plan sections
   - Commit task.md with message: "Refined plan for: [task-name]"

### Phase 3: IMPLEMENT

1. **Update status** to "In Progress" with timestamp in task.md

2. **Execute implementation plan**:
   - Work through checkboxes sequentially until user tests
   - Update checkbox to [x] as completed
   - Add new steps if discovered
   - Capture important findings in Notes in task.md

3. **Run checks** after changes:
   - Run any relevant commands from project-description.md (Check, Lint, Format, Test, Build, etc.)
   - Fix any issues before continuing

### Phase 4: COMPLETE

1. **Show changes** for review (git diff via mcp__vs-claude__open)

2. **Present user test steps** from implementation plan

3. STOP: "Please review the changes and run the user tests. Ready to commit? (y/n)"

4. **If approved**:
   - Move todos/work/[task-name]/task.md to todos/done/[task-name].md
   - Remove empty todos/work/[task-name]/ directory
   - Commit with descriptive message
   - Get commit URL
   - Update task.md:
      - Status: Done
      - **Commit:** https://github.com/[owner]/[repo]/commit/[hash]
   - Amend commit to include task.md changes
   - Push

5. **Clean up**:
   - Commit and push the updated todo.md

6. STOP: "Task complete! Continue with next todo? (y/n)"