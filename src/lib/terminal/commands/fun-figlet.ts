// figlet / toilet / banner renderers.
// The figlet renderer is a compact port of the FIGlet horizontal smushing rules
// for the classic "standard" font (controlled smushing, rules 1-4).
import { FIGLET_STANDARD, FIGLET_HARDBLANK, FIGLET_HEIGHT } from './fun-font'

interface SmushOpts { hardBlank: string; height: number }

const RULE2 = '|/\\[]{}()<>'

function rule1(ch1: string, ch2: string, hard: string): string {
  return ch1 === ch2 && ch1 !== hard ? ch1 : ''
}
function rule2(ch1: string, ch2: string): string {
  if (ch1 === '_') return RULE2.includes(ch2) ? ch2 : ''
  if (ch2 === '_') return RULE2.includes(ch1) ? ch1 : ''
  return ''
}
function rule3(ch1: string, ch2: string): string {
  const classes = '| /\\ [] {} () <>'
  const p1 = classes.indexOf(ch1)
  const p2 = classes.indexOf(ch2)
  if (p1 !== -1 && p2 !== -1 && p1 !== p2 && Math.abs(p1 - p2) !== 1) {
    const s = Math.max(p1, p2)
    return classes.substring(s, s + 1)
  }
  return ''
}
function rule4(ch1: string, ch2: string): string {
  const s = '[] {} ()'
  const p1 = s.indexOf(ch1)
  const p2 = s.indexOf(ch2)
  if (p1 !== -1 && p2 !== -1 && Math.abs(p1 - p2) <= 1) return '|'
  return ''
}
function uniSmush(ch1: string, ch2: string, hard: string): string {
  if (ch2 === ' ' || ch2 === '') return ch1
  if (ch2 === hard && ch1 !== ' ') return ch1
  return ch2
}

/** Maximum overlap (smush amount) between two text lines under controlled smushing. */
function smushLength(txt1: string, txt2: string, opts: SmushOpts): number {
  const len1 = txt1.length
  const len2 = txt2.length
  let curDist = 1
  let breakAfter = false
  if (len1 === 0) return 0
  while (curDist <= len1) {
    const seg1 = txt1.substring(len1 - curDist)
    const seg2 = txt2.substring(0, Math.min(curDist, len2))
    for (let i = 0; i < Math.min(curDist, len2); i++) {
      const ch1 = seg1[i]
      const ch2 = seg2[i]
      if (ch1 !== ' ' && ch2 !== ' ') {
        breakAfter = true
        let next = rule1(ch1, ch2, opts.hardBlank)
        if (!next) next = rule2(ch1, ch2)
        if (!next) next = rule3(ch1, ch2)
        if (!next) next = rule4(ch1, ch2)
        if (!next) {
          curDist--
          return Math.min(len1, curDist)
        }
      }
    }
    if (breakAfter) break
    curDist++
  }
  return Math.min(len1, curDist)
}

function horizontalSmush(block1: string[], block2: string[], overlap: number, opts: SmushOpts): string[] {
  const out: string[] = []
  for (let i = 0; i < opts.height; i++) {
    const txt1 = block1[i]
    const txt2 = block2[i]
    const len1 = txt1.length
    const len2 = txt2.length
    const seg1 = txt1.substring(Math.max(0, len1 - overlap))
    const seg2 = txt2.substring(0, Math.min(overlap, len2))
    let piece = txt1.substring(0, Math.max(0, len1 - overlap))
    for (let j = 0; j < overlap; j++) {
      const ch1 = j < seg1.length ? seg1[j] : ' '
      const ch2 = j < seg2.length ? seg2[j] : ' '
      if (ch1 !== ' ' && ch2 !== ' ') {
        let next = rule1(ch1, ch2, opts.hardBlank)
        if (!next) next = rule2(ch1, ch2)
        if (!next) next = rule3(ch1, ch2)
        if (!next) next = rule4(ch1, ch2)
        piece += next || uniSmush(ch1, ch2, opts.hardBlank)
      } else {
        piece += uniSmush(ch1, ch2, opts.hardBlank)
      }
    }
    piece += overlap >= len2 ? '' : txt2.substring(overlap)
    out[i] = piece
  }
  return out
}

