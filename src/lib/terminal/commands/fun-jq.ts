// jq: a small but real subset of the jq filter language.
// Filters are evaluated against a single input value and produce an ordered stream of outputs.

export type JqVal = null | boolean | number | string | JqVal[] | JqObject
export interface JqObject { [key: string]: JqVal }

type Filter =
  | { k: 'ident' }
  | { k: 'field'; name: string; parent: Filter }
  | { k: 'index'; idx: Filter; parent: Filter }
  | { k: 'slice'; start: Filter | null; end: Filter | null; parent: Filter }
  | { k: 'iter'; parent: Filter }
  | { k: 'recurse' }
  | { k: 'pipe'; left: Filter; right: Filter }
  | { k: 'comma'; left: Filter; right: Filter }
  | { k: 'literal'; val: JqVal }
  | { k: 'var'; name: string }
  | { k: 'array'; f: Filter | null }
  | { k: 'object'; fields: { key: string; val: Filter }[] }
  | { k: 'string'; parts: (string | Filter)[] }
  | { k: 'if'; cond: Filter; then: Filter; elifs: { cond: Filter; then: Filter }[]; els: Filter | null }
  | { k: 'and'; a: Filter; b: Filter }
  | { k: 'or'; a: Filter; b: Filter }
  | { k: 'alt'; a: Filter; b: Filter }
  | { k: 'not'; a: Filter }
  | { k: 'neg'; a: Filter }
  | { k: 'cmp'; op: string; a: Filter; b: Filter }
  | { k: 'arith'; op: string; a: Filter; b: Filter }
  | { k: 'call'; name: string; args: Filter[] }

export interface JqOptions {
  raw: boolean
  compact: boolean
  exitStatus: boolean
  slurp: boolean
  nullInput: boolean
  sortKeys: boolean
  tab: boolean
  indent: number
}

interface JqCtx {
  env: Record<string, string>
  vars: Record<string, JqVal>
  signal?: AbortSignal
}

export class JqError extends Error {}
class ParseFail extends Error {}

// ---- value helpers ----------------------------------------------------------------------------------

export function jqType(v: JqVal): string {
  if (v === null) return 'null'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') return 'string'
  if (Array.isArray(v)) return 'array'
  return 'object'
}

function isObj(v: JqVal): v is JqObject { return typeof v === 'object' && v !== null && !Array.isArray(v) }
function isArr(v: JqVal): v is JqVal[] { return Array.isArray(v) }

function truthy(v: JqVal): boolean { return v !== false && v !== null }

export function jqNumString(n: number): string {
  if (Object.is(n, -0)) return '0'
  if (Number.isInteger(n) && Math.abs(n) <= 1e15) return String(n)
  if (Number.isFinite(n)) {
    if (Math.abs(n) >= 1e16 || (Math.abs(n) < 1e-6 && n !== 0)) {
      const e = n.toExponential(10).replace(/\.?0+e/, 'e')
      return e.replace(/e([+-])(\d)$/, 'e$10$2')
    }
    return String(n)
  }
  return 'null'
}

export function jqString(s: string): string {
  let out = '"'
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (ch === '"') out += '\\"'
    else if (ch === '\\') out += '\\\\'
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (ch === '\b') out += '\\b'
    else if (ch === '\f') out += '\\f'
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0')
    else out += ch
  }
  return out + '"'
}

function jqToString(v: JqVal): string {
  if (typeof v === 'string') return v
  if (v === null) return 'null'
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'number') return jqNumString(v)
  return jqCompact(v)
}

function jqCompact(v: JqVal): string {
  if (v === null) return 'null'
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'number') return jqNumString(v)
  if (typeof v === 'string') return jqString(v)
  if (Array.isArray(v)) return '[' + v.map(jqCompact).join(',') + ']'
  return '{' + Object.keys(v).map((k) => jqString(k) + ':' + jqCompact(v[k])).join(',') + '}'
}

export function jqPretty(v: JqVal, opts: { indent: string; sortKeys: boolean }): string {
  const walk = (x: JqVal, depth: number): string => {
    const pad = opts.indent.repeat(depth)
    const pad1 = opts.indent.repeat(depth + 1)
    if (x === null) return 'null'
    if (typeof x === 'boolean') return String(x)
    if (typeof x === 'number') return jqNumString(x)
    if (typeof x === 'string') return jqString(x)
    if (Array.isArray(x)) {
      if (x.length === 0) return '[]'
      return '[\n' + x.map((e) => pad1 + walk(e, depth + 1)).join(',\n') + '\n' + pad + ']'
    }
    const keys = opts.sortKeys ? Object.keys(x).sort() : Object.keys(x)
    if (keys.length === 0) return '{}'
    return '{\n' + keys.map((k) => `${pad1}${jqString(k)}: ${walk(x[k], depth + 1)}`).join(',\n') + '\n' + pad + '}'
  }
  return walk(v, 0)
}

export function jqCmp(a: JqVal, b: JqVal): number {
  const rank = (x: JqVal): number => (x === null ? 0 : typeof x === 'boolean' ? (x ? 2 : 1) : typeof x === 'number' ? 3 : typeof x === 'string' ? 4 : Array.isArray(x) ? 5 : 6)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const c = jqCmp(a[i], b[i])
      if (c !== 0) return c
    }
    return a.length - b.length
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).sort()
    const kb = Object.keys(b).sort()
    const n = Math.min(ka.length, kb.length)
    for (let i = 0; i < n; i++) {
      if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1
      const c = jqCmp(a[ka[i]], b[kb[i]])
      if (c !== 0) return c
    }
    return ka.length - kb.length
  }
  return 0
}

