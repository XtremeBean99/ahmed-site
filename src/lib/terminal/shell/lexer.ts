// Tokenizer for shell source. Produces a flat token stream with heredoc bodies attached to `<<` operators.
export interface Heredoc { delim: string; quoted: boolean; stripTabs: boolean; body: string }

export type Tok =
  | { kind: 'word'; text: string }
  | { kind: 'op'; op: string; heredoc?: Heredoc }
  | { kind: 'newline' }
  | { kind: 'eof' }

export interface LexResult { tokens: Tok[]; incomplete: boolean }

interface PendingHere { tok: Tok & { kind: 'op' }; delim: string; quoted: boolean; stripTabs: boolean }

const METACHARS = ';&|<>()'

export function lex(src: string): LexResult {
  const tokens: Tok[] = []
  let i = 0
  let incomplete = false
  const pending: PendingHere[] = []

  const readHeredocBodies = (): void => {
    for (const h of pending) {
      let body = ''
      let found = false
      while (i < src.length) {
        const nl = src.indexOf('\n', i)
        const line = nl < 0 ? src.slice(i) : src.slice(i, nl)
        i = nl < 0 ? src.length : nl + 1
        const text = line.replace(/\r$/, '')
        const cmp = h.stripTabs ? text.replace(/^\t+/, '') : text
        if (cmp === h.delim) { found = true; break }
        body += (h.stripTabs ? text.replace(/^\t+/, '') : text) + '\n'
      }
      if (!found) { incomplete = true; break }
      h.tok.heredoc = { delim: h.delim, quoted: h.quoted, stripTabs: h.stripTabs, body }
    }
    pending.length = 0
  }

  // Balanced group scanners return the index just past the closing character, or -1.
  const skipBalanced = (openIdx: number, open: string, close: string, isDollar: boolean): number => {
    // openIdx points at the opening char. When isDollar, a `$` precedes it and `${`/`$(` subtleties apply.
    let depth = 0
    let j = openIdx
    while (j < src.length) {
      const c = src[j]
      if (c === '\\') { j += 2; continue }
      if (c === "'") {
        j++
        while (j < src.length && src[j] !== "'") j++
        if (j >= src.length) return -1
        j++
        continue
      }
      if (c === '"') {
        j++
        while (j < src.length) {
          const d = src[j]
          if (d === '\\') { j += 2; continue }
          if (d === '"') break
          if (d === '$') {
            const nxt = src[j + 1]
            if (nxt === '(') { const e = skipBalanced(j + 1, '(', ')', true); if (e < 0) return -1; j = e; continue }
            if (nxt === '{') { const e = skipBalanced(j + 1, '{', '}', true); if (e < 0) return -1; j = e; continue }
          }
          j++
        }
        if (j >= src.length) return -1
        j++
        continue
      }
      if (c === '`' && open !== '`') {
        j++
        while (j < src.length && src[j] !== '`') {
          if (src[j] === '\\') j++
          j++
        }
        if (j >= src.length) return -1
        j++
        continue
      }
      if (c === '$') {
        const nxt = src[j + 1]
        if (nxt === "'") {
          j += 2
          while (j < src.length) {
            if (src[j] === '\\') { j += 2; continue }
            if (src[j] === "'") { j++; break }
            j++
          }
          if (j >= src.length) return -1
          continue
        }
        if (nxt === '(') {
          const e = skipBalanced(j + 1, '(', ')', true)
          if (e < 0) return -1
          j = e
          continue
        }
        if (nxt === '{') {
          const e = skipBalanced(j + 1, '{', '}', true)
          if (e < 0) return -1
          j = e
          continue
        }
        j++
        continue
      }
      if (c === close && depth > 0) {
        depth--
        if (depth === 0) return j + 1
        j++
        continue
      }
      if (c === open) { depth++; j++; continue }
      j++
    }
    return -1
  }

  const scanWord = (): string => {
    const out: string[] = []
    const stop = false
    while (i < src.length && !stop) {
      const c = src[i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') break
      if (METACHARS.includes(c)) break
      if (c === '\\') {
        if (src[i + 1] === '\n') { i += 2; continue }
        if (i + 1 < src.length) { out.push(src[i], src[i + 1]); i += 2; continue }
        incomplete = true
        out.push(c); i++; break
      }
      if (c === "'") {
        const start = i
        i++
        while (i < src.length && src[i] !== "'") i++
        if (i >= src.length) { incomplete = true; out.push(src.slice(start)); i = src.length; break }
        i++
        out.push(src.slice(start, i))
        continue
      }
      if (c === '"') {
        const start = i
        i++
        let closed = false
        while (i < src.length) {
          const d = src[i]
          if (d === '"') { i++; closed = true; break }
          if (d === '\\') { i += 2; continue }
          if (d === '$') {
            const nxt = src[i + 1]
            if (nxt === '(') { const e = skipBalanced(i + 1, '(', ')', true); if (e < 0) { incomplete = true; i = src.length; break } i = e; continue }
            if (nxt === '{') { const e = skipBalanced(i + 1, '{', '}', true); if (e < 0) { incomplete = true; i = src.length; break } i = e; continue }
          }
          if (d === '`') {
            const e = skipBalanced(i, '`', '`', false)
            if (e < 0) { incomplete = true; i = src.length; break }
            i = e
            continue
          }
          i++
        }
        if (!closed) { incomplete = true; out.push(src.slice(start)); break }
        out.push(src.slice(start, i))
        continue
      }
      if (c === '$') {
        const nxt = src[i + 1]
        if (nxt === "'") {
          const start = i
          i += 2
          let closed = false
          while (i < src.length) {
            if (src[i] === '\\') { i += 2; continue }
            if (src[i] === "'") { i++; closed = true; break }
            i++
          }
          if (!closed) { incomplete = true; out.push(src.slice(start)); i = src.length; break }
          out.push(src.slice(start, i))
          continue
        }
        if (nxt === '(') {
          const start = i
          const e = skipBalanced(i + 1, '(', ')', true)
          if (e < 0) { incomplete = true; out.push(src.slice(start)); i = src.length; break }
          i = e
          out.push(src.slice(start, i))
          continue
        }
        if (nxt === '{') {
          const start = i
          const e = skipBalanced(i + 1, '{', '}', true)
          if (e < 0) { incomplete = true; out.push(src.slice(start)); i = src.length; break }
          i = e
          out.push(src.slice(start, i))
          continue
        }
      }
      if (c === '`') {
        const start = i
        const e = skipBalanced(i, '`', '`', false)
        if (e < 0) { incomplete = true; out.push(src.slice(start)); i = src.length; break }
        i = e
        out.push(src.slice(start, i))
        continue
      }
      out.push(c)
      i++
    }
    return out.join('')
  }

  const lexOp = (): string => {
    const s = src
    const rest = s.slice(i)
    const m = /^(\d+)(>>|<<-|<<|>&|<&|>|<)/.exec(rest)
    if (m && m[2] !== '<<' && m[2] !== '<<-') { i += m[0].length; return m[0] }
    const pairs = ['&&', '||', ';&', ';;', '|&', '<<-', '<<<', '<<', '&>>', '&>', '>>', '>&', '<&', '<>', '>|']
    for (const p of pairs) {
      if (rest.startsWith(p)) { i += p.length; return p }
    }
    const single = '()<>&|;'
    if (single.includes(s[i])) { i++; return s[i - 1] }
    return ''
  }

  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }
    if (c === '\n') {
      i++
      if (pending.length) readHeredocBodies()
      if (incomplete) break
      tokens.push({ kind: 'newline' })
      continue
    }
    if (c === '\\' && src[i + 1] === '\n') {
      i += 2
      if (i >= src.length) incomplete = true
      continue
    }
    if (c === '#') {
      const nl = src.indexOf('\n', i)
      i = nl < 0 ? src.length : nl
      continue
    }
    if (/[0-9]/.test(c)) {
      const m = /^(\d+)(>>|>&|<&|>|<)/.exec(src.slice(i))
      if (m) { i += m[0].length; tokens.push({ kind: 'op', op: m[0] }); continue }
    }
    if (METACHARS.includes(c)) {
      const op = lexOp()
      if (!op) { incomplete = true; break }
      if (op === '<<' || op === '<<-') {
        // consume the delimiter word immediately
        let j = i
        while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++
        if (j >= src.length || src[j] === '\n') { incomplete = true; break }
        i = j
        const raw = scanWord()
        if (incomplete) break
        const info = unquoteDelim(raw)
        const tok: Tok & { kind: 'op' } = { kind: 'op', op }
        tokens.push(tok)
        pending.push({ tok, delim: info.text, quoted: info.quoted, stripTabs: op === '<<-' })
        continue
      }
      tokens.push({ kind: 'op', op })
      continue
    }
    const raw = scanWord()
    if (raw.length === 0 && incomplete) break
    tokens.push({ kind: 'word', text: raw })
  }

  if (pending.length && !incomplete) {
    // a heredoc whose body never arrived
    if (i >= src.length) incomplete = true
  }
  if (incomplete) return { tokens, incomplete: true }
  tokens.push({ kind: 'eof' })
  return { tokens, incomplete: false }
}

/** Extract a heredoc delimiter: remove quotes/backslashes; `quoted` = any quoting present. */
function unquoteDelim(raw: string): { text: string; quoted: boolean } {
  let out = ''
  let quoted = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '\\' && i + 1 < raw.length) { out += raw[++i]; quoted = true; continue }
    if (c === "'") {
      quoted = true
      const end = raw.indexOf("'", i + 1)
      if (end < 0) { out += raw.slice(i + 1); break }
      out += raw.slice(i + 1, end)
      i = end
      continue
    }
    if (c === '"') {
      quoted = true
      const end = raw.indexOf('"', i + 1)
      if (end < 0) { out += raw.slice(i + 1); break }
      out += raw.slice(i + 1, end)
      i = end
      continue
    }
    out += c
  }
  return { text: out, quoted }
}
