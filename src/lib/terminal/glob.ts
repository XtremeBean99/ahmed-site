import { VFS } from './vfs'

const CLASSES: Record<string, string> = {
  alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z',
  space: ' \\t\\n\\r\\f\\v', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9a-fA-F', word: 'a-zA-Z0-9_',
  cntrl: '\\x00-\\x1f\\x7f', print: '\\x20-\\x7e', graph: '\\x21-\\x7e',
}

/** Translate the inside of a bracket expression (text after `[`, up to but excluding `]`) to JS. */
export function bracketToJs(body: string): string {
  let neg = false
  let i = 0
  if (body[0] === '!' || body[0] === '^') { neg = true; i = 1 }
  let out = ''
  for (; i < body.length; i++) {
    const c = body[i]
    if (c === '[' && body[i + 1] === ':') {
      const end = body.indexOf(':]', i + 2)
      const name = end > 0 ? body.slice(i + 2, end) : ''
      if (CLASSES[name]) { out += CLASSES[name]; i = end + 1; continue }
    }
    if (c === '\\' || c === ']' || c === '[' || c === '^') out += '\\' + c
    else out += c
  }
  return '[' + (neg ? '^' : '') + out + ']'
}

/** Glob pattern (single path segment semantics: `*` and `?` never match `/`) to an anchored RegExp. */
export function globToRegExp(pattern: string, flags = ''): RegExp {
  let re = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '[') {
      let j = i + 1
      if (pattern[j] === '!' || pattern[j] === '^') j++
      if (pattern[j] === ']') j++
      while (j < pattern.length && pattern[j] !== ']') {
        if (pattern[j] === '[' && pattern[j + 1] === ':') { const e = pattern.indexOf(':]', j + 2); if (e > 0) j = e + 1 }
        j++
      }
      if (j >= pattern.length) re += '\\['
      else { re += bracketToJs(pattern.slice(i + 1, j)); i = j }
    } else if (c === '\\' && i + 1 < pattern.length) { re += pattern[++i].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') }
    else re += c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  }
  return new RegExp(re + '$', flags + 's')
}

export function matchGlob(pattern: string, name: string, flags = ''): boolean { return globToRegExp(pattern, flags).test(name) }
export function hasGlob(s: string): boolean { return /[*?[]/.test(s) }

/** Expand a glob against the filesystem. Returns matches in the same form as written (relative stays relative),
 *  sorted; hidden entries only match when the pattern segment itself starts with `.`. Empty array = no match. */
export function expandGlob(fs: VFS, cwd: string, pattern: string, home = '/home/guest'): string[] {
  if (!hasGlob(pattern)) return []
  const abs = pattern.startsWith('/')
  const segs = pattern.split('/').filter((s, i) => s !== '' || i === 0)
  let bases: { abs: string; shown: string }[] = [{ abs: abs ? '/' : cwd, shown: abs ? '/' : '' }]
  const segments = pattern.split('/').filter((s) => s !== '')
  void segs
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const last = i === segments.length - 1
    const next: { abs: string; shown: string }[] = []
    for (const b of bases) {
      if (!hasGlob(seg)) {
        const a = VFS.resolve(b.abs, seg, home)
        if (fs.exists(a) && (last || fs.isDir(a))) next.push({ abs: a, shown: b.shown + seg + (last ? '' : '/') })
        continue
      }
      let names: string[]
      try { names = fs.list(b.abs) } catch { continue }
      const re = globToRegExp(seg)
      for (const n of names) {
        if (n.startsWith('.') && !seg.startsWith('.')) continue
        if (!re.test(n)) continue
        const a = VFS.resolve(b.abs, n, home)
        if (!last && !fs.isDir(a)) continue
        next.push({ abs: a, shown: b.shown + n + (last ? '' : '/') })
      }
    }
    bases = next
  }
  return bases.map((b) => b.shown).sort()
}
