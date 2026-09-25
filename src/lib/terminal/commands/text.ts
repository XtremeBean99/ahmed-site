import type { Cmd, CmdCtx, CmdInfo, CmdModule } from '../types'
import { FsError } from '../vfs'
import { compilePosix } from '../regex'
import { matchGlob } from '../glob'
import { formatPrintf } from '../printf'

// -------------------------------------------------------------------------------------------------
// shared helpers
// -------------------------------------------------------------------------------------------------

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function splitLines(data: string): string[] {
  if (data.endsWith('\n')) data = data.slice(0, -1)
  if (data === '') return []
  return data.split('\n')
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function errMissing(ctx: CmdCtx, name: string, operand: string): void {
  ctx.err(`${name}: ${operand}: No such file or directory\n`)
}

function readFileText(ctx: CmdCtx, name: string, path: string, status: (s: number) => void): string | null {
  const abs = ctx.resolve(path)
  try {
    return ctx.fs.readFile(abs)
  } catch (e) {
    if (e instanceof FsError) ctx.err(`${name}: ${path}: ${e.reason}\n`)
    else ctx.err(`${name}: ${path}: ${e instanceof Error ? e.message : String(e)}\n`)
    status(1)
    return null
  }
}

async function readAllInput(ctx: CmdCtx, operands: string[], name: string, status: (s: number) => void): Promise<string | null> {
  if (operands.length === 0 || operands[0] === '-') return ctx.stdin.readAll()
  let out = ''
  let bad = false
  for (const op of operands) {
    if (ctx.signal.aborted) return null
    const t = readFileText(ctx, name, op, status)
    if (t === null) { bad = true; continue }
    out += t
  }
  return bad ? (status(1), out) : out
}

// Return a string[] of all input lines from operands/stdin. bad = true when a file could not be read.
async function readInputLines(ctx: CmdCtx, operands: string[], name: string): Promise<{ lines: string[]; bad: boolean }> {
  let data = ''
  let bad = false
  if (operands.length === 0 || operands[0] === '-') {
    data = await ctx.stdin.readAll()
  } else {
    for (const op of operands) {
      if (ctx.signal.aborted) return { lines: [], bad: true }
      if (op === '-') { data += await ctx.stdin.readAll(); continue }
      const t = readFileText(ctx, name, op, () => {})
      if (t === null) { bad = true; continue }
      data += t
    }
  }
  return { lines: splitLines(data), bad }
}

interface OptSpec { short?: string; long?: string; arg?: boolean; multi?: boolean }
interface ParseError { opt: string; missingArg?: boolean; long?: boolean }
type ParseResult = { flags: Record<string, string | boolean | string[]>; operands: string[] } | ParseError

/** `posix`: stop at the first operand (the rest are operands), as xargs needs for its command's own flags. */
function parseOpts(args: string[], specs: OptSpec[], posix = false): ParseResult {
  const flags: Record<string, string | boolean | string[]> = {}
  const byShort = new Map<string, OptSpec>()
  const byLong = new Map<string, OptSpec>()
  for (const s of specs) {
    if (s.short) byShort.set(s.short, s)
    if (s.long) byLong.set(s.long, s)
  }
  const operands: string[] = []
  let i = 0
  while (i < args.length) {
    const a = args[i]
    if (a === '--') { operands.push(...args.slice(i + 1)); return { flags, operands } }
    if (a.startsWith('--') && a.length > 2) {
      let name = a.slice(2)
      let val: string | undefined
      const eq = name.indexOf('=')
      if (eq >= 0) { val = name.slice(eq + 1); name = name.slice(0, eq) }
      const spec = byLong.get(name)
      if (!spec) return { opt: name, long: true }
      const key = spec.long ?? name
      if (spec.arg) {
        if (val === undefined) {
          if (++i >= args.length) return { opt: name, long: true, missingArg: true }
          val = args[i]
        }
        if (spec.multi) { const arr = (flags[key] as string[] | undefined) ?? []; arr.push(val); flags[key] = arr }
        else flags[key] = val
      } else {
        if (val !== undefined) return { opt: name, long: true }
        flags[key] = true
      }
      i++
      continue
    }
    if (a.length > 1 && a[0] === '-') {
      for (let j = 1; j < a.length; j++) {
        const c = a[j]
        const spec = byShort.get(c)
        if (!spec) return { opt: c }
        const key = spec.long ?? c
        if (spec.arg) {
          let val = a.slice(j + 1)
          if (val === '') {
            if (++i >= args.length) return { opt: c, missingArg: true }
            val = args[i]
          }
          if (spec.multi) { const arr = (flags[key] as string[] | undefined) ?? []; arr.push(val); flags[key] = arr }
          else flags[key] = val
          j = a.length
        } else {
          flags[key] = true
        }
      }
      i++
      continue
    }
    if (posix) { operands.push(...args.slice(i)); return { flags, operands } }
    operands.push(a)
    i++
  }
  return { flags, operands }
}

function reportParseError(ctx: CmdCtx, name: string, e: ParseError): number {
  if (e.long) {
    if (e.missingArg) ctx.err(`${name}: option '--${e.opt}' requires an argument\n`)
    else ctx.err(`${name}: unrecognized option '--${e.opt}'\n`)
  } else {
    if (e.missingArg) ctx.err(`${name}: option requires an argument -- '${e.opt}'\n`)
    else ctx.err(`${name}: invalid option -- '${e.opt}'\n`)
  }
  const u = info[name]?.usage
  if (u) ctx.err(u + '\n')
  ctx.err(`Try '${name} --help' for more information.\n`)
  return 2
}

function helpCmd(ctx: CmdCtx, name: string): number {
  ctx.out(info[name].usage + '\n')
  return 0
}

function numFlag(flags: Record<string, string | boolean | string[]>, key: string): number | null {
  const v = flags[key]
  if (v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// -------------------------------------------------------------------------------------------------
// grep / egrep / fgrep
// -------------------------------------------------------------------------------------------------

interface GrepFlags {
  ere: boolean
  fixed: boolean
  icase: boolean
  invert: boolean
  lineNum: boolean
  count: boolean
  filesWith: boolean
  filesWithout: boolean
  only: boolean
  quiet: boolean
  noMessages: boolean
  recursive: boolean
  alwaysName: boolean
  neverName: boolean
  word: boolean
  lineMatch: boolean
  after: number
  before: number
  context: number
  color: 'auto' | 'always' | 'never'
  byteOffset: boolean
  maxCount: number
  include: string[]
  exclude: string[]
}

interface GrepMatch { start: number; end: number; text: string }

interface GrepMatcher {
  test(line: string): boolean
  matches(line: string): GrepMatch[]
}

const C_MATCH = '\x1b[01;31m\x1b[K'
const C_END = '\x1b[m\x1b[K'
const C_FILE = '\x1b[35m'
const C_SEP = '\x1b[36m'

function collectMatches(re: RegExp, s: string): GrepMatch[] {
  re.lastIndex = 0
  const out: GrepMatch[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const text = m[0]
    out.push({ start: m.index, end: m.index + text.length, text })
    if (text.length === 0) re.lastIndex = m.index + 1
  }
  return out
}

function buildMatchers(pats: string[], flags: GrepFlags): GrepMatcher[] {
  return pats.map((pat) => {
    if (pat === '') return { test: () => true, matches: () => [] }
    const base = compilePosix(pat, { ere: flags.ere, icase: flags.icase, fixed: flags.fixed })
    const src = base.source
    const fl = flags.icase ? 'i' : ''
    if (flags.lineMatch) {
      const re = new RegExp('^(?:' + src + ')$', fl)
      return {
        test: (l) => { re.lastIndex = 0; return re.test(l) },
        matches: (l) => (re.test(l) ? [{ start: 0, end: l.length, text: l }] : []),
      }
    }
    if (flags.word) {
      const re = new RegExp('(?<![A-Za-z0-9_])(?:' + src + ')(?![A-Za-z0-9_])', fl + 'g')
      return {
        test: (l) => { re.lastIndex = 0; return re.test(l) },
        matches: (l) => collectMatches(re, l),
      }
    }
    const re = new RegExp(src, fl + 'g')
    return {
      test: (l) => { re.lastIndex = 0; return re.test(l) },
      matches: (l) => collectMatches(re, l),
    }
  })
}

function grepColorize(line: string, ms: GrepMatch[], color: boolean): string {
  if (!color || ms.length === 0) return line
  let out = ''
  let pos = 0
  for (const m of ms) {
    if (m.start < pos || m.end <= m.start) continue
    out += line.slice(pos, m.start) + C_MATCH + m.text + C_END
    pos = m.end
  }
  out += line.slice(pos)
  return out
}

interface GrepPrefixOpts {
  name: string
  lineNum: boolean
  byteOffset: boolean
  sep: ':' | '-'
  color: boolean
  line: number
  byte: number
}

function grepPrefix(o: GrepPrefixOpts): string {
  let out = ''
  if (o.color) out += C_FILE + o.name + '\x1b[m'
  else out += o.name
  const se = (s: string) => (o.color ? C_SEP + s + '\x1b[m' : s)
  if (o.lineNum) out += se(':') + String(o.line)
  if (o.byteOffset) out += se(':') + String(o.byte)
  out += se(o.sep)
  return out
}

function parseGrepArgs(args: string[], ctx: CmdCtx, name: 'grep' | 'egrep' | 'fgrep'): { flags: GrepFlags; operands: string[]; patterns: string[]; patternFiles: string[] } | number {
  const flags: GrepFlags = {
    ere: false, fixed: false, icase: false, invert: false, lineNum: false, count: false,
    filesWith: false, filesWithout: false, only: false, quiet: false, noMessages: false,
    recursive: false, alwaysName: false, neverName: false, word: false, lineMatch: false,
    after: 0, before: 0, context: 0, color: 'never', byteOffset: false, maxCount: 0,
    include: [], exclude: [],
  }
  const operands: string[] = []
  const patterns: string[] = []
  const patternFiles: string[] = []
  let i = 0
  const needNum = (opt: string, val: string | undefined): number | null => {
    if (val === undefined) return null
    const n = Number(val)
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) return NaN
    return n
  }
  while (i < args.length) {
    const a = args[i]
    if (a === '--') { operands.push(...args.slice(i + 1)); break }
    if (a === '--help') { ctx.out(info[name].usage + '\n'); return 0 }
    if (a.startsWith('--')) {
      let optName = a.slice(2)
      let val: string | undefined
      const eq = optName.indexOf('=')
      if (eq >= 0) { val = optName.slice(eq + 1); optName = optName.slice(0, eq) }
      const setVal = (): string | undefined => {
        if (val === undefined) { i++; return args[i] }
        return val
      }
      switch (optName) {
        case 'help': ctx.out(info[name].usage + '\n'); return 0
        case 'color': {
          const c = val ?? 'auto'
          if (c === 'auto' || c === 'always' || c === 'never') flags.color = c
          else return reportParseError(ctx, name, { opt: optName, long: true })
          break
        }
        case 'include': {
          const v = setVal(); if (v === undefined) return reportParseError(ctx, name, { opt: optName, long: true, missingArg: true })
          flags.include.push(v); break
        }
        case 'exclude': {
          const v = setVal(); if (v === undefined) return reportParseError(ctx, name, { opt: optName, long: true, missingArg: true })
          flags.exclude.push(v); break
        }
        case 'max-count': {
          const v = setVal(); if (v === undefined) return reportParseError(ctx, name, { opt: optName, long: true, missingArg: true })
          const n = needNum(optName, v)
          if (n === null || Number.isNaN(n)) { ctx.err(`${name}: invalid max count\n`); return 2 }
          flags.maxCount = n; break
        }
        default: return reportParseError(ctx, name, { opt: optName, long: true })
      }
      i++
      continue
    }
    if (a.length > 1 && a[0] === '-') {
      if (/^-\d+$/.test(a)) { flags.context = Number(a.slice(1)); i++; continue }
      for (let j = 1; j < a.length; j++) {
        const c = a[j]
        switch (c) {
          case 'E': flags.ere = true; break
          case 'F': flags.fixed = true; break
          case 'G': flags.ere = false; break
          case 'P': flags.ere = true; break
          case 'i': flags.icase = true; break
          case 'v': flags.invert = true; break
          case 'n': flags.lineNum = true; break
          case 'c': flags.count = true; break
          case 'l': flags.filesWith = true; break
          case 'L': flags.filesWithout = true; break
          case 'o': flags.only = true; break
          case 'q': case 's': flags.quiet = c === 'q' ? true : flags.quiet; flags.noMessages = c === 's' ? true : flags.noMessages; break
          case 'r': case 'R': flags.recursive = true; break
          case 'H': flags.alwaysName = true; break
          case 'h': flags.neverName = true; break
          case 'w': flags.word = true; break
          case 'x': flags.lineMatch = true; break
          case 'b': flags.byteOffset = true; break
          case 'A': case 'B': case 'C': case 'm': {
            let val = a.slice(j + 1)
            if (val === '') { i++; val = args[i] }
            if (val === undefined) return reportParseError(ctx, name, { opt: c, missingArg: true })
            const n = needNum(c, val)
            if (n === null || Number.isNaN(n)) { ctx.err(`${name}: invalid context length argument\n`); return 2 }
            if (c === 'A') flags.after = n
            else if (c === 'B') flags.before = n
            else if (c === 'C') flags.context = n
            else flags.maxCount = n
            j = a.length
            break
          }
          case 'e': {
            let val = a.slice(j + 1)
            if (val === '') { i++; val = args[i] }
            if (val === undefined) return reportParseError(ctx, name, { opt: c, missingArg: true })
            patterns.push(val)
            j = a.length
            break
          }
          case 'f': {
            let val = a.slice(j + 1)
            if (val === '') { i++; val = args[i] }
            if (val === undefined) return reportParseError(ctx, name, { opt: c, missingArg: true })
            patternFiles.push(val)
            j = a.length
            break
          }
          default: return reportParseError(ctx, name, { opt: c })
        }
      }
      i++
      continue
    }
    operands.push(a)
    i++
  }
  return { flags, operands, patterns, patternFiles }
}

async function cmdGrep(ctx: CmdCtx): Promise<number> {
  const name = 'grep'
  const parsed = parseGrepArgs(ctx.args, ctx, name)
  if (typeof parsed === 'number') return parsed
  const { flags, operands } = parsed
  const patterns = [...parsed.patterns]
  const before = flags.before > 0 ? flags.before : flags.context
  const after = flags.after > 0 ? flags.after : flags.context
  const useColor = flags.color === 'always' || (flags.color === 'auto' && ctx.isTTYOut)

  for (const pf of parsed.patternFiles) {
    const t = readFileText(ctx, name, pf, () => {})
    if (t === null) return 2
    for (const line of splitLines(t)) {
      if (line === '') continue
      patterns.push(line)
    }
  }
  if (patterns.length === 0) {
    if (operands.length === 0) {
      ctx.err(info.grep.usage + '\n')
      ctx.err(`Try '${name} --help' for more information.\n`)
      return 2
    }
    patterns.push(operands.shift()!)
  }

  const matchers = buildMatchers(patterns, flags)
  const lineMatches = (line: string): GrepMatch[] => {
    const best: GrepMatch[] = []
    for (let i = 0; i < line.length; i++) {
      for (const m of matchers) {
        const re = m as unknown as { _re?: RegExp }
        void re
        break
      }
      break
    }
    // leftmost-longest scan across matchers
    const bestAt: GrepMatch[] = []
    const bestLen = -1
    for (const mt of matchers) {
      const ms = mt.matches(line)
      if (ms.length) {
        const first = ms[0]
        if (true) { /* collected below */ }
      }
    }
    void best; void bestAt; void bestLen
    return matcherScan(matchers, line)
  }

  let anyMatch = false
  const status = 1
  let bad = 0

  const wantName = (fileCount: number): boolean => {
    if (flags.neverName) return false
    if (flags.alwaysName || flags.recursive) return true
    return fileCount > 1
  }

  const files: { shown: string; abs: string }[] = []
  const collectFiles = (operand: string, base: string, out: { shown: string; abs: string }[]): boolean => {
    const abs = ctx.resolve(operand)
    if (!ctx.fs.exists(abs)) { errMissing(ctx, name, operand); bad = 2; return false }
    if (ctx.fs.isDir(abs)) {
      if (!flags.recursive) { ctx.err(`${name}: ${operand}: Is a directory\n`); bad = 2; return false }
      let names: string[]
      try { names = ctx.fs.list(abs) } catch { return false }
      for (const kid of names) {
        if (ctx.signal.aborted) return false
        const childAbs = abs + '/' + kid
        const childShown = (operand === '.' ? './' : operand.endsWith('/') ? operand : operand + '/') + kid
        if (ctx.fs.isDir(childAbs)) {
          collectFiles(childShown, childAbs, out)
        } else {
          const bn = kid
          if (flags.include.length && !flags.include.some((g) => matchGlob(g, bn))) continue
          if (flags.exclude.some((g) => matchGlob(g, bn))) continue
          out.push({ shown: childShown, abs: childAbs })
        }
      }
      return true
    }
    const bn = abs.slice(abs.lastIndexOf('/') + 1)
    if (flags.include.length && !flags.include.some((g) => matchGlob(g, bn))) return false
    if (flags.exclude.some((g) => matchGlob(g, bn))) return false
    out.push({ shown: operand, abs })
    return true
  }

  let fileOperands = operands
  if (flags.recursive && fileOperands.length === 0) fileOperands = ['.']
  for (const op of fileOperands) {
    if (ctx.signal.aborted) return 130
    collectFiles(op, ctx.resolve(op), files)
  }
  const showName = wantName(files.length)

  const colorize = (line: string, ms: GrepMatch[]): string => {
    if (!useColor) return line
    return grepColorize(line, ms, true)
  }

  for (const f of files) {
    if (ctx.signal.aborted) return 130
    let text: string
    try { text = ctx.fs.readFile(f.abs) } catch (e) {
      if (e instanceof FsError) ctx.err(`${name}: ${f.shown}: ${e.reason}\n`)
      else ctx.err(`${name}: ${f.shown}: ${e instanceof Error ? e.message : String(e)}\n`)
      bad = 2
      continue
    }
    const lines = splitLines(text)
    const byteOffs: number[] = []
    let acc = 0
    for (const l of lines) { byteOffs.push(acc); acc += encoder.encode(l).length + 1 }

    const selected: boolean[] = new Array(lines.length).fill(false)
    const allMatches: GrepMatch[][] = lines.map(() => [])
    let count = 0
    for (let li = 0; li < lines.length; li++) {
      if (ctx.signal.aborted) return 130
      const ms = matcherScan(matchers, lines[li])
      const matched = ms.length > 0
      const sel = flags.invert ? !matched : matched
      if (sel) {
        count++
        anyMatch = true
        selected[li] = true
        allMatches[li] = flags.invert ? [] : ms
        if (flags.maxCount > 0 && count >= flags.maxCount && !flags.count) break
      }
    }

    if (flags.quiet) {
      if (anyMatch) return 0
      continue
    }

    if (flags.count) {
      const label = showName ? `${f.shown}:${count}` : String(count)
      if (count > 0) anyMatch = true
      ctx.out(label + '\n')
      continue
    }
    if (flags.filesWith || flags.filesWithout) {
      const has = count > 0
      if (flags.filesWith && has) { ctx.out(f.shown + '\n'); anyMatch = true }
      if (flags.filesWithout && !has) ctx.out(f.shown + '\n')
      continue
    }

    const lineOut = (li: number, sep: ':' | '-', onlyText?: string): string => {
      const p = grepPrefix({
        name: f.shown,
        lineNum: flags.lineNum,
        byteOffset: flags.byteOffset,
        sep,
        color: useColor,
        line: li + 1,
        byte: byteOffs[li],
      })
      const content = onlyText !== undefined ? onlyText : colorize(lines[li], allMatches[li])
      return showName || flags.lineNum || flags.byteOffset ? p + content : content
    }

    if (before > 0 || after > 0) {
      const groups: { start: number; end: number }[] = []
      let cur: { start: number; end: number } | null = null
      for (let li = 0; li < lines.length; li++) {
        if (!selected[li]) continue
        const ws = Math.max(0, li - before)
        const we = Math.min(lines.length - 1, li + after)
        if (cur === null) cur = { start: ws, end: we }
        else if (ws <= cur.end + 1) cur.end = Math.max(cur.end, we)
        else { groups.push(cur); cur = { start: ws, end: we } }
      }
      if (cur) groups.push(cur)
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi]
        if (gi > 0) ctx.out('--\n')
        for (let li = g.start; li <= g.end; li++) {
          if (flags.only) {
            if (selected[li]) {
              for (const m of allMatches[li]) ctx.out(lineOut(li, ':') + '\n')
            } else {
              ctx.out(lineOut(li, '-') + '\n')
            }
          } else {
            ctx.out(lineOut(li, selected[li] ? ':' : '-') + '\n')
          }
        }
      }
      continue
    }

    for (let li = 0; li < lines.length; li++) {
      if (!selected[li]) continue
      if (flags.only) {
        for (const m of allMatches[li]) {
          if (m.end > m.start) ctx.out(lineOut(li, ':', m.text) + '\n')
        }
      } else {
        ctx.out(lineOut(li, ':') + '\n')
      }
    }
  }

  if (bad) return 2
  return anyMatch ? 0 : 1
}

