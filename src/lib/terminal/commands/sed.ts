// sed: a GNU sed subset for the terminal VFS. Scripts are parsed to a small AST, compiled to a
// flat instruction list (blocks become guarded regions), then executed against the input stream.
import type { Cmd, CmdCtx, CmdInfo, CmdModule } from '../types'
import { compilePosix } from '../regex'

// ---- options / result ---------------------------------------------------------

interface SedOptions {
  quiet: boolean
  ere: boolean
  separate: boolean
  inPlace: boolean
  backupSuffix?: string
  help: boolean
  scripts: { text: string; expr: number; fromFile?: boolean }[]
  files: string[]
}

// ---- AST ----------------------------------------------------------------------

interface SubFlags { global: boolean; print: boolean; icase: boolean; occ: number; write?: string }

type SedAddr =
  | { t: 'line'; n: number }
  | { t: 'last' }
  | { t: 're'; re: RegExp }
  | { t: 'step'; first: number; step: number }
  | { t: 'rel'; n: number }
  | { t: 'mod'; n: number }

interface SedBase { expr: number; pos: number; a1?: SedAddr; a2?: SedAddr; not: boolean }

type SedNode =
  | (SedBase & { kind: 'sub'; re: RegExp; repl: string; flags: SubFlags })
  | (SedBase & { kind: 'y'; from: string; to: string })
  | (SedBase & { kind: 'simple'; op: 'd' | 'D' | 'p' | 'P' | 'n' | 'N' | 'g' | 'G' | 'h' | 'H' | 'x' | 'l' | '=' | 'q' | 'Q'; code?: number })
  | (SedBase & { kind: 'text'; op: 'a' | 'i' | 'c'; text: string | null })
  | (SedBase & { kind: 'file'; op: 'r' | 'w'; file: string })
  | (SedBase & { kind: 'branch'; op: 'b' | 't' | 'T'; label?: string; target?: number })
  | (SedBase & { kind: 'label'; name: string })
  | (SedBase & { kind: 'block'; children: SedNode[] })

class SedParseError extends Error {
  constructor(message: string, public expr: number, public pos: number) { super(message) }
}

// ---- parser -------------------------------------------------------------------

const SIMPLE_OPS = new Set(['d', 'D', 'p', 'P', 'n', 'N', 'g', 'G', 'h', 'H', 'x', 'l', '='])

class SedParser {
  private i = 0
  private lastRe: string | null = null

  constructor(private s: string, private ere: boolean, private expr: number) {}

  parse(): SedNode[] {
    const nodes = this.parseCommands()
    this.skipSep()
    if (this.i < this.s.length) this.fail(`unexpected \`${this.s[this.i]}'`)
    return nodes
  }

  private parseCommands(stop?: string): SedNode[] {
    const out: SedNode[] = []
    for (;;) {
      this.skipSep()
      if (this.i >= this.s.length) break
      if (stop !== undefined && this.s[this.i] === stop) break
      if (this.s[this.i] === '#') { this.skipLine(); continue }
      out.push(this.parseCommand())
    }
    return out
  }

  private parseCommand(): SedNode {
    const start = this.i
    this.skipBlanks()
    const a1: SedAddr | undefined = this.tryParseAddr()
    let a2: SedAddr | undefined
    let not = false
    if (a1) {
      this.skipBlanks()
      if (this.s[this.i] === ',') {
        this.i++
        this.skipBlanks()
        a2 = this.tryParseAddr(true)
        if (!a2) this.failAt('unexpected `,\'', start)
      }
      this.skipBlanks()
    }
    if (this.s[this.i] === '!') { not = true; this.i++; this.skipBlanks() }
    if (this.i >= this.s.length) this.failAt('expected command after address', start)
    const c = this.s[this.i]
    const pos = this.i
    const base: SedBase = { expr: this.expr, pos, a1, a2, not }

    if (c === '{') {
      this.i++
      const children = this.parseCommands('}')
      if (this.s[this.i] !== '}') this.failAt('unmatched `{\'', pos)
      this.i++
      return { ...base, kind: 'block', children }
    }
    if (c === '}') this.failAt('unexpected `}\'', pos)
    if (c === 's') { this.i++; return { ...base, ...this.parseSub(pos) } }
    if (c === 'y') { this.i++; return { ...base, ...this.parseY(pos) } }
    if (SIMPLE_OPS.has(c)) { this.i++; return { ...base, kind: 'simple', op: c as 'd' } }
    if (c === 'q' || c === 'Q') {
      this.i++
      const code = this.parseInt()
      return { ...base, kind: 'simple', op: c, code }
    }
    if (c === 'a' || c === 'i' || c === 'c') {
      this.i++
      const text = this.parseText()
      return { ...base, kind: 'text', op: c, text }
    }
    if (c === 'r' || c === 'w') {
      this.i++
      const file = this.parseFileName()
      return { ...base, kind: 'file', op: c, file }
    }
    if (c === 'b' || c === 't' || c === 'T') {
      this.i++
      const label = this.parseLabel()
      return { ...base, kind: 'branch', op: c, label }
    }
    if (c === ':') {
      this.i++
      const name = this.parseLabel()
      if (!name) this.failAt('empty label', pos)
      return { ...base, kind: 'label', name }
    }
    if (c === 'z' || c === 'F' || c === 'e') this.failAt(`unknown command: \`${c}'`, pos + 1)
    this.failAt(`unknown command: \`${c}'`, pos + 1)
  }