// ---- JSON input parsing ------------------------------------------------------------------------------

export function parseJsonStream(text: string): JqVal[] {
  const docs: JqVal[] = []
  let i = 0
  const skip = (): void => { while (i < text.length && /\s/.test(text[i])) i++ }
  const fail = (msg: string): never => { throw new JqError(msg) }
  function parseVal(): JqVal {
    skip()
    if (i >= text.length) fail('unexpected end of input')
    const c = text[i]
    if (c === '{') {
      i++
      const obj: JqObject = {}
      skip()
      if (text[i] === '}') { i++; return obj }
      for (;;) {
        skip()
        const key = parseStringRaw()
        skip()
        if (text[i] !== ':') fail('expected :')
        i++
        obj[key] = parseVal()
        skip()
        if (text[i] === ',') { i++; continue }
        if (text[i] === '}') { i++; return obj }
        fail('expected , or }')
      }
    }
    if (c === '[') {
      i++
      const arr: JqVal[] = []
      skip()
      if (text[i] === ']') { i++; return arr }
      for (;;) {
        arr.push(parseVal())
        skip()
        if (text[i] === ',') { i++; continue }
        if (text[i] === ']') { i++; return arr }
        fail('expected , or ]')
      }
    }
    if (c === '"') return parseStringRaw()
    if (c === 't' && text.startsWith('true', i)) { i += 4; return true }
    if (c === 'f' && text.startsWith('false', i)) { i += 5; return false }
    if (c === 'n' && text.startsWith('null', i)) { i += 4; return null }
    const m = /^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i))
    if (m) { i += m[0].length; return Number(m[0]) }
    fail(`unexpected character '${c}'`)
    return null
  }
  function parseStringRaw(): string {
    if (text[i] !== '"') fail('expected string')
    i++
    let out = ''
    for (;;) {
      if (i >= text.length) fail('unterminated string')
      const c = text[i]
      if (c === '"') { i++; return out }
      if (c === '\\') {
        const n = text[i + 1]
        if (n === 'u') {
          const hex = text.slice(i + 2, i + 6)
          out += String.fromCharCode(parseInt(hex, 16))
          i += 6
          continue
        }
        const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
        out += map[n] ?? n
        i += 2
        continue
      }
      out += c
      i++
    }
  }
  for (;;) {
    skip()
    if (i >= text.length) break
    docs.push(parseVal())
  }
  return docs
}

// ---- parser ------------------------------------------------------------------------------------------

class Parser {
  pos = 0
  constructor(private src: string) {}

  fail(msg: string): never {
    const tok = this.src.slice(this.pos, this.pos + 12) || 'end of input'
    throw new ParseFail(`syntax error, unexpected '${tok}'`)
  }

  skipWs(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++
  }

  peek(off = 0): string { return this.src[this.pos + off] ?? '' }

  eat(s: string): boolean {
    this.skipWs()
    if (this.src.startsWith(s, this.pos)) {
      this.pos += s.length
      return true
    }
    return false
  }

  expect(s: string): void {
    if (!this.eat(s)) this.fail(`expected '${s}'`)
  }

  isWord(w: string): boolean {
    this.skipWs()
    if (!this.src.startsWith(w, this.pos)) return false
    const after = this.src[this.pos + w.length] ?? ''
    return !/[a-zA-Z0-9_]/.test(after)
  }

  parseProgram(): Filter {
    this.skipWs()
    const f = this.parsePipe()
    this.skipWs()
    if (this.pos < this.src.length) this.fail('trailing input')
    return f
  }

  parsePipe(): Filter {
    let a = this.parseComma()
    while (this.eat('|')) a = { k: 'pipe', left: a, right: this.parseComma() }
    return a
  }

  parseComma(): Filter {
    let a = this.parseOr()
    while (this.eat(',')) a = { k: 'comma', left: a, right: this.parseOr() }
    return a
  }

  /** Pipe chain without the comma operator (used for object field values). */
  parsePipeLevel(): Filter {
    let a = this.parseOr()
    while (this.eat('|')) a = { k: 'pipe', left: a, right: this.parseOr() }
    return a
  }

  parseOr(): Filter {
    let a = this.parseAnd()
    while (this.isWord('or')) {
      this.pos += 2
      a = { k: 'or', a, b: this.parseAnd() }
    }
    return a
  }

  parseAnd(): Filter {
    let a = this.parseAlt()
    while (this.isWord('and')) {
      this.pos += 3
      a = { k: 'and', a, b: this.parseAlt() }
    }
    return a
  }

  parseAlt(): Filter {
    let a = this.parseIf()
    while (this.eat('//')) a = { k: 'alt', a, b: this.parseIf() }
    return a
  }

  parseIf(): Filter {
    if (!this.isWord('if')) return this.parseCmp()
    this.pos += 2
    const cond = this.parsePipe()
    this.expectWord('then')
    const then = this.parsePipe()
    const elifs: { cond: Filter; then: Filter }[] = []
    while (this.isWord('elif')) {
      this.pos += 4
      const c = this.parsePipe()
      this.expectWord('then')
      elifs.push({ cond: c, then: this.parsePipe() })
    }
    let els: Filter | null = null
    if (this.isWord('else')) {
      this.pos += 4
      els = this.parsePipe()
    }
    this.expectWord('end')
    return { k: 'if', cond, then, elifs, els }
  }

  private expectWord(w: string): void {
    this.skipWs()
    if (!this.isWord(w)) this.fail(`expected '${w}'`)
    this.pos += w.length
  }