// Leftmost-longest scan across matchers: at each position pick the longest match.
function matcherScan(matchers: GrepMatcher[], line: string): GrepMatch[] {
  const all: GrepMatch[] = []
  for (const mt of matchers) {
    for (const m of mt.matches(line)) {
      if (m.end > m.start) all.push(m)
    }
  }
  if (all.length === 0) return []
  all.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: GrepMatch[] = []
  let pos = 0
  for (const m of all) {
    if (m.start < pos) continue
    out.push(m)
    pos = m.end
  }
  return out
}

// -------------------------------------------------------------------------------------------------
// sort
// -------------------------------------------------------------------------------------------------

interface SortKey { start: number; startChar: number; end: number | null; endChar: number; n: boolean; r: boolean; f: boolean }
interface SortFlags {
  reverse: boolean
  numeric: boolean
  unique: boolean
  fold: boolean
  human: boolean
  version: boolean
  month: boolean
  check: boolean
  stable: boolean
  sep: string | null
  ignoreLeadingBlanks: boolean
  keys: SortKey[]
  outFile: string | null
}

function parseSortKey(v: string): SortKey | null {
  const m = /^(\d+)(?:\.(\d+))?([nrfb]*)(?:,(\d+)(?:\.(\d+))?([nrfb]*))?$/.exec(v)
  if (!m) return null
  const start = Number(m[1])
  const startChar = m[2] ? Number(m[2]) : 1
  const end = m[4] ? Number(m[4]) : null
  const endChar = m[5] ? Number(m[5]) : 0
  const mods = (m[3] ?? '') + (m[6] ?? '')
  return {
    start, startChar, end, endChar,
    n: mods.includes('n'), r: mods.includes('r'), f: mods.includes('f'),
  }
}

function sortFieldBounds(line: string, sep: string | null): { start: number; end: number }[] {
  const fields: { start: number; end: number }[] = []
  if (sep !== null) {
    let pos = 0
    let idx = line.indexOf(sep, pos)
    while (true) {
      const end = idx < 0 ? line.length : idx
      fields.push({ start: pos, end })
      if (idx < 0) break
      pos = idx + sep.length
      idx = line.indexOf(sep, pos)
    }
    return fields
  }
  let i = 0
  const n = line.length
  while (i < n && (line[i] === ' ' || line[i] === '\t')) i++
  while (i < n) {
    const start = i
    while (i < n && line[i] !== ' ' && line[i] !== '\t') i++
    const end = i
    fields.push({ start, end })
    while (i < n && (line[i] === ' ' || line[i] === '\t')) i++
  }
  return fields
}

function extractSortKey(line: string, k: SortKey, flags: SortFlags): string {
  const fields = sortFieldBounds(line, flags.sep)
  const sf = fields[k.start - 1]
  if (!sf) return ''
  let start = sf.start
  let end = sf.end
  if (k.startChar > 1) start = Math.min(sf.end, sf.start + k.startChar - 1)
  if (k.end !== null) {
    const ef = fields[k.end - 1]
    if (!ef) return ''
    end = k.endChar > 0 ? Math.min(ef.end, ef.start + k.endChar) : ef.end
  }
  if (end < start) end = start
  let key = line.slice(start, end)
  if (flags.ignoreLeadingBlanks) key = key.replace(/^[ \t]+/, '')
  return key
}

function parseNumericPrefix(s: string): number {
  const m = /^[ \t]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(s)
  if (!m) return 0
  const v = parseFloat(m[0])
  return Number.isNaN(v) ? 0 : v
}

function parseHuman(s: string): number {
  const m = /^[ \t]*([+-]?\d+(?:\.\d+)?)\s*([KMGTPEZY]?)/i.exec(s)
  if (!m) return 0
  const v = parseFloat(m[1])
  const mult = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4, p: 1024 ** 5, e: 1024 ** 6, z: 1024 ** 7, y: 1024 ** 8 }[m[2].toLowerCase()] ?? 1
  return Number.isNaN(v) ? 0 : v * mult
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function parseMonth(s: string): number {
  const t = s.trim().toLowerCase()
  for (let i = 0; i < 12; i++) if (t.startsWith(MONTHS[i])) return i + 1
  return 0
}

function compareVersion(a: string, b: string): number {
  const re = /\d+|\D+/g
  const pa = a.match(re) ?? []
  const pb = b.match(re) ?? []
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i]
    const y = pb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const nx = parseInt(x.replace(/^0+/, '') || '0', 10)
      const ny = parseInt(y.replace(/^0+/, '') || '0', 10)
      if (nx !== ny) return nx < ny ? -1 : 1
    } else {
      const c = cmpStr(x, y)
      if (c !== 0) return c
    }
  }
  return 0
}