  private tryParseAddr(second = false): SedAddr | undefined {
    this.skipBlanks()
    const c = this.s[this.i]
    if (c === undefined) return undefined
    if (/[0-9]/.test(c)) {
      const n = this.parseNumber()
      this.skipBlanks()
      if (this.s[this.i] === '~') {
        this.i++
        const step = this.parseNumber()
        if (step <= 0) this.failAt('invalid address', this.i - String(step).length)
        return { t: 'step', first: n, step }
      }
      return { t: 'line', n }
    }
    if (c === '$') { this.i++; return { t: 'last' } }
    if (c === '/') {
      this.i++
      const raw = this.parseDelimited('/', 'unterminated address regex')
      const icase = this.parseAddrFlags()
      return { t: 're', re: this.compile(raw, icase) }
    }
    if (c === '\\' && this.i + 1 < this.s.length && this.s[this.i + 1] !== '\n') {
      const delim = this.s[this.i + 1]
      this.i += 2
      const raw = this.parseDelimited(delim, 'unterminated address regex')
      const icase = this.parseAddrFlags()
      return { t: 're', re: this.compile(raw, icase) }
    }
    if (second && c === '+') {
      this.i++
      return { t: 'rel', n: this.parseNumber() }
    }
    if (second && c === '~') {
      this.i++
      const n = this.parseNumber()
      if (n <= 0) this.failAt('invalid address', this.i - String(n).length)
      return { t: 'mod', n }
    }
    return undefined
  }

  private compile(pattern: string, icase: boolean): RegExp {
    if (pattern === '') {
      if (this.lastRe === null) this.failAt('no previous regular expression', 0)
      pattern = this.lastRe
    } else {
      this.lastRe = pattern
    }
    try {
      const re = compilePosix(pattern, { ere: this.ere, icase })
      return new RegExp(re.source, re.flags + 'm')
    } catch (e) {
      this.failAt(`invalid regular expression: ${e instanceof Error ? e.message : String(e)}`, this.i)
    }
  }

  private parseSub(pos: number): { kind: 'sub'; re: RegExp; repl: string; flags: SubFlags } {
    const delim = this.s[this.i]
    if (delim === undefined || delim === '\n') this.failAt('unterminated `s\' command', pos)
    this.i++
    let pattern = this.parseDelimited(delim, 'unterminated `s\' command')
    const repl = this.parseDelimited(delim, 'unterminated `s\' command')
    const flags = this.parseSubFlags()
    let re: RegExp
    if (pattern === '') {
      if (this.lastRe === null) this.failAt('no previous regular expression', 0)
      pattern = this.lastRe
    } else {
      this.lastRe = pattern
    }
    try {
      const c = compilePosix(pattern, { ere: this.ere, icase: flags.icase })
      re = new RegExp(c.source, c.flags + 'mg')
    } catch (e) {
      this.failAt(`invalid regular expression: ${e instanceof Error ? e.message : String(e)}`, pos)
    }
    return { kind: 'sub', re, repl, flags }
  }

  private parseSubFlags(): SubFlags {
    const flags: SubFlags = { global: false, print: false, icase: false, occ: 0 }
    for (;;) {
      const c = this.s[this.i]
      if (c === undefined || c === ';' || c === '\n' || c === '}' || c === ' ' || c === '\t') break
      if (c === 'g') { flags.global = true; this.i++; continue }
      if (c === 'p') { flags.print = true; this.i++; continue }
      if (c === 'i' || c === 'I') { flags.icase = true; this.i++; continue }
      if (/[0-9]/.test(c)) {
        let n = 0
        while (/[0-9]/.test(this.s[this.i] ?? '')) { n = n * 10 + Number(this.s[this.i]); this.i++ }
        flags.occ = n
        continue
      }
      if (c === 'w') {
        this.i++
        const file = this.parseFileName()
        flags.write = file
        break
      }
      if (c === 'e') this.failAt('e modifier not supported', this.i)
      this.failAt(`unknown option to \`s': \`${c}'`, this.i)
    }
    return flags
  }

