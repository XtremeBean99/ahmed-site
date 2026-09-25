// Word expansion: brace, tilde, parameter, command/arithmetic/process substitution, word splitting, globbing.
import { VFS } from '../vfs'
import { expandGlob, hasGlob, globToRegExp } from '../glob'
import { evalArith, ArithError, ArithEnv } from './arith'
import { unescape } from '../printf'

export class ExpandError extends Error {}

export interface VarValue {
  value: string
  exported: boolean
  readonly: boolean
  integer: boolean
  lower: boolean
  upper: boolean
  array: (string | undefined)[] | null
  assoc: Map<string, string> | null
}

export interface ExpandCtx {
  fs: VFS
  cwd: string
  home: string
  getVar(name: string): VarValue | undefined
  setVar(name: string, value: string): void
  positionals: string[]
  lastStatus: number
  pid: string
  argv0: string
  nounset: boolean
  getSpecial(name: string): string | undefined
  runCapture(text: string): Promise<string>
  makeProcsub(text: string, dir: '<' | '>'): Promise<string>
  signal: AbortSignal
  arithEnv: ArithEnv
}

type Part =
  | { kind: 'lit'; text: string; quoted: boolean }
  | { kind: 'param'; raw: string; quoted: boolean }
  | { kind: 'cmd'; text: string; quoted: boolean }
  | { kind: 'arith'; text: string; quoted: boolean }
  | { kind: 'proc'; text: string; dir: '<' | '>'; quoted: boolean }

interface Frag { s: string; split: boolean }

// ---- brace expansion ---------------------------------------------------------------------------

const NAME_CHAR = /[A-Za-z0-9_]/

export function braceExpand(raw: string): string[] {
  const open = findBraceOpen(raw)
  if (open < 0) return [raw]
  const close = matchingBrace(raw, open)
  if (close < 0) return [raw]
  const inner = raw.slice(open + 1, close)
  const prefix = raw.slice(0, open)
  const suffix = raw.slice(close + 1)
  const seq = parseSequence(inner)
  if (seq) {
    const out: string[] = []
    for (const a of seq) out.push(...braceExpand(prefix + a + suffix))
    return out
  }
  const alts = splitTopLevel(inner, ',')
  if (alts.length > 1) {
    const out: string[] = []
    for (const a of alts) out.push(...braceExpand(prefix + a + suffix))
    return out
  }
  return [raw]
}

function findBraceOpen(raw: string): number {
  let inS = false
  let inD = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '\\') { i++; continue }
    if (inS) { if (c === "'") inS = false; continue }
    if (inD) { if (c === '"') inD = false; continue }
    if (c === "'") { inS = true; continue }
    if (c === '"') { inD = true; continue }
    if (c === '{' && (i === 0 || raw[i - 1] !== '$')) return i
  }
  return -1
}

