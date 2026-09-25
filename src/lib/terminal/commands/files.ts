// Filesystem commands: ls, cat, cp, mv, find, du, ... Behaviour mirrors GNU coreutils closely.
import type { Cmd, CmdCtx, CmdInfo, CmdModule } from '../types'
import { FsError, MAX_TOTAL_BYTES, VFS } from '../vfs'
import type { Node } from '../vfs'
import { matchGlob } from '../glob'
import { compilePosix } from '../regex'
import { unescape } from '../printf'

// ---- shared helpers -----------------------------------------------------------------------------

const errReason = (e: unknown): string => (e instanceof FsError ? e.reason : 'Unknown error')

function fail(ctx: CmdCtx, cmd: string, msg: string, status = 1): number {
  ctx.err(`${cmd}: ${msg}\n`)
  return status
}

function badOpt(ctx: CmdCtx, cmd: string, msg: string): number {
  ctx.err(`${cmd}: ${msg}\n`)
  ctx.err(`Try '${cmd} --help' for more information.\n`)
  return 2
}

function usageOk(ctx: CmdCtx, cmd: string): number {
  ctx.out(info[cmd].usage + '\n')
  return 0
}

interface ArgSpec {
  bool?: string
  val?: string
  long?: Record<string, string>
  longVal?: Record<string, string>
  longOpt?: Record<string, string>
}

type ArgResult = { opts: Record<string, string | true>; rest: string[]; order: string[] } | { err: string } | { help: true }

function parseArgs(args: string[], spec: ArgSpec = {}): ArgResult {
  const bool = spec.bool ?? ''
  const val = spec.val ?? ''
  const long = spec.long ?? {}
  const longVal = spec.longVal ?? {}
  const longOpt = spec.longOpt ?? {}
  const opts: Record<string, string | true> = {}
  const rest: string[] = []
  const order: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--') { rest.push(...args.slice(i + 1)); return { opts, rest, order } }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq < 0 ? a.slice(2) : a.slice(2, eq)
      if (name === 'help') return { help: true }
      const key = long[name]
      if (key !== undefined) {
        if (eq >= 0) return { err: `option '--${name}' doesn't allow an argument` }
        opts[key] = true
        order.push(key)
        continue
      }
      const ok = longOpt[name]
      if (ok !== undefined) {
        opts[ok] = eq < 0 ? true : a.slice(eq + 1)
        order.push(ok)
        continue
      }
      const vk = longVal[name]
      if (vk !== undefined) {
        if (eq >= 0) opts[vk] = a.slice(eq + 1)
        else if (i + 1 < args.length) opts[vk] = args[++i]
        else return { err: `option '--${name}' requires an argument` }
        order.push(vk)
        continue
      }
      return { err: `unrecognized option '--${name}'` }
    }
    if (a.length > 1 && a[0] === '-') {
      for (let j = 1; j < a.length; j++) {
        const c = a[j]
        if (bool.includes(c)) { opts[c] = true; order.push(c); continue }
        if (val.includes(c)) {
          const t = a.slice(j + 1)
          if (t !== '') { opts[c] = t; order.push(c); break }
          if (i + 1 < args.length) { opts[c] = args[++i]; order.push(c); break }
          return { err: `option requires an argument -- '${c}'` }
        }
        return { err: `invalid option -- '${c}'` }
      }
      continue
    }
    rest.push(a)
  }
  return { opts, rest, order }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SIX_MONTHS = 6 * 30.436875 * 24 * 3600 * 1000

