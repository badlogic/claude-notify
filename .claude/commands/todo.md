Help the user implement the next open item in `docs/todo.md`.

Read README.md in full to get an understanding of the project.

You MUST follow these steps exactly:

0. Check if `docs/todo.md` exists:
    - Use LS tool to check if file exists
    - If not, create it with Write tool using template:
      ```
      ### Completed

      ### Open
      - [ ]
      ```

1. Present the user with the open todo items in `docs/todo.md`
    - Use the Bash tool with `rg` to search on which line `### Open` is located
    - Read the contents of the `docs/todo.md` file starting from that line in full
    - Present all open TODOs to the user as a numbered list with one-line summaries
    - STOP and ask: "Which TODO would you like to work on? (Enter number)"
    - Wait for user selection
    - Show the selected TODO verbatim as it appears in docs/todo.md
    - STOP and ask: "Would you like to refine this TODO before implementation? (yes/no)"
    - If no, skip to step 3

2. Refine the TODO (only if user said yes):

    a. Clarify the WHAT (functional/behavioral requirements):
       - Ask questions to understand what needs to be achieved
       - Continue until the description is clear and complete
       - Focus on behavior, not implementation
       - Once complete, present the clarified WHAT in the format for docs/todo.md
       - STOP and ask: "Is this description accurate? (yes/no)"
       - If no, continue clarifying

    b. Investigate the HOW (codebase analysis):
       - Launch parallel Task agents to investigate:
         * Where in the codebase changes are needed
         * What patterns/structures exist
         * Which files need modification
       - Task agents should return a concise list of:
         * File paths with line numbers
         * Type of change needed (add/modify/delete)
       - Present the HOW findings as a checkbox list in the format for docs/todo.md:
         * Each implementation step should be a checkbox: `- [ ] Step description`
       - STOP and ask: "Does this implementation plan look correct? (yes/no)"
       - If no, gather more information or adjust

    c. Present refined TODO:
       - Show the clarified WHAT + investigated HOW
       - This should be detailed enough for autonomous implementation
       - STOP and ask for confirmation before updating docs/todo.md
       - After user confirms:
         * Use Edit tool to replace the old TODO with the refined version
         * Maintain the same checkbox format: `- [ ] `
         * Only proceed to step 3 after successful update

3. Implement the TODO item:
    - Follow the coding style and patterns in the files you're modifying
    - Use the HOW section from the TODO as guidance (not strict rules)
    - As you complete each HOW item:
      * Use Edit tool to check off the corresponding checkbox in docs/todo.md
      * Change `- [ ]` to `- [x]` for completed steps
    - Feel free to explore other files and create new ones as needed
    - After modifying files, run appropriate checks:
      * TypeScript: `npm run check`
      * Swift: `npm run build:daemon`
      * Fix any issues before proceeding
    - Once implementation is complete:
      * Show all modified files to the user for review:
        - Use mcp__vs-claude__open with an array of all modified files:
          `[{"type": "gitDiff", "path": "/path/to/file1", "from": "HEAD", "to": "working"},
            {"type": "gitDiff", "path": "/path/to/file2", "from": "HEAD", "to": "working"}]`
        - STOP and ask: "Please review the changes. Ready to commit? (yes/no)"
      * After user confirms:
        - Commit all changes with a descriptive message
        - Push to remote repository
        - Get commit hash and construct GitHub URL:
          `https://github.com/[owner]/[repo]/commit/[hash]`
    - Update docs/todo.md:
      * Use Edit tool with replace_all=true to remove the TODO from ### Open section
        (replace the exact TODO string with empty string)
      * Use Edit tool to insert the FULL completed TODO at line 2:
        `- [x] [full TODO content including WHAT and HOW] ([commit URL])`