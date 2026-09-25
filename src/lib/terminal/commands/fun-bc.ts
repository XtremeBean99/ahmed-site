// bc: an interpreter for the classic arbitrary-precision calculator language.
// Numbers are decimal fixed-point values stored as {neg, d, s}: value = +/- d * 10^-s.
// Arithmetic follows GNU bc scale semantics exactly (division and powers truncate).

export interface BcOptions {
  mathlib: boolean
  quiet: boolean
}

interface BcNum { neg: boolean; d: bigint; s: number }

type TokType = 'num' | 'name' | 'op' | 'sep' | 'eof'

interface Tok { t: TokType; v: string; num?: BcNum }

class BcError extends Error {}

function pow10(n: number): bigint {
  return 10n ** BigInt(Math.max(0, n))
}

function absTruncDiv(a: bigint, b: bigint): bigint {
  // BigInt division truncates toward zero.
  return a / b
}

function makeNum(neg: boolean, d: bigint, s: number): BcNum {
  return { neg: d === 0n ? false : neg, d: d < 0n ? -d : d, s }
}

function align(a: BcNum, s: number): bigint {
  return a.d * pow10(s - a.s)
}

export function numAdd(a: BcNum, b: BcNum, scale: number): BcNum {
  const s = Math.max(a.s, b.s)
  const da = align(a, s)
  const db = align(b, s)
  const av = a.neg ? -da : da
  const bv = b.neg ? -db : db
  const sum = av + bv
  return makeNum(sum < 0n, sum, s)
}

export function numSub(a: BcNum, b: BcNum, scale: number): BcNum {
  const s = Math.max(a.s, b.s)
  const da = align(a, s)
  const db = align(b, s)
  const av = a.neg ? -da : da
  const bv = b.neg ? -db : db
  const diff = av - bv
  return makeNum(diff < 0n, diff, s)
}

export function numMul(a: BcNum, b: BcNum, scale: number): BcNum {
  let d = a.d * b.d
  const s = a.s + b.s
  const target = Math.min(s, Math.max(scale, a.s, b.s))
  if (s > target) d = absTruncDiv(d, pow10(s - target))
  return makeNum(a.neg !== b.neg, d, target)
}

export function numDiv(a: BcNum, b: BcNum, scale: number): BcNum {
  if (b.d === 0n) throw new BcError('Divide by zero')
  const s = scale
  const exp = s + b.s - a.s
  const d = exp >= 0 ? absTruncDiv(a.d * pow10(exp), b.d) : absTruncDiv(a.d, b.d * pow10(-exp))
  return makeNum(a.neg !== b.neg, d, s)
}

export function numMod(a: BcNum, b: BcNum, scale: number): BcNum {
  if (b.d === 0n) throw new BcError('Divide by zero')
  const qs = scale + b.s
  const q = numDiv(a, b, qs)
  const ms = Math.max(qs, a.s)
  const av = (a.neg ? -1n : 1n) * a.d * pow10(ms - a.s)
  const bv = (q.neg ? -1n : 1n) * q.d * b.d * pow10(ms - q.s - b.s)
  const m = av - bv
  return makeNum(m < 0n, m, ms)
}

export function numPow(a: BcNum, b: BcNum, scale: number): BcNum {
  if (b.s !== 0) throw new BcError('Exponent must be an integer')
  if (b.d > 10000n) throw new BcError('Exponent too large')
  if (b.neg) {
    const p = numPow(a, makeNum(false, b.d, 0), scale)
    return numDiv(makeNum(false, 1n, 0), p, scale)
  }
  if (b.d === 0n) return makeNum(false, 1n, 0)
  let base = a.d
  let exp = b.d
  let d = 1n
  while (exp > 0n) {
    if (exp & 1n) d *= base
    exp >>= 1n
    if (exp > 0n) base *= base
  }
  const s = a.s * Number(b.d)
  const target = Math.min(s, Math.max(scale, a.s))
  if (s > target) d = absTruncDiv(d, pow10(s - target))
  return makeNum(a.neg && (b.d & 1n) === 1n, d, target)
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + n / x) / 2n
  }
  return x
}