  private parseY(pos: number): { kind: 'y'; from: string; to: string } {
    const delim = this.s[this.i]
    if (delim === undefined || delim === '\n') this.failAt('unterminated `y\' command', pos)
    this.i++
    const from = this.parseDelimited(delim, 'unterminated `y\' command')
    const to = this.parseDelimited(delim, 'unterminated `y\' command')
    const a = unescapeY(from)
    const b = unescapeY(to)
    if (a.length !== b.length) this.failAt('strings for `y\' command are different lengths', this.i)
    return { kind: 'y', from: a, to: b }
  }

  private parseDelimited(delim: string, err: string): string {
    let out = ''
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (c === delim) { this.i++; return out }
      if (c === '\\' && this.i + 1 < this.s.length) {
        out += c + this.s[this.i + 1]
        this.i += 2
        continue
      }
      out += c
      this.i++
    }
    this.failAt(err, this.i)
  }

  private parseAddrFlags(): boolean {
    let icase = false
    for (;;) {
      const c = this.s[this.i]
      if (c === 'I' || c === 'i') { icase = true; this.i++; continue }
      if (c === 'M' || c === 'm') { this.i++; continue }
      break
    }
    return icase
  }

  private parseText(): string | null {
    const c = this.s[this.i]
    if (c === '\\') {
      this.i++
      if (this.s[this.i] === '\n') {
        this.i++
        let text = ''
        let lines = 0
        for (;;) {
          if (this.i >= this.s.length) break
          const nl = this.s.indexOf('\n', this.i)
          const line = nl < 0 ? this.s.slice(this.i) : this.s.slice(this.i, nl)
          lines++
          if (nl < 0) { text += line; this.i = this.s.length; break }
          this.i = nl + 1
          if (line.endsWith('\\')) { text += line.slice(0, -1) + '\n'; continue }
          text += line
          break
        }
        return lines === 0 ? null : text
      }
      const nl = this.s.indexOf('\n', this.i)
      const text = nl < 0 ? this.s.slice(this.i) : this.s.slice(this.i, nl)
      this.i = nl < 0 ? this.s.length : nl
      return text
    }
    while (this.s[this.i] === ' ' || this.s[this.i] === '\t') this.i++
    const nl = this.s.indexOf('\n', this.i)
    const text = nl < 0 ? this.s.slice(this.i) : this.s.slice(this.i, nl)
    this.i = nl < 0 ? this.s.length : nl
    return text
  }

  private parseFileName(): string {
    while (this.s[this.i] === ' ' || this.s[this.i] === '\t') this.i++
    const nl = this.s.indexOf('\n', this.i)
    const text = nl < 0 ? this.s.slice(this.i) : this.s.slice(this.i, nl)
    this.i = nl < 0 ? this.s.length : nl
    return text
  }

  private parseLabel(): string | undefined {
    const start = this.i
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (c === ';' || c === '\n' || c === '}') break
      this.i++
    }
    const label = this.s.slice(start, this.i).replace(/[ \t]+$/, '')
    if (this.s[this.i] === ';' || this.s[this.i] === '}') this.i++
    return label
  }

  private parseInt(): number | undefined {
    this.skipBlanks()
    if (!/[0-9]/.test(this.s[this.i] ?? '')) return undefined
    let n = 0
    while (/[0-9]/.test(this.s[this.i] ?? '')) { n = n * 10 + Number(this.s[this.i]); this.i++ }
    return n
  }

  private parseNumber(): number {
    let n = 0
    while (/[0-9]/.test(this.s[this.i] ?? '')) { n = n * 10 + Number(this.s[this.i]); this.i++ }
    return n
  }

  private skipSep() {
    for (;;) {
      const c = this.s[this.i]
      if (c === ' ' || c === '\t' || c === ';' || c === '\n') { this.i++; continue }
      break
    }
  }

  private skipBlanks() {
    while (this.s[this.i] === ' ' || this.s[this.i] === '\t') this.i++
  }

  private skipLine() {
    const nl = this.s.indexOf('\n', this.i)
    this.i = nl < 0 ? this.s.length : nl + 1
  }

  private failAt(message: string, pos: number): never {
    throw new SedParseError(message, this.expr, pos)
  }

  private fail(message: string): never { this.failAt(message, this.i) }
}