  parseCmp(): Filter {
    const a = this.parseAdd()
    this.skipWs()
    for (const op of ['==', '!=', '<=', '>=', '<', '>']) {
      if (this.src.startsWith(op, this.pos)) {
        this.pos += op.length
        return { k: 'cmp', op, a, b: this.parseAdd() }
      }
    }
    return a
  }

  parseAdd(): Filter {
    let a = this.parseMul()
    for (;;) {
      this.skipWs()
      const c = this.peek()
      if (c === '+' || c === '-') {
        this.pos++
        a = { k: 'arith', op: c, a, b: this.parseMul() }
      } else break
    }
    return a
  }

  parseMul(): Filter {
    let a = this.parseUnary()
    for (;;) {
      this.skipWs()
      const c = this.peek()
      if (c === '*' || c === '%' || (c === '/' && this.peek(1) !== '/')) {
        this.pos++
        a = { k: 'arith', op: c, a, b: this.parseUnary() }
      } else break
    }
    return a
  }

  parseUnary(): Filter {
    this.skipWs()
    if (this.peek() === '-') {
      this.pos++
      return { k: 'neg', a: this.parseUnary() }
    }
    return this.parsePostfix()
  }

  private bracketable(e: Filter): boolean {
    return e.k === 'ident' || e.k === 'field' || e.k === 'index' || e.k === 'slice' || e.k === 'iter' || e.k === 'recurse'
  }

  parsePostfix(): Filter {
    let e = this.parsePrimary()
    for (;;) {
      this.skipWs()
      const c = this.peek()
      if (c === '.' && this.peek(1) !== '.') {
        this.pos++
        this.skipWs()
        if (this.peek() === '[') e = this.parseBracket(e)
        else {
          const name = this.parseIdent()
          e = { k: 'field', name, parent: e }
        }
      } else if (c === '[' && this.bracketable(e)) {
        e = this.parseBracket(e)
      } else if (c === '?') {
        this.pos++
        e = { k: 'call', name: '__try', args: [e] }
      } else break
    }
    return e
  }

  private parseBracket(parent: Filter): Filter {
    this.expect('[')
    this.skipWs()
    if (this.peek() === ']') {
      this.pos++
      return { k: 'iter', parent }
    }
    let start: Filter | null = null
    let end: Filter | null = null
    if (this.peek() === ':') {
      this.pos++
      this.skipWs()
      end = this.peek() === ']' ? null : this.parseOr()
      this.expect(']')
      return { k: 'slice', start, end, parent }
    }
    start = this.parseOr()
    this.skipWs()
    if (this.peek() === ':') {
      this.pos++
      this.skipWs()
      end = this.peek() === ']' ? null : this.parseOr()
      this.expect(']')
      return { k: 'slice', start, end, parent }
    }
    this.expect(']')
    return { k: 'index', idx: start, parent }
  }

  parseIdent(): string {
    this.skipWs()
    const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(this.src.slice(this.pos))
    if (!m) this.fail('identifier')
    this.pos += m[0].length
    return m[0]
  }

  parsePrimary(): Filter {
    this.skipWs()
    const c = this.peek()
    if (c === '.') {
      if (this.peek(1) === '.') {
        this.pos += 2
        return { k: 'recurse' }
      }
      this.pos++
      this.skipWs()
      if (this.peek() === '[') return this.parseBracket({ k: 'ident' })
      if (/[a-zA-Z_]/.test(this.peek())) {
        const name = this.parseIdent()
        return { k: 'field', name, parent: { k: 'ident' } }
      }
      return { k: 'ident' }
    }
    if (c === '"') return this.parseStringLiteral()
    if (c === '$') {
      this.pos++
      return { k: 'var', name: this.parseIdent() }
    }
    if (c === '[') return this.parseArray()
    if (c === '{') return this.parseObject()
    if (c === '(') {
      this.pos++
      const f = this.parsePipe()
      this.expect(')')
      return f
    }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(this.src.slice(this.pos))
      if (!m) this.fail('number')
      this.pos += m[0].length
      return { k: 'literal', val: Number(m[0]) }
    }
    if (/[a-zA-Z_]/.test(c)) {
      const word = this.parseIdent()
      if (word === 'true') return { k: 'literal', val: true }
      if (word === 'false') return { k: 'literal', val: false }
      if (word === 'null') return { k: 'literal', val: null }
      const args: Filter[] = []
      this.skipWs()
      if (this.peek() === '(') {
        this.pos++
        this.skipWs()
        if (this.peek() !== ')') {
          for (;;) {
            args.push(this.parsePipe())
            this.skipWs()
            if (this.peek() === ';') { this.pos++; continue }
            break
          }
        }
        this.expect(')')
      }
      return { k: 'call', name: word, args }
    }
    this.fail('expression')
  }

  private parseStringLiteral(): Filter {
    this.expect('"')
    const parts: (string | Filter)[] = []
    let buf = ''
    for (;;) {
      if (this.pos >= this.src.length) this.fail('unterminated string')
      const c = this.src[this.pos]
      if (c === '"') {
        this.pos++
        break
      }
      if (c === '\\') {
        const n = this.src[this.pos + 1]
        if (n === '(') {
          this.pos += 2
          if (buf) { parts.push(buf); buf = '' }
          parts.push(this.parsePipe())
          this.expect(')')
          continue
        }
        if (n === 'u') {
          const hex = this.src.slice(this.pos + 2, this.pos + 6)
          buf += String.fromCharCode(parseInt(hex, 16))
          this.pos += 6
          continue
        }
        const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
        buf += map[n] ?? n
        this.pos += 2
        continue
      }
      buf += c
      this.pos++
    }
    if (buf) parts.push(buf)
    if (parts.length === 0) parts.push('')
    if (parts.length === 1 && typeof parts[0] === 'string') return { k: 'literal', val: parts[0] }
    return { k: 'string', parts }
  }

  private parseArray(): Filter {
    this.expect('[')
    this.skipWs()
    if (this.peek() === ']') {
      this.pos++
      return { k: 'array', f: null }
    }
    let f: Filter = this.parsePipe()
    for (;;) {
      this.skipWs()
      if (this.peek() === ',') {
        this.pos++
        f = { k: 'comma', left: f, right: this.parsePipe() }
        continue
      }
      break
    }
    this.expect(']')
    return { k: 'array', f }
  }

  private parseObject(): Filter {
    this.expect('{')
    this.skipWs()
    if (this.peek() === '}') {
      this.pos++
      return { k: 'object', fields: [] }
    }
    const fields: { key: string; val: Filter }[] = []
    for (;;) {
      this.skipWs()
      let key: string
      if (this.peek() === '"') {
        const sf = this.parseStringLiteral()
        if (sf.k === 'literal' && typeof sf.val === 'string') key = sf.val
        else this.fail('dynamic object key')
      } else {
        key = this.parseIdent()
      }
      this.skipWs()
      let val: Filter
      if (this.peek() === ':') {
        this.pos++
        val = this.parsePipeLevel()
      } else {
        val = { k: 'field', name: key, parent: { k: 'ident' } }
      }
      fields.push({ key, val })
      this.skipWs()
      if (this.peek() === ',') { this.pos++; continue }
      break
    }
    this.expect('}')
    return { k: 'object', fields }
  }
}

