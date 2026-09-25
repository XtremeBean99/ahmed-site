import type { Editor, EditorHost, KeyInput, Run, Screen } from '../types'

// Pure, DOM-free state machine that mimics GNU nano 7.x closely enough for the site terminal.
// The UI draws render() in a monospace grid and forwards keyboard events as KeyInput.

type Style = NonNullable<Run['s']>
interface Pos { r: number; c: number }
interface Prompt { kind: PromptKind; text: string; answer: string; cur: number }
type PromptKind =
  | 'search' | 'replaceSearch' | 'replaceWith' | 'replaceInstance'
  | 'writeFile' | 'readFile' | 'goto' | 'exitSave' | 'overwrite'
interface Cell { ch: string; s: Style | null }
interface HistEntry { lines: string[]; cursor: Pos; mark: Pos | null }
interface MatchRange { start: Pos; end: Pos }
interface ReplaceOcc { start: number; end: number }

const TITLE_LEFT = '  GNU nano 7.2'
const LINE1: Array<[string, string]> = [
  ['^G', ' Help'], ['^O', ' Write Out'], ['^W', ' Where Is'],
  ['^K', ' Cut'], ['^T', ' Execute'], ['^C', ' Location'],
]
const LINE2: Array<[string, string]> = [
  ['^X', ' Exit'], ['^R', ' Read File'], ['^\\', ' Replace'],
  ['^U', ' Paste'], ['^J', ' Justify'], ['^/', ' Go To Line'],
]

function posEq(a: Pos, b: Pos): boolean { return a.r === b.r && a.c === b.c }
function posLe(a: Pos, b: Pos): boolean { return a.r < b.r || (a.r === b.r && a.c <= b.c) }
function isWordChar(ch: string): boolean { return /[A-Za-z0-9_]/.test(ch) }

function countLines(content: string): number {
  if (content === '') return 0
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
}

function contentToLines(content: string): string[] {
  if (content === '') return ['']
  const parts = content.split('\n')
  if (parts[parts.length - 1] === '') parts.pop()
  return parts
}

function tabVCol(line: string, col: number): number {
  let v = 0
  const end = Math.min(col, line.length)
  for (let i = 0; i < end; i++) v += line[i] === '\t' ? 8 - (v % 8) : 1
  return v
}

const HELP_TEXT: string[] = [
  '  GNU nano 7.2  Help',
  '',
  '  ^G  Help            ^O  Write Out        ^W  Where Is',
  '  ^X  Exit            ^R  Read File        ^\\  Replace',
  '  ^K  Cut             ^U  Paste            ^J  Justify',
  '  ^C  Location        ^T  Execute',
  '',
  '  Movement:',
  '  ^B / ^F  back / forward one character',
  '  ^P / ^N  previous / next line',
  '  ^A / ^E  start / end of current line',
  '  ^Y / ^V  page up / page down',
  '  ^Space / M-Space  next word',
  '  ^_  go to line and column      M-\\  first line      M-/  last line',
  '',
  '  Editing:',
  '  ^D  delete character under the cursor',
  '  ^H  backspace      Tab  insert a tab character',
  '  ^K  cut line       M-6  copy line       ^U  paste',
  '  M-A  mark text     M-U  undo            M-E  redo',
  '  M-D  count words, lines and characters',
  '',
  '  Search and replace:',
  '  ^W  search         M-W  search again',
  '  M-B  search backwards      M-C  toggle case sensitivity',
  '  ^\\  replace        M-R  replace',
  '',
  '  Write out with ^O, insert another file with ^R,',
  '  exit with ^X.  Close this help with ^X, Enter, or Escape.',
]

export function createNano(host: EditorHost, path: string, rows: number, cols: number,
  opts: { lineNumbers?: boolean } = {}): Editor {
  return new NanoEditor(host, path, rows, cols, opts)
}

class NanoEditor implements Editor {
  private _done = false
  private host: EditorHost
  private path: string
  private resolvedPath: string
  private rows: number
  private cols: number
  private lineNumbers: boolean
  private lines: string[] = ['']
  private cursor: Pos = { r: 0, c: 0 }
  private prefCol = 0
  private mark: Pos | null = null
  private hl: MatchRange | null = null
  private topRow = 0
  private hscroll = 0
  private statusMsg: string | null = null
  private prompt: Prompt | null = null
  private savedText = ''
  private modified = false
  private cutBuffer = ''
  private lastCutOp: 'cut' | 'copy' | null = null
  private lastEdit = ''
  private undoStack: HistEntry[] = []
  private redoStack: HistEntry[] = []
  private searchCase = false
  private searchBackward = false
  private lastSearch = ''
  private lastDir: 1 | -1 = 1
  private replaceSearchStr = ''
  private replaceWithStr = ''
  private replaceCur: Pos = { r: 0, c: 0 }
  private replaceOcc: ReplaceOcc | null = null
  private replaceCount = 0
  private replacePushedUndo = false
  private pendingWriteName = ''
  private pendingWriteTarget = ''
  private pendingExit = false
  private helpMode = false
  private helpScroll = 0

  constructor(host: EditorHost, path: string, rows: number, cols: number, opts: { lineNumbers?: boolean }) {
    this.host = host
    this.path = path
    this.resolvedPath = path === '' ? '' : host.resolve(path)
    this.rows = Math.max(1, rows)
    this.cols = Math.max(1, cols)
    this.lineNumbers = opts.lineNumbers ?? false
    if (path !== '') {
      let content: string | null = null
      try { content = host.readFile(this.resolvedPath) } catch { content = null }
      if (content !== null) {
        this.lines = contentToLines(content)
        const n = countLines(content)
        this.statusMsg = `[ Read ${n} ${n === 1 ? 'line' : 'lines'} ]`
      } else {
        this.lines = ['']
        this.statusMsg = '[ New File ]'
      }
    } else {
      this.lines = ['']
      this.statusMsg = '[ New File ]'
    }
    this.savedText = this.text()
  }