function unescapeY(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) { out += c; continue }
    const n = s[++i]
    if (n === 'n') out += '\n'
    else if (n === 't') out += '\t'
    else if (n === 'r') out += '\r'
    else if (n === 'a') out += '\x07'
    else if (n === 'f') out += '\f'
    else if (n === 'v') out += '\v'
    else if (n === '\\') out += '\\'
    else out += n
  }
  return out
}

// ---- compiler -----------------------------------------------------------------

interface RangeState { inRange: boolean; endLine?: number }

type Instr =
  | { k: 'node'; node: SedNode; state: RangeState }
  | { k: 'guard'; a: { a1?: SedAddr; a2?: SedAddr; not: boolean }; skipTo: number; state: RangeState }

interface Compiled { instrs: Instr[]; labels: Map<string, number> }

function freshState(): RangeState { return { inRange: false } }

function compile(nodes: SedNode[]): Compiled {
  const instrs: Instr[] = []
  const labels = new Map<string, number>()
  const walk = (list: SedNode[]) => {
    for (const n of list) {
      if (n.kind === 'block') {
        const guard: Instr = { k: 'guard', a: { a1: n.a1, a2: n.a2, not: n.not }, skipTo: 0, state: freshState() }
        instrs.push(guard)
        walk(n.children)
        guard.skipTo = instrs.length
      } else {
        if (n.kind === 'label') labels.set(n.name, instrs.length)
        instrs.push({ k: 'node', node: n, state: freshState() })
      }
    }
  }
  walk(nodes)
  return { instrs, labels }
}

function resolveBranches(compiled: Compiled) {
  for (const ins of compiled.instrs) {
    if (ins.k !== 'node') continue
    const n = ins.node
    if (n.kind !== 'branch' || n.label === undefined) continue
    const target = compiled.labels.get(n.label)
    if (target === undefined) throw new SedParseError(`can't find label for jump to \`${n.label}'`, n.expr, n.pos)
    n.target = target
  }
}

// ---- engine -------------------------------------------------------------------

interface Pending { raw: boolean; text: string }

function addrMatches(a: SedAddr, lineNo: number, psText: string, lastLine: boolean): boolean {
  switch (a.t) {
    case 'line': return a.n === 0 ? lineNo === 1 : lineNo === a.n
    case 'last': return lastLine
    case 're': a.re.lastIndex = 0; return a.re.test(psText)
    case 'step': return lineNo >= a.first && (lineNo - a.first) % a.step === 0
    default: return false
  }
}

function addrSelected(a: { a1?: SedAddr; a2?: SedAddr; not: boolean }, st: RangeState, lineNo: number, psText: string, lastLine: boolean): boolean {
  if (!a.a1) return !a.not
  if (!a.a2) {
    const m = addrMatches(a.a1, lineNo, psText, lastLine)
    return a.not ? !m : m
  }
  const a2 = a.a2
  const checkEnd = () => {
    if (a2.t === 're') {
      if (addrMatches(a2, lineNo, psText, lastLine)) st.inRange = false
    } else if (a2.t === 'last') {
      if (lastLine) st.inRange = false
    } else if (st.endLine !== undefined && lineNo >= st.endLine) {
      st.inRange = false
    }
  }
  let sel: boolean
  if (!st.inRange) {
    if (addrMatches(a.a1, lineNo, psText, lastLine)) {
      st.inRange = true
      sel = true
      if (a2.t === 'line') st.endLine = a2.n
      else if (a2.t === 'rel') st.endLine = lineNo + a2.n
      else if (a2.t === 'mod') st.endLine = Math.ceil(lineNo / a2.n) * a2.n
      if (a.a1.t === 'line' && a.a1.n === 0) checkEnd()
    } else {
      sel = false
    }
  } else {
    sel = true
    checkEnd()
  }
  return a.not ? !sel : sel
}