export function numSqrt(a: BcNum, scale: number): BcNum {
  if (a.neg) throw new BcError('Square root of negative number')
  const rs = Math.max(scale, a.s)
  const exp = 2 * rs - a.s
  const n = exp >= 0 ? a.d * pow10(exp) : absTruncDiv(a.d, pow10(-exp))
  return makeNum(false, isqrt(n), rs)
}

export function numLength(a: BcNum): BcNum {
  const digits = a.d.toString()
  const first = digits.split('').findIndex((c) => c !== '0')
  const len = first === -1 ? 1 : digits.length - first
  return makeNum(false, BigInt(len), 0)
}

export function numScale(a: BcNum): BcNum {
  return makeNum(false, BigInt(a.s), 0)
}

// ---- input parsing ----

function digitValue(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (ch >= 'A' && ch <= 'F') return ch.charCodeAt(0) - 55
  if (ch >= 'a' && ch <= 'f') return ch.charCodeAt(0) - 87
  return -1
}

export function parseBcNumber(text: string, ibase: number): BcNum {
  let s = text
  let neg = false
  if (s[0] === '-') { neg = true; s = s.slice(1) }
  else if (s[0] === '+') { s = s.slice(1) }
  const dot = s.indexOf('.')
  const intPart = dot === -1 ? s : s.slice(0, dot)
  const fracPart = dot === -1 ? '' : s.slice(dot + 1)
  let d = 0n
  for (const ch of intPart) {
    const v = digitValue(ch)
    if (v < 0 || v >= ibase) throw new BcError('bad number')
    d = d * BigInt(ibase) + BigInt(v)
  }
  for (const ch of fracPart) {
    const v = digitValue(ch)
    if (v < 0 || v >= ibase) throw new BcError('bad number')
    d = d * BigInt(ibase) + BigInt(v)
  }
  return makeNum(neg, d, fracPart.length)
}

function digitChar(v: number): string {
  return v < 10 ? String(v) : String.fromCharCode(55 + v)
}

/** Format a fixed-point number in the given output base. */
export function formatBcNum(n: BcNum, obase: number): string {
  const intD = absTruncDiv(n.d, pow10(n.s))
  const fracD = n.d % pow10(n.s)
  let intPart = intD.toString(obase).toUpperCase()
  if (intPart === '0') intPart = '0'
  let out = (n.neg ? '-' : '') + intPart
  if (n.s > 0) {
    let f = fracD
    let frac = ''
    for (let i = 0; i < n.s; i++) {
      f *= BigInt(obase)
      const digit = absTruncDiv(f, pow10(n.s))
      frac += digitChar(Number(digit))
      f %= pow10(n.s)
    }
    out += '.' + frac
  }
  return out
}

/** GNU bc wraps output lines at 68 columns with a trailing backslash. */
export function wrapBcOutput(s: string, width = 68): string {
  if (s.length <= width) return s
  let out = ''
  for (let i = 0; i < s.length; i += width) {
    const chunk = s.slice(i, i + width)
    if (i + width < s.length) out += chunk + '\\\n'
    else out += chunk
  }
  return out
}

// ---- tokenizer / parser / interpreter ----

const KEYWORDS = new Set(['if', 'while', 'for', 'define', 'break', 'continue', 'quit', 'halt', 'return', 'else', 'sqrt', 'length', 'scale', 'ibase', 'obase'])

interface FuncDef { params: string[]; body: Stmt[] }

type Stmt =
  | { k: 'expr'; e: Expr; isAssign: boolean }
  | { k: 'block'; list: Stmt[] }
  | { k: 'if'; cond: Expr; then: Stmt; els: Stmt | null }
  | { k: 'while'; cond: Expr; body: Stmt }
  | { k: 'for'; init: Expr | null; cond: Expr | null; incr: Expr | null; body: Stmt }
  | { k: 'break' }
  | { k: 'continue' }
  | { k: 'return'; e: Expr | null }
  | { k: 'quit' }
  | { k: 'define'; name: string; params: string[]; body: Stmt[] }

