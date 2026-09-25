// awk: a mini-awk (POSIX awk plus common gawk bits) for the terminal VFS.
// Pipeline: lexer -> recursive-descent parser -> async tree-walking interpreter.
import type { Cmd, CmdCtx, CmdInfo, CmdModule } from '../types'
import { compilePosix } from '../regex'
import { formatPrintf, unescape } from '../printf'

type AVal = string | number
type AArr = Map<string, AVal>

// ---- errors -------------------------------------------------------------------

class AwkSyntaxError extends Error {
  constructor(public line: number, public near: string) { super(`syntax error at source line ${line}`) }
}

class AwkFatal extends Error {
  constructor(message: string, public status = 2) { super(message) }
}

class AwkAbort extends Error {}

// ---- lexer --------------------------------------------------------------------

interface Tok { t: string; v?: string | number; line: number }

const KEYWORDS = new Set([
  'BEGIN', 'END', 'if', 'else', 'while', 'do', 'for', 'in', 'break', 'continue',
  'next', 'nextfile', 'exit', 'delete', 'getline', 'return', 'function', 'print', 'printf',
])

function isIdentStart(c: string): boolean { return /[A-Za-z_]/.test(c) }
function isIdentChar(c: string): boolean { return /[A-Za-z0-9_]/.test(c) }

function lex(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  let line = 1
  let prevEnds = false
  const push = (t: Tok) => {
    toks.push(t)
    prevEnds = t.t === 'num' || t.t === 'str' || t.t === 're' || t.t === 'id' || t.t === 'kw' ||
      (t.t === 'op' && (t.v === ')' || t.v === ']' || t.v === '++' || t.v === '--'))
  }
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue }
    if (c === '\n') { push({ t: 'nl', line }); i++; line++; prevEnds = false; continue }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?/.exec(src.slice(i))
      if (m) { push({ t: 'num', v: parseFloat(m[0]), line }); i += m[0].length; continue }
    }
    if (c === '"') {
      i++
      let s = ''
      while (i < src.length && src[i] !== '"') {
        const ch = src[i]
        if (ch === '\\' && i + 1 < src.length) {
          const n = src[++i]
          if (n === 'n') s += '\n'
          else if (n === 't') s += '\t'
          else if (n === 'r') s += '\r'
          else if (n === 'b') s += '\b'
          else if (n === 'f') s += '\f'
          else if (n === 'v') s += '\v'
          else if (n === 'a') s += '\x07'
          else if (n === '\\') s += '\\'
          else if (n === '"') s += '"'
          else if (n === '/') s += '/'
          else if (n === 'x') {
            const h = /^[0-9a-fA-F]{1,2}/.exec(src.slice(i + 1))
            if (h) { s += String.fromCharCode(parseInt(h[0], 16)); i += h[0].length }
            else s += 'x'
          } else if (/[0-7]/.test(n)) {
            const o = /^[0-7]{1,3}/.exec(src.slice(i))
            if (o) { s += String.fromCharCode(parseInt(o[0], 8)); i += o[0].length - 1 }
            else s += n
          } else s += n
        } else {
          s += ch
          if (ch === '\n') line++
        }
        i++
      }
      if (i >= src.length) throw new AwkSyntaxError(line, 'unterminated string')
      i++
      push({ t: 'str', v: s, line })
      continue
    }
    if (c === '/' && !prevEnds) {
      i++
      let p = ''
      while (i < src.length && src[i] !== '/') {
        if (src[i] === '\\' && i + 1 < src.length) {
          p += src[i] + src[i + 1]
          i += 2
          continue
        }
        if (src[i] === '\n') throw new AwkSyntaxError(line, 'unterminated regexp')
        p += src[i]
        i++
      }
      if (i >= src.length) throw new AwkSyntaxError(line, 'unterminated regexp')
      i++
      push({ t: 're', v: p, line })
      continue
    }
    if (isIdentStart(c)) {
      let id = ''
      while (i < src.length && isIdentChar(src[i])) { id += src[i]; i++ }
      push({ t: KEYWORDS.has(id) ? 'kw' : 'id', v: id, line })
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '**' || two === '**=' || two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||' || two === '++' || two === '--' || two === '+=' || two === '-=' || two === '*=' || two === '/=' || two === '%=' || two === '^=' || two === '!~' || two === '>>') {
      push({ t: 'op', v: two, line }); i += 2; continue
    }
    if ('+-*/%^!<>=?:,;|(){}[]$~'.includes(c)) {
      push({ t: 'op', v: c, line }); i++; continue
    }
    throw new AwkSyntaxError(line, `unexpected character '${c}'`)
  }
  push({ t: 'eof', line })
  return toks
}

// ---- AST ----------------------------------------------------------------------

type Expr =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 're'; src: string; re: RegExp }
  | { t: 'var'; name: string }
  | { t: 'field'; e: Expr }
  | { t: 'field0' }
  | { t: 'idxlist'; list: Expr[] }
  | { t: 'bin'; op: string; l: Expr; r: Expr }
  | { t: 'un'; op: string; e: Expr }
  | { t: 'tern'; c: Expr; a: Expr; b: Expr }
  | { t: 'assign'; op: string; target: Expr; e: Expr }
  | { t: 'inc'; op: string; target: Expr; pre: boolean }
  | { t: 'call'; name: string; args: Expr[] }
  | { t: 'arr'; name: string; idx: Expr[] }
  | { t: 'in'; idx: Expr[]; name: string }

type Redir = { op: '>' | '>>' | '|'; target: Expr }

type Stmt =
  | { t: 'expr'; e: Expr }
  | { t: 'print'; args: Expr[]; redir?: Redir }
  | { t: 'printf'; fmt: Expr; args: Expr[]; redir?: Redir }
  | { t: 'if'; c: Expr; then: Stmt; els?: Stmt }
  | { t: 'while'; c: Expr; body: Stmt }
  | { t: 'do'; body: Stmt; c: Expr }
  | { t: 'for'; init?: Expr; cond?: Expr; step?: Expr; body: Stmt }
  | { t: 'forIn'; name: string; arr: Expr; body: Stmt }
  | { t: 'block'; list: Stmt[] }
  | { t: 'break' } | { t: 'continue' } | { t: 'next' } | { t: 'nextfile' }
  | { t: 'exit'; e?: Expr }
  | { t: 'delete'; name: string; idx?: Expr[] }
  | { t: 'getline'; kind: 'plain' | 'var' | 'file' | 'cmd'; target?: Expr; src?: Expr }
  | { t: 'return'; e?: Expr }

interface FuncDef { params: string[]; body: Stmt }

interface Rule { pattern: Pattern; action: Stmt }

type Pattern =
  | { t: 'always' }
  | { t: 'begin' }
  | { t: 'end' }
  | { t: 'expr'; e: Expr }
  | { t: 'range'; a: Expr; b: Expr; state: { inRange: boolean } }

// ---- parser -------------------------------------------------------------------

const BUILTINS = new Set([
  'length', 'substr', 'index', 'split', 'sub', 'gsub', 'match', 'sprintf',
  'tolower', 'toupper', 'int', 'sqrt', 'sin', 'cos', 'atan2', 'exp', 'log',
  'rand', 'srand', 'systime', 'strftime', 'system', 'close', 'fflush', 'gensub',
])

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '^=', '**='])

class Parser {
  private p = 0
  private noCmp = false
  constructor(private toks: Tok[]) {}

  private peek(off = 0): Tok { return this.toks[Math.min(this.p + off, this.toks.length - 1)] }
  private next(): Tok { return this.toks[this.p++] }
  private is(t: string, v?: string): boolean { const k = this.peek(); return k.t === t && (v === undefined || k.v === v) }
  private eat(t: string, v?: string): boolean { if (this.is(t, v)) { this.p++; return true } return false }
  private skipNL() {
    for (;;) {
      if (this.is('nl')) { this.p++; continue }
      if (this.is('op', ';')) { this.p++; continue }
      break
    }
  }
  private expectOp(v: string): void { if (this.is('op', v)) { this.p++; return } throw this.syntax(`expected '${v}'`) }
  private syntax(msg: string): AwkSyntaxError { return new AwkSyntaxError(this.peek().line, msg) }