// ---- interpreter -------------------------------------------------------------------------------------

function evalFilter(f: Filter, input: JqVal, ctx: JqCtx): JqVal[] {
  switch (f.k) {
    case 'ident':
      return [input]
    case 'literal':
      return [f.val]
    case 'var':
      if (f.name in ctx.vars) return [ctx.vars[f.name]]
      throw new JqError(`$${f.name} is not defined`)
    case 'pipe': {
      const out: JqVal[] = []
      for (const v of evalFilter(f.left, input, ctx)) out.push(...evalFilter(f.right, v, ctx))
      return out
    }
    case 'comma': {
      const a = evalFilter(f.left, input, ctx)
      const b = evalFilter(f.right, input, ctx)
      return a.concat(b)
    }
    case 'field': {
      const out: JqVal[] = []
      for (const v of evalFilter(f.parent, input, ctx)) {
        if (isObj(v)) out.push(v[f.name] ?? null)
        else if (v === null) throw new JqError(`Cannot index null with ${jqString(f.name)}`)
        else throw new JqError(`Cannot index ${jqType(v)} with ${jqString(f.name)}`)
      }
      return out
    }
    case 'index': {
      const out: JqVal[] = []
      for (const v of evalFilter(f.parent, input, ctx)) {
        const iv = evalFilter(f.idx, v, ctx)
        const key = iv.length ? iv[0] : null
        if (isArr(v)) {
          if (typeof key !== 'number') throw new JqError(`Cannot index array with ${jqString(jqToString(key))}`)
          const i = key < 0 ? v.length + key : key
          out.push(i >= 0 && i < v.length ? v[i] : null)
        } else if (isObj(v)) {
          out.push(v[jqToString(key)] ?? null)
        } else if (v === null) {
          out.push(null)
        } else {
          throw new JqError(`Cannot index ${jqType(v)} with ${jqString(jqToString(key))}`)
        }
      }
      return out
    }
    case 'slice': {
      const out: JqVal[] = []
      for (const v of evalFilter(f.parent, input, ctx)) {
        const sv = (f.start ? evalFilter(f.start, v, ctx)[0] : null) as number | null | undefined
        const ev = (f.end ? evalFilter(f.end, v, ctx)[0] : null) as number | null | undefined
        if (typeof v === 'string') {
          const chars = Array.from(v)
          out.push(chars.slice(sv ?? 0, ev ?? chars.length).join(''))
        } else if (isArr(v)) {
          out.push(v.slice(sv ?? 0, ev ?? v.length))
        } else if (v === null) {
          out.push(null)
        } else {
          throw new JqError(`Cannot index ${jqType(v)} with a slice`)
        }
      }
      return out
    }
    case 'iter': {
      const out: JqVal[] = []
      for (const v of evalFilter(f.parent, input, ctx)) {
        if (isArr(v)) out.push(...v)
        else if (isObj(v)) out.push(...Object.keys(v).map((k) => v[k]))
        else if (v === null) continue
        else throw new JqError(`Cannot iterate over ${jqType(v)} (${jqCompact(v)})`)
      }
      return out
    }
    case 'recurse':
      return recurse(input)
    case 'array': {
      const vals = f.f ? evalFilter(f.f, input, ctx) : []
      return [vals]
    }
    case 'object': {
      const streams = f.fields.map((fd) => evalFilter(fd.val, input, ctx))
      let combos: JqVal[][] = [[]]
      for (const s of streams) {
        const next: JqVal[][] = []
        for (const c of combos) {
          if (s.length === 0) continue
          for (const v of s) next.push([...c, v])
        }
        combos = next
      }
      if (combos.length === 0 && f.fields.length > 0) return []
      const keys = f.fields.map((fd) => fd.key)
      return combos.map((c) => {
        const o: JqObject = {}
        keys.forEach((k, i) => { o[k] = c[i] })
        return o
      })
    }
    case 'string': {
      let acc: string[] = ['']
      for (const part of f.parts) {
        if (typeof part === 'string') acc = acc.map((s) => s + part)
        else {
          const vals = evalFilter(part, input, ctx)
          if (vals.length === 0) { acc = []; break }
          const next: string[] = []
          for (const s of acc) for (const v of vals) next.push(s + jqToString(v))
          acc = next
        }
      }
      return acc
    }
    case 'if': {
      const cond = evalFilter(f.cond, input, ctx)
      const take = (cf: Filter): JqVal[] => evalFilter(cf, input, ctx)
      if (cond.length && truthy(cond[0])) return take(f.then)
      for (const ef of f.elifs) {
        const c = evalFilter(ef.cond, input, ctx)
        if (c.length && truthy(c[0])) return take(ef.then)
      }
      return f.els ? take(f.els) : []
    }
    case 'and': {
      const a = evalFilter(f.a, input, ctx)
      if (!a.length || !truthy(a[0])) return [false]
      const b = evalFilter(f.b, input, ctx)
      return [b.length > 0 && truthy(b[0])]
    }
    case 'or': {
      const a = evalFilter(f.a, input, ctx)
      if (a.length && truthy(a[0])) return [true]
      const b = evalFilter(f.b, input, ctx)
      return [b.length > 0 && truthy(b[0])]
    }
    case 'alt': {
      const a = evalFilter(f.a, input, ctx)
      if (a.length > 0) return a
      return evalFilter(f.b, input, ctx)
    }
    case 'not': {
      const a = evalFilter(f.a, input, ctx)
      return [!(a.length > 0 && truthy(a[0]))]
    }
    case 'neg': {
      const a = evalFilter(f.a, input, ctx)
      const v = a.length ? a[0] : null
      if (typeof v !== 'number') throw new JqError(`${jqType(v)} (${jqCompact(v)}) cannot be negated`)
      return [-v]
    }
    case 'cmp': {
      const a = evalFilter(f.a, input, ctx)
      const b = evalFilter(f.b, input, ctx)
      const x = a.length ? a[0] : null
      const y = b.length ? b[0] : null
      let r: boolean
      if (typeof x === 'number' && typeof y === 'number') {
        r = f.op === '<' ? x < y : f.op === '<=' ? x <= y : f.op === '==' ? x === y : f.op === '!=' ? x !== y : f.op === '>=' ? x >= y : x > y
      } else {
        const sx = jqToString(x)
        const sy = jqToString(y)
        r = f.op === '<' ? sx < sy : f.op === '<=' ? sx <= sy : f.op === '==' ? sx === sy : f.op === '!=' ? sx !== sy : f.op === '>=' ? sx >= sy : sx > sy
      }
      return [r]
    }
    case 'arith': {
      const a = evalFilter(f.a, input, ctx)
      const b = evalFilter(f.b, input, ctx)
      const x = a.length ? a[0] : null
      const y = b.length ? b[0] : null
      return arith(f.op, x, y)
    }
    case 'call':
      return callBuiltin(f.name, f.args, input, ctx)
  }
}

