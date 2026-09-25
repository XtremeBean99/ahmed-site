// expr: arithmetic + string expression evaluator (GNU expr subset).
import { compilePosix } from '../regex'

type EVal = { t: 'n'; v: number } | { t: 's'; v: string }

interface Tok {
  raw: string
  k: 'num' | 'op' | 'kw' | 'str'
  num?: number
}

const OPS = new Set(['|', '&', '<', '<=', '=', '==', '!=', '>=', '>', '+', '-', '*', '/', '%', ':', '(', ')'])
const KWS = new Set(['length', 'substr', 'index', 'match'])

class ExprError extends Error {}

function tokenize(args: string[]): Tok[] {
  const toks: Tok[] = []
  for (const raw of args) {
    if (/^[+-]?[0-9]+$/.test(raw)) toks.push({ raw, k: 'num', num: parseInt(raw, 10) })
    else if (OPS.has(raw)) toks.push({ raw, k: 'op' })
    else if (KWS.has(raw)) toks.push({ raw, k: 'kw' })
    else toks.push({ raw, k: 'str' })
  }
  toks.push({ raw: '', k: 'op' })
  return toks
}

function truthy(v: EVal): boolean {
  return v.t === 'n' ? v.v !== 0 : v.v !== ''
}

function valToString(v: EVal): string {
  return v.t === 'n' ? String(v.v) : v.v
}

function toNum(v: EVal): number {
  if (v.t === 'n') return v.v
  if (/^[+-]?[0-9]+$/.test(v.v)) return parseInt(v.v, 10)
  throw new ExprError('non-integer argument')
}

export function runExpr(args: string[]): { status: number; out: string; err: string } {
  if (args.length === 0) return { status: 2, out: '', err: 'expr: missing operand\n' }
  let toks: Tok[]
  try {
    toks = tokenize(args)
  } catch {
    return { status: 2, out: '', err: 'expr: syntax error\n' }
  }
  const p = new Parser(toks)
  let val: EVal
  try {
    val = p.parse()
    if (p.pos < toks.length - 1) {
      throw new ExprError(`unexpected argument '${p.peek().raw}'`)
    }
  } catch (e) {
    if (e instanceof ExprError) {
      const m = /^unexpected argument/.test(e.message) ? e.message : ''
      if (m) return { status: 2, out: '', err: `expr: syntax error: ${m}\n` }
      if (e.message === 'non-integer argument') return { status: 2, out: '', err: `expr: ${e.message}\n` }
      if (e.message === 'division by zero') return { status: 2, out: '', err: `expr: ${e.message}\n` }
      return { status: 2, out: '', err: `expr: syntax error\n` }
    }
    return { status: 2, out: '', err: 'expr: syntax error\n' }
  }
  const s = valToString(val)
  return { status: truthy(val) ? 0 : 1, out: s + '\n', err: '' }
}

class Parser {
  pos = 0
  constructor(private toks: Tok[]) {}

  peek(): Tok { return this.toks[this.pos] }
  next(): Tok { return this.toks[this.pos++] }

  parse(): EVal {
    return this.parseOr()
  }

  private parseOr(): EVal {
    let a = this.parseAnd()
    while (this.peek().k === 'op' && this.peek().raw === '|') {
      this.next()
      const b = this.parseAnd()
      a = truthy(a) ? a : b
    }
    return a
  }

  private parseAnd(): EVal {
    let a = this.parseCmp()
    while (this.peek().k === 'op' && this.peek().raw === '&') {
      this.next()
      const b = this.parseCmp()
      a = truthy(a) && truthy(b) ? a : { t: 'n', v: 0 }
    }
    return a
  }

  private parseCmp(): EVal {
    const a = this.parseAdd()
    const op = this.peek().raw
    if (['<', '<=', '=', '==', '!=', '>=', '>'].includes(op) && this.peek().k === 'op') {
      this.next()
      const b = this.parseAdd()
      const r = cmp(a, b, op === '=' ? '==' : op)
      return { t: 'n', v: r ? 1 : 0 }
    }
    return a
  }

  private parseAdd(): EVal {
    let a = this.parseMul()
    for (;;) {
      const op = this.peek().raw
      if ((op === '+' || op === '-') && this.peek().k === 'op') {
        this.next()
        const b = this.parseMul()
        const x = toNum(a)
        const y = toNum(b)
        a = { t: 'n', v: op === '+' ? x + y : x - y }
      } else break
    }
    return a
  }