  parseProgram(): { rules: Rule[]; funcs: Map<string, FuncDef> } {
    const rules: Rule[] = []
    const funcs = new Map<string, FuncDef>()
    for (;;) {
      this.skipNL()
      if (this.is('eof')) break
      if (this.is('kw', 'function')) {
        this.next()
        const nameTok = this.next()
        if (nameTok.t !== 'id') throw this.syntax('expected function name')
        this.expectOp('(')
        const params: string[] = []
        if (!this.is('op', ')')) {
          for (;;) {
            const p = this.next()
            if (p.t !== 'id') throw this.syntax('expected parameter name')
            params.push(p.v as string)
            if (!this.eat('op', ',')) break
          }
        }
        this.expectOp(')')
        this.skipNL()
        const body = this.parseStmt()
        funcs.set(nameTok.v as string, { params, body })
        continue
      }
      let pattern: Pattern = { t: 'always' }
      if (this.is('kw', 'BEGIN')) { this.next(); pattern = { t: 'begin' } }
      else if (this.is('kw', 'END')) { this.next(); pattern = { t: 'end' } }
      else if (!this.is('op', '{')) {
        const e = this.parseExpr()
        if (this.is('op', ',')) {
          this.next()
          const b = this.parseExpr()
          pattern = { t: 'range', a: e, b, state: { inRange: false } }
        } else {
          pattern = { t: 'expr', e }
        }
      }
      this.skipNL()
      let action: Stmt
      if (this.is('op', '{')) action = this.parseStmt()
      else action = { t: 'print', args: [] }
      rules.push({ pattern, action })
    }
    return { rules, funcs }
  }

  parseStmt(): Stmt {
    this.skipNL()
    const k = this.peek()
    if (k.t === 'op' && k.v === '{') {
      this.next()
      const list: Stmt[] = []
      for (;;) {
        this.skipNL()
        if (this.is('op', '}')) { this.next(); break }
        if (this.is('eof')) throw this.syntax('unexpected end of program')
        list.push(this.parseStmt())
      }
      return { t: 'block', list }
    }
    if (k.t === 'kw') {
      switch (k.v) {
        case 'if': {
          this.next(); this.expectOp('(')
          const c = this.parseExpr()
          this.expectOp(')')
          const then = this.parseStmt()
          this.skipNL()
          let els: Stmt | undefined
          if (this.is('kw', 'else')) { this.next(); els = this.parseStmt() }
          return { t: 'if', c, then, els }
        }
        case 'while': {
          this.next(); this.expectOp('(')
          const c = this.parseExpr()
          this.expectOp(')')
          return { t: 'while', c, body: this.parseStmt() }
        }
        case 'do': {
          this.next()
          const body = this.parseStmt()
          this.skipNL()
          if (!this.is('kw', 'while')) throw this.syntax("expected 'while'")
          this.next(); this.expectOp('(')
          const c = this.parseExpr()
          this.expectOp(')')
          return { t: 'do', body, c }
        }
        case 'for': {
          this.next(); this.expectOp('(')
          this.skipNL()
          if (this.is('id') && this.peek(1).t === 'kw' && this.peek(1).v === 'in') {
            const name = this.next().v as string
            this.next()
            const arr = this.parseExpr()
            this.expectOp(')')
            return { t: 'forIn', name, arr, body: this.parseStmt() }
          }
          let init: Expr | undefined
          if (!this.is('op', ';')) init = this.parseExpr()
          this.expectOp(';')
          let cond: Expr | undefined
          if (!this.is('op', ';')) cond = this.parseExpr()
          this.expectOp(';')
          let step: Expr | undefined
          if (!this.is('op', ')')) step = this.parseExpr()
          this.expectOp(')')
          return { t: 'for', init, cond, step, body: this.parseStmt() }
        }
        case 'break': this.next(); return { t: 'break' }
        case 'continue': this.next(); return { t: 'continue' }
        case 'next': this.next(); return { t: 'next' }
        case 'nextfile': this.next(); return { t: 'nextfile' }
        case 'exit': {
          this.next()
          let e: Expr | undefined
          if (!this.is('nl') && !this.is('op',';') && !this.is('op', '}') && !this.is('eof')) e = this.parseExpr()
          return { t: 'exit', e }
        }
        case 'delete': {
          this.next()
          const nameTok = this.next()
          if (nameTok.t !== 'id') throw this.syntax('expected array name')
          let idx: Expr[] | undefined
          if (this.is('op', '[')) {
            this.next()
            idx = this.parseIdxList()
            this.expectOp(']')
          }
          return { t: 'delete', name: nameTok.v as string, idx }
        }
        case 'getline': {
          this.next()
          let target: Expr | undefined
          if (this.is('id')) target = { t: 'var', name: this.next().v as string }
          if (this.is('op', '<')) { this.next(); return { t: 'getline', kind: 'file', src: this.parseExpr(), target } }
          return target ? { t: 'getline', kind: 'var', target } : { t: 'getline', kind: 'plain' }
        }
        case 'return': {
          this.next()
          let e: Expr | undefined
          if (!this.is('nl') && !this.is('op',';') && !this.is('op', '}') && !this.is('eof')) e = this.parseExpr()
          return { t: 'return', e }
        }
        case 'print': {
          this.next()
          let args: Expr[] = []
          if (!this.is('nl') && !this.is('op',';') && !this.is('op', '}') && !this.is('eof') && !this.is('op', '>') && !this.is('op', '>>') && !this.is('op', '|')) {
            args = this.parsePrintExprList()
          }
          return { t: 'print', args, redir: this.parseRedir() }
        }
        case 'printf': {
          this.next()
          const fmt = this.parseExpr()
          let args: Expr[] = []
          if (this.is('op', ',')) { this.next(); args = this.parsePrintExprList() }
          return { t: 'printf', fmt, args, redir: this.parseRedir() }
        }
      }
    }
    const e = this.parseExpr()
    if (this.is('op', '|') && this.peek(1).t === 'kw' && this.peek(1).v === 'getline') {
      this.next(); this.next()
      let target: Expr | undefined
      if (this.is('id')) target = { t: 'var', name: this.next().v as string }
      return { t: 'getline', kind: 'cmd', src: e, target }
    }
    this.eat('op', ';')
    return { t: 'expr', e }
  }

  private parseRedir(): Redir | undefined {
    if (this.is('op', '>')) { this.next(); return { op: '>', target: this.parseExpr() } }
    if (this.is('op', '>>')) { this.next(); return { op: '>>', target: this.parseExpr() } }
    if (this.is('op', '|')) { this.next(); return { op: '|', target: this.parseExpr() } }
    return undefined
  }

  private parseExprList(): Expr[] {
    const out: Expr[] = [this.parseExpr()]
    while (this.is('op', ',')) { this.next(); out.push(this.parseExpr()) }
    return out
  }

  private parsePrintExprList(): Expr[] {
    this.noCmp = true
    try {
      return this.parseExprList()
    } finally {
      this.noCmp = false
    }
  }

  private parseIdxList(): Expr[] {
    const out: Expr[] = [this.parseExpr()]
    while (this.is('op', ',')) { this.next(); out.push(this.parseExpr()) }
    return out
  }

  private parseExpr(): Expr { return this.parseAssign() }

  private parseAssign(): Expr {
    const left = this.parseTernary()
    if (this.is('op') && ASSIGN_OPS.has(this.peek().v as string)) {
      const op = this.next().v as string
      const right = this.parseAssign()
      if (!isLValue(left)) throw this.syntax('invalid assignment target')
      return { t: 'assign', op, target: left, e: right }
    }
    return left
  }

  private parseTernary(): Expr {
    const c = this.parseOr()
    if (this.is('op', '?')) {
      this.next()
      const a = this.parseExpr()
      this.expectOp(':')
      const b = this.parseExpr()
      return { t: 'tern', c, a, b }
    }
    return c
  }

  private parseOr(): Expr {
    let l = this.parseAnd()
    while (this.is('op', '||')) { this.next(); l = { t: 'bin', op: '||', l, r: this.parseAnd() } }
    return l
  }