function sortCmp(a: string, b: string, flags: SortFlags): number {
  const keys = flags.keys.length ? flags.keys : null
  if (keys) {
    for (const k of keys) {
      const ka = extractSortKey(a, k, flags)
      const kb = extractSortKey(b, k, flags)
      let c: number
      if (k.n) c = parseNumericPrefix(ka) - parseNumericPrefix(kb)
      else c = cmpKey(ka, kb, flags, k.f)
      if (c !== 0) return k.r ? -c : c
    }
  }
  const c = cmpKey(a, b, flags, flags.fold)
  return flags.reverse ? -c : c
}

function cmpKey(a: string, b: string, flags: SortFlags, fold: boolean): number {
  if (flags.numeric) return parseNumericPrefix(a) - parseNumericPrefix(b)
  if (flags.human) return parseHuman(a) - parseHuman(b)
  if (flags.version) return compareVersion(a, b)
  if (flags.month) return parseMonth(a) - parseMonth(b)
  const x = fold ? a.toLowerCase() : a
  const y = fold ? b.toLowerCase() : b
  return cmpStr(x, y)
}

function sortKeysEqual(a: string, b: string, flags: SortFlags): boolean {
  if (flags.keys.length === 0) return a === b
  for (const k of flags.keys) {
    const ka = extractSortKey(a, k, flags)
    const kb = extractSortKey(b, k, flags)
    if (k.n) { if (parseNumericPrefix(ka) !== parseNumericPrefix(kb)) return false }
    else if (cmpKey(ka, kb, flags, k.f) !== 0) return false
  }
  return true
}

async function cmdSort(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'r', long: 'reverse' }, { short: 'n', long: 'numeric-sort' }, { short: 'u', long: 'unique' },
    { short: 'f', long: 'ignore-case' }, { short: 'h', long: 'human-numeric-sort' }, { short: 'V', long: 'version-sort' },
    { short: 'M', long: 'month-sort' }, { short: 'c', long: 'check' }, { short: 's', long: 'stable' },
    { short: 't', long: 'field-separator', arg: true }, { short: 'k', long: 'key', arg: true, multi: true },
    { short: 'o', long: 'output', arg: true }, { short: 'b', long: 'ignore-leading-blanks' },
    { short: 'z', long: 'zero-terminated' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'sort', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'sort')
  const sf: SortFlags = {
    reverse: !!flags.reverse, numeric: !!flags['numeric-sort'], unique: !!flags.unique, fold: !!flags['ignore-case'],
    human: !!flags['human-numeric-sort'], version: !!flags['version-sort'], month: !!flags['month-sort'], check: !!flags.check,
    stable: !!flags.stable, sep: typeof flags['field-separator'] === 'string' ? flags['field-separator'] : null,
    ignoreLeadingBlanks: !!flags['ignore-leading-blanks'],
    keys: [], outFile: typeof flags.output === 'string' ? flags.output : null,
  }
  for (const kv of (flags.key as string[] | undefined) ?? []) {
    const k = parseSortKey(kv)
    if (!k) { ctx.err(`sort: invalid field specification '${kv}'\n`); return 2 }
    sf.keys.push(k)
  }

  const { lines, bad } = await readInputLines(ctx, operands, 'sort')
  if (bad) return 1

  if (sf.check) {
    for (let i = 1; i < lines.length; i++) {
      if (sortCmp(lines[i - 1], lines[i], sf) > 0) {
        const src = operands.length && operands[0] !== '-' ? operands[0] : '-'
        ctx.err(`sort: ${src}:${i + 1}: disorder: ${lines[i]}\n`)
        return 1
      }
    }
    return 0
  }

  const sorted = [...lines].sort((a, b) => sortCmp(a, b, sf))
  let out = sorted
  if (sf.unique) {
    out = sorted.filter((l, i) => i === 0 || !sortKeysEqual(sorted[i - 1], l, sf))
  }
  const text = out.length ? out.join('\n') + '\n' : ''
  if (sf.outFile !== null) {
    try { ctx.fs.writeFile(ctx.resolve(sf.outFile), text) } catch (e) {
      if (e instanceof FsError) ctx.err(`sort: ${sf.outFile}: ${e.reason}\n`)
      else ctx.err(`sort: ${sf.outFile}: ${e instanceof Error ? e.message : String(e)}\n`)
      return 1
    }
    return 0
  }
  ctx.out(text)
  return 0
}

// -------------------------------------------------------------------------------------------------
// uniq
// -------------------------------------------------------------------------------------------------

async function cmdUniq(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'c', long: 'count' }, { short: 'd', long: 'repeated' }, { short: 'u', long: 'unique' },
    { short: 'i', long: 'ignore-case' }, { short: 'f', long: 'skip-fields', arg: true },
    { short: 's', long: 'skip-chars', arg: true }, { short: 'w', long: 'check-chars', arg: true },
    { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'uniq', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'uniq')
  const { lines, bad } = await readInputLines(ctx, operands, 'uniq')
  if (bad) return 1
  const skipFields = Math.max(0, numFlag(flags, 'skip-fields') ?? 0)
  const skipChars = Math.max(0, numFlag(flags, 'skip-chars') ?? 0)
  const checkChars = Math.max(0, numFlag(flags, 'check-chars') ?? 0)

  const keyOf = (line: string): string => {
    let s = line
    for (let i = 0; i < skipFields; i++) {
      s = s.replace(/^[ \t]*\S+/, '')
    }
    s = s.slice(skipChars)
    if (checkChars > 0) s = s.slice(0, checkChars)
    return flags['ignore-case'] ? s.toLowerCase() : s
  }

  let out = ''
  let i = 0
  while (i < lines.length) {
    const k = keyOf(lines[i])
    let j = i + 1
    while (j < lines.length && keyOf(lines[j]) === k) j++
    const count = j - i
    const dup = count > 1
    if (flags.unique && !dup) out += lines[i] + '\n'
    else if (flags.repeated && dup) out += lines[i] + '\n'
    else if (!flags.unique && !flags.repeated) {
      out += (flags.count ? String(count).padStart(7) + ' ' : '') + lines[i] + '\n'
    }
    i = j
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// cut
// -------------------------------------------------------------------------------------------------

interface CutRange { start: number; end: number }

function parseCutList(v: string, name: string, ctx: CmdCtx): CutRange[] | null {
  const ranges: CutRange[] = []
  for (const part of v.split(',')) {
    if (part === '') continue
    let m = /^(\d+)-(\d+)$/.exec(part)
    if (m) { ranges.push({ start: Number(m[1]), end: Number(m[2]) }); continue }
    m = /^(\d+)-$/.exec(part)
    if (m) { ranges.push({ start: Number(m[1]), end: Infinity }); continue }
    m = /^-(\d+)$/.exec(part)
    if (m) { ranges.push({ start: 1, end: Number(m[1]) }); continue }
    if (/^\d+$/.test(part)) { const n = Number(part); ranges.push({ start: n, end: n }); continue }
    ctx.err(`${name}: invalid field value '${part}'\n`)
    return null
  }
  for (const r of ranges) {
    if (r.start < 1) { ctx.err(`${name}: fields and positions are numbered from 1\n`); return null }
  }
  return ranges
}

function inRanges(i: number, ranges: CutRange[]): boolean {
  return ranges.some((r) => i >= r.start && i <= r.end)
}

async function cmdCut(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'd', long: 'delimiter', arg: true }, { short: 'f', long: 'fields', arg: true },
    { short: 'c', long: 'characters', arg: true }, { short: 'b', long: 'bytes', arg: true },
    { short: 's', long: 'only-delimited' }, { long: 'complement' },
    { long: 'output-delimiter', arg: true }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'cut', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'cut')
  const mode = flags.fields ? 'f' : flags.characters ? 'c' : flags.bytes ? 'b' : null
  if (mode === null) { ctx.err('cut: you must specify a list of bytes, characters, or fields\n'); return 2 }
  const listV = (flags.fields ?? flags.characters ?? flags.bytes) as string
  const ranges = parseCutList(listV, 'cut', ctx)
  if (ranges === null) return 2
  const delim = typeof flags.delimiter === 'string' ? flags.delimiter : '\t'
  if (mode === 'f' && [...delim].length !== 1) {
    ctx.err('cut: the delimiter must be a single character\n')
    return 2
  }
  const outDelim = typeof flags['output-delimiter'] === 'string' ? flags['output-delimiter'] : mode === 'f' ? delim : ''
  const complement = !!flags.complement
  const onlyDelimited = !!flags['only-delimited']

  const { lines, bad } = await readInputLines(ctx, operands, 'cut')
  if (bad) return 1
  let out = ''
  for (const line of lines) {
    if (ctx.signal.aborted) return 130
    if (mode === 'f') {
      const parts = line.split(delim)
      if (onlyDelimited && parts.length === 1) continue
      const sel: string[] = []
      for (let i = 0; i < parts.length; i++) {
        const inR = inRanges(i + 1, ranges)
        if (complement ? !inR : inR) sel.push(parts[i])
      }
      out += sel.join(outDelim) + '\n'
    } else if (mode === 'c') {
      const chars = Array.from(line)
      const sel: string[] = []
      for (let i = 0; i < chars.length; i++) {
        const inR = inRanges(i + 1, ranges)
        if (complement ? !inR : inR) sel.push(chars[i])
      }
      out += sel.join(outDelim) + '\n'
    } else {
      const bytes = Array.from(encoder.encode(line))
      const sel: number[] = []
      for (let i = 0; i < bytes.length; i++) {
        const inR = inRanges(i + 1, ranges)
        if (complement ? !inR : inR) sel.push(bytes[i])
      }
      out += sel.map((b) => String.fromCharCode(b)).join(outDelim) + '\n'
    }
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// tr
// -------------------------------------------------------------------------------------------------

function parseTrSet(s: string): Set<number> {
  const set = new Set<number>()
  const addRange = (a: number, b: number) => {
    if (a > b) { const t = a; a = b; b = t }
    for (let c = a; c <= b; c++) set.add(c)
  }
  const classes: Record<string, number[]> = {
    alpha: range(65, 90).concat(range(97, 122)),
    digit: range(48, 57),
    alnum: range(48, 57).concat(range(65, 90), range(97, 122)),
    upper: range(65, 90),
    lower: range(97, 122),
    space: [32, 9, 10, 11, 12, 13],
    blank: [32, 9],
    punct: range(33, 47).concat(range(58, 64), range(91, 96), range(123, 126)),
    xdigit: range(48, 57).concat(range(65, 70), range(97, 102)),
    cntrl: range(0, 31).concat([127]),
    print: range(32, 126),
    graph: range(33, 126),
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) {
      const n = s[++i]
      if (n === 'n') set.add(10)
      else if (n === 't') set.add(9)
      else if (n === 'r') set.add(13)
      else if (n === '\\') set.add(92)
      else if (/[0-7]/.test(n)) {
        let oct = n
        let k = 1
        while (k < 2 && i + 1 < s.length && /[0-7]/.test(s[i + 1])) { oct += s[++i]; k++ }
        set.add(parseInt(oct, 8))
      } else set.add(n.codePointAt(0)!)
      i++
      continue
    }
    if (c === '[' && s[i + 1] === ':') {
      const end = s.indexOf(':]', i + 2)
      const cls = end > 0 ? s.slice(i + 2, end) : ''
      if (classes[cls]) { for (const x of classes[cls]) set.add(x); i = end + 2; continue }
    }
    if (i + 2 < s.length && s[i + 1] === '-' && s[i + 2] !== undefined) {
      const a = c.codePointAt(0)!
      const b = s[i + 2].codePointAt(0)!
      if (a < b) { addRange(a, b); i += 3; continue }
    }
    set.add(c.codePointAt(0)!)
    i++
  }
  return set
}

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

async function cmdTr(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'd', long: 'delete' }, { short: 's', long: 'squeeze-repeats' },
    { short: 'c', long: 'complement' }, { short: 'C', long: 'complement2' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'tr', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'tr')
  if (operands.length === 0) { ctx.err('tr: missing operand\n'); return 2 }
  const set1 = parseTrSet(operands[0])
  const set2 = operands.length > 1 ? parseTrSet(operands[1]) : null
  if (!flags.delete && !flags['squeeze-repeats'] && set2 === null) { ctx.err('tr: missing operand after \'' + operands[0] + '\'\n'); return 2 }
  const comp = !!flags.complement || !!flags.complement2
  const input = await ctx.stdin.readAll()

  let set1Arr = [...set1].sort((a, b) => a - b)
  if (comp) {
    const full: number[] = []
    for (let c = 0; c <= 0xffff; c++) if (!set1.has(c)) full.push(c)
    set1Arr = full
  }
  const set2Arr = set2 ? [...set2].sort((a, b) => a - b) : []
  const translate = (ch: number): number | null => {
    if (flags.delete) {
      const del = comp ? !set1.has(ch) : set1.has(ch)
      return del ? null : ch
    }
    const idx = set1Arr.indexOf(ch)
    if (idx < 0) return ch
    if (set2Arr.length === 0) return ch
    return set2Arr[Math.min(idx, set2Arr.length - 1)]
  }

  let chars = Array.from(input).map((c) => c.codePointAt(0)!)
  const filtered: number[] = []
  for (const ch of chars) {
    const t = translate(ch)
    if (t !== null) filtered.push(t)
  }
  chars = filtered
  if (flags['squeeze-repeats']) {
    const sq = flags.delete && set2 === null ? set1 : (set2 ?? set1)
    const out: number[] = []
    for (let i = 0; i < chars.length; i++) {
      if (i > 0 && chars[i] === chars[i - 1] && sq.has(chars[i])) continue
      out.push(chars[i])
    }
    chars = out
  }
  ctx.out(String.fromCodePoint(...chars))
  return 0
}

