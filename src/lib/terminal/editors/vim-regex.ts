// Vim-flavoured regex translation and :substitute replacement expansion.
// Vim "magic" mode: \ ( ) | + ? { } are special only when backslash-prefixed,
// while . * [ ] ^ $ behave like JS. We translate to a JS RegExp source string.
import { bracketToJs } from '../glob'

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g
const esc = (c: string): string => c.replace(REGEX_SPECIAL, '\\$&')

function readClass(pattern: string, i: number): { js: string; next: number } | null {
  // pattern[i] is '['. Find the matching ']', skipping POSIX classes [:alpha:].
  let j = i + 1
  while (j < pattern.length) {
    const c = pattern[j]
    if (c === '\\') { j += 2; continue }
    if (c === '[' && pattern[j + 1] === ':') {
      const end = pattern.indexOf(':]', j + 2)
      if (end > 0) { j = end + 2; continue }
    }
    if (c === ']') return { js: bracketToJs(pattern.slice(i + 1, j)), next: j }
    j++
  }
  return null
}

export interface VimRegex { source: string; flags: string }

/** Translate a vim pattern (magic mode) into a JS RegExp. Throws on a bad pattern. */
export function vimRegexToJs(pattern: string, opts: { icase?: boolean; smartcase?: boolean } = {}): VimRegex {
  let out = ''
  let forceIcase: boolean | null = null
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    const atStart = out === '' || out.endsWith('(') || out.endsWith('|')
    if (c === '\\' && i + 1 < pattern.length) {
      const n = pattern[++i]
      switch (n) {
        case '(': case ')': case '|': case '+': case '{': case '}': out += n; break
        case '?': case '=': out += '?'; break
        case '<': case '>': out += '\\b'; break
        case 'c': forceIcase = true; break
        case 'C': forceIcase = false; break
        case 'd': case 'D': case 's': case 'S': case 'w': case 'W': case 'n': case 'r': case 't': case 'b':
          out += '\\' + n; break
        case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
          out += '\\' + n; break
        case 'z':
          if (pattern[i + 1] === 's') { i++; break } // \zs not supported: match start stays at pattern start
          out += 'z'; break
        case 'v': case 'V': break // very magic / very nomagic not supported
        default: out += esc(n)
      }
      continue
    }
    if (c === '[') {
      const cls = readClass(pattern, i)
      if (cls) { out += cls.js; i = cls.next } else out += '\\['
      continue
    }
    if (c === '.') out += '.'
    else if (c === '*') out += atStart ? '\\*' : '*'
    else if (c === '^') out += atStart ? '^' : '\\^'
    else if (c === '$') {
      const next = pattern[i + 1]
      const beforeGroupEnd = next !== undefined && (next === '\\' && pattern[i + 2] === ')')
      const beforeAlt = next !== undefined && (next === '\\' && pattern[i + 2] === '|')
      out += next === undefined || beforeGroupEnd || beforeAlt ? '$' : '\\$'
    }
    else if ('+?(){}|~'.includes(c)) out += '\\' + c
    else out += esc(c)
  }
  const ic = forceIcase !== null ? forceIcase : !!opts.icase
  let useIcase = ic
  if (useIcase && opts.smartcase && hasUpper(pattern)) useIcase = false
  return { source: out, flags: useIcase ? 'i' : '' }
}

function hasUpper(pattern: string): boolean {
  // Ignore escaped sequences while looking for literal uppercase.
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') { i++; continue }
    if (/[A-Z]/.test(pattern[i])) return true
  }
  return false
}

/** Expand a :s replacement template. `m` is the match; `m[0]` is the whole match. */
export function expandSubReplacement(template: string, groups: { [n: number]: string | undefined }, whole: string): string {
  let out = ''
  let mode: '' | 'u' | 'l' | 'U' | 'L' = ''
  const push = (s: string): void => {
    for (const ch of s) {
      if (mode === 'u') { out += ch.toUpperCase(); mode = '' }
      else if (mode === 'l') { out += ch.toLowerCase(); mode = '' }
      else if (mode === 'U') out += ch.toUpperCase()
      else if (mode === 'L') out += ch.toLowerCase()
      else out += ch
    }
  }
  for (let i = 0; i < template.length; i++) {
    const c = template[i]
    if (c === '&') { push(whole); continue }
    if (c === '\\' && i + 1 < template.length) {
      const n = template[++i]
      if (n === '0') push(whole)
      else if (n >= '1' && n <= '9') push(groups[Number(n)] ?? '')
      else if (n === 'n') push('\n')
      else if (n === 'r') push('\r')
      else if (n === 't') push('\t')
      else if (n === 'u') mode = 'u'
      else if (n === 'l') mode = 'l'
      else if (n === 'U') mode = 'U'
      else if (n === 'L') mode = 'L'
      else if (n === 'e' || n === 'E') mode = ''
      else push(n)
      continue
    }
    push(c)
  }
  return out
}