  private parseAnd(): Expr {
    let l = this.parseCmp()
    while (this.is('op', '&&')) { this.next(); l = { t: 'bin', op: '&&', l, r: this.parseCmp() } }
    return l
  }

  private parseCmp(): Expr {
    let l = this.parseConcat()
    for (;;) {
      const k = this.peek()
      if (k.t === 'kw' && k.v === 'in') {
        this.next()
        const nameTok = this.next()
        if (nameTok.t !== 'id') throw this.syntax('expected array name')
        const idx = l.t === 'idxlist' ? l.list : [l]
        l = { t: 'in', idx, name: nameTok.v as string }
        continue
      }
      if (this.noCmp) break
      if (k.t === 'op' && ['==', '!=', '<', '<=', '>', '>=', '~', '!~'].includes(k.v as string)) {
        this.next()
        l = { t: 'bin', op: k.v as string, l, r: this.parseConcat() }
        continue
      }
      break
    }
    return l
  }

  private parseConcat(): Expr {
    let l = this.parseAdd()
    for (;;) {
      const k = this.peek()
      if (k.t === 'num' || k.t === 'str' || k.t === 're' || k.t === 'id' || (k.t === 'op' && (k.v === '(' || k.v === '$' || k.v === '+' || k.v === '-' || k.v === '!'))) {
        l = { t: 'bin', op: 'concat', l, r: this.parseAdd() }
        continue
      }
      break
    }
    return l
  }

  private parseAdd(): Expr {
    let l = this.parseMul()
    while (this.is('op', '+') || this.is('op', '-')) {
      const op = this.next().v as string
      l = { t: 'bin', op, l, r: this.parseMul() }
    }
    return l
  }

  private parseMul(): Expr {
    let l = this.parseUnary()
    while (this.is('op', '*') || this.is('op', '/') || this.is('op', '%')) {
      const op = this.next().v as string
      l = { t: 'bin', op, l, r: this.parseUnary() }
    }
    return l
  }

  private parseUnary(): Expr {
    if (this.is('op', '+') || this.is('op', '-') || this.is('op', '!')) {
      const op = this.next().v as string
      return { t: 'un', op, e: this.parseUnary() }
    }
    if (this.is('op', '++') || this.is('op', '--')) {
      const op = this.next().v as string
      const target = this.parseUnary()
      if (!isLValue(target)) throw this.syntax('invalid increment target')
      return { t: 'inc', op, target, pre: true }
    }
    return this.parsePow()
  }

  private parsePow(): Expr {
    const l = this.parsePostfix()
    if (this.is('op', '^') || this.is('op', '**')) {
      this.next()
      return { t: 'bin', op: '^', l, r: this.parseUnary() }
    }
    return l
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary()
    for (;;) {
      if (this.is('op', '++') || this.is('op', '--')) {
        const op = this.next().v as string
        if (!isLValue(e)) throw this.syntax('invalid increment target')
        e = { t: 'inc', op, target: e, pre: false }
        continue
      }
      if (this.is('op', '[')) {
        this.next()
        const idx = this.parseIdxList()
        this.expectOp(']')
        if (e.t === 'var') e = { t: 'arr', name: e.name, idx }
        else throw this.syntax('invalid array subscript')
        continue
      }
      break
    }
    return e
  }