type Expr =
  | { k: 'num'; raw: string }
  | { k: 'var'; name: string }
  | { k: 'assign'; name: string; e: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr }
  | { k: 'un'; op: string; a: Expr }
  | { k: 'post'; op: string; name: string }
  | { k: 'pre'; op: string; name: string }
  | { k: 'call'; name: string; args: Expr[] }

class Parser {
  private pos = 0
  constructor(private toks: Tok[]) {}

  private peek(off = 0): Tok { return this.toks[this.pos + off] ?? { t: 'eof', v: '' } }
  private next(): Tok { return this.toks[this.pos++] ?? { t: 'eof', v: '' } }
  private is(v: string): boolean { return this.peek().v === v }
  private eat(v: string): boolean { if (this.is(v)) { this.next(); return true } return false }

  skipSep(): void {
    while (this.is('\n') || this.is(';')) this.next()
  }

  parseProgram(): Stmt[] {
    const list: Stmt[] = []
    this.skipSep()
    while (this.peek().t !== 'eof') {
      list.push(this.parseStmt())
      this.skipSep()
    }
    return list
  }

  parseStmt(): Stmt {
    this.skipSep()
    const t = this.peek()
    if (t.v === '{') {
      this.next()
      const list: Stmt[] = []
      this.skipSep()
      while (!this.is('}') && this.peek().t !== 'eof') {
        list.push(this.parseStmt())
        this.skipSep()
      }
      this.eat('}')
      return { k: 'block', list }
    }
    if (t.v === 'if') {
      this.next()
      this.expectOp('(')
      const cond = this.parseExpr()
      this.expectOp(')')
      const then = this.parseStmt()
      let els: Stmt | null = null
      if (this.is('else')) { this.next(); els = this.parseStmt() }
      return { k: 'if', cond, then, els }
    }
    if (t.v === 'while') {
      this.next()
      this.expectOp('(')
      const cond = this.parseExpr()
      this.expectOp(')')
      const body = this.parseStmt()
      return { k: 'while', cond, body }
    }
    if (t.v === 'for') {
      this.next()
      this.expectOp('(')
      const init = this.is(';') ? null : this.parseExpr()
      this.expectOp(';')
      const cond = this.is(';') ? null : this.parseExpr()
      this.expectOp(';')
      const incr = this.is(')') ? null : this.parseExpr()
      this.expectOp(')')
      const body = this.parseStmt()
      return { k: 'for', init, cond, incr, body }
    }
    if (t.v === 'define') {
      this.next()
      const name = this.next()
      if (name.t !== 'name') throw new BcError('bad function name')
      this.expectOp('(')
      const params: string[] = []
      if (!this.is(')')) {
        for (;;) {
          const p = this.next()
          if (p.t !== 'name') throw new BcError('bad parameter')
          params.push(p.v)
          if (!this.eat(',')) break
        }
      }
      this.expectOp(')')
      this.expectOp('{')
      const body: Stmt[] = []
      this.skipSep()
      while (!this.is('}') && this.peek().t !== 'eof') {
        body.push(this.parseStmt())
        this.skipSep()
      }
      this.expectOp('}')
      return { k: 'define', name: name.v, params, body }
    }
    if (t.v === 'break') { this.next(); return { k: 'break' } }
    if (t.v === 'continue') { this.next(); return { k: 'continue' } }
    if (t.v === 'quit' || t.v === 'halt') { this.next(); return { k: 'quit' } }
    if (t.v === 'return') {
      this.next()
      const e = this.is('\n') || this.is(';') || this.is('}') || this.peek().t === 'eof' ? null : this.parseExpr()
      return { k: 'return', e }
    }
    const { e, isAssign } = this.parseExprWithAssignFlag()
    return { k: 'expr', e, isAssign }
  }