function applyReplacement(repl: string, m: RegExpExecArray): string {
  let out = ''
  let mode: 'none' | 'lower' | 'upper' = 'none'
  let one: 'lower' | 'upper' | null = null
  const push = (s: string) => {
    if (!s) return
    let first = s[0]
    let rest = s.slice(1)
    if (one === 'upper') first = first.toUpperCase()
    else if (one === 'lower') first = first.toLowerCase()
    one = null
    if (mode === 'lower') { first = first.toLowerCase(); rest = rest.toLowerCase() }
    else if (mode === 'upper') { first = first.toUpperCase(); rest = rest.toUpperCase() }
    out += first + rest
  }
  for (let i = 0; i < repl.length; i++) {
    const c = repl[i]
    if (c === '&') { push(m[0]); continue }
    if (c === '\\' && i + 1 < repl.length) {
      const n = repl[++i]
      if (n >= '1' && n <= '9') { push(m[Number(n)] ?? ''); continue }
      if (n === 'n') { push('\n'); continue }
      if (n === 't') { push('\t'); continue }
      if (n === 'r') { push('\r'); continue }
      if (n === 'a') { push('\x07'); continue }
      if (n === 'f') { push('\f'); continue }
      if (n === 'v') { push('\v'); continue }
      if (n === '\\') { push('\\'); continue }
      if (n === 'L') { mode = 'lower'; continue }
      if (n === 'U') { mode = 'upper'; continue }
      if (n === 'E') { mode = 'none'; continue }
      if (n === 'l') { one = 'lower'; continue }
      if (n === 'u') { one = 'upper'; continue }
      push(n)
      continue
    }
    push(c)
  }
  return out
}

function substitute(text: string, re: RegExp, repl: string, flags: SubFlags): { text: string; changed: boolean } {
  const occ = flags.occ === 0 ? 1 : flags.occ
  let out = ''
  let pos = 0
  let changed = false
  let count = 0
  for (;;) {
    re.lastIndex = pos
    const m = re.exec(text)
    if (!m) { out += text.slice(pos); break }
    count++
    const apply = count >= occ && (flags.global || count === occ)
    if (apply) {
      out += text.slice(pos, m.index)
      out += applyReplacement(repl, m)
      changed = true
      if (!flags.global) { out += text.slice(m.index + m[0].length); break }
      if (m[0].length === 0) {
        if (m.index >= text.length) break
        out += text[m.index]
        pos = m.index + 1
      } else {
        pos = m.index + m[0].length
        if (pos >= text.length) break
      }
    } else {
      if (m[0].length === 0) {
        if (m.index >= text.length) { out += text.slice(pos); break }
        out += text.slice(pos, m.index + 1)
        pos = m.index + 1
      } else {
        out += text.slice(pos, m.index + m[0].length)
        pos = m.index + m[0].length
        if (pos >= text.length) break
      }
    }
  }
  return { text: out, changed }
}

function escapeL(s: string): string {
  let out = ''
  for (const c of s) {
    const code = c.charCodeAt(0)
    if (c === '\\') out += '\\\\'
    else if (c === '\x07') out += '\\a'
    else if (c === '\b') out += '\\b'
    else if (c === '\f') out += '\\f'
    else if (c === '\n') out += '\\n'
    else if (c === '\r') out += '\\r'
    else if (c === '\t') out += '\\t'
    else if (c === '\v') out += '\\v'
    else if (code < 0x20 || code === 0x7f) out += '\\' + code.toString(8).padStart(3, '0')
    else out += c
  }
  return out
}

function transliterate(text: string, from: string, to: string): string {
  let out = ''
  for (const c of text) {
    const idx = from.indexOf(c)
    out += idx >= 0 ? to[idx] : c
  }
  return out
}

class Input {
  private pos = 0
  constructor(readonly data: string) {}
  readLine(): { text: string; nl: boolean } | null {
    if (this.pos >= this.data.length) return null
    const i = this.data.indexOf('\n', this.pos)
    if (i < 0) {
      const text = this.data.slice(this.pos)
      this.pos = this.data.length
      return { text, nl: false }
    }
    const text = this.data.slice(this.pos, i)
    this.pos = i + 1
    return { text, nl: true }
  }
  get exhausted(): boolean { return this.pos >= this.data.length }
}

interface RunResult { code: number; aborted: boolean }

const MAX_STEPS = 5_000_000