  private parsePrimary(): Expr {
    const k = this.peek()
    if (k.t === 'num') { this.next(); return { t: 'num', v: k.v as number } }
    if (k.t === 'str') { this.next(); return { t: 'str', v: k.v as string } }
    if (k.t === 're') {
      this.next()
      const src = k.v as string
      try {
        const re = compilePosix(src, { ere: true })
        return { t: 're', src, re: new RegExp(re.source, re.flags) }
      } catch (e) {
        throw this.syntax(`invalid regexp: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (k.t === 'id') {
      this.next()
      const name = k.v as string
      if (this.is('op', '(')) {
        this.next()
        const args: Expr[] = []
        if (!this.is('op', ')')) args.push(...this.parseExprList())
        this.expectOp(')')
        return { t: 'call', name, args }
      }
      if (name === 'length' && !this.is('op', '[')) return { t: 'call', name: 'length', args: [] }
      return { t: 'var', name }
    }
    if (k.t === 'op' && k.v === '$') {
      this.next()
      if (this.is('num') && this.peek().v === 0) { this.next(); return { t: 'field0' } }
      const idx = this.parseUnary()
      return { t: 'field', e: idx }
    }
    if (k.t === 'op' && k.v === '(') {
      this.next()
      const saved = this.noCmp
      this.noCmp = false
      try {
        const first = this.parseExpr()
        if (this.is('op', ',')) {
          const list = [first]
          while (this.is('op', ',')) { this.next(); list.push(this.parseExpr()) }
          this.expectOp(')')
          return { t: 'idxlist', list }
        }
        this.expectOp(')')
        return first
      } finally {
        this.noCmp = saved
      }
    }
    throw this.syntax(`unexpected ${k.v ?? k.t}`)
  }
}

function isLValue(e: Expr): boolean {
  return e.t === 'var' || e.t === 'field' || e.t === 'field0' || e.t === 'arr'
}

function parseProgramText(src: string): { rules: Rule[]; funcs: Map<string, FuncDef> } {
  return new Parser(lex(src)).parseProgram()
}

// ---- runtime ------------------------------------------------------------------

const NUMERIC_RE = /^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$/

function isStrnum(s: string): boolean { return NUMERIC_RE.test(s.trim()) }
function toNum(v: AVal): number {
  if (typeof v === 'number') return v
  const s = v.trim()
  if (s === '') return 0
  if (isStrnum(s)) return parseFloat(s)
  return 0
}

class RedirMgr {
  private fileFirst = new Set<string>()
  private pipes = new Map<string, string[]>()

  fileWrite(ctx: CmdCtx, name: string, data: string, append: boolean) {
    if (name === '/dev/stderr') { ctx.err(data); return }
    if (name === '/dev/null') return
    if (name === '/dev/stdout') { ctx.out(data); return }
    const first = !this.fileFirst.has(name)
    this.fileFirst.add(name)
    ctx.fs.writeFile(ctx.resolve(name), data, append || !first)
  }

  pipeWrite(name: string, data: string) {
    let arr = this.pipes.get(name)
    if (!arr) { arr = []; this.pipes.set(name, arr) }
    arr.push(data)
  }

  async flushPipes(ctx: CmdCtx) {
    for (const [cmd, chunks] of this.pipes) {
      const argv = cmd.trim().split(/\s+/).filter(Boolean)
      if (argv.length === 0) continue
      const res = await ctx.exec(argv, chunks.join(''))
      if (res.out) ctx.out(res.out)
      if (res.err) ctx.err(res.err)
    }
    this.pipes.clear()
  }

  async flushPipe(ctx: CmdCtx, name: string) {
    const chunks = this.pipes.get(name)
    if (chunks === undefined) return
    this.pipes.delete(name)
    const argv = name.trim().split(/\s+/).filter(Boolean)
    if (argv.length === 0) return
    const res = await ctx.exec(argv, chunks.join(''))
    if (res.out) ctx.out(res.out)
    if (res.err) ctx.err(res.err)
  }
}

// ---- control signals ----------------------------------------------------------

class BreakSignal {}
class ContinueSignal {}
class NextSignal {}
class NextfileSignal {}
class ExitSignal { constructor(public code: number) {} }
class RetSignal { constructor(public val: AVal) {} }

// ---- interpreter --------------------------------------------------------------

class Interp {
  private vars = new Map<string, AVal | AArr>()
  private fields: string[] = []
  private record = ''
  private fs = ' '
  private ofs = ' '
  private ors = '\n'
  private rs = '\n'
  private nr = 0
  private fnr = 0
  private nf = 0
  private filename = ''
  private subsep = '\x1c'
  private rstart = 0
  private rlength = 0
  private convfmt = '%.6g'
  private ofmt = '%.6g'
  private seed = 1
  private steps = 0
  private fileReaders = new Map<string, { data: string; pos: number }>()
  private cmdReaders = new Map<string, { lines: string[]; idx: number }>()
  private pendingRecords: string[] = []
  private pendingIdx = 0
  private redir = new RedirMgr()

  constructor(private ctx: CmdCtx, private funcs: Map<string, FuncDef>) {
    const argvArr: AArr = new Map()
    argvArr.set('0', ctx.argv0)
    ctx.args.forEach((a, i) => argvArr.set(String(i + 1), a))
    this.vars.set('ARGV', argvArr)
    this.vars.set('ARGC', ctx.args.length + 1)
    const envArr: AArr = new Map()
    for (const [k, v] of Object.entries(ctx.env)) envArr.set(k, v)
    this.vars.set('ENVIRON', envArr)
  }

  private tick() {
    if (++this.steps > 5_000_000) throw new AwkAbort()
    if ((this.steps & 1023) === 0 && this.ctx.signal.aborted) throw new AwkAbort()
  }

  setVarPublic(name: string, val: string) { this.setVar(name, val) }
  runBegin(rules: Rule[]) { return this.runRules(rules, 'begin') }
  runEnd(rules: Rule[]) { return this.runRules(rules, 'end') }
  async flushPipes() { await this.redir.flushPipes(this.ctx) }

  processFile(data: string, filename: string) {
    this.filename = filename
    this.fnr = 0
    this.pendingRecords = this.splitRecords(data)
    this.pendingIdx = 0
  }

  nextRecord(): string | null {
    if (this.pendingIdx < this.pendingRecords.length) return this.pendingRecords[this.pendingIdx++]
    return null
  }

  beginRecord(rec: string) {
    this.setRecord(rec)
    this.nr++
    this.fnr++
  }

  async runMain(rules: Rule[]) { await this.runRules(rules, 'main') }

  private getVar(name: string): AVal {
    const v = this.vars.get(name)
    if (v !== undefined) return v instanceof Map ? 0 : v
    switch (name) {
      case 'NR': return this.nr
      case 'FNR': return this.fnr
      case 'NF': return this.nf
      case 'FS': return this.fs
      case 'OFS': return this.ofs
      case 'ORS': return this.ors
      case 'RS': return this.rs
      case 'FILENAME': return this.filename
      case 'SUBSEP': return this.subsep
      case 'RSTART': return this.rstart
      case 'RLENGTH': return this.rlength
      case 'CONVFMT': return this.convfmt
      case 'OFMT': return this.ofmt
      default: return ''
    }
  }

  private getArray(name: string): AArr {
    const v = this.vars.get(name)
    if (v instanceof Map) return v
    const arr: AArr = new Map()
    this.vars.set(name, arr)
    return arr
  }

  private setVar(name: string, val: AVal) {
    switch (name) {
      case 'NR': this.nr = toNum(val); return
      case 'FNR': this.fnr = toNum(val); return
      case 'NF': {
        const n = Math.trunc(toNum(val))
        if (n < 0) throw new AwkFatal('awk: NF set to negative value', 2)
        while (this.fields.length < n) this.fields.push('')
        if (this.fields.length > n) this.fields.length = n
        this.nf = n
        this.record = this.fields.join(this.ofs)
        return
      }
      case 'FS': this.fs = this.toStr(val); return
      case 'OFS': this.ofs = this.toStr(val); return
      case 'ORS': this.ors = this.toStr(val); return
      case 'RS': this.rs = this.toStr(val); return
      case 'FILENAME': this.filename = this.toStr(val); return
      case 'SUBSEP': this.subsep = this.toStr(val); return
      case 'RSTART': this.rstart = toNum(val); return
      case 'RLENGTH': this.rlength = toNum(val); return
      case 'CONVFMT': this.convfmt = this.toStr(val); return
      case 'OFMT': this.ofmt = this.toStr(val); return
      default: {
        const cur = this.vars.get(name)
        if (cur instanceof Map && typeof val === 'string') this.vars.set(name, val)
        else this.vars.set(name, val)
      }
    }
  }

  private toStr(v: AVal): string {
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v)
      return formatPrintf(this.convfmt, [String(v)])
    }
    return v
  }

  private num(v: AVal): number { return toNum(v) }
  private truthy(v: AVal): boolean { return typeof v === 'number' ? v !== 0 : v !== '' }

  private arrKey(idx: Expr[]): string {
    return idx.map((i) => this.toStr(this.evalExpr(i))).join(this.subsep)
  }

  private splitFields(s: string) {
    const fs = this.fs
    if (fs === '') this.fields = s === '' ? [] : Array.from(s)
    else if (fs === ' ') this.fields = s === '' ? [] : splitByRegex(s, /[ \t\n]+/)
    else if (fs.length === 1) this.fields = s === '' ? [] : s.split(fs)
    else {
      try {
        const re = new RegExp(compilePosix(fs, { ere: true }).source, 'g')
        this.fields = s === '' ? [] : splitByRegex(s, re)
      } catch {
        this.fields = s === '' ? [] : [s]
      }
    }
    this.nf = this.fields.length
  }

  private setRecord(s: string) {
    this.record = s
    this.splitFields(s)
  }

  private rebuildRecord() {
    this.record = this.fields.join(this.ofs)
    this.nf = this.fields.length
  }

  private getField(i: number): AVal {
    if (i < 0) throw new AwkFatal('awk: negative field index', 2)
    if (i === 0) return this.record
    return this.fields[i - 1] ?? ''
  }

  private setField(i: number, v: AVal) {
    if (i < 0) throw new AwkFatal('awk: negative field index', 2)
    if (i === 0) { this.setRecord(this.toStr(v)); return }
    while (this.fields.length < i) this.fields.push('')
    this.fields[i - 1] = this.toStr(v)
    this.rebuildRecord()
  }

  private evalExpr(e: Expr): AVal {
    this.tick()
    switch (e.t) {
      case 'num': return e.v
      case 'str': return e.v
      case 're': return this.evalReMatch(e.re, this.record)
      case 'var': return this.getVar(e.name)
      case 'field0': return this.record
      case 'field': return this.getField(Math.trunc(this.num(this.evalExpr(e.e))))
      case 'idxlist': return 0
      case 'arr': return this.getArray(e.name).get(this.arrKey(e.idx)) ?? ''
      case 'in': return this.getArray(e.name).has(this.arrKey(e.idx)) ? 1 : 0
      case 'bin': return this.evalBin(e)
      case 'un': {
        const v = this.evalExpr(e.e)
        if (e.op === '!') return this.truthy(v) ? 0 : 1
        if (e.op === '-') return -this.num(v)
        return this.num(v)
      }
      case 'tern': return this.truthy(this.evalExpr(e.c)) ? this.evalExpr(e.a) : this.evalExpr(e.b)
      case 'assign': {
        const val = this.evalExpr(e.e)
        this.assignTo(e.target, e.op === '=' ? val : this.computeAssign(e.op, e.target, val))
        return val
      }
      case 'inc': {
        const old = this.evalExpr(e.target)
        const next = (e.op === '++' ? 1 : -1) + this.num(old)
        this.assignTo(e.target, next)
        return e.pre ? next : this.num(old)
      }
      case 'call': return this.evalCall(e)
    }
  }

  private evalReMatch(re: RegExp, s: string): number {
    re.lastIndex = 0
    return re.test(s) ? 1 : 0
  }

  private evalBin(e: { op: string; l: Expr; r: Expr }): AVal {
    const { op, l, r } = e
    if (op === '&&') return this.truthy(this.evalExpr(l)) ? (this.truthy(this.evalExpr(r)) ? 1 : 0) : 0
    if (op === '||') return this.truthy(this.evalExpr(l)) ? 1 : (this.truthy(this.evalExpr(r)) ? 1 : 0)
    if (op === 'concat') return this.toStr(this.evalExpr(l)) + this.toStr(this.evalExpr(r))
    if (op === '~' || op === '!~') {
      const lhs = this.toStr(this.evalExpr(l))
      let m: boolean
      if (r.t === 're') m = this.evalReMatch(r.re, lhs) === 1
      else {
        const src = this.toStr(this.evalExpr(r))
        const re = compilePosix(src, { ere: true })
        m = new RegExp(re.source, re.flags).test(lhs)
      }
      return op === '~' ? (m ? 1 : 0) : (m ? 0 : 1)
    }
    if (op === '==' || op === '!=' || op === '<' || op === '<=' || op === '>' || op === '>=') {
      const c = this.compare(this.evalExpr(l), this.evalExpr(r))
      let out: boolean
      switch (op) {
        case '==': out = c === 0; break
        case '!=': out = c !== 0; break
        case '<': out = c < 0; break
        case '<=': out = c <= 0; break
        case '>': out = c > 0; break
        default: out = c >= 0; break
      }
      return out ? 1 : 0
    }
    const a = this.num(this.evalExpr(l))
    const b = this.num(this.evalExpr(r))
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/':
        if (b === 0) throw new AwkFatal('awk: division by zero', 2)
        return a / b
      case '%':
        if (b === 0) throw new AwkFatal('awk: division by zero', 2)
        return a % b
      case '^': return Math.pow(a, b)
      default: throw new AwkFatal(`awk: unsupported operator ${op}`, 2)
    }
  }

  private compare(a: AVal, b: AVal): number {
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
    const aNum = typeof a === 'number' || isStrnum(a)
    const bNum = typeof b === 'number' || isStrnum(b)
    if (aNum && bNum) {
      const x = this.num(a)
      const y = this.num(b)
      return x < y ? -1 : x > y ? 1 : 0
    }
    const x = this.toStr(a)
    const y = this.toStr(b)
    return x < y ? -1 : x > y ? 1 : 0
  }

  private computeAssign(op: string, target: Expr, val: AVal): AVal {
    const a = this.num(this.evalExpr(target))
    const b = this.num(val)
    switch (op) {
      case '+=': return a + b
      case '-=': return a - b
      case '*=': return a * b
      case '/=':
        if (b === 0) throw new AwkFatal('awk: division by zero', 2)
        return a / b
      case '%=':
        if (b === 0) throw new AwkFatal('awk: division by zero', 2)
        return a % b
      case '^=': case '**=': return Math.pow(a, b)
      default: return val
    }
  }

  private assignTo(target: Expr, val: AVal) {
    switch (target.t) {
      case 'var': this.setVar(target.name, val); return
      case 'field0': this.setRecord(this.toStr(val)); return
      case 'field': this.setField(Math.trunc(this.num(this.evalExpr(target.e))), val); return
      case 'arr': this.getArray(target.name).set(this.arrKey(target.idx), val); return
    }
  }

  private evalCall(e: { name: string; args: Expr[] }): AVal {
    const name = e.name
    // builtins that need lvalue/array names are handled with raw args
    if (name === 'split' && e.args.length >= 2) {
      const str = this.toStr(this.evalExpr(e.args[0]))
      const arrName = (e.args[1] as { name?: string }).name
      if (!arrName) throw new AwkFatal('awk: split: second argument is not an array', 2)
      const arr = this.getArray(arrName)
      arr.clear()
      const sep = e.args.length >= 3 ? this.toStr(this.evalExpr(e.args[2])) : this.fs
      const parts = this.splitStr(str, sep)
      parts.forEach((p, i) => arr.set(String(i + 1), p))
      return parts.length
    }
    if (name === 'sub' || name === 'gsub') {
      const reSrc = e.args[0].t === 're' ? e.args[0].src : this.toStr(this.evalExpr(e.args[0]))
      const repl = this.toStr(this.evalExpr(e.args[1] ?? { t: 'str', v: '' }))
      const reg = compilePosix(reSrc, { ere: true })
      const re = new RegExp(reg.source, reg.flags + 'g')
      if (e.args.length >= 3) {
        const target = e.args[2]
        const cur = this.toStr(this.evalExpr(target))
        const out = name === 'gsub' ? gsubAll(cur, re, repl) : subOne(cur, re, repl)
        this.assignTo(target, out.text)
        return out.count
      }
      const out = name === 'gsub' ? gsubAll(this.record, re, repl) : subOne(this.record, re, repl)
      this.setRecord(out.text)
      return out.count
    }
    if (name === 'match' && e.args.length >= 2) {
      const str = this.toStr(this.evalExpr(e.args[0]))
      const reSrc = e.args[1].t === 're' ? e.args[1].src : this.toStr(this.evalExpr(e.args[1]))
      const re = new RegExp(compilePosix(reSrc, { ere: true }).source)
      const m = re.exec(str)
      if (!m) { this.rstart = 0; this.rlength = -1; return 0 }
      this.rstart = m.index + 1
      this.rlength = m[0].length
      if (e.args.length >= 3) {
        const arrName = (e.args[2] as { name?: string }).name
        if (arrName) {
          const arr = this.getArray(arrName)
          arr.clear()
          arr.set('0', m[0])
          for (let i = 1; i < m.length; i++) arr.set(String(i), m[i] ?? '')
        }
      }
      return this.rstart
    }
    if (name === 'gensub' && e.args.length >= 4) {
      const reSrc = e.args[0].t === 're' ? e.args[0].src : this.toStr(this.evalExpr(e.args[0]))
      const repl = this.toStr(this.evalExpr(e.args[1]))
      const how = this.toStr(this.evalExpr(e.args[2]))
      const str = this.toStr(this.evalExpr(e.args[3]))
      const reg = compilePosix(reSrc, { ere: true })
      const g = new RegExp(reg.source, reg.flags + 'g')
      if (how === 'g' || how === 'G') return gsubAll(str, g, repl).text
      const occ = parseInt(how, 10)
      if (!Number.isNaN(occ)) return subNth(str, g, repl, occ)
      return str
    }
    if (name === 'length' && e.args.length === 1 && e.args[0].t === 'var') {
      const v = this.vars.get(e.args[0].name)
      if (v instanceof Map) return v.size
    }
    const args = e.args.map((a) => this.evalExpr(a))
    if (BUILTINS.has(name)) return this.callBuiltin(name, args)
    const fn = this.funcs.get(name)
    if (!fn) throw new AwkFatal(`awk: function \`${name}' not defined`, 2)
    const saved = new Map<string, AVal | AArr | undefined>()
    for (const p of fn.params) {
      saved.set(p, this.vars.get(p))
      this.vars.set(p, args.shift() ?? '')
    }
    let ret: AVal = ''
    try {
      this.execStmtSync(fn.body)
    } catch (sig) {
      if (sig instanceof RetSignal) ret = sig.val
      else throw sig
    } finally {
      for (const p of fn.params) {
        const old = saved.get(p)
        if (old === undefined) this.vars.delete(p)
        else this.vars.set(p, old)
      }
    }
    return ret
  }

  private async execStmt(s: Stmt): Promise<void> {
    await this.execStmtInternal(s, true)
  }

  private async execStmtInternal(s: Stmt, allowAsync: boolean): Promise<void> {
    this.tick()
    switch (s.t) {
      case 'expr': this.evalExpr(s.e); return
      case 'print': this.execPrint(s); return
      case 'printf': this.execPrintf(s); return
      case 'if':
        if (this.truthy(this.evalExpr(s.c))) await this.execStmtInternal(s.then, allowAsync)
        else if (s.els) await this.execStmtInternal(s.els, allowAsync)
        return
      case 'while': {
        while (this.truthy(this.evalExpr(s.c))) {
          try { await this.execStmtInternal(s.body, allowAsync) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) continue
            throw sig
          }
        }
        return
      }
      case 'do': {
        for (;;) {
          try { await this.execStmtInternal(s.body, allowAsync) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) { /* fall to condition */ }
            else throw sig
          }
          if (!this.truthy(this.evalExpr(s.c))) break
        }
        return
      }
      case 'for': {
        if (s.init) this.evalExpr(s.init)
        while (s.cond === undefined || this.truthy(this.evalExpr(s.cond))) {
          try { await this.execStmtInternal(s.body, allowAsync) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) { /* fall to step */ }
            else throw sig
          }
          if (s.step) this.evalExpr(s.step)
        }
        return
      }
      case 'forIn': {
        const arr = this.getArray((s.arr as { name: string }).name)
        for (const key of Array.from(arr.keys())) {
          this.setVar(s.name, key)
          try { await this.execStmtInternal(s.body, allowAsync) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) continue
            throw sig
          }
        }
        return
      }
      case 'block': for (const st of s.list) await this.execStmtInternal(st, allowAsync); return
      case 'break': throw new BreakSignal()
      case 'continue': throw new ContinueSignal()
      case 'next': throw new NextSignal()
      case 'nextfile': throw new NextfileSignal()
      case 'exit': throw new ExitSignal(s.e ? Math.trunc(this.num(this.evalExpr(s.e))) : 0)
      case 'delete': {
        const arr = this.getArray(s.name)
        if (s.idx) arr.delete(this.arrKey(s.idx))
        else arr.clear()
        return
      }
      case 'getline': {
        const code = await this.execGetline(s, allowAsync)
        // getline expression value is assigned only when used as expression;
        // statement-level getline result is discarded.
        void code
        return
      }
      case 'return': throw new RetSignal(s.e ? this.evalExpr(s.e) : '')
    }
  }

  // Sync statement executor used for user-defined function bodies, where async
  // getline from a command is not available.
  private execStmtSync(s: Stmt): void {
    this.tick()
    switch (s.t) {
      case 'expr': this.evalExpr(s.e); return
      case 'print': this.execPrint(s); return
      case 'printf': this.execPrintf(s); return
      case 'if':
        if (this.truthy(this.evalExpr(s.c))) this.execStmtSync(s.then)
        else if (s.els) this.execStmtSync(s.els)
        return
      case 'while': {
        while (this.truthy(this.evalExpr(s.c))) {
          try { this.execStmtSync(s.body) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) continue
            throw sig
          }
        }
        return
      }
      case 'do': {
        for (;;) {
          try { this.execStmtSync(s.body) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) { /* fall to condition */ }
            else throw sig
          }
          if (!this.truthy(this.evalExpr(s.c))) break
        }
        return
      }
      case 'for': {
        if (s.init) this.evalExpr(s.init)
        while (s.cond === undefined || this.truthy(this.evalExpr(s.cond))) {
          try { this.execStmtSync(s.body) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) { /* fall to step */ }
            else throw sig
          }
          if (s.step) this.evalExpr(s.step)
        }
        return
      }
      case 'forIn': {
        const arr = this.getArray((s.arr as { name: string }).name)
        for (const key of Array.from(arr.keys())) {
          this.setVar(s.name, key)
          try { this.execStmtSync(s.body) } catch (sig) {
            if (sig instanceof BreakSignal) break
            if (sig instanceof ContinueSignal) continue
            throw sig
          }
        }
        return
      }
      case 'block': for (const st of s.list) this.execStmtSync(st); return
      case 'break': throw new BreakSignal()
      case 'continue': throw new ContinueSignal()
      case 'next': throw new NextSignal()
      case 'nextfile': throw new NextfileSignal()
      case 'exit': throw new ExitSignal(s.e ? Math.trunc(this.num(this.evalExpr(s.e))) : 0)
      case 'delete': {
        const arr = this.getArray(s.name)
        if (s.idx) arr.delete(this.arrKey(s.idx))
        else arr.clear()
        return
      }
      case 'getline': this.execGetlineSync(s); return
      case 'return': throw new RetSignal(s.e ? this.evalExpr(s.e) : '')
    }
  }

  private execGetlineSync(s: { kind: string; target?: Expr; src?: Expr }): number {
    switch (s.kind) {
      case 'plain': {
        const rec = this.nextRecord()
        if (rec === null) return 0
        this.setRecord(rec)
        return 1
      }
      case 'var': {
        const rec = this.nextRecord()
        if (rec === null) return 0
        this.assignTo(s.target!, rec)
        return 1
      }
      case 'file': {
        const name = this.toStr(this.evalExpr(s.src!))
        const rec = this.readFileRecord(name)
        if (rec === null) return 0
        if (s.target) this.assignTo(s.target, rec)
        else this.setRecord(rec)
        return 1
      }
      default: return 0
    }
  }

  private execPrint(s: { args: Expr[]; redir?: Redir }) {
    let text: string
    if (s.args.length === 0) text = this.record + this.ors
    else text = s.args.map((a) => this.printFmt(this.evalExpr(a))).join(this.ofs) + this.ors
    this.writeRedir(s.redir, text)
  }

  private execPrintf(s: { fmt: Expr; args: Expr[]; redir?: Redir }) {
    const fmt = this.toStr(this.evalExpr(s.fmt))
    const vals = s.args.map((a) => this.evalExpr(a))
    this.writeRedir(s.redir, awkPrintf(fmt, vals, this.convfmt))
  }

  private printFmt(v: AVal): string {
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v)
      return formatPrintf(this.ofmt, [String(v)])
    }
    return v
  }

  private writeRedir(redir: Redir | undefined, text: string) {
    if (!redir) { this.ctx.out(text); return }
    const target = this.toStr(this.evalExpr(redir.target))
    if (redir.op === '|') this.redir.pipeWrite(target, text)
    else if (redir.op === '>>') this.redir.fileWrite(this.ctx, target, text, true)
    else this.redir.fileWrite(this.ctx, target, text, false)
  }

  private async execGetline(s: { kind: string; target?: Expr; src?: Expr }, allowAsync: boolean): Promise<number> {
    switch (s.kind) {
      case 'plain': {
        const rec = this.nextRecord()
        if (rec === null) return 0
        this.setRecord(rec)
        return 1
      }
      case 'var': {
        const rec = this.nextRecord()
        if (rec === null) return 0
        this.assignTo(s.target!, rec)
        return 1
      }
      case 'file': {
        const name = this.toStr(this.evalExpr(s.src!))
        const rec = this.readFileRecord(name)
        if (rec === null) return 0
        if (s.target) this.assignTo(s.target, rec)
        else this.setRecord(rec)
        return 1
      }
      case 'cmd': {
        const cmd = this.toStr(this.evalExpr(s.src!))
        let reader = this.cmdReaders.get(cmd)
        if (!reader) {
          let out = ''
          if (allowAsync) {
            const argv = cmd.trim().split(/\s+/).filter(Boolean)
            const res = argv.length === 0 ? { status: 0, out: '', err: '' } : await this.ctx.exec(argv, '')
            out = res.out
            if (res.err) this.ctx.err(res.err)
          }
          reader = { lines: out === '' ? [] : out.split('\n'), idx: 0 }
          this.cmdReaders.set(cmd, reader)
        }
        if (reader.idx >= reader.lines.length) return 0
        const line = reader.lines[reader.idx++]
        if (s.target) this.assignTo(s.target, line)
        else this.setRecord(line)
        return 1
      }
    }
    return 0
  }

  private readFileRecord(name: string): string | null {
    let r = this.fileReaders.get(name)
    if (!r) {
      try {
        r = { data: this.ctx.fs.readFile(this.ctx.resolve(name)), pos: 0 }
      } catch {
        return null
      }
      this.fileReaders.set(name, r)
    }
    const rec = this.readRecordFrom(r.data, r.pos)
    if (rec === null) return null
    r.pos = rec.next
    return rec.text
  }

  private readRecordFrom(data: string, pos: number): { text: string; next: number } | null {
    if (pos >= data.length) return null
    const rs = this.rs
    if (rs === '\n') {
      const i = data.indexOf('\n', pos)
      if (i < 0) return { text: data.slice(pos), next: data.length }
      return { text: data.slice(pos, i), next: i + 1 }
    }
    if (rs === '') {
      const rest = data.slice(pos)
      const m = /\n[ \t]*\n+/.exec(rest)
      if (m) return { text: rest.slice(0, m.index), next: pos + m.index + m[0].length }
      return { text: rest, next: data.length }
    }
    if (rs.length === 1) {
      const i = data.indexOf(rs, pos)
      if (i < 0) return { text: data.slice(pos), next: data.length }
      return { text: data.slice(pos, i), next: i + 1 }
    }
    try {
      const re = new RegExp(compilePosix(rs, { ere: true }).source, 'g')
      re.lastIndex = pos
      const m = re.exec(data)
      if (m) return { text: data.slice(pos, m.index), next: m.index + m[0].length }
      return { text: data.slice(pos), next: data.length }
    } catch {
      return { text: data.slice(pos), next: data.length }
    }
  }

  private callBuiltin(name: string, args: AVal[]): AVal {
    this.tick()
    const s = (i: number) => this.toStr(args[i] ?? '')
    const n = (i: number) => this.num(args[i] ?? 0)
    switch (name) {
      case 'length': {
        if (args.length === 0) return this.record.length
        const a: unknown = args[0]
        if (a instanceof Map) return a.size
        return this.toStr(args[0]).length
      }
      case 'substr': {
        const str = s(0)
        let m = Math.trunc(n(1))
        if (m < 1) m = 1
        if (args.length >= 3) {
          const len = Math.trunc(n(2))
          if (len <= 0) return ''
          return str.slice(m - 1, m - 1 + len)
        }
        return str.slice(m - 1)
      }
      case 'index': {
        const idx = s(0).indexOf(s(1))
        return idx < 0 ? 0 : idx + 1
      }
      case 'sprintf': return formatPrintf(s(0), args.slice(1).map((a) => this.toStr(a)))
      case 'tolower': return s(0).toLowerCase()
      case 'toupper': return s(0).toUpperCase()
      case 'int': return Math.trunc(n(0))
      case 'sqrt': return Math.sqrt(n(0))
      case 'sin': return Math.sin(n(0))
      case 'cos': return Math.cos(n(0))
      case 'atan2': return Math.atan2(n(0), n(1))
      case 'exp': return Math.exp(n(0))
      case 'log': return Math.log(n(0))
      case 'rand': {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
        return this.seed / 0x7fffffff
      }
      case 'srand': {
        const old = this.seed
        this.seed = args.length === 0 ? Math.floor(Date.now() / 1000) : n(0)
        return old
      }
      case 'systime': return Math.floor(Date.now() / 1000)
      case 'strftime': return strftimeBasic(s(0), args.length >= 2 ? n(1) : Math.floor(Date.now() / 1000))
      case 'system': {
        this.ctx.runScript(s(0)).catch(() => 0)
        return 0
      }
      case 'close': {
        const key = s(0)
        this.redir.flushPipe(this.ctx, key).catch(() => {})
        this.fileReaders.delete(key)
        this.cmdReaders.delete(key)
        return 0
      }
      case 'fflush': {
        const key = args.length >= 1 ? s(0) : ''
        this.redir.flushPipe(this.ctx, key).catch(() => {})
        return 0
      }
      case 'gensub': {
        const reg = compilePosix(s(0), { ere: true })
        const g = new RegExp(reg.source, reg.flags + 'g')
        const how = s(2)
        const str = s(3)
        if (how === 'g' || how === 'G') return gsubAll(str, g, s(1)).text
        const occ = parseInt(how, 10)
        if (!Number.isNaN(occ)) return subNth(str, g, s(1), occ)
        return str
      }
      default: return ''
    }
  }

  private splitStr(str: string, sep: string): string[] {
    if (sep === ' ') return str === '' ? [] : splitByRegex(str, /[ \t\n]+/)
    if (sep === '') return str === '' ? [] : Array.from(str)
    if (sep.length === 1) return str === '' ? [] : str.split(sep)
    try {
      return str === '' ? [] : splitByRegex(str, new RegExp(compilePosix(sep, { ere: true }).source, 'g'))
    } catch {
      return str === '' ? [] : [str]
    }
  }

  private splitRecords(data: string): string[] {
    const rs = this.rs
    if (rs === '\n') {
      if (data === '') return []
      const parts = data.split('\n')
      if (parts[parts.length - 1] === '') parts.pop()
      return parts
    }
    if (rs === '') {
      if (data === '') return []
      const parts = data.split(/\n[ \t]*\n+/)
      if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
      return parts.map((p) => p.replace(/\n+$/, ''))
    }
    if (rs.length === 1) {
      if (data === '') return []
      const parts = data.split(rs)
      if (parts[parts.length - 1] === '') parts.pop()
      return parts
    }
    try {
      const re = new RegExp(compilePosix(rs, { ere: true }).source, 'g')
      const parts: string[] = []
      let last = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(data))) {
        parts.push(data.slice(last, m.index))
        last = m.index + m[0].length
        if (m[0].length === 0) re.lastIndex++
      }
      parts.push(data.slice(last))
      if (parts.length > 0 && parts[parts.length - 1] === '' && last === data.length) parts.pop()
      return parts
    } catch {
      return data === '' ? [] : [data]
    }
  }

  private patternTrue(e: Expr): boolean {
    if (e.t === 're') return this.evalReMatch(e.re, this.record) === 1
    return this.truthy(this.evalExpr(e))
  }

  private async runRules(rules: Rule[], phase: 'begin' | 'end' | 'main') {
    for (const rule of rules) {
      let selected = false
      if (phase === 'begin') selected = rule.pattern.t === 'begin'
      else if (phase === 'end') selected = rule.pattern.t === 'end'
      else if (rule.pattern.t === 'begin' || rule.pattern.t === 'end') selected = false
      else if (rule.pattern.t === 'always') selected = true
      else if (rule.pattern.t === 'expr') selected = this.patternTrue(rule.pattern.e)
      else {
        const p = rule.pattern
        if (!p.state.inRange && this.patternTrue(p.a)) p.state.inRange = true
        selected = p.state.inRange
        if (p.state.inRange && this.patternTrue(p.b)) p.state.inRange = false
      }
      if (selected) {
        try { await this.execStmt(rule.action) } catch (sig) { throw sig }
      }
    }
  }
}