  private expectOp(v: string): void {
    if (!this.eat(v)) throw new BcError(`expected '${v}'`)
  }

  parseExprWithAssignFlag(): { e: Expr; isAssign: boolean } {
    return this.parseAssign()
  }

  parseExpr(): Expr {
    return this.parseAssign().e
  }

  private parseAssign(): { e: Expr; isAssign: boolean } {
    const left = this.parseOr()
    if (this.is('=')) {
      this.next()
      const right = this.parseAssign()
      if (left.k !== 'var') throw new BcError('bad assignment target')
      return { e: { k: 'assign', name: left.name, e: right.e }, isAssign: true }
    }
    return { e: left, isAssign: false }
  }

  private parseOr(): Expr {
    let a = this.parseAnd()
    while (this.is('||')) {
      this.next()
      a = { k: 'bin', op: '||', a, b: this.parseAnd() }
    }
    return a
  }

  private parseAnd(): Expr {
    let a = this.parseRel()
    while (this.is('&&')) {
      this.next()
      a = { k: 'bin', op: '&&', a, b: this.parseRel() }
    }
    return a
  }

  private parseRel(): Expr {
    let a = this.parseAdd()
    for (;;) {
      const op = this.peek().v
      if (op === '==' || op === '!=' || op === '<' || op === '<=' || op === '>' || op === '>=') {
        this.next()
        a = { k: 'bin', op, a, b: this.parseAdd() }
      } else break
    }
    return a
  }

  private parseAdd(): Expr {
    let a = this.parseMul()
    for (;;) {
      const op = this.peek().v
      if (op === '+' || op === '-') {
        this.next()
        a = { k: 'bin', op, a, b: this.parseMul() }
      } else break
    }
    return a
  }

  private parseMul(): Expr {
    let a = this.parseUnary()
    for (;;) {
      const op = this.peek().v
      if (op === '*' || op === '/' || op === '%') {
        this.next()
        a = { k: 'bin', op, a, b: this.parseUnary() }
      } else break
    }
    return a
  }

  private parseUnary(): Expr {
    const op = this.peek().v
    if (op === '-' || op === '!') {
      this.next()
      return { k: 'un', op, a: this.parseUnary() }
    }
    if (op === '++' || op === '--') {
      this.next()
      const t = this.next()
      if (t.t !== 'name') throw new BcError('bad increment target')
      return { k: 'pre', op, name: t.v }
    }
    return this.parsePow()
  }

  private parsePow(): Expr {
    const a = this.parseAtom()
    if (this.is('^')) {
      this.next()
      return { k: 'bin', op: '^', a, b: this.parseUnary() }
    }
    if (this.is('++') || this.is('--')) {
      const op = this.next().v
      if (a.k !== 'var') throw new BcError('bad increment target')
      return { k: 'post', op, name: a.name }
    }
    return a
  }

  private parseAtom(): Expr {
    const t = this.peek()
    if (t.t === 'num') { this.next(); return { k: 'num', raw: t.v } }
    if (t.t === 'name') {
      this.next()
      if (this.is('(')) {
        this.next()
        const args: Expr[] = []
        if (!this.is(')')) {
          for (;;) {
            args.push(this.parseExpr())
            if (!this.eat(',')) break
          }
        }
        this.expectOp(')')
        return { k: 'call', name: t.v, args }
      }
      return { k: 'var', name: t.v }
    }
    if (this.is('(')) {
      this.next()
      const e = this.parseExpr()
      this.expectOp(')')
      return e
    }
    throw new BcError(`unexpected '${t.v}'`)
  }
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }
    if (c === '#' && (i === 0 || src[i - 1] === '\n' || src[i - 1] === ' ' || src[i - 1] === '\t')) {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i = Math.min(i + 2, src.length)
      continue
    }
    if (c === '\n') { toks.push({ t: 'sep', v: '\n' }); i++; continue }
    if (c === ';') { toks.push({ t: 'sep', v: ';' }); i++; continue }
    if (/[a-zA-Z]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      const word = src.slice(i, j)
      // Single lowercase letters are variable names; keywords are names too.
      // Longer letter runs are numbers in the current ibase (e.g. FF in hex).
      if (KEYWORDS.has(word) || (word.length === 1 && word >= 'a' && word <= 'z')) {
        toks.push({ t: 'name', v: word })
      } else {
        toks.push({ t: 'num', v: word })
      }
      i = j
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9A-Fa-f.]/.test(src[j])) j++
      toks.push({ t: 'num', v: src.slice(i, j) })
      i = j
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||' || two === '++' || two === '--') {
      toks.push({ t: 'op', v: two })
      i += 2
      continue
    }
    if ('+-*/%^=<>!(){};,|&'.includes(c)) {
      toks.push({ t: 'op', v: c })
      i++
      continue
    }
    throw new BcError(`unexpected character '${c}'`)
  }
  toks.push({ t: 'eof', v: '' })
  return toks
}