function runStream(stream: string, out: (s: string) => void, compiled: Compiled, quiet: boolean, signal: AbortSignal, files: { readFile: (p: string) => string | null; writeFile: (p: string, data: string, append: boolean) => boolean }): RunResult {
  const instrs = compiled.instrs
  const input = new Input(stream)
  let lineNo = 0
  const ps = { text: '', nl: true }
  const hold = { text: '', nl: true }
  let lastLine = false
  let substituted = false
  let pending: Pending[] = []
  let steps = 0

  // sed's output stream terminates the previous line when a new write starts
  // after a write that did not end in a newline (chomped last input line).
  let prevEndNL = true
  const print = (s: string) => {
    if (s === '') return
    if (!prevEndNL) { out('\n'); prevEndNL = true }
    out(s)
    prevEndNL = s.endsWith('\n')
  }
  const flushPending = () => {
    for (const p of pending) print(p.raw ? p.text : p.text + '\n')
    pending = []
  }
  const readFileCached = (path: string): string | null => files.readFile(path)

  for (;;) {
    const line = input.readLine()
    if (line === null) break
    lineNo++
    ps.text = line.text
    ps.nl = line.nl
    lastLine = input.exhausted
    substituted = false

    let pc = 0
    let control: 'run' | 'end' | 'delete' | 'quit' = 'run'
    let quitCode = 0

    while (control === 'run') {
      if (++steps > MAX_STEPS || signal.aborted) return { code: 130, aborted: true }
      if (pc >= instrs.length) { control = 'end'; break }
      const ins = instrs[pc]
      pc++
      if (ins.k === 'guard') {
        if (!addrSelected(ins.a, ins.state, lineNo, ps.text, lastLine)) pc = ins.skipTo
        continue
      }
      const cmd = ins.node
      if (cmd.kind === 'label') continue
      if (!addrSelected(cmd, ins.state, lineNo, ps.text, lastLine)) continue

      switch (cmd.kind) {
        case 'sub': {
          const res = substitute(ps.text, cmd.re, cmd.repl, cmd.flags)
          if (res.changed) {
            ps.text = res.text
            substituted = true
            if (cmd.flags.print) print(ps.text + (ps.nl ? '\n' : ''))
            if (cmd.flags.write !== undefined) files.writeFile(cmd.flags.write, ps.text + (ps.nl ? '\n' : ''), false)
          }
          break
        }
        case 'y': {
          ps.text = transliterate(ps.text, cmd.from, cmd.to)
          break
        }
        case 'simple': {
          switch (cmd.op) {
            case 'd': control = 'delete'; break
            case 'D': {
              const idx = ps.text.indexOf('\n')
              if (idx < 0) { control = 'delete'; break }
              ps.text = ps.text.slice(idx + 1)
              pc = 0
              break
            }
            case 'p': print(ps.text + (ps.nl ? '\n' : '')); break
            case 'P': {
              const idx = ps.text.indexOf('\n')
              print(idx < 0 ? ps.text + (ps.nl ? '\n' : '') : ps.text.slice(0, idx) + '\n')
              break
            }
            case 'n': {
              if (!quiet) print(ps.text + (ps.nl ? '\n' : ''))
              flushPending()
              const next = input.readLine()
              if (next === null) { control = 'quit'; break }
              lineNo++
              ps.text = next.text
              ps.nl = next.nl
              lastLine = input.exhausted
              substituted = false
              break
            }
            case 'N': {
              const next = input.readLine()
              if (next === null) { control = 'end'; break }
              flushPending()
              lineNo++
              ps.text = ps.text + '\n' + next.text
              ps.nl = next.nl
              lastLine = input.exhausted
              substituted = false
              break
            }
            case 'g': ps.text = hold.text; ps.nl = hold.nl; break
            case 'G': ps.text = ps.text + '\n' + hold.text; ps.nl = hold.nl; break
            case 'h': hold.text = ps.text; hold.nl = ps.nl; break
            case 'H': hold.text = hold.text + '\n' + ps.text; hold.nl = ps.nl; break
            case 'x': { const t = ps.text; const n = ps.nl; ps.text = hold.text; ps.nl = hold.nl; hold.text = t; hold.nl = n; break }
            case 'l': print(escapeL(ps.text) + '$\n'); break
            case '=': print(String(lineNo) + '\n'); break
            case 'q': {
              if (!quiet) print(ps.text + (ps.nl ? '\n' : ''))
              flushPending()
              control = 'quit'
              quitCode = cmd.code ?? 0
              break
            }
            case 'Q': control = 'quit'; quitCode = cmd.code ?? 0; break
          }
          break
        }
        case 'text': {
          if (cmd.text !== null) {
            if (cmd.op === 'a') pending.push({ raw: false, text: cmd.text })
            else if (cmd.op === 'i') print(cmd.text + '\n')
            else { print(cmd.text + '\n'); control = 'delete' }
          } else if (cmd.op === 'c') {
            control = 'delete'
          }
          break
        }
        case 'file': {
          if (cmd.op === 'r') {
            const data = readFileCached(cmd.file)
            if (data !== null) pending.push({ raw: true, text: data })
          } else {
            files.writeFile(cmd.file, ps.text + (ps.nl ? '\n' : ''), false)
          }
          break
        }
        case 'branch': {
          const take = cmd.op === 'b' || (cmd.op === 't' ? substituted : !substituted)
          if (take) {
            if (cmd.label === undefined) control = 'end'
            else pc = cmd.target ?? instrs.length
          }
          break
        }
      }
    }

    if (control === 'quit') return { code: quitCode, aborted: false }
    if (control === 'delete') { flushPending(); continue }
    // normal end of cycle
    if (!quiet) print(ps.text + (ps.nl ? '\n' : ''))
    flushPending()
  }
  return { code: 0, aborted: false }
}

