// tar / zip / unzip / gzip / gunzip / zcat over the private ahmed-archive format.
// Format: first line `!<ahmed-archive>` then a JSON object {entries:[{path,type,mode,data}]}.
import type { CmdCtx } from '../types'
import { VFS, FsError } from '../vfs'
import { modeString, formatMtime } from './fun-util'

export interface ArchiveEntry {
  path: string
  type: 'f' | 'd'
  mode: number
  data?: string
  mtime?: number
}

export const ARCHIVE_MAGIC = '!<ahmed-archive>'

export function encodeArchive(entries: ArchiveEntry[]): string {
  return ARCHIVE_MAGIC + '\n' + JSON.stringify({ entries }) + '\n'
}

export function decodeArchive(text: string): ArchiveEntry[] {
  const nl = text.indexOf('\n')
  if (nl < 0 || text.slice(0, nl) !== ARCHIVE_MAGIC) throw new Error('bad archive')
  const parsed: unknown = JSON.parse(text.slice(nl + 1))
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { entries?: unknown }).entries)) throw new Error('bad archive')
  return (parsed as { entries: ArchiveEntry[] }).entries
}

export function collectEntries(fs: VFS, abs: string, shown: string, recursive: boolean): ArchiveEntry[] {
  const n = fs.stat(abs)
  const path = shown.replace(/\\/g, '/').replace(/^\/+/, '')
  if (n.t === 'd') {
    const out: ArchiveEntry[] = [{ path: path === '' ? '/' : path + '/', type: 'd', mode: n.mode, mtime: n.mtime }]
    if (recursive) for (const name of fs.list(abs)) out.push(...collectEntries(fs, abs + '/' + name, path + '/' + name, true))
    return out
  }
  return [{ path, type: 'f', mode: n.mode, data: fs.readFile(abs), mtime: n.mtime }]
}

function ensureParent(fs: VFS, abs: string): void {
  const parent = VFS.dirname(abs)
  if (!fs.exists(parent)) fs.mkdir(parent, true)
}

export function writeEntries(ctx: CmdCtx, entries: ArchiveEntry[], verbose: boolean): number {
  for (const e of entries) {
    const rel = e.path.replace(/\\/g, '/').replace(/^\/+/, '')
    if (rel === '' || rel === '/') continue
    const target = ctx.resolve(rel)
    if (e.type === 'd') {
      if (!ctx.fs.isDir(target)) ctx.fs.mkdir(target, true)
    } else {
      ensureParent(ctx.fs, target)
      ctx.fs.writeFile(target, e.data ?? '')
      ctx.fs.chmod(target, e.mode & 0o7777)
    }
    if (verbose) ctx.out(e.path + '\n')
  }
  return 0
}

// ---- tar --------------------------------------------------------------------------------------------

export function runTar(ctx: CmdCtx): number {
  let mode: 'c' | 'x' | 't' = 't'
  let verbose = false
  let file = ''
  const operands: string[] = []
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i]
    if (a.startsWith('-') && a.length > 1) {
      let needFile = false
      for (let j = 1; j < a.length; j++) {
        const c = a[j]
        if (c === 'f') needFile = true
        else if (c === 'c' || c === 'x' || c === 't') mode = c
        else if (c === 'v') verbose = true
        else if (c === 'z' || c === 'j' || c === 'J' || c === 'a') continue
        else {
          ctx.err(`tar: invalid option -- '${c}'\n`)
          return 2
        }
      }
      if (needFile) {
        if (i + 1 >= ctx.args.length) {
          ctx.err('tar: option requires an argument -- f\n')
          return 2
        }
        file = ctx.args[++i]
      }
      continue
    }
    operands.push(a)
  }
  if (!file) {
    ctx.err('tar: archive file not specified\n')
    return 2
  }
  const target = ctx.resolve(file)
  if (mode === 'c') {
    if (operands.length === 0) {
      ctx.err('tar: Cowardly refusing to create an empty archive\n')
      return 2
    }
    const entries: ArchiveEntry[] = []
    for (const op of operands) {
      try {
        entries.push(...collectEntries(ctx.fs, ctx.resolve(op), op, true))
      } catch (e) {
        ctx.err(`tar: ${op}: ${e instanceof FsError ? e.reason : 'Cannot stat'}\n`)
        return 1
      }
    }
    ctx.fs.writeFile(target, encodeArchive(entries))
    if (verbose) for (const e of entries) ctx.out(e.path + '\n')
    return 0
  }
  let text: string
  try {
    text = ctx.fs.readFile(target)
  } catch (e) {
    ctx.err(`tar: ${file}: ${e instanceof FsError ? e.reason : 'Cannot open'}\n`)
    return 1
  }
  let entries: ArchiveEntry[]
  try {
    entries = decodeArchive(text)
  } catch {
    ctx.err(`tar: ${file}: This does not look like a tar archive\n`)
    return 1
  }
  if (mode === 't') {
    for (const e of entries) {
      if (verbose) {
        const size = e.type === 'f' ? (e.data ?? '').length : 0
        ctx.out(`${modeString(e.mode, e.type === 'd')} guest/guest ${String(size).padStart(6)} ${formatMtime(e.mtime ?? Date.now())} ${e.path}\n`)
      } else {
        ctx.out(e.path + '\n')
      }
    }
    return 0
  }
  return writeEntries(ctx, entries, verbose)
}