  get done(): boolean { return this._done }

  // ---- input -----------------------------------------------------------------------------------

  key(k: KeyInput): void {
    if (this._done) return
    const lastCutOp = this.lastCutOp
    this.lastCutOp = null
    this.statusMsg = null
    this.hl = null
    if (this.helpMode) { this.keyHelp(k); return }
    if (this.prompt) { this.keyPrompt(k); return }
    this.keyNormal(k, lastCutOp)
  }

  paste(text: string): void {
    if (this._done || this.helpMode) return
    if (this.prompt) {
      const p = this.prompt
      const t = text.replace(/[\r\n]/g, '')
      p.answer += t
      p.cur = p.answer.length
      return
    }
    const clean = text.replace(/\r\n/g, '\n')
    if (clean === '') return
    this.pushUndo()
    this.lastEdit = 'paste'
    this.mark = null
    this.insertText(clean, this.cursor)
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.ensureCursorVisible()
  }

  resize(rows: number, cols: number): void {
    this.rows = Math.max(1, rows)
    this.cols = Math.max(1, cols)
    this.ensureCursorVisible()
  }

  // ---- normal mode -----------------------------------------------------------------------------

  private keyNormal(k: KeyInput, lastCutOp: 'cut' | 'copy' | null): void {
    const ctrl = (ch: string) => k.ctrl && !k.alt && k.key.toLowerCase() === ch
    const alt = (ch: string) => k.alt && !k.ctrl && k.key.toLowerCase() === ch

    if (k.key === 'F2' || ctrl('x')) this.exit()
    else if (k.key === 'F3' || ctrl('o')) this.openWritePrompt(false)
    else if (k.key === 'F4' || ctrl('j')) this.justify()
    else if (k.key === 'F5' || ctrl('r')) this.openReadPrompt()
    else if (k.key === 'F6' || ctrl('w')) this.openSearch()
    else if (k.key === 'F7') this.pageUp()
    else if (k.key === 'F8') this.pageDown()
    else if (k.key === 'F9' || ctrl('k')) this.cut(lastCutOp === 'cut')
    else if (k.key === 'F10' || ctrl('u')) this.pasteBuffer()
    else if (k.key === 'F11' || ctrl('c')) this.showLocation()
    else if (k.key === 'F12') { /* spell is not available, ignored */ }
    else if (k.key === 'F1' || ctrl('g')) this.openHelp()
    else if (ctrl('t')) this.executeMsg()
    else if (ctrl('\\') || k.key === 'F14' || alt('r')) this.openReplace()
    else if (k.key === 'Enter') this.enter()
    else if (k.key === 'Tab') this.typeChar('\t')
    else if (k.key === 'Backspace' || ctrl('h')) this.backspace()
    else if (k.key === 'Delete' || ctrl('d')) this.del()
    else if (k.key === 'ArrowLeft') { if (k.ctrl) this.prevWord(); else this.left() }
    else if (k.key === 'ArrowRight') { if (k.ctrl) this.nextWord(); else this.right() }
    else if (ctrl('b')) this.left()
    else if (ctrl('f')) this.right()
    else if (k.key === 'ArrowUp' || ctrl('p')) this.up()
    else if (k.key === 'ArrowDown' || ctrl('n')) this.down()
    else if (k.key === 'Home' || ctrl('a')) this.home()
    else if (k.key === 'End' || ctrl('e')) this.end()
    else if (k.key === 'PageUp' || ctrl('y')) this.pageUp()
    else if (k.key === 'PageDown' || ctrl('v')) this.pageDown()
    else if (ctrl('_') || ctrl('/') || alt('g')) this.openGoto()
    else if (alt('u')) this.undo()
    else if (alt('e')) this.redo()
    else if (alt('a')) this.toggleMark()
    else if (alt('6')) this.copy(lastCutOp === 'copy')
    else if (alt('d')) this.countStats()
    else if (alt('w')) this.searchAgain()
    else if (alt('\\')) this.firstLine()
    else if (alt('/')) this.lastLine()
    else if (alt('#')) this.toggleLineNumbers()
    else if (k.key === ' ' && (k.ctrl || k.alt)) this.nextWord()
    else if (k.key.length === 1 && !k.ctrl && !k.alt) this.typeChar(k.key)
  }

