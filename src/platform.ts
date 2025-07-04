import { platform } from 'node:os'

export const PLATFORM = platform()
export const IS_MACOS = PLATFORM === 'darwin'
export const IS_LINUX = PLATFORM === 'linux'
export const IS_WINDOWS = PLATFORM === 'win32'

export function getPlatformName(): string {
  switch (PLATFORM) {
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'Linux'
    case 'win32':
      return 'Windows'
    default:
      return PLATFORM
  }
}