// -------------------------------------------------------------------------------------------------
// rev
// -------------------------------------------------------------------------------------------------

async function cmdRev(ctx: CmdCtx): Promise<number> {
  const { lines, bad } = await readInputLines(ctx, ctx.args, 'rev')
  if (bad) return 1
  ctx.out(lines.map((l) => Array.from(l).reverse().join('')).join('\n') + (lines.length ? '\n' : ''))
  return 0
}

// -------------------------------------------------------------------------------------------------
// nl
// -------------------------------------------------------------------------------------------------

async function cmdNl(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'b', long: 'body-numbering', arg: true }, { short: 'n', long: 'number-format', arg: true },
    { short: 'w', long: 'number-width', arg: true }, { short: 's', long: 'number-separator', arg: true },
    { short: 'v', long: 'first-line', arg: true }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'nl', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'nl')
  const style = typeof flags['body-numbering'] === 'string' ? flags['body-numbering'] : 't'
  const fmt = typeof flags['number-format'] === 'string' ? flags['number-format'] : 'rn'
  const width = Math.max(1, numFlag(flags, 'number-width') ?? 6)
  const sep = typeof flags['number-separator'] === 'string' ? flags['number-separator'] : '\t'
  let num = Math.max(0, Math.trunc(numFlag(flags, 'first-line') ?? 1))
  const { lines, bad } = await readInputLines(ctx, operands, 'nl')
  if (bad) return 1
  let out = ''
  for (const line of lines) {
    if (ctx.signal.aborted) return 130
    const numberThis = style === 'a' || (style === 't' && line.trim() !== '')
    if (numberThis) {
      const s = String(num)
      if (fmt === 'ln') out += s.padEnd(width) + sep + line + '\n'
      else if (fmt === 'rz') out += s.padStart(width, '0') + sep + line + '\n'
      else out += s.padStart(width) + sep + line + '\n'
      num++
    } else {
      out += line + '\n'
    }
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// paste
// -------------------------------------------------------------------------------------------------

async function cmdPaste(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'd', long: 'delimiters', arg: true }, { short: 's', long: 'serial' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'paste', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'paste')
  const delims = typeof flags.delimiters === 'string' ? [...unescapeTr(flags.delimiters)] : ['\t']
  const files: string[][] = []
  let bad = false
  const inputs = operands.length ? operands : ['-']
  for (const op of inputs) {
    if (op === '-') files.push(splitLines(await ctx.stdin.readAll()))
    else {
      const t = readFileText(ctx, 'paste', op, () => {})
      if (t === null) { bad = true; files.push([]); continue }
      files.push(splitLines(t))
    }
  }
  let out = ''
  if (flags.serial) {
    for (const f of files) {
      out += f.map((l, i) => l + (i < f.length - 1 ? delims[i % delims.length] : '')).join('') + '\n'
    }
  } else {
    const max = files.reduce((m, f) => Math.max(m, f.length), 0)
    for (let i = 0; i < max; i++) {
      const row: string[] = []
      for (let fi = 0; fi < files.length; fi++) {
        const v = files[fi][i] ?? ''
        row.push(v)
        if (fi < files.length - 1) row.push(delims[fi % delims.length])
      }
      out += row.join('') + '\n'
    }
  }
  ctx.out(out)
  return bad ? 1 : 0
}

function unescapeTr(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const n = s[++i]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === '\\') out += '\\'
      else out += n
    } else out += s[i]
  }
  return out
}

// -------------------------------------------------------------------------------------------------
// fold / fmt / column
// -------------------------------------------------------------------------------------------------

async function cmdFold(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'w', long: 'width', arg: true }, { short: 's', long: 'spaces' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'fold', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'fold')
  const width = Math.max(1, numFlag(flags, 'width') ?? 80)
  const { lines, bad } = await readInputLines(ctx, operands, 'fold')
  if (bad) return 1
  let out = ''
  for (const line of lines) {
    let chars = Array.from(line)
    while (chars.length > width) {
      let cut = width
      if (flags.spaces) {
        const slice = chars.slice(0, width)
        const sp = slice.lastIndexOf(' ')
        if (sp >= 0) cut = sp + 1
        else if (chars[width] === ' ') cut = width + 1
      }
      out += chars.slice(0, cut).join('') + '\n'
      chars = chars.slice(cut)
    }
    out += chars.join('') + '\n'
  }
  ctx.out(out)
  return 0
}

async function cmdFmt(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'w', long: 'width', arg: true }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'fmt', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'fmt')
  const width = Math.max(1, numFlag(flags, 'width') ?? 75)
  const { lines, bad } = await readInputLines(ctx, operands, 'fmt')
  if (bad) return 1
  let out = ''
  let para: string[] = []
  const flush = () => {
    if (para.length === 0) return
    const words = para.join(' ').split(/\s+/).filter(Boolean)
    let cur = ''
    for (const w of words) {
      if (cur === '') cur = w
      else if (cur.length + 1 + w.length <= width) cur += ' ' + w
      else { out += cur + '\n'; cur = w }
    }
    if (cur) out += cur + '\n'
    para = []
  }
  for (const line of lines) {
    if (line.trim() === '') { flush(); out += '\n' }
    else para.push(line.trim())
  }
  flush()
  ctx.out(out)
  return 0
}

async function cmdColumn(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 't', long: 'table' }, { short: 's', long: 'separator', arg: true },
    { short: 'o', long: 'output-separator', arg: true }, { short: 'c', long: 'output-width', arg: true },
    { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'column', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'column')
  const { lines, bad } = await readInputLines(ctx, operands, 'column')
  if (bad) return 1
  const width = numFlag(flags, 'output-width')
  let out = ''
  if (!flags.table) {
    for (const l of lines) out += (width !== null && l.length > width ? l.slice(0, width) : l) + '\n'
    ctx.out(out)
    return 0
  }
  const sep = typeof flags.separator === 'string' ? flags.separator : null
  const od = typeof flags['output-separator'] === 'string' ? flags['output-separator'] : '  '
  const rows = lines.map((l) => (sep === null ? l.trim().split(/\s+/) : l.split(sep)))
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const widths = new Array(cols).fill(0)
  for (const r of rows) for (let i = 0; i < r.length; i++) widths[i] = Math.max(widths[i], r[i].length)
  for (const r of rows) {
    const row = r.map((c, i) => c.padEnd(widths[i])).join(od).replace(/ +$/, '')
    out += (width !== null && row.length > width ? row.slice(0, width) : row) + '\n'
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// expand / unexpand
// -------------------------------------------------------------------------------------------------

async function cmdExpand(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 't', long: 'tabs', arg: true }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'expand', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'expand')
  const n = Math.max(1, numFlag(flags, 'tabs') ?? 8)
  const { lines, bad } = await readInputLines(ctx, operands, 'expand')
  if (bad) return 1
  let out = ''
  for (const line of lines) {
    let col = 0
    let s = ''
    for (const ch of line) {
      if (ch === '\t') {
        const spaces = n - (col % n)
        s += ' '.repeat(spaces)
        col += spaces
      } else { s += ch; col++ }
    }
    out += s + '\n'
  }
  ctx.out(out)
  return 0
}

async function cmdUnexpand(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 't', long: 'tabs', arg: true }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'unexpand', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'unexpand')
  const n = Math.max(1, numFlag(flags, 'tabs') ?? 8)
  const { lines, bad } = await readInputLines(ctx, operands, 'unexpand')
  if (bad) return 1
  let out = ''
  for (const line of lines) {
    let s = ''
    let i = 0
    let col = 0
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
      if (line[i] === '\t') { s += '\t'; col += n - (col % n); i++; continue }
      let run = 0
      while (i + run < line.length && line[i + run] === ' ') run++
      const toNext = n - (col % n)
      if (run >= toNext) {
        s += '\t'
        col += toNext
        i += toNext
      } else {
        s += ' '.repeat(run)
        col += run
        i += run
      }
    }
    out += s + line.slice(i) + '\n'
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// comm
// -------------------------------------------------------------------------------------------------

async function cmdComm(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: '1' }, { short: '2' }, { short: '3' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'comm', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'comm')
  if (operands.length < 2) { ctx.err('comm: missing operand\n'); return 2 }
  const a = readFileText(ctx, 'comm', operands[0], () => {})
  const b = readFileText(ctx, 'comm', operands[1], () => {})
  if (a === null || b === null) return 1
  const la = splitLines(a)
  const lb = splitLines(b)
  const sup1 = !!flags['1']
  const sup2 = !!flags['2']
  const sup3 = !!flags['3']
  let i = 0
  let j = 0
  let out = ''
  while (i < la.length && j < lb.length) {
    const c = cmpStr(la[i], lb[j])
    if (c < 0) { if (!sup1) out += la[i] + '\n'; i++ }
    else if (c > 0) { if (!sup2) out += (sup1 ? '' : '\t') + lb[j] + '\n'; j++ }
    else {
      if (!sup3) {
        let tabs = ''
        if (!sup1) tabs += '\t'
        if (!sup2) tabs += '\t'
        out += tabs + la[i] + '\n'
      }
      i++; j++
    }
  }
  while (i < la.length) { if (!sup1) out += la[i] + '\n'; i++ }
  while (j < lb.length) { if (!sup2) out += (sup1 ? '' : '\t') + lb[j] + '\n'; j++ }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// join
// -------------------------------------------------------------------------------------------------

async function cmdJoin(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: '1', long: 'j1', arg: true }, { short: '2', long: 'j2', arg: true },
    { short: 't', long: 'sep', arg: true }, { short: 'a', long: 'unpairable', arg: true },
    { short: 'v', long: 'only', arg: true }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'join', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'join')
  if (operands.length < 2) { ctx.err('join: missing operand\n'); return 2 }
  const f1 = numFlag(flags, 'j1') ?? 1
  const f2 = numFlag(flags, 'j2') ?? 1
  const delim = typeof flags.sep === 'string' ? flags.sep : ' '
  const aText = readFileText(ctx, 'join', operands[0], () => {})
  const bText = readFileText(ctx, 'join', operands[1], () => {})
  if (aText === null || bText === null) return 1
  const splitFields = (l: string): string[] => (delim === ' ' ? l.trim().split(/\s+/) : l.split(delim))
  const la = splitLines(aText)
  const lb = splitLines(bText)
  const mapB = new Map<string, string[][]>()
  for (const l of lb) {
    const f = splitFields(l)
    const key = f[f2 - 1] ?? ''
    const arr = mapB.get(key) ?? []
    arr.push(f)
    mapB.set(key, arr)
  }
  const used = new Set<string>()
  let out = ''
  const only = typeof flags.only === 'string' ? flags.only : null
  const emit = (af: string[], bf: string[] | null, original: string) => {
    if (bf === null) { out += original + '\n'; return }
    const fields = [...af, ...bf.filter((_, idx) => idx !== f2 - 1)]
    out += fields.join(delim) + '\n'
  }
  for (const l of la) {
    const af = splitFields(l)
    const key = af[f1 - 1] ?? ''
    const pairs = mapB.get(key)
    if (pairs && pairs.length && !only) {
      used.add(key)
      for (const bf of pairs) emit(af, bf, l)
    } else if (!pairs || !pairs.length) {
      if (typeof flags.unpairable === 'string' && flags.unpairable === '1') emit(af, null, l)
      else if (only === '1') emit(af, null, l)
    }
  }
  const showB = (typeof flags.unpairable === 'string' && flags.unpairable === '2') ||
    (typeof flags.only === 'string' && flags.only === '2')
  if (showB) {
    for (const l of lb) {
      const bf = splitFields(l)
      const key = bf[f2 - 1] ?? ''
      if (!used.has(key)) emit(bf, null, l)
    }
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// shuf
// -------------------------------------------------------------------------------------------------

async function cmdShuf(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'n', long: 'head-count', arg: true }, { short: 'e', long: 'echo' },
    { short: 'i', long: 'input-range', arg: true }, { long: 'random-source', arg: true },
    { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'shuf', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'shuf')
  const limit = numFlag(flags, 'head-count')
  let items: string[] = []
  if (flags.echo) {
    items = operands
  } else if (typeof flags['input-range'] === 'string') {
    const m = /^(\d+)-(\d+)$/.exec(flags['input-range'])
    if (!m) { ctx.err('shuf: invalid input range\n'); return 2 }
    const lo = Number(m[1])
    const hi = Number(m[2])
    const step = lo <= hi ? 1 : -1
    const count = Math.abs(hi - lo) + 1
    if (limit !== null && limit >= 0 && limit < count) {
      // still generate all, shuffle, then slice
    }
    for (let k = 0; k < count; k++) items.push(String(lo + k * step))
  } else {
    const { lines, bad } = await readInputLines(ctx, operands, 'shuf')
    if (bad) return 1
    items = lines
  }
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = items[i]; items[i] = items[j]; items[j] = t
  }
  if (limit !== null && limit >= 0) items = items.slice(0, limit)
  ctx.out(items.length ? items.join('\n') + '\n' : '')
  return 0
}

