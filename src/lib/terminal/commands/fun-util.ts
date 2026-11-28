// Shared helpers for the fun command family.
import type { CmdCtx } from '../types'

/** Print usage for --help and return true. */
export function help(ctx: CmdCtx, usage: string): boolean {
  ctx.out(usage + '\n')
  return true
}

/** Unix permission bits to an `ls -l` style mode string. */
export function modeString(mode: number, isDir: boolean): string {
  const bits = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']
  return (isDir ? 'd' : '-') + bits[(mode >> 6) & 7] + bits[(mode >> 3) & 7] + bits[mode & 7]
}

/** Format an epoch-ms timestamp like `2026-09-25 12:34`. */
export function formatMtime(mtime: number): string {
  const d = new Date(mtime)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Module load time, used for neofetch uptime. */
export const PAGE_LOAD_AT = Date.now()