  private keyPrompt(k: KeyInput): void {
    const p = this.prompt
    if (!p) return
    const ctrl = (ch: string) => k.ctrl && !k.alt && k.key.toLowerCase() === ch
    const alt = (ch: string) => k.alt && !k.ctrl && k.key.toLowerCase() === ch

    if (k.key === 'F1' || ctrl('g')) { this.openHelp(); return }

    if (p.kind === 'replaceInstance') {
      if (k.key === 'Escape' || ctrl('c')) { this.prompt = null; this.hl = null; this.statusMsg = '[ Cancelled ]' }
      else if (k.key === 'y' || k.key === 'Y') this.replaceYes()
      else if (k.key === 'n' || k.key === 'N') this.replaceNo()
      else if (k.key === 'a' || k.key === 'A') this.replaceAll()
      return
    }
    if (p.kind === 'exitSave') {
      if (k.key === 'Escape' || ctrl('c')) { this.prompt = null; this.statusMsg = '[ Cancelled ]' }
      else if (k.key === 'y' || k.key === 'Y') this.openWritePrompt(true)
      else if (k.key === 'n' || k.key === 'N') { this.prompt = null; this._done = true }
      return
    }
    if (p.kind === 'overwrite') {
      if (k.key === 'Escape' || ctrl('c')) { this.prompt = null; this.pendingExit = false; this.statusMsg = '[ Cancelled ]' }
      else if (k.key === 'y' || k.key === 'Y') { this.prompt = null; this.performWrite(this.pendingWriteName, this.pendingWriteTarget) }
      else if (k.key === 'n' || k.key === 'N') { this.prompt = null; this.pendingExit = false }
      return
    }

    if (k.key === 'Escape' || ctrl('c')) this.cancelPrompt()
    else if (k.key === 'Enter') this.submitPrompt()
    else if (k.key === 'Backspace' || ctrl('h')) this.promptBackspace()
    else if (k.key === 'Delete' || ctrl('d')) this.promptDelete()
    else if (k.key === 'ArrowLeft' || ctrl('b')) { if (p.cur > 0) p.cur-- }
    else if (k.key === 'ArrowRight' || ctrl('f')) { if (p.cur < p.answer.length) p.cur++ }
    else if (k.key === 'Home' || ctrl('a')) p.cur = 0
    else if (k.key === 'End' || ctrl('e')) p.cur = p.answer.length
    else if (ctrl('u')) { p.answer = ''; p.cur = 0 }
    else if (alt('c') && (p.kind === 'search' || p.kind === 'replaceSearch')) this.searchCase = !this.searchCase
    else if (alt('b') && p.kind === 'search') { this.searchBackward = !this.searchBackward; p.text = this.searchLabel() }
    else if (k.key.length === 1 && !k.ctrl && !k.alt) {
      p.answer = p.answer.slice(0, p.cur) + k.key + p.answer.slice(p.cur)
      p.cur++
    }
  }

  private keyHelp(k: KeyInput): void {
    if (k.key === 'PageUp') this.helpScroll -= this.rows
    else if (k.key === 'PageDown') this.helpScroll += this.rows
    else if (k.key === 'ArrowUp') this.helpScroll--
    else if (k.key === 'ArrowDown') this.helpScroll++
    else if (k.key === 'Escape' || k.key === 'Enter' || (k.ctrl && !k.alt && k.key.toLowerCase() === 'x')) this.helpMode = false
    const max = Math.max(0, HELP_TEXT.length - this.rows)
    this.helpScroll = Math.min(Math.max(0, this.helpScroll), max)
  }

  // ---- editing ---------------------------------------------------------------------------------

  private text(): string { return this.lines.join('\n') }

  private updateModified(): void { this.modified = this.text() !== this.savedText }

  private pushUndo(): void {
    this.undoStack.push({
      lines: this.lines.slice(),
      cursor: { ...this.cursor },
      mark: this.mark ? { ...this.mark } : null,
    })
    this.redoStack.length = 0
  }

  private undo(): void {
    const e = this.undoStack.pop()
    if (!e) return
    this.redoStack.push({ lines: this.lines.slice(), cursor: { ...this.cursor }, mark: this.mark ? { ...this.mark } : null })
    this.lines = e.lines
    this.cursor = e.cursor
    this.mark = e.mark
    this.lastEdit = ''
    this.updateModified()
    this.ensureCursorVisible()
  }

  private redo(): void {
    const e = this.redoStack.pop()
    if (!e) return
    this.undoStack.push({ lines: this.lines.slice(), cursor: { ...this.cursor }, mark: this.mark ? { ...this.mark } : null })
    this.lines = e.lines
    this.cursor = e.cursor
    this.mark = e.mark
    this.lastEdit = ''
    this.updateModified()
    this.ensureCursorVisible()
  }

  private typeChar(ch: string): void {
    if (this.lastEdit !== 'typing') { this.pushUndo(); this.lastEdit = 'typing' }
    this.mark = null
    const r = this.cursor.r
    const line = this.lines[r]
    this.lines[r] = line.slice(0, this.cursor.c) + ch + line.slice(this.cursor.c)
    this.cursor.c++
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.ensureCursorVisible()
  }

  private enter(): void {
    this.pushUndo()
    this.lastEdit = 'enter'
    this.mark = null
    const r = this.cursor.r
    const c = this.cursor.c
    const line = this.lines[r]
    this.lines.splice(r, 1, line.slice(0, c), line.slice(c))
    this.cursor = { r: r + 1, c: 0 }
    this.prefCol = 0
    this.updateModified()
    this.ensureCursorVisible()
  }

  private backspace(): void {
    if (this.lastEdit !== 'typing') { this.pushUndo(); this.lastEdit = 'typing' }
    this.mark = null
    const r = this.cursor.r
    const c = this.cursor.c
    if (c > 0) {
      const line = this.lines[r]
      this.lines[r] = line.slice(0, c - 1) + line.slice(c)
      this.cursor.c = c - 1
    } else if (r > 0) {
      const prev = this.lines[r - 1]
      this.cursor = { r: r - 1, c: prev.length }
      this.lines[r - 1] = prev + this.lines[r]
      this.lines.splice(r, 1)
    }
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.ensureCursorVisible()
  }

  private del(): void {
    if (this.lastEdit !== 'typing') { this.pushUndo(); this.lastEdit = 'typing' }
    this.mark = null
    const r = this.cursor.r
    const c = this.cursor.c
    const line = this.lines[r]
    if (c < line.length) {
      this.lines[r] = line.slice(0, c) + line.slice(c + 1)
    } else if (r < this.lines.length - 1) {
      this.lines[r] = line + this.lines[r + 1]
      this.lines.splice(r + 1, 1)
    }
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.ensureCursorVisible()
  }