// -------------------------------------------------------------------------------------------------
// wc
// -------------------------------------------------------------------------------------------------

function wcCounts(data: string): { lines: number; words: number; bytes: number; chars: number; maxLine: number } {
  const lines = data.split('\n').length - 1
  const words = (data.match(/\S+/g) ?? []).length
  const bytes = encoder.encode(data).length
  const chars = Array.from(data).length
  let maxLine = 0
  for (const l of splitLines(data)) maxLine = Math.max(maxLine, Array.from(l).length)
  return { lines, words, bytes, chars, maxLine }
}

async function cmdWc(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'l', long: 'lines' }, { short: 'w', long: 'words' }, { short: 'c', long: 'bytes' },
    { short: 'm', long: 'chars' }, { short: 'L', long: 'max-line-length' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'wc', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'wc')
  const order: { key: 'lines' | 'words' | 'bytes' | 'chars' | 'maxLine'; on: boolean }[] = [
    { key: 'lines', on: !!flags.lines },
    { key: 'words', on: !!flags.words },
    { key: 'chars', on: !!flags.chars },
    { key: 'bytes', on: !!flags.bytes },
    { key: 'maxLine', on: !!flags['max-line-length'] },
  ]
  const none = !order.some((o) => o.on)
  if (none) { order[0].on = true; order[1].on = true; order[3].on = true }
  const show = order.filter((o) => o.on)

  const inputs = operands.length ? operands : ['-']
  const counts: { name: string; c: ReturnType<typeof wcCounts> }[] = []
  let bad = false
  for (const op of inputs) {
    let data: string | null
    if (op === '-') data = await ctx.stdin.readAll()
    else data = readFileText(ctx, 'wc', op, () => {})
    if (data === null) { bad = true; continue }
    counts.push({ name: op === '-' ? '' : op, c: wcCounts(data) })
  }
  if (counts.length === 0 && bad) return 1
  const totals = counts.reduce((acc, x) => ({
    lines: acc.lines + x.c.lines, words: acc.words + x.c.words, bytes: acc.bytes + x.c.bytes,
    chars: acc.chars + x.c.chars, maxLine: Math.max(acc.maxLine, x.c.maxLine),
  }), { lines: 0, words: 0, bytes: 0, chars: 0, maxLine: 0 })
  const digits = (n: number) => String(n).length
  const width = counts.length > 1
    ? Math.max(...show.map((o) => digits(totals[o.key])))
    : Math.max(...show.map((o) => digits(counts[0]?.c[o.key] ?? 0)))
  let out = ''
  for (const x of counts) {
    out += show.map((o) => String(x.c[o.key]).padStart(width)).join(' ')
    if (x.name) out += ' ' + x.name
    out += '\n'
  }
  if (counts.length > 1) {
    out += show.map((o) => String(totals[o.key]).padStart(width)).join(' ') + ' total\n'
  }
  ctx.out(out)
  return bad ? 1 : 0
}

// -------------------------------------------------------------------------------------------------
// tee
// -------------------------------------------------------------------------------------------------

async function cmdTee(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'a', long: 'append' }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'tee', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'tee')
  const data = await ctx.stdin.readAll()
  let bad = false
  for (const op of operands) {
    try { ctx.fs.writeFile(ctx.resolve(op), data, !!flags.append) } catch (e) {
      if (e instanceof FsError) ctx.err(`tee: ${op}: ${e.reason}\n`)
      else ctx.err(`tee: ${op}: ${e instanceof Error ? e.message : String(e)}\n`)
      bad = true
    }
  }
  ctx.out(data)
  return bad ? 1 : 0
}

// -------------------------------------------------------------------------------------------------
// xargs
// -------------------------------------------------------------------------------------------------

function shellWords(s: string): string[] {
  const words: string[] = []
  let cur = ''
  let has = false
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ' || c === '\t' || c === '\n') {
      if (has) { words.push(cur); cur = ''; has = false }
      i++
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      i++
      has = true
      while (i < s.length) {
        const d = s[i]
        if (q === '"' && d === '\\' && i + 1 < s.length) { cur += s[i + 1]; i += 2; continue }
        if (d === q) { i++; break }
        cur += d
        i++
      }
      continue
    }
    if (c === '\\' && i + 1 < s.length) { cur += s[i + 1]; i += 2; has = true; continue }
    cur += c
    i++
    has = true
  }
  if (has) words.push(cur)
  return words
}

async function cmdXargs(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'n', long: 'max-args', arg: true }, { short: 'I', long: 'replace', arg: true },
    { short: '0', long: 'null' }, { short: 'd', long: 'delimiter', arg: true },
    { short: 'r', long: 'no-run-if-empty' }, { short: 't', long: 'verbose' },
    { short: 'P', long: 'max-procs', arg: true }, { short: 's', long: 'max-chars', arg: true },
    { short: 'help', long: 'help' },
  ], true)
  if ('opt' in parsed) return reportParseError(ctx, 'xargs', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'xargs')
  const data = await ctx.stdin.readAll()
  const repl = typeof flags.replace === 'string' ? flags.replace : null
  let items: string[]
  if (repl !== null) {
    items = splitLines(data)
  } else if (flags.null) {
    items = data.split('\0').filter((s) => s !== '')
  } else if (typeof flags.delimiter === 'string') {
    items = data.split(flags.delimiter).filter((s) => s !== '')
  } else {
    items = shellWords(data)
  }
  const base = operands.length ? [...operands] : ['echo']
  const maxArgs = numFlag(flags, 'max-args')
  const verbose = !!flags.verbose
  let anyFail = false
  let ran = false

  const runOne = async (batch: string[]): Promise<void> => {
    ran = true
    const argv = buildXargsArgv(base, batch, repl)
    if (verbose) ctx.err(argv.join(' ') + '\n')
    const res = await ctx.exec(argv, '')
    if (res.out) ctx.out(res.out)
    if (res.err) ctx.err(res.err)
    if (res.status !== 0) anyFail = true
  }

  if (repl !== null) {
    for (const item of items) {
      if (ctx.signal.aborted) return 130
      await runOne([item])
    }
  } else if (maxArgs !== null && maxArgs > 0) {
    if (items.length === 0 && !flags['no-run-if-empty']) await runOne([])
    for (let i = 0; i < items.length; i += maxArgs) {
      if (ctx.signal.aborted) return 130
      await runOne(items.slice(i, i + maxArgs))
    }
  } else if (items.length > 0 || !flags['no-run-if-empty']) {
    await runOne(items)
  }
  void ran
  return anyFail ? 123 : 0
}

function buildXargsArgv(base: string[], batch: string[], repl: string | null): string[] {
  if (repl === null) return [...base, ...batch]
  const has = base.some((a) => a.includes(repl))
  if (!has) return [...base, ...batch]
  const item = batch[0] ?? ''
  return base.map((a) => a.split(repl).join(item))
}

// -------------------------------------------------------------------------------------------------
// diff
// -------------------------------------------------------------------------------------------------

type DiffOp = { t: 'eq' | 'del' | 'ins'; text: string }

function myersDiff(a: string[], b: string[], eq: (x: string, y: string) => boolean): DiffOp[] {
  const N = a.length
  const M = b.length
  const max = N + M
  if (max === 0) return []
  const v = new Map<number, number>()
  v.set(1, 0)
  const trace: Map<number, number>[] = []
  let foundD = -1
  outer:
  for (let d = 0; d <= max; d++) {
    const prev = new Map(v)
    trace.push(prev)
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && (prev.get(k - 1) ?? -1) < (prev.get(k + 1) ?? -1))) {
        x = prev.get(k + 1) ?? 0
      } else {
        x = (prev.get(k - 1) ?? -1) + 1
      }
      let y = x - k
      while (x < N && y < M && eq(a[x], b[y])) { x++; y++ }
      v.set(k, x)
      if (x >= N && y >= M) { foundD = d; break outer }
    }
  }
  const ops: DiffOp[] = []
  let x = N
  let y = M
  for (let d = foundD; d > 0; d--) {
    const vd = trace[d]
    const k = x - y
    let prevK: number
    if (k === -d || (k !== d && (vd.get(k - 1) ?? -1) < (vd.get(k + 1) ?? -1))) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = vd.get(prevK) ?? 0
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { ops.push({ t: 'eq', text: a[x - 1] }); x--; y-- }
    if (x === prevX) { ops.push({ t: 'ins', text: b[y - 1] }); y-- }
    else { ops.push({ t: 'del', text: a[x - 1] }); x-- }
  }
  while (x > 0 && y > 0) { ops.push({ t: 'eq', text: a[x - 1] }); x--; y-- }
  while (x > 0) { ops.push({ t: 'del', text: a[x - 1] }); x-- }
  while (y > 0) { ops.push({ t: 'ins', text: b[y - 1] }); y-- }
  ops.reverse()
  return ops
}

