# Backlog.md Analysis and Comparison with todo-clean.md

## Overview

This document analyzes the Backlog.md repository and compares it with the todo-clean.md workflow system.

## Backlog.md Architecture

### Core Design Principles

- **File-based architecture**: Tasks are stored as individual Markdown files in a `backlog/` directory structure
- **Git-integrated**: Leverages Git for version control, collaboration, and distributed workflows
- **CLI-first design**: Primary interface is a command-line tool built with Bun and TypeScript
- **Local-first approach**: All data lives in the repository, no external database or cloud dependencies
- **Modular structure**: Clean separation between core logic, file system operations, Git operations, and UI components

### Key Components

- `Core` class: Central orchestrator for task operations
- `FileSystem`: Handles all file I/O operations
- `GitOperations`: Manages Git interactions
- TUI components: Terminal UI using blessed library
- Web server: Embedded HTTP server for browser interface

## Detailed Comparison: todo-clean.md vs Backlog.md

### 1. Agent Spawning Approach

| Aspect | todo-clean.md | Backlog.md |
|--------|---------------|------------|
| **Agent Type** | Uses Claude's Task agents explicitly | No agent spawning - CLI tool for humans/AI |
| **Spawning Method** | Parallel Task agents for analysis:<br>- "Detect language, framework"<br>- "Map directory structure"<br>- "Find entry points"<br>- "Locate test files" | No built-in agent spawning<br>Guidelines suggest AI agents use CLI |
| **Agent Coordination** | Explicit parallel execution phases | No agent coordination mechanism |
| **Agent Persistence** | Tracks Claude PID (`$PPID`) in task.md | No agent tracking |

**Key Difference**: todo-clean.md is designed as an AI-native workflow with explicit agent spawning, while Backlog.md is a human-first CLI tool that AI agents can use.

### 2. Human-in-the-Loop

| Aspect | todo-clean.md | Backlog.md |
|--------|---------------|------------|
| **Interaction Points** | Multiple STOP points:<br>- Project description approval<br>- Todo selection<br>- Description refinement<br>- Implementation plan approval<br>- Final confirmation<br>- Commit approval | Minimal interaction:<br>- User creates/edits tasks<br>- User manages workflow<br>- No built-in approval gates |
| **Approval Flow** | Structured gates requiring "y/n" | User-driven actions |
| **UI/UX** | Text-based prompts | Interactive TUI + Web UI |
| **Feedback Loop** | Built into workflow phases | Through task comments/notes |

**Key Difference**: todo-clean.md enforces human approval at every major step, while Backlog.md trusts users/agents to manage their own workflow.

### 3. Concurrency Model

| Aspect | todo-clean.md | Backlog.md |
|--------|---------------|------------|
| **Task Isolation** | Dedicated work folders:<br>`todos/work/[task-name]/` | Shared markdown files:<br>`backlog/tasks/task-*.md` |
| **Parallel Work** | Orphan detection via PID tracking | Git-based conflict resolution |
| **Locking** | Process-based (PID check) | File-based (Git) |
| **Conflict Resolution** | Resume/reset/ignore orphaned tasks | `most_progressed` or `most_recent` strategy |

**Key Difference**: todo-clean.md uses process isolation for concurrent work, while Backlog.md relies on Git for managing concurrent edits.

### 4. Distributed Workflow

| Aspect | todo-clean.md | Backlog.md |
|--------|---------------|------------|
| **Multi-user Support** | Single-agent focused<br>PID tracking assumes single machine | Git-native multi-branch support |
| **Remote Collaboration** | Not built-in | Remote branch task loading:<br>- Fetches tasks from all branches<br>- Merges remote tasks locally |
| **Task Discovery** | Local filesystem only | Cross-branch task discovery |
| **Synchronization** | No sync mechanism | Git push/pull + remote task loading |

**Key Difference**: Backlog.md is designed for distributed teams using Git, while todo-clean.md is optimized for single-agent workflows.

### 5. Context Gathering