// ---- zip / unzip ------------------------------------------------------------------------------------

export function runZip(ctx: CmdCtx): number {
  let recursive = false
  const operands: string[] = []
  for (const a of ctx.args) {
    if (a === '-r') recursive = true
    else if (a.startsWith('-') && a.length > 1) {
      ctx.err(`zip: invalid option -- ${a}\n`)
      return 2
    } else operands.push(a)
  }
  if (operands.length < 2) {
    ctx.err('zip: usage: zip [-r] archive.zip file...\n')
    return 2
  }
  const file = operands[0]
  const entries: ArchiveEntry[] = []
  for (const op of operands.slice(1)) {
    const abs = ctx.resolve(op)
    let isDir = false
    try {
      isDir = ctx.fs.isDir(abs)
    } catch {
      isDir = false
    }
    if (isDir && !recursive) {
      ctx.err(`zip: ${op}: is a directory, use -r\n`)
      return 1
    }
    try {
      entries.push(...collectEntries(ctx.fs, abs, op, recursive))
    } catch (e) {
      ctx.err(`zip: ${op}: ${e instanceof FsError ? e.reason : 'No such file or directory'}\n`)
      return 1
    }
  }
  ctx.fs.writeFile(ctx.resolve(file), encodeArchive(entries))
  for (const e of entries) ctx.out(`  adding: ${e.path} (stored 0%)\n`)
  return 0
}

export function runUnzip(ctx: CmdCtx): number {
  let list = false
  let dest = ''
  const operands: string[] = []
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i]
    if (a === '-l') list = true
    else if (a === '-o') continue
    else if (a === '-d') {
      if (i + 1 >= ctx.args.length) {
        ctx.err('unzip: option requires an argument -- d\n')
        return 2
      }
      dest = ctx.args[++i]
    } else if (a.startsWith('-') && a.length > 1) {
      ctx.err(`unzip: invalid option -- ${a}\n`)
      return 2
    } else operands.push(a)
  }
  if (operands.length === 0) {
    ctx.err('unzip: missing archive file\n')
    return 2
  }
  const file = operands[0]
  ctx.out(`Archive:  ${file}\n`)
  let text: string
  try {
    text = ctx.fs.readFile(ctx.resolve(file))
  } catch (e) {
    ctx.err(`unzip: ${file}: ${e instanceof FsError ? e.reason : 'No such file or directory'}\n`)
    return 1
  }
  let entries: ArchiveEntry[]
  try {
    entries = decodeArchive(text)
  } catch {
    ctx.err(`unzip: ${file}: not a valid zip archive\n`)
    return 1
  }
  if (list) {
    ctx.out('  Length      Date    Time    Name\n')
    ctx.out('---------  ---------- -----   ----\n')
    let total = 0
    let count = 0
    for (const e of entries) {
      const size = e.type === 'f' ? (e.data ?? '').length : 0
      total += size
      count++
      ctx.out(`${String(size).padStart(9)}  ${formatMtime(e.mtime ?? Date.now())}   ${e.path}\n`)
    }
    ctx.out('---------                     -------\n')
    ctx.out(`${String(total).padStart(9)}                     ${count} file${count === 1 ? '' : 's'}\n`)
    return 0
  }
  const base = dest ? ctx.resolve(dest) : ctx.cwd
  if (dest && !ctx.fs.exists(base)) ctx.fs.mkdir(base, true)
  for (const e of entries) {
    const rel = e.path.replace(/\\/g, '/').replace(/^\/+/, '')
    if (rel === '' || rel === '/') continue
    const target = VFS.resolve(base, rel, ctx.env.HOME ?? '/home/guest')
    if (e.type === 'd') {
      if (!ctx.fs.isDir(target)) ctx.fs.mkdir(target, true)
      ctx.out(`   creating: ${e.path}\n`)
    } else {
      ensureParent(ctx.fs, target)
      ctx.fs.writeFile(target, e.data ?? '')
      ctx.fs.chmod(target, e.mode & 0o7777)
      ctx.out(`  inflating: ${e.path}\n`)
    }
  }
  return 0
}