function recurse(v: JqVal): JqVal[] {
  const out: JqVal[] = [v]
  if (isArr(v)) for (const e of v) out.push(...recurse(e))
  else if (isObj(v)) for (const k of Object.keys(v)) out.push(...recurse(v[k]))
  return out
}

function arith(op: string, x: JqVal, y: JqVal): JqVal[] {
  if (op === '+') {
    if (typeof x === 'number' && typeof y === 'number') return [x + y]
    if (typeof x === 'string' && typeof y === 'string') return [x + y]
    if (isArr(x) && isArr(y)) return [[...x, ...y]]
    if (isObj(x) && isObj(y)) return [{ ...x, ...y }]
    if (x === null) return [y]
    if (y === null) return [x]
    throw new JqError(`${jqType(x)} (${jqCompact(x)}) and ${jqType(y)} (${jqCompact(y)}) cannot be added`)
  }
  if (op === '-') {
    if (typeof x === 'number' && typeof y === 'number') return [x - y]
    throw new JqError(`${jqType(x)} (${jqCompact(x)}) and ${jqType(y)} (${jqCompact(y)}) cannot be subtracted`)
  }
  if (op === '*') {
    if (typeof x === 'number' && typeof y === 'number') return [x * y]
    if (typeof x === 'string' && typeof y === 'number') return [x.repeat(Math.trunc(y))]
    if (typeof x === 'number' && typeof y === 'string') return [y.repeat(Math.trunc(x))]
    throw new JqError(`${jqType(x)} (${jqCompact(x)}) and ${jqType(y)} (${jqCompact(y)}) cannot be multiplied`)
  }
  if (op === '/') {
    if (typeof x === 'number' && typeof y === 'number') {
      if (y === 0) throw new JqError(`number (${jqNumString(x)}) and number (${jqNumString(y)}) cannot be divided because the divisor is zero`)
      return [x / y]
    }
    if (typeof x === 'string' && typeof y === 'string') return [x.split(y)]
    throw new JqError(`${jqType(x)} (${jqCompact(x)}) and ${jqType(y)} (${jqCompact(y)}) cannot be divided`)
  }
  if (typeof x === 'number' && typeof y === 'number') {
    if (y === 0) throw new JqError(`number (${jqNumString(x)}) and number (${jqNumString(y)}) cannot be divided because the divisor is zero`)
    return [x % y]
  }
  throw new JqError(`${jqType(x)} (${jqCompact(x)}) and ${jqType(y)} (${jqCompact(y)}) cannot be used with ${op}`)
}

function first(vals: JqVal[]): JqVal { return vals.length ? vals[0] : null }