  private cut(append: boolean): void {
    this.pushUndo()
    this.lastEdit = 'cut'
    this.lastCutOp = 'cut'
    const r = this.cursor.r
    let cut: string
    if (this.mark && !posEq(this.mark, this.cursor)) {
      const [a, b] = this.selRange()
      cut = this.deleteRange(a, b)
      this.mark = null
    } else if (this.lines.length === 1) {
      cut = this.lines[0] + '\n'
      this.lines[0] = ''
      this.cursor.c = 0
    } else {
      cut = this.lines[r] + '\n'
      this.lines.splice(r, 1)
      if (this.cursor.r >= this.lines.length) this.cursor.r = this.lines.length - 1
      this.cursor.c = 0
    }
    this.cutBuffer = append ? this.cutBuffer + cut : cut
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.ensureCursorVisible()
  }

  private copy(append: boolean): void {
    this.lastCutOp = 'copy'
    let text: string
    if (this.mark && !posEq(this.mark, this.cursor)) {
      const [a, b] = this.selRange()
      text = this.rangeText(a, b)
      this.mark = null
    } else {
      text = this.lines[this.cursor.r] + '\n'
    }
    this.cutBuffer = append ? this.cutBuffer + text : text
  }

  private pasteBuffer(): void {
    if (this.cutBuffer === '') return
    this.pushUndo()
    this.lastEdit = 'paste'
    this.mark = null
    this.insertText(this.cutBuffer, this.cursor)
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.ensureCursorVisible()
  }

  /** Insert raw text (which may contain newlines) at a position, moving the cursor to its end.
   *  A trailing newline in `text` stays represented as an empty final line, exactly as if the
   *  newline had been typed. */
  private insertText(text: string, at: Pos): void {
    if (text === '') return
    const line = this.lines[at.r]
    const combined = line.slice(0, at.c) + text + line.slice(at.c)
    const newOffset = this.offset(at) + text.length
    this.lines.splice(at.r, 1, ...combined.split('\n'))
    this.cursor = this.posFromOffset(newOffset)
  }

  private selRange(): [Pos, Pos] {
    const a = this.mark ?? this.cursor
    return posLe(a, this.cursor) ? [a, this.cursor] : [this.cursor, a]
  }

  private rangeText(a: Pos, b: Pos): string {
    if (a.r === b.r) return this.lines[a.r].slice(a.c, b.c)
    return [this.lines[a.r].slice(a.c), ...this.lines.slice(a.r + 1, b.r), this.lines[b.r].slice(0, b.c)].join('\n')
  }

  private deleteRange(a: Pos, b: Pos): string {
    if (a.r === b.r) {
      const line = this.lines[a.r]
      const cut = line.slice(a.c, b.c)
      this.lines[a.r] = line.slice(0, a.c) + line.slice(b.c)
      this.cursor = { r: a.r, c: a.c }
      return cut
    }
    const first = this.lines[a.r]
    const last = this.lines[b.r]
    const cut = [first.slice(a.c), ...this.lines.slice(a.r + 1, b.r), last.slice(0, b.c)].join('\n')
    const merged = first.slice(0, a.c) + last.slice(b.c)
    this.lines.splice(a.r, b.r - a.r + 1, merged)
    this.cursor = { r: a.r, c: a.c }
    return cut
  }

  private toggleMark(): void {
    if (this.mark) { this.mark = null; this.statusMsg = '[ Mark Unset ]' }
    else { this.mark = { ...this.cursor }; this.statusMsg = '[ Mark Set ]' }
  }

  private countStats(): void {
    const text = this.text()
    const words = (text.match(/\S+/g) ?? []).length
    this.statusMsg = `[ ${this.lines.length} lines, ${words} words, ${text.length} chars ]`
  }

  private showLocation(): void {
    const totalLines = this.lines.length
    const lineNo = this.cursor.r + 1
    const colNo = this.cursor.c + 1
    const lineLen = this.lines[this.cursor.r].length + 1
    const off = this.offset(this.cursor)
    const totalChars = this.text().length === 0 ? 0 : this.text().length + 1
    const den = Math.max(1, totalChars)
    const pct = (a: number, b: number) => b === 0 ? 0 : Math.floor((a / b) * 100)
    this.statusMsg = `[ line ${lineNo}/${totalLines} (${pct(lineNo, totalLines)}%), col ${colNo}/${lineLen} (${pct(colNo, lineLen)}%), char ${off + 1}/${den} (${pct(off + 1, den)}%) ]`
  }

  private executeMsg(): void { this.statusMsg = '[ Command execution is not available here ]' }

  private justify(): void {
    const r = this.cursor.r
    let start = r
    let end = r
    while (start > 0 && this.lines[start - 1].trim() !== '') start--
    while (end < this.lines.length - 1 && this.lines[end + 1].trim() !== '') end++
    const para = this.lines.slice(start, end + 1).join(' ')
    const words = para.split(/\s+/).filter(Boolean)
    const width = Math.max(1, this.textWidth())
    const wrapped: string[] = []
    let cur = ''
    for (const w of words) {
      if (cur === '') cur = w
      else if (cur.length + 1 + w.length <= width) cur += ' ' + w
      else { wrapped.push(cur); cur = w }
    }
    if (cur !== '' || words.length === 0) wrapped.push(cur)
    this.pushUndo()
    this.lastEdit = 'justify'
    this.mark = null
    this.lines.splice(start, end - start + 1, ...wrapped)
    this.cursor = { r: start, c: 0 }
    this.prefCol = 0
    this.updateModified()
    this.ensureCursorVisible()
  }

