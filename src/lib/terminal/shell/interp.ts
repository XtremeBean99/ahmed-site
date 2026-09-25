// Tree-walking executor over the parser AST.
import { VFS, FsError } from '../vfs'
import { Stdin, TerminalIO, CmdCtx, Cmd } from '../types'
import { lex } from './lexer'
import { parse, type Cmd as AstCmd, type Redir, type CondExpr } from './parser'
import { expandWord, expandWordLiteral, expandAssignValue, expandHeredocBody, ExpandError, type ExpandCtx, type VarValue } from './expand'
import { evalArith, ArithError, type ArithEnv } from './arith'
import { BUILTINS, evalTestItems } from './builtins'
import { matchGlob } from '../glob'

export interface RunIO {
  stdin: Stdin
  out(s: string): void
  err(s: string): void
  ttyOut: boolean
}

export interface FuncDef { name: string; body: AstCmd }

const STEP_LIMIT = 50_000_000
/** Busy CPU time per run before we call it an infinite loop. Gaps over 100 ms (sleep, read, an editor) do not count. */
const BUSY_LIMIT_MS = 8000
const CAPTURE_MAX = 1_048_576
const FUNC_DEPTH_MAX = 200
const DEFAULT_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

class LimitError extends Error {}
class AbortError extends Error {}

export class Interp implements ExpandCtx {
  fs: VFS
  io: TerminalIO
  commands: Record<string, Cmd>
  home: string
  cwd: string
  lastStatus = 0
  history: string[] = []
  vars = new Map<string, VarValue>()
  private scopes: Map<string, VarValue>[] = []
  private positionalsStack: string[][] = [[]]
  functions = new Map<string, FuncDef>()
  aliases = new Map<string, string>()
  options = { errexit: false, nounset: false, xtrace: false, pipefail: false }
  signal: AbortSignal
  private controller = new AbortController()
  private steps = 0
  private lastYield = 0
  private lastTick = 0
  private busy = 0
  private startTime = Date.now()
  private procCount = 0
  private functionDepth = 0
  private sourceDepth = 0
  private returnStatus: number | null = null
  private pendingBreak = 0
  private pendingContinue = 0
  private condDepth = 0
  private errexitSuppress = 0
  private exitRequested: number | null = null
  private activeErr: (s: string) => void = () => {}
  private pendingProcsubs: { text: string; path: string }[] = []
  pid = String(1000 + Math.floor(Math.random() * 9000))
  argv0 = '-bash'
  arithEnv: ArithEnv = {
    get: (name) => this.getVar(name)?.value,
    set: (name, value) => { this.setVar(name, value) },
  }

  constructor(opts: { fs: VFS; io: TerminalIO; commands: Record<string, Cmd>; home?: string }) {
    this.fs = opts.fs
    this.io = opts.io
    this.commands = opts.commands
    this.home = opts.home ?? '/home/guest'
    this.cwd = this.home
    this.signal = this.controller.signal
    this.seedVars()
  }

  private seedVars(): void {
    const home = this.home
    const def = (name: string, value: string, exported = false): void => {
      this.vars.set(name, { value, exported, readonly: false, integer: false, lower: false, upper: false, array: null, assoc: null })
    }
    def('HOME', home, true)
    def('USER', 'guest', true)
    def('LOGNAME', 'guest', true)
    def('PATH', DEFAULT_PATH, true)
    def('PWD', home, true)
    def('OLDPWD', home, true)
    def('SHELL', '/bin/bash', true)
    def('HOSTNAME', 'ahmed', true)
    def('TERM', 'xterm-256color', true)
    def('LANG', 'en_US.UTF-8', true)
    def('UID', '1000')
    def('IFS', ' \t\n')
    def('PS1', '\\[\\e[1;32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ ')
    def('EDITOR', 'nano')
    def('SECONDS', '0')
    def('OPTIND', '1')
    def('BASH_REMATCH', '')
  }

  // ---- run API --------------------------------------------------------------------------------

  async run(source: string): Promise<{ incomplete: boolean; status: number }> {
    const lr = lex(source)
    if (lr.incomplete) return { incomplete: true, status: 0 }
    const pr = parse(lr.tokens)
    if (pr.incomplete) return { incomplete: true, status: 0 }
    if (!pr.cmd) {
      this.io.write((pr.error ?? 'bash: syntax error') + '\n')
      return { incomplete: false, status: 2 }
    }
    this.controller = new AbortController()
    this.signal = this.controller.signal
    this.steps = 0
    this.lastYield = this.lastTick = Date.now()
    this.busy = 0
    this.returnStatus = null
    this.exitRequested = null
    this.pendingBreak = 0
    this.pendingContinue = 0
    try {
      const stdin = new Stdin('', () => this.io.readLine())
      const io: RunIO = { stdin, out: (s) => this.io.write(s), err: (s) => this.io.write(s), ttyOut: true }
      const status = await this.execCmd(pr.cmd, io)
      return { incomplete: false, status: this.exitRequested ?? status }
    } catch (e) {
      if (e instanceof LimitError) {
        this.io.write('bash: execution limit exceeded (infinite loop?)\n')
        this.lastStatus = 1
        return { incomplete: false, status: 1 }
      }
      if (e instanceof AbortError) { this.lastStatus = 130; return { incomplete: false, status: 130 } }
      throw e
    }
  }

  abort(): void { this.controller.abort() }

  // ---- step budget / abort ---------------------------------------------------------------------