function lsDate(ms: number, now = Date.now()): string {
  const d = new Date(ms)
  const md = `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')}`
  if (now - ms > SIX_MONTHS || ms - now > 60 * 60 * 1000) return `${md}  ${d.getFullYear()}`
  return `${md} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function humanSize(n: number): string {
  if (n < 1024) return String(n)
  const units = ['K', 'M', 'G', 'T', 'P']
  let v = n
  let u = -1
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return (v >= 10 ? String(Math.round(v)) : v.toFixed(1)) + units[u]
}

function modeStr(node: Node): string {
  const m = node.mode & 0o777
  let s = node.t === 'd' ? 'd' : '-'
  for (let shift = 6; shift >= 0; shift -= 3) {
    const bits = (m >> shift) & 7
    s += bits & 4 ? 'r' : '-'
    s += bits & 2 ? 'w' : '-'
    s += bits & 1 ? 'x' : '-'
  }
  return s
}

function fakeInode(abs: string): number {
  let h = 0
  for (let i = 0; i < abs.length; i++) h = (h * 31 + abs.charCodeAt(i)) >>> 0
  return h + 1
}

function nameKey(n: string): string { return n.replace(/^\.+/, '').toLowerCase() }

function sortNames(names: string[]): string[] {
  return names.slice().sort((a, b) => {
    const ka = nameKey(a)
    const kb = nameKey(b)
    if (ka < kb) return -1
    if (ka > kb) return 1
    return a < b ? -1 : a > b ? 1 : 0
  })
}

// ---- ls -----------------------------------------------------------------------------------------

interface LsEntry {
  shown: string
  colored: string
  width: number
  size: number
  hsize: string
  blocks: number
  ino: string
  node: Node
}

function colorizeName(node: Node, plain: string, on: boolean): string {
  if (!on) return plain
  if (node.t === 'd') return `\x1b[01;34m${plain}\x1b[0m`
  if ((node.mode & 0o111) !== 0) return `\x1b[01;32m${plain}\x1b[0m`
  return plain
}

function indicator(node: Node, classify: boolean): string {
  if (!classify) return ''
  if (node.t === 'd') return '/'
  if ((node.mode & 0o111) !== 0) return '*'
  return ''
}

const lsCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'aAlhR1dtSrFisXmC',
    long: {
      all: 'a', 'almost-all': 'A', long: 'l', 'human-readable': 'h', recursive: 'R',
      directory: 'd', reverse: 'r', classify: 'F', inode: 'i', size: 's',
    },
    longOpt: { color: 'color' },
  })
  if ('help' in p) return usageOk(ctx, 'ls')
  if ('err' in p) return badOpt(ctx, 'ls', p.err)
  const o = p.opts
  let sort = ''
  for (const k of p.order) if (k === 't' || k === 'S' || k === 'X') sort = k
  const when = o.color === true ? 'always' : o.color === undefined ? 'auto' : String(o.color)
  const colorOn = when === 'always' || (when !== 'never' && ctx.isTTYOut)
  const showAll = o.a === true
  const showHidden = showAll || o.A === true

  const operands = p.rest.length ? p.rest : ['.']
  const files: { shown: string; abs: string; node: Node }[] = []
  const dirs: { shown: string; abs: string; node: Node }[] = []
  let status = 0
  for (const op of operands) {
    const abs = ctx.resolve(op)
    const node = ctx.fs.get(abs)
    if (!node) {
      ctx.err(`ls: cannot access '${op}': ${errReason(new FsError('ENOENT', abs))}\n`)
      status = 2
      continue
    }
    if (o.d) files.push({ shown: op, abs, node })
    else if (node.t === 'd') dirs.push({ shown: op, abs, node })
    else files.push({ shown: op, abs, node })
  }

  const cmpEntries = (a: LsEntry, b: LsEntry): number => {
    let c = 0
    if (sort === 't') c = b.node.mtime - a.node.mtime
    else if (sort === 'S') c = b.size - a.size
    else if (sort === 'X') {
      const ea = a.shown.includes('.') ? a.shown.slice(a.shown.lastIndexOf('.') + 1) : ''
      const eb = b.shown.includes('.') ? b.shown.slice(b.shown.lastIndexOf('.') + 1) : ''
      c = nameKey(ea) < nameKey(eb) ? -1 : nameKey(ea) > nameKey(eb) ? 1 : 0
    }
    if (c === 0) {
      const ka = nameKey(a.shown)
      const kb = nameKey(b.shown)
      c = ka < kb ? -1 : ka > kb ? 1 : a.shown < b.shown ? -1 : a.shown > b.shown ? 1 : 0
    }
    return o.r ? -c : c
  }

  const printOne = (e: LsEntry): void => { ctx.out(e.colored + '\n') }
  const printColumns = (items: LsEntry[], cols: number): void => {
    if (items.length === 0) return
    const maxW = Math.max(...items.map((it) => it.width))
    const cw = maxW + 2
    const ncols = Math.max(1, Math.floor(cols / cw))
    const rows = Math.ceil(items.length / ncols)
    for (let r = 0; r < rows; r++) {
      let line = ''
      for (let c = 0; c < ncols; c++) {
        const idx = c * rows + r
        if (idx >= items.length) continue
        const it = items[idx]
        line += it.colored + ' '.repeat(cw - it.width)
      }
      ctx.out(line.trimEnd() + '\n')
    }
  }

  const printGroup = (items: LsEntry[]): void => {
    if (items.length === 0) return
    if (o.l) {
      const sizeW = Math.max(1, ...items.map((it) => (o.h ? it.hsize : String(it.size)).length))
      const blocksW = Math.max(1, ...items.map((it) => String(it.blocks).length))
      const inoW = Math.max(1, ...items.map((it) => it.ino.length))
      for (const it of items) {
        let line = ''
        if (o.i) line += it.ino.padStart(inoW) + ' '
        if (o.s) line += String(it.blocks).padStart(blocksW) + ' '
        line += `${it.node.t === 'd' ? 'd' : '-'}${modeStr(it.node).slice(1)} 1 guest guest `
        line += (o.h ? it.hsize : String(it.size)).padStart(sizeW)
        line += ' ' + lsDate(it.node.mtime) + ' ' + it.colored
        ctx.out(line + '\n')
      }
      return
    }
    if (!o.l && (o.i || o.s)) {
      if (o.s) ctx.out(`total ${items.reduce((t, it) => t + it.blocks, 0)}\n`)
      const inoW = Math.max(1, ...items.map((it) => it.ino.length))
      const blocksW = Math.max(1, ...items.map((it) => String(it.blocks).length))
      for (const it of items) {
        let line = ''
        if (o.i) line += it.ino.padStart(inoW) + ' '
        if (o.s) line += String(it.blocks).padStart(blocksW) + ' '
        line += it.colored
        ctx.out(line + '\n')
      }
      return
    }
    if (o.m) { ctx.out(items.map((it) => it.colored).join(', ') + '\n'); return }
    if (o['1'] || !ctx.isTTYOut && !o.C) { for (const it of items) printOne(it); return }
    printColumns(items, ctx.io.size().cols)
  }

  const listDir = (abs: string, shown: string, node: Node, header: boolean, anyOut: boolean): boolean => {
    if (header) {
      if (anyOut) ctx.out('\n')
      ctx.out(`${shown}:\n`)
      anyOut = true
    }
    let names = ctx.fs.list(abs)
    if (showAll) names = names.slice()
    else if (showHidden) names = names.filter((n) => n !== '.' && n !== '..')
    else names = names.filter((n) => !n.startsWith('.'))
    const items: LsEntry[] = []
    const pushEntry = (name: string, entryNode: Node, entryAbs: string): void => {
      const plain = name + indicator(entryNode, o.F === true)
      items.push({
        shown: name,
        colored: colorizeName(entryNode, plain, colorOn),
        width: plain.length,
        size: entryNode.t === 'f' ? entryNode.data.length : 0,
        hsize: humanSize(entryNode.t === 'f' ? entryNode.data.length : 0),
        blocks: entryNode.t === 'f' ? Math.ceil(entryNode.data.length / 1024) : 0,
        ino: String(fakeInode(entryAbs)),
        node: entryNode,
      })
    }
    if (showAll) {
      pushEntry('.', node, VFS.resolve(abs, '.'))
      pushEntry('..', node, VFS.resolve(abs, '..'))
    }
    for (const name of names) {
      const childAbs = VFS.resolve(abs, name)
      const child = ctx.fs.get(childAbs)
      if (!child) continue
      pushEntry(name, child, childAbs)
    }
    items.sort(cmpEntries)
    if (o.l) {
      const total = items.reduce((t, it) => t + it.blocks, 0)
      ctx.out(`total ${total}\n`)
    }
    printGroup(items)
    if (o.R) {
      for (const it of items) {
        if (ctx.signal.aborted) return anyOut
        if (it.shown === '.' || it.shown === '..') continue
        if (it.node.t !== 'd') continue
        const childShown = shown.replace(/\/+$/, '') + '/' + it.shown
        anyOut = listDir(VFS.resolve(abs, it.shown), childShown, it.node, true, anyOut)
      }
    }
    return anyOut
  }

  let anyOut = false
  if (files.length) {
    const items: LsEntry[] = []
    for (const f of files) {
      const plain = f.shown + indicator(f.node, o.F === true)
      items.push({
        shown: f.shown,
        colored: colorizeName(f.node, plain, colorOn),
        width: plain.length,
        size: f.node.t === 'f' ? f.node.data.length : 0,
        hsize: humanSize(f.node.t === 'f' ? f.node.data.length : 0),
        blocks: f.node.t === 'f' ? Math.ceil(f.node.data.length / 1024) : 0,
        ino: String(fakeInode(f.abs)),
        node: f.node,
      })
    }
    items.sort(cmpEntries)
    printGroup(items)
    anyOut = true
  }
  const cmpOperand = (a: { shown: string }, b: { shown: string }): number => {
    const ka = nameKey(a.shown)
    const kb = nameKey(b.shown)
    let c = ka < kb ? -1 : ka > kb ? 1 : a.shown < b.shown ? -1 : a.shown > b.shown ? 1 : 0
    if (o.r) c = -c
    return c
  }
  dirs.sort(cmpOperand)
  for (const d of dirs) {
    anyOut = listDir(d.abs, d.shown, d.node, dirs.length > 1 || o.R === true || files.length > 0, anyOut)
  }
  return status
}

// ---- cat / tac / head / tail --------------------------------------------------------------------

function visChars(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c === 0x7f) out += '^?'
    else if (c < 0x20) out += '^' + String.fromCharCode(c + 64)
    else if (c < 0x80) out += ch
    else if (c < 0xa0) out += 'M-^' + String.fromCharCode(c - 0x80 + 64)
    else out += 'M-' + String.fromCharCode(c - 0x80)
  }
  return out
}

function catTransform(data: string, o: Record<string, string | true>): string {
  if (data.length === 0) return ''
  const lines = data.split('\n')
  const hadNl = data.endsWith('\n')
  if (hadNl) lines.pop()
  let out = ''
  let n = 1
  let prevBlank = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const blank = line.length === 0
    const last = i === lines.length - 1
    if (!(o.s && blank && prevBlank)) {
      let text = line
      if (o.T || o.A) text = text.replace(/\t/g, '^I')
      if (o.v || o.A) text = visChars(text)
      if (o.E || o.A) text += '$'
      const num = o.n ? true : o.b ? !blank : false
      if (num) out += String(n).padStart(6) + '\t'
      out += text + (last && !hadNl ? '' : '\n')
      if (o.n) n++
      else if (o.b && !blank) n++
    }
    prevBlank = blank
  }
  return out
}

const catCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { bool: 'nbsAETv' })
  if ('help' in p) return usageOk(ctx, 'cat')
  if ('err' in p) return badOpt(ctx, 'cat', p.err)
  const files = p.rest.length ? p.rest : ['-']
  let status = 0
  for (const f of files) {
    let data: string
    if (f === '-') data = await ctx.stdin.readAll()
    else {
      try { data = ctx.fs.readFile(ctx.resolve(f)) }
      catch (e) { ctx.err(`cat: ${f}: ${errReason(e)}\n`); status = 1; continue }
    }
    ctx.out(catTransform(data, p.opts))
  }
  return status
}

const tacCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {})
  if ('help' in p) return usageOk(ctx, 'tac')
  if ('err' in p) return badOpt(ctx, 'tac', p.err)
  const files = p.rest.length ? p.rest : ['-']
  let status = 0
  for (const f of files) {
    let data: string
    if (f === '-') data = await ctx.stdin.readAll()
    else {
      try { data = ctx.fs.readFile(ctx.resolve(f)) }
      catch (e) { ctx.err(`tac: ${f}: ${errReason(e)}\n`); status = 1; continue }
    }
    const lines = data.split('\n')
    const hadNl = data.endsWith('\n')
    if (hadNl) lines.pop()
    lines.reverse()
    ctx.out(lines.join('\n') + (hadNl ? '\n' : ''))
  }
  return status
}

interface HeadTail {
  n?: { from: boolean; value: number }
  c?: { from: boolean; value: number }
  q: boolean
  v: boolean
  f: boolean
  files: string[]
}

function parseHeadTail(args: string[], cmd: string): HeadTail | { err: string } | { help: true } {
  const res: HeadTail = { q: false, v: false, f: false, files: [] }
  let mode: 'n' | 'c' | null = null
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--') { res.files.push(...args.slice(i + 1)); return res }
    if (a === '--help') return { help: true }
    if (a === '-q' || a === '--quiet' || a === '--silent') { res.q = true; continue }
    if (a === '-v' || a === '--verbose') { res.v = true; continue }
    if (cmd === 'tail' && (a === '-f' || a === '--follow')) { res.f = true; continue }
    if (a.startsWith('--lines=') || a.startsWith('--bytes=')) {
      const key = a.startsWith('--lines=') ? 'n' : 'c'
      mode = key
      const val = a.slice(a.indexOf('=') + 1)
      const m = /^([+-]?)(\d+)$/.exec(val)
      if (!m) return { err: `invalid number of ${key === 'n' ? 'lines' : 'bytes'}: '${val}'` }
      const num = Number(m[2]) * (m[1] === '-' ? -1 : 1)
      if (key === 'n') res.n = { from: m[1] === '+', value: num }
      else res.c = { from: m[1] === '+', value: num }
      continue
    }
    if (a === '-n' || a === '-c' || a === '--lines' || a === '--bytes') {
      const key = a === '--lines' ? 'n' : a === '--bytes' ? 'c' : a[1] as 'n' | 'c'
      mode = key
      if (i + 1 >= args.length) return { err: `option requires an argument -- '${key}'` }
      const val = args[++i]
      const m = /^([+-]?)(\d+)$/.exec(val)
      if (!m) return { err: `invalid number of ${key === 'n' ? 'lines' : 'bytes'}: '${val}'` }
      const num = Number(m[2]) * (m[1] === '-' ? -1 : 1)
      if (key === 'n') res.n = { from: m[1] === '+', value: num }
      else res.c = { from: m[1] === '+', value: num }
      continue
    }
    if (/^-[nc][+-]?\d+$/.test(a)) {
      const key = a[1] as 'n' | 'c'
      mode = key
      const val = a.slice(2)
      const m = /^([+-]?)(\d+)$/.exec(val)!
      const num = Number(m[2]) * (m[1] === '-' ? -1 : 1)
      if (key === 'n') res.n = { from: m[1] === '+', value: num }
      else res.c = { from: m[1] === '+', value: num }
      continue
    }
    if (/^-\d+$/.test(a)) { mode = 'n'; res.n = { from: false, value: Number(a.slice(1)) }; continue }
    if (a.length > 1 && a[0] === '-' && a !== '-') return { err: `invalid option -- '${a[1]}'` }
    res.files.push(a)
  }
  if (mode === null) res.n = { from: false, value: 10 }
  return res
}

function linesOf(data: string): string[] {
  const l = data.split('\n')
  if (l.length && l[l.length - 1] === '') l.pop()
  return l
}

function headLines(data: string, n: number): string {
  const lines = linesOf(data)
  const k = n >= 0 ? n : Math.max(0, lines.length + n)
  if (k <= 0) return ''
  if (k >= lines.length) return data
  return lines.slice(0, k).join('\n') + (data.endsWith('\n') ? '\n' : '')
}

function tailLines(data: string, n: number, from: boolean): string {
  const lines = linesOf(data)
  if (from) {
    const out = lines.slice(Math.max(0, n - 1))
    if (out.length === lines.length) return data
    if (out.length === 0) return ''
    return out.join('\n') + (data.endsWith('\n') ? '\n' : '')
  }
  const out = lines.slice(Math.max(0, lines.length - Math.max(0, n)))
  if (out.length === lines.length) return data
  if (out.length === 0) return ''
  return out.join('\n') + (data.endsWith('\n') ? '\n' : '')
}

function headBytes(data: string, n: number): string {
  return n >= 0 ? data.slice(0, n) : data.slice(0, Math.max(0, data.length + n))
}

function tailBytes(data: string, n: number, from: boolean): string {
  if (from) return data.slice(Math.max(0, n - 1))
  return data.slice(Math.max(0, data.length - Math.max(0, n)))
}

async function readHeadTailFile(ctx: CmdCtx, cmd: string, f: string): Promise<{ data: string; ok: boolean }> {
  if (f === '-') return { data: await ctx.stdin.readAll(), ok: true }
  try { return { data: ctx.fs.readFile(ctx.resolve(f)), ok: true } }
  catch (e) {
    if (e instanceof FsError && e.code === 'EISDIR') ctx.err(`${cmd}: error reading '${f}': ${e.reason}\n`)
    else ctx.err(`${cmd}: cannot open '${f}' for reading: ${errReason(e)}\n`)
    return { data: '', ok: false }
  }
}

const headCmd: Cmd = async (ctx) => {
  const r = parseHeadTail(ctx.args, 'head')
  if ('help' in r) return usageOk(ctx, 'head')
  if ('err' in r) return badOpt(ctx, 'head', r.err)
  const files = r.files.length ? r.files : ['-']
  const useBytes = r.c !== undefined
  let status = 0
  let firstHeader = true
  for (const f of files) {
    const { data, ok } = await readHeadTailFile(ctx, 'head', f)
    if (!ok) { status = 1; continue }
    const name = f === '-' ? 'standard input' : f
    if ((files.length > 1 || r.v) && !r.q) {
      if (!firstHeader) ctx.out('\n')
      firstHeader = false
      ctx.out(`==> ${name} <==\n`)
    }
    if (useBytes) ctx.out(headBytes(data, r.c!.value))
    else ctx.out(headLines(data, r.n!.value))
  }
  return status
}

const tailCmd: Cmd = async (ctx) => {
  const r = parseHeadTail(ctx.args, 'tail')
  if ('help' in r) return usageOk(ctx, 'tail')
  if ('err' in r) return badOpt(ctx, 'tail', r.err)
  const files = r.files.length ? r.files : ['-']
  const useBytes = r.c !== undefined
  let status = 0
  let firstHeader = true
  for (const f of files) {
    const { data, ok } = await readHeadTailFile(ctx, 'tail', f)
    if (!ok) { status = 1; continue }
    const name = f === '-' ? 'standard input' : f
    if ((files.length > 1 || r.v) && !r.q) {
      if (!firstHeader) ctx.out('\n')
      firstHeader = false
      ctx.out(`==> ${name} <==\n`)
    }
    if (useBytes) ctx.out(tailBytes(data, Math.abs(r.c!.value), r.c!.from))
    else ctx.out(tailLines(data, Math.abs(r.n!.value), r.n!.from))
  }
  return status
}

// ---- touch / mkdir / rmdir / rm -------------------------------------------------------------------

const touchCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'c',
    val: 'd',
    long: { 'no-create': 'c' },
    longVal: { date: 'd' },
  })
  if ('help' in p) return usageOk(ctx, 'touch')
  if ('err' in p) return badOpt(ctx, 'touch', p.err)
  if (!p.rest.length) return fail(ctx, 'touch', 'missing file operand')
  let date: number | undefined
  if (p.opts.d !== undefined && p.opts.d !== true) {
    date = Date.parse(String(p.opts.d))
    if (Number.isNaN(date)) return fail(ctx, 'touch', `invalid date format '${p.opts.d}'`)
  }
  let status = 0
  for (const f of p.rest) {
    const abs = ctx.resolve(f)
    const exists = ctx.fs.exists(abs)
    if (!exists && p.opts.c) continue
    try {
      if (!exists) ctx.fs.writeFile(abs, '')
      ctx.fs.utimes(abs, date ?? Date.now())
    } catch (e) {
      ctx.err(`touch: cannot touch '${f}': ${errReason(e)}\n`)
      status = 1
    }
  }
  return status
}

const mkdirCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'pv',
    val: 'm',
    long: { parents: 'p', verbose: 'v' },
    longVal: { mode: 'm' },
  })
  if ('help' in p) return usageOk(ctx, 'mkdir')
  if ('err' in p) return badOpt(ctx, 'mkdir', p.err)
  if (!p.rest.length) return fail(ctx, 'mkdir', 'missing operand')
  let status = 0
  for (const d of p.rest) {
    const abs = ctx.resolve(d)
    const existed = ctx.fs.exists(abs)
    try { ctx.fs.mkdir(abs, p.opts.p === true) }
    catch (e) { ctx.err(`mkdir: cannot create directory '${d}': ${errReason(e)}\n`); status = 1; continue }
    if (p.opts.v && !existed) ctx.out(`mkdir: created directory '${d}'\n`)
  }
  return status
}

const rmdirCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { bool: 'p', long: { parents: 'p' } })
  if ('help' in p) return usageOk(ctx, 'rmdir')
  if ('err' in p) return badOpt(ctx, 'rmdir', p.err)
  if (!p.rest.length) return fail(ctx, 'rmdir', 'missing operand')
  let status = 0
  for (const d of p.rest) {
    const abs = ctx.resolve(d)
    if (p.opts.p) {
      let cur = d.replace(/\/+$/, '')
      if (cur === '') cur = d.startsWith('/') ? '/' : d
      for (;;) {
        const comp = ctx.resolve(cur)
        const n = ctx.fs.get(comp)
        if (!n) { ctx.err(`rmdir: failed to remove '${cur}': No such file or directory\n`); status = 1; break }
        if (n.t !== 'd') { ctx.err(`rmdir: failed to remove '${cur}': Not a directory\n`); status = 1; break }
        try { ctx.fs.remove(comp) }
        catch (e) { ctx.err(`rmdir: failed to remove '${cur}': ${errReason(e)}\n`); status = 1; break }
        const i = cur.lastIndexOf('/')
        if (i < 0) break
        cur = cur.slice(0, i)
        if (cur === '') break
      }
      continue
    }
    const n = ctx.fs.get(abs)
    if (!n) { ctx.err(`rmdir: failed to remove '${d}': No such file or directory\n`); status = 1; continue }
    if (n.t !== 'd') { ctx.err(`rmdir: failed to remove '${d}': Not a directory\n`); status = 1; continue }
    try { ctx.fs.remove(abs) }
    catch (e) { ctx.err(`rmdir: failed to remove '${d}': ${errReason(e)}\n`); status = 1 }
  }
  return status
}

const rmCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'rRfvd',
    long: { recursive: 'r', force: 'f', verbose: 'v', dir: 'd' },
  })
  if ('help' in p) return usageOk(ctx, 'rm')
  if ('err' in p) return badOpt(ctx, 'rm', p.err)
  if (!p.rest.length) return fail(ctx, 'rm', 'missing operand')
  const o = p.opts
  let status = 0

  const removeRec = (abs: string, shown: string): number => {
    if (ctx.signal.aborted) return 130
    const n = ctx.fs.get(abs)
    if (!n) {
      if (!o.f) ctx.err(`rm: cannot remove '${shown}': No such file or directory\n`)
      return o.f ? 0 : 1
    }
    let st = 0
    if (n.t === 'd') {
      for (const name of ctx.fs.list(abs)) {
        const r = removeRec(VFS.resolve(abs, name), shown.replace(/\/+$/, '') + '/' + name)
        if (r === 130) return 130
        st = st || r
      }
    }
    try { ctx.fs.remove(abs) }
    catch (e) {
      if (!o.f) ctx.err(`rm: cannot remove '${shown}': ${errReason(e)}\n`)
      return o.f ? st : 1
    }
    if (o.v) ctx.out((n.t === 'd' ? `removed directory '${shown}'` : `removed '${shown}'`) + '\n')
    return st
  }

  for (const f of p.rest) {
    if (f === '.' || f === '..') {
      ctx.err(`rm: refusing to remove '.' or '..' directory: skipping '${f}'\n`)
      status = 1
      continue
    }
    const abs = ctx.resolve(f)
    if (abs === '/') {
      if (o.r || o.R) {
        ctx.err(`rm: it is dangerous to operate recursively on '/'\n`)
        ctx.err(`rm: use --no-preserve-root to override this failsafe\n`)
      } else {
        ctx.err(`rm: cannot remove '/': Is a directory\n`)
      }
      status = 1
      continue
    }
    const n = ctx.fs.get(abs)
    if (!n) {
      if (!o.f) ctx.err(`rm: cannot remove '${f}': No such file or directory\n`)
      if (!o.f) status = 1
      continue
    }
    if (n.t === 'd' && !(o.r || o.R)) {
      if (o.d) {
        try { ctx.fs.remove(abs) }
        catch (e) { ctx.err(`rm: cannot remove '${f}': ${errReason(e)}\n`); status = 1; continue }
        if (o.v) ctx.out(`removed directory '${f}'\n`)
        continue
      }
      ctx.err(`rm: cannot remove '${f}': Is a directory\n`)
      status = 1
      continue
    }
    if (n.t === 'd') {
      const r = removeRec(abs, f)
      if (r === 130) return 130
      status = status || r
    } else {
      try { ctx.fs.remove(abs) }
      catch (e) { if (!o.f) { ctx.err(`rm: cannot remove '${f}': ${errReason(e)}\n`); status = 1 } }
      if (o.v) ctx.out(`removed '${f}'\n`)
    }
  }
  return status
}

// ---- cp / mv / ln -------------------------------------------------------------------------------

const cpCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'rRafnvTi',
    long: {
      recursive: 'r', archive: 'a', force: 'f', 'no-clobber': 'n', verbose: 'v',
      interactive: 'i', 'no-target-directory': 'T',
    },
  })
  if ('help' in p) return usageOk(ctx, 'cp')
  if ('err' in p) return badOpt(ctx, 'cp', p.err)
  if (p.rest.length < 2) return fail(ctx, 'cp', p.rest.length === 1 ? `missing destination file operand after '${p.rest[0]}'` : 'missing file operand')
  const o = p.opts
  const sources = p.rest.slice(0, -1)
  const dest = p.rest[p.rest.length - 1]
  const destAbs = ctx.resolve(dest)
  const destIsDir = ctx.fs.isDir(destAbs) && o.T !== true
  if (sources.length > 1 && !destIsDir) return fail(ctx, 'cp', `target '${dest}' is not a directory`)
  const rec = o.r === true || o.R === true || o.a === true
  let status = 0
  for (const src of sources) {
    const srcAbs = ctx.resolve(src)
    const sn = ctx.fs.get(srcAbs)
    if (!sn) { ctx.err(`cp: cannot stat '${src}': No such file or directory\n`); status = 1; continue }
    if (sn.t === 'd' && !rec) { ctx.err(`cp: -r not specified; omitting directory '${src}'\n`); status = 1; continue }
    const toAbs = destIsDir ? VFS.resolve(destAbs, VFS.basename(srcAbs)) : destAbs
    const toShown = destIsDir ? dest.replace(/\/+$/, '') + '/' + VFS.basename(srcAbs) : dest
    if (srcAbs === toAbs) { ctx.err(`cp: '${src}' and '${toShown}' are the same file\n`); status = 1; continue }
    if (o.n && ctx.fs.exists(toAbs)) continue
    try { ctx.fs.copy(srcAbs, toAbs, rec) }
    catch (e) {
      ctx.err(`cp: cannot create ${sn.t === 'd' ? 'directory' : 'regular file'} '${toShown}': ${errReason(e)}\n`)
      status = 1
      continue
    }
    if (o.v) ctx.out(`'${src}' -> '${toShown}'\n`)
  }
  return status
}

const mvCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'fnv',
    long: { force: 'f', 'no-clobber': 'n', verbose: 'v' },
  })
  if ('help' in p) return usageOk(ctx, 'mv')
  if ('err' in p) return badOpt(ctx, 'mv', p.err)
  if (p.rest.length < 2) return fail(ctx, 'mv', p.rest.length === 1 ? `missing destination file operand after '${p.rest[0]}'` : 'missing file operand')
  const o = p.opts
  const sources = p.rest.slice(0, -1)
  const dest = p.rest[p.rest.length - 1]
  const destAbs = ctx.resolve(dest)
  const destIsDir = ctx.fs.isDir(destAbs)
  if (sources.length > 1 && !destIsDir) return fail(ctx, 'mv', `target '${dest}' is not a directory`)
  let status = 0
  for (const src of sources) {
    const srcAbs = ctx.resolve(src)
    const sn = ctx.fs.get(srcAbs)
    if (!sn) { ctx.err(`mv: cannot stat '${src}': No such file or directory\n`); status = 1; continue }
    const toAbs = destIsDir ? VFS.resolve(destAbs, VFS.basename(srcAbs)) : destAbs
    const toShown = destIsDir ? dest.replace(/\/+$/, '') + '/' + VFS.basename(srcAbs) : dest
    if (srcAbs === toAbs) { ctx.err(`mv: '${src}' and '${toShown}' are the same file\n`); status = 1; continue }
    if (o.n && ctx.fs.exists(toAbs)) continue
    try { ctx.fs.rename(srcAbs, toAbs) }
    catch (e) {
      if (e instanceof FsError && e.code === 'EINVAL') ctx.err(`mv: cannot move '${src}' to a subdirectory of itself, '${toShown}'\n`)
      else if (e instanceof FsError && e.code === 'ENOTDIR') ctx.err(`mv: cannot overwrite non-directory '${toShown}' with directory '${src}'\n`)
      else ctx.err(`mv: cannot move '${src}' to '${toShown}': ${errReason(e)}\n`)
      status = 1
      continue
    }
    if (o.v) ctx.out(`renamed '${src}' -> '${toShown}'\n`)
  }
  return status
}

const lnCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'sf',
    long: { symbolic: 's', force: 'f' },
  })
  if ('help' in p) return usageOk(ctx, 'ln')
  if ('err' in p) return badOpt(ctx, 'ln', p.err)
  if (p.opts.s) {
    ctx.err(`ln: symbolic links are not supported on this filesystem\n`)
    return 1
  }
  if (p.rest.length < 2) return fail(ctx, 'ln', p.rest.length === 1 ? `missing destination file operand after '${p.rest[0]}'` : 'missing file operand')
  const o = p.opts
  const sources = p.rest.slice(0, -1)
  const dest = p.rest[p.rest.length - 1]
  const destAbs = ctx.resolve(dest)
  const destIsDir = ctx.fs.isDir(destAbs)
  if (sources.length > 1 && !destIsDir) return fail(ctx, 'ln', `target '${dest}' is not a directory`)
  let status = 0
  for (const src of sources) {
    const srcAbs = ctx.resolve(src)
    if (!ctx.fs.exists(srcAbs)) { ctx.err(`ln: failed to access '${src}': No such file or directory\n`); status = 1; continue }
    const toAbs = destIsDir ? VFS.resolve(destAbs, VFS.basename(srcAbs)) : destAbs
    const toShown = destIsDir ? dest.replace(/\/+$/, '') + '/' + VFS.basename(srcAbs) : dest
    if (srcAbs === toAbs) { ctx.err(`ln: '${src}' and '${toShown}' are the same file\n`); status = 1; continue }
    if (ctx.fs.exists(toAbs) && !o.f) { ctx.err(`ln: failed to create hard link '${toShown}': File exists\n`); status = 1; continue }
    try { ctx.fs.copy(srcAbs, toAbs, false) }
    catch (e) { ctx.err(`ln: failed to create hard link '${toShown}': ${errReason(e)}\n`); status = 1 }
  }
  return status
}

// ---- stat / file ---------------------------------------------------------------------------------

function statDate(ms: number): string {
  const d = new Date(ms)
  const p2 = (x: number) => String(x).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const tz = sign + p2(Math.floor(Math.abs(off) / 60)) + p2(Math.abs(off) % 60)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.000000000 ${tz}`
}

function statSpec(s: string, name: string, n: Node): string {
  switch (s) {
    case 'n': return name
    case 's': return String(n.t === 'f' ? n.data.length : 0)
    case 'a': return (n.mode & 0o777).toString(8)
    case 'A': return modeStr(n)
    case 'F': return n.t === 'd' ? 'directory' : n.data.length === 0 ? 'regular empty file' : 'regular file'
    case 'y': return statDate(n.mtime)
    case 'U': return 'guest'
    case 'G': return 'guest'
    case 'b': return String(n.t === 'f' && n.data.length ? Math.ceil(n.data.length / 4096) * 8 : 0)
    case '%': return '%'
    default: return '%' + s
  }
}

function statFormat(fmt: string, name: string, n: Node): string {
  let out = ''
  let lit = ''
  const flush = (): void => { out += unescape(lit).text; lit = '' }
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i]
    if (c === '\\' && i + 1 < fmt.length) { lit += c + fmt[i + 1]; i++; continue }
    if (c === '%' && i + 1 < fmt.length) { flush(); out += statSpec(fmt[i + 1], name, n); i++; continue }
    lit += c
  }
  flush()
  return out
}

function defaultStat(name: string, n: Node, ino: string): string {
  const size = n.t === 'f' ? n.data.length : 0
  const blocks = n.t === 'f' && size ? Math.ceil(size / 4096) * 8 : 0
  const type = n.t === 'd' ? 'directory' : size === 0 ? 'regular empty file' : 'regular file'
  const m = n.mode & 0o777
  const t = statDate(n.mtime)
  return `  File: ${name}\n` +
    `  Size: ${String(size).padEnd(10)} Blocks: ${String(blocks).padEnd(10)} IO Block: 4096   ${type}\n` +
    `Device: 0h/0d   Inode: ${ino}  Links: 1\n` +
    `Access: (0${m.toString(8).padStart(3, '0')}/${modeStr(n)})  Uid: ( 1000/   guest)   Gid: ( 1000/   guest)\n` +
    `Access: ${t}\n` +
    `Modify: ${t}\n` +
    `Change: ${t}\n` +
    ` Birth: ${t}`
}

const statCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { val: 'c', longVal: { format: 'c' } })
  if ('help' in p) return usageOk(ctx, 'stat')
  if ('err' in p) return badOpt(ctx, 'stat', p.err)
  if (!p.rest.length) return fail(ctx, 'stat', 'missing operand')
  let status = 0
  for (const f of p.rest) {
    const abs = ctx.resolve(f)
    let n: Node
    try { n = ctx.fs.stat(abs) }
    catch (e) { ctx.err(`stat: cannot statx '${f}': ${errReason(e)}\n`); status = 1; continue }
    if (typeof p.opts.c === 'string') ctx.out(statFormat(p.opts.c, f, n))
    else ctx.out(defaultStat(f, n, String(fakeInode(abs))) + '\n')
  }
  return status
}