  // ---- movement --------------------------------------------------------------------------------

  private vcol(r: number, c: number): number { return tabVCol(this.lines[r], c) }

  private colFromVCol(line: string, v: number): number {
    let vc = 0
    for (let c = 0; c < line.length; c++) {
      const w = line[c] === '\t' ? 8 - (vc % 8) : 1
      if (vc + w > v) return c
      vc += w
    }
    return line.length
  }

  private setColByPref(): void { this.cursor.c = this.colFromVCol(this.lines[this.cursor.r], this.prefCol) }

  private left(): void {
    if (this.cursor.c > 0) this.cursor.c--
    else if (this.cursor.r > 0) { this.cursor.r--; this.cursor.c = this.lines[this.cursor.r].length }
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.ensureCursorVisible()
  }

  private right(): void {
    const line = this.lines[this.cursor.r]
    if (this.cursor.c < line.length) this.cursor.c++
    else if (this.cursor.r < this.lines.length - 1) { this.cursor.r++; this.cursor.c = 0 }
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.ensureCursorVisible()
  }

  private up(): void {
    if (this.cursor.r === 0) return
    this.cursor.r--
    this.setColByPref()
    this.ensureCursorVisible()
  }

  private down(): void {
    if (this.cursor.r >= this.lines.length - 1) return
    this.cursor.r++
    this.setColByPref()
    this.ensureCursorVisible()
  }

  private home(): void { this.cursor.c = 0; this.prefCol = 0; this.ensureCursorVisible() }

  private end(): void {
    this.cursor.c = this.lines[this.cursor.r].length
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.ensureCursorVisible()
  }

  private pageUp(): void {
    this.cursor.r = Math.max(0, this.cursor.r - Math.max(1, this.textRows()))
    this.setColByPref()
    this.ensureCursorVisible()
  }

  private pageDown(): void {
    this.cursor.r = Math.min(this.lines.length - 1, this.cursor.r + Math.max(1, this.textRows()))
    this.setColByPref()
    this.ensureCursorVisible()
  }

  private nextWord(): void {
    const line = this.lines[this.cursor.r]
    let c = this.cursor.c
    while (c < line.length && isWordChar(line[c])) c++
    while (c < line.length && !isWordChar(line[c])) c++
    this.cursor.c = c
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.ensureCursorVisible()
  }

  private prevWord(): void {
    const line = this.lines[this.cursor.r]
    let c = this.cursor.c
    if (c > 0) c--
    while (c > 0 && !isWordChar(line[c])) c--
    while (c > 0 && isWordChar(line[c - 1])) c--
    this.cursor.c = c
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.ensureCursorVisible()
  }

  private firstLine(): void { this.cursor.r = 0; this.setColByPref(); this.ensureCursorVisible() }

  private lastLine(): void {
    this.cursor.r = this.lines.length - 1
    this.setColByPref()
    this.ensureCursorVisible()
  }

  private toggleLineNumbers(): void { this.lineNumbers = !this.lineNumbers; this.ensureCursorVisible() }

  // ---- search ----------------------------------------------------------------------------------

  private searchLabel(): string {
    let t = 'Search'
    if (this.searchBackward) t += ' (Backwards)'
    if (this.lastSearch) t += ` [${this.lastSearch}]`
    return t + ': '
  }

  private openSearch(): void {
    this.searchBackward = false
    this.prompt = { kind: 'search', text: this.searchLabel(), answer: '', cur: 0 }
  }

  private searchAgain(): void {
    if (!this.lastSearch) { this.openSearch(); return }
    this.doSearch(this.lastSearch, this.lastDir, this.searchCase)
  }

  private doSearch(q: string, dir: 1 | -1, caseSensitive: boolean): void {
    const text = this.text()
    const hay = caseSensitive ? text : text.toLowerCase()
    const needle = caseSensitive ? q : q.toLowerCase()
    const from = this.offset(this.cursor)
    let idx = -1
    let wrapped = false
    if (dir === 1) {
      idx = hay.indexOf(needle, from)
      if (idx < 0 && from > 0) {
        idx = hay.indexOf(needle)
        wrapped = idx >= 0
      }
    } else {
      idx = hay.lastIndexOf(needle, from - 1)
      if (idx < 0) {
        idx = hay.lastIndexOf(needle)
        wrapped = idx >= 0
      }
    }
    if (idx < 0) { this.statusMsg = `"${q}" not found`; return }
    const start = this.posFromOffset(idx)
    this.cursor = start
    this.prefCol = this.vcol(start.r, start.c)
    this.hl = { start, end: this.posFromOffset(idx + q.length) }
    if (wrapped) this.statusMsg = 'Search Wrapped'
    this.ensureCursorVisible()
  }

  private openReplace(): void {
    this.prompt = { kind: 'replaceSearch', text: 'Search (to replace): ', answer: '', cur: 0 }
  }

  private findOccurrence(q: string, from: Pos, caseSensitive: boolean): ReplaceOcc | null {
    if (q === '') return null
    const text = this.text()
    const hay = caseSensitive ? text : text.toLowerCase()
    const needle = caseSensitive ? q : q.toLowerCase()
    const idx = hay.indexOf(needle, this.offset(from))
    if (idx < 0) return null
    return { start: idx, end: idx + q.length }
  }