function callBuiltin(name: string, args: Filter[], input: JqVal, ctx: JqCtx): JqVal[] {
  const argc = args.length
  const evalArg = (i: number): JqVal => first(evalFilter(args[i], input, ctx))
  const need = (n: number): void => {
    if (argc !== n) throw new JqError(`${name}/${argc} is not defined`)
  }
  const needFilter = (n: number): Filter[] => {
    need(n)
    return args
  }
  switch (name) {
    case '__try': {
      try {
        return evalFilter(args[0], input, ctx)
      } catch (e) {
        if (e instanceof JqError) return []
        throw e
      }
    }
    case 'length': {
      need(0)
      if (typeof input === 'string') return [Array.from(input).length]
      if (isArr(input)) return [input.length]
      if (isObj(input)) return [Object.keys(input).length]
      if (input === null) return [0]
      throw new JqError(`${jqType(input)} (${jqCompact(input)}) has no length`)
    }
    case 'keys': {
      need(0)
      if (isObj(input)) return [Object.keys(input).sort()]
      if (isArr(input)) return [input.map((_, i) => i)]
      throw new JqError(`${jqType(input)} (${jqCompact(input)}) has no keys`)
    }
    case 'values': {
      need(0)
      if (isObj(input)) return Object.keys(input).map((k) => input[k])
      if (isArr(input)) return input
      if (input === null) return []
      return [input]
    }
    case 'type': need(0); return [jqType(input)]
    case 'tostring': need(0); return [jqToString(input)]
    case 'tonumber': {
      need(0)
      if (typeof input === 'number') return [input]
      if (typeof input === 'string') {
        const n = Number(input)
        if (input.trim() !== '' && Number.isFinite(n)) return [n]
        throw new JqError(`string (${jqString(input)}) cannot be parsed as a number`)
      }
      throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be parsed as a number`)
    }
    case 'not': need(0); return [!truthy(input)]
    case 'empty': need(0); return []
    case 'env': {
      need(0)
      const o: JqObject = {}
      for (const k of Object.keys(ctx.env).sort()) o[k] = ctx.env[k]
      return [o]
    }
    case 'add': {
      need(0)
      if (input === null) return [null]
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be added`)
      if (input.length === 0) return [null]
      if (typeof input[0] === 'number') {
        let s = 0
        for (const e of input) {
          if (typeof e !== 'number') throw new JqError(`${jqType(e)} (${jqCompact(e)}) cannot be added`)
          s += e
        }
        return [s]
      }
      if (typeof input[0] === 'string') {
        let s = ''
        for (const e of input) {
          if (typeof e !== 'string') throw new JqError(`${jqType(e)} (${jqCompact(e)}) cannot be added`)
          s += e
        }
        return [s]
      }
      if (isArr(input[0])) {
        const out: JqVal[] = []
        for (const e of input) {
          if (!isArr(e)) throw new JqError(`${jqType(e)} (${jqCompact(e)}) cannot be added`)
          out.push(...e)
        }
        return [out]
      }
      if (isObj(input[0])) {
        const out: JqObject = {}
        for (const e of input) {
          if (!isObj(e)) throw new JqError(`${jqType(e)} (${jqCompact(e)}) cannot be added`)
          for (const k of Object.keys(e)) out[k] = e[k]
        }
        return [out]
      }
      throw new JqError(`array of ${jqType(input[0])} cannot be added`)
    }
    case 'sort': {
      need(0)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be sorted`)
      return [[...input].sort(jqCmp)]
    }
    case 'unique': {
      need(0)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be made unique`)
      const s = [...input].sort(jqCmp)
      const out: JqVal[] = []
      for (const v of s) if (out.length === 0 || jqCmp(out[out.length - 1], v) !== 0) out.push(v)
      return [out]
    }
    case 'reverse': {
      need(0)
      if (isArr(input)) return [[...input].reverse()]
      if (typeof input === 'string') return [Array.from(input).reverse().join('')]
      throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be reversed`)
    }
    case 'first': {
      need(0)
      if (isArr(input)) return [input.length ? input[0] : null]
      return [input]
    }
    case 'last': {
      need(0)
      if (isArr(input)) return [input.length ? input[input.length - 1] : null]
      return [input]
    }
    case 'min': {
      need(0)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be minimized`)
      if (input.length === 0) return [null]
      return [[...input].sort(jqCmp)[0]]
    }
    case 'max': {
      need(0)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be maximized`)
      if (input.length === 0) return [null]
      return [[...input].sort(jqCmp)[input.length - 1]]
    }
    case 'to_entries': {
      need(0)
      if (input === null) return [[]]
      if (isObj(input)) return [Object.keys(input).map((k) => ({ key: k, value: input[k] }))]
      if (isArr(input)) return [input.map((v, i) => ({ key: i, value: v }))]
      throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be converted to entries`)
    }
    case 'from_entries': {
      need(0)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be converted from entries`)
      let isArray = false
      const obj: JqObject = {}
      const arr: JqVal[] = []
      for (const e of input) {
        if (!isObj(e)) continue
        const key = e['key'] ?? e['Key'] ?? e['name'] ?? e['Name']
        const value = e['value'] ?? e['Value']
        if (typeof key === 'number') {
          isArray = true
          arr[key] = value
        } else if (typeof key === 'string') {
          obj[key] = value
        }
      }
      return [isArray ? arr : obj]
    }
    case 'paths': {
      need(0)
      return pathsOf(input)
    }
    case 'select': {
      const [f] = needFilter(1)
      const out: JqVal[] = []
      for (const v of evalFilter(f, input, ctx)) if (truthy(v)) out.push(input)
      return out
    }
    case 'map': {
      const [f] = needFilter(1)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be mapped`)
      const out: JqVal[] = []
      for (const e of input) out.push(...evalFilter(f, e, ctx))
      return [out]
    }
    case 'map_values': {
      const [f] = needFilter(1)
      if (isArr(input)) {
        const out: JqVal[] = []
        for (const e of input) out.push(...evalFilter(f, e, ctx))
        return [out]
      }
      if (isObj(input)) {
        const streams = Object.keys(input).map((k) => ({ k, s: evalFilter(f, input[k], ctx) }))
        let combos: { k: string; v: JqVal }[][] = [[]]
        for (const { k, s } of streams) {
          const next: { k: string; v: JqVal }[][] = []
          for (const c of combos) {
            if (s.length === 0) continue
            for (const v of s) next.push([...c, { k, v }])
          }
          combos = next
        }
        if (combos.length === 0 && streams.length > 0) return [{}]
        return combos.map((c) => {
          const o: JqObject = {}
          for (const { k, v } of c) o[k] = v
          return o
        })
      }
      if (input === null) return [null]
      throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be mapped over`)
    }
    case 'sort_by': {
      const [f] = needFilter(1)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be sorted`)
      const keyed = input.map((v, i) => ({ v, i, key: first(evalFilter(f, v, ctx)) }))
      keyed.sort((a, b) => jqCmp(a.key, b.key) || a.i - b.i)
      return [keyed.map((k) => k.v)]
    }
    case 'group_by': {
      const [f] = needFilter(1)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be grouped`)
      const keyed = input.map((v, i) => ({ v, i, key: first(evalFilter(f, v, ctx)) }))
      keyed.sort((a, b) => jqCmp(a.key, b.key) || a.i - b.i)
      const groups: JqVal[][] = []
      let cur: JqVal[] = []
      let hasKey = false
      let curKey: JqVal = null
      for (const k of keyed) {
        if (hasKey && jqCmp(curKey, k.key) !== 0) {
          groups.push(cur)
          cur = []
        }
        curKey = k.key
        hasKey = true
        cur.push(k.v)
      }
      if (cur.length > 0) groups.push(cur)
      return [groups]
    }
    case 'unique_by': {
      const [f] = needFilter(1)
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be made unique`)
      const keyed = input.map((v, i) => ({ v, i, key: first(evalFilter(f, v, ctx)) }))
      keyed.sort((a, b) => jqCmp(a.key, b.key) || a.i - b.i)
      const out: JqVal[] = []
      let lastKey: JqVal | null = null
      for (const k of keyed) {
        if (out.length === 0 || lastKey === null || jqCmp(lastKey, k.key) !== 0) out.push(k.v)
        lastKey = k.key
      }
      return [out]
    }
    case 'with_entries': {
      const [f] = needFilter(1)
      const entries = callBuiltin('to_entries', [], input, ctx)[0]
      const mapped = callBuiltin('map', [f], entries, ctx)[0]
      return callBuiltin('from_entries', [], mapped, ctx)
    }
    case 'join': {
      need(1)
      const sep = jqToString(evalArg(0))
      if (input === null) return ['']
      if (!isArr(input)) throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be joined`)
      const pieces = input.map((e) => (e === null ? '' : jqToString(e)))
      return [pieces.join(sep)]
    }
    case 'split': {
      need(1)
      const sep = jqToString(evalArg(0))
      if (input === null) return [[]]
      if (typeof input !== 'string') throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be split`)
      if (sep === '') return [Array.from(input)]
      return [input.split(sep)]
    }
    case 'contains': {
      need(1)
      return [jqContains(input, evalArg(0))]
    }
    case 'has': {
      need(1)
      const key = evalArg(0)
      if (isObj(input)) return [jqToString(key) in input]
      if (isArr(input)) return [typeof key === 'number' && Number.isInteger(key) && key >= 0 && key < input.length]
      return [false]
    }
    case 'test': {
      if (argc < 1 || argc > 2) throw new JqError(`test/${argc} is not defined`)
      if (typeof input !== 'string') throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be matched, as it is not a string`)
      const re = jqRegex(jqToString(evalArg(0)), argc > 1 ? jqToString(evalArg(1)) : '')
      return [re.test(input)]
    }
    case 'match': {
      if (argc < 1 || argc > 2) throw new JqError(`match/${argc} is not defined`)
      if (typeof input !== 'string') throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be matched, as it is not a string`)
      const flags = argc > 1 ? jqToString(evalArg(1)) : ''
      const re = jqRegex(jqToString(evalArg(0)), flags)
      if (flags.includes('g')) {
        const out: JqVal[] = []
        let m: RegExpExecArray | null
        while ((m = re.exec(input))) {
          out.push(matchObj(m))
          if (m[0].length === 0) re.lastIndex++
        }
        return [out]
      }
      const m = re.exec(input)
      return [m ? matchObj(m) : null]
    }
    case 'sub':
    case 'gsub': {
      if (argc < 2 || argc > 3) throw new JqError(`${name}/${argc} is not defined`)
      if (typeof input !== 'string') throw new JqError(`${jqType(input)} (${jqCompact(input)}) cannot be matched, as it is not a string`)
      const pattern = jqToString(evalArg(0))
      const rep = jqToString(evalArg(1))
      let flags = argc > 2 ? jqToString(evalArg(2)) : ''
      if (name === 'gsub' && !flags.includes('g')) flags += 'g'
      const re = jqRegex(pattern, flags)
      return [input.replace(re, () => rep)]
    }
    case 'limit': {
      if (argc !== 2) throw new JqError(`limit/${argc} is not defined`)
      const n = evalArg(0)
      const limit = typeof n === 'number' ? Math.trunc(n) : 0
      if (limit <= 0) return []
      return evalFilter(args[1], input, ctx).slice(0, limit)
    }
    case 'range': {
      if (argc < 1 || argc > 3) throw new JqError(`range/${argc} is not defined`)
      const nums = args.map((_, i) => Number(evalArg(i)))
      const out: JqVal[] = []
      if (argc === 1) {
        for (let i = 0; i < nums[0]; i++) out.push(i)
      } else if (argc === 2) {
        for (let i = nums[0]; i < nums[1]; i++) out.push(i)
      } else {
        const step = nums[2]
        if (step === 0) throw new JqError('range step cannot be zero')
        if (step > 0) for (let i = nums[0]; i < nums[1]; i += step) out.push(i)
        else for (let i = nums[0]; i > nums[1]; i += step) out.push(i)
      }
      return out
    }
    default:
      throw new JqError(`${name}/${argc} is not defined`)
  }
}