// ---- command ------------------------------------------------------------------

const HELP = `Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...

  -n, --quiet, --silent   suppress automatic printing of pattern space
  -e script, --expression=script
                          add the script to the commands to be executed
  -f script-file, --file=script-file
                          add the contents of script-file to the commands
  -E, -r, --regexp-extended
                          use extended regular expressions in the script
  -i[SUFFIX], --in-place[=SUFFIX]
                          edit files in place (makes backup if SUFFIX supplied)
  -s, --separate          consider files as separate rather than one stream
  -z, --null-data         accepted for compatibility (newline mode is used)
      --help              display this help and exit

If no -e, --expression, -f, or --file option is given, then the first
non-option argument is taken as the sed script to interpret.  All
remaining arguments are names of input files; if no input files are
specified, then the standard input is read.
`

export const commands: Record<string, Cmd> = {
  sed: async (ctx: CmdCtx): Promise<number> => {
    let opts: SedOptions
    try {
      opts = parseArgs(ctx.args)
    } catch (e) {
      if (e instanceof SedUsageError) { ctx.err(`sed: ${e.message}`); return 1 }
      throw e
    }
    if (opts.help) { ctx.out(HELP); return 0 }

    let status = 0
    const nodes: SedNode[] = []
    for (const script of opts.scripts) {
      let text = script.text
      if (script.fromFile) {
        try {
          text = ctx.fs.readFile(ctx.resolve(script.text))
        } catch (e) {
          ctx.err(`sed: couldn't open file ${script.text}: ${fsReason(e)}`)
          return 4
        }
      }
      try {
        nodes.push(...new SedParser(text, opts.ere, script.expr).parse())
      } catch (e) {
        if (e instanceof SedParseError) { ctx.err(formatScriptError(e, script.expr)); return 1 }
        throw e
      }
    }
    let compiled: Compiled
    try {
      compiled = compile(nodes)
      resolveBranches(compiled)
    } catch (e) {
      if (e instanceof SedParseError) { ctx.err(formatScriptError(e, e.expr)); return 1 }
      throw e
    }

    const stdin = opts.files.length === 0 || opts.files.includes('-') ? await ctx.stdin.readAll() : ''
    let stdinUsed = false
    const getStdin = () => {
      if (stdinUsed) return ''
      stdinUsed = true
      return stdin
    }

    const written = new Set<string>()
    const fileIo = {
      readFile: (p: string): string | null => {
        try { return ctx.fs.readFile(ctx.resolve(p)) } catch { return null }
      },
      writeFile: (p: string, data: string, append: boolean): boolean => {
        try {
          ctx.fs.writeFile(ctx.resolve(p), data, append || written.has(p))
          written.add(p)
          return true
        } catch (e) {
          ctx.err(`sed: couldn't open file ${p}: ${fsReason(e)}`)
          status = 4
          return false
        }
      },
    }

    if (opts.inPlace) {
      for (const file of opts.files) {
        if (file === '-') {
          const stream = getStdin()
          const res = runStream(stream, (s) => ctx.out(s), compiled, opts.quiet, ctx.signal, fileIo)
          if (res.aborted) return 130
          if (res.code !== 0) return res.code
          continue
        }
        const abs = ctx.resolve(file)
        let original: string
        try { original = ctx.fs.readFile(abs) } catch (e) {
          ctx.err(`sed: can't read ${file}: ${fsReason(e)}`)
          status = 2
          continue
        }
        let out = ''
        const res = runStream(original, (s) => { out += s }, compiled, opts.quiet, ctx.signal, fileIo)
        if (res.aborted) return 130
        if (res.code !== 0) return res.code
        if (opts.backupSuffix) {
          try { ctx.fs.writeFile(abs + opts.backupSuffix, original) } catch (e) {
            ctx.err(`sed: couldn't open file ${file}${opts.backupSuffix}: ${fsReason(e)}`)
            status = 4
            continue
          }
        }
        try { ctx.fs.writeFile(abs, out) } catch (e) {
          ctx.err(`sed: couldn't open file ${file}: ${fsReason(e)}`)
          status = 4
        }
      }
      return status
    }

    // Build one stream for continuous mode (or run each source separately with -s).
    const sources: { data: string; file?: string }[] = []
    for (const file of opts.files) {
      if (file === '-') { sources.push({ data: getStdin() }); continue }
      try {
        sources.push({ data: ctx.fs.readFile(ctx.resolve(file)), file })
      } catch (e) {
        ctx.err(`sed: can't read ${file}: ${fsReason(e)}`)
        status = 2
      }
    }
    if (opts.files.length === 0) sources.push({ data: getStdin() })

    if (opts.separate) {
      for (const src of sources) {
        const res = runStream(src.data, (s) => ctx.out(s), compiled, opts.quiet, ctx.signal, fileIo)
        if (res.aborted) return 130
        if (res.code !== 0) return res.code
      }
    } else {
      const res = runStream(sources.map((s) => s.data).join(''), (s) => ctx.out(s), compiled, opts.quiet, ctx.signal, fileIo)
      if (res.aborted) return 130
      if (res.code !== 0) return res.code
    }
    return status
  },
}