// ---- helpers ------------------------------------------------------------------

function splitByRegex(str: string, re: RegExp): string[] {
  const g = re.global ? re : new RegExp(re.source, re.flags + 'g')
  const parts: string[] = []
  let last = 0
  g.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = g.exec(str))) {
    parts.push(str.slice(last, m.index))
    last = m.index + m[0].length
    if (m[0].length === 0) g.lastIndex++
  }
  parts.push(str.slice(last))
  // awk drops a single trailing empty field only when the separator matched at
  // the very end; whitespace default also drops leading empty fields.
  return parts
}

function awkPrintf(fmt: string, vals: AVal[], convfmt: string): string {
  const args = vals.map((v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : formatPrintf(convfmt, [String(v)])) : v))
  const spec = /%[-+ #0]*(\*|\d+)?(?:\.(\*|\d+))?([diouxXeEfFgGcsbq%])/g
  const converted = args.slice()
  const nums = vals.slice()
  let ai = 0
  let m: RegExpExecArray | null
  spec.lastIndex = 0
  while ((m = spec.exec(fmt))) {
    const [, wRaw, pRaw, conv] = m
    if (conv === '%') continue
    const idx = ai + (wRaw === '*' ? 1 : 0) + (pRaw === '*' ? 1 : 0)
    if (conv === 'c') {
      const orig = nums[idx]
      if (typeof orig === 'number') converted[idx] = String.fromCharCode(Math.trunc(orig))
    }
    ai = idx + 1
  }
  return formatPrintf(fmt, converted)
}