interface Ctrl { quit: boolean; isBreak: boolean; isContinue: boolean; isReturn: boolean }

class Interpreter {
  vars = new Map<string, BcNum>([['scale', { neg: false, d: 0n, s: 0 }], ['ibase', { neg: false, d: 10n, s: 0 }], ['obase', { neg: false, d: 10n, s: 0 }]])
  funcs = new Map<string, FuncDef>()
  private callStack: Map<string, BcNum>[] = []
  private outLines: string[] = []
  private aborted = false

  constructor(private opts: BcOptions, private signal?: AbortSignal) {
    if (opts.mathlib) this.vars.set('scale', { neg: false, d: 20n, s: 0 })
  }

  get output(): string { return this.outLines.join('\n') }

  private isAborted(): boolean {
    if (this.signal?.aborted) {
      this.aborted = true
      return true
    }
    return false
  }

  private scope(): Map<string, BcNum> {
    return this.callStack.length > 0 ? this.callStack[this.callStack.length - 1] : this.vars
  }

  private getVar(name: string): BcNum {
    if (name === 'scale' || name === 'ibase' || name === 'obase') return this.vars.get(name)!
    const sc = this.scope()
    const v = sc.get(name)
    if (v) return v
    return { neg: false, d: 0n, s: 0 }
  }

  private setVar(name: string, val: BcNum): void {
    if (name === 'scale') {
      if (val.neg || val.d > 1000n) throw new BcError('bad scale')
      this.vars.set('scale', { neg: false, d: val.d, s: 0 })
      return
    }
    if (name === 'ibase') {
      if (val.neg || val.d < 2n || val.d > 16n) throw new BcError('input base must be between 2 and 16')
      this.vars.set('ibase', { neg: false, d: val.d, s: 0 })
      return
    }
    if (name === 'obase') {
      if (val.neg || val.d < 2n || val.d > 16n) throw new BcError('output base must be between 2 and 16')
      this.vars.set('obase', { neg: false, d: val.d, s: 0 })
      return
    }
    this.scope().set(name, val)
  }

  errText = ''

  run(program: Stmt[]): number {
    try {
      this.execList(program)
    } catch (e) {
      if (e instanceof BcError) {
        this.errText = `Runtime error (func=(main), ad=1): ${e.message}`
        return 1
      }
      throw e
    }
    return this.aborted ? 130 : 0
  }

  private execList(list: Stmt[]): Ctrl {
    for (const st of list) {
      if (this.isAborted()) return { quit: true, isBreak: false, isContinue: false, isReturn: false }
      const r = this.execStmt(st)
      if (r.quit || r.isBreak || r.isContinue || r.isReturn) return r
    }
    return { quit: false, isBreak: false, isContinue: false, isReturn: false }
  }