function fileDesc(n: Node): string {
  if (n.t === 'd') return 'directory'
  const data = n.data
  if (data.length === 0) return 'empty'
  const exe = (n.mode & 0o111) !== 0
  if (data.startsWith('#!')) {
    const interp = data.slice(2).split('\n', 1)[0].trim()
    const base = interp.split('/').pop() || interp
    if (base.includes('bash')) return 'Bourne-Again shell script, ASCII text executable'
    if (base === 'sh') return 'POSIX shell script, ASCII text executable'
    return `${base} script, ASCII text executable`
  }
  if (data.includes('\0')) return 'data'
  let ascii = true
  let utf8 = true
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i)
    if (c > 0x7f) {
      ascii = false
      if (c >= 0xd800) utf8 = false
    }
  }
  const tail = exe ? ' executable' : ''
  return ascii ? `ASCII text${tail}` : utf8 ? `UTF-8 Unicode text${tail}` : 'data'
}

const fileCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { bool: 'b', long: { brief: 'b' } })
  if ('help' in p) return usageOk(ctx, 'file')
  if ('err' in p) return badOpt(ctx, 'file', p.err)
  if (!p.rest.length) return fail(ctx, 'file', 'missing file operand')
  let status = 0
  for (const f of p.rest) {
    const n = ctx.fs.get(ctx.resolve(f))
    if (!n) { ctx.err(`file: cannot open '${f}' (No such file or directory)\n`); status = 1; continue }
    ctx.out((p.opts.b ? '' : `${f}: `) + fileDesc(n) + '\n')
  }
  return status
}

