// Minimal ANSI SGR parser: one output line (raw string with ESC sequences) -> styled spans.

export interface Span { t: string; fg?: string; bg?: string; bold?: boolean; dim?: boolean; ul?: boolean; inv?: boolean }

const BASE = ['#000000', '#e05555', '#35e65c', '#e6c235', '#5c8de6', '#c86be6', '#35d6e6', '#d0d0d0']
const BRIGHT = ['#6b6b6b', '#ff7b7b', '#7dff9b', '#fff17b', '#8fb4ff', '#e79bff', '#7bf0ff', '#ffffff']

/** xterm 256-colour palette entry as CSS colour. */
export function color256(n: number): string {
  if (n < 8) return BASE[n]
  if (n < 16) return BRIGHT[n - 8]
  if (n < 232) {
    const i = n - 16
    const c = (v: number) => (v === 0 ? 0 : 55 + v * 40)
    return `rgb(${c(Math.floor(i / 36))},${c(Math.floor(i / 6) % 6)},${c(i % 6)})`
  }
  const g = 8 + (n - 232) * 10
  return `rgb(${g},${g},${g})`
}

const CSI = /\x1b\[([0-9;?]*)([A-Za-z])/g

export function parseAnsi(line: string): Span[] {
  const spans: Span[] = []
  let st: Omit<Span, 't'> = {}
  let last = 0
  const push = (t: string) => { if (t) spans.push({ t, ...st }) }
  CSI.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CSI.exec(line))) {
    push(line.slice(last, m.index))
    last = m.index + m[0].length
    if (m[2] !== 'm') continue // cursor movement / erase: ignored
    const p = m[1] === '' ? [0] : m[1].split(';').map((x) => Number(x) || 0)
    for (let i = 0; i < p.length; i++) {
      const c = p[i]
      if (c === 0) st = {}
      else if (c === 1) st = { ...st, bold: true }
      else if (c === 2) st = { ...st, dim: true }
      else if (c === 4) st = { ...st, ul: true }
      else if (c === 7) st = { ...st, inv: true }
      else if (c === 22) st = { ...st, bold: false, dim: false }
      else if (c === 24) st = { ...st, ul: false }
      else if (c === 27) st = { ...st, inv: false }
      else if (c >= 30 && c <= 37) st = { ...st, fg: st.bold ? BRIGHT[c - 30] : BASE[c - 30] }
      else if (c >= 90 && c <= 97) st = { ...st, fg: BRIGHT[c - 90] }
      else if (c >= 40 && c <= 47) st = { ...st, bg: BASE[c - 40] }
      else if (c >= 100 && c <= 107) st = { ...st, bg: BRIGHT[c - 100] }
      else if (c === 39) st = { ...st, fg: undefined }
      else if (c === 49) st = { ...st, bg: undefined }
      else if ((c === 38 || c === 48) && p[i + 1] === 5) { const col = color256(p[i + 2] ?? 0); st = c === 38 ? { ...st, fg: col } : { ...st, bg: col }; i += 2 }
      else if ((c === 38 || c === 48) && p[i + 1] === 2) { const col = `rgb(${p[i + 2] ?? 0},${p[i + 3] ?? 0},${p[i + 4] ?? 0})`; st = c === 38 ? { ...st, fg: col } : { ...st, bg: col }; i += 4 }
    }
  }
  push(line.slice(last))
  return spans
}

/** Strip every escape sequence (for measuring / copying). */
export function stripAnsi(s: string): string { return s.replace(CSI, '') }

/** Append terminal output to a scrollback array of lines (the last element is the unfinished line). */
export function appendOutput(lines: string[], text: string, max = 3000): string[] {
  const parts = text.replace(/\r\n/g, '\n').replace(/\r/g, '').split('\n')
  const out = lines.length ? lines.slice() : ['']
  out[out.length - 1] += parts[0]
  for (let i = 1; i < parts.length; i++) out.push(parts[i])
  return out.length > max ? out.slice(out.length - max) : out
}