function diffDate(mtime: number): string {
  const d = new Date(mtime)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.000000000 +0000`
}

function mtimeOf(ctx: CmdCtx, abs: string): number {
  try { return ctx.fs.stat(abs).mtime } catch { return Date.now() }
}

function rangeStr(s: number, e: number): string {
  return s === e ? String(s) : `${s},${e}`
}

function unifiedDiff(ctx: CmdCtx, aLines: string[], bLines: string[], pathA: string, pathB: string, context: number, eq: (x: string, y: string) => boolean): string {
  const ops = myersDiff(aLines, bLines, eq)
  const changes: number[] = []
  for (let i = 0; i < ops.length; i++) if (ops[i].t !== 'eq') changes.push(i)
  if (changes.length === 0) return ''
  const blocks: { start: number; end: number }[] = []
  let bi = 0
  while (bi < changes.length) {
    const start = changes[bi]
    let end = changes[bi]
    bi++
    while (bi < changes.length && changes[bi] === end + 1) { end = changes[bi]; bi++ }
    blocks.push({ start, end })
  }
  const merged: { start: number; end: number }[] = []
  for (const bl of blocks) {
    if (merged.length && bl.start - merged[merged.length - 1].end - 1 <= context * 2) {
      merged[merged.length - 1].end = bl.end
    } else {
      merged.push({ start: bl.start, end: bl.end })
    }
  }
  let out = `--- ${pathA}\t${diffDate(mtimeOf(ctx, ctx.resolve(pathA)))}\n`
  out += `+++ ${pathB}\t${diffDate(mtimeOf(ctx, ctx.resolve(pathB)))}\n`
  const aPos = 0
  const bPos = 0
  for (const bl of merged) {
    const hs = Math.max(0, bl.start - context)
    const he = Math.min(ops.length, bl.end + 1 + context)
    let oldStart = 0
    let oldCount = 0
    let newStart = 0
    let newCount = 0
    const body: string[] = []
    for (let oi = hs; oi < he; oi++) {
      const op = ops[oi]
      if (op.t === 'eq') {
        if (oldCount === 0 && newCount === 0) oldStart++
        body.push(' ' + op.text)
        oldCount++
        newCount++
      } else if (op.t === 'del') {
        if (oldCount === 0 && newCount === 0) oldStart++
        body.push('-' + op.text)
        oldCount++
      } else {
        if (oldCount === 0 && newCount === 0) newStart++
        body.push('+' + op.text)
        newCount++
      }
    }
    // compute starts properly from consumed lines before hs
    let ca = 0
    let cb = 0
    for (let oi = 0; oi < hs; oi++) {
      if (ops[oi].t === 'eq' || ops[oi].t === 'del') ca++
      if (ops[oi].t === 'eq' || ops[oi].t === 'ins') cb++
    }
    const oldS = ca + 1
    const newS = cb + 1
    void oldStart; void newStart; void oldCount; void newCount
    // recount counts from ops slice
    let oc = 0
    let nc = 0
    for (let oi = hs; oi < he; oi++) {
      const op = ops[oi]
      if (op.t === 'eq' || op.t === 'del') oc++
      if (op.t === 'eq' || op.t === 'ins') nc++
    }
    out += `@@ -${oldS}${oc === 1 ? '' : ',' + oc} +${newS}${nc === 1 ? '' : ',' + nc} @@\n`
    for (const l of body) out += l + '\n'
  }
  void aPos; void bPos
  return out
}

function normalDiff(aLines: string[], bLines: string[], eq: (x: string, y: string) => boolean): string {
  const ops = myersDiff(aLines, bLines, eq)
  let out = ''
  let i = 0
  let aIdx = 0
  let bIdx = 0
  while (i < ops.length) {
    if (ops[i].t === 'eq') { aIdx++; bIdx++; i++; continue }
    const dels: string[] = []
    const inss: string[] = []
    while (i < ops.length && ops[i].t === 'del') { dels.push(ops[i].text); i++ }
    while (i < ops.length && ops[i].t === 'ins') { inss.push(ops[i].text); i++ }
    const aStart = aIdx + 1
    const bStart = bIdx + 1
    if (dels.length && inss.length) {
      out += `${rangeStr(aStart, aStart + dels.length - 1)}c${rangeStr(bStart, bStart + inss.length - 1)}\n`
      for (const l of dels) out += '< ' + l + '\n'
      out += '---\n'
      for (const l of inss) out += '> ' + l + '\n'
    } else if (dels.length) {
      out += `${rangeStr(aStart, aStart + dels.length - 1)}d${bIdx}\n`
      for (const l of dels) out += '< ' + l + '\n'
    } else {
      out += `${aIdx}a${rangeStr(bStart, bStart + inss.length - 1)}\n`
      for (const l of inss) out += '> ' + l + '\n'
    }
    aIdx += dels.length
    bIdx += inss.length
  }
  return out
}

async function cmdDiff(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'u', long: 'unified' }, { short: 'U', long: 'unified2', arg: true },
    { short: 'c', long: 'context' }, { short: 'q', long: 'brief' }, { short: 'r', long: 'recursive' },
    { short: 'i', long: 'ignore-case' }, { short: 'w', long: 'ignore-all-space' },
    { short: 'B', long: 'ignore-blank-lines' }, { short: 'y', long: 'side-by-side' },
    { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'diff', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'diff')
  if (operands.length === 0) { ctx.err('diff: missing operand\n'); return 2 }
  if (operands.length === 1) operands.push('-')
  const unified = !!flags.unified || typeof flags.unified2 === 'string'
  const context = unified ? (numFlag(flags, 'unified2') ?? 3) : 3
  const brief = !!flags.brief

  const readSide = async (op: string): Promise<{ lines: string[]; data: string; ok: boolean; isDir: boolean; path: string }> => {
    if (op === '-') {
      const data = await ctx.stdin.readAll()
      return { lines: splitLines(data), data, ok: true, isDir: false, path: '-' }
    }
    const abs = ctx.resolve(op)
    if (!ctx.fs.exists(abs)) { errMissing(ctx, 'diff', op); return { lines: [], data: '', ok: false, isDir: false, path: op } }
    if (ctx.fs.isDir(abs)) return { lines: [], data: '', ok: true, isDir: true, path: op }
    const data = ctx.fs.readFile(abs)
    return { lines: splitLines(data), data, ok: true, isDir: false, path: op }
  }

  const makeEq = (): ((x: string, y: string) => boolean) => {
    const ic = !!flags['ignore-case']
    const ws = !!flags['ignore-all-space']
    const bl = !!flags['ignore-blank-lines']
    return (x, y) => {
      if (bl && x.trim() === '' && y.trim() === '') return true
      let a = ic ? x.toLowerCase() : x
      let b = ic ? y.toLowerCase() : y
      if (ws) { a = a.replace(/\s+/g, ''); b = b.replace(/\s+/g, '') }
      return a === b
    }
  }

  const diffFiles = async (opA: string, opB: string): Promise<number> => {
    const a = await readSide(opA)
    const b = await readSide(opB)
    if (!a.ok || !b.ok) return 2
    if (a.isDir || b.isDir) {
      if (a.isDir && b.isDir && flags.recursive) return diffDirs(opA, opB)
      ctx.err(`diff: ${a.isDir ? opA : opB}: Is a directory\n`)
      return 2
    }
    const eq = makeEq()
    const same = a.lines.length === b.lines.length && a.lines.every((l, i) => eq(l, b.lines[i]))
    if (same) return 0
    if (brief) { ctx.out(`Files ${opA} and ${opB} differ\n`); return 1 }
    let text: string
    if (unified || flags.context) text = unifiedDiff(ctx, a.lines, b.lines, opA, opB, context, eq)
    else text = normalDiff(a.lines, b.lines, eq)
    ctx.out(text)
    return 1
  }

  const diffDirs = async (opA: string, opB: string): Promise<number> => {
    const absA = ctx.resolve(opA)
    const absB = ctx.resolve(opB)
    let status = 0
    let namesA: string[] = []
    let namesB: string[] = []
    try { namesA = ctx.fs.list(absA) } catch { ctx.err(`diff: ${opA}: No such file or directory\n`); return 2 }
    try { namesB = ctx.fs.list(absB) } catch { ctx.err(`diff: ${opB}: No such file or directory\n`); return 2 }
    const names = [...new Set([...namesA, ...namesB])].sort()
    for (const nm of names) {
      if (ctx.signal.aborted) return 130
      const inA = namesA.includes(nm)
      const inB = namesB.includes(nm)
      const pa = opA.replace(/\/+$/, '') + '/' + nm
      const pb = opB.replace(/\/+$/, '') + '/' + nm
      if (inA && inB) {
        const st = await diffFiles(pa, pb)
        if (st === 2) status = 2
        else if (st === 1 && status === 0) status = 1
      } else if (inA) {
        ctx.out(`Only in ${opA}: ${nm}\n`)
        if (status === 0) status = 1
      } else {
        ctx.out(`Only in ${opB}: ${nm}\n`)
        if (status === 0) status = 1
      }
    }
    return status
  }

  return diffFiles(operands[0], operands[1])
}

// -------------------------------------------------------------------------------------------------
// base64
// -------------------------------------------------------------------------------------------------

function base64Encode(data: string, wrap: number): string {
  const bytes = encoder.encode(data)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin)
  if (wrap <= 0) return b64
  let out = ''
  for (let i = 0; i < b64.length; i += wrap) out += b64.slice(i, i + wrap) + '\n'
  return out
}

function base64Decode(data: string): string {
  const clean = data.replace(/\s+/g, '')
  if (clean === '') return ''
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return decoder.decode(bytes)
}

async function cmdBase64(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'd', long: 'decode' }, { short: 'w', long: 'wrap', arg: true }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'base64', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'base64')
  const wrap = numFlag(flags, 'wrap') ?? 76
  const input = await readAllInput(ctx, operands, 'base64', () => {})
  if (input === null) return 1
  if (flags.decode) {
    try { ctx.out(base64Decode(input)) } catch { ctx.err('base64: invalid input\n'); return 1 }
  } else {
    ctx.out(base64Encode(input, wrap))
  }
  return 0
}

// -------------------------------------------------------------------------------------------------
// hash sums
// -------------------------------------------------------------------------------------------------

async function shaDigest(algo: string, data: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest(algo, encoder.encode(data))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// MD5 (RFC 1321), pure TypeScript.
function md5Digest(data: string): string {
  const bytes = encoder.encode(data)
  const len = bytes.length
  const padded = new Uint8Array((((len + 8) >> 6) + 1) << 6)
  padded.set(bytes)
  padded[len] = 0x80
  const bits = len * 8
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, bits >>> 0, true)
  dv.setUint32(padded.length - 4, Math.floor(bits / 0x100000000), true)

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const K: number[] = []
  for (let i = 0; i < 64; i++) K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000))

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  for (let off = 0; off < padded.length; off += 64) {
    const M: number[] = []
    for (let j = 0; j < 16; j++) M.push(dv.getUint32(off + j * 4, true))
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }
  const le = (x: number): string => {
    const b = new Uint8Array(4)
    const dv2 = new DataView(b.buffer)
    dv2.setUint32(0, x, true)
    return [...b].map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  return le(a0) + le(b0) + le(c0) + le(d0)
}

async function cmdHash(ctx: CmdCtx, name: string, algo: 'md5' | 'sha1' | 'sha256' | 'sha512'): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'c', long: 'check' }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, name, parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, name)
  const digest = async (data: string): Promise<string> => {
    if (algo === 'md5') return md5Digest(data)
    if (algo === 'sha1') return shaDigest('SHA-1', data)
    if (algo === 'sha256') return shaDigest('SHA-256', data)
    return shaDigest('SHA-512', data)
  }

  if (flags.check) {
    const input = await readAllInput(ctx, operands, name, () => {})
    if (input === null) return 1
    let allOk = true
    for (const line of splitLines(input)) {
      const m = /^([0-9a-fA-F]+)\s+(\S.*)$/.exec(line)
      if (!m) { ctx.err(`${name}: ${line}: no properly formatted checksum lines found\n`); allOk = false; continue }
      const expected = m[1].toLowerCase()
      const file = m[2].startsWith('*') ? m[2].slice(1) : m[2]
      let data: string | null = null
      if (file === '-') data = ''
      else {
        try { data = ctx.fs.readFile(ctx.resolve(file)) } catch { /* below */ }
      }
      if (data === null) {
        ctx.err(`${name}: ${file}: No such file or directory\n`)
        ctx.out(`${file}: FAILED open or read\n`)
        allOk = false
        continue
      }
      const got = await digest(data)
      if (got === expected) ctx.out(`${file}: OK\n`)
      else { ctx.out(`${file}: FAILED\n`); allOk = false }
    }
    return allOk ? 0 : 1
  }

  const inputs = operands.length ? operands : ['-']
  let bad = false
  let out = ''
  for (const op of inputs) {
    let data: string | null
    if (op === '-') data = await ctx.stdin.readAll()
    else data = readFileText(ctx, name, op, () => {})
    if (data === null) { bad = true; continue }
    out += `${await digest(data)}  ${op}\n`
  }
  ctx.out(out)
  return bad ? 1 : 0
}

// -------------------------------------------------------------------------------------------------
// cksum / sum
// -------------------------------------------------------------------------------------------------

function crc32Cksum(data: string): number {
  const bytes = encoder.encode(data)
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i << 24
    for (let j = 0; j < 8; j++) c = (c & 0x80000000) ? ((c << 1) ^ 0x04c11db7) : (c << 1)
    table[i] = c >>> 0
  }
  let crc = 0
  for (const b of bytes) crc = ((crc << 8) ^ table[((crc >>> 24) ^ b) & 0xff]) >>> 0
  let len = bytes.length
  while (len > 0) {
    crc = ((crc << 8) ^ table[((crc >>> 24) ^ (len & 0xff)) & 0xff]) >>> 0
    len = Math.floor(len / 256)
  }
  return (~crc) >>> 0
}

function bsdSum(data: string): { sum: number; blocks: number } {
  const bytes = encoder.encode(data)
  let sum = 0
  for (const b of bytes) sum = (((sum >> 1) | ((sum & 1) << 15)) + b) & 0xffff
  return { sum, blocks: Math.ceil(bytes.length / 1024) }
}

async function cmdCksum(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'cksum', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'cksum')
  const inputs = operands.length ? operands : ['-']
  let bad = false
  let out = ''
  for (const op of inputs) {
    let data: string | null
    if (op === '-') data = await ctx.stdin.readAll()
    else data = readFileText(ctx, 'cksum', op, () => {})
    if (data === null) { bad = true; continue }
    const crc = crc32Cksum(data)
    const bytes = encoder.encode(data).length
    out += `${crc} ${bytes} ${op}\n`
  }
  ctx.out(out)
  return bad ? 1 : 0
}

async function cmdSum(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'sum', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'sum')
  const inputs = operands.length ? operands : ['-']
  let bad = false
  let out = ''
  for (const op of inputs) {
    let data: string | null
    if (op === '-') data = await ctx.stdin.readAll()
    else data = readFileText(ctx, 'sum', op, () => {})
    if (data === null) { bad = true; continue }
    const s = bsdSum(data)
    out += `${String(s.sum).padStart(5)} ${String(s.blocks).padStart(5)} ${op}\n`
  }
  ctx.out(out)
  return bad ? 1 : 0
}

// -------------------------------------------------------------------------------------------------
// od
// -------------------------------------------------------------------------------------------------

function odFormatByteHex(b: number): string { return b.toString(16).padStart(2, '0') }
function odFormatByteOct(b: number): string { return b.toString(8).padStart(3, '0') }
function odFormatByteDec(b: number): string {
  const v = b > 127 ? b - 256 : b
  return String(v).padStart(4)
}
function odFormatChar(b: number): string {
  if (b === 0) return '\\0 '
  if (b === 10) return '\\n '
  if (b === 9) return '\\t '
  if (b === 8) return '\\b '
  if (b === 12) return '\\f '
  if (b === 13) return '\\r '
  if (b === 11) return '\\v '
  if (b >= 32 && b <= 126) return '   ' + String.fromCharCode(b)
  return '\\' + b.toString(8).padStart(3, '0') + ' '
}

function odDump(data: string, type: string, addr: 'x' | 'o' | 'd' | 'n', limit: number | null): string {
  let bytes = encoder.encode(data)
  if (limit !== null) bytes = bytes.slice(0, limit)
  const perLine = type === 'x' || type === 'o' || type === 'd' ? 16 : type === 'x2' || type === 'o2' ? 16 : 16
  let out = ''
  for (let off = 0; off < bytes.length; off += perLine) {
    const chunk = bytes.slice(off, Math.min(off + perLine, bytes.length))
    let address = ''
    if (addr === 'x') address = off.toString(16).padStart(6, '0')
    else if (addr === 'd') address = String(off).padStart(7, '0')
    else if (addr === 'o') address = off.toString(8).padStart(7, '0')
    let line: string
    if (type === 'c') {
      line = chunk.length ? [...chunk].map((b) => odFormatChar(b)).join('') : ''
    } else if (type === 'x') {
      const words: string[] = []
      for (let i = 0; i + 1 < chunk.length; i += 2) {
        words.push(odFormatByteHex(chunk[i + 1]) + odFormatByteHex(chunk[i]))
      }
      if (chunk.length % 2) words.push('00' + odFormatByteHex(chunk[chunk.length - 1]))
      line = words.join(' ')
    } else if (type === 'o') {
      const words: string[] = []
      for (let i = 0; i + 1 < chunk.length; i += 2) {
        const v = chunk[i] | (chunk[i + 1] << 8)
        words.push(v.toString(8).padStart(6, '0'))
      }
      if (chunk.length % 2) words.push(chunk[chunk.length - 1].toString(8).padStart(6, '0'))
      line = words.join(' ')
    } else {
      // x1, o1, d1
      line = [...chunk].map((b) => {
        if (type === 'x1') return odFormatByteHex(b)
        if (type === 'o1') return odFormatByteOct(b)
        return odFormatByteDec(b)
      }).join(' ')
    }
    out += (addr === 'n' ? ' ' + line : address + ' ' + line) + '\n'
  }
  return out
}

async function cmdOd(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'c', long: 'chars' }, { short: 'x', long: 'hex' },
    { short: 't', long: 'format', arg: true }, { short: 'A', long: 'address-radix', arg: true },
    { short: 'N', long: 'read-bytes', arg: true }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'od', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'od')
  let type = 'o'
  if (flags.chars) type = 'c'
  if (flags.hex) type = 'x'
  if (typeof flags.format === 'string') {
    const t = flags.format
    if (t === 'x1' || t === 'o1' || t === 'd1' || t === 'c') type = t
    else if (t === 'x2') type = 'x'
    else if (t === 'o2') type = 'o'
  }
  const addr = typeof flags['address-radix'] === 'string' && ['x', 'o', 'd', 'n'].includes(flags['address-radix'])
    ? flags['address-radix'] as 'x' | 'o' | 'd' | 'n'
    : 'o'
  const limit = numFlag(flags, 'read-bytes')
  const input = await readAllInput(ctx, operands, 'od', () => {})
  if (input === null) return 1
  ctx.out(odDump(input, type, addr, limit))
  return 0
}

// -------------------------------------------------------------------------------------------------
// xxd
// -------------------------------------------------------------------------------------------------

function xxdDump(data: string, cols: number, limit: number | null): string {
  let bytes = encoder.encode(data)
  if (limit !== null) bytes = bytes.slice(0, limit)
  let out = ''
  for (let off = 0; off < bytes.length; off += cols) {
    const chunk = bytes.slice(off, Math.min(off + cols, bytes.length))
    const groups: string[] = []
    for (let i = 0; i < chunk.length; i += 2) {
      groups.push(odFormatByteHex(chunk[i]) + (chunk[i + 1] !== undefined ? odFormatByteHex(chunk[i + 1]) : ''))
    }
    const hexArea = groups.join(' ').padEnd(cols * 2 + (cols >> 1) - 1)
    const ascii = [...chunk].map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')
    out += off.toString(16).padStart(8, '0') + ': ' + hexArea + '  ' + ascii + '\n'
  }
  return out
}

function xxdPlain(data: string, cols: number, limit: number | null): string {
  let bytes = encoder.encode(data)
  if (limit !== null) bytes = bytes.slice(0, limit)
  let out = ''
  for (let off = 0; off < bytes.length; off += cols) {
    const chunk = bytes.slice(off, Math.min(off + cols, bytes.length))
    out += [...chunk].map((b) => b.toString(16).padStart(2, '0')).join('') + '\n'
  }
  return out
}

function xxdRevert(data: string, plain: boolean): string {
  let hex: string
  if (plain) {
    hex = data.replace(/[^0-9a-fA-F]/g, '')
  } else {
    const lines = splitLines(data)
    let acc = ''
    for (const line of lines) {
      const body = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line
      const hexArea = body.slice(0, 50)
      acc += hexArea.replace(/[^0-9a-fA-F]/g, '')
    }
    hex = acc
  }
  if (hex.length % 2) hex = hex.slice(0, -1)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return decoder.decode(bytes)
}

async function cmdXxd(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'p', long: 'plain' }, { short: 'r', long: 'revert' },
    { short: 'c', long: 'cols', arg: true }, { short: 'l', long: 'len', arg: true },
    { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'xxd', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'xxd')
  const limit = numFlag(flags, 'len')
  const input = await readAllInput(ctx, operands, 'xxd', () => {})
  if (input === null) return 1
  if (flags.revert) {
    try { ctx.out(xxdRevert(input, !!flags.plain)) } catch { ctx.err('xxd: invalid input\n'); return 1 }
    return 0
  }
  const cols = numFlag(flags, 'cols') ?? (flags.plain ? 30 : 16)
  ctx.out(flags.plain ? xxdPlain(input, cols, limit) : xxdDump(input, cols, limit))
  return 0
}

// -------------------------------------------------------------------------------------------------
// hexdump
// -------------------------------------------------------------------------------------------------

async function cmdHexdump(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'C', long: 'canonical' }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'hexdump', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'hexdump')
  const input = await readAllInput(ctx, operands, 'hexdump', () => {})
  if (input === null) return 1
  const bytes = encoder.encode(input)
  let out = ''
  const cols = 16
  for (let off = 0; off < bytes.length; off += cols) {
    const chunk = bytes.slice(off, Math.min(off + cols, bytes.length))
    const first = [...chunk.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ')
    const second = [...chunk.slice(8)].map((b) => b.toString(16).padStart(2, '0')).join(' ')
    const data = (first + (second ? '  ' + second : '')).padEnd(48)
    const ascii = [...chunk].map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')
    out += off.toString(16).padStart(8, '0') + '  ' + data + '  |' + ascii + '|\n'
  }
  ctx.out(out)
  return 0
}

// -------------------------------------------------------------------------------------------------
// strings / seq / split
// -------------------------------------------------------------------------------------------------

async function cmdStrings(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'n', long: 'bytes', arg: true }, { short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, 'strings', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'strings')
  const min = Math.max(1, numFlag(flags, 'bytes') ?? 4)
  const input = await readAllInput(ctx, operands, 'strings', () => {})
  if (input === null) return 1
  let out = ''
  let run = ''
  for (const ch of input) {
    const c = ch.codePointAt(0)!
    if (c >= 32 && c <= 126) run += ch
    else {
      if (run.length >= min) out += run + '\n'
      run = ''
    }
  }
  if (run.length >= min) out += run + '\n'
  ctx.out(out)
  return 0
}

function seqDecimals(s: string): number {
  const m = /\.(\d+)/.exec(s)
  return m ? m[1].length : 0
}

async function cmdSeq(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 's', long: 'separator', arg: true }, { short: 'w', long: 'equal-width' },
    { short: 'f', long: 'format', arg: true }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'seq', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'seq')
  if (operands.length === 0 || operands.length > 3) { ctx.err('seq: wrong number of operands\n'); return 2 }
  let first = 1
  let last: number
  let step = 1
  const nums = operands.map(Number)
  if (nums.some((n) => !Number.isFinite(n))) { ctx.err(`seq: invalid floating point argument: '${operands.find((_, i) => !Number.isFinite(nums[i]))}'\n`); return 2 }
  if (operands.length === 1) last = nums[0]
  else if (operands.length === 2) { first = nums[0]; last = nums[1]; if (first > last) step = -1 }
  else { first = nums[0]; step = nums[1]; last = nums[2] }
  if (step === 0) { ctx.err('seq: zero increment\n'); return 2 }
  const prec = Math.max(...operands.map(seqDecimals))
  const scale = 10 ** prec
  const fi = Math.round(first * scale)
  const li = Math.round(last * scale)
  const si = Math.round(step * scale)
  if (si === 0) return 0
  if ((si > 0 && fi > li) || (si < 0 && fi < li)) return 0
  const values: string[] = []
  const fmtNum = (n: number): string => {
    if (prec > 0) return (n / scale).toFixed(prec)
    return String(n / scale)
  }
  for (let v = fi; si > 0 ? v <= li : v >= li; v += si) {
    if (ctx.signal.aborted) return 130
    values.push(fmtNum(v))
    if (values.length >= 20000) break
  }
  let items = values
  if (flags['equal-width']) {
    const width = Math.max(...items.map((s) => s.startsWith('-') ? s.length : s.length))
    items = items.map((s) => (s.startsWith('-') ? '-' + s.slice(1).padStart(width - 1, '0') : s.padStart(width, '0')))
  }
  const sep = typeof flags.separator === 'string' ? flags.separator : '\n'
  const body = flags.format ? items.map((s) => formatPrintf(flags.format as string, [s])).join(sep) : items.join(sep)
  ctx.out(body + (body ? '\n' : ''))
  return 0
}

function splitSuffix(i: number): string {
  // Bijective base-26 over a..z, offset so index 0 is 'aa' (as in GNU split).
  let n = i + 27
  let s = ''
  while (n > 0) {
    n--
    s = String.fromCharCode(97 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

async function cmdSplit(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'l', long: 'lines', arg: true }, { short: 'b', long: 'bytes2', arg: true },
    { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'split', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'split')
  const prefix = operands.length > 1 ? operands[1] : 'x'
  const inputOp = operands.length > 0 ? operands[0] : '-'
  const data = inputOp === '-' ? await ctx.stdin.readAll() : readFileText(ctx, 'split', inputOp, () => {})
  if (data === null) return 1
  const chunks: string[] = []
  if (typeof flags.lines === 'string') {
    const n = Math.max(1, Number(flags.lines) || 1)
    const lines = splitLines(data)
    for (let i = 0; i < lines.length; i += n) chunks.push(lines.slice(i, i + n).join('\n') + '\n')
  } else if (typeof flags.bytes2 === 'string') {
    const n = Math.max(1, Number(flags.bytes2) || 1)
    for (let i = 0; i < data.length; i += n) chunks.push(data.slice(i, i + n))
  } else {
    const lines = splitLines(data)
    for (let i = 0; i < lines.length; i += 1000) chunks.push(lines.slice(i, i + 1000).join('\n') + '\n')
  }
  let bad = false
  for (let i = 0; i < chunks.length; i++) {
    try { ctx.fs.writeFile(ctx.resolve(prefix + splitSuffix(i)), chunks[i]) } catch (e) {
      if (e instanceof FsError) ctx.err(`split: ${prefix}${splitSuffix(i)}: ${e.reason}\n`)
      bad = true
    }
  }
  return bad ? 1 : 0
}

// -------------------------------------------------------------------------------------------------
// iconv / dos2unix / unix2dos
// -------------------------------------------------------------------------------------------------

async function cmdIconv(ctx: CmdCtx): Promise<number> {
  const parsed = parseOpts(ctx.args, [
    { short: 'f', long: 'from-code', arg: true }, { short: 't', long: 'to-code', arg: true },
    { short: 'l', long: 'list' }, { short: 'help', long: 'help' },
  ])
  if ('opt' in parsed) return reportParseError(ctx, 'iconv', parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, 'iconv')
  if (flags.list) { ctx.out('UTF-8\nUS-ASCII\n'); return 0 }
  const from = String(flags['from-code'] ?? 'UTF-8').toLowerCase().replace(/[^a-z0-9]/g, '')
  const to = String(flags['to-code'] ?? 'UTF-8').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ok = ['utf8', 'usascii', 'ascii']
  if (!ok.includes(from) || !ok.includes(to)) {
    ctx.err(`iconv: unsupported conversion from '${flags['from-code'] ?? 'UTF-8'}' to '${flags['to-code'] ?? 'UTF-8'}'\n`)
    return 1
  }
  const input = await readAllInput(ctx, operands, 'iconv', () => {})
  if (input === null) return 1
  ctx.out(input)
  return 0
}

async function cmdLineEndings(ctx: CmdCtx, name: string, toDos: boolean): Promise<number> {
  const parsed = parseOpts(ctx.args, [{ short: 'help', long: 'help' }])
  if ('opt' in parsed) return reportParseError(ctx, name, parsed)
  const { flags, operands } = parsed
  if (flags.help) return helpCmd(ctx, name)
  if (operands.length === 0) {
    const data = await ctx.stdin.readAll()
    ctx.out(toDos ? data.replace(/\r?\n/g, '\r\n') : data.replace(/\r\n/g, '\n'))
    return 0
  }
  let bad = false
  for (const op of operands) {
    const t = readFileText(ctx, name, op, () => {})
    if (t === null) { bad = true; continue }
    const out = toDos ? t.replace(/\r?\n/g, '\r\n') : t.replace(/\r\n/g, '\n')
    try { ctx.fs.writeFile(ctx.resolve(op), out) } catch (e) {
      if (e instanceof FsError) ctx.err(`${name}: ${op}: ${e.reason}\n`)
      bad = true
    }
  }
  return bad ? 1 : 0
}

// -------------------------------------------------------------------------------------------------
// registry
// -------------------------------------------------------------------------------------------------

export const info: Record<string, CmdInfo> = {
  grep: { summary: 'print lines that match patterns', usage: 'Usage: grep [OPTION]... PATTERNS [FILE]...' },
  egrep: { summary: 'grep with extended regular expressions', usage: 'Usage: egrep [OPTION]... PATTERNS [FILE]...' },
  fgrep: { summary: 'grep with fixed strings', usage: 'Usage: fgrep [OPTION]... PATTERNS [FILE]...' },
  sort: { summary: 'sort lines of text', usage: 'Usage: sort [OPTION]... [FILE]...' },
  uniq: { summary: 'report or omit repeated lines', usage: 'Usage: uniq [OPTION]... [INPUT [OUTPUT]]' },
  cut: { summary: 'print selected parts of lines', usage: 'Usage: cut OPTION... [FILE]...' },
  tr: { summary: 'translate or delete characters', usage: 'Usage: tr [OPTION]... SET1 [SET2]' },
  rev: { summary: 'reverse lines characterwise', usage: 'Usage: rev [FILE]...' },
  nl: { summary: 'number lines of files', usage: 'Usage: nl [OPTION]... [FILE]...' },
  paste: { summary: 'merge lines of files', usage: 'Usage: paste [OPTION]... [FILE]...' },
  fold: { summary: 'wrap input lines', usage: 'Usage: fold [OPTION]... [FILE]...' },
  fmt: { summary: 'simple text formatter', usage: 'Usage: fmt [OPTION]... [FILE]...' },
  column: { summary: 'columnate lists or tables', usage: 'Usage: column [OPTION]... [FILE]...' },
  expand: { summary: 'convert tabs to spaces', usage: 'Usage: expand [OPTION]... [FILE]...' },
  unexpand: { summary: 'convert leading spaces to tabs', usage: 'Usage: unexpand [OPTION]... [FILE]...' },
  comm: { summary: 'compare two sorted files line by line', usage: 'Usage: comm [OPTION]... FILE1 FILE2' },
  join: { summary: 'join lines of two files on a common field', usage: 'Usage: join [OPTION]... FILE1 FILE2' },
  shuf: { summary: 'generate random permutations', usage: 'Usage: shuf [OPTION]... [FILE]' },
  wc: { summary: 'print line, word, and byte counts', usage: 'Usage: wc [OPTION]... [FILE]...' },
  tee: { summary: 'read stdin and write to stdout and files', usage: 'Usage: tee [OPTION]... [FILE]...' },
  xargs: { summary: 'build and execute command lines from stdin', usage: 'Usage: xargs [OPTION]... [COMMAND [ARG]...]' },
  diff: { summary: 'compare files line by line', usage: 'Usage: diff [OPTION]... FILES' },
  base64: { summary: 'base64 encode or decode', usage: 'Usage: base64 [OPTION]... [FILE]' },
  md5sum: { summary: 'print or check MD5 digests', usage: 'Usage: md5sum [OPTION]... [FILE]...' },
  sha1sum: { summary: 'print or check SHA1 digests', usage: 'Usage: sha1sum [OPTION]... [FILE]...' },
  sha256sum: { summary: 'print or check SHA256 digests', usage: 'Usage: sha256sum [OPTION]... [FILE]...' },
  sha512sum: { summary: 'print or check SHA512 digests', usage: 'Usage: sha512sum [OPTION]... [FILE]...' },
  cksum: { summary: 'print CRC checksum and byte counts', usage: 'Usage: cksum [FILE]...' },
  sum: { summary: 'print checksum and block counts', usage: 'Usage: sum [FILE]...' },
  od: { summary: 'dump files in octal and other formats', usage: 'Usage: od [OPTION]... [FILE]...' },
  xxd: { summary: 'make a hexdump or do the reverse', usage: 'Usage: xxd [OPTION]... [FILE]' },
  hexdump: { summary: 'display file contents in hexadecimal', usage: 'Usage: hexdump [OPTION]... [FILE]...' },
  strings: { summary: 'print the strings of printable characters in files', usage: 'Usage: strings [OPTION]... [FILE]...' },
  seq: { summary: 'print a sequence of numbers', usage: 'Usage: seq [OPTION]... LAST' },
  split: { summary: 'split a file into pieces', usage: 'Usage: split [OPTION]... [FILE [PREFIX]]' },
  iconv: { summary: 'convert text from one encoding to another', usage: 'Usage: iconv [OPTION]... [FILE]' },
  dos2unix: { summary: 'convert line endings from DOS to Unix', usage: 'Usage: dos2unix [FILE]...' },
  unix2dos: { summary: 'convert line endings from Unix to DOS', usage: 'Usage: unix2dos [FILE]...' },
}

function mkGrep(name: 'grep' | 'egrep' | 'fgrep'): Cmd {
  return async (ctx: CmdCtx): Promise<number> => {
    const args = [...ctx.args]
    const parsed = parseGrepArgs(args, ctx, name)
    if (typeof parsed === 'number') return parsed
    if (name === 'egrep') parsed.flags.ere = true
    if (name === 'fgrep') parsed.flags.fixed = true
    return grepRun(ctx, parsed, name)
  }
}

// cmdGrep is a thin wrapper used by egrep/fgrep via grepRun.
async function grepRun(ctx: CmdCtx, parsed: Exclude<ReturnType<typeof parseGrepArgs>, number>, name: 'grep' | 'egrep' | 'fgrep'): Promise<number> {
  const { flags, operands } = parsed
  const patterns = [...parsed.patterns]
  const before = flags.before > 0 ? flags.before : flags.context
  const after = flags.after > 0 ? flags.after : flags.context
  const useColor = flags.color === 'always' || (flags.color === 'auto' && ctx.isTTYOut)

  for (const pf of parsed.patternFiles) {
    const t = readFileText(ctx, name, pf, () => {})
    if (t === null) return 2
    const plines = t === '' ? [] : t.endsWith('\n') ? t.slice(0, -1).split('\n') : t.split('\n')
    for (const line of plines) patterns.push(line)
  }
  if (patterns.length === 0) {
    if (operands.length === 0) {
      ctx.err(info[name].usage + '\n')
      ctx.err(`Try '${name} --help' for more information.\n`)
      return 2
    }
    patterns.push(operands.shift()!)
  }
  const matchers = buildMatchers(patterns, flags)
  let anyMatch = false
  let bad = 0

  const files: { shown: string; abs: string; stdin?: boolean }[] = []
  const collectFiles = (operand: string): void => {
    if (operand === '-') { files.push({ shown: '-', abs: '-', stdin: true }); return }
    const abs = ctx.resolve(operand)
    if (!ctx.fs.exists(abs)) {
      if (!flags.noMessages) errMissing(ctx, name, operand)
      bad = 2
      return
    }
    if (ctx.fs.isDir(abs)) {
      if (!flags.recursive) {
        if (!flags.noMessages) ctx.err(`${name}: ${operand}: Is a directory\n`)
        bad = 2
        return
      }
      let names: string[] = []
      try { names = ctx.fs.list(abs) } catch { return }
      for (const kid of names) {
        if (ctx.signal.aborted) return
        const childShown = (operand === '.' ? './' : operand.endsWith('/') ? operand : operand + '/') + kid
        collectFiles(childShown)
      }
      return
    }
    const bn = abs.slice(abs.lastIndexOf('/') + 1)
    if (flags.include.length && !flags.include.some((g) => matchGlob(g, bn))) return
    if (flags.exclude.some((g) => matchGlob(g, bn))) return
    files.push({ shown: operand, abs })
  }

  let fileOperands = [...operands]
  if (fileOperands.length === 0) fileOperands = flags.recursive ? ['.'] : ['-']
  for (const op of fileOperands) {
    if (ctx.signal.aborted) return 130
    collectFiles(op)
  }
  const showName = flags.neverName ? false : flags.alwaysName || flags.recursive || files.length > 1

  for (const f of files) {
    if (ctx.signal.aborted) return 130
    let text: string
    if (f.stdin) {
      text = await ctx.stdin.readAll()
    } else {
      try { text = ctx.fs.readFile(f.abs) } catch (e) {
        if (!flags.noMessages) {
          if (e instanceof FsError) ctx.err(`${name}: ${f.shown}: ${e.reason}\n`)
          else ctx.err(`${name}: ${f.shown}: ${e instanceof Error ? e.message : String(e)}\n`)
        }
        bad = 2
        continue
      }
    }
    const lines = splitLines(text)
    const byteOffs: number[] = []
    let acc = 0
    for (const l of lines) { byteOffs.push(acc); acc += encoder.encode(l).length + 1 }

    const selected: boolean[] = new Array(lines.length).fill(false)
    const allMatches: GrepMatch[][] = lines.map(() => [])
    let count = 0
    for (let li = 0; li < lines.length; li++) {
      if (ctx.signal.aborted) return 130
      const matched = matchers.some((mt) => mt.test(lines[li]))
      const ms = matched ? matcherScan(matchers, lines[li]) : []
      const sel = flags.invert ? !matched : matched
      if (sel) {
        count++
        anyMatch = true
        selected[li] = true
        allMatches[li] = flags.invert ? [] : ms
        if (flags.maxCount > 0 && count >= flags.maxCount) break
      }
    }

    if (flags.quiet) {
      if (anyMatch) return 0
      continue
    }
    if (flags.count) {
      ctx.out((showName ? f.shown + ':' : '') + count + '\n')
      continue
    }
    if (flags.filesWith || flags.filesWithout) {
      const has = count > 0
      if (flags.filesWith && has) ctx.out(f.shown + '\n')
      if (flags.filesWithout && !has) ctx.out(f.shown + '\n')
      continue
    }

    const lineOut = (li: number, sep: ':' | '-', onlyText?: string): string => {
      let p = ''
      if (showName) {
        if (useColor) p += C_FILE + f.shown + '\x1b[m'
        else p += f.shown
      }
      const se = (s: string) => (useColor ? C_SEP + s + '\x1b[m' : s)
      if (flags.lineNum) {
        if (showName) p += se(':')
        p += String(li + 1)
      }
      if (flags.byteOffset) {
        if (showName || flags.lineNum) p += se(':')
        p += String(byteOffs[li])
      }
      if (showName || flags.lineNum || flags.byteOffset) p += se(sep)
      const content = onlyText !== undefined ? onlyText : grepColorize(lines[li], allMatches[li], useColor)
      return p + content
    }

    if (before > 0 || after > 0) {
      const groups: { start: number; end: number }[] = []
      let cur: { start: number; end: number } | null = null
      for (let li = 0; li < lines.length; li++) {
        if (!selected[li]) continue
        const ws = Math.max(0, li - before)
        const we = Math.min(lines.length - 1, li + after)
        if (cur === null) cur = { start: ws, end: we }
        else if (ws <= cur.end + 1) cur.end = Math.max(cur.end, we)
        else { groups.push(cur); cur = { start: ws, end: we } }
      }
      if (cur) groups.push(cur)
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi]
        if (gi > 0) ctx.out('--\n')
        for (let li = g.start; li <= g.end; li++) {
          if (flags.only) {
            if (selected[li]) for (const m of allMatches[li]) ctx.out(lineOut(li, ':', m.text) + '\n')
            else ctx.out(lineOut(li, '-') + '\n')
          } else {
            ctx.out(lineOut(li, selected[li] ? ':' : '-') + '\n')
          }
        }
      }
      continue
    }

    for (let li = 0; li < lines.length; li++) {
      if (!selected[li]) continue
      if (flags.only) {
        for (const m of allMatches[li]) {
          if (m.end > m.start) ctx.out(lineOut(li, ':', m.text) + '\n')
        }
      } else {
        ctx.out(lineOut(li, ':') + '\n')
      }
    }
  }

  if (bad) return 2
  return anyMatch ? 0 : 1
}

export const commands: Record<string, Cmd> = {
  grep: mkGrep('grep'),
  egrep: mkGrep('egrep'),
  fgrep: mkGrep('fgrep'),
  sort: cmdSort,
  uniq: cmdUniq,
  cut: cmdCut,
  tr: cmdTr,
  rev: cmdRev,
  nl: cmdNl,
  paste: cmdPaste,
  fold: cmdFold,
  fmt: cmdFmt,
  column: cmdColumn,
  expand: cmdExpand,
  unexpand: cmdUnexpand,
  comm: cmdComm,
  join: cmdJoin,
  shuf: cmdShuf,
  wc: cmdWc,
  tee: cmdTee,
  xargs: cmdXargs,
  diff: cmdDiff,
  base64: cmdBase64,
  md5sum: (ctx) => cmdHash(ctx, 'md5sum', 'md5'),
  sha1sum: (ctx) => cmdHash(ctx, 'sha1sum', 'sha1'),
  sha256sum: (ctx) => cmdHash(ctx, 'sha256sum', 'sha256'),
  sha512sum: (ctx) => cmdHash(ctx, 'sha512sum', 'sha512'),
  cksum: cmdCksum,
  sum: cmdSum,
  od: cmdOd,
  xxd: cmdXxd,
  hexdump: cmdHexdump,
  strings: cmdStrings,
  seq: cmdSeq,
  split: cmdSplit,
  iconv: cmdIconv,
  dos2unix: (ctx) => cmdLineEndings(ctx, 'dos2unix', false),
  unix2dos: (ctx) => cmdLineEndings(ctx, 'unix2dos', true),
}
