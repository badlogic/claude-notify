# Building Claude Notify

This guide covers building Claude Notify from source.

## Prerequisites

### All Platforms
- **Node.js 18+** and npm
- **Git** for cloning the repository

### macOS (for daemon)
- **Xcode Command Line Tools** or full Xcode installation
- **Swift 5.9+** (included with Xcode)

Note: The build will automatically use ad-hoc signing if developer certificates are not available.

## Build Commands

### Quick Build
```bash
npm install    # Install dependencies
npm run build  # Build everything
```

### Individual Components

#### TypeScript/JavaScript
```bash
npm run build  # Runs TypeScript check, tsup, and daemon build
npm run dev    # Watch mode for TypeScript changes
npm run check  # Run linter and type checker
```

#### macOS Daemon
```bash
npm run build:daemon                    # Build debug version
bash scripts/build-daemon.sh debug      # Build debug version directly
bash scripts/build-daemon.sh release    # Build release version (requires signing cert)
```

## Build Process Details

### TypeScript Build (tsup)
1. Type checks with `tsc --noEmit`
2. Bundles CLI and library with tsup
3. Outputs to `dist/` directory:
   - `cli.js` - CLI executable
   - `index.js` - Library entry point
   - Type definitions (`.d.ts` files)

### macOS Daemon Build
1. Uses Swift Package Manager to compile `src/mac/macos-daemon.swift`
2. Creates app bundle at `dist/ClaudeNotifyDaemon.app`
3. Copies resources:
   - `src/mac/Info.plist` → app bundle
   - Binary from `.build/debug/` → app bundle
4. Code signs the app bundle (debug or release)

## Build Output

```
dist/
├── ClaudeNotifyDaemon.app/    # macOS daemon app bundle
├── cli.js                     # CLI entry point
├── index.js                   # Library entry point
└── *.d.ts                     # TypeScript definitions

.build/                        # Swift Package Manager build artifacts
```

## Running the Built Application

### CLI
```bash
./dist/cli.js --help           # Run CLI directly
npm link                       # Install globally for development
claude-notify --help           # Run installed CLI
```

### macOS Daemon
```bash
# Run directly
./dist/ClaudeNotifyDaemon.app/Contents/MacOS/ClaudeNotifyDaemon

# Or open as app
open dist/ClaudeNotifyDaemon.app
```

## Cleaning

```bash
npm run clean  # Remove all build artifacts
```

Removes:
- `dist/` - All build outputs
- `.build/` - Swift Package Manager artifacts
- `~/.claude-notify/*.log` - Runtime logs

## Troubleshooting

### TypeScript Build Fails
- Run `npm run check` to see linting/type errors
- Ensure Node.js 18+ is installed: `node --version`

### Swift Build Fails
- Ensure Xcode Command Line Tools: `xcode-select --install`
- Check Swift version: `swift --version`
- For "missing macOS SDK" errors: `sudo xcode-select -s /Applications/Xcode.app`

### Code Signing Issues
- The build automatically detects available certificates
- Falls back to ad-hoc signing if certificates aren't found
- Ad-hoc signed apps work locally but can't be distributed
- For distribution, you need a "Developer ID Application" certificate

## Development Workflow

1. Run `npm run dev` in one terminal for TypeScript watch mode
2. Make changes to TypeScript files
3. For Swift changes, run `npm run build:daemon`
4. Test with `npm link` and `claude-notify` commands
5. Check code: `npm run check`