| Aspect | todo-clean.md | Backlog.md |
|--------|---------------|------------|
| **Automated Analysis** | Parallel Task agents gather context:<br>- Language/framework detection<br>- Directory mapping<br>- Command extraction | Manual context in task descriptions |
| **Project Understanding** | Auto-generates project-description.md | User maintains docs/ and decisions/ |
| **Task Refinement** | Two-phase refinement:<br>1. WHAT (description)<br>2. HOW (implementation plan) | Single-phase task creation<br>Optional implementation plan |
| **Context Storage** | Structured in task.md:<br>- Description<br>- Implementation Plan<br>- Notes | Markdown sections:<br>- Description<br>- Acceptance Criteria<br>- Implementation Plan/Notes |

**Key Difference**: todo-clean.md automates context gathering through AI agents, while Backlog.md relies on human input for context.

## Implementation Insights

### Backlog.md's Concurrency Approach

The system uses sophisticated concurrency patterns:

- **Parallel loading**: Tasks from multiple Git branches are loaded concurrently using `Promise.all()`
- **Background pre-loading**: Kanban data is pre-fetched while users interact with task views
- **Abort controllers**: Loading operations can be cancelled if users switch views
- **Caching strategy**: 30-second TTL cache for expensive operations
- **No thread spawning**: Uses JavaScript's event loop and promises for concurrency, not OS threads

Example from `ViewSwitcher`:
```typescript
// Load local and remote tasks in parallel
const [localTasks, remoteTasks] = await Promise.all([
    this.core.listTasksWithMetadata(),
    loadRemoteTasks(this.core.gitOps, this.core.filesystem, this.onProgress),
]);
```

### todo-clean.md's Agent Approach

The workflow explicitly leverages Claude's Task agents for parallel analysis:

```markdown
- Use parallel Task agents to analyze the codebase:
  - Detect language, framework, and build tools
  - Map directory structure and key files
  - Find entry points (main, index, app files)
  - Locate test files and test commands
  - Extract available commands from package.json/Makefile/etc
```

## Emulating todo-clean.md with Backlog.md

### Workflow Adaptation

To use Backlog.md in a similar way to todo-clean.md:

1. **Task Selection**: Use `backlog list --plain` or the TUI instead of reading todo.md
2. **Task Refinement**: Create detailed tasks with implementation plans using `backlog create`
3. **Work Isolation**: Use assignee field with session IDs (e.g., `claude-session-$PPID`)
4. **Progress Tracking**: Update task status and append implementation notes
5. **Completion**: Archive tasks and reference them in commit messages

### Required Workarounds

1. **Agent Spawning**: Use shell scripts to coordinate parallel analysis tasks
2. **Approval Gates**: Create wrapper scripts that add STOP points for human confirmation
3. **PID Tracking**: Repurpose the assignee field for session tracking
4. **Project Description**: Maintain manually in docs/PROJECT.md

### Example Wrapper Script

```bash
#!/bin/bash
# task-workflow.sh
echo "Selected task: $1"
read -p "Approve this task? (y/n): " approval
[[ $approval != "y" ]] && exit 1

SESSION_ID="claude-$$-$(date +%s)"
backlog edit $1 --assignee "$SESSION_ID" --status "In Progress"

# Implementation phase...

read -p "Ready to commit? (y/n): " commit_approval
[[ $commit_approval == "y" ]] && backlog archive $1
```

## Conclusions

### Fundamental Differences

1. **todo-clean.md** is an **AI-first workflow system** that:
   - Orchestrates multiple AI agents in parallel
   - Enforces strict human approval gates
   - Uses process isolation for concurrency
   - Optimized for single-machine, single-agent use
   - Automates context gathering and analysis

2. **Backlog.md** is a **human-first task management tool** that:
   - Provides CLI/TUI/Web interfaces for task management
   - Trusts users to manage their own workflow
   - Uses Git for concurrency and distribution
   - Supports multi-user, multi-branch collaboration
   - Requires manual context entry

### Key Insight

The fundamental difference is that todo-clean.md is designed to be **executed by AI agents** with human oversight, while Backlog.md is designed to be **used by humans** (or AI agents acting like humans) with Git integration. While Backlog.md can be adapted for AI-driven workflows, it would require additional scripting to match the structured, approval-gated workflow that todo-clean.md provides natively.