function subOne(str: string, re: RegExp, repl: string): { text: string; count: number } {
  re.lastIndex = 0
  const m = re.exec(str)
  if (!m) return { text: str, count: 0 }
  return { text: str.slice(0, m.index) + awkReplacement(repl, m) + str.slice(m.index + m[0].length), count: 1 }
}

function gsubAll(str: string, re: RegExp, repl: string): { text: string; count: number } {
  let out = ''
  let pos = 0
  let count = 0
  for (;;) {
    re.lastIndex = pos
    const m = re.exec(str)
    if (!m) { out += str.slice(pos); break }
    out += str.slice(pos, m.index) + awkReplacement(repl, m)
    count++
    if (m[0].length === 0) {
      if (m.index >= str.length) break
      out += str[m.index]
      pos = m.index + 1
    } else {
      pos = m.index + m[0].length
      if (pos >= str.length) break
    }
  }
  return { text: out, count }
}

function subNth(str: string, re: RegExp, repl: string, nth: number): string {
  let out = ''
  let pos = 0
  let count = 0
  for (;;) {
    re.lastIndex = pos
    const m = re.exec(str)
    if (!m) { out += str.slice(pos); break }
    count++
    if (count === nth) {
      out += str.slice(pos, m.index) + awkReplacement(repl, m) + str.slice(m.index + m[0].length)
      break
    }
    if (m[0].length === 0) {
      if (m.index >= str.length) { out += str.slice(pos); break }
      out += str.slice(pos, m.index + 1)
      pos = m.index + 1
    } else {
      out += str.slice(pos, m.index + m[0].length)
      pos = m.index + m[0].length
      if (pos >= str.length) break
    }
  }
  return out
}