  private advanceReplace(): void {
    const occ = this.findOccurrence(this.replaceSearchStr, this.replaceCur, this.searchCase)
    if (!occ) { this.finishReplace(); return }
    this.replaceOcc = occ
    this.cursor = this.posFromOffset(occ.start)
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.hl = { start: this.cursor, end: this.posFromOffset(occ.end) }
    this.prompt = { kind: 'replaceInstance', text: 'Replace this instance?', answer: '', cur: 0 }
    this.ensureCursorVisible()
  }

  private replaceYes(): void {
    const occ = this.replaceOcc
    if (!occ) { this.prompt = null; return }
    if (!this.replacePushedUndo) { this.pushUndo(); this.replacePushedUndo = true }
    const np = this.replaceRange(this.posFromOffset(occ.start), this.posFromOffset(occ.end), this.replaceWithStr)
    this.replaceCount++
    this.replaceCur = np
    this.cursor = np
    this.prefCol = this.vcol(np.r, np.c)
    this.updateModified()
    this.advanceReplace()
  }

  private replaceNo(): void {
    const occ = this.replaceOcc
    if (!occ) { this.prompt = null; return }
    this.replaceCur = this.posFromOffset(occ.end)
    this.advanceReplace()
  }

  private replaceAll(): void {
    let guard = 0
    for (;;) {
      if (guard++ > 20000) break
      const occ = this.findOccurrence(this.replaceSearchStr, this.replaceCur, this.searchCase)
      if (!occ) break
      if (!this.replacePushedUndo) { this.pushUndo(); this.replacePushedUndo = true }
      this.replaceCur = this.replaceRange(this.posFromOffset(occ.start), this.posFromOffset(occ.end), this.replaceWithStr)
      this.replaceCount++
    }
    this.cursor = this.replaceCur
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.updateModified()
    this.finishReplace()
  }

  private replaceRange(a: Pos, b: Pos, repl: string): Pos {
    const first = this.lines[a.r]
    const last = this.lines[b.r]
    if (a.r === b.r) {
      this.lines[a.r] = first.slice(0, a.c) + repl + first.slice(b.c)
      return { r: a.r, c: a.c + repl.length }
    }
    const merged = first.slice(0, a.c) + repl + last.slice(b.c)
    this.lines.splice(a.r, b.r - a.r + 1, merged)
    return { r: a.r, c: a.c + repl.length }
  }

  private finishReplace(): void {
    const n = this.replaceCount
    this.prompt = null
    this.hl = null
    this.replaceOcc = null
    this.statusMsg = `Replaced ${n} ${n === 1 ? 'occurrence' : 'occurrences'}`
    this.ensureCursorVisible()
  }

  // ---- prompts ---------------------------------------------------------------------------------

  private cancelPrompt(): void {
    this.prompt = null
    this.pendingExit = false
    this.statusMsg = '[ Cancelled ]'
  }

  private promptBackspace(): void {
    const p = this.prompt
    if (!p || p.cur === 0) return
    p.answer = p.answer.slice(0, p.cur - 1) + p.answer.slice(p.cur)
    p.cur--
  }

  private promptDelete(): void {
    const p = this.prompt
    if (!p || p.cur >= p.answer.length) return
    p.answer = p.answer.slice(0, p.cur) + p.answer.slice(p.cur + 1)
  }

  private submitPrompt(): void {
    const p = this.prompt
    if (!p) return
    switch (p.kind) {
      case 'search': this.submitSearch(); break
      case 'replaceSearch': this.submitReplaceSearch(); break
      case 'replaceWith': this.submitReplaceWith(); break
      case 'writeFile': this.submitWriteFile(); break
      case 'readFile': this.submitReadFile(); break
      case 'goto': this.submitGoto(); break
      default: this.prompt = null
    }
  }

  private submitSearch(): void {
    const p = this.prompt
    if (!p) return
    const q = p.answer
    this.prompt = null
    if (q === '') {
      if (this.lastSearch) {
        this.lastDir = this.searchBackward ? -1 : 1
        this.doSearch(this.lastSearch, this.lastDir, this.searchCase)
      } else {
        this.statusMsg = '[ Cancelled ]'
      }
      return
    }
    this.lastSearch = q
    this.lastDir = this.searchBackward ? -1 : 1
    this.doSearch(q, this.lastDir, this.searchCase)
  }

  private submitReplaceSearch(): void {
    const p = this.prompt
    if (!p) return
    const q = p.answer
    this.prompt = null
    if (q === '') { this.statusMsg = '[ Cancelled ]'; return }
    this.replaceSearchStr = q
    this.prompt = { kind: 'replaceWith', text: 'Replace with: ', answer: '', cur: 0 }
  }

  private submitReplaceWith(): void {
    const p = this.prompt
    if (!p) return
    this.replaceWithStr = p.answer
    this.prompt = null
    this.replaceCur = { ...this.cursor }
    this.replaceCount = 0
    this.replacePushedUndo = false
    this.advanceReplace()
  }

  private openWritePrompt(pendingExit: boolean): void {
    this.pendingExit = pendingExit
    this.prompt = { kind: 'writeFile', text: 'File Name to Write: ', answer: this.path, cur: this.path.length }
  }

  private submitWriteFile(): void {
    const p = this.prompt
    if (!p) return
    const name = p.answer
    this.prompt = null
    if (name === '') { this.statusMsg = '[ Cancelled ]'; this.pendingExit = false; return }
    let target: string
    try { target = this.host.resolve(name) } catch (e) {
      this.statusMsg = `[ Error writing ${name}: ${e instanceof Error ? e.message : String(e)} ]`
      this.pendingExit = false
      return
    }
    let exists = false
    try { exists = this.host.exists(target) } catch { exists = false }
    if (exists && target !== this.resolvedPath) {
      this.pendingWriteName = name
      this.pendingWriteTarget = target
      this.prompt = { kind: 'overwrite', text: 'File exists, OVERWRITE ?', answer: '', cur: 0 }
      return
    }
    this.performWrite(name, target)
  }