  private parseMul(): EVal {
    let a = this.parseMatch()
    for (;;) {
      const op = this.peek().raw
      if ((op === '*' || op === '/' || op === '%') && this.peek().k === 'op') {
        this.next()
        const b = this.parseMatch()
        const x = toNum(a)
        const y = toNum(b)
        if (y === 0) throw new ExprError('division by zero')
        a = { t: 'n', v: op === '*' ? x * y : op === '/' ? Math.trunc(x / y) : x % y }
      } else break
    }
    return a
  }

  private parseMatch(): EVal {
    let a = this.parseUnary()
    while (this.peek().k === 'op' && this.peek().raw === ':') {
      this.next()
      const b = this.parseUnary()
      a = matchVal(valToString(a), valToString(b))
    }
    return a
  }

  private parseUnary(): EVal {
    if (this.peek().k === 'op' && this.peek().raw === '+') {
      this.next()
      const v = this.parseUnary()
      return { t: 's', v: valToString(v) }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): EVal {
    const t = this.peek()
    if (t.k === 'num') { this.next(); return { t: 'n', v: t.num ?? 0 } }
    if (t.k === 'str') { this.next(); return { t: 's', v: t.raw } }
    if (t.k === 'op' && t.raw === '(') {
      this.next()
      const v = this.parse()
      if (this.peek().k === 'op' && this.peek().raw === ')') this.next()
      else throw new ExprError(`unexpected argument '${this.peek().raw}'`)
      return v
    }
    if (t.k === 'kw') {
      this.next()
      const operand = (): EVal => {
        const n = this.next()
        if (n.k === 'op' && n.raw === '') throw new ExprError(`unexpected argument '${t.raw}'`)
        if (n.k === 'op' && (n.raw === '(' || n.raw === ')')) throw new ExprError(`unexpected argument '${n.raw}'`)
        if (n.k === 'kw') { this.pos--; throw new ExprError(`unexpected argument '${n.raw}'`) }
        if (n.k === 'op' && n.raw === '+') { const s = this.next(); return { t: 's', v: s.raw } }
        return n.k === 'num' ? { t: 'n', v: n.num ?? 0 } : { t: 's', v: n.raw }
      }
      if (t.raw === 'length') return { t: 'n', v: valToString(operand()).length }
      if (t.raw === 'substr') {
        const s = valToString(operand())
        const pos = toNum(operand())
        const len = toNum(operand())
        if (pos < 1 || len < 1) return { t: 's', v: '' }
        return { t: 's', v: s.slice(pos - 1, pos - 1 + len) }
      }
      if (t.raw === 'index') {
        const s = valToString(operand())
        const chars = valToString(operand())
        for (let i = 0; i < s.length; i++) {
          if (chars.includes(s[i])) return { t: 'n', v: i + 1 }
        }
        return { t: 'n', v: 0 }
      }
      if (t.raw === 'match') {
        const s = valToString(operand())
        const re = valToString(operand())
        return matchVal(s, re)
      }
    }
    throw new ExprError(`unexpected argument '${t.raw}'`)
  }
}

function cmp(a: EVal, b: EVal, op: string): boolean {
  if (a.t === 'n' && b.t === 'n') {
    const x = a.v
    const y = b.v
    return op === '<' ? x < y : op === '<=' ? x <= y : op === '==' ? x === y : op === '!=' ? x !== y : op === '>=' ? x >= y : x > y
  }
  const x = valToString(a)
  const y = valToString(b)
  return op === '<' ? x < y : op === '<=' ? x <= y : op === '==' ? x === y : op === '!=' ? x !== y : op === '>=' ? x >= y : x > y
}

function matchVal(s: string, pattern: string): EVal {
  let re: RegExp
  try {
    re = compilePosix(pattern)
  } catch {
    throw new ExprError('syntax error')
  }
  const m = re.exec(s)
  if (!m || m.index !== 0) {
    // no match: 0, or the first (possibly empty) capture when the pattern has one
    return /\\\(/.test(pattern) ? { t: 's', v: '' } : { t: 'n', v: 0 }
  }
  if (/\\\(/.test(pattern)) return { t: 's', v: m[1] ?? '' }
  return { t: 'n', v: m[0].length }
}