const FIGLET_OPTS: SmushOpts = { hardBlank: FIGLET_HARDBLANK, height: FIGLET_HEIGHT }

function glyphFor(ch: string): string[] | null {
  const c = ch.charCodeAt(0)
  if (c < 32 || c > 126) return null
  const g = FIGLET_STANDARD[c - 32]
  return g ? g.map((l) => l) : null
}

function replaceHardblanks(lines: string[]): string[] {
  return lines.map((l) => l.split(FIGLET_HARDBLANK).join(' '))
}

function linesWidth(lines: string[]): number {
  let m = 0
  for (const l of lines) if (l.length > m) m = l.length
  return m
}

function computeOverlap(current: string[], fig: string[]): number {
  let overlap = Number.MAX_SAFE_INTEGER
  for (let row = 0; row < FIGLET_HEIGHT; row++) {
    overlap = Math.min(overlap, smushLength(current[row], fig[row], FIGLET_OPTS))
  }
  return overlap === Number.MAX_SAFE_INTEGER ? 0 : overlap
}

/** Render text in the classic standard figlet font. Width <= 0 disables wrapping. */
export function renderFiglet(text: string, width: number): string[] {
  const out: string[] = []
  let current: string[] = new Array(FIGLET_HEIGHT).fill('')
  let charIndex = 0
  for (const ch of text) {
    const fig = glyphFor(ch)
    if (!fig) continue
    const overlap = computeOverlap(current, fig)
    if (width > 0 && charIndex > 0) {
      const trial = horizontalSmush(current, fig, overlap, FIGLET_OPTS)
      if (linesWidth(trial) >= width) {
        out.push(...replaceHardblanks(current))
        current = new Array(FIGLET_HEIGHT).fill('')
      }
    }
    current = horizontalSmush(current, fig, overlap, FIGLET_OPTS)
    charIndex++
  }
  if (linesWidth(current) > 0) out.push(...replaceHardblanks(current))
  return out
}

export function figletText(text: string, width: number): string {
  const lines = renderFiglet(text, width)
  return lines.length === 0 ? '' : lines.join('\n') + '\n'
}

// ---- banner (classic 7-row # letters) ------------------------------------------------------------

const BANNER: Record<string, string[]> = {}
function defBanner(ch: string, rows: string[]): void { BANNER[ch] = rows }