// ---- find ---------------------------------------------------------------------------------------

interface FNode { abs: string; shown: string; node: Node }
type FExpr =
  | { k: 'test'; fn: (f: FNode) => boolean }
  | { k: 'action'; fn: (f: FNode) => Promise<boolean> | boolean }
  | { k: 'not'; e: FExpr }
  | { k: 'and'; a: FExpr; b: FExpr }
  | { k: 'or'; a: FExpr; b: FExpr }

type FTok =
  | { t: 'op'; v: string }
  | { t: 'test'; op: string; arg?: string }
  | { t: 'action'; op: string; arg?: string[]; plus?: boolean }

const findCmd: Cmd = async (ctx) => {
  const toks: FTok[] = []
  const paths: string[] = []
  let maxDepth: number | undefined
  let minDepth = 0
  let depthFirst = false
  let exprStart = false
  let setupError = ''
  let parseError = ''

  const args = ctx.args
  const testSpecs: Record<string, boolean> = {
    '-name': true, '-iname': true, '-path': true, '-ipath': true, '-regex': true,
    '-type': true, '-size': true, '-mtime': true, '-mmin': true, '-newer': true,
    '-perm': true,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--help') { ctx.out(info.find.usage + '\n'); return 0 }
    if (a === '--') { exprStart = true; continue }
    if (a === '-maxdepth' || a === '-mindepth') {
      const v = args[++i]
      const num = v !== undefined && /^\d+$/.test(v) ? Number(v) : NaN
      if (Number.isNaN(num)) { parseError = `find: expected a positive decimal integer argument to '${a}'`; break }
      if (a === '-maxdepth') maxDepth = num
      else minDepth = num
      continue
    }
    if (a === '-depth') { depthFirst = true; continue }
    if (a === '(' || a === ')' || a === '!' || a === '-not' || a === '-a' || a === '-and' || a === '-o' || a === '-or') {
      exprStart = true
      toks.push({ t: 'op', v: a })
      continue
    }
    if (a === '-print' || a === '-print0' || a === '-delete' || a === '-ls') {
      exprStart = true
      if (a === '-delete') depthFirst = true
      toks.push({ t: 'action', op: a.slice(1) })
      continue
    }
    if (a === '-exec') {
      exprStart = true
      const cmd: string[] = []
      let term = ''
      while (i + 1 < args.length) {
        const nx = args[++i]
        if (nx === ';') { term = ';'; break }
        if (nx === '+') { term = '+'; break }
        cmd.push(nx)
      }
      if (!term) { parseError = `find: missing argument to '-exec'`; break }
      if (term === '+' && cmd.some((t) => t.includes('{}') && t !== '{}')) { parseError = `find: with -exec ... {} + the braces must be alone`; break }
      toks.push({ t: 'action', op: 'exec', arg: cmd, plus: term === '+' })
      continue
    }
    if (a === '-empty') { exprStart = true; toks.push({ t: 'test', op: 'empty' }); continue }
    if (testSpecs[a]) {
      exprStart = true
      if (i + 1 >= args.length) { parseError = `find: missing argument to '${a}'`; break }
      const arg = args[++i]
      toks.push({ t: 'test', op: a.slice(1), arg })
      continue
    }
    if (a.startsWith('-')) { parseError = `find: unknown predicate '${a}'`; break }
    if (exprStart) { parseError = `find: paths must precede expression: '${a}'`; break }
    paths.push(a)
  }

  if (parseError) { ctx.err(parseError + '\n'); return 1 }
  if (!paths.length) paths.push('.')

  const makeTest = (op: string, arg: string | undefined): ((f: FNode) => boolean) => {
    const s = arg ?? ''
    switch (op) {
      case 'name': return (f) => matchGlob(s, VFS.basename(f.abs))
      case 'iname': return (f) => matchGlob(s, VFS.basename(f.abs), 'i')
      case 'path': return (f) => matchGlob(s, f.shown)
      case 'ipath': return (f) => matchGlob(s, f.shown, 'i')
      case 'regex': {
        let re: RegExp
        try { re = compilePosix(s, { ere: true }) }
        catch { setupError = `find: invalid regular expression '${s}'`; return () => false }
        return (f) => re.test(f.shown)
      }
      case 'type': return (f) => f.node.t === (s === 'd' ? 'd' : 'f')
      case 'size': {
        const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(s)
        if (!m) { setupError = `find: invalid -size type '${s}'`; return () => false }
        const unit = m[3] === 'c' ? 1 : m[3] === 'k' ? 1024 : m[3] === 'M' ? 1024 ** 2 : m[3] === 'G' ? 1024 ** 3 : 512
        const want = Number(m[2])
        return (f) => {
          const size = f.node.t === 'f' ? f.node.data.length : 0
          const val = Math.ceil(size / unit)
          return m[1] === '+' ? val > want : m[1] === '-' ? val < want : val === want
        }
      }
      case 'empty': return (f) => f.node.t === 'f' ? f.node.data.length === 0 : Object.keys(f.node.kids).length === 0
      case 'mtime': case 'mmin': {
        const m = /^([+-]?)(\d+)$/.exec(s)
        if (!m) { setupError = `find: invalid argument '${s}' to '-${op}'`; return () => false }
        const div = op === 'mtime' ? 86400000 : 60000
        const want = Number(m[2])
        return (f) => {
          const age = (Date.now() - f.node.mtime) / div
          return m[1] === '+' ? age > want : m[1] === '-' ? age < want : age >= want && age < want + 1
        }
      }
      case 'newer': {
        const ref = ctx.fs.get(ctx.resolve(s))
        if (!ref) { setupError = `find: '${s}': No such file or directory`; return () => false }
        const t = ref.mtime
        return (f) => f.node.mtime > t
      }
      case 'perm': {
        const m = /^([-/])?([0-7]{3,4})$/.exec(s)
        if (!m) { setupError = `find: invalid mode '${s}'`; return () => false }
        const want = parseInt(m[2], 8)
        return (f) => {
          const bits = f.node.mode & 0o777
          if (m[1] === '-') return (bits & want) === want
          if (m[1] === '/') return (bits & want) !== 0
          return bits === want
        }
      }
      default: return () => false
    }
  }

  const printAction: FTok = { t: 'action', op: 'print' }
  const execStatus = { bad: 0 }
  const pendingPlusList: { holder: string[]; argv: string[] }[] = []
  const makeAction = (tok: FTok): (f: FNode) => Promise<boolean> | boolean => {
    if (tok.t !== 'action') return () => true
    switch (tok.op) {
      case 'print': return (f) => { ctx.out(f.shown + '\n'); return true }
      case 'print0': return (f) => { ctx.out(f.shown + '\0'); return true }
      case 'delete': return (f) => {
        try { ctx.fs.remove(f.abs) }
        catch (e) { ctx.err(`find: cannot delete '${f.shown}': ${errReason(e)}\n`); return false }
        return true
      }
      case 'ls': return (f) => {
        const size = f.node.t === 'f' ? f.node.data.length : 0
        const blocks = f.node.t === 'f' ? Math.ceil(size / 1024) : 0
        ctx.out(`${String(fakeInode(f.abs)).padStart(7)} ${String(blocks).padStart(3)} ${modeStr(f.node)} 1 guest guest ${String(size).padStart(4)} ${lsDate(f.node.mtime)} ${f.shown}\n`)
        return true
      }
      case 'exec': {
        const argv = tok.arg ?? []
        if (tok.plus) {
          const holder: string[] = []
          pendingPlusList.push({ holder, argv })
          return (f) => { holder.push(f.shown); return true }
        }
        return async (f) => {
          const run = argv.map((t) => t.split('{}').join(f.shown))
          const res = await ctx.exec(run)
          ctx.out(res.out)
          if (res.err) ctx.err(res.err)
          if (res.status !== 0) execStatus.bad = 1
          return res.status === 0
        }
      }
      default: return () => true
    }
  }

  // recursive descent parser over toks
  let ti = 0
  const parseOr = (): FExpr => {
    let e = parseAnd()
    for (;;) {
      const t = ti < toks.length ? toks[ti] : undefined
      if (!t || t.t !== 'op' || (t.v !== '-o' && t.v !== '-or')) break
      ti++
      e = { k: 'or', a: e, b: parseAnd() }
    }
    return e
  }
  const parseAnd = (): FExpr => {
    let e = parseNot()
    while (ti < toks.length) {
      const t = toks[ti]
      if (t.t === 'op' && (t.v === '-a' || t.v === '-and')) { ti++; e = { k: 'and', a: e, b: parseNot() }; continue }
      if (t.t === 'op' && (t.v === '-o' || t.v === '-or' || t.v === ')')) break
      e = { k: 'and', a: e, b: parseNot() }
    }
    return e
  }
  const parseNot = (): FExpr => {
    const t = ti < toks.length ? toks[ti] : undefined
    if (t && t.t === 'op' && (t.v === '!' || t.v === '-not')) {
      ti++
      return { k: 'not', e: parseNot() }
    }
    return parsePrimary()
  }
  const parsePrimary = (): FExpr => {
    if (ti >= toks.length) { parseError = `find: expression too short`; return { k: 'test', fn: () => false } }
    const t = toks[ti]
    if (t.t === 'op' && t.v === '(') {
      ti++
      const e = parseOr()
      if (parseError) return e
      const close = ti < toks.length ? toks[ti] : undefined
      if (!close || close.t !== 'op' || close.v !== ')') { parseError = `find: missing ')'`; return e }
      ti++
      return e
    }
    if (t.t === 'op') { parseError = `find: unexpected token '${t.v}'`; return { k: 'test', fn: () => false } }
    ti++
    if (t.t === 'test') return { k: 'test', fn: makeTest(t.op, t.arg) }
    return { k: 'action', fn: makeAction(t) }
  }

  let expr: FExpr = { k: 'test', fn: () => true }
  if (toks.length) {
    expr = parseOr()
    if (parseError) { ctx.err(parseError + '\n'); return 1 }
    if (ti < toks.length) {
      const extra = toks[ti]
      ctx.err(`find: unexpected token '${extra.t === 'op' ? extra.v : '?'}'\n`)
      return 1
    }
  }
  if (setupError) { ctx.err(setupError + '\n'); return 1 }
  const hasAction = toks.some((t) => t.t === 'action')
  if (!hasAction) expr = { k: 'and', a: expr, b: { k: 'action', fn: makeAction(printAction) } }

  const evalExpr = async (e: FExpr, f: FNode): Promise<boolean> => {
    switch (e.k) {
      case 'test': return e.fn(f)
      case 'action': return e.fn(f)
      case 'not': return !(await evalExpr(e.e, f))
      case 'and': return (await evalExpr(e.a, f)) && (await evalExpr(e.b, f))
      case 'or': return (await evalExpr(e.a, f)) || (await evalExpr(e.b, f))
    }
  }

  let status = 0
  const processOne = async (shown: string, abs: string, node: Node, depth: number): Promise<void> => {
    if (depth < minDepth) return
    await evalExpr(expr, { shown, abs, node })
  }

  const walk = async (shown: string, abs: string, node: Node, depth: number): Promise<number> => {
    if (ctx.signal.aborted) return 130
    if (!depthFirst) await processOne(shown, abs, node, depth)
    if (node.t === 'd' && (maxDepth === undefined || depth < maxDepth)) {
      for (const name of ctx.fs.list(abs)) {
        const childAbs = VFS.resolve(abs, name)
        const child = ctx.fs.get(childAbs)
        if (!child) continue
        const r = await walk(shown.replace(/\/+$/, '') + '/' + name, childAbs, child, depth + 1)
        if (r === 130) return 130
      }
    }
    if (depthFirst) await processOne(shown, abs, node, depth)
    return 0
  }

  for (const p of paths) {
    if (ctx.signal.aborted) return 130
    const abs = ctx.resolve(p)
    const node = ctx.fs.get(abs)
    if (!node) { ctx.err(`find: '${p}': No such file or directory\n`); status = 1; continue }
    const r = await walk(p, abs, node, 0)
    if (r === 130) return 130
  }

  for (const pp of pendingPlusList) {
    const argv: string[] = []
    let inserted = false
    for (const t of pp.argv) {
      if (t === '{}') { argv.push(...pp.holder); inserted = true }
      else argv.push(t)
    }
    if (!inserted) argv.push(...pp.holder)
    if (argv.length) {
      const res = await ctx.exec(argv)
      ctx.out(res.out)
      if (res.err) ctx.err(res.err)
      if (res.status !== 0) execStatus.bad = 1
    }
  }
  return status || execStatus.bad
}