function awkReplacement(repl: string, m: RegExpExecArray): string {
  let out = ''
  for (let i = 0; i < repl.length; i++) {
    const c = repl[i]
    if (c === '&') { out += m[0]; continue }
    if (c === '\\' && i + 1 < repl.length) {
      const n = repl[++i]
      if (n >= '1' && n <= '9') { out += m[Number(n)] ?? ''; continue }
      if (n === '\\') { out += '\\'; continue }
      if (n === '&') { out += '&'; continue }
      out += n
      continue
    }
    out += c
  }
  return out
}

function strftimeBasic(fmt: string, t: number): string {
  const d = new Date(t * 1000)
  const pad = (x: number) => String(x).padStart(2, '0')
  const day = d.getDay()
  return fmt
    .replace(/%Y/g, String(d.getFullYear()))
    .replace(/%m/g, pad(d.getMonth() + 1))
    .replace(/%d/g, pad(d.getDate()))
    .replace(/%H/g, pad(d.getHours()))
    .replace(/%M/g, pad(d.getMinutes()))
    .replace(/%S/g, pad(d.getSeconds()))
    .replace(/%u/g, String(day === 0 ? 7 : day))
    .replace(/%j/g, String(Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1))
    .replace(/%a/g, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day])
    .replace(/%A/g, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day])
    .replace(/%b/g, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()])
    .replace(/%B/g, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()])
    .replace(/%%/g, '%')
}