// ---- gzip / gunzip / zcat ---------------------------------------------------------------------------

function readStdinAll(ctx: CmdCtx): Promise<string> {
  return ctx.stdin.readAll()
}

export async function runGzip(ctx: CmdCtx, decompress: boolean): Promise<number> {
  let keep = false
  let toStdout = false
  let force = false
  const files: string[] = []
  for (const a of ctx.args) {
    if (a === '-d') decompress = true
    else if (a === '-k') keep = true
    else if (a === '-c') toStdout = true
    else if (a === '-f') force = true
    else if (a.startsWith('-') && a.length > 1) {
      ctx.err(`gzip: invalid option -- '${a}'\n`)
      return 2
    } else files.push(a)
  }
  if (files.length === 0) {
    const input = await readStdinAll(ctx)
    if (decompress) {
      try {
        const entries = decodeArchive(input)
        if (entries.length !== 1 || entries[0].type !== 'f') throw new Error('bad')
        ctx.out(entries[0].data ?? '')
      } catch {
        ctx.err('gzip: stdin: not in gzip format\n')
        return 1
      }
      return 0
    }
    ctx.out(encodeArchive([{ path: '-', type: 'f', mode: 0o644, data: input, mtime: Date.now() }]))
    return 0
  }
  let status = 0
  for (const f of files) {
    const abs = ctx.resolve(f)
    if (decompress) {
      let text: string
      try {
        text = ctx.fs.readFile(abs)
      } catch (e) {
        ctx.err(`gzip: ${f}: ${e instanceof FsError ? e.reason : 'No such file or directory'}\n`)
        status = 1
        continue
      }
      let entries: ArchiveEntry[]
      try {
        entries = decodeArchive(text)
        if (entries.length !== 1 || entries[0].type !== 'f') throw new Error('bad')
      } catch {
        ctx.err(`gzip: ${f}: not in gzip format\n`)
        status = 1
        continue
      }
      const data = entries[0].data ?? ''
      const base = VFS.basename(f)
      const outName = base.endsWith('.gz') ? f.slice(0, -3) : f
      if (outName === f) {
        ctx.err(`gzip: ${f}: unknown suffix -- ignored\n`)
        status = 1
        continue
      }
      if (toStdout) {
        ctx.out(data)
      } else {
        const target = ctx.resolve(outName)
        if (ctx.fs.exists(target) && !force) {
          ctx.err(`gzip: ${outName} already exists; not overwritten\n`)
          status = 1
          continue
        }
        ctx.fs.writeFile(target, data)
        if (!keep) ctx.fs.remove(abs)
      }
    } else {
      let data: string
      try {
        data = ctx.fs.readFile(abs)
      } catch (e) {
        ctx.err(`gzip: ${f}: ${e instanceof FsError ? e.reason : 'No such file or directory'}\n`)
        status = 1
        continue
      }
      const outName = f + '.gz'
      if (toStdout) {
        ctx.out(encodeArchive([{ path: VFS.basename(f), type: 'f', mode: 0o644, data, mtime: Date.now() }]))
      } else {
        const target = ctx.resolve(outName)
        if (ctx.fs.exists(target) && !force) {
          ctx.err(`gzip: ${outName} already exists; not overwritten\n`)
          status = 1
          continue
        }
        ctx.fs.writeFile(target, encodeArchive([{ path: VFS.basename(f), type: 'f', mode: 0o644, data, mtime: Date.now() }]))
        if (!keep) ctx.fs.remove(abs)
      }
    }
  }
  return status
}

export async function runZcat(ctx: CmdCtx): Promise<number> {
  if (ctx.args.length === 0) {
    const input = await readStdinAll(ctx)
    try {
      const entries = decodeArchive(input)
      for (const e of entries) if (e.type === 'f') ctx.out(e.data ?? '')
    } catch {
      ctx.err('gzip: stdin: not in gzip format\n')
      return 1
    }
    return 0
  }
  let status = 0
  for (const f of ctx.args) {
    try {
      const entries = decodeArchive(ctx.fs.readFile(ctx.resolve(f)))
      for (const e of entries) if (e.type === 'f') ctx.out(e.data ?? '')
    } catch (e) {
      ctx.err(`gzip: ${f}: ${e instanceof FsError ? e.reason : 'not in gzip format'}\n`)
      status = 1
    }
  }
  return status
}