function fsReason(e: unknown): string {
  if (e instanceof Error) {
    const r = (e as { reason?: string }).reason
    if (r) return r
    return e.message
  }
  return String(e)
}

function formatScriptError(e: SedParseError, expr: number): string {
  return `sed: -e expression #${expr}, char ${e.pos}: ${e.message}`
}

function parseArgs(args: string[]): SedOptions {
  const opts: SedOptions = { quiet: false, ere: false, separate: false, inPlace: false, help: false, scripts: [], files: [] }
  let scriptGiven = false
  let i = 0
  const needValue = (opt: string): string => {
    if (i + 1 >= args.length) throw new SedUsageError(`option requires an argument -- '${opt}'`)
    return args[++i]
  }
  for (; i < args.length; i++) {
    const a = args[i]
    if (a === '--') { opts.files.push(...args.slice(i + 1)); break }
    if (a === '-n' || a === '--quiet' || a === '--silent') { opts.quiet = true; continue }
    if (a === '-E' || a === '-r' || a === '--regexp-extended') { opts.ere = true; continue }
    if (a === '-s' || a === '--separate') { opts.separate = true; continue }
    if (a === '-z' || a === '--null-data') { continue }
    if (a === '--help') { opts.help = true; continue }
    if (a === '-i' || a === '--in-place') { opts.inPlace = true; opts.backupSuffix = ''; continue }
    if (a.startsWith('--in-place=')) { opts.inPlace = true; opts.backupSuffix = a.slice('--in-place='.length); continue }
    if (a.startsWith('-i') && a.length > 2) { opts.inPlace = true; opts.backupSuffix = a.slice(2); continue }
    if (a === '-e' || a === '--expression') {
      const v = needValue(a)
      opts.scripts.push({ text: v, expr: opts.scripts.length + 1 })
      scriptGiven = true
      continue
    }
    if (a.startsWith('--expression=')) {
      opts.scripts.push({ text: a.slice('--expression='.length), expr: opts.scripts.length + 1 })
      scriptGiven = true
      continue
    }
    if (a.startsWith('-e') && a.length > 2) {
      opts.scripts.push({ text: a.slice(2), expr: opts.scripts.length + 1 })
      scriptGiven = true
      continue
    }
    if (a === '-f' || a === '--file') {
      const v = needValue(a)
      opts.scripts.push({ text: v, expr: opts.scripts.length + 1, fromFile: true })
      scriptGiven = true
      continue
    }
    if (a.startsWith('--file=')) {
      opts.scripts.push({ text: a.slice('--file='.length), expr: opts.scripts.length + 1, fromFile: true })
      scriptGiven = true
      continue
    }
    if (a.startsWith('-f') && a.length > 2) {
      opts.scripts.push({ text: a.slice(2), expr: opts.scripts.length + 1, fromFile: true })
      scriptGiven = true
      continue
    }
    if (a.startsWith('-') && a !== '-') throw new SedUsageError(`invalid option -- '${a.slice(1)}'`)
    if (!scriptGiven) {
      opts.scripts.push({ text: a, expr: opts.scripts.length + 1 })
      scriptGiven = true
    } else {
      opts.files.push(a)
    }
  }
  if (opts.scripts.length === 0) opts.scripts.push({ text: '', expr: 1 })
  return opts
}

class SedUsageError extends Error {}

export const info: Record<string, CmdInfo> = {
  sed: { summary: 'stream editor for filtering and transforming text', usage: 'sed [OPTION]... {script} [file]...' },
}

const mod: CmdModule = { commands, info }
export default mod