// Classic banner glyphs (7 rows). Widths vary; rows are padded by the renderer.
defBanner(' ', ['   ', '   ', '   ', '   ', '   ', '   ', '   '])
defBanner('A', ['  ##  ', ' #  # ', '#    #', '######', '#    #', '#    #', '#    #'])
defBanner('B', ['##### ', '#    #', '#    #', '##### ', '#    #', '#    #', '##### '])
defBanner('C', [' #####', '#     ', '#     ', '#     ', '#     ', '#     ', ' #####'])
defBanner('D', ['##### ', '#    #', '#    #', '#    #', '#    #', '#    #', '##### '])
defBanner('E', ['######', '#     ', '#     ', '##### ', '#     ', '#     ', '######'])
defBanner('F', ['######', '#     ', '#     ', '##### ', '#     ', '#     ', '#     '])
defBanner('G', [' #####', '#     ', '#     ', '#  ###', '#    #', '#    #', ' #####'])
defBanner('H', ['#    #', '#    #', '#    #', '######', '#    #', '#    #', '#    #'])
defBanner('I', ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'])
defBanner('J', [' #####', '    # ', '    # ', '    # ', '    # ', '#   # ', ' ###  '])
defBanner('K', ['#    #', '#   # ', '#  #  ', '###   ', '#  #  ', '#   # ', '#    #'])
defBanner('L', ['#     ', '#     ', '#     ', '#     ', '#     ', '#     ', '######'])
defBanner('M', ['#     #', '##   ##', '# # # #', '#  #  #', '#     #', '#     #', '#     #'])
defBanner('N', ['#     #', '##    #', '# #   #', '#  #  #', '#   # #', '#    ##', '#     #'])
defBanner('O', ['  ### ', ' #   #', '#     #', '#     #', '#     #', ' #   #', '  ### '])
defBanner('P', ['##### ', '#    #', '#    #', '##### ', '#     ', '#     ', '#     '])
defBanner('Q', ['  ### ', ' #   #', '#     #', '#     #', '#   # #', ' #  # ', '  ## #'])
defBanner('R', ['##### ', '#    #', '#    #', '##### ', '#  #  ', '#   # ', '#    #'])
defBanner('S', [' #####', '#     ', '#     ', ' #####', '     #', '     #', '##### '])
defBanner('T', ['######', '  #   ', '  #   ', '  #   ', '  #   ', '  #   ', '  #   '])
defBanner('U', ['#     #', '#     #', '#     #', '#     #', '#     #', '#     #', ' ##### '])
defBanner('V', ['#     #', '#     #', '#     #', ' #   # ', ' #   # ', '  # #  ', '   #   '])
defBanner('W', ['#     #', '#     #', '#     #', '#  #  #', '# # # #', '##   ##', '#     #'])
defBanner('X', ['#     #', ' #   # ', '  # #  ', '   #   ', '  # #  ', ' #   # ', '#     #'])
defBanner('Y', ['#     #', ' #   # ', '  # #  ', '   #   ', '   #   ', '   #   ', '   #   '])
defBanner('Z', ['######', '     #', '    # ', '   #  ', '  #   ', ' #    ', '######'])
defBanner('0', ['  ### ', ' #   #', '#    #', '#    #', '#    #', ' #   #', '  ### '])
defBanner('1', ['  #   ', ' ##   ', '  #   ', '  #   ', '  #   ', '  #   ', '##### '])
defBanner('2', [' #### ', '#    #', '     #', '   ## ', '  #   ', ' #    ', '######'])
defBanner('3', ['##### ', '     #', '     #', '  ####', '     #', '     #', '##### '])
defBanner('4', ['#    #', '#    #', '#    #', '######', '     #', '     #', '     #'])
defBanner('5', ['######', '#     ', '#     ', '##### ', '     #', '     #', '##### '])
defBanner('6', [' #####', '#     ', '#     ', '######', '#    #', '#    #', ' #####'])
defBanner('7', ['######', '     #', '    # ', '   #  ', '  #   ', '  #   ', '  #   '])
defBanner('8', [' #####', '#    #', '#    #', ' #####', '#    #', '#    #', ' #####'])
defBanner('9', [' #####', '#    #', '#    #', '######', '     #', '     #', ' #####'])
defBanner('-', ['      ', '      ', '      ', '######', '      ', '      ', '      '])
defBanner('.', ['      ', '      ', '      ', '      ', '      ', '  ##  ', '  ##  '])
defBanner('_', ['      ', '      ', '      ', '      ', '      ', '      ', '######'])

/** Classic `banner`: 7-row `#` letters, uppercase only, two spaces between glyphs. */
export function renderBanner(text: string, width: number): string[] {
  const glyphs: string[][] = []
  for (const raw of text.toUpperCase()) {
    const g = BANNER[raw] ?? BANNER[' ']
    glyphs.push(g)
  }
  if (glyphs.length === 0) return []
  const out: string[] = []
  let current: string[][] = []
  for (const g of glyphs) {
    const trial = current.concat([g])
    const trialWidth = trial.reduce((w, gl) => w + gl[0].length, 0) + (trial.length - 1) * 2
    if (width > 0 && trialWidth > width && current.length > 0) {
      out.push(...joinBannerRow(current))
      current = []
    }
    current.push(g)
  }
  if (current.length > 0) out.push(...joinBannerRow(current))
  return out
}

function joinBannerRow(glyphs: string[][]): string[] {
  const rows: string[] = []
  for (let r = 0; r < 7; r++) {
    rows.push(glyphs.map((g) => g[r]).join('  '))
  }
  return rows
}

export function bannerText(text: string, width: number): string {
  const lines = renderBanner(text, width)
  return lines.length === 0 ? '' : lines.join('\n') + '\n'
}