// ---- du / df / tree ------------------------------------------------------------------------------

function duFileBlocks(data: string): number {
  return Math.max(4, Math.ceil(data.length / 4096) * 4)
}

function duSize(ctx: CmdCtx, abs: string): number {
  const n = ctx.fs.stat(abs)
  if (n.t === 'f') return duFileBlocks(n.data)
  let total = 4
  for (const name of ctx.fs.list(abs)) total += duSize(ctx, VFS.resolve(abs, name))
  return total
}

const duCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'shack',
    val: 'd',
    long: { summarize: 's', 'human-readable': 'h', all: 'a', total: 'c' },
    longVal: { 'max-depth': 'd' },
  })
  if ('help' in p) return usageOk(ctx, 'du')
  if ('err' in p) return badOpt(ctx, 'du', p.err)
  const o = p.opts
  let maxDepth: number | undefined
  if (o.d !== undefined && o.d !== true) {
    const n = Number(o.d)
    if (!Number.isInteger(n) || n < 0) return fail(ctx, 'du', `invalid maximum depth '${o.d}'`)
    maxDepth = n
  }
  const operands = p.rest.length ? p.rest : ['.']
  const fmt = (b: number): string => (o.h ? humanSize(b * 1024) : String(b))
  let status = 0
  let grand = 0
  const walk = async (abs: string, shown: string, depth: number): Promise<number> => {
    if (ctx.signal.aborted) return 0
    const n = ctx.fs.get(abs)
    if (!n) return 0
    if (n.t === 'f') {
      const b = duFileBlocks(n.data)
      if (o.a || depth === 0) ctx.out(`${fmt(b)}\t${shown}\n`)
      return b
    }
    let total = 4
    for (const name of ctx.fs.list(abs)) {
      total += await walk(VFS.resolve(abs, name), shown.replace(/\/+$/, '') + '/' + name, depth + 1)
    }
    if (maxDepth === undefined || depth <= maxDepth) ctx.out(`${fmt(total)}\t${shown}\n`)
    return total
  }
  for (const op of operands) {
    const abs = ctx.resolve(op)
    if (!ctx.fs.exists(abs)) { ctx.err(`du: cannot access '${op}': No such file or directory\n`); status = 1; continue }
    if (o.s) {
      const total = duSize(ctx, abs)
      ctx.out(`${fmt(total)}\t${op}\n`)
      grand += total
    } else {
      grand += await walk(abs, op, 0)
    }
  }
  if (o.c || operands.length > 1) ctx.out(`${fmt(grand)}\ttotal\n`)
  return status
}

const dfCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { bool: 'h', long: { 'human-readable': 'h' } })
  if ('help' in p) return usageOk(ctx, 'df')
  if ('err' in p) return badOpt(ctx, 'df', p.err)
  const used = ctx.fs.size()
  const total = MAX_TOTAL_BYTES
  const avail = total - used
  const pct = Math.round((used / total) * 100)
  const human = p.opts.h === true
  const header = human
    ? ['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on']
    : ['Filesystem', '1K-blocks', 'Used', 'Available', 'Use%', 'Mounted on']
  const row = human
    ? ['/dev/vda1', humanSize(total), humanSize(used), humanSize(avail), `${pct}%`, '/']
    : ['/dev/vda1', String(Math.ceil(total / 1024)), String(Math.ceil(used / 1024)), String(Math.ceil(avail / 1024)), `${pct}%`, '/']
  const widths = header.map((h, i) => Math.max(h.length, row[i].length))
  const fmt = (r: string[]): string => r.map((cell, i) => {
    if (i === 0 || i === r.length - 1) return cell.padEnd(widths[i])
    return cell.padStart(widths[i])
  }).join('  ')
  ctx.out(fmt(header) + '\n' + fmt(row) + '\n')
  return 0
}

const treeCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'adF',
    val: 'L',
    long: { all: 'a', dirs: 'd', classify: 'F', noreport: 'noreport' },
    longVal: { level: 'L' },
  })
  if ('help' in p) return usageOk(ctx, 'tree')
  if ('err' in p) return badOpt(ctx, 'tree', p.err)
  const o = p.opts
  let maxDepth: number | undefined
  if (o.L !== undefined && o.L !== true) {
    const n = Number(o.L)
    if (!Number.isInteger(n) || n < 0) return fail(ctx, 'tree', `Invalid level, must be greater than 0.`)
    maxDepth = n
  }
  const op = p.rest[0] ?? '.'
  const abs = ctx.resolve(op)
  const root = ctx.fs.get(abs)
  if (!root) return fail(ctx, 'tree', `${op}: No such file or directory`)
  const counts = { dirs: 0, files: 0 }
  ctx.out(op + '\n')
  if (root.t === 'd') {
    const walk = (dirAbs: string, prefix: string, depth: number): void => {
      if (ctx.signal.aborted) return
      if (maxDepth !== undefined && depth > maxDepth) return
      const names = ctx.fs.list(dirAbs)
      const children: { name: string; abs: string; node: Node }[] = []
      for (const name of names) {
        if (!o.a && name.startsWith('.')) continue
        const child = ctx.fs.get(VFS.resolve(dirAbs, name))
        if (!child) continue
        if (o.d && child.t !== 'd') continue
        children.push({ name, abs: VFS.resolve(dirAbs, name), node: child })
      }
      children.sort((a, b) => nameKey(a.name) < nameKey(b.name) ? -1 : nameKey(a.name) > nameKey(b.name) ? 1 : a.name < b.name ? -1 : 1)
      for (let i = 0; i < children.length; i++) {
        const c = children[i]
        const last = i === children.length - 1
        ctx.out(prefix + (last ? '└── ' : '├── ') + c.name + (c.node.t === 'd' && o.F ? '/' : '') + '\n')
        if (c.node.t === 'd') {
          counts.dirs++
          if (maxDepth === undefined || depth < maxDepth) walk(c.abs, prefix + (last ? '    ' : '│   '), depth + 1)
        } else counts.files++
      }
    }
    walk(abs, '', 1)
  }
  if (!o.noreport) ctx.out(`\n${counts.dirs} ${counts.dirs === 1 ? 'directory' : 'directories'}, ${counts.files} ${counts.files === 1 ? 'file' : 'files'}\n`)
  return 0
}

// ---- basename / dirname / realpath / readlink ----------------------------------------------------

function dirnameOf(p: string): string {
  const s = p.replace(/\/+$/, '')
  if (s === '') return p.startsWith('/') ? '/' : '.'
  const i = s.lastIndexOf('/')
  if (i < 0) return '.'
  if (i === 0) return '/'
  return s.slice(0, i)
}

const basenameCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'a',
    val: 's',
    long: { multiple: 'a' },
    longVal: { suffix: 's' },
  })
  if ('help' in p) return usageOk(ctx, 'basename')
  if ('err' in p) return badOpt(ctx, 'basename', p.err)
  if (!p.rest.length) return fail(ctx, 'basename', 'missing operand')
  if (!p.opts.a && p.rest.length > 2) return fail(ctx, 'basename', `extra operand '${p.rest[2]}'`)
  let suffix = typeof p.opts.s === 'string' ? p.opts.s : undefined
  if (!p.opts.a && p.rest.length === 2) suffix = p.rest[1]
  const names = p.opts.a ? p.rest : p.rest.slice(0, 1)
  for (const op of names) {
    let name = VFS.basename(op)
    if (suffix !== undefined && suffix.length > 0 && suffix !== name && name.endsWith(suffix)) name = name.slice(0, -suffix.length)
    ctx.out(name + '\n')
  }
  return 0
}

const dirnameCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {})
  if ('help' in p) return usageOk(ctx, 'dirname')
  if ('err' in p) return badOpt(ctx, 'dirname', p.err)
  if (!p.rest.length) return fail(ctx, 'dirname', 'missing operand')
  for (const op of p.rest) ctx.out(dirnameOf(op) + '\n')
  return 0
}

const realpathCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'ems',
    long: { 'canonicalize-existing': 'e', 'canonicalize-missing': 'm', strip: 's', 'no-symlinks': 's' },
  })
  if ('help' in p) return usageOk(ctx, 'realpath')
  if ('err' in p) return badOpt(ctx, 'realpath', p.err)
  if (!p.rest.length) return fail(ctx, 'realpath', 'missing operand')
  let status = 0
  for (const op of p.rest) {
    const abs = ctx.resolve(op)
    if (abs === '/' || p.opts.m) { ctx.out(abs + '\n'); continue }
    if (p.opts.e) {
      if (!ctx.fs.exists(abs)) { ctx.err(`realpath: '${op}': No such file or directory\n`); status = 1; continue }
      ctx.out(abs + '\n')
      continue
    }
    const parent = ctx.fs.get(VFS.dirname(abs))
    if (!parent) { ctx.err(`realpath: '${op}': No such file or directory\n`); status = 1; continue }
    if (parent.t !== 'd') { ctx.err(`realpath: '${op}': Not a directory\n`); status = 1; continue }
    ctx.out(abs + '\n')
  }
  return status
}

const readlinkCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'fm',
    long: { canonicalize: 'f', 'canonicalize-missing': 'm' },
  })
  if ('help' in p) return usageOk(ctx, 'readlink')
  if ('err' in p) return badOpt(ctx, 'readlink', p.err)
  if (!p.rest.length) return fail(ctx, 'readlink', 'missing operand')
  let status = 0
  for (const op of p.rest) {
    if (p.opts.f || p.opts.m) { ctx.out(ctx.resolve(op) + '\n'); continue }
    ctx.err(`readlink: '${op}': Invalid argument\n`)
    status = 1
  }
  return status
}

// ---- chmod / mktemp / truncate -------------------------------------------------------------------