  private execStmt(st: Stmt): Ctrl {
    const none = (): Ctrl => ({ quit: false, isBreak: false, isContinue: false, isReturn: false })
    switch (st.k) {
      case 'expr': {
        const v = this.evalExpr(st.e)
        if (!st.isAssign) this.outLines.push(wrapBcOutput(formatBcNum(v, this.getIbaseSafe('obase'))))
        return none()
      }
      case 'block':
        return this.execList(st.list)
      case 'if': {
        const c = this.truthy(st.cond)
        if (c) return this.execStmt(st.then)
        if (st.els) return this.execStmt(st.els)
        return none()
      }
      case 'while': {
        while (this.truthy(st.cond)) {
          if (this.isAborted()) return { quit: true, isBreak: false, isContinue: false, isReturn: false }
          const r = this.execStmt(st.body)
          if (r.quit || r.isReturn) return r
          if (r.isBreak) break
        }
        return none()
      }
      case 'for': {
        if (st.init) this.evalExpr(st.init)
        for (;;) {
          if (st.cond && !this.truthy(st.cond)) break
          if (this.isAborted()) return { quit: true, isBreak: false, isContinue: false, isReturn: false }
          const r = this.execStmt(st.body)
          if (r.quit || r.isReturn) return r
          if (r.isBreak) break
          if (st.incr) this.evalExpr(st.incr)
        }
        return none()
      }
      case 'break':
        return { quit: false, isBreak: true, isContinue: false, isReturn: false }
      case 'continue':
        return { quit: false, isBreak: false, isContinue: true, isReturn: false }
      case 'return': {
        const v = st.e ? this.evalExpr(st.e) : { neg: false, d: 0n, s: 0 }
        if (this.callStack.length === 0) throw new BcError('return outside function')
        this.callStack[this.callStack.length - 1].set('__ret__', v)
        return { quit: false, isBreak: false, isContinue: false, isReturn: true }
      }
      case 'quit':
        return { quit: true, isBreak: false, isContinue: false, isReturn: false }
      case 'define':
        this.funcs.set(st.name, { params: st.params, body: st.body })
        return none()
    }
  }

  private getIbaseSafe(which: string): number {
    return Number(this.vars.get(which)!.d)
  }

  private truthy(e: Expr): boolean {
    const v = this.evalExpr(e)
    return v.d !== 0n
  }

  evalExpr(e: Expr): BcNum {
    switch (e.k) {
      case 'num': {
        const ibase = this.getIbaseSafe('ibase')
        return parseBcNumber(e.raw, ibase)
      }
      case 'var':
        return this.getVar(e.name)
      case 'assign': {
        const v = this.evalExpr(e.e)
        this.setVar(e.name, v)
        return v
      }
      case 'bin': {
        const scale = this.getIbaseSafe('scale')
        if (e.op === '=') { const v = this.evalExpr(e.b); if (e.a.k !== 'var') throw new BcError('bad assignment'); this.setVar(e.a.name, v); return v }
        const a = this.evalExpr(e.a)
        const b = this.evalExpr(e.b)
        switch (e.op) {
          case '+': return numAdd(a, b, scale)
          case '-': return numSub(a, b, scale)
          case '*': return numMul(a, b, scale)
          case '/': return numDiv(a, b, scale)
          case '%': return numMod(a, b, scale)
          case '^': return numPow(a, b, scale)
          case '==': return this.bool(a, b, (x, y) => x === y)
          case '!=': return this.bool(a, b, (x, y) => x !== y)
          case '<': return this.bool(a, b, (x, y) => x < y)
          case '<=': return this.bool(a, b, (x, y) => x <= y)
          case '>': return this.bool(a, b, (x, y) => x > y)
          case '>=': return this.bool(a, b, (x, y) => x >= y)
          case '&&': return this.makeBool(!(a.d === 0n) && !(b.d === 0n))
          case '||': return this.makeBool(!(a.d === 0n) || !(b.d === 0n))
          default: throw new BcError(`unknown operator ${e.op}`)
        }
      }
      case 'un': {
        const a = this.evalExpr(e.a)
        if (e.op === '!') return this.makeBool(a.d === 0n)
        return { neg: !a.neg, d: a.d, s: a.s }
      }
      case 'post': {
        const v = this.getVar(e.name)
        const one: BcNum = { neg: e.op === '--', d: 1n, s: 0 }
        this.setVar(e.name, numAdd(v, one, v.s))
        return v
      }
      case 'pre': {
        const v = this.getVar(e.name)
        const one: BcNum = { neg: e.op === '--', d: 1n, s: 0 }
        const nv = numAdd(v, one, v.s)
        this.setVar(e.name, nv)
        return nv
      }
      case 'call':
        return this.call(e.name, e.args)
    }
  }

