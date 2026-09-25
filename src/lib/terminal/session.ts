// One filesystem per page load, shared by the Terminal app and the desktop (files in ~/Desktop show as icons).
import type { VFS } from './vfs'
import { autosaveFs, DESKTOP, loadFs } from './seed'
import { CHANGELOG } from '../room/changelog'

let fs: VFS | null = null

export function getTerminalFs(readme: string): VFS {
  if (!fs) {
    fs = loadFs(readme, CHANGELOG.map((e) => e.date + '  ' + e.line).join('\n') + '\n')
    autosaveFs(fs)
  }
  return fs
}

/** Names of the plain files on the terminal's desktop (dotfiles hidden), sorted. */
export function desktopFiles(readme: string): { name: string; path: string }[] {
  const f = getTerminalFs(readme)
  try {
    return f.list(DESKTOP).filter((n) => !n.startsWith('.')).map((name) => ({ name, path: DESKTOP + '/' + name }))
  } catch { return [] }
}