function parseChmod(spec: string): ((mode: number) => number) | string {
  if (/^[0-7]{3,4}$/.test(spec)) {
    const m = parseInt(spec, 8) & 0o777
    return () => m
  }
  const fns: ((mode: number) => number)[] = []
  for (const clause of spec.split(',')) {
    const m = /^([ugoa]*)([+\-=])([rwxXst]+)$/.exec(clause)
    if (!m) return spec
    const who = m[1] || 'a'
    const op = m[2]
    let bits = 0
    for (const c of m[3]) {
      if (c === 'r') bits |= 0o444
      else if (c === 'w') bits |= 0o222
      else if (c === 'x' || c === 'X') bits |= 0o111
    }
    let mask = 0
    if (who.includes('a')) mask |= 0o777
    if (who.includes('u')) mask |= 0o700
    if (who.includes('g')) mask |= 0o070
    if (who.includes('o')) mask |= 0o007
    const wbits = bits & mask
    fns.push((mode) => {
      if (op === '+') return mode | wbits
      if (op === '-') return mode & ~wbits
      return (mode & ~mask) | wbits
    })
  }
  return (mode) => {
    let m = mode & 0o777
    for (const f of fns) m = f(m)
    return m & 0o777
  }
}

const chmodCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {
    bool: 'Rv',
    long: { recursive: 'R', verbose: 'v' },
  })
  if ('help' in p) return usageOk(ctx, 'chmod')
  if ('err' in p) return badOpt(ctx, 'chmod', p.err)
  if (p.rest.length < 2) return fail(ctx, 'chmod', p.rest.length === 0 ? 'missing operand' : `missing operand after '${p.rest[0]}'`)
  const spec = p.rest[0]
  const apply = parseChmod(spec)
  if (typeof apply === 'string') return fail(ctx, 'chmod', `invalid mode: '${spec}'`)
  const files = p.rest.slice(1)
  let status = 0
  const oct = (m: number): string => `0${(m & 0o777).toString(8).padStart(3, '0')}`
  const permOf = (m: number): string => modeStr({ t: 'f', data: '', mode: m, mtime: 0 } as Node).slice(1)
  const one = (abs: string, shown: string): void => {
    const n = ctx.fs.get(abs)
    if (!n) { ctx.err(`chmod: cannot access '${shown}': No such file or directory\n`); status = 1; return }
    const old = n.mode
    const next = apply(old)
    ctx.fs.chmod(abs, next)
    if (p.opts.v) {
      if (next === (old & 0o777)) ctx.out(`mode of '${shown}' retained as ${oct(next)} (${permOf(next)})\n`)
      else ctx.out(`mode of '${shown}' changed from ${oct(old)} (${permOf(old)}) to ${oct(next)} (${permOf(next)})\n`)
    }
    if (p.opts.R && n.t === 'd') {
      for (const name of ctx.fs.list(abs)) one(VFS.resolve(abs, name), shown.replace(/\/+$/, '') + '/' + name)
    }
  }
  for (const f of files) one(ctx.resolve(f), f)
  return status
}

function randomSuffix(n: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  try {
    const buf = new Uint8Array(n)
    globalThis.crypto.getRandomValues(buf)
    for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length]
  } catch {
    for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

const mktempCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { bool: 'd', long: { directory: 'd' } })
  if ('help' in p) return usageOk(ctx, 'mktemp')
  if ('err' in p) return badOpt(ctx, 'mktemp', p.err)
  const template = p.rest[0] ?? '/tmp/tmp.XXXXXXXXXX'
  const m = /X{3,}$/.exec(template)
  if (!m) return fail(ctx, 'mktemp', `too few X's in template '${template}'`)
  const path = template.slice(0, m.index) + randomSuffix(m[0].length)
  try {
    if (p.opts.d) ctx.fs.mkdir(ctx.resolve(path))
    else ctx.fs.writeFile(ctx.resolve(path), '')
  } catch (e) {
    ctx.err(`mktemp: failed to create ${p.opts.d ? 'directory' : 'file'} via template '${template}': ${errReason(e)}\n`)
    return 1
  }
  ctx.out(path + '\n')
  return 0
}

const truncateCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, { val: 's', longVal: { size: 's' } })
  if ('help' in p) return usageOk(ctx, 'truncate')
  if ('err' in p) return badOpt(ctx, 'truncate', p.err)
  if (p.opts.s === undefined) return fail(ctx, 'truncate', `you must specify either '--size' or '--reference'`)
  const m = /^(\d+)([KMG]?)$/i.exec(String(p.opts.s))
  if (!m) return fail(ctx, 'truncate', `invalid number '${p.opts.s}'`)
  const size = Number(m[1]) * (m[2] === 'K' || m[2] === 'k' ? 1024 : m[2] === 'M' || m[2] === 'm' ? 1024 ** 2 : m[2] === 'G' || m[2] === 'g' ? 1024 ** 3 : 1)
  if (!p.rest.length) return fail(ctx, 'truncate', 'missing file operand')
  let status = 0
  for (const f of p.rest) {
    const abs = ctx.resolve(f)
    let data = ''
    if (ctx.fs.exists(abs)) {
      try { data = ctx.fs.readFile(abs) }
      catch (e) { ctx.err(`truncate: cannot open '${f}' for writing: ${errReason(e)}\n`); status = 1; continue }
    }
    if (size > data.length) data += '\0'.repeat(size - data.length)
    else data = data.slice(0, size)
    try { ctx.fs.writeFile(abs, data) }
    catch (e) { ctx.err(`truncate: cannot open '${f}' for writing: ${errReason(e)}\n`); status = 1 }
  }
  return status
}

// ---- chown / chgrp / sync / dd / cmp --------------------------------------------------------------

const noopCmd = (cmd: string): Cmd => async (ctx) => {
  if (ctx.args.includes('--help')) return usageOk(ctx, cmd)
  return 0
}

const syncCmd: Cmd = noopCmd('sync')

const ddCmd: Cmd = async (ctx) => {
  const t0 = Date.now()
  const o: Record<string, string> = { bs: '512', count: '0', skip: '0', seek: '0' }
  for (const a of ctx.args) {
    if (a === '--help') return usageOk(ctx, 'dd')
    const eq = a.indexOf('=')
    if (eq <= 0) return fail(ctx, 'dd', `unrecognized operand '${a}'`)
    o[a.slice(0, eq)] = a.slice(eq + 1)
  }
  const bs = Number(o.bs)
  if (!Number.isInteger(bs) || bs <= 0) return fail(ctx, 'dd', `invalid number '${o.bs}'`)
  const count = Number(o.count || '0')
  const skip = Number(o.skip || '0')
  const seek = Number(o.seek || '0')
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(skip) || skip < 0 || !Number.isInteger(seek) || seek < 0) return fail(ctx, 'dd', `invalid number`)
  let input: string
  if (o.if === undefined) input = await ctx.stdin.readAll()
  else {
    try { input = ctx.fs.readFile(ctx.resolve(o.if)) }
    catch (e) { ctx.err(`dd: failed to open '${o.if}': ${errReason(e)}\n`); return 1 }
  }
  const start = skip * bs
  const end = count > 0 ? start + count * bs : undefined
  const data = input.slice(start, end)
  const written = data.length
  if (o.of !== undefined) {
    const ofAbs = ctx.resolve(o.of)
    let base = ''
    if (ctx.fs.exists(ofAbs)) {
      try { base = ctx.fs.readFile(ofAbs) }
      catch (e) { ctx.err(`dd: failed to open '${o.of}': ${errReason(e)}\n`); return 1 }
    }
    const pos = seek * bs
    const conv = o.conv ?? ''
    let out = base.slice(0, pos)
    if (pos > out.length) out += '\0'.repeat(pos - out.length)
    out += data
    if (conv.split(',').includes('notrunc')) out += base.slice(pos + written)
    try { ctx.fs.writeFile(ofAbs, out) }
    catch (e) { ctx.err(`dd: failed to open '${o.of}': ${errReason(e)}\n`); return 1 }
  } else {
    ctx.out(data)
  }
  if (!(o.status ?? '').split(',').includes('none')) {
    const full = Math.floor(written / bs)
    const part = written % bs ? 1 : 0
    const secs = Math.max((Date.now() - t0) / 1000, 1e-9)
    const rate = written / secs
    const rateStr = rate >= 1e6 ? `${(rate / 1e6).toFixed(1)} MB/s` : rate >= 1000 ? `${(rate / 1000).toFixed(1)} kB/s` : `${Math.round(rate)} B/s`
    ctx.err(`${full}+${part} records in\n${full}+${part} records out\n${written} bytes copied, ${secs.toFixed(4)} s, ${rateStr}\n`)
  }
  return 0
}

const cmpCmd: Cmd = async (ctx) => {
  const p = parseArgs(ctx.args, {})
  if ('help' in p) return usageOk(ctx, 'cmp')
  if ('err' in p) return badOpt(ctx, 'cmp', p.err)
  if (p.rest.length < 2) return fail(ctx, 'cmp', p.rest.length === 1 ? `missing operand after '${p.rest[0]}'` : 'missing operand', 2)
  const [fa, fb] = p.rest
  let a: string
  let b: string
  try { a = ctx.fs.readFile(ctx.resolve(fa)) }
  catch (e) { ctx.err(`cmp: ${fa}: ${errReason(e)}\n`); return 2 }
  try { b = ctx.fs.readFile(ctx.resolve(fb)) }
  catch (e) { ctx.err(`cmp: ${fb}: ${errReason(e)}\n`); return 2 }
  const n = Math.min(a.length, b.length)
  let line = 1
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      ctx.out(`${fa} ${fb} differ: byte ${i + 1}, line ${line}\n`)
      return 1
    }
    if (a[i] === '\n') line++
  }
  if (a.length !== b.length) {
    const shorter = a.length < b.length ? fa : fb
    ctx.err(`cmp: EOF on ${shorter} after byte ${n + 1}, line ${line}\n`)
    return 1
  }
  return 0
}

// ---- module exports -------------------------------------------------------------------------------

export const commands: Record<string, Cmd> = {
  ls: lsCmd,
  cat: catCmd,
  tac: tacCmd,
  head: headCmd,
  tail: tailCmd,
  touch: touchCmd,
  mkdir: mkdirCmd,
  rmdir: rmdirCmd,
  rm: rmCmd,
  cp: cpCmd,
  mv: mvCmd,
  ln: lnCmd,
  stat: statCmd,
  file: fileCmd,
  find: findCmd,
  du: duCmd,
  df: dfCmd,
  tree: treeCmd,
  basename: basenameCmd,
  dirname: dirnameCmd,
  realpath: realpathCmd,
  readlink: readlinkCmd,
  chmod: chmodCmd,
  mktemp: mktempCmd,
  truncate: truncateCmd,
  chown: noopCmd('chown'),
  chgrp: noopCmd('chgrp'),
  sync: syncCmd,
  dd: ddCmd,
  cmp: cmpCmd,
}