function matchingBrace(raw: string, open: number): number {
  let depth = 0
  let inS = false
  let inD = false
  for (let i = open; i < raw.length; i++) {
    const c = raw[i]
    if (c === '\\') { i++; continue }
    if (inS) { if (c === "'") inS = false; continue }
    if (inD) { if (c === '"') inD = false; continue }
    if (c === "'") { inS = true; continue }
    if (c === '"') { inD = true; continue }
    if (c === '$' && raw[i + 1] === '{') {
      const e = scanBalanced(raw, i + 1, '{', '}')
      if (e > 0) { i = e - 1; continue }
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function parseSequence(inner: string): string[] | null {
  let m = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(inner)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const step = m[3] === undefined ? undefined : Number(m[3])
    const st = step === undefined ? (a <= b ? 1 : -1) : step
    if (st === 0) return null
    const out: string[] = []
    const width = (m[1].startsWith('0') && m[1].length > 1) || (m[2].startsWith('0') && m[2].length > 1) ? Math.max(m[1].length, m[2].length) : 0
    for (let v = a; st > 0 ? v <= b : v >= b; v += st) {
      let s = String(v)
      if (width > 0) {
        const neg = s.startsWith('-')
        const digits = neg ? s.slice(1) : s
        s = (neg ? '-' : '') + digits.padStart(width, '0')
      }
      out.push(s)
      if (out.length > 10000) break
    }
    return out
  }
  m = /^([a-zA-Z])\.\.([a-zA-Z])(?:\.\.(-?\d+))?$/.exec(inner)
  if (m) {
    const a = m[1].charCodeAt(0)
    const b = m[2].charCodeAt(0)
    const step = m[3] === undefined ? (a <= b ? 1 : -1) : Number(m[3])
    if (step === 0) return null
    const out: string[] = []
    for (let v = a; step > 0 ? v <= b : v >= b; v += step) {
      out.push(String.fromCharCode(v))
      if (out.length > 10000) break
    }
    return out
  }
  return null
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  let inS = false
  let inD = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') { cur += c + (s[i + 1] ?? ''); i++; continue }
    if (inS) { cur += c; if (c === "'") inS = false; continue }
    if (inD) { cur += c; if (c === '"') inD = false; continue }
    if (c === "'") { inS = true; cur += c; continue }
    if (c === '"') { inD = true; cur += c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

// ---- balanced scanning inside raw words -------------------------------------------------------

function scanBalanced(s: string, openIdx: number, open: string, close: string): number {
  let depth = 0
  let i = openIdx
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') { i += 2; continue }
    if (c === "'") {
      i++
      while (i < s.length && s[i] !== "'") i++
      if (i >= s.length) return -1
      i++
      continue
    }
    if (c === '"') {
      i++
      while (i < s.length) {
        const d = s[i]
        if (d === '\\') { i += 2; continue }
        if (d === '"') break
        if (d === '$') {
          const nxt = s[i + 1]
          if (nxt === '(') { const e = scanBalanced(s, i + 1, '(', ')'); if (e < 0) return -1; i = e; continue }
          if (nxt === '{') { const e = scanBalanced(s, i + 1, '{', '}'); if (e < 0) return -1; i = e; continue }
        }
        i++
      }
      if (i >= s.length) return -1
      i++
      continue
    }
    if (c === '$') {
      const nxt = s[i + 1]
      if (nxt === '(') { const e = scanBalanced(s, i + 1, '(', ')'); if (e < 0) return -1; i = e; continue }
      if (nxt === '{') { const e = scanBalanced(s, i + 1, '{', '}'); if (e < 0) return -1; i = e; continue }
      i++
      continue
    }
    if (c === '`') {
      i++
      while (i < s.length && s[i] !== '`') { if (s[i] === '\\') i++; i++ }
      if (i >= s.length) return -1
      i++
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return -1
}

// ---- part parsing -----------------------------------------------------------------------------

function parseParts(raw: string, flags: { noGlob: boolean }): Part[] {
  const parts: Part[] = []
  let i = 0
  const pushLit = (text: string, quoted: boolean) => {
    if (!text) return
    if (quoted && /[*?[]/.test(text)) flags.noGlob = true
    const last = parts[parts.length - 1]
    if (last && last.kind === 'lit' && last.quoted === quoted) last.text += text
    else parts.push({ kind: 'lit', text, quoted })
  }
  while (i < raw.length) {
    const c = raw[i]
    if (c === "'") {
      const end = raw.indexOf("'", i + 1)
      if (end < 0) { pushLit(raw.slice(i + 1), true); break }
      pushLit(raw.slice(i + 1, end), true)
      i = end + 1
      continue
    }
    if (c === '"') {
      i++
      let litStart = i
      const flush = (end: number) => { pushLit(raw.slice(litStart, end), true); litStart = end }
      let closed = false
      while (i < raw.length) {
        const d = raw[i]
        if (d === '"') { flush(i); i++; closed = true; break }
        if (d === '\\') {
          const nxt = raw[i + 1]
          if (nxt === '\n') { flush(i); i += 2; litStart = i; continue }
          if (nxt === undefined) { i++; continue }
          flush(i)
          if ('$`"\\'.includes(nxt)) pushLit(nxt, true)
          else pushLit('\\' + nxt, true)
          i += 2
          litStart = i
          continue
        }
        if (d === '$') {
          const nxt = raw[i + 1]
          if (nxt === '(') {
            if (raw[i + 2] === '(') {
              const end = scanBalanced(raw, i + 1, '(', ')')
              if (end < 0) { i = raw.length; break }
              flush(i)
              parts.push({ kind: 'arith', text: raw.slice(i + 3, end - 2), quoted: true })
              i = end
              litStart = i
              continue
            }
            const end = scanBalanced(raw, i + 1, '(', ')')
            if (end < 0) { i = raw.length; break }
            flush(i)
            parts.push({ kind: 'cmd', text: raw.slice(i + 2, end - 1), quoted: true })
            i = end
            litStart = i
            continue
          }
          if (nxt === '{') {
            const end = scanBalanced(raw, i + 1, '{', '}')
            if (end < 0) { i = raw.length; break }
            flush(i)
            parts.push({ kind: 'param', raw: raw.slice(i, end), quoted: true })
            i = end
            litStart = i
            continue
          }
          if (nxt !== undefined && (/[A-Za-z_0-9@*#?$!-]/.test(nxt))) {
            flush(i)
            if (/[0-9]/.test(nxt)) {
              parts.push({ kind: 'param', raw: '$' + nxt, quoted: true })
              i += 2
            } else if (/[A-Za-z_]/.test(nxt)) {
              let j = i + 1
              while (j < raw.length && NAME_CHAR.test(raw[j])) j++
              parts.push({ kind: 'param', raw: raw.slice(i, j), quoted: true })
              i = j
            } else {
              parts.push({ kind: 'param', raw: '$' + nxt, quoted: true })
              i += 2
            }
            litStart = i
            continue
          }
          i++
          continue
        }
        if (d === '`') {
          const end = scanBacktick(raw, i)
          if (end < 0) { i = raw.length; break }
          flush(i)
          parts.push({ kind: 'cmd', text: raw.slice(i + 1, end - 1), quoted: true })
          i = end
          litStart = i
          continue
        }
        if (/[*?[]/.test(d)) flags.noGlob = true
        i++
      }
      if (!closed) pushLit(raw.slice(litStart), true)
      continue
    }
    if (c === '\\') {
      if (raw[i + 1] === '\n') { i += 2; continue }
      if (i + 1 < raw.length) {
        const ch = raw[i + 1]
        pushLit(ch, true)
        i += 2
        continue
      }
      pushLit('\\', true)
      i++
      continue
    }
    if (c === '$') {
      const nxt = raw[i + 1]
      if (nxt === "'") {
        const end = findAnsiEnd(raw, i + 2)
        if (end < 0) { pushLit(raw.slice(i), true); break }
        const u = unescape(raw.slice(i + 2, end))
        pushLit(u.text, true)
        i = end + 1
        continue
      }
      if (nxt === '(') {
        if (raw[i + 2] === '(') {
          const end = scanBalanced(raw, i + 1, '(', ')')
          if (end < 0) { pushLit(raw.slice(i), false); break }
          const text = raw.slice(i + 3, end - 2)
          parts.push({ kind: 'arith', text, quoted: false })
          i = end
          continue
        }
        const end = scanBalanced(raw, i + 1, '(', ')')
        if (end < 0) { pushLit(raw.slice(i), false); break }
        parts.push({ kind: 'cmd', text: raw.slice(i + 2, end - 1), quoted: false })
        i = end
        continue
      }
      if (nxt === '{') {
        const end = scanBalanced(raw, i + 1, '{', '}')
        if (end < 0) { pushLit(raw.slice(i), false); break }
        parts.push({ kind: 'param', raw: raw.slice(i, end), quoted: false })
        i = end
        continue
      }
      if (nxt === undefined) { pushLit('$', false); i++; continue }
      if (/[0-9]/.test(nxt)) {
        parts.push({ kind: 'param', raw: '$' + nxt, quoted: false })
        i += 2
        continue
      }
      if (/[A-Za-z_]/.test(nxt)) {
        let j = i + 1
        while (j < raw.length && NAME_CHAR.test(raw[j])) j++
        parts.push({ kind: 'param', raw: raw.slice(i, j), quoted: false })
        i = j
        continue
      }
      if ('@*#?$!-0'.includes(nxt)) {
        parts.push({ kind: 'param', raw: '$' + nxt, quoted: false })
        i += 2
        continue
      }
      pushLit('$', false)
      i++
      continue
    }
    if (c === '`') {
      const end = scanBacktick(raw, i)
      if (end < 0) { pushLit(raw.slice(i), false); break }
      parts.push({ kind: 'cmd', text: raw.slice(i + 1, end - 1), quoted: false })
      i = end
      continue
    }
    if ((c === '<' || c === '>') && raw[i + 1] === '(') {
      const end = scanBalanced(raw, i + 1, '(', ')')
      if (end < 0) { pushLit(raw.slice(i), false); break }
      parts.push({ kind: 'proc', text: raw.slice(i + 2, end - 1), dir: c, quoted: false })
      i = end
      continue
    }
    pushLit(c, false)
    i++
  }
  return parts
}

function findAnsiEnd(raw: string, from: number): number {
  let i = from
  while (i < raw.length) {
    if (raw[i] === '\\') { i += 2; continue }
    if (raw[i] === "'") return i
    i++
  }
  return -1
}

function scanBacktick(raw: string, from: number): number {
  let i = from + 1
  while (i < raw.length) {
    if (raw[i] === '\\') { i += 2; continue }
    if (raw[i] === '`') return i + 1
    i++
  }
  return -1
}

// ---- parameter expansion -----------------------------------------------------------------------

function ifsOf(ctx: ExpandCtx): string {
  const v = ctx.getVar('IFS')
  return v ? v.value : ' \t\n'
}

async function paramValue(name: string, ctx: ExpandCtx): Promise<string> {
  if (/^[0-9]+$/.test(name)) {
    const n = Number(name)
    return ctx.positionals[n - 1] ?? ''
  }
  if (name === '@' || name === '*') return ctx.positionals.join(ifsOf(ctx)[0] ?? ' ')
  switch (name) {
    case '#': return String(ctx.positionals.length)
    case '?': return String(ctx.lastStatus)
    case '$': return ctx.pid
    case '0': return ctx.argv0
    case '!': return ''
  }
  const sp = ctx.getSpecial(name)
  if (sp !== undefined) return sp
  const v = ctx.getVar(name)
  if (!v) {
    if (ctx.nounset) throw new ExpandError(`${name}: unbound variable`)
    return ''
  }
  if (v.array) return v.array[0] ?? ''
  if (v.assoc) return v.value
  return v.value
}

async function paramArray(name: string, subscript: string, ctx: ExpandCtx): Promise<(string | undefined)[]> {
  const v = ctx.getVar(name)
  if (!v) return []
  if (subscript === '@' || subscript === '*') {
    if (v.array) return v.array
    if (v.assoc) return [...v.assoc.values()]
    return v.value === '' ? [] : [v.value]
  }
  if (v.assoc) return [v.assoc.get(subscript) ?? '']
  if (v.array) {
    const idx = subscript === '' ? 0 : evalArith(subscript, ctx.arithEnv)
    return [v.array[idx] ?? '']
  }
  const idx = subscript === '' ? 0 : evalArith(subscript, ctx.arithEnv)
  return idx === 0 ? [v.value] : ['']
}

async function expandParam(raw: string, quoted: boolean, ctx: ExpandCtx): Promise<Frag> {
  // raw is `$name` or `${body}`
  let body = raw
  if (body.startsWith('$')) body = body.slice(1)
  if (body.startsWith('{') && body.endsWith('}')) {
    body = body.slice(1, -1)
    const value = await expandParamBody(body, ctx)
    return { s: value, split: !quoted }
  }
  const value = await paramValue(body, ctx)
  return { s: value, split: !quoted }
}

async function expandParamBody(body: string, ctx: ExpandCtx): Promise<string> {
  // keys of array/assoc: ${!name[@]}
  const keysM = /^!([A-Za-z_][A-Za-z0-9_]*)\[@\]$/.exec(body)
  if (keysM) {
    const v = ctx.getVar(keysM[1])
    if (v?.assoc) return [...v.assoc.keys()].sort().join(ifsOf(ctx)[0] ?? ' ')
    if (v?.array) {
      const keys: string[] = []
      v.array.forEach((x, i) => { if (x !== undefined) keys.push(String(i)) })
      return keys.join(ifsOf(ctx)[0] ?? ' ')
    }
    return ''
  }
  // indirect ${!x}
  if (body.startsWith('!')) {
    const inner = await expandParamBody(body.slice(1), ctx)
    if (inner === '') return ''
    return paramValue(inner, ctx)
  }
  // length ${#x}
  if (body.startsWith('#')) {
    const rest = body.slice(1)
    const parsed = parseParamName(rest)
    if (parsed) {
      if (parsed.subscript === '@' || parsed.subscript === '*') {
        const v = ctx.getVar(parsed.name)
        if (v?.array) return String(v.array.filter((x) => x !== undefined).length)
        if (v?.assoc) return String(v.assoc.size)
        return String(ctx.positionals.length)
      }
      const s = await paramValue(parsed.name, ctx)
      return String(s.length)
    }
    return String((await paramValue(rest, ctx)).length)
  }
  const parsed = parseParamName(body)
  if (!parsed) return paramValue(body, ctx)
  const { name, subscript, op } = parsed
  // resolve base value
  let value: string
  let arr: (string | undefined)[] | null = null
  let assocKeys: string[] | null = null
  const v = ctx.getVar(name)
  if (subscript === '@' || subscript === '*') {
    if (name === '@' || name === '*') {
      arr = ctx.positionals
      value = ctx.positionals.join(ifsOf(ctx)[0] ?? ' ')
    } else if (v?.assoc) {
      if (op && op.startsWith('!')) { /* handled */ }
      assocKeys = [...v.assoc.keys()]
      arr = [...v.assoc.values()]
      value = arr.join(ifsOf(ctx)[0] ?? ' ')
    } else if (v?.array) {
      arr = v.array.filter((x) => x !== undefined)
      value = arr.join(ifsOf(ctx)[0] ?? ' ')
    } else {
      arr = v && v.value !== '' ? [v.value] : []
      value = v ? v.value : ''
    }
  } else if (subscript) {
    const a = await paramArray(name, subscript, ctx)
    value = a[0] ?? ''
    arr = a
  } else {
    value = await paramValue(name, ctx)
  }
  if (!op) return value
  return applyParamOp(name, value, arr, assocKeys, op, ctx)
}

function parseParamName(body: string): { name: string; subscript?: string; op?: string } | null {
  let i = 0
  let name = ''
  if (/^[0-9]+/.test(body)) {
    const m = /^[0-9]+/.exec(body)!
    name = m[0]
    i = m[0].length
  } else if (/^[A-Za-z_]/.test(body)) {
    let j = 0
    while (j < body.length && NAME_CHAR.test(body[j])) j++
    name = body.slice(0, j)
    i = j
  } else if ('@*#?$!-0'.includes(body[0] ?? '')) {
    name = body[0]
    i = 1
  } else {
    return null
  }
  let subscript: string | undefined
  let op: string | undefined
  if (body[i] === '[') {
    const end = findSubscriptEnd(body, i)
    if (end < 0) return { name }
    subscript = body.slice(i + 1, end)
    i = end + 1
  }
  if (i < body.length) op = body.slice(i)
  return { name, subscript, op }
}

function findSubscriptEnd(body: string, from: number): number {
  let depth = 0
  for (let i = from; i < body.length; i++) {
    const c = body[i]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

async function applyParamOp(name: string, value: string, arr: (string | undefined)[] | null, keys: string[] | null, op: string, ctx: ExpandCtx): Promise<string> {
  // op does not include the leading operator char position handled below via switch on first chars
  const unset = isParamUnset(name, ctx)
  const isNull = value === ''
  if (op.startsWith(':') && op.length > 1) {
    const o = op[1]
    const rest = op.slice(2)
    const useDefault = o === '-' || o === '=' || o === '?' || o === '+'
    const cond = o === '+' ? !(unset || isNull) : (unset || isNull)
    if (o === '+' && cond) return rest
    if (o === '-' && cond) return rest
    if (o === '=' && cond) { ctx.setVar(name, rest); return rest }
    if (o === '?' && cond) throw new ExpandError(`${name}: ${rest || 'parameter null or not set'}`)
    if (o === '+' && !cond) return ''
    if ((o === '-' || o === '=') && !cond) return value
    if (o === '?' && !cond) return value
    void useDefault
  }
  switch (op[0]) {
    case '-': return unset ? op.slice(1) : value
    case '=': if (unset) { ctx.setVar(name, op.slice(1)); return op.slice(1) } return value
    case '+': return unset || isNull ? '' : op.slice(1)
    case '?': if (unset || isNull) throw new ExpandError(`${name}: ${op.slice(1) || 'parameter null or not set'}`); return value
    case '#': case '%': {
      const longest = op[1] === op[0]
      const pat = op.slice(longest ? 2 : 1)
      return removePattern(value, pat, op[0] === '#', longest)
    }
    case '/': {
      const rest = op.slice(1)
      let all = false
      let anchor = ''
      let p = rest
      if (rest.startsWith('/')) { all = true; p = rest.slice(1) }
      else if (rest.startsWith('#')) { anchor = '#'; p = rest.slice(1) }
      else if (rest.startsWith('%')) { anchor = '%'; p = rest.slice(1) }
      const slash = findUnquotedSlash(p)
      if (slash < 0) {
        // ${x/pat} with no replacement: delete matches
        return replacePattern(value, p, '', all, anchor)
      }
      const pat = p.slice(0, slash)
      const rep = p.slice(slash + 1)
      return replacePattern(value, pat, rep, all, anchor)
    }
    case ':': {
      const m = /^:(-?\d*)?(:(-?\d*))?$/.exec(op)
      if (m) {
        const off = m[1] === undefined || m[1] === '' ? 0 : Number(m[1])
        const lenRaw = m[3]
        return substring(value, off, lenRaw === undefined ? undefined : Number(lenRaw))
      }
      return value
    }
    case '^': case ',': {
      const all = op[1] === op[0]
      const pat = op.slice(all ? 2 : 1) || '?'
      if (op[0] === '^') return caseChange(value, 'upper', all, pat)
      return caseChange(value, 'lower', all, pat)
    }
    default: return value
  }
}

function findUnquotedSlash(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') { i++; continue }
    if (c === '[') depth++
    else if (c === ']') depth--
    else if (c === '/' && depth === 0) return i
  }
  return -1
}

function removePattern(value: string, pat: string, prefix: boolean, longest: boolean): string {
  if (!pat) return value
  if (prefix) {
    if (longest) {
      for (let i = value.length; i >= 0; i--) {
        if (matchGlobPartial(pat, value.slice(0, i))) return value.slice(i)
      }
    } else {
      for (let i = 0; i <= value.length; i++) {
        if (matchGlobPartial(pat, value.slice(0, i))) return value.slice(i)
      }
    }
    return value
  }
  if (longest) {
    for (let i = 0; i <= value.length; i++) {
      if (matchGlobPartial(pat, value.slice(i))) return value.slice(0, i)
    }
  } else {
    for (let i = value.length; i >= 0; i--) {
      if (matchGlobPartial(pat, value.slice(i))) return value.slice(0, i)
    }
  }
  return value
}

function matchGlobPartial(pat: string, s: string): boolean {
  try {
    const re = globToRegExp(pat)
    return re.test(s)
  } catch {
    return false
  }
}

function replacePattern(value: string, pat: string, rep: string, all: boolean, anchor: string): string {
  if (!pat) return value
  const re = globSearchRe(pat, anchor)
  if (!re) return value
  try {
    const rx = new RegExp(re, 'g' + (all ? '' : ''))
    if (!all) {
      const m = rx.exec(value)
      if (!m) return value
      return value.slice(0, m.index) + rep + value.slice(m.index + m[0].length)
    }
    return value.replace(rx, rep)
  } catch {
    return value
  }
}

function globSearchRe(pat: string, anchor: string): string | null {
  try {
    const anchored = globToRegExp(pat)
    let src = anchored.source
    src = src.replace(/^\^/, '').replace(/\$$/, '')
    if (anchor === '#') src = '^' + src
    else if (anchor === '%') src = src + '$'
    return src
  } catch {
    return null
  }
}

function substring(value: string, off: number, len?: number): string {
  let start = off
  if (start < 0) start = Math.max(0, value.length + start)
  start = Math.min(start, value.length)
  if (len === undefined) return value.slice(start)
  let end: number
  if (len < 0) end = Math.max(start, value.length + len)
  else end = start + len
  end = Math.min(Math.max(end, start), value.length)
  return value.slice(start, end)
}

function caseChange(value: string, mode: 'upper' | 'lower', all: boolean, pat: string): string {
  const re = globSearchRe(pat, '')
  if (!re) return value
  try {
    const rx = new RegExp(re, 'g')
    if (!all) {
      const m = rx.exec(value)
      if (!m) return value
      const ch = mode === 'upper' ? m[0].toUpperCase() : m[0].toLowerCase()
      return value.slice(0, m.index) + ch + value.slice(m.index + m[0].length)
    }
    return value.replace(rx, (s) => mode === 'upper' ? s.toUpperCase() : s.toLowerCase())
  } catch {
    return value
  }
}

// ---- main entry points -------------------------------------------------------------------------

async function expandParts(raw: string, ctx: ExpandCtx): Promise<{ frags: Frag[]; noGlob: boolean }> {
  const flags = { noGlob: false }
  const parts = parseParts(raw, flags)
  const frags: Frag[] = []
  for (const p of parts) {
    if (p.kind === 'lit') frags.push({ s: p.text, split: false })
    else if (p.kind === 'param') {
      const f = await expandParam(p.raw, p.quoted, ctx)
      frags.push(f)
    } else if (p.kind === 'arith') {
      try {
        const n = evalArith(p.text, ctx.arithEnv)
        frags.push({ s: String(n), split: !p.quoted })
      } catch (e) {
        if (e instanceof ArithError) throw new ExpandError(e.message)
        throw e
      }
    } else if (p.kind === 'cmd') {
      const text = await ctx.runCapture(p.text)
      frags.push({ s: text, split: !p.quoted })
    } else if (p.kind === 'proc') {
      const path = await ctx.makeProcsub(p.text, p.dir)
      frags.push({ s: path, split: !p.quoted })
    }
  }
  return { frags, noGlob: flags.noGlob }
}

function splitFrags(frags: Frag[], ifs: string): string[] {
  let anySplit = false
  let all = ''
  for (const f of frags) { all += f.s; if (f.split) anySplit = true }
  if (!anySplit) return [all]
  if (all === '') return []
  const nonWs = [...ifs].filter((c) => !' \t\n'.includes(c))
  if (nonWs.length === 0) {
    return all.split(/[ \t\n]+/).filter((s) => s !== '')
  }
  const escaped = nonWs.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')
  const pieces = all.split(new RegExp(`[${escaped}]`))
  const out: string[] = []
  for (const piece of pieces) {
    for (const sub of piece.split(/[ \t\n]+/).filter((s) => s !== '')) out.push(sub)
  }
  return out
}

function globField(field: string, noGlob: boolean, ctx: ExpandCtx): string[] {
  if (noGlob || !hasGlob(field)) return [field]
  const matches = expandGlob(ctx.fs, ctx.cwd, field, ctx.home)
  return matches.length ? matches : [field]
}

export async function expandWord(raw: string, ctx: ExpandCtx): Promise<string[]> {
  // whole-word "$@" and "${arr[@]}" yield separate quoted words
  const special = wholeWordArray(raw, ctx)
  if (special) return special
  const variants = braceExpand(raw)
  const out: string[] = []
  for (const v of variants) {
    const text = await expandTilde(v, ctx)
    const { frags, noGlob } = await expandParts(text, ctx)
    const fields = splitFrags(frags, ifsOf(ctx))
    for (const f of fields) out.push(...globField(f, noGlob, ctx))
  }
  return out
}

/** One word without splitting or pathname expansion ([[ ]] operands). */
export async function expandWordLiteral(raw: string, ctx: ExpandCtx): Promise<string[]> {
  const special = wholeWordArray(raw, ctx)
  if (special) return special
  const variants = braceExpand(raw)
  const out: string[] = []
  for (const v of variants) {
    const text = await expandTilde(v, ctx)
    const { frags } = await expandParts(text, ctx)
    out.push(frags.map((f) => f.s).join(''))
  }
  return out
}

/** Heredoc body: parameter/command/arithmetic expansion, no splitting or globbing. */
export async function expandHeredocBody(raw: string, ctx: ExpandCtx): Promise<string> {
  const { frags } = await expandParts(raw, ctx)
  return frags.map((f) => f.s).join('')
}

function wholeWordArray(raw: string, ctx: ExpandCtx): string[] | null {
  if (raw === '"$@"') return ctx.positionals
  if (raw === '"$*"') return [ctx.positionals.join(ifsOf(ctx)[0] ?? ' ')]
  const m = /^"\$\{([A-Za-z_][A-Za-z0-9_]*)\[([@*])\]\}"$/.exec(raw)
  if (m) {
    const v = ctx.getVar(m[1])
    if (!v) return []
    const vals = v.assoc ? [...v.assoc.values()] : v.array ?? (v.value === '' ? [] : [v.value])
    if (m[2] === '*') return [vals.filter((x): x is string => x !== undefined).join(ifsOf(ctx)[0] ?? ' ')]
    return vals.filter((x): x is string => x !== undefined)
  }
  return null
}

async function expandTilde(raw: string, ctx: ExpandCtx): Promise<string> {
  if (!raw.startsWith('~')) return raw
  if (raw === '~') return ctx.home
  if (raw.startsWith('~/')) return ctx.home + raw.slice(1)
  if (raw === '~+') return ctx.cwd
  if (raw === '~-') return ctx.getVar('OLDPWD')?.value || ctx.cwd
  return raw
}

export async function expandWords(words: string[], ctx: ExpandCtx): Promise<string[]> {
  const out: string[] = []
  for (const w of words) out.push(...await expandWord(w, ctx))
  return out
}

/** Assignment values: tilde, params, cmdsub, arith, quote removal; no splitting/globbing. */
export async function expandAssignValue(raw: string, ctx: ExpandCtx): Promise<string> {
  const text = await expandTilde(raw, ctx)
  const { frags } = await expandParts(text, ctx)
  return frags.map((f) => f.s).join('')
}

function isParamUnset(name: string, ctx: ExpandCtx): boolean {
  if (/^[0-9]+$/.test(name)) return Number(name) > ctx.positionals.length
  if (['@', '*', '#', '?', '$', '!', '0'].includes(name)) return false
  return ctx.getVar(name) === undefined
}