  private stepSync(): void {
    if (++this.steps > STEP_LIMIT) throw new LimitError('execution limit exceeded')
  }
  private async tick(): Promise<void> {
    this.stepSync()
    if ((this.steps & 63) === 0) {
      const now = Date.now()
      const d = now - this.lastTick
      if (d < 100) this.busy += d
      this.lastTick = now
      if (this.busy > BUSY_LIMIT_MS) throw new LimitError('execution limit exceeded')
    }
    // Yield by wall clock, not step count: browsers clamp setTimeout(0) to 4 ms, so frequent yields dominate runtime.
    if ((this.steps & 255) === 0 && Date.now() - this.lastYield > 30) {
      await new Promise((r) => setTimeout(r, 0))
      this.lastYield = Date.now()
    }
    if (this.signal.aborted) throw new AbortError('aborted')
  }
  private aborted(): boolean { return this.signal.aborted }

  // ---- variables ------------------------------------------------------------------------------

  getVar(name: string): VarValue | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const v = this.scopes[i].get(name)
      if (v) return v
    }
    return this.vars.get(name)
  }
  setVar(name: string, value: string): void {
    const existing = this.getVar(name)
    if (existing?.readonly) {
      this.activeErr(`bash: ${name}: readonly variable\n`)
      return
    }
    const v: VarValue = existing
      ? { ...existing, value, integer: existing.integer, array: existing.array, assoc: existing.assoc }
      : { value, exported: false, readonly: false, integer: false, lower: false, upper: false, array: null, assoc: null }
    this.putVar(name, v)
  }
  private putVar(name: string, v: VarValue): void {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) { this.scopes[i].set(name, v); return }
    }
    this.vars.set(name, v)
  }
  unsetVar(name: string): void {
    const existing = this.getVar(name)
    if (existing?.readonly) { this.activeErr(`bash: ${name}: readonly variable\n`); return }
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].delete(name)) return
    }
    this.vars.delete(name)
  }
  setVarFull(name: string, v: VarValue): void { this.putVar(name, v) }
  setLocal(name: string, v: VarValue): void {
    const top = this.scopes[this.scopes.length - 1]
    if (top) top.set(name, v)
    else this.vars.set(name, v)
  }
  exportVar(name: string): void {
    const v = this.getVar(name)
    if (v) v.exported = true
    else this.vars.set(name, { value: '', exported: true, readonly: false, integer: false, lower: false, upper: false, array: null, assoc: null })
  }
  pushScope(): void { this.scopes.push(new Map()) }
  popScope(): void { this.scopes.pop() }

  get positionals(): string[] { return this.positionalsStack[this.positionalsStack.length - 1] }
  set positionals(v: string[]) { this.positionalsStack[this.positionalsStack.length - 1] = v }
  pushPositionals(v: string[]): void { this.positionalsStack.push(v) }
  popPositionals(): void { if (this.positionalsStack.length > 1) this.positionalsStack.pop() }

  get nounset(): boolean { return this.options.nounset }

  getSpecial(name: string): string | undefined {
    switch (name) {
      case 'RANDOM': return String(Math.floor(Math.random() * 32768))
      case 'SECONDS': return String(Math.floor((Date.now() - this.startTime) / 1000))
      case 'PWD': return this.cwd
      case 'OLDPWD': return this.getVar('OLDPWD')?.value ?? this.cwd
      case 'HOME': return this.home
      case 'USER': return this.getVar('USER')?.value ?? 'guest'
      case 'HOSTNAME': return this.getVar('HOSTNAME')?.value ?? 'ahmed'
      case 'SHELL': return this.getVar('SHELL')?.value ?? '/bin/bash'
      case 'PATH': return this.getVar('PATH')?.value ?? DEFAULT_PATH
      case 'UID': return this.getVar('UID')?.value ?? '1000'
      case 'LINENO': return '1'
      case 'PS1': return this.getVar('PS1')?.value ?? ''
      case 'IFS': return this.getVar('IFS')?.value ?? ' \t\n'
      case 'BASH_REMATCH': return this.getVar('BASH_REMATCH')?.value ?? ''
    }
    return undefined
  }

  private buildEnv(): Record<string, string> {
    const size = (() => { try { return this.io.size() } catch { return { cols: 80, rows: 24 } } })()
    const env: Record<string, string> = {
      HOME: this.home,
      USER: this.getVar('USER')?.value ?? 'guest',
      LOGNAME: this.getVar('USER')?.value ?? 'guest',
      PATH: this.getVar('PATH')?.value ?? DEFAULT_PATH,
      PWD: this.cwd,
      SHELL: this.getVar('SHELL')?.value ?? '/bin/bash',
      HOSTNAME: this.getVar('HOSTNAME')?.value ?? 'ahmed',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      COLUMNS: String(size.cols),
      LINES: String(size.rows),
    }
    for (const [k, v] of this.vars) if (v.exported) env[k] = v.value
    return env
  }

  // ---- expansion context -----------------------------------------------------------------------

  async runCapture(text: string): Promise<string> {
    const prevStatus = this.lastStatus
    const prevErr = this.activeErr
    const snap = this.snapshot()
    const outBuf: string[] = []
    const errSink = this.activeErr
    try {
      const lr = lex(text)
      if (lr.incomplete) return ''
      const pr = parse(lr.tokens)
      if (pr.incomplete || !pr.cmd) {
        if (pr.error) errSink(pr.error + '\n')
        return ''
      }
      this.activeErr = errSink
      let total = 0
      const cap = (s: string) => {
        const room = CAPTURE_MAX - total
        if (room <= 0) return
        const piece = s.length > room ? s.slice(0, room) : s
        total += piece.length
        outBuf.push(piece)
      }
      const io: RunIO = { stdin: new Stdin(''), out: cap, err: errSink, ttyOut: false }
      await this.execCmd(pr.cmd, io)
      return this.trimCapture(outBuf.join(''))
    } finally {
      this.restore(snap)
      this.lastStatus = prevStatus
      this.activeErr = prevErr
    }
  }

  async makeProcsub(text: string, dir: '<' | '>'): Promise<string> {
    const path = `/tmp/.procsub-${this.pid}-${++this.procCount}`
    if (dir === '>') {
      this.fs.writeFile(path, '')
      this.pendingProcsubs.push({ text, path })
      return path
    }
    const outBuf: string[] = []
    await this.execCmdString(text, { stdin: new Stdin(''), out: (s) => outBuf.push(s), err: this.activeErr, ttyOut: false })
    this.fs.writeFile(path, outBuf.join('').slice(0, CAPTURE_MAX))
    return path
  }

  private trimCapture(s: string): string {
    let end = s.length
    while (end > 0 && s[end - 1] === '\n') end--
    const t = s.slice(0, end)
    return t.length > CAPTURE_MAX ? t.slice(0, CAPTURE_MAX) : t
  }

  private snapshot(): { vars: Map<string, VarValue>; pos: string[][]; cwd: string; posTop: string[] } {
    const vars = new Map<string, VarValue>()
    for (const [k, v] of this.vars) vars.set(k, { ...v, array: v.array ? v.array.slice() : null, assoc: v.assoc ? new Map(v.assoc) : null })
    const scopes = this.scopes.map((s) => {
      const m = new Map<string, VarValue>()
      for (const [k, v] of s) m.set(k, { ...v, array: v.array ? v.array.slice() : null, assoc: v.assoc ? new Map(v.assoc) : null })
      return m
    })
    const pos = this.positionalsStack.map((p) => p.slice())
    return { vars, pos, cwd: this.cwd, posTop: pos[pos.length - 1] ?? [] }
  }
  private restore(s: { vars: Map<string, VarValue>; pos: string[][]; cwd: string; posTop: string[] }): void {
    this.vars = s.vars
    this.scopes = []
    this.positionalsStack = s.pos
    this.cwd = s.cwd
  }

  // ---- execution ------------------------------------------------------------------------------

  async execCmd(cmd: AstCmd, io: RunIO): Promise<number> {
    const st = await this.execCmdImpl(cmd, io)
    this.lastStatus = st
    return st
  }

  private async execCmdImpl(cmd: AstCmd, io: RunIO): Promise<number> {
    this.stepSync()
    if (this.aborted()) return 130
    if (cmd.type !== 'simple' && cmd.type !== 'pipeline' && cmd.type !== 'list' && cmd.type !== 'andor') {
      const redirs = (cmd as Extract<AstCmd, { redirs?: Redir[] }>).redirs
      if (redirs && redirs.length) {
        const r = await this.applyRedirs(redirs, io)
        if (!r) return 1
        const stripped = { ...cmd, redirs: [] } as AstCmd
        const st = await this.execCmdImpl(stripped, r.io)
        this.finalizeRedirs(r.sinks)
        return st
      }
    }
    switch (cmd.type) {
      case 'list': return this.execList(cmd, io)
      case 'andor': return this.execAndOr(cmd, io)
      case 'pipeline': return this.execPipeline(cmd, io)
      case 'simple': return this.execSimple(cmd, io)
      case 'subshell': {
        const snap = this.snapshot()
        try { return await this.execCmd(cmd.body, io) } finally { this.restore(snap) }
      }
      case 'group': return this.execCmd(cmd.body, io)
      case 'if': return this.execIf(cmd, io)
      case 'for': return this.execFor(cmd, io)
      case 'while': return this.execWhile(cmd, io)
      case 'case': return this.execCase(cmd, io)
      case 'func': {
        this.functions.set(cmd.name, { name: cmd.name, body: cmd.body })
        return 0
      }
      case 'arith': {
        try {
          const v = evalArith(cmd.expr, this.arithEnv)
          return v === 0 ? 1 : 0
        } catch (e) {
          if (e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 }
          throw e
        }
      }
      case 'cond': {
        try { return (await this.evalCond(cmd.expr, io)) ? 0 : 1 }
        catch (e) {
          if (e instanceof ExpandError || e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 2 }
          throw e
        }
      }
      case 'time': {
        const t0 = performance.now()
        const status = await this.execCmd(cmd.cmd, io)
        const dt = (performance.now() - t0) / 1000
        io.err(`\nreal\t0m${dt.toFixed(3)}s\nuser\t0m0.000s\nsys\t0m0.000s\n`)
        return status
      }
    }
  }

  private async execList(cmd: Extract<AstCmd, { type: 'list' }>, io: RunIO): Promise<number> {
    let status = 0
    for (const item of cmd.items) {
      if (this.aborted()) return 130
      if (this.returnStatus !== null || this.pendingBreak > 0 || this.pendingContinue > 0 || this.exitRequested !== null) break
      status = await this.execCmd(item, io)
      if (this.options.errexit && status !== 0 && this.condDepth === 0 && this.errexitSuppress === 0) {
        this.exitRequested = status
        return status
      }
    }
    return status
  }

  private async execAndOr(cmd: Extract<AstCmd, { type: 'andor' }>, io: RunIO): Promise<number> {
    let status = 0
    let i = 0
    while (i < cmd.items.length) {
      const last = i === cmd.items.length - 1
      if (!last) this.errexitSuppress++
      try {
        status = await this.execCmd(cmd.items[i], io)
      } finally {
        if (!last) this.errexitSuppress--
      }
      if (i >= cmd.ops.length) break
      const op = cmd.ops[i]
      if (op === '&&' && status !== 0) {
        let j = i + 1
        while (j < cmd.ops.length && cmd.ops[j] === '&&') j++
        i = j + 1
        continue
      }
      if (op === '||' && status === 0) {
        let j = i + 1
        while (j < cmd.ops.length && cmd.ops[j] === '||') j++
        i = j + 1
        continue
      }
      i++
    }
    return status
  }

  private async execPipeline(cmd: Extract<AstCmd, { type: 'pipeline' }>, io: RunIO): Promise<number> {
    const stages = cmd.stages
    if (stages.length === 1) {
      const status = await this.execCmd(stages[0], io)
      this.setArrayVar('PIPESTATUS', [String(status)])
      if (cmd.neg) return status === 0 ? 1 : 0
      return status
    }
    const statuses: number[] = []
    let stdin = io.stdin
    for (let i = 0; i < stages.length; i++) {
      const last = i === stages.length - 1
      let captured = ''
      const cap = (s: string) => { captured += s }
      const stageIo: RunIO = {
        stdin,
        out: last ? io.out : cap,
        err: !last && cmd.stderrPipe[i] ? cap : io.err,
        ttyOut: last ? io.ttyOut : false,
      }
      const status = await this.execCmd(stages[i], stageIo)
      statuses.push(status)
      if (!last) stdin = new Stdin(captured)
    }
    this.setArrayVar('PIPESTATUS', statuses.map(String))
    const status = this.options.pipefail
      ? (() => { let s = 0; for (const st of statuses) if (st !== 0) s = st; return s })()
      : statuses[statuses.length - 1]
    return cmd.neg ? (status === 0 ? 1 : 0) : status
  }

  setArrayVar(name: string, values: string[]): void {
    const existing = this.getVar(name)
    const v: VarValue = existing
      ? { ...existing, array: values, assoc: null, value: values[0] ?? '' }
      : { value: values[0] ?? '', exported: false, readonly: false, integer: false, lower: false, upper: false, array: values, assoc: null }
    this.putVar(name, v)
  }

  private async execIf(cmd: Extract<AstCmd, { type: 'if' }>, io: RunIO): Promise<number> {
    this.condDepth++
    let status: number
    try { status = await this.execCmd(cmd.cond, io) } finally { this.condDepth-- }
    if (status === 0) return this.execCmd(cmd.then, io)
    for (const e of cmd.elifs) {
      this.condDepth++
      let s: number
      try { s = await this.execCmd(e.cond, io) } finally { this.condDepth-- }
      if (s === 0) return this.execCmd(e.then, io)
    }
    if (cmd.els) return this.execCmd(cmd.els, io)
    return 0
  }

  private async execWhile(cmd: Extract<AstCmd, { type: 'while' }>, io: RunIO): Promise<number> {
    let status = 0
    for (;;) {
      if (this.aborted()) return 130
      await this.tick()
      this.condDepth++
      let c: number
      try { c = await this.execCmd(cmd.cond, io) } finally { this.condDepth-- }
      const run = cmd.until ? c !== 0 : c === 0
      if (!run) break
      status = await this.execCmd(cmd.body, io)
      if (this.pendingBreak > 0) { this.pendingBreak--; break }
      if (this.pendingContinue > 0) { this.pendingContinue--; continue }
      if (this.returnStatus !== null || this.exitRequested !== null) break
    }
    return status
  }

  private async execFor(cmd: Extract<AstCmd, { type: 'for' }>, io: RunIO): Promise<number> {
    let status = 0
    if (cmd.arith) {
      const [init, cond, update] = cmd.arith
      try { if (init) evalArith(init, this.arithEnv) } catch (e) { if (e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 } throw e }
      for (;;) {
        if (this.aborted()) return 130
        await this.tick()
        let c = 1
        try { c = cond ? evalArith(cond, this.arithEnv) : 1 } catch (e) { if (e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 } throw e }
        if (c === 0) break
        status = await this.execCmd(cmd.body, io)
        if (this.pendingBreak > 0) { this.pendingBreak--; break }
        if (this.pendingContinue > 0) { this.pendingContinue--; /* fall through to update */ }
        if (this.returnStatus !== null || this.exitRequested !== null) break
        try { if (update) evalArith(update, this.arithEnv) } catch (e) { if (e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 } throw e }
      }
      return status
    }
    const words = cmd.words === null ? this.positionals.slice() : await this.expandSimpleWords(cmd.words, io)
    for (const w of words) {
      if (this.aborted()) return 130
      await this.tick()
      this.setVar(cmd.name, w)
      status = await this.execCmd(cmd.body, io)
      if (this.pendingBreak > 0) { this.pendingBreak--; break }
      if (this.pendingContinue > 0) { this.pendingContinue--; continue }
      if (this.returnStatus !== null || this.exitRequested !== null) break
    }
    return status
  }

  private async execCase(cmd: Extract<AstCmd, { type: 'case' }>, io: RunIO): Promise<number> {
    const subject = (await this.expandSimpleWords([cmd.word], io))[0] ?? ''
    let status = 0
    let fallthrough = false
    for (const arm of cmd.arms) {
      let matched = fallthrough
      if (!matched) {
        for (const pat of arm.pats) {
          const expanded = (await expandWordLiteral(pat, this))[0] ?? ''
          if (matchGlob(expanded, subject)) { matched = true; break }
        }
      }
      if (matched) {
        status = await this.execCmd(arm.body, io)
        if (arm.term === ';;') break
        if (arm.term === ';&') { fallthrough = true; continue }
        fallthrough = false // ;;& : keep testing next patterns
      } else {
        fallthrough = false
      }
    }
    return status
  }

  private async expandSimpleWords(words: string[], io: RunIO): Promise<string[]> {
    void io
    const out: string[] = []
    for (const w of words) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)(\+?)=\((.*)\)$/.exec(w)
      if (m) {
        const inner = lex(m[3])
        const parts: string[] = []
        if (!inner.incomplete) {
          for (const t of inner.tokens) if (t.kind === 'word') parts.push(t.text)
        } else {
          parts.push(m[3])
        }
        const vals: string[] = []
        for (const p of parts) vals.push(...await expandWord(p, this))
        out.push(`${m[1]}${m[2]}=(${vals.join(' ')})`)
        continue
      }
      out.push(...await expandWord(w, this))
    }
    return out
  }

  private async execSimple(cmd: Extract<AstCmd, { type: 'simple' }>, io: RunIO): Promise<number> {
    if (this.aborted()) return 130
    // process substitutions created by `>(...)` flush after the command
    const savedProcsubs = this.pendingProcsubs
    this.pendingProcsubs = []
    const prevErr = this.activeErr
    this.activeErr = io.err
    try {
      // expand words
      let argv: string[]
      try {
        argv = await this.expandSimpleWords(cmd.words, io)
      } catch (e) {
        if (e instanceof ExpandError || e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 }
        throw e
      }
      // apply redirections
      const r = await this.applyRedirs(cmd.redirs, io)
      if (r === null) return 1
      const fds = r.io
      this.activeErr = fds.err
      // no command word: assignments only
      if (argv.length === 0) {
        await this.applyAssigns(cmd.assigns, fds.err)
        this.finalizeRedirs(r.sinks)
        this.flushProcsubs(savedProcsubs, io)
        return 0
      }
      // alias expansion on the first word
      argv = await this.expandAlias(cmd, argv)
      if (this.options.xtrace) fds.err(`+ ${argv.join(' ')}\n`)
      if (this.aborted()) { this.finalizeRedirs(r.sinks); return 130 }
      const status = await this.runArgv(argv, cmd.assigns, fds)
      this.lastStatus = status
      this.finalizeRedirs(r.sinks)
      this.flushProcsubs(savedProcsubs, io)
      return status
    } finally {
      this.activeErr = prevErr
    }
  }

  private async applyAssigns(assigns: { name: string; value: string | null; append?: boolean; array?: string[] | null; index?: string }[], errSink: (s: string) => void): Promise<void> {
    for (const a of assigns) {
      if (a.index !== undefined) {
        try {
          await this.assignIndexed(a.name, a.index, a.value ?? '')
        } catch (e) {
          if (e instanceof ExpandError || e instanceof ArithError) { errSink(`bash: ${e.message}\n`); continue }
          throw e
        }
        continue
      }
      if (a.array) {
        const vals: (string | undefined)[] = []
        for (const p of a.array) {
          const expanded = await expandWord(p, this)
          vals.push(...expanded)
        }
        const existing = this.getVar(a.name)
        if (a.append && existing?.array) vals.unshift(...existing.array)
        const v: VarValue = existing
          ? { ...existing, array: vals, assoc: null, value: vals[0] ?? '' }
          : { value: vals[0] ?? '', exported: false, readonly: false, integer: false, lower: false, upper: false, array: vals, assoc: null }
        this.putVar(a.name, v)
        continue
      }
      if (a.value === null) continue
      let value: string
      try {
        value = await expandAssignValue(a.value, this)
      } catch (e) {
        if (e instanceof ExpandError || e instanceof ArithError) { errSink(`bash: ${e.message}\n`); continue }
        throw e
      }
      this.setVar(a.name, value)
    }
  }

  private async assignIndexed(name: string, index: string, rawValue: string): Promise<void> {
    const existing = this.getVar(name)
    const value = await expandAssignValue(rawValue, this)
    if (existing?.assoc) {
      existing.assoc.set(index, value)
      existing.value = value
      return
    }
    if (/^[0-9]+$/.test(index)) {
      const idx = Number(index)
      const arr = existing?.array ? existing.array.slice() : []
      while (arr.length <= idx) arr.push(undefined)
      arr[idx] = value
      const v: VarValue = existing
        ? { ...existing, array: arr, assoc: null, value: arr[0] ?? '' }
        : { value: arr[0] ?? '', exported: false, readonly: false, integer: false, lower: false, upper: false, array: arr, assoc: null }
      this.putVar(name, v)
      return
    }
    // non-numeric index on a non-assoc: create an assoc
    const assoc = existing?.assoc ? new Map(existing.assoc) : new Map<string, string>()
    assoc.set(index, value)
    const v: VarValue = existing
      ? { ...existing, assoc, value, array: null }
      : { value, exported: false, readonly: false, integer: false, lower: false, upper: false, array: null, assoc }
    this.putVar(name, v)
  }

  private async expandAlias(cmd: Extract<AstCmd, { type: 'simple' }>, argv: string[]): Promise<string[]> {
    const firstRaw = cmd.words[0]
    if (!firstRaw || /['"\\$`]/.test(firstRaw)) return argv
    const name = firstRaw
    let depth = 0
    let current = name
    while (depth < 10) {
      const val = this.aliases.get(current)
      if (!val) break
      depth++
      const lr = lex(val)
      if (lr.incomplete) break
      const pr = parse(lr.tokens)
      if (!pr.cmd || pr.error || pr.incomplete) break
      let words: string[] = []
      if (pr.cmd.type === 'list' && pr.cmd.items.length === 1 && pr.cmd.items[0].type === 'simple') {
        const s = pr.cmd.items[0]
        words = await this.expandSimpleWords(s.words, { stdin: new Stdin(''), out: () => {}, err: () => {}, ttyOut: false })
      } else {
        // complex alias body: run it as a separate list later; here just substitute a marker
        words = [val]
      }
      if (words.length === 0) break
      current = words[0]
      if (current === name) break
      argv = [...words, ...argv.slice(1)]
      if (!this.aliases.has(current)) break
    }
    return argv
  }

  private async runArgv(argv: string[], assigns: { name: string; value: string | null; append?: boolean; array?: string[] | null; index?: string }[], io: RunIO, opts?: { noFunc?: boolean }): Promise<number> {
    if (argv.length === 0) return 0
    const name = argv[0]
    // assignment prefixes: temp env for externals, temp vars for builtins/functions
    const savedVars = new Map<string, VarValue | undefined>()
    const isExternal = !((!opts?.noFunc && this.functions.has(name)) || BUILTINS[name] !== undefined || this.commands[name] !== undefined)
    for (const a of assigns) {
      if (a.index !== undefined) {
        savedVars.set(a.name, this.getVar(a.name))
        try {
          await this.assignIndexed(a.name, a.index, a.value ?? '')
        } catch (e) {
          if (e instanceof ExpandError || e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 }
          throw e
        }
        continue
      }
      if (a.value === null && !a.array) continue
      savedVars.set(a.name, this.getVar(a.name))
      if (a.array) {
        const vals: (string | undefined)[] = []
        for (const p of a.array) vals.push(...await expandWord(p, this))
        const existing = this.getVar(a.name)
        const v: VarValue = existing
          ? { ...existing, array: vals, assoc: null, value: vals[0] ?? '' }
          : { value: vals[0] ?? '', exported: false, readonly: false, integer: false, lower: false, upper: false, array: vals, assoc: null }
        this.putVar(a.name, v)
      } else if (a.value !== null) {
        try {
          const value = await expandAssignValue(a.value, this)
          const existing = this.getVar(a.name)
          if (isExternal) {
            this.putVar(a.name, { value, exported: true, readonly: false, integer: existing?.integer ?? false, lower: existing?.lower ?? false, upper: existing?.upper ?? false, array: existing?.array ?? null, assoc: existing?.assoc ?? null })
          } else {
            this.setVar(a.name, value)
          }
        } catch (e) {
          if (e instanceof ExpandError || e instanceof ArithError) { io.err(`bash: ${e.message}\n`); return 1 }
          throw e
        }
      }
    }
    try {
      const fn = opts?.noFunc ? undefined : this.functions.get(name)
      if (fn) {
        if (this.functionDepth >= FUNC_DEPTH_MAX) {
          io.err(`bash: ${name}: recursion limit exceeded\n`)
          return 1
        }
        this.functionDepth++
        this.pushScope()
        this.pushPositionals(argv.slice(1))
        const prevArgv0 = this.argv0
        this.argv0 = name
        const prevReturn = this.returnStatus
        this.returnStatus = null
        try {
          const st = await this.execCmd(fn.body, io)
          return this.returnStatus ?? st
        } finally {
          this.argv0 = prevArgv0
          this.returnStatus = prevReturn
          this.popPositionals()
          this.popScope()
          this.functionDepth--
        }
      }
      const builtin = BUILTINS[name]
      if (builtin) return await builtin(this, argv.slice(1), io)
      if (Object.prototype.hasOwnProperty.call(this.commands, name)) return await this.callExternal(name, argv, io)
      if (name.includes('/')) return await this.runPath(name, argv, io)
      io.err(`bash: ${name}: command not found\n`)
      return 127
    } finally {
      for (const [k, v] of savedVars) {
        if (v === undefined) {
          for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].delete(k)) break
          this.vars.delete(k)
        } else this.putVar(k, v)
      }
    }
  }

  async runArgvBypass(argv: string[], io: RunIO): Promise<number> {
    return this.runArgv(argv, [], io, { noFunc: true })
  }

  async runBuiltinOrCommand(argv: string[], io: RunIO): Promise<number> {
    if (argv.length === 0) return 0
    const name = argv[0]
    const b = BUILTINS[name]
    if (b) return b(this, argv.slice(1), io)
    if (Object.prototype.hasOwnProperty.call(this.commands, name)) return this.callExternal(name, argv, io)
    if (name.includes('/')) return this.runPath(name, argv, io)
    io.err(`bash: ${name}: command not found\n`)
    return 127
  }

  private async callExternal(name: string, argv: string[], io: RunIO): Promise<number> {
    const cmd = this.commands[name]
    const ctx = this.buildCtx(name, argv, io)
    return await cmd(ctx)
  }

  private buildCtx(name: string, argv: string[], io: RunIO): CmdCtx {
    return {
      argv0: name,
      args: argv.slice(1),
      stdin: io.stdin,
      out: (s) => io.out(s),
      err: (s) => io.err(s),
      fs: this.fs,
      cwd: this.cwd,
      env: this.buildEnv(),
      io: this.io,
      signal: this.signal,
      resolve: (p) => VFS.resolve(this.cwd, p, this.home),
      exec: (argv2, stdin) => this.execCtx(argv2, stdin, io),
      runScript: (text, args) => this.runCtxScript(text, args, io),
      isTTYOut: io.ttyOut,
      commandNames: () => this.commandNames(),
      history: this.history,
    }
  }

  private async execCtx(argv2: string[], stdin: string | undefined, parentIo: RunIO): Promise<{ status: number; out: string; err: string }> {
    let out = ''
    let err = ''
    const io: RunIO = {
      stdin: stdin !== undefined ? new Stdin(stdin) : new Stdin(''),
      out: (s) => { out += s },
      err: (s) => { err += s },
      ttyOut: false,
    }
    const prevErr = this.activeErr
    this.activeErr = io.err
    try {
      const status = await this.runArgv(argv2, [], io)
      return { status, out, err }
    } finally {
      this.activeErr = prevErr
    }
  }

  private async runCtxScript(text: string, args: string[] | undefined, parentIo: RunIO): Promise<number> {
    const lr = lex(text)
    if (lr.incomplete) return 0
    const pr = parse(lr.tokens)
    if (!pr.cmd || pr.incomplete) {
      if (pr.error) parentIo.err(pr.error + '\n')
      return pr.incomplete ? 0 : 2
    }
    const snap = this.snapshot()
    const prevArgv0 = this.argv0
    if (args) this.pushPositionals(args)
    try {
      return await this.execCmd(pr.cmd, parentIo)
    } finally {
      if (args) this.popPositionals()
      this.argv0 = prevArgv0
      this.restore(snap)
    }
  }

  private async runPath(name: string, argv: string[], io: RunIO): Promise<number> {
    const path = VFS.resolve(this.cwd, name, this.home)
    try {
      const n = this.fs.stat(path)
      if (n.t === 'd') { io.err(`bash: ${name}: Is a directory\n`); return 126 }
      if ((n.mode & 0o111) === 0) { io.err(`bash: ${name}: Permission denied\n`); return 126 }
      const text = this.fs.readFile(path)
      return await this.runScriptText(text, path, argv.slice(1), io)
    } catch (e) {
      if (e instanceof FsError && e.code === 'ENOENT') { io.err(`bash: ${name}: No such file or directory\n`); return 127 }
      if (e instanceof FsError) { io.err(`bash: ${name}: ${e.reason}\n`); return 126 }
      throw e
    }
  }

  async runScriptText(text: string, arg0: string, args: string[], io: RunIO): Promise<number> {
    const lr = lex(text)
    if (lr.incomplete) return 0
    const pr = parse(lr.tokens)
    if (!pr.cmd || pr.incomplete) {
      if (pr.error) io.err(pr.error + '\n')
      return pr.incomplete ? 0 : 2
    }
    const snap = this.snapshot()
    const prevArgv0 = this.argv0
    this.argv0 = arg0
    this.pushPositionals(args)
    this.sourceDepth++
    const prevReturn = this.returnStatus
    this.returnStatus = null
    try {
      const st = await this.execCmd(pr.cmd, io)
      return this.returnStatus ?? st
    } finally {
      this.returnStatus = prevReturn
      this.sourceDepth--
      this.popPositionals()
      this.argv0 = prevArgv0
      this.restore(snap)
    }
  }

  private async execCmdString(text: string, io: RunIO): Promise<number> {
    const lr = lex(text)
    if (lr.incomplete) return 0
    const pr = parse(lr.tokens)
    if (!pr.cmd || pr.incomplete) {
      if (pr.error) io.err(pr.error + '\n')
      return pr.incomplete ? 0 : 2
    }
    return this.execCmd(pr.cmd, io)
  }

  // ---- redirections ----------------------------------------------------------------------------

  private async applyRedirs(redirs: Redir[], io: RunIO): Promise<{ io: RunIO; sinks: { finish(): void }[] } | null> {
    let ttyOut = io.ttyOut
    const sinks: { finish(): void }[] = []
    const fds: { in: Stdin; out: (s: string) => void; err: (s: string) => void } = {
      in: io.stdin,
      out: (s) => io.out(s),
      err: (s) => io.err(s),
    }
    const fileSink = (target: string, append: boolean, targetFd: number) => {
      let buf = ''
      const sink = {
        write: (s: string) => { buf += s },
        finish: () => {
          const path = VFS.resolve(this.cwd, target, this.home)
          try {
            if (path !== '/dev/null') this.fs.writeFile(path, buf, append)
          } catch (e) {
            if (e instanceof FsError) fds.err(`bash: ${target}: ${e.reason}\n`)
            else throw e
          }
        },
      }
      sinks.push(sink)
      const w = (s: string) => sink.write(s)
      if (targetFd === 1) fds.out = w
      if (targetFd === 2) fds.err = w
      return w
    }
    const errOpen = (target: string, reason: string): boolean => {
      fds.err(`bash: ${target}: ${reason}\n`)
      return false
    }
    for (const r of redirs) {
      if (r.op === '<<' || r.op === '<<-') {
        const heredoc = r.heredoc
        if (!heredoc) continue
        try {
          const body = heredoc.quoted ? heredoc.body : await expandHeredocBody(heredoc.body, this)
          fds.in = new Stdin(body)
        } catch (e) {
          if (e instanceof ExpandError || e instanceof ArithError) { fds.err(`bash: ${e.message}\n`); continue }
          throw e
        }
        continue
      }
      const target = r.target ?? ''
      const targetFd = r.fd
      switch (r.op) {
        case '>': case '>|': {
          const path = VFS.resolve(this.cwd, target, this.home)
          if (this.fs.isDir(path)) { if (!errOpen(target, 'Is a directory')) return null; continue }
          fileSink(target, false, targetFd)
          if (targetFd === 1) ttyOut = false
          continue
        }
        case '>>': {
          fileSink(target, true, targetFd)
          if (targetFd === 1) ttyOut = false
          continue
        }
        case '&>': case '&>>': {
          const append = r.op === '&>>'
          const path = VFS.resolve(this.cwd, target, this.home)
          if (this.fs.isDir(path)) { if (!errOpen(target, 'Is a directory')) return null; continue }
          let buf = ''
          const sink = {
            write: (s: string) => { buf += s },
            finish: () => {
              try {
                if (path !== '/dev/null') this.fs.writeFile(path, buf, append)
              } catch (e) {
                if (e instanceof FsError) fds.err(`bash: ${target}: ${e.reason}\n`)
                else throw e
              }
            },
          }
          sinks.push(sink)
          const w = (s: string) => sink.write(s)
          fds.out = w
          fds.err = w
          ttyOut = false
          continue
        }
        case '<': {
          try {
            const path = VFS.resolve(this.cwd, target, this.home)
            fds.in = new Stdin(this.fs.readFile(path))
          } catch (e) {
            if (e instanceof FsError) { if (!errOpen(target, e.reason)) return null; continue }
            throw e
          }
          continue
        }
        case '<<<': {
          let text: string
          try { text = (await expandWord(target, this)).join(' ') } catch (e) {
            if (e instanceof ExpandError || e instanceof ArithError) { fds.err(`bash: ${e.message}\n`); continue }
            throw e
          }
          fds.in = new Stdin(text + '\n')
          continue
        }
        case '>&': case '<&': {
          const dupFd = target === '-' ? -1 : /^\d+$/.test(target) ? Number(target) : 1
          if (r.op === '>&') {
            if (dupFd === -1) fds.out = () => {}
            else if (dupFd === 2) fds.out = fds.err
            else if (dupFd === 1) { /* keep current fds.out */ }
            else { fds.err(`bash: ${target}: ambiguous redirect\n`); continue }
            if (targetFd === 2) fds.err = fds.out
            if (targetFd === 1) ttyOut = false
          } else {
            if (dupFd === -1) fds.in = new Stdin('')
            else if (dupFd === 0) { /* keep current fds.in */ }
            else fds.in = new Stdin('')
          }
          continue
        }
        case '<>': {
          try {
            const path = VFS.resolve(this.cwd, target, this.home)
            fds.in = new Stdin(this.fs.readFile(path))
          } catch (e) {
            if (e instanceof FsError) { if (!errOpen(target, e.reason)) return null; continue }
            throw e
          }
          continue
        }
      }
    }
    return { io: { stdin: fds.in, out: (s) => fds.out(s), err: (s) => fds.err(s), ttyOut }, sinks }
  }

  private finalizeRedirs(sinks: { finish(): void }[]): void {
    for (const s of sinks) s.finish()
  }

  private async flushProcsubs(pending: { text: string; path: string }[], io: RunIO): Promise<void> {
    for (const p of pending) {
      try {
        const data = this.fs.readFile(p.path)
        await this.execCmdString(p.text, { stdin: new Stdin(data), out: io.out, err: io.err, ttyOut: false })
      } catch { /* file may be gone */ }
      try { this.fs.remove(p.path) } catch { /* ignore */ }
    }
  }

  // ---- [[ ]] -----------------------------------------------------------------------------------

  private async evalCond(expr: CondExpr, io: RunIO): Promise<boolean> {
    switch (expr.type) {
      case 'not': return !(await this.evalCond(expr.e, io))
      case 'and': return (await this.evalCond(expr.a, io)) && (await this.evalCond(expr.b, io))
      case 'or': return (await this.evalCond(expr.a, io)) || (await this.evalCond(expr.b, io))
      case 'group': return this.evalCond(expr.e, io)
      case 'test': {
        const items: { text: string; quoted: boolean }[] = []
        for (const raw of expr.args) {
          const vals = await expandWordLiteral(raw, this)
          const quoted = /['"\\]/.test(raw)
          for (const v of vals) items.push({ text: v, quoted })
        }
        return evalTestItems(items, this)
      }
    }
  }

  // ---- completion / names ----------------------------------------------------------------------

  commandNames(): string[] {
    const s = new Set<string>([...Object.keys(BUILTINS), ...this.commandsNames(), ...this.functions.keys(), ...this.aliases.keys()])
    return [...s].sort()
  }
  private commandsNames(): string[] { return Object.keys(this.commands) }

  complete(line: string): { start: number; candidates: string[] } {
    const m = /(.*?)([^\s]*)$/.exec(line)
    const before = m?.[1] ?? ''
    const token = m?.[2] ?? ''
    const start = before.length
    if (before.trim() === '') {
      const names = this.commandNames()
      return { start, candidates: names.filter((n) => n.startsWith(token)).sort() }
    }
    if (token.startsWith('$')) {
      const want = token.startsWith('${') ? token.slice(2) : token.slice(1)
      const names = [...this.vars.keys()].sort()
      const cands = token.startsWith('${')
        ? names.filter((n) => n.startsWith(want)).map((n) => n + '}')
        : names.filter((n) => n.startsWith(want)).map((n) => '$' + n)
      return { start, candidates: cands }
    }
    // file/dir completion
    const tilde = token.startsWith('~/')
    const lookup = tilde ? this.home + token.slice(1) : token
    const slash = lookup.lastIndexOf('/')
    const dirPart = slash < 0 ? this.cwd : slash === 0 ? '/' : VFS.resolve(this.cwd, lookup.slice(0, slash), this.home)
    const base = slash < 0 ? lookup : lookup.slice(slash + 1)
    const shownPrefix = tilde ? '~' + (slash < 0 ? '' : token.slice(1, token.lastIndexOf('/') + 1)) : (slash < 0 ? '' : token.slice(0, slash + 1))
    let names: string[]
    try { names = this.fs.list(dirPart) } catch { names = [] }
    const cands: string[] = []
    for (const n of names) {
      if (n.startsWith('.') && !base.startsWith('.')) continue
      if (!n.startsWith(base)) continue
      const full = dirPart === '/' ? '/' + n : dirPart + '/' + n
      cands.push(shownPrefix + n + (this.fs.isDir(full) ? '/' : ''))
    }
    return { start, candidates: cands.sort() }
  }

  // ---- helpers for builtins --------------------------------------------------------------------

  runBuiltin(name: string, args: string[], io: RunIO): Promise<number> | number {
    const b = BUILTINS[name]
    if (!b) return 127
    return b(this, args, io)
  }
  sourceDepthNow(): number { return this.sourceDepth }
  get sourceNest(): number { return this.sourceDepth + this.functionDepth }
  setReturn(status: number): void { this.returnStatus = status }
  clearReturn(): void { this.returnStatus = null }
  get returnPending(): number | null { return this.returnStatus }
  setBreak(n: number): void { this.pendingBreak = n }
  setContinue(n: number): void { this.pendingContinue = n }
  requestExit(status: number): void { this.exitRequested = status }
  get exitPending(): number | null { return this.exitRequested }
  setCwd(p: string): void {
    this.cwd = p
    const v = this.getVar('PWD')
    if (v) v.value = p
    else this.vars.set('PWD', { value: p, exported: true, readonly: false, integer: false, lower: false, upper: false, array: null, assoc: null })
  }
  setOldPwd(p: string): void {
    const v = this.getVar('OLDPWD')
    if (v) v.value = p
    else this.vars.set('OLDPWD', { value: p, exported: true, readonly: false, integer: false, lower: false, upper: false, array: null, assoc: null })
  }
}

export { LimitError, AbortError }