  private bool(a: BcNum, b: BcNum, cmp: (x: number, y: number) => boolean): BcNum {
    return this.makeBool(cmp(this.toNum(a), this.toNum(b)))
  }

  private toNum(a: BcNum): number {
    return Number(a.d) / 10 ** a.s * (a.neg ? -1 : 1)
  }

  private makeBool(b: boolean): BcNum {
    return { neg: false, d: b ? 1n : 0n, s: 0 }
  }

  private call(name: string, args: Expr[]): BcNum {
    const scale = this.getIbaseSafe('scale')
    const ev = (i: number) => this.evalExpr(args[i])
    const one = () => {
      if (args.length !== 1) throw new BcError(`function ${name} takes 1 argument`)
      return ev(0)
    }
    if (name === 'sqrt') return numSqrt(one(), scale)
    if (name === 'length') return numLength(one())
    if (name === 'scale') return numScale(one())
    if (name === 's' || name === 'c' || name === 'a' || name === 'l' || name === 'e') {
      if (!this.opts.mathlib) throw new BcError(`function ${name} not defined`)
      return this.mathFn(name, one(), scale)
    }
    const fn = this.funcs.get(name)
    if (!fn) throw new BcError(`function ${name} not defined`)
    if (fn.params.length !== args.length) throw new BcError(`function ${name} expects ${fn.params.length} arguments`)
    const scope = new Map<string, BcNum>()
    fn.params.forEach((p, i) => scope.set(p, this.evalExpr(args[i])))
    scope.set('__ret__', { neg: false, d: 0n, s: 0 })
    this.callStack.push(scope)
    const r = this.execList(fn.body)
    const ret = scope.get('__ret__')!
    this.callStack.pop()
    if (r.quit) throw new BcError('quit in function')
    return ret
  }

  private mathFn(name: string, x: BcNum, scale: number): BcNum {
    const v = this.toNum(x)
    let r: number
    switch (name) {
      case 's': r = Math.sin(v); break
      case 'c': r = Math.cos(v); break
      case 'a': r = Math.atan(v); break
      case 'l': if (v <= 0) throw new BcError('logarithm of non-positive number'); r = Math.log(v); break
      case 'e': r = Math.exp(v); break
      default: throw new BcError(`function ${name} not defined`)
    }
    // Truncate toward zero to `scale` digits (bc semantics).
    const scaled = Math.trunc(r * 10 ** scale)
    return { neg: scaled < 0, d: BigInt(Math.abs(scaled)), s: scale }
  }
}

export interface BcResult { status: number; out: string; err: string }

/** Interpret a whole bc program; returns stdout text and status. */
export function runBc(program: string, opts: BcOptions, signal?: AbortSignal): BcResult {
  let toks: Tok[]
  try {
    toks = tokenize(program)
  } catch (e) {
    return { status: 1, out: '', err: e instanceof BcError ? `bc: ${e.message}\n` : `bc: ${String(e)}\n` }
  }
  const parser = new Parser(toks)
  let ast: Stmt[]
  try {
    ast = parser.parseProgram()
  } catch (e) {
    return { status: 1, out: '', err: e instanceof BcError ? `bc: parse error: ${e.message}\n` : `bc: parse error\n` }
  }
  const interp = new Interpreter(opts, signal)
  const status = interp.run(ast)
  return { status, out: interp.output.length > 0 ? interp.output + '\n' : '', err: interp.errText ? interp.errText + '\n' : '' }
}