export const info: Record<string, CmdInfo> = {
  ls: {
    summary: 'List directory contents',
    usage: 'ls [OPTION]... [FILE]...\n  -a, --all                  do not ignore entries starting with .\n  -A, --almost-all           do not list implied . and ..\n  -l                         use a long listing format\n  -h, --human-readable       with -l, print sizes in human readable format\n  -R, --recursive            list subdirectories recursively\n  -1                         list one file per line\n  -d, --directory            list directories themselves, not their contents\n  -t                         sort by time, newest first\n  -S                         sort by file size, largest first\n  -r, --reverse              reverse order while sorting\n  -F, --classify             append indicator (one of */) to entries\n  -i, --inode                print the index number of each file\n  -s, --size                 print the allocated size of each file, in blocks\n  -X                         sort alphabetically by entry extension\n  --color[=WHEN]             colorize the output; WHEN can be always, auto, or never\n  -m                         fill width with a comma separated list of entries\n  -C                         list entries by columns\n      --help                 display this help and exit',
  },
  cat: {
    summary: 'Concatenate files and print on the standard output',
    usage: 'cat [OPTION]... [FILE]...\n  -n, --number               number all output lines\n  -b, --number-nonblank      number nonempty output lines, overrides -n\n  -s, --squeeze-blank        suppress repeated empty output lines\n  -A, --show-all             equivalent to -vET\n  -E, --show-ends            display $ at end of each line\n  -T, --show-tabs            display TAB characters as ^I\n      --help                 display this help and exit',
  },
  tac: {
    summary: 'Concatenate and print files in reverse',
    usage: 'tac [OPTION]... [FILE]...\n      --help                 display this help and exit',
  },
  head: {
    summary: 'Output the first part of files',
    usage: 'head [OPTION]... [FILE]...\n  -n, --lines=[-]NUM         print the first NUM lines instead of the first 10\n  -c, --bytes=[-]NUM         print the first NUM bytes of each file\n  -q, --quiet, --silent      never print headers giving file names\n  -v, --verbose              always print headers giving file names\n  -NUM                       same as -n NUM\n      --help                 display this help and exit',
  },
  tail: {
    summary: 'Output the last part of files',
    usage: 'tail [OPTION]... [FILE]...\n  -n, --lines=[+]NUM         output the last NUM lines, or use -n +NUM to start at line NUM\n  -c, --bytes=[+]NUM         output the last NUM bytes, or use -c +NUM to start at byte NUM\n  -f, --follow               output appended data as the file grows (prints and returns here)\n  -q, --quiet, --silent      never print headers giving file names\n  -v, --verbose              always print headers giving file names\n  -NUM                       same as -n NUM\n      --help                 display this help and exit',
  },
  touch: {
    summary: 'Change file timestamps',
    usage: 'touch [OPTION]... FILE...\n  -c, --no-create            do not create any files\n  -d, --date=STRING          parse STRING and use it instead of current time\n      --help                 display this help and exit',
  },
  mkdir: {
    summary: 'Make directories',
    usage: 'mkdir [OPTION]... DIRECTORY...\n  -p, --parents              no error if existing, make parent directories as needed\n  -v, --verbose              print a message for each created directory\n  -m, --mode=MODE            set file mode (accepted, not applied)\n      --help                 display this help and exit',
  },
  rmdir: {
    summary: 'Remove empty directories',
    usage: 'rmdir [OPTION]... DIRECTORY...\n  -p, --parents              remove DIRECTORY and its ancestors\n      --help                 display this help and exit',
  },
  rm: {
    summary: 'Remove files or directories',
    usage: 'rm [OPTION]... [FILE]...\n  -r, -R, --recursive        remove directories and their contents recursively\n  -f, --force                ignore nonexistent files and arguments, never prompt\n  -v, --verbose              explain what is being done\n  -d, --dir                  remove empty directories\n      --help                 display this help and exit',
  },
  cp: {
    summary: 'Copy files and directories',
    usage: 'cp [OPTION]... [-T] SOURCE DEST\ncp [OPTION]... SOURCE... DIRECTORY\n  -r, -R, --recursive        copy directories recursively\n  -a, --archive              same as -r, preserve mode and timestamps\n  -f, --force                if an existing destination file cannot be opened, remove it and try again\n  -n, --no-clobber           do not overwrite an existing file\n  -v, --verbose              explain what is being done\n  -i, --interactive          prompt before overwrite (accepted, not applied)\n  -T, --no-target-directory  treat DEST as a normal file\n      --help                 display this help and exit',
  },
  mv: {
    summary: 'Move (rename) files',
    usage: 'mv [OPTION]... SOURCE... DIRECTORY\nmv [OPTION]... SOURCE DEST\n  -f, --force                do not prompt before overwriting\n  -n, --no-clobber           do not overwrite an existing file\n  -v, --verbose              explain what is being done\n      --help                 display this help and exit',
  },
  ln: {
    summary: 'Make links between files',
    usage: 'ln [OPTION]... TARGET... DIRECTORY\n  -s, --symbolic             make symbolic links instead of hard links\n  -f, --force                remove existing destination files\n      --help                 display this help and exit',
  },
  stat: {
    summary: 'Display file or file system status',
    usage: 'stat [OPTION]... FILE...\n  -c, --format=FORMAT        use the specified FORMAT instead of the default\n      --help                 display this help and exit',
  },
  file: {
    summary: 'Determine file type',
    usage: 'file [OPTION]... FILE...\n  -b, --brief                do not prepend filenames to output lines\n      --help                 display this help and exit',
  },
  find: {
    summary: 'Search for files in a directory hierarchy',
    usage: 'find [-H] [-L] [-P] [path...] [expression]\n  -name PATTERN              base of file name matches shell pattern\n  -iname PATTERN             like -name, but case insensitive\n  -path PATTERN              full path matches shell pattern\n  -ipath PATTERN             like -path, but case insensitive\n  -regex PATTERN             full path matches POSIX ERE\n  -type [fd]                 file is of type f (file) or d (directory)\n  -size [+-]N[ckMG]          file size is N units (default 512-byte blocks)\n  -empty                     file is empty and is either a regular file or a directory\n  -mtime N, -mmin N          file was last modified N days/minutes ago\n  -newer FILE                file was modified more recently than FILE\n  -perm MODE                 file permission bits match MODE\n  -maxdepth N, -mindepth N   limit traversal depth\n  -depth                     process directory contents before the directory itself\n  ( ) ! -not -a -and -o -or  expression operators\n  -print, -print0, -delete, -exec COMMAND {} [;|+], -ls   actions\n      --help                 display this help and exit',
  },
  du: {
    summary: 'Estimate file space usage',
    usage: 'du [OPTION]... [FILE]...\n  -s, --summarize            display only a total for each argument\n  -h, --human-readable       print sizes in human readable format\n  -a, --all                  write counts for all files, not just directories\n  -c, --total                produce a grand total\n  -d, --max-depth=N          print the total for a directory only if it is N or fewer levels below the argument\n  -k                         like --block-size=1K (default here)\n      --help                 display this help and exit',
  },
  df: {
    summary: 'Report file system disk space usage',
    usage: 'df [OPTION]... [FILE]...\n  -h, --human-readable       print sizes in powers of 1024\n      --help                 display this help and exit',
  },
  tree: {
    summary: 'List contents of directories in a tree-like format',
    usage: 'tree [OPTION]... [DIRECTORY]\n  -a, --all                  all files are listed\n  -d, --dirs                 list directories only\n  -L, --level=N              descend only N level directories deep\n  -F, --classify             append / to directories\n      --noreport             turn off file/directory count at end of tree listing\n      --help                 display this help and exit',
  },
  basename: {
    summary: 'Strip directory and suffix from a file name',
    usage: 'basename NAME [SUFFIX]\nbasename [OPTION]... NAME...\n  -a, --multiple             support multiple arguments and treat each as a NAME\n  -s, --suffix=SUFFIX        remove a trailing SUFFIX\n      --help                 display this help and exit',
  },
  dirname: {
    summary: 'Strip last component from file name',
    usage: 'dirname [OPTION]... NAME...\n      --help                 display this help and exit',
  },
  realpath: {
    summary: 'Print the resolved path',
    usage: 'realpath [OPTION]... FILE...\n  -e, --canonicalize-existing  all components of the path must exist\n  -m, --canonicalize-missing   no path components need exist or be a directory\n  -s, --strip, --no-symlinks   do not resolve symlinks (none exist here)\n      --help                 display this help and exit',
  },
  readlink: {
    summary: 'Print resolved symbolic links or canonical file names',
    usage: 'readlink [OPTION]... FILE...\n  -f, --canonicalize         canonicalize by following every symlink (same as realpath)\n  -m, --canonicalize-missing canonicalize, no requirement that components exist\n      --help                 display this help and exit',
  },
  chmod: {
    summary: 'Change file mode bits',
    usage: 'chmod [OPTION]... MODE[,MODE]... FILE...\n  -R, --recursive            change files and directories recursively\n  -v, --verbose              output a diagnostic for every file processed\n      --help                 display this help and exit',
  },
  mktemp: {
    summary: 'Create a temporary file or directory',
    usage: 'mktemp [OPTION]... [TEMPLATE]\n  -d, --directory            create a directory, not a file\n      --help                 display this help and exit',
  },
  truncate: {
    summary: 'Shrink or extend the size of a file to the specified size',
    usage: 'truncate [OPTION]... FILE...\n  -s, --size=SIZE            set or adjust the file size by SIZE bytes\n      --help                 display this help and exit',
  },
  chown: {
    summary: 'Change file owner and group (no-op here)',
    usage: 'chown [OPTION]... [OWNER][:[GROUP]] FILE...\n      --help                 display this help and exit',
  },
  chgrp: {
    summary: 'Change group ownership (no-op here)',
    usage: 'chgrp [OPTION]... GROUP FILE...\n      --help                 display this help and exit',
  },
  sync: {
    summary: 'Synchronize cached writes to persistent storage (no-op here)',
    usage: 'sync [OPTION]...\n      --help                 display this help and exit',
  },
  dd: {
    summary: 'Convert and copy a file',
    usage: 'dd [OPERAND]...\n  if=FILE, of=FILE, bs=BYTES, count=N, skip=N, seek=N,\n  conv=notrunc, status=none\n      --help                 display this help and exit',
  },
  cmp: {
    summary: 'Compare two files byte by byte',
    usage: 'cmp [OPTION]... FILE1 [FILE2 [SKIP1 [SKIP2]]]\n      --help                 display this help and exit',
  },
}