// ---- command ------------------------------------------------------------------

interface AwkOptions {
  fs?: string
  vars: { name: string; val: string }[]
  programs: { text: string; file: boolean }[]
  files: string[]
}

function parseArgs(args: string[]): AwkOptions {
  const opts: AwkOptions = { vars: [], programs: [], files: [] }
  let i = 0
  let programGiven = false
  for (; i < args.length; i++) {
    const a = args[i]
    if (a === '--') { opts.files.push(...args.slice(i + 1)); break }
    if (a === '-F') {
      const v = args[++i]
      if (v === undefined) throw new AwkFatal("awk: option requires an argument -- 'F'", 2)
      opts.fs = unescape(v).text
      continue
    }
    if (a.startsWith('-F') && a.length > 2) {
      const v = unescape(a.slice(2)).text
      opts.fs = v === 't' ? '\t' : v
      continue
    }
    if (a === '-v') {
      const v = args[++i]
      if (v === undefined) throw new AwkFatal("awk: option requires an argument -- 'v'", 2)
      const eq = v.indexOf('=')
      if (eq < 0) throw new AwkFatal(`awk: invalid variable assignment \`${v}'`, 2)
      opts.vars.push({ name: v.slice(0, eq), val: v.slice(eq + 1) })
      continue
    }
    if (a.startsWith('-v') && a.length > 2) {
      const v = a.slice(2)
      const eq = v.indexOf('=')
      if (eq < 0) throw new AwkFatal(`awk: invalid variable assignment \`${v}'`, 2)
      opts.vars.push({ name: v.slice(0, eq), val: v.slice(eq + 1) })
      continue
    }
    if (a === '-f') {
      const v = args[++i]
      if (v === undefined) throw new AwkFatal("awk: option requires an argument -- 'f'", 2)
      opts.programs.push({ text: v, file: true })
      programGiven = true
      continue
    }
    if (a.startsWith('-f') && a.length > 2) { opts.programs.push({ text: a.slice(2), file: true }); programGiven = true; continue }
    if (a.startsWith('-') && a !== '-') throw new AwkFatal(`awk: invalid option -- '${a.slice(1)}'`, 2)
    if (!programGiven) {
      opts.programs.push({ text: a, file: false })
      programGiven = true
    } else {
      opts.files.push(a)
    }
  }
  if (opts.programs.length === 0) throw new AwkFatal('awk: no program given', 2)
  return opts
}

function fsReason(e: unknown): string {
  if (e instanceof Error) {
    const r = (e as { reason?: string }).reason
    if (r) return r
    return e.message
  }
  return String(e)
}

async function runAwk(ctx: CmdCtx): Promise<number> {
  let opts: AwkOptions
  try {
    opts = parseArgs(ctx.args)
  } catch (e) {
    if (e instanceof AwkFatal) { ctx.err(e.message); return e.status }
    throw e
  }

  const parts: string[] = []
  for (const p of opts.programs) {
    if (p.file) {
      try {
        parts.push(ctx.fs.readFile(ctx.resolve(p.text)))
      } catch (e) {
        ctx.err(`awk: fatal: cannot open file \`${p.text}' for reading: ${fsReason(e)}`)
        return 2
      }
    } else {
      parts.push(p.text)
    }
  }
  const program = parts.join('\n')

  let rules: Rule[]
  let funcs: Map<string, FuncDef>
  try {
    const parsed = parseProgramText(program)
    rules = parsed.rules
    funcs = parsed.funcs
  } catch (e) {
    if (e instanceof AwkSyntaxError) {
      const srcLine = program.split('\n')[e.line - 1] ?? ''
      ctx.err(`awk: syntax error at source line ${e.line}\n${srcLine}`)
      return 2
    }
    throw e
  }

  const interp = new Interp(ctx, funcs)
  if (opts.fs !== undefined) interp.setVarPublic('FS', opts.fs)
  for (const v of opts.vars) interp.setVarPublic(v.name, v.val)

  let exitCode = 0
  try {
    await interp.runBegin(rules)

    const files = opts.files.length === 0 ? ['-'] : opts.files
    const stdinData = opts.files.length === 0 || opts.files.includes('-') ? await ctx.stdin.readAll() : ''
    let stdinUsed = false
    outer: for (const file of files) {
      let data: string
      if (file === '-') {
        data = stdinUsed ? '' : stdinData
        stdinUsed = true
      } else {
        try {
          data = ctx.fs.readFile(ctx.resolve(file))
        } catch (e) {
          ctx.err(`awk: fatal: cannot open file \`${file}' for reading: ${fsReason(e)}`)
          return 2
        }
      }
      interp.processFile(data, file)
      for (;;) {
        const rec = interp.nextRecord()
        if (rec === null) break
        interp.beginRecord(rec)
        try {
          await interp.runMain(rules)
        } catch (sig) {
          if (sig instanceof NextSignal) continue
          if (sig instanceof NextfileSignal) continue outer
          if (sig instanceof ExitSignal) { exitCode = sig.code; break outer }
          throw sig
        }
      }
    }

    await interp.runEnd(rules)
    await interp.flushPipes()
    return exitCode
  } catch (e) {
    if (e instanceof AwkAbort) return 130
    if (e instanceof AwkFatal) {
      ctx.err(e.message)
      return e.status
    }
    throw e
  }
}

export const commands: Record<string, Cmd> = {
  awk: (ctx: CmdCtx) => runAwk(ctx),
  gawk: (ctx: CmdCtx) => runAwk(ctx),
  mawk: (ctx: CmdCtx) => runAwk(ctx),
}

export const info: Record<string, CmdInfo> = {
  awk: { summary: 'pattern scanning and processing language', usage: 'awk [-F fs] [-v var=val] [-f progfile] [program] [file ...]' },
  gawk: { summary: 'GNU awk', usage: 'gawk [-F fs] [-v var=val] [-f progfile] [program] [file ...]' },
  mawk: { summary: 'mawk', usage: 'mawk [-F fs] [-v var=val] [-f progfile] [program] [file ...]' },
}

const mod: CmdModule = { commands, info }
export default mod
