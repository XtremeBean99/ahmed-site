import { bracketToJs } from './glob'

/** Translate a POSIX regular expression (BRE by default, ERE with `ere`) to a JS source string. */
export function posixToJs(p: string, ere = false): string {
  let out = ''
  let atStart = true // start of RE / after ( or | : where BRE `*` is literal and `^` is an anchor
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    const wasStart = atStart
    atStart = false
    if (c === '\\' && i + 1 < p.length) {
      const n = p[++i]
      if (!ere && n === '(') { out += '('; atStart = true }
      else if (!ere && n === ')') out += ')'
      else if (!ere && n === '{') { const e = p.indexOf('\\}', i); if (e > 0) { out += '{' + p.slice(i + 1, e) + '}'; i = e + 1 } else out += '\\{' }
      else if (!ere && n === '|') { out += '|'; atStart = true }
      else if (!ere && (n === '+' || n === '?')) out += n
      else if (n === '<' || n === '>') out += '\\b'
      else if ('bBwWsSdDntr'.includes(n) || /[1-9]/.test(n)) out += '\\' + n
      else out += n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
      continue
    }
    if (c === '[') {
      let j = i + 1
      if (p[j] === '^') j++
      if (p[j] === ']') j++
      while (j < p.length && p[j] !== ']') {
        if (p[j] === '[' && (p[j + 1] === ':' || p[j + 1] === '.' || p[j + 1] === '=')) { const e = p.indexOf(p[j + 1] + ']', j + 2); if (e > 0) j = e + 1 }
        j++
      }
      if (j >= p.length) out += '\\['
      else { out += bracketToJs(p.slice(i + 1, j)); i = j }
      continue
    }
    if (c === '*') { out += wasStart && !ere ? '\\*' : '*'; continue }
    if (c === '.') { out += '.'; continue }
    if (c === '^') { out += ere || wasStart ? '^' : '\\^'; if (ere) atStart = true; else if (wasStart) atStart = true; continue }
    if (c === '$') { out += ere || i === p.length - 1 || p.startsWith('\\)', i + 1) || p.startsWith('\\|', i + 1) ? '$' : '\\$'; continue }
    if (ere) {
      if (c === '(') { out += '('; atStart = true; continue }
      if (c === '|') { out += '|'; atStart = true; continue }
      if (c === '{') { const m = /^\{\d*(,\d*)?\}/.exec(p.slice(i)); if (m) { out += m[0]; i += m[0].length - 1 } else out += '\\{'; continue }
      if (c === ')' || c === '+' || c === '?') { out += c; continue }
    }
    out += c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  }
  return out
}

/** Compile a POSIX regex. `fixed` = literal string (grep -F). Throws SyntaxError on a bad pattern. */
export function compilePosix(pattern: string, opts: { ere?: boolean; icase?: boolean; fixed?: boolean; global?: boolean } = {}): RegExp {
  const src = opts.fixed ? pattern.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') : posixToJs(pattern, !!opts.ere)
  return new RegExp(src, (opts.icase ? 'i' : '') + (opts.global ? 'g' : ''))
}
