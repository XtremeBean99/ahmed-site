// Integer arithmetic evaluator for bash $(( )) and (( )). Pure: variable access goes through env callbacks.
export interface ArithEnv {
  get(name: string): string | undefined
  set(name: string, value: string): void
}

export class ArithError extends Error {}

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string; index?: Node }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'tern'; c: Node; a: Node; b: Node }
  | { k: 'assign'; op: string; lv: { name: string; index?: Node }; a: Node }
  | { k: 'pre'; op: '++' | '--'; lv: { name: string; index?: Node } }
  | { k: 'post'; op: '++' | '--'; lv: { name: string; index?: Node } }

const OPS2 = ['**', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']
const OPS1 = '+-*/%<>&|^!~?:=,()[]'

class Tok {
  constructor(public kind: 'num' | 'id' | 'op' | 'end', public s = '', public pos = 0) {}
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (/[0-9]/.test(c)) {
      const m = /^(0[xX][0-9a-fA-F]+|[0-9]+#[0-9a-zA-Z@_]+|0[0-7]*|[0-9]+)/.exec(src.slice(i))
      if (m) { toks.push(new Tok('num', m[0], i)); i += m[0].length; continue }
      toks.push(new Tok('num', c, i)); i++; continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      toks.push(new Tok('id', src.slice(i, j), i))
      i = j
      continue
    }
    const three = src.slice(i, i + 3)
    if (three === '<<=' || three === '>>=') { toks.push(new Tok('op', three, i)); i += 3; continue }
    const two = src.slice(i, i + 2)
    if (OPS2.includes(two)) { toks.push(new Tok('op', two, i)); i += 2; continue }
    if (OPS1.includes(c)) { toks.push(new Tok('op', c, i)); i++; continue }
    toks.push(new Tok('num', c, i)); i++ // unknown char: treat as number 0 (forgiving)
  }
  toks.push(new Tok('end', '', src.length))
  return toks
}

function parseNum(s: string): number {
  if (/^0[xX]/.test(s)) return parseInt(s.slice(2), 16)
  const hash = s.indexOf('#')
  if (hash > 0) {
    const base = Number(s.slice(0, hash))
    if (base >= 2 && base <= 64) {
      let v = 0
      for (const ch of s.slice(hash + 1)) {
        let d: number
        if (ch >= '0' && ch <= '9') d = ch.charCodeAt(0) - 48
        else if (ch >= 'a' && ch <= 'z') d = ch.charCodeAt(0) - 87
        else if (ch >= 'A' && ch <= 'Z') d = ch.charCodeAt(0) - 55
        else if (ch === '@') d = 62
        else if (ch === '_') d = 63
        else d = 0
        if (d >= base) return 0
        v = v * base + d
      }
      return v
    }
    return 0
  }
  if (/^0[0-7]+$/.test(s)) return parseInt(s, 8)
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Math.trunc(n)
}

const PREC: Record<string, number> = {
  ',': 1, '=': 2, '+=': 2, '-=': 2, '*=': 2, '/=': 2, '%=': 2, '<<=': 2, '>>=': 2, '&=': 2, '|=': 2, '^=': 2,
  '?': 3, '||': 4, '&&': 5, '|': 6, '^': 7, '&': 8, '==': 9, '!=': 9, '<': 10, '<=': 10, '>': 10, '>=': 10,
  '<<': 11, '>>': 11, '+': 12, '-': 12, '*': 13, '/': 13, '%': 13, '**': 14,
}
const ASSIGN_OPS = ['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^=']

export function evalArith(src: string, env: ArithEnv): number {
  const toks = tokenize(src)
  let p = 0
  const peek = () => toks[p]
  const next = () => toks[p++]
  const err = (msg: string, pos = peek().pos): never => {
    let near = src.slice(pos, pos + 20)
    if (near.length === 0) near = src.slice(Math.max(0, pos - 10), Math.max(0, pos - 10) + 20)
    throw new ArithError(`${msg} (error token is "${near}")`)
  }

  function parseExpr(minPrec: number): Node {
    let left = parseUnary()
    for (;;) {
      const t = peek()
      if (t.kind !== 'op') break
      const prec = PREC[t.s]
      if (prec === undefined || prec < minPrec) break
      if (t.s === '?') {
        next()
        const a = parseExpr(0)
        if (peek().s !== ':') err('syntax error: expected `:\'', t.pos)
        next()
        const b = parseExpr(0)
        left = { k: 'tern', c: left, a, b }
        continue
      }
      if (ASSIGN_OPS.includes(t.s)) {
        next()
        if (left.k !== 'var') err('syntax error: assignment to non-variable', t.pos)
        const lv = left as Extract<Node, { k: 'var' }>
        const rhs = parseExpr(2)
        left = { k: 'assign', op: t.s, lv: { name: lv.name, index: lv.index }, a: rhs }
        continue
      }
      next()
      const right = parseExpr(t.s === '**' ? prec : prec + 1)
      left = { k: 'bin', op: t.s, a: left, b: right }
    }
    return left
  }

  function parseUnary(): Node {
    const t = peek()
    if (t.kind === 'op') {
      if (t.s === '-' || t.s === '+' || t.s === '!' || t.s === '~') {
        next()
        // unary binds looser than ** so -2**2 is -(2**2)
        return { k: 'un', op: t.s, a: parseExpr(PREC['**']) }
      }
      if (t.s === '++' || t.s === '--') {
        next()
        const lv = parseLValue()
        return { k: 'pre', op: t.s, lv }
      }
    }
    return parsePostfix()
  }

  function parsePostfix(): Node {
    let n = parsePrimary()
    for (;;) {
      const t = peek()
      if (t.s === '[') {
        if (n.k !== 'var') err('syntax error: subscript on non-variable', t.pos)
        const v = n as Extract<Node, { k: 'var' }>
        next()
        const idx = parseExpr(0)
        if (peek().s !== ']') err('syntax error: expected `]\'', t.pos)
        next()
        n = { k: 'var', name: v.name, index: idx }
        continue
      }
      if (t.s === '++' || t.s === '--') {
        if (n.k !== 'var') err('syntax error: operand expected', t.pos)
        const v = n as Extract<Node, { k: 'var' }>
        next()
        n = { k: 'post', op: t.s, lv: { name: v.name, index: v.index } }
        continue
      }
      break
    }
    return n
  }

  function parseLValue(): { name: string; index?: Node } {
    const t = next()
    if (t.kind !== 'id') err('syntax error: operand expected', t.pos)
    const lv: { name: string; index?: Node } = { name: t.s }
    if (peek().s === '[') {
      next()
      const idx = parseExpr(0)
      if (peek().s !== ']') err('syntax error: expected `]\'', t.pos)
      next()
      lv.index = idx
    }
    return lv
  }

  function parsePrimary(): Node {
    const t = next()
    if (t.kind === 'num') return { k: 'num', v: parseNum(t.s) }
    if (t.kind === 'id') return { k: 'var', name: t.s }
    if (t.kind === 'op' && t.s === '(') {
      const e = parseExpr(0)
      if (peek().s !== ')') err('syntax error: expected `)\'', t.pos)
      next()
      return e
    }
    if (t.kind === 'end') err('syntax error: unexpected end of expression', t.pos)
    err('syntax error: operand expected', t.pos)
    return { k: 'num', v: 0 }
  }

  // ---- evaluation ----
  function splitArrayValue(v: string): string[] {
    if (v.includes('[')) {
      const out: string[] = []
      const re = /\[(\d+)\]=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g
      let m: RegExpExecArray | null
      while ((m = re.exec(v))) {
        const idx = Number(m[1])
        out[idx] = m[2] ?? m[3] ?? m[4]
      }
      return out
    }
    return v.split(' ')
  }

  function lvGet(lv: { name: string; index?: Node }): number {
    const raw = env.get(lv.name)
    if (lv.index === undefined) return raw === undefined || raw === '' ? 0 : parseNum(raw)
    const parts = raw === undefined ? [] : splitArrayValue(raw)
    const i = Math.trunc(evalNode(lv.index))
    return i >= 0 && i < parts.length ? parseNum(parts[i] ?? '0') : 0
  }
  function lvSet(lv: { name: string; index?: Node }, v: number): number {
    const n = Math.trunc(v)
    if (lv.index === undefined) {
      env.set(lv.name, String(n))
      return n
    }
    const i = Math.trunc(evalNode(lv.index))
    if (i < 0) return 0
    const raw = env.get(lv.name)
    const parts = raw === undefined ? [] : splitArrayValue(raw)
    while (parts.length <= i) parts.push('0')
    parts[i] = String(n)
    env.set(lv.name, parts.join(' '))
    return n
  }

  function applyAssign(lv: { name: string; index?: Node }, op: string, rhs: number): number {
    const cur = lvGet(lv)
    let v: number
    switch (op) {
      case '=': v = rhs; break
      case '+=': v = cur + rhs; break
      case '-=': v = cur - rhs; break
      case '*=': v = cur * rhs; break
      case '/=': if (rhs === 0) err('division by 0'); v = Math.trunc(cur / rhs); break
      case '%=': if (rhs === 0) err('division by 0'); v = cur % rhs; break
      case '<<=': v = cur << rhs; break
      case '>>=': v = cur >> rhs; break
      case '&=': v = cur & rhs; break
      case '|=': v = cur | rhs; break
      case '^=': v = cur ^ rhs; break
      default: v = rhs
    }
    return lvSet(lv, v)
  }

  function evalNode(n: Node): number {
    switch (n.k) {
      case 'num': return n.v
      case 'var': return lvGet({ name: n.name, index: n.index })
      case 'un': {
        const v = evalNode(n.a)
        switch (n.op) {
          case '-': return -v
          case '+': return v
          case '!': return v === 0 ? 1 : 0
          case '~': return ~v
          default: return v
        }
      }
      case 'bin': {
        const a = evalNode(n.a)
        if (n.op === '&&') return (a !== 0 && evalNode(n.b) !== 0) ? 1 : 0
        if (n.op === '||') return (a !== 0 || evalNode(n.b) !== 0) ? 1 : 0
        const b = evalNode(n.b)
        switch (n.op) {
          case '+': return a + b
          case '-': return a - b
          case '*': return a * b
          case '/': if (b === 0) err('division by 0'); return Math.trunc(a / b)
          case '%': if (b === 0) err('division by 0'); return a % b
          case '**': return Math.trunc(Math.pow(a, b))
          case '<<': return a << b
          case '>>': return a >> b
          case '<': return a < b ? 1 : 0
          case '<=': return a <= b ? 1 : 0
          case '>': return a > b ? 1 : 0
          case '>=': return a >= b ? 1 : 0
          case '==': return a === b ? 1 : 0
          case '!=': return a !== b ? 1 : 0
          case '&': return a & b
          case '^': return a ^ b
          case '|': return a | b
          case ',': return b
          default: return b
        }
      }
      case 'tern': return evalNode(n.c) !== 0 ? evalNode(n.a) : evalNode(n.b)
      case 'assign': return applyAssign(n.lv, n.op, evalNode(n.a))
      case 'pre': case 'post': {
        const cur = lvGet(n.lv)
        const delta = n.op === '++' ? 1 : -1
        lvSet(n.lv, cur + delta)
        return n.k === 'pre' ? cur + delta : cur
      }
    }
  }

  const result = evalNode(parseExpr(0))
  if (peek().kind !== 'end') err('syntax error: operand expected', peek().pos)
  return Math.trunc(result)
}