  private performWrite(name: string, target: string): void {
    const data = this.text() === '' ? '' : this.text() + '\n'
    let err: string | null = null
    try { err = this.host.writeFile(target, data) } catch (e) { err = e instanceof Error ? e.message : String(e) }
    if (err !== null) {
      this.statusMsg = `[ Error writing ${name}: ${err} ]`
      this.pendingExit = false
      return
    }
    this.savedText = this.text()
    this.modified = false
    const n = this.text() === '' ? 0 : this.lines.length
    this.statusMsg = `[ Wrote ${n} ${n === 1 ? 'line' : 'lines'} ]`
    if (this.pendingExit) this._done = true
  }

  private openReadPrompt(): void {
    this.prompt = { kind: 'readFile', text: 'File to insert [from ./]: ', answer: '', cur: 0 }
  }

  private submitReadFile(): void {
    const p = this.prompt
    if (!p) return
    const name = p.answer.trim()
    this.prompt = null
    if (name === '') { this.statusMsg = '[ Cancelled ]'; return }
    let content: string | null = null
    try { content = this.host.readFile(this.host.resolve(name)) } catch { content = null }
    if (content === null) { this.statusMsg = `[ Error reading ${name}: No such file or directory ]`; return }
    if (content === '') { this.statusMsg = '[ Read 0 lines ]'; return }
    this.pushUndo()
    this.lastEdit = 'insert'
    this.mark = null
    this.insertText(content, this.cursor)
    const n = countLines(content)
    this.statusMsg = `[ Read ${n} ${n === 1 ? 'line' : 'lines'} ]`
    this.updateModified()
    this.ensureCursorVisible()
  }

  private openGoto(): void {
    this.prompt = { kind: 'goto', text: 'Enter line number, column number: ', answer: '', cur: 0 }
  }

  private submitGoto(): void {
    const p = this.prompt
    if (!p) return
    const s = p.answer.trim()
    this.prompt = null
    if (s === '') { this.statusMsg = '[ Cancelled ]'; return }
    const parts = s.split(',')
    const ln = parseInt(parts[0], 10)
    if (!Number.isFinite(ln) || ln < 1) return
    const cn = parts[1] !== undefined ? parseInt(parts[1], 10) : 1
    const r = Math.min(this.lines.length, ln) - 1
    const c = Number.isFinite(cn) && cn >= 1 ? Math.min(this.lines[r].length + 1, cn) - 1 : 0
    this.cursor = { r, c }
    this.prefCol = this.vcol(this.cursor.r, this.cursor.c)
    this.ensureCursorVisible()
  }

  // ---- exit / help -----------------------------------------------------------------------------

  private exit(): void {
    if (this.modified) {
      this.prompt = { kind: 'exitSave', text: 'Save modified buffer?', answer: '', cur: 0 }
    } else {
      this._done = true
    }
  }

  private openHelp(): void { this.helpMode = true; this.helpScroll = 0 }

  // ---- layout ----------------------------------------------------------------------------------

  private textRows(): number { return Math.max(0, this.rows - 4) }

  private gutter(): number {
    const digits = String(Math.max(1, this.lines.length)).length
    return Math.max(3, digits) + 1
  }

  private textWidth(): number {
    return this.lineNumbers ? Math.max(0, this.cols - this.gutter()) : this.cols
  }

  private offset(p: Pos): number {
    let o = 0
    for (let i = 0; i < p.r; i++) o += this.lines[i].length + 1
    return o + p.c
  }

  private posFromOffset(idx: number): Pos {
    let i = idx
    for (let r = 0; r < this.lines.length; r++) {
      const len = this.lines[r].length
      if (i <= len) return { r, c: i }
      i -= len + 1
    }
    return { r: this.lines.length - 1, c: this.lines[this.lines.length - 1].length }
  }

  private ensureCursorVisible(): void {
    const tr = this.textRows()
    if (tr < 1) { this.topRow = 0; this.hscroll = 0; return }
    if (this.cursor.r < this.topRow) this.topRow = this.cursor.r
    else if (this.cursor.r >= this.topRow + tr) this.topRow = this.cursor.r - tr + 1
    const maxTop = Math.max(0, this.lines.length - tr)
    if (this.topRow > maxTop) this.topRow = maxTop
    if (this.topRow < 0) this.topRow = 0
    const tw = this.textWidth()
    if (tw < 1) { this.hscroll = 0; return }
    const vc = this.vcol(this.cursor.r, this.cursor.c)
    if (vc < this.hscroll) this.hscroll = vc
    else if (vc >= this.hscroll + tw) this.hscroll = vc - tw + 1
    if (this.hscroll < 0) this.hscroll = 0
  }

  // ---- render ----------------------------------------------------------------------------------

  render(): Screen {
    if (this.helpMode) return this.renderHelp()
    const lines: Run[][] = []
    lines.push(this.titleRow())
    const tr = this.textRows()
    for (let i = 0; i < tr; i++) lines.push(this.textRow(this.topRow + i))
    if (lines.length < this.rows) lines.push(this.statusRow())
    if (lines.length < this.rows) lines.push(this.helpRow(0))
    if (lines.length < this.rows) lines.push(this.helpRow(1))
    while (lines.length < this.rows) lines.push([])
    lines.length = this.rows
    return { lines, cursor: this.cursorCell() }
  }

