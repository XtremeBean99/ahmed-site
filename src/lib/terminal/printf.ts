/** Backslash escapes as in `echo -e` / printf formats. `\c` stops output (returns stop=true). */
export function unescape(s: string): { text: string; stop: boolean } {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) { out += c; continue }
    const n = s[++i]
    switch (n) {
      case 'n': out += '\n'; break
      case 't': out += '\t'; break
      case 'r': out += '\r'; break
      case 'a': out += '\x07'; break
      case 'b': out += '\b'; break
      case 'f': out += '\f'; break
      case 'v': out += '\v'; break
      case 'e': case 'E': out += '\x1b'; break
      case '\\': out += '\\'; break
      case 'c': return { text: out, stop: true }
      case 'x': { const m = /^[0-9a-fA-F]{1,2}/.exec(s.slice(i + 1)); if (m) { out += String.fromCharCode(parseInt(m[0], 16)); i += m[0].length } else out += '\\x'; break }
      case 'u': { const m = /^[0-9a-fA-F]{1,4}/.exec(s.slice(i + 1)); if (m) { out += String.fromCharCode(parseInt(m[0], 16)); i += m[0].length } else out += '\\u'; break }
      case '0': { const m = /^[0-7]{0,3}/.exec(s.slice(i + 1))!; out += String.fromCharCode(parseInt(m[0] || '0', 8)); i += m[0].length; break }
      default: out += '\\' + n
    }
  }
  return { text: out, stop: false }
}

function num(s: string | undefined): number {
  if (s === undefined || s === '') return 0
  if (/^['"]./.test(s)) return s.charCodeAt(1)
  const n = /^0x/i.test(s) ? parseInt(s, 16) : /^0[0-7]+$/.test(s) ? parseInt(s, 8) : Number(s)
  return Number.isNaN(n) ? 0 : n
}

/** Bash-style printf: the format is reused while arguments remain. */
export function formatPrintf(fmt: string, args: string[]): string {
  let out = ''
  let ai = 0
  const spec = /%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+))?([diouxXeEfFgGcsbq%])/g
  for (;;) {
    let last = 0
    let consumed = false
    let stop = false
    spec.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = spec.exec(fmt))) {
      const u = unescape(fmt.slice(last, m.index))
      out += u.text
      if (u.stop) { stop = true; break }
      last = m.index + m[0].length
      const [, flags, wRaw, pRaw, conv] = m
      if (conv === '%') { out += '%'; continue }
      let width = wRaw === '*' ? num(args[ai++]) : wRaw ? Number(wRaw) : 0
      const prec = pRaw === '*' ? num(args[ai++]) : pRaw !== undefined ? Number(pRaw) : undefined
      let left = flags.includes('-')
      if (width < 0) { left = true; width = -width }
      const arg = args[ai++]
      consumed = true
      let s: string
      switch (conv) {
        case 'd': case 'i': { const n = Math.trunc(num(arg)); s = String(Math.abs(n)); if (prec !== undefined) s = s.padStart(prec, '0'); s = (n < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '') + s; break }
        case 'u': s = String(Math.abs(Math.trunc(num(arg)))); break
        case 'o': s = (Math.trunc(num(arg)) >>> 0).toString(8); if (flags.includes('#')) s = '0' + s; break
        case 'x': s = (Math.trunc(num(arg)) >>> 0).toString(16); if (flags.includes('#')) s = '0x' + s; break
        case 'X': s = (Math.trunc(num(arg)) >>> 0).toString(16).toUpperCase(); if (flags.includes('#')) s = '0X' + s; break
        case 'f': case 'F': { const n = num(arg); s = n.toFixed(prec ?? 6); if (n >= 0 && flags.includes('+')) s = '+' + s; break }
        case 'e': case 'E': { s = num(arg).toExponential(prec ?? 6).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') s = s.toUpperCase(); break }
        case 'g': case 'G': { const p = prec ?? 6; s = String(Number(num(arg).toPrecision(p || 1))); if (conv === 'G') s = s.toUpperCase(); break }
        case 'c': s = (arg ?? '').slice(0, 1); break
        case 'b': { const u2 = unescape(arg ?? ''); s = u2.text; break }
        case 'q': s = "'" + (arg ?? '').replace(/'/g, "'\\''") + "'"; break
        default: s = arg ?? ''; if (prec !== undefined) s = s.slice(0, prec)
      }
      if (s.length < width) {
        if (left) s = s.padEnd(width)
        else if (flags.includes('0') && 'diufFeEgGxXo'.includes(conv)) { const sign = /^[-+ ]/.test(s) ? s[0] : ''; s = sign + s.slice(sign.length).padStart(width - sign.length, '0') }
        else s = s.padStart(width)
      }
      out += s
    }
    if (stop) return out
    out += unescape(fmt.slice(last)).text
    if (!consumed || ai >= args.length) return out
  }
}
