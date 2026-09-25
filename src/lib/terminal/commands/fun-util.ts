// Shared helpers for the fun command family.
import type { CmdCtx } from '../types'

/** Read all stdin text (may be empty). */
export async function readStdin(ctx: CmdCtx): Promise<string> {
  return ctx.stdin.readAll()
}

/** Print usage for --help and return true. */
export function help(ctx: CmdCtx, usage: string): boolean {
  ctx.out(usage + '\n')
  return true
}

export function printHelpIfAsked(ctx: CmdCtx, usage: string): boolean {
  if (ctx.args.includes('--help') || ctx.args.includes('-h')) {
    ctx.out(usage + '\n')
    return true
  }
  return false
}

/** Join remaining args; falls back to stdin when empty. */
export async function argsOrStdin(ctx: CmdCtx): Promise<string> {
  if (ctx.args.length > 0) return ctx.args.join(' ')
  return readStdin(ctx)
}

export function isIntegerString(s: string): boolean {
  return /^[+-]?[0-9]+$/.test(s)
}

export function toInt(s: string): number {
  return parseInt(s, 10)
}

/** Right-align a number in `width` columns. */
export function padNum(n: number, width: number): string {
  return String(n).padStart(width)
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

/** Cap runaway generators; returns true when the limit has been reached. */
export function outputCap(count: number, max = 20000): boolean {
  return count >= max
}

/** Module load time, used for neofetch uptime. */
export const PAGE_LOAD_AT = Date.now()