  private renderHelp(): Screen {
    const lines: Run[][] = []
    for (let i = 0; i < this.rows; i++) {
      const t = HELP_TEXT[this.helpScroll + i] ?? ''
      lines.push(t === '' ? [] : [{ t: t.slice(0, this.cols) }])
    }
    return { lines, cursor: null }
  }

  private titleRow(): Run[] {
    const name = this.path === '' ? 'New Buffer' : this.path
    const right = this.modified ? 'Modified' : ''
    const midLen = Math.max(0, this.cols - TITLE_LEFT.length - right.length)
    const n = name.length > midLen ? name.slice(0, midLen) : name
    const padL = Math.floor((midLen - n.length) / 2)
    const padR = midLen - n.length - padL
    const t = (TITLE_LEFT + ' '.repeat(padL) + n + ' '.repeat(padR) + right).padEnd(this.cols).slice(0, this.cols)
    return [{ t, s: 'inv' }]
  }

  private statusRow(): Run[] {
    if (this.prompt) {
      const t = (this.prompt.text + this.prompt.answer).slice(0, this.cols)
      return t === '' ? [] : [{ t }]
    }
    if (this.statusMsg) {
      const m = this.statusMsg
      const pad = Math.max(0, Math.floor((this.cols - m.length) / 2))
      const t = (m.length >= this.cols ? m.slice(0, this.cols) : ' '.repeat(pad) + m).padEnd(this.cols).slice(0, this.cols)
      return [{ t, s: 'inv' }]
    }
    return []
  }

  private helpRow(which: 0 | 1): Run[] {
    if (this.prompt) {
      if (which === 1) return []
      const p = this.prompt
      if (p.kind === 'exitSave' || p.kind === 'overwrite') return this.buildHelpRow([[' Y', ' Yes'], [' N', ' No'], ['^C', ' Cancel']])
      if (p.kind === 'replaceInstance') return this.buildHelpRow([[' Y', ' Yes'], [' N', ' No'], ['^C', ' Cancel'], [' A', ' All']])
      return this.buildHelpRow([['^G', ' Help'], ['^C', ' Cancel']])
    }
    return this.buildHelpRow(which === 0 ? LINE1 : LINE2)
  }

  private buildHelpRow(entries: Array<[string, string]>): Run[] {
    const w = Math.max(1, Math.floor(this.cols / 6))
    const out: Run[] = []
    for (const [key, label] of entries) {
      const full = (key + label).slice(0, w)
      const keyLen = Math.min(key.length, full.length)
      if (keyLen > 0) out.push({ t: full.slice(0, keyLen), s: 'inv' })
      if (full.length > keyLen) out.push({ t: full.slice(keyLen) })
      const pad = w - full.length
      if (pad > 0) {
        if (out.length) out[out.length - 1].t += ' '.repeat(pad)
        else out.push({ t: ' '.repeat(pad) })
      }
    }
    return out
  }

  private textRow(lineIdx: number): Run[] {
    if (lineIdx >= this.lines.length) return []
    const line = this.lines[lineIdx]
    const cells = this.lineCells(line, lineIdx)
    const runs = this.runsFromCells(cells, this.hscroll, this.textWidth())
    if (this.lineNumbers) {
      const num = String(lineIdx + 1).padStart(this.gutter() - 1, ' ')
      return [{ t: num + ' ' }].concat(runs)
    }
    return runs
  }

  private lineCells(line: string, lineIdx: number): Cell[] {
    const cells: Cell[] = []
    let v = 0
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      const s = this.cellStyle(lineIdx, c)
      if (ch === '\t') {
        const n = 8 - (v % 8)
        for (let k = 0; k < n; k++) cells.push({ ch: ' ', s })
        v += n
      } else {
        cells.push({ ch, s })
        v++
      }
    }
    return cells
  }

  private cellStyle(lineIdx: number, c: number): Style | null {
    if (this.mark) {
      const [a, b] = this.selRange()
      if (!posEq(a, b) && this.inRange(lineIdx, c, a, b)) return 'sel'
    }
    if (this.hl && this.inRange(lineIdx, c, this.hl.start, this.hl.end)) return 'hl'
    return null
  }

  private inRange(r: number, c: number, a: Pos, b: Pos): boolean {
    if (r < a.r || r > b.r) return false
    if (r === a.r && c < a.c) return false
    if (r === b.r && c >= b.c) return false
    return true
  }

  private runsFromCells(cells: Cell[], from: number, width: number): Run[] {
    const out: Run[] = []
    let cur: Run | null = null
    const end = Math.min(cells.length, from + width)
    for (let i = from; i < end; i++) {
      const cell = cells[i]
      if (!cur || cur.s !== (cell.s ?? undefined)) {
        cur = { t: cell.ch, s: cell.s ?? undefined }
        out.push(cur)
      } else {
        cur.t += cell.ch
      }
    }
    return out
  }

  private cursorCell(): { row: number; col: number } | null {
    if (this.helpMode) return null
    if (this.prompt) {
      const row = 1 + this.textRows()
      if (row >= this.rows) return null
      return { row, col: Math.min(this.prompt.text.length + this.prompt.cur, this.cols - 1) }
    }
    const tr = this.textRows()
    if (tr < 1) return null
    const row = 1 + (this.cursor.r - this.topRow)
    if (row < 1 || row > tr) return null
    const vc = this.vcol(this.cursor.r, this.cursor.c)
    const col = (this.lineNumbers ? this.gutter() : 0) + vc - this.hscroll
    if (col < 0 || col >= this.cols) return null
    return { row, col }
  }
}