function pathsOf(v: JqVal): JqVal[] {
  const out: JqVal[] = []
  const walk = (x: JqVal, path: (string | number)[]): void => {
    if (isArr(x)) {
      for (let i = 0; i < x.length; i++) {
        const p = [...path, i]
        out.push(p)
        walk(x[i], p)
      }
    } else if (isObj(x)) {
      for (const k of Object.keys(x)) {
        const p = [...path, k]
        out.push(p)
        walk(x[k], p)
      }
    }
  }
  walk(v, [])
  return out
}

function jqContains(a: JqVal, b: JqVal): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.includes(b)
  if (isArr(a) && isArr(b)) {
    return b.every((x) => a.some((y) => jqContains(y, x) || jqCmp(y, x) === 0))
  }
  if (isObj(a) && isObj(b)) {
    return Object.keys(b).every((k) => k in a && jqContains(a[k], b[k]))
  }
  return false
}

function jqRegex(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags)
  } catch (e) {
    throw new JqError(`invalid regex: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function matchObj(m: RegExpExecArray): JqObject {
  const captures: JqObject[] = []
  for (let i = 1; i < m.length; i++) {
    if (m[i] === undefined) continue
    captures.push({ offset: m.index + m[0].indexOf(m[i]), length: m[i].length, string: m[i], name: null })
  }
  return { offset: m.index, length: m[0].length, string: m[0], captures }
}

// ---- entry point -------------------------------------------------------------------------------------

export interface JqInputSource { name: string; text: string }

export function runJq(program: string, sources: JqInputSource[], opts: JqOptions, env: Record<string, string>, vars: Record<string, JqVal> = {}, signal?: AbortSignal): { status: number; out: string; err: string } {
  let filter: Filter
  try {
    filter = new Parser(program).parseProgram()
  } catch (e) {
    if (e instanceof ParseFail) {
      return {
        status: 2,
        out: '',
        err: `jq: error: ${e.message} (Unix shell quoting issues?) at <top-level>, line 1:\njq: 1 compile error\n`,
      }
    }
    return { status: 2, out: '', err: `jq: error: syntax error at <top-level>, line 1:\njq: 1 compile error\n` }
  }

  const indent = opts.tab ? '\t' : ' '.repeat(opts.indent)
  const prettyOpts = { indent, sortKeys: opts.sortKeys }
  let out = ''
  let err = ''
  let last: JqVal | null = null
  let produced = false
  let hadError = false

  const emit = (v: JqVal): void => {
    produced = true
    last = v
    if (opts.raw && typeof v === 'string') out += v + '\n'
    else if (opts.compact) out += jqCompact(v) + '\n'
    else out += jqPretty(v, prettyOpts) + '\n'
  }

  if (opts.nullInput) {
    try {
      for (const v of evalFilter(filter, null, { env, vars })) emit(v)
    } catch (e) {
      if (e instanceof JqError) { err += `jq: error (at <stdin>:0): ${e.message}\n`; hadError = true }
      else throw e
    }
  } else if (opts.slurp) {
    const docs: JqVal[] = []
    for (const src of sources) {
      try {
        docs.push(...parseJsonStream(src.text))
      } catch (e) {
        if (e instanceof JqError) { err += `jq: parse error: ${e.message}\n`; hadError = true }
      }
    }
    if (!hadError) {
      try {
        for (const v of evalFilter(filter, docs, { env, vars })) emit(v)
      } catch (e) {
        if (e instanceof JqError) { err += `jq: error (at <stdin>:0): ${e.message}\n`; hadError = true }
        else throw e
      }
    }
  } else {
    for (const src of sources) {
      let docs: JqVal[]
      try {
        docs = parseJsonStream(src.text)
      } catch (e) {
        if (e instanceof JqError) { err += `jq: parse error: ${e.message}\n`; hadError = true }
        continue
      }
      for (let d = 0; d < docs.length; d++) {
        if (signal?.aborted) return { status: 130, out, err }
        try {
          for (const v of evalFilter(filter, docs[d], { env, vars })) emit(v)
        } catch (e) {
          if (e instanceof JqError) {
            err += `jq: error (at ${src.name}:${d + 1}): ${e.message}\n`
            hadError = true
          } else throw e
        }
      }
    }
  }

  if (hadError) return { status: 5, out, err }
  if (opts.exitStatus) {
    if (!produced) return { status: 4, out, err }
    return { status: last === false || last === null ? 1 : 0, out, err }
  }
  return { status: 0, out, err }
}
