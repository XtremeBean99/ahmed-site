// DOM-free vim core: modes, motions, operators, registers, undo, search, rendering.
// Ex commands live in vim-ex.ts (subclass). createVim lives in vim.ts.
import type { KeyInput, Run, Screen } from '../types'
import { vimRegexToJs, expandSubReplacement } from './vim-regex'

export type Mode = 'normal' | 'insert' | 'replace' | 'visual' | 'cmdline'
export type VisualMode = 'char' | 'line' | 'block'
export type Style = NonNullable<Run['s']>
export type OpKind = 'd' | 'c' | 'y' | '>' | '<' | 'gu' | 'gU' | 'g~' | '='

export interface Pos { row: number; col: number }
export interface Range { r0: number; c0: number; r1: number; c1: number; linewise: boolean }
interface Snapshot { lines: string[]; row: number; col: number; top: number; left: number; modified: boolean }
export interface RegContent { text: string; linewise: boolean }
interface Mark { row: number; col: number }
export interface VisualState { mode: VisualMode; anchor: Pos; cursor: Pos }
export interface Motion { pos: Pos; inclusive: boolean; linewise: boolean; keepDesired?: boolean }
export interface OpSpec { linewise: boolean; motion: string | null; motionCount: number; textObj: string | null; inner: boolean }
interface PendingOp { op: OpKind; count: number; motionBuf: string; gPending?: boolean }
interface Cell { ch: string; s?: Style }
export interface CmdlineState { kind: ':' | '/' | '?'; text: string; pos: number }

export type InsertAction = { t: 'i'; s: string } | { t: 'bs' } | { t: 'del' } | { t: 'cu' } | { t: 'cw' }

export type ChangeSpec =
  | { k: 'op'; op: OpKind; spec: OpSpec; reg: string; insert?: { actions: InsertAction[]; count: number } }
  | { k: 'insert'; actions: InsertAction[]; count: number }
  | { k: 'paste'; reg: string; after: boolean; count: number }
  | { k: 'join'; count: number; space: boolean }
  | { k: 'rchar'; ch: string; count: number }
  | { k: 'tilde'; count: number }
  | { k: 'inc'; delta: number; count: number }

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
export const isWord = (c: string): boolean => /[A-Za-z0-9_]/.test(c)
export const isBlank = (c: string): boolean => c === ' ' || c === '\t'
export const isBlankLine = (s: string): boolean => /^[ \t]*$/.test(s)
export const firstNonBlank = (s: string): number => {
  const m = /[^ \t]/.exec(s)
  return m ? m.index : s.length
}
export const posLess = (a: Pos, b: Pos): boolean => a.row < b.row || (a.row === b.row && a.col < b.col)
export const clonePos = (p: Pos): Pos => ({ row: p.row, col: p.col })
export function splitLines(data: string): string[] {
  const parts = data.split('\n')
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts
}
export function lineToScreen(line: string, col: number, ts: number): number {
  let s = 0
  for (let i = 0; i < col && i < line.length; i++) s += line[i] === '\t' ? ts - (s % ts) : 1
  return s
}
export function screenToCol(line: string, target: number, ts: number): number {
  let s = 0
  for (let i = 0; i < line.length; i++) {
    const w = line[i] === '\t' ? ts - (s % ts) : 1
    if (s + w > target) return i
    s += w
  }
  return line.length
}
function firstMatchFrom(line: string, from: number, re: RegExp): { index: number } | null {
  const r = new RegExp(re.source, re.flags + 'g')
  r.lastIndex = Math.max(0, from)
  let m: RegExpExecArray | null
  while ((m = r.exec(line))) {
    if (m[0].length === 0) { r.lastIndex++; continue }
    if (m.index >= from) return m
  }
  return null
}
function lastMatchBefore(line: string, upto: number, re: RegExp): { index: number } | null {
  const r = new RegExp(re.source, re.flags + 'g')
  let best: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = r.exec(line))) {
    if (m.index > upto) break
    best = m
    if (m[0].length === 0) r.lastIndex++
  }
  return best
}

const PAIRS: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{' }
const EDIT_KEYS = 'iIaAoOsScCxXpPrR~uJ<>DCSY'

export abstract class VimCore {
  protected readonly host: { readFile(path: string): string | null; writeFile(path: string, data: string): string | null; exists(path: string): boolean; resolve(path: string): string }
  protected readonly readOnly: boolean
  protected userPath: string
  protected absPath: string
  protected rows: number
  protected cols: number
  protected lines: string[] = []
  protected eol = true
  protected row = 0
  protected col = 0
  protected top = 0
  protected left = 0
  protected desired = 0
  protected mode: Mode = 'normal'
  protected visual: VisualState | null = null
  protected lastVisual: VisualState | null = null
  protected cmdline: CmdlineState | null = null
  protected cmdlineFrom: Mode = 'normal'
  protected hist: Record<string, string[]> = { ':': [], '/': [], '?': [] }
  protected histIdx = -1
  protected msg = ''
  protected msgErr = false
  protected modified = false
  protected doneFlag = false
  protected registers = new Map<string, RegContent>()
  protected marks = new Map<string, Mark>()
  protected undoStack: Snapshot[] = []
  protected redoStack: Snapshot[] = []
  protected inChange = false
  protected lastChange: ChangeSpec | null = null
  protected pendingDot: ChangeSpec | null = null
  protected countBuf = ''
  protected regState = 0
  protected regName = '"'
  protected pendingOp: PendingOp | null = null
  protected pendingTextObj: 'i' | 'a' | null = null
  protected pendingG = false
  protected gCount = 1
  protected pendingZ = false
  protected pendingZBig = false
  protected pendingQuote = false
  protected pendingBacktick = false
  protected pendingMark = false
  protected pendingF: { kind: 'f' | 'F' | 't' | 'T'; count: number } | null = null
  protected lastF: { kind: 'f' | 'F' | 't' | 'T'; ch: string; count: number } | null = null
  protected pendingR = false
  protected rCount = 1
  protected insertCount = 1
  protected insertActions: InsertAction[] = []
  protected lastInsertPos: Pos = { row: 0, col: 0 }
  protected ctrlOPending = false
  protected lastSearch: { pattern: string; dir: 1 | -1 } | null = null
  protected hls = false
  protected lastSub: { pat: string; rep: string; flags: string } | null = null
  protected settings = {
    number: false, ai: false, ic: false, smartcase: false, hls: false,
    et: false, sw: 8, ts: 8, wrap: false, list: false, is: false,
  }
  protected jumpList: Pos[] = []
  protected jumpIdx = -1
  protected prevPos: Pos | null = null
  protected roLastD = false

  constructor(host: VimCore['host'], path: string, rows: number, cols: number, opts?: { readOnly?: boolean }) {
    this.host = host
    this.rows = Math.max(1, rows)
    this.cols = Math.max(1, cols)
    this.readOnly = !!opts?.readOnly
    this.userPath = path
    this.absPath = host.resolve(path)
    const data = host.readFile(this.absPath)
    if (data !== null) {
      this.lines = splitLines(data)
      this.eol = data.endsWith('\n')
    }
    if (this.readOnly) {
      this.msg = ''
    } else if (data === null) {
      this.msg = `"${this.name()}" [New]`
    } else {
      this.msg = `"${this.name()}" ${this.lines.length}L, ${data.length}B`
    }
  }

  get done(): boolean { return this.doneFlag }

  protected name(): string {
    return this.userPath
  }
  protected lineLen(r: number): number { return this.lines[r]?.length ?? 0 }
  protected lastRow(): number { return Math.max(0, this.lines.length - 1) }
  protected cursor(): Pos { return { row: this.row, col: this.col } }
  protected colToScreen(r: number, c: number): number { return lineToScreen(this.lines[r] ?? '', c, this.settings.ts) }
  protected colFromDesired(r: number): number { return screenToCol(this.lines[r] ?? '', this.desired, this.settings.ts) }
  protected clampCol(r: number, c: number): number { return clamp(c, 0, this.lineLen(r)) }
  protected setMsg(s: string): void { this.msg = s; this.msgErr = false }
  protected err(s: string): void { this.msg = s; this.msgErr = true }
  protected modifiable(): boolean {
    if (!this.readOnly) return true
    this.err("E21: Cannot make changes, 'modifiable' is off")
    return false
  }
  protected serialize(): string {
    if (this.lines.length === 0) return ''
    return this.lines.join('\n') + '\n'
  }

  // ---- public API ----

  key(k: KeyInput): void {
    if (this.doneFlag) return
    this.msg = ''
    this.msgErr = false
    if (this.mode === 'cmdline') { this.cmdlineKey(k); return }
    if (this.mode === 'insert') { this.insertKey(k); return }
    if (this.mode === 'replace') { this.replaceKey(k); return }
    if (this.mode === 'visual') { this.visualKey(k); return }
    this.normalKey(k)
  }

  paste(text: string): void {
    if (this.doneFlag) return
    if (this.mode === 'insert' || this.mode === 'replace') {
      this.insertAtCursor(text, true)
      return
    }
    if (this.mode === 'cmdline' && this.cmdline) {
      const cl = this.cmdline
      cl.text = cl.text.slice(0, cl.pos) + text + cl.text.slice(cl.pos)
      cl.pos += text.length
    }
  }

  resize(rows: number, cols: number): void {
    this.rows = Math.max(1, rows)
    this.cols = Math.max(1, cols)
    this.ensureCursorVisible()
  }

  // ---- undo ----

  protected snapshot(): Snapshot {
    return { lines: this.lines.map((s) => s), row: this.row, col: this.col, top: this.top, left: this.left, modified: this.modified }
  }
  protected restore(s: Snapshot): void {
    this.lines = s.lines.map((x) => x)
    this.row = s.row
    this.col = s.col
    this.top = s.top
    this.left = s.left
    this.modified = s.modified
    this.desired = this.colToScreen(this.row, this.col)
    this.ensureCursorVisible()
  }
  protected beginChange(): void {
    if (!this.inChange) {
      this.undoStack.push(this.snapshot())
      if (this.undoStack.length > 300) this.undoStack.shift()
      this.redoStack = []
      this.inChange = true
    }
  }
  protected endChange(): void { this.inChange = false }

  protected undo(): void {
    if (this.readOnly) { this.modifiable(); return }
    if (this.inChange) this.endChange()
    const s = this.undoStack.pop()
    if (!s) { this.setMsg('Already at oldest change'); return }
    this.redoStack.push(this.snapshot())
    this.restore(s)
    this.lastChange = null
  }
  protected redo(): void {
    if (this.readOnly) { this.modifiable(); return }
    if (this.inChange) this.endChange()
    const s = this.redoStack.pop()
    if (!s) { this.setMsg('Already at newest change'); return }
    this.undoStack.push(this.snapshot())
    this.restore(s)
  }

  // ---- cursor / scrolling ----

  protected jumpTo(r: number, c: number): void {
    this.row = clamp(r, 0, this.lastRow())
    this.col = clamp(c, 0, this.lineLen(this.row))
    this.desired = this.colToScreen(this.row, this.col)
    this.ensureCursorVisible()
  }
  protected jumpToKeepDesired(r: number, c: number): void {
    this.row = clamp(r, 0, this.lastRow())
    this.col = clamp(c, 0, this.lineLen(this.row))
    this.ensureCursorVisible()
  }
  protected jumpToLine(r: number): void {
    this.setPrev()
    this.pushJump()
    const rr = clamp(r, 0, this.lastRow())
    this.row = rr
    this.col = firstNonBlank(this.lines[rr] ?? '')
    this.desired = this.colToScreen(this.row, this.col)
    this.ensureCursorVisible()
  }
  private setPrev(): void { this.prevPos = { row: this.row, col: this.col } }
  private pushJump(): void {
    this.jumpList.push({ row: this.row, col: this.col })
    if (this.jumpList.length > 100) this.jumpList.shift()
    this.jumpIdx = this.jumpList.length - 1
  }
  private jumpBack(): void {
    if (this.jumpIdx > 0) {
      this.jumpIdx--
      this.jumpTo(this.jumpList[this.jumpIdx].row, this.jumpList[this.jumpIdx].col)
    }
  }
  private jumpForward(): void {
    if (this.jumpIdx >= 0 && this.jumpIdx < this.jumpList.length - 1) {
      this.jumpIdx++
      this.jumpTo(this.jumpList[this.jumpIdx].row, this.jumpList[this.jumpIdx].col)
    }
  }

  protected ensureCursorVisible(): void {
    const page = Math.max(1, this.rows - 2)
    if (this.row < this.top) this.top = this.row
    if (this.row > this.top + page - 1) this.top = this.row - page + 1
    if (this.top < 0) this.top = 0
    this.top = Math.min(this.top, this.lastRow())
    const numWidth = this.settings.number ? Math.max(3, String(Math.max(1, this.lines.length)).length) + 1 : 0
    const textWidth = Math.max(1, this.cols - numWidth)
    const sc = this.colToScreen(this.row, this.col)
    if (sc < this.left) this.left = sc
    if (sc >= this.left + textWidth) this.left = sc - textWidth + 1
    if (this.left < 0) this.left = 0
  }

  // ---- normal mode ----

  protected normalKey(k: KeyInput): void {
    const key = k.key
    if (k.ctrl) {
      switch (key) {
        case '[': case 'c': this.cancelPending(); return
        case 'r': this.redo(); return
        case 'f': this.pageMotion(1, this.takeCount()); return
        case 'b': this.pageMotion(-1, this.takeCount()); return
        case 'd': this.pageMotion(2, this.takeCount()); return
        case 'u': this.pageMotion(-2, this.takeCount()); return
        case 'a': this.increment(true, this.takeCount()); return
        case 'x': this.increment(false, this.takeCount()); return
        case 'o': this.jumpBack(); return
        case 'i': this.jumpForward(); return
        case 'v': this.startVisual('block'); return
        default: return
      }
    }
    if (this.readOnly) {
      if (key !== 'd') this.roLastD = false
      const count = this.takeCount()
      switch (key) {
        case 'q': case 'Q': this.doneFlag = true; return
        case ' ': case 'f': this.pageMotion(1, count); return
        case 'b': this.pageMotion(-1, count); return
        case 'd':
          if (this.roLastD) {
            this.roLastD = false
            this.err("E21: Cannot make changes, 'modifiable' is off")
            return
          }
          this.roLastD = true
          this.pageMotion(2, count)
          return
        case 'u': this.pageMotion(-2, count); return
        case 'g': this.jumpToLine(0); return
        case 'G': this.jumpToLine(this.lastRow()); return
      }
    }
    if (this.readOnly && EDIT_KEYS.includes(key)) {
      this.err("E21: Cannot make changes, 'modifiable' is off")
      return
    }
    if (this.pendingZBig) {
      this.pendingZBig = false
      if (key === 'Z') { this.cmdWriteQuit(false); return }
      if (key === 'Q') { this.doneFlag = true; return }
      return
    }
    if (this.pendingMark) { this.marks.set(key, { row: this.row, col: this.col }); this.pendingMark = false; return }
    if (this.pendingF) {
      const pf = this.pendingF
      this.pendingF = null
      const pos = this.findPos(pf.kind, key, pf.count)
      this.lastF = { kind: pf.kind, ch: key, count: pf.count }
      if (pos) {
        if (this.pendingOp) {
          const op = this.pendingOp
          this.pendingOp = null
          const inclusive = pf.kind === 'f' || pf.kind === 'F'
          const range = this.charRange(this.cursor(), pos, inclusive)
          this.applyOpWithChange(op.op, range, this.takeReg(), { linewise: false, motion: pf.kind, motionCount: pf.count, textObj: null, inner: false })
        } else {
          this.jumpTo(pos.row, pos.col)
        }
      }
      return
    }
    if (this.pendingR) { this.pendingR = false; this.replaceChar(key); return }
    if (this.pendingQuote) {
      this.pendingQuote = false
      if (key === "'") this.jumpBackMark()
      else this.jumpMarkLine(key)
      return
    }
    if (this.pendingBacktick) {
      this.pendingBacktick = false
      if (key === '`') this.jumpBackMark()
      else this.jumpMark(key)
      return
    }
    if (this.pendingZ) { this.pendingZ = false; this.zScroll(key); return }
    if (this.pendingG) { this.pendingG = false; this.gCommand(key); return }
    if (this.pendingOp) { this.opSecond(k); return }
    if (this.regState === 1) { this.regName = key; this.regState = 2; return }
    if (this.regState === 2 && !'dcypPxXsSDCY'.includes(key)) this.regState = 0
    if (key >= '0' && key <= '9') {
      if (key === '0' && this.countBuf === '') { this.moveMotion(k, 1, false); return }
      this.countBuf += key
      return
    }
    const hadCount = this.countBuf !== ''
    const count = this.takeCount()
    switch (key) {
      case 'h': case 'j': case 'k': case 'l': case 'w': case 'W': case 'b': case 'B':
      case 'e': case 'E': case '0': case '^': case '$': case '|': case '_':
      case '{': case '}': case 'H': case 'M': case 'L': case 'Enter': case ' ':
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
        this.moveMotion(k, count, hadCount)
        return
      case 'G': {
        const target = hadCount ? clamp(count - 1, 0, this.lastRow()) : this.lastRow()
        this.jumpToLine(target)
        return
      }
      case '%': this.matchingBracket(); return
      case 'f': case 'F': case 't': case 'T': this.pendingF = { kind: key, count }; return
      case ';': case ',': this.repeatFind(key === ';'); return
      case 'i': this.enterInsert('i', count); return
      case 'a': this.enterInsert('a', count); return
      case 'I': this.enterInsert('I', count); return
      case 'A': this.enterInsert('A', count); return
      case 'o': this.openLine(true, count); return
      case 'O': this.openLine(false, count); return
      case 'g': this.pendingG = true; this.gCount = Math.max(1, count); return
      case 'z': this.pendingZ = true; return
      case 'Z': this.pendingZBig = true; return
      case '"': this.regState = 1; return
      case "'": this.pendingQuote = true; return
      case '`': this.pendingBacktick = true; return
      case 'm': this.pendingMark = true; return
      case 'd': case 'c': case 'y':
        this.pendingOp = { op: key, count: Math.max(1, count), motionBuf: '' }
        return
      case '>': case '<':
        this.pendingOp = { op: key, count: Math.max(1, count), motionBuf: '' }
        return
      case 'x': this.deleteChars(count, 1); return
      case 'X': this.deleteChars(count, -1); return
      case 'D': {
        const range: Range = { r0: this.row, c0: this.col, r1: this.row, c1: this.lineLen(this.row), linewise: false }
        this.applyOpWithChange('d', range, this.takeReg(), { linewise: false, motion: '$', motionCount: 1, textObj: null, inner: false })
        return
      }
      case 'C': {
        const range: Range = { r0: this.row, c0: this.col, r1: this.row, c1: this.lineLen(this.row), linewise: false }
        this.applyOpWithChange('c', range, this.takeReg(), { linewise: false, motion: '$', motionCount: 1, textObj: null, inner: false })
        return
      }
      case 's': {
        const end = Math.min(this.lineLen(this.row), this.col + count)
        const range: Range = { r0: this.row, c0: this.col, r1: this.row, c1: end, linewise: false }
        this.applyOpWithChange('c', range, this.takeReg(), { linewise: false, motion: 'l', motionCount: count, textObj: null, inner: false })
        return
      }
      case 'S': case 'cc': {
        const range = this.lineRange(this.row, this.row + count - 1)
        this.applyOpWithChange('c', range, this.takeReg(), { linewise: true, motion: null, motionCount: count, textObj: null, inner: false })
        return
      }
      case 'Y': case 'yy': {
        const range = this.lineRange(this.row, this.row + count - 1)
        this.applyOpWithChange('y', range, this.takeReg(), { linewise: true, motion: null, motionCount: count, textObj: null, inner: false })
        return
      }
      case 'p': case 'P': this.pasteReg(key === 'p', count); return
      case 'J': this.joinLines(count, true); return
      case 'r': this.pendingR = true; this.rCount = count; return
      case '~': this.toggleCase(count); return
      case '.': this.repeatLast(); return
      case 'u': this.undo(); return
      case 'v': this.startVisual('char'); return
      case 'V': this.startVisual('line'); return
      case 'n': case 'N': this.repeatSearch(key === 'n'); return
      case '*': this.searchWord(1); return
      case '#': this.searchWord(-1); return
      case ':': this.openCmdline(':', 'normal'); return
      case '/': this.openCmdline('/', 'normal'); return
      case '?': this.openCmdline('?', 'normal'); return
      case 'R': this.enterReplace(count); return
      default: return
    }
  }

  private cancelPending(): void {
    this.pendingOp = null
    this.pendingTextObj = null
    this.pendingF = null
    this.pendingR = false
    this.pendingG = false
    this.pendingZ = false
    this.pendingZBig = false
    this.pendingQuote = false
    this.pendingBacktick = false
    this.pendingMark = false
    this.regState = 0
    this.countBuf = ''
  }

  protected takeCount(): number {
    const n = this.countBuf === '' ? 1 : parseInt(this.countBuf, 10) || 1
    this.countBuf = ''
    return n
  }
  protected takeReg(): string {
    const r = this.regName
    this.regState = 0
    return r
  }

  private moveMotion(k: KeyInput, count: number, explicit: boolean): void {
    const m = this.motion(k, count, explicit)
    if (!m) return
    if (m.keepDesired) this.jumpToKeepDesired(m.pos.row, m.pos.col)
    else this.jumpTo(m.pos.row, m.pos.col)
  }

  protected motion(k: KeyInput, count: number, explicit: boolean): Motion | null {
    const key = k.key
    const last = this.lastRow()
    switch (key) {
      case 'h': case 'ArrowLeft': return { pos: { row: this.row, col: Math.max(0, this.col - count) }, inclusive: false, linewise: false }
      case 'l': case 'ArrowRight': case ' ': return { pos: { row: this.row, col: this.clampCol(this.row, this.col + count) }, inclusive: false, linewise: false }
      case 'j': case 'ArrowDown': case 'Enter': return { pos: this.vertical(this.row + count), inclusive: true, linewise: true, keepDesired: true }
      case 'k': case 'ArrowUp': return { pos: this.vertical(this.row - count), inclusive: true, linewise: true, keepDesired: true }
      case '0': return { pos: { row: this.row, col: 0 }, inclusive: false, linewise: false }
      case '^': return { pos: { row: this.row, col: firstNonBlank(this.lines[this.row] ?? '') }, inclusive: false, linewise: false }
      case '_': {
        const r = clamp(this.row + count - 1, 0, last)
        return { pos: { row: r, col: firstNonBlank(this.lines[r] ?? '') }, inclusive: true, linewise: true }
      }
      case '$': return { pos: { row: this.row, col: Math.max(0, this.lineLen(this.row) - 1) }, inclusive: true, linewise: false }
      case '|': return { pos: { row: this.row, col: clamp(count - 1, 0, this.lineLen(this.row)) }, inclusive: false, linewise: false }
      case 'w': case 'W': case 'b': case 'B': case 'e': case 'E': return this.wordMotion(key, count)
      case 'G': {
        const r = explicit ? clamp(count - 1, 0, last) : last
        return { pos: { row: r, col: 0 }, inclusive: true, linewise: true }
      }
      case 'gg': {
        const r = explicit ? clamp(count - 1, 0, last) : 0
        return { pos: { row: r, col: 0 }, inclusive: true, linewise: true }
      }
      case '}': {
        let r = this.row
        for (let i = 0; i < count; i++) {
          if (isBlankLine(this.lines[r] ?? '')) {
            while (r < last && isBlankLine(this.lines[r] ?? '')) r++
          }
          while (r <= last && !isBlankLine(this.lines[r] ?? '')) r++
          if (r > last) r = last
        }
        return { pos: this.vertical(r), inclusive: true, linewise: true, keepDesired: true }
      }
      case '{': {
        let r = this.row
        for (let i = 0; i < count; i++) {
          while (r > 0 && isBlankLine(this.lines[r] ?? '')) r--
          while (r > 0 && !isBlankLine(this.lines[r] ?? '')) r--
        }
        return { pos: this.vertical(r), inclusive: true, linewise: true, keepDesired: true }
      }
      case 'H': return { pos: this.vertical(this.top), inclusive: true, linewise: true, keepDesired: true }
      case 'M': return { pos: this.vertical(this.top + Math.floor((Math.max(1, this.rows - 2) - 1) / 2)), inclusive: true, linewise: true, keepDesired: true }
      case 'L': return { pos: this.vertical(this.top + Math.max(1, this.rows - 2) - 1), inclusive: true, linewise: true, keepDesired: true }
      default: return null
    }
  }

  private vertical(r: number): Pos {
    const rr = clamp(r, 0, this.lastRow())
    return { row: rr, col: this.colFromDesired(rr) }
  }

  private wordMotion(kind: string, count: number): Motion {
    const word = kind === 'W' || kind === 'B' || kind === 'E'
    const cls = (c: string): string => isBlank(c) ? 'blank' : (word || isWord(c)) ? 'word' : 'punc'
    let r = this.row
    let c = this.col
    const last = this.lastRow()
    if (kind === 'w' || kind === 'W' || kind === 'b' || kind === 'B') {
      const forward = kind === 'w' || kind === 'W'
      for (let n = 0; n < count; n++) {
        if (forward) {
          if (r > last) { r = last; c = this.lineLen(last); break }
          const line = this.lines[r] ?? ''
          if (c < line.length && cls(line[c]) !== 'blank') {
            const cur = cls(line[c])
            while (c < line.length && cls(line[c]) === cur) c++
          }
          const p = this.nextRunStart(r, c)
          r = p.row
          c = p.col
          if (r > last) { r = last; c = this.lineLen(last); break }
        } else {
          if (r < 0) { r = 0; c = 0; break }
          if (c > 0) c--
          else if (r > 0) { r--; c = this.lineLen(r) }
          else { r = 0; c = 0; break }
          while (r >= 0) {
            const ln = this.lines[r] ?? ''
            while (c >= 0 && c <= ln.length && isBlank(ln[c] ?? '')) c--
            if (c < 0) {
              if (r > 0) { r--; c = this.lineLen(r) }
              else { r = 0; c = 0; break }
            } else break
          }
          const ln = this.lines[r] ?? ''
          if (c < ln.length && !isBlank(ln[c])) {
            const cur = cls(ln[c])
            while (c > 0 && cls(ln[c - 1]) === cur) c--
          }
        }
      }
      return { pos: { row: r, col: c }, inclusive: false, linewise: false }
    }
    // e / E
    for (let n = 0; n < count; n++) {
      if (r > last) { r = last; c = this.lineLen(last); break }
      let line = this.lines[r] ?? ''
      if (c >= line.length || cls(line[c]) === 'blank') {
        const p = this.nextRunStart(r, c)
        r = p.row
        c = p.col
        if (r > last) { r = last; c = this.lineLen(last); break }
      }
      line = this.lines[r] ?? ''
      const cur = cls(line[c])
      if (c + 1 < line.length && cls(line[c + 1]) === cur) {
        while (c + 1 < line.length && cls(line[c + 1]) === cur) c++
      } else {
        c++
        const p = this.nextRunStart(r, c)
        r = p.row
        c = p.col
        if (r > last) { r = last; c = this.lineLen(last); break }
        line = this.lines[r] ?? ''
        const cur2 = cls(line[c])
        while (c + 1 < line.length && cls(line[c + 1]) === cur2) c++
      }
    }
    return { pos: { row: r, col: c }, inclusive: true, linewise: false }
  }

  private nextRunStart(r: number, c: number): Pos {
    const last = this.lastRow()
    while (r <= last) {
      const ln = this.lines[r] ?? ''
      while (c < ln.length && isBlank(ln[c])) c++
      if (c < ln.length) return { row: r, col: c }
      r++
      c = 0
    }
    return { row: last + 1, col: 0 }
  }

  private findPos(kind: 'f' | 'F' | 't' | 'T', ch: string, count: number): Pos | null {
    const line = this.lines[this.row] ?? ''
    if (kind === 'f' || kind === 't') {
      let found = 0
      for (let i = this.col + 1; i < line.length; i++) {
        if (line[i] === ch) {
          found++
          if (found === count) return { row: this.row, col: kind === 't' ? Math.max(this.col, i - 1) : i }
        }
      }
      return null
    }
    let found = 0
    for (let i = this.col - 1; i >= 0; i--) {
      if (line[i] === ch) {
        found++
        if (found === count) return { row: this.row, col: kind === 'T' ? Math.min(this.col, i + 1) : i }
      }
    }
    return null
  }

  private repeatFind(forward: boolean): void {
    if (!this.lastF) return
    const k = this.lastF.kind
    const kind = forward ? k : (k === 'f' ? 'F' : k === 'F' ? 'f' : k === 't' ? 'T' : 't')
    const pos = this.findPos(kind, this.lastF.ch, this.lastF.count)
    if (pos) this.jumpTo(pos.row, pos.col)
  }

  private matchingBracket(): void {
    let r = this.row
    let c = this.col
    let found: { r: number; c: number; ch: string } | null = null
    const last = this.lastRow()
    for (; r <= last && !found; r++) {
      const line = this.lines[r] ?? ''
      for (let i = r === this.row ? c : 0; i < line.length; i++) {
        if (PAIRS[line[i]]) { found = { r, c: i, ch: line[i] }; break }
      }
    }
    if (!found) return
    const open = found.ch
    const close = PAIRS[open]
    const dir: 1 | -1 = '([{'.includes(open) ? 1 : -1
    let depth = 0
    r = found.r
    c = found.c
    while (r >= 0 && r <= last) {
      const line = this.lines[r] ?? ''
      const start = dir === 1 ? c : Math.min(c, line.length - 1)
      for (let i = start; i >= 0 && i < line.length; i += dir) {
        const ch = line[i]
        if (ch === open) depth++
        else if (ch === close) {
          depth--
          if (depth === 0) {
            this.setPrev()
            this.pushJump()
            this.jumpTo(r, i)
            return
          }
        }
      }
      r += dir
      c = dir === 1 ? 0 : (r >= 0 && r <= last ? this.lineLen(r) - 1 : 0)
    }
  }

  private pageMotion(dir: number, count: number): void {
    const page = Math.max(1, this.rows - 2)
    const delta = dir === 2 ? Math.floor(page / 2) * count : dir === -2 ? -Math.floor(page / 2) * count : page * count * dir
    const last = this.lastRow()
    if (delta > 0) {
      this.top = Math.min(this.top + delta, last)
      this.row = clamp(this.top, 0, last)
    } else {
      this.top = Math.max(0, this.top + delta)
      this.row = clamp(this.top, 0, last)
    }
    this.col = this.colFromDesired(this.row)
    this.desired = this.colToScreen(this.row, this.col)
    this.ensureCursorVisible()
  }

  private zScroll(key: string): void {
    const page = Math.max(1, this.rows - 2)
    if (key === 't' || key === '\r') this.top = this.row
    else if (key === 'z' || key === '.') this.top = this.row - Math.floor(page / 2)
    else if (key === 'b' || key === '-') this.top = this.row - (page - 1)
    this.ensureCursorVisible()
  }

  private gCommand(key: string): void {
    const count = Math.max(1, this.gCount)
    switch (key) {
      case 'g': {
        const target = this.gCount > 1 ? count - 1 : 0
        this.jumpToLine(clamp(target, 0, this.lastRow()))
        return
      }
      case 'j': {
        const r = clamp(this.row + count, 0, this.lastRow())
        this.jumpTo(r, this.colFromDesired(r))
        return
      }
      case 'k': {
        const r = clamp(this.row - count, 0, this.lastRow())
        this.jumpTo(r, this.colFromDesired(r))
        return
      }
      case 'I': this.enterInsert('gI', count); return
      case 'v': this.gv(); return
      case 'J': this.joinLines(count, false); return
      case 'u': this.pendingOp = { op: 'gu', count, motionBuf: '' }; return
      case 'U': this.pendingOp = { op: 'gU', count, motionBuf: '' }; return
      case '~': this.pendingOp = { op: 'g~', count, motionBuf: '' }; return
      default: return
    }
  }

  // ---- operators ----

  private opSecond(k: KeyInput): void {
    const op = this.pendingOp
    if (!op) return
    const key = k.key
    if (k.ctrl) {
      if (key === '[' || key === 'c') { this.cancelPending(); return }
      return
    }
    if (key === 'Escape') { this.cancelPending(); return }
    if (op.gPending) {
      op.gPending = false
      if (key === 'g') {
        this.pendingOp = null
        const range = this.lineRange(0, this.row)
        this.applyOpWithChange(op.op, range, this.takeReg(), { linewise: true, motion: 'gg', motionCount: 1, textObj: null, inner: false })
        return
      }
      this.pendingOp = null
      this.regState = 0
      return
    }
    if (this.pendingTextObj) {
      const inner = this.pendingTextObj === 'i'
      this.pendingTextObj = null
      this.pendingOp = null
      const range = this.textObjectRange(key, inner)
      if (!range) { this.regState = 0; return }
      this.applyOpWithChange(op.op, range, this.takeReg(), { linewise: range.linewise, motion: null, motionCount: 1, textObj: key, inner })
      return
    }
    if (key >= '0' && key <= '9' && !(key === '0' && op.motionBuf === '')) { op.motionBuf += key; return }
    const motionCount = op.motionBuf === '' ? 1 : parseInt(op.motionBuf, 10) || 1
    const total = op.count * motionCount
    const lineDouble = (op.op === 'd' || op.op === 'c' || op.op === 'y') && key === op.op
    const shiftDouble = (op.op === '>' && key === '>') || (op.op === '<' && key === '<')
    const caseDouble = (op.op === 'gu' && (key === 'u' || key === '_')) || (op.op === 'gU' && key === 'U') || (op.op === 'g~' && key === '~')
    if (lineDouble || shiftDouble || caseDouble) {
      this.pendingOp = null
      const range = this.lineRange(this.row, this.row + total - 1)
      this.applyOpWithChange(op.op, range, this.takeReg(), { linewise: true, motion: null, motionCount: total, textObj: null, inner: false })
      return
    }
    if (key === 'g') { op.gPending = true; return }
    if (key === 'i' || key === 'a') { this.pendingTextObj = key; return }
    if (key === 'f' || key === 'F' || key === 't' || key === 'T') {
      this.pendingF = { kind: key, count: motionCount }
      return
    }
    const m = this.motion(k, motionCount, op.motionBuf !== '')
    this.pendingOp = null
    if (!m) { this.regState = 0; return }
    const range = m.linewise ? this.lineRange(this.row, m.pos.row) : this.charRange(this.cursor(), m.pos, m.inclusive)
    const spec: OpSpec = { linewise: m.linewise, motion: key, motionCount: total, textObj: null, inner: false }
    this.applyOpWithChange(op.op, range, this.takeReg(), spec)
  }

  protected applyOpWithChange(op: OpKind, range: Range, reg: string, spec: OpSpec): void {
    if (op === 'y') { this.yankRange(range, reg); return }
    if (op === '=') { this.jumpTo(range.r0, range.c0); return }
    if (!this.modifiable()) return
    this.beginChange()
    switch (op) {
      case 'd':
        this.deleteRange(range, reg)
        this.lastChange = { k: 'op', op, spec, reg }
        break
      case 'c':
        this.deleteRange(range, reg)
        this.pendingDot = { k: 'op', op, spec, reg }
        this.enterInsertMode()
        break
      case '>': this.shiftRange(range, 1); this.lastChange = { k: 'op', op, spec, reg }; break
      case '<': this.shiftRange(range, -1); this.lastChange = { k: 'op', op, spec, reg }; break
      case 'gu': this.caseRange(range, 'lower'); this.lastChange = { k: 'op', op, spec, reg }; break
      case 'gU': this.caseRange(range, 'upper'); this.lastChange = { k: 'op', op, spec, reg }; break
      case 'g~': this.caseRange(range, 'toggle'); this.lastChange = { k: 'op', op, spec, reg }; break
      default: break
    }
    if (op !== 'c') this.endChange()
    this.ensureCursorVisible()
  }

  protected specRange(spec: OpSpec): Range | null {
    if (spec.linewise) return this.lineRange(this.row, this.row + spec.motionCount - 1)
    if (spec.textObj) return this.textObjectRange(spec.textObj, spec.inner)
    if (spec.motion) {
      const m = this.motion({ key: spec.motion, ctrl: false, alt: false, shift: false }, spec.motionCount, spec.motionCount > 1)
      if (!m) return null
      return m.linewise ? this.lineRange(this.row, m.pos.row) : this.charRange(this.cursor(), m.pos, m.inclusive)
    }
    return null
  }

  protected replayOp(op: OpKind, spec: OpSpec, reg: string): void {
    const range = this.specRange(spec)
    if (!range) return
    switch (op) {
      case 'd': this.deleteRange(range, reg); break
      case 'c':
        this.deleteRange(range, reg)
        this.enterInsertMode()
        break
      case '>': this.shiftRange(range, 1); break
      case '<': this.shiftRange(range, -1); break
      case 'gu': this.caseRange(range, 'lower'); break
      case 'gU': this.caseRange(range, 'upper'); break
      case 'g~': this.caseRange(range, 'toggle'); break
      case 'y': this.yankRange(range, reg); break
      default: break
    }
  }

  protected charRange(a: Pos, b: Pos, inclusive: boolean): Range {
    let p = a
    let q = b
    if (posLess(q, p)) { const t = p; p = q; q = t }
    if (inclusive) return { r0: p.row, c0: p.col, r1: q.row, c1: q.col + 1, linewise: false }
    return { r0: p.row, c0: p.col, r1: q.row, c1: q.col, linewise: false }
  }
  protected lineRange(a: number, b: number): Range {
    const lo = Math.max(0, Math.min(a, b))
    const hi = Math.min(Math.max(a, b), this.lastRow())
    return { r0: lo, c0: 0, r1: hi, c1: 0, linewise: true }
  }

  protected rangeText(range: Range): string {
    if (range.linewise) return this.lines.slice(range.r0, range.r1 + 1).join('\n') + '\n'
    const parts: string[] = []
    for (let r = range.r0; r <= range.r1; r++) {
      const line = this.lines[r] ?? ''
      if (r === range.r0 && r === range.r1) parts.push(line.slice(range.c0, range.c1))
      else if (r === range.r0) parts.push(line.slice(range.c0))
      else if (r === range.r1) parts.push(line.slice(0, range.c1))
      else parts.push(line)
    }
    return parts.join('\n')
  }
  protected removeRange(range: Range): void {
    this.ensureLine()
    if (range.linewise) {
      this.lines.splice(range.r0, range.r1 - range.r0 + 1)
      if (this.lines.length === 0) this.lines = ['']
      return
    }
    if (range.r0 === range.r1) {
      const line = this.lines[range.r0]
      if (line !== undefined) this.lines[range.r0] = line.slice(0, range.c0) + line.slice(range.c1)
      return
    }
    const first = this.lines[range.r0]?.slice(0, range.c0) ?? ''
    const last = this.lines[range.r1]?.slice(range.c1) ?? ''
    this.lines.splice(range.r0, range.r1 - range.r0 + 1, first + last)
  }
  protected ensureLine(): void { if (this.lines.length === 0) this.lines = [''] }

  protected storeReg(name: string, text: string, linewise: boolean): void {
    this.registers.set(name, { text, linewise })
    if (name !== '"') this.registers.set('"', { text, linewise })
  }

  protected deleteRange(range: Range, reg: string): void {
    const text = this.rangeText(range)
    this.removeRange(range)
    this.storeReg(reg, text, range.linewise)
    this.modified = true
    if (range.linewise) {
      this.row = Math.min(range.r0, this.lastRow())
      this.col = this.colFromDesired(this.row)
    } else if (range.r0 < this.lines.length) {
      this.row = range.r0
      this.col = Math.min(range.c0, this.lineLen(this.row))
    } else {
      this.row = this.lastRow()
      this.col = this.lineLen(this.row)
    }
    this.desired = this.colToScreen(this.row, this.col)
  }

  protected yankRange(range: Range, reg: string): void {
    const text = this.rangeText(range)
    this.storeReg(reg, text, range.linewise)
    if (reg !== '0') this.registers.set('0', { text, linewise: range.linewise })
  }

  protected shiftRange(range: Range, dir: 1 | -1): void {
    for (let r = range.r0; r <= range.r1 && r < this.lines.length; r++) {
      const line = this.lines[r]
      if (dir === 1) this.lines[r] = (this.settings.et ? ' '.repeat(this.settings.sw) : '\t') + line
      else this.lines[r] = this.removeIndent(line)
    }
    this.modified = true
    if (this.mode === 'normal') {
      this.row = range.r0
      this.col = firstNonBlank(this.lines[range.r0] ?? '')
      this.desired = this.colToScreen(this.row, this.col)
    }
  }
  private removeIndent(line: string): string {
    let i = 0
    let w = 0
    while (i < line.length && w < this.settings.sw) {
      const c = line[i]
      if (c === ' ') { w++; i++ }
      else if (c === '\t') {
        const adv = this.settings.ts - (w % this.settings.ts)
        if (w + adv > this.settings.sw) break
        w += adv
        i++
      } else break
    }
    return line.slice(i)
  }

  protected caseRange(range: Range, kind: 'lower' | 'upper' | 'toggle'): void {
    const conv = (c: string): string => {
      if (kind === 'lower') return c.toLowerCase()
      if (kind === 'upper') return c.toUpperCase()
      return c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()
    }
    for (let r = range.r0; r <= range.r1 && r < this.lines.length; r++) {
      const line = this.lines[r]
      let c0 = 0
      let c1 = line.length
      if (!range.linewise) {
        if (r === range.r0) c0 = range.c0
        if (r === range.r1) c1 = Math.min(range.c1, line.length)
      }
      let out = ''
      for (let i = 0; i < line.length; i++) out += i >= c0 && i < c1 ? conv(line[i]) : line[i]
      this.lines[r] = out
    }
    this.modified = true
    this.row = range.r0
    this.col = range.linewise ? this.colFromDesired(this.row) : range.c0
    this.desired = this.colToScreen(this.row, this.col)
  }

  // ---- text objects ----

  private textObjectRange(obj: string, inner: boolean): Range | null {
    const line = this.lines[this.row] ?? ''
    if (obj === 'w' || obj === 'W') return this.wordObject(line, obj === 'W', inner)
    if (obj === 'p') return this.paragraphObject(inner)
    if (obj === '"' || obj === "'" || obj === '`') return this.quoteObject(line, obj, inner)
    const open = obj === 'b' || obj === '(' || obj === ')' ? '('
      : obj === 'B' || obj === '{' || obj === '}' ? '{'
      : obj === '[' || obj === ']' ? '['
      : obj === '<' || obj === '>' ? '<'
      : null
    if (open) return this.bracketObject(line, open, inner)
    return null
  }

  private wordObject(line: string, big: boolean, inner: boolean): Range {
    const cls = (c: string): string => isBlank(c) ? 'blank' : (big || isWord(c)) ? 'word' : 'punc'
    let c0 = this.col
    let c1 = this.col
    let cur = c0 < line.length ? cls(line[c0]) : 'blank'
    if (c0 === line.length && c0 > 0) cur = cls(line[c0 - 1])
    if (cur === 'blank') {
      while (c0 > 0 && cls(line[c0 - 1]) === 'blank') c0--
      while (c1 < line.length && cls(line[c1]) === 'blank') c1++
      return { r0: this.row, c0, r1: this.row, c1, linewise: false }
    }
    while (c0 > 0 && cls(line[c0 - 1]) === cur) c0--
    while (c1 < line.length && cls(line[c1]) === cur) c1++
    if (inner) return { r0: this.row, c0, r1: this.row, c1, linewise: false }
    if (c0 > 0 && isBlank(line[c0 - 1])) {
      while (c0 > 0 && isBlank(line[c0 - 1])) c0--
      return { r0: this.row, c0, r1: this.row, c1, linewise: false }
    }
    while (c1 < line.length && isBlank(line[c1])) c1++
    return { r0: this.row, c0, r1: this.row, c1, linewise: false }
  }

  private paragraphObject(inner: boolean): Range {
    let r0 = this.row
    let r1 = this.row
    while (r0 > 0 && !isBlankLine(this.lines[r0 - 1] ?? '')) r0--
    while (r1 < this.lastRow() && !isBlankLine(this.lines[r1 + 1] ?? '')) r1++
    if (!inner) {
      while (r1 < this.lastRow() && isBlankLine(this.lines[r1 + 1] ?? '')) r1++
    }
    return { r0, c0: 0, r1, c1: 0, linewise: true }
  }

  private quoteObject(line: string, q: string, inner: boolean): Range | null {
    const positions: number[] = []
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\') { i++; continue }
      if (line[i] === q) positions.push(i)
    }
    for (let i = 0; i + 1 < positions.length; i++) {
      const a = positions[i]
      const b = positions[i + 1]
      if (this.col > a && this.col <= b) {
        return { r0: this.row, c0: inner ? a + 1 : a, r1: this.row, c1: inner ? b : b + 1, linewise: false }
      }
    }
    for (let i = 0; i + 1 < positions.length; i++) {
      if (positions[i] >= this.col) {
        return { r0: this.row, c0: inner ? positions[i] + 1 : positions[i], r1: this.row, c1: inner ? positions[i + 1] : positions[i + 1] + 1, linewise: false }
      }
    }
    return null
  }

  private bracketObject(line: string, open: string, inner: boolean): Range | null {
    const close = PAIRS[open]
    const stack: number[] = []
    let best: { a: number; b: number } | null = null
    let bestAfter: { a: number; b: number } | null = null
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === open) stack.push(i)
      else if (c === close) {
        const a = stack.pop()
        if (a === undefined) continue
        if (this.col > a && this.col <= i) {
          if (!best || (a >= best.a && i <= best.b)) best = { a, b: i }
        } else if (a >= this.col && !bestAfter) {
          bestAfter = { a, b: i }
        }
      }
    }
    const pair = best ?? bestAfter
    if (!pair) return null
    return { r0: this.row, c0: inner ? pair.a + 1 : pair.a, r1: this.row, c1: inner ? pair.b : pair.b + 1, linewise: false }
  }

  // ---- insert / replace ----

  private enterInsert(kind: 'i' | 'a' | 'I' | 'A' | 'gi' | 'gI', count: number): void {
    if (!this.modifiable()) return
    this.ensureLine()
    switch (kind) {
      case 'i': break
      case 'a': this.col = Math.min(this.col + 1, this.lineLen(this.row)); break
      case 'I': this.col = firstNonBlank(this.lines[this.row] ?? ''); break
      case 'A': this.col = this.lineLen(this.row); break
      case 'gi': {
        this.row = clamp(this.lastInsertPos.row, 0, this.lastRow())
        this.col = clamp(this.lastInsertPos.col, 0, this.lineLen(this.row))
        break
      }
      case 'gI': this.col = 0; break
    }
    this.insertCount = Math.max(1, count)
    this.insertActions = []
    this.mode = 'insert'
    this.msg = ''
  }

  protected enterInsertMode(): void {
    this.ensureLine()
    this.mode = 'insert'
    this.insertCount = 1
    this.insertActions = []
    this.msg = ''
  }

  private enterReplace(count: number): void {
    if (!this.modifiable()) return
    this.ensureLine()
    this.mode = 'replace'
    this.insertCount = 1
    this.insertActions = []
    this.msg = ''
    void count
  }

  private openLine(below: boolean, count: number): void {
    if (!this.modifiable()) return
    this.ensureLine()
    this.beginChange()
    const line = this.lines[this.row] ?? ''
    const indent = this.settings.ai ? (line.match(/^[ \t]*/)?.at(0) ?? '') : ''
    const r = below ? this.row + 1 : this.row
    const n = Math.max(1, count)
    this.lines.splice(r, 0, ...Array.from({ length: n }, () => indent))
    this.row = r
    this.col = indent.length
    this.modified = true
    this.mode = 'insert'
    this.insertCount = 1
    this.insertActions = []
    this.msg = ''
  }

  private insertKey(k: KeyInput): void {
    const key = k.key
    if (this.ctrlOPending) {
      this.ctrlOPending = false
      this.runOneNormalFromInsert(k)
      return
    }
    if (k.ctrl) {
      switch (key) {
        case '[': case 'c': this.exitInsert(); return
        case 'w': this.deleteWordBack(); return
        case 'u': this.deleteToLineStart(); return
        case 'h': this.backspace(); return
        case 'o': this.ctrlOPending = true; return
        default: return
      }
    }
    if (key === 'Escape') { this.exitInsert(); return }
    if (key === 'Enter') { this.insertNewline(); return }
    if (key === 'Backspace') { this.backspace(); return }
    if (key === 'Delete') { this.deleteForward(); return }
    if (key === 'Tab') {
      const sc = this.colToScreen(this.row, this.col)
      const s = this.settings.et ? ' '.repeat(this.settings.ts - (sc % this.settings.ts)) : '\t'
      this.insertAtCursor(s, true)
      return
    }
    if (key === 'ArrowLeft') { this.col = Math.max(0, this.col - 1); return }
    if (key === 'ArrowRight') { this.col = Math.min(this.col + 1, this.lineLen(this.row)); return }
    if (key === 'ArrowUp') { this.row = Math.max(0, this.row - 1); this.col = this.colFromDesired(this.row); return }
    if (key === 'ArrowDown') { this.row = Math.min(this.row + 1, this.lastRow()); this.col = this.colFromDesired(this.row); return }
    if (key === 'Home') { this.col = 0; return }
    if (key === 'End') { this.col = this.lineLen(this.row); return }
    if (key.length === 1) this.insertAtCursor(key, true)
  }

  private replaceKey(k: KeyInput): void {
    const key = k.key
    if (k.ctrl) {
      if (key === '[' || key === 'c') { this.exitInsert(); return }
      return
    }
    if (key === 'Escape') { this.exitInsert(); return }
    if (key === 'Enter') { this.insertNewline(); return }
    if (key === 'Backspace') { this.col = Math.max(0, this.col - 1); return }
    if (key === 'ArrowLeft') { this.col = Math.max(0, this.col - 1); return }
    if (key === 'ArrowRight') { this.col = Math.min(this.col + 1, this.lineLen(this.row)); return }
    if (key === 'ArrowUp') { this.row = Math.max(0, this.row - 1); this.col = this.colFromDesired(this.row); return }
    if (key === 'ArrowDown') { this.row = Math.min(this.row + 1, this.lastRow()); this.col = this.colFromDesired(this.row); return }
    if (key.length === 1) {
      this.ensureLine()
      this.beginChange()
      const line = this.lines[this.row] ?? ''
      if (this.col < line.length) this.lines[this.row] = line.slice(0, this.col) + key + line.slice(this.col + 1)
      else this.lines[this.row] = line + key
      this.col++
      this.modified = true
      this.insertActions.push({ t: 'i', s: key })
    }
  }

  protected exitInsert(): void {
    if (this.insertCount > 1 && this.insertActions.length > 0) {
      this.applyInsertActions(this.insertActions, this.insertCount - 1)
    }
    this.lastInsertPos = { row: this.row, col: this.col }
    this.mode = 'normal'
    this.col = Math.max(0, this.col - 1)
    this.desired = this.colToScreen(this.row, this.col)
    if (this.pendingDot && this.pendingDot.k === 'op' && this.pendingDot.op === 'c') {
      this.lastChange = { ...this.pendingDot, insert: { actions: this.insertActions.slice(), count: this.insertCount } }
      this.pendingDot = null
    } else {
      this.lastChange = { k: 'insert', actions: this.insertActions.slice(), count: this.insertCount }
    }
    this.insertActions = []
    this.insertCount = 1
    this.endChange()
    this.ensureCursorVisible()
  }

  private runOneNormalFromInsert(k: KeyInput): void {
    const prev = this.mode
    this.mode = 'normal'
    this.normalKey(k)
    const m = this.mode as Mode
    if (!this.doneFlag && !this.cmdline && m !== 'insert' && m !== 'replace') {
      this.mode = prev
    }
  }

  protected insertAtCursor(text: string, record: boolean): void {
    this.ensureLine()
    this.beginChange()
    if (record) this.insertActions.push({ t: 'i', s: text })
    const end = this.insertRaw(text)
    this.row = end.row
    this.col = end.col
    this.modified = true
  }

  protected insertRaw(text: string): Pos {
    const parts = text.split('\n')
    if (parts.length === 1) {
      const line = this.lines[this.row] ?? ''
      this.lines[this.row] = line.slice(0, this.col) + text + line.slice(this.col)
      return { row: this.row, col: this.col + text.length }
    }
    const first = this.lines[this.row] ?? ''
    const before = first.slice(0, this.col)
    const after = first.slice(this.col)
    const mid = parts.slice(1, -1)
    this.lines.splice(this.row, 1, before + parts[0], ...mid, parts[parts.length - 1] + after)
    const endRow = this.row + parts.length - 1
    return { row: endRow, col: parts[parts.length - 1].length + after.length }
  }

  protected insertNewline(): void {
    this.ensureLine()
    const line = this.lines[this.row] ?? ''
    const indent = this.settings.ai ? (line.match(/^[ \t]*/)?.at(0) ?? '') : ''
    this.beginChange()
    this.insertActions.push({ t: 'i', s: '\n' + indent })
    const end = this.insertRaw('\n' + indent)
    this.row = end.row
    this.col = end.col
    this.modified = true
  }

  private backspace(): void {
    this.ensureLine()
    this.beginChange()
    this.insertActions.push({ t: 'bs' })
    this.backspaceRaw()
    this.modified = true
  }
  protected backspaceRaw(): void {
    const line = this.lines[this.row] ?? ''
    if (this.col > 0) {
      this.lines[this.row] = line.slice(0, this.col - 1) + line.slice(this.col)
      this.col--
    } else if (this.row > 0) {
      const prev = this.lines[this.row - 1] ?? ''
      this.lines.splice(this.row - 1, 2, prev + line)
      this.row--
      this.col = prev.length
    }
  }

  private deleteForward(): void {
    this.ensureLine()
    this.beginChange()
    this.insertActions.push({ t: 'del' })
    this.deleteForwardRaw()
    this.modified = true
  }
  protected deleteForwardRaw(): void {
    const line = this.lines[this.row] ?? ''
    if (this.col < line.length) {
      this.lines[this.row] = line.slice(0, this.col) + line.slice(this.col + 1)
    } else if (this.row < this.lastRow()) {
      const next = this.lines[this.row + 1] ?? ''
      this.lines.splice(this.row, 2, line + next)
    }
  }

  private deleteToLineStart(): void {
    this.ensureLine()
    this.beginChange()
    this.insertActions.push({ t: 'cu' })
    const line = this.lines[this.row] ?? ''
    this.lines[this.row] = line.slice(this.col)
    this.col = 0
    this.modified = true
  }

  private deleteWordBack(): void {
    this.ensureLine()
    this.beginChange()
    this.insertActions.push({ t: 'cw' })
    const line = this.lines[this.row] ?? ''
    let i = this.col - 1
    while (i >= 0 && isBlank(line[i])) i--
    while (i >= 0 && !isBlank(line[i])) i--
    this.lines[this.row] = line.slice(0, i + 1) + line.slice(this.col)
    this.col = i + 1
    this.modified = true
  }

  protected applyInsertActions(actions: InsertAction[], times: number): void {
    for (let n = 0; n < times; n++) {
      for (const a of actions) {
        switch (a.t) {
          case 'i': { const end = this.insertRaw(a.s); this.row = end.row; this.col = end.col; break }
          case 'bs': this.backspaceRaw(); break
          case 'del': this.deleteForwardRaw(); break
          case 'cu': { const line = this.lines[this.row] ?? ''; this.lines[this.row] = line.slice(this.col); this.col = 0; break }
          case 'cw': {
            const line = this.lines[this.row] ?? ''
            let i = this.col - 1
            while (i >= 0 && isBlank(line[i])) i--
            while (i >= 0 && !isBlank(line[i])) i--
            this.lines[this.row] = line.slice(0, i + 1) + line.slice(this.col)
            this.col = i + 1
            break
          }
        }
      }
    }
  }

  // ---- paste / join / misc editing ----

  protected pasteReg(after: boolean, count: number): void {
    if (!this.modifiable()) return
    const reg = this.takeReg()
    const content = this.registers.get(reg) ?? this.registers.get('"')
    if (!content) return
    this.beginChange()
    this.pasteRaw(content, after, count)
    this.endChange()
    this.lastChange = { k: 'paste', reg, after, count }
  }

  protected pasteRaw(content: RegContent, after: boolean, count: number): void {
    this.ensureLine()
    if (content.linewise) {
      const parts = splitLines(content.text)
      const block: string[] = []
      for (let i = 0; i < count; i++) block.push(...parts)
      const insertRow = after ? this.row + 1 : this.row
      this.lines.splice(insertRow, 0, ...block)
      this.row = Math.min(insertRow, this.lastRow())
      this.col = firstNonBlank(this.lines[this.row] ?? '')
    } else {
      const at = after ? this.col + 1 : this.col
      const end = this.insertRaw(content.text.repeat(count))
      this.row = end.row
      this.col = Math.max(0, end.col - 1)
    }
    this.modified = true
    this.desired = this.colToScreen(this.row, this.col)
  }

  protected joinLines(count: number, space: boolean): void {
    if (!this.modifiable()) return
    this.beginChange()
    this.joinRaw(count, space)
    this.endChange()
    this.lastChange = { k: 'join', count, space }
  }
  protected joinRaw(count: number, space: boolean): void {
    if (this.row >= this.lastRow()) return
    const n = Math.min(count, this.lines.length - this.row - 1)
    const firstLen = this.lines[this.row].length
    for (let i = 0; i < n; i++) {
      const cur = this.lines[this.row]
      const next = this.lines[this.row + 1] ?? ''
      const trimmed = space ? next.replace(/^[ \t]*/, '') : next
      const sep = space && cur.length > 0 && !isBlank(cur[cur.length - 1]) && trimmed.length > 0 ? ' ' : ''
      this.lines[this.row] = cur + sep + trimmed
      this.lines.splice(this.row + 1, 1)
    }
    this.row = Math.min(this.row, this.lastRow())
    this.col = Math.min(firstLen, this.lineLen(this.row))
    this.modified = true
    this.desired = this.colToScreen(this.row, this.col)
  }

  protected deleteChars(count: number, dir: 1 | -1): void {
    if (!this.modifiable()) return
    const reg = this.takeReg()
    this.beginChange()
    const len = this.lineLen(this.row)
    if (dir > 0) {
      const n = Math.min(count, Math.max(0, len - this.col))
      this.deleteRange({ r0: this.row, c0: this.col, r1: this.row, c1: this.col + n, linewise: false }, reg)
    } else {
      const n = Math.min(count, this.col)
      this.deleteRange({ r0: this.row, c0: this.col - n, r1: this.row, c1: this.col, linewise: false }, reg)
    }
    this.endChange()
    this.lastChange = { k: 'op', op: 'd', spec: { linewise: false, motion: dir > 0 ? 'l' : 'h', motionCount: count, textObj: null, inner: false }, reg }
  }

  protected replaceChar(ch: string): void {
    if (!this.modifiable()) return
    this.beginChange()
    const line = this.lines[this.row] ?? ''
    const n = Math.min(this.rCount, Math.max(0, line.length - this.col))
    if (n > 0) {
      this.lines[this.row] = line.slice(0, this.col) + ch.repeat(n) + line.slice(this.col + n)
      this.modified = true
    }
    this.endChange()
    this.lastChange = { k: 'rchar', ch, count: this.rCount }
  }

  protected toggleCase(count: number): void {
    if (!this.modifiable()) return
    this.beginChange()
    const line = this.lines[this.row] ?? ''
    const n = Math.min(count, Math.max(0, line.length - this.col))
    let out = line
    for (let i = 0; i < n; i++) {
      const c = line[this.col + i]
      out = out.slice(0, this.col + i) + (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()) + out.slice(this.col + i + 1)
    }
    this.lines[this.row] = out
    if (n > 0) {
      this.col = Math.min(this.col + n - 1, this.lineLen(this.row) - 1)
      this.modified = true
    }
    this.desired = this.colToScreen(this.row, this.col)
    this.endChange()
    this.lastChange = { k: 'tilde', count }
  }

  protected increment(add: boolean, count: number): void {
    if (!this.modifiable()) return
    const line = this.lines[this.row] ?? ''
    const m = /-?(?:0[xX][0-9a-fA-F]+|\d+)/.exec(line.slice(this.col))
    if (!m) return
    const start = this.col + m.index
    const numStr = m[0]
    const delta = (add ? 1 : -1) * count
    let newStr: string
    if (/^0[xX]/.test(numStr)) {
      const val = parseInt(numStr.slice(2), 16) + delta
      newStr = (val < 0 ? '-0x' : '0x') + Math.abs(val).toString(16)
    } else {
      newStr = String(parseInt(numStr, 10) + delta)
    }
    this.beginChange()
    this.lines[this.row] = line.slice(0, start) + newStr + line.slice(start + numStr.length)
    this.col = start
    this.modified = true
    this.endChange()
    this.lastChange = { k: 'inc', delta, count }
  }

  protected repeatLast(): void {
    const spec = this.lastChange
    if (!spec) return
    if (spec.k === 'op') {
      if (spec.op === 'c') {
        this.beginChange()
        this.replayOp('c', spec.spec, spec.reg)
        const actions = spec.insert?.actions ?? []
        const cnt = spec.insert?.count ?? 1
        this.applyInsertActions(actions, cnt)
        this.finishInsertNoRecord()
        return
      }
      this.beginChange()
      this.replayOp(spec.op, spec.spec, spec.reg)
      this.endChange()
      return
    }
    switch (spec.k) {
      case 'insert':
        this.beginChange()
        this.applyInsertActions(spec.actions, spec.count)
        this.endChange()
        this.ensureCursorVisible()
        break
      case 'paste': this.pasteRegRaw(spec.reg, spec.after, spec.count); break
      case 'join': this.joinRawWrapper(spec.count, spec.space); break
      case 'rchar': this.replaceCharRaw(spec.ch, spec.count); break
      case 'tilde': this.toggleCaseRaw(spec.count); break
      case 'inc': this.incrementRaw(spec.delta, spec.count); break
    }
  }

  private finishInsertNoRecord(): void {
    this.mode = 'normal'
    this.col = Math.max(0, this.col - 1)
    this.desired = this.colToScreen(this.row, this.col)
    this.endChange()
    this.ensureCursorVisible()
  }
  private pasteRegRaw(reg: string, after: boolean, count: number): void {
    const content = this.registers.get(reg) ?? this.registers.get('"')
    if (!content) return
    this.beginChange()
    this.pasteRaw(content, after, count)
    this.endChange()
  }
  private joinRawWrapper(count: number, space: boolean): void {
    this.beginChange()
    this.joinRaw(count, space)
    this.endChange()
  }
  private replaceCharRaw(ch: string, count: number): void {
    this.beginChange()
    const line = this.lines[this.row] ?? ''
    const n = Math.min(count, Math.max(0, line.length - this.col))
    if (n > 0) {
      this.lines[this.row] = line.slice(0, this.col) + ch.repeat(n) + line.slice(this.col + n)
      this.modified = true
    }
    this.endChange()
  }
  private toggleCaseRaw(count: number): void {
    this.beginChange()
    const line = this.lines[this.row] ?? ''
    const n = Math.min(count, Math.max(0, line.length - this.col))
    let out = line
    for (let i = 0; i < n; i++) {
      const c = line[this.col + i]
      out = out.slice(0, this.col + i) + (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()) + out.slice(this.col + i + 1)
    }
    this.lines[this.row] = out
    if (n > 0) { this.col = Math.min(this.col + n - 1, this.lineLen(this.row) - 1); this.modified = true }
    this.desired = this.colToScreen(this.row, this.col)
    this.endChange()
  }
  private incrementRaw(delta: number, count: number): void {
    this.increment(delta > 0, count)
  }

  // ---- visual mode ----

  private startVisual(mode: VisualMode): void {
    this.visual = { mode, anchor: this.cursor(), cursor: this.cursor() }
    this.mode = 'visual'
    this.msg = ''
    this.updateVisualMarks()
  }
  protected exitVisual(): void {
    this.lastVisual = this.visual ? { mode: this.visual.mode, anchor: clonePos(this.visual.anchor), cursor: clonePos(this.visual.cursor) } : null
    this.visual = null
    this.mode = 'normal'
  }
  private gv(): void {
    if (this.lastVisual) {
      this.visual = { mode: this.lastVisual.mode, anchor: clonePos(this.lastVisual.anchor), cursor: clonePos(this.lastVisual.cursor) }
      this.mode = 'visual'
      this.msg = ''
    }
  }
  private updateVisualMarks(): void {
    if (!this.visual) return
    const a = this.visual.anchor
    const c = this.visual.cursor
    if (this.visual.mode === 'line') {
      this.marks.set('<', { row: Math.min(a.row, c.row), col: 0 })
      this.marks.set('>', { row: Math.max(a.row, c.row), col: 0 })
    } else if (posLess(a, c)) {
      this.marks.set('<', clonePos(a))
      this.marks.set('>', clonePos(c))
    } else {
      this.marks.set('<', clonePos(c))
      this.marks.set('>', clonePos(a))
    }
  }

  private visualKey(k: KeyInput): void {
    const key = k.key
    if (k.ctrl) {
      if (key === '[' || key === 'c') { this.exitVisual(); return }
      return
    }
    if (key === 'Escape') { this.exitVisual(); return }
    if (this.pendingR) {
      this.pendingR = false
      this.visualReplaceChar(key)
      return
    }
    if (this.pendingF) {
      const pf = this.pendingF
      this.pendingF = null
      const pos = this.findPos(pf.kind, key, pf.count)
      this.lastF = { kind: pf.kind, ch: key, count: pf.count }
      if (pos && this.visual) {
        this.visual.cursor = pos
        this.updateVisualMarks()
        this.ensureCursorVisible()
      }
      return
    }
    if (key === 'v') {
      if (this.visual?.mode === 'char') this.exitVisual()
      else if (this.visual) { this.visual.mode = 'char'; this.updateVisualMarks() }
      return
    }
    if (key === 'V') {
      if (this.visual?.mode === 'line') this.exitVisual()
      else if (this.visual) { this.visual.mode = 'line'; this.updateVisualMarks() }
      return
    }
    if (key === 'o' || key === 'O') {
      if (this.visual) {
        const t = this.visual.anchor
        this.visual.anchor = this.visual.cursor
        this.visual.cursor = t
        this.updateVisualMarks()
      }
      return
    }
    if (key === ':') { this.openCmdline(':', 'visual'); return }
    if (key >= '0' && key <= '9' && !(key === '0' && this.countBuf === '')) { this.countBuf += key; return }
    const hadCount = this.countBuf !== ''
    const count = this.takeCount()
    const m = this.motion(k, count, hadCount)
    if (m) {
      this.row = m.pos.row
      this.col = m.pos.col
      this.desired = this.colToScreen(this.row, this.col)
      if (this.visual) {
        this.visual.cursor = m.pos
        this.updateVisualMarks()
      }
      this.ensureCursorVisible()
      return
    }
    switch (key) {
      case 'd': case 'x': this.visualOp('d'); return
      case 'y': this.visualOp('y'); return
      case 'c': case 's': this.visualOp('c'); return
      case '>': this.visualOp('>'); return
      case '<': this.visualOp('<'); return
      case '~': this.visualOp('g~'); return
      case 'u': this.visualOp('gu'); return
      case 'U': this.visualOp('gU'); return
      case 'J': this.visualJoin(); return
      case 'r': this.pendingR = true; this.rCount = 1; return
      case 'f': case 'F': case 't': case 'T': this.pendingF = { kind: key, count: 1 }; return
      case 'p': case 'P': this.visualPaste(); return
      case 'I': case 'A': this.visualInsert(key === 'I'); return
      default: return
    }
  }

  protected visualRange(): Range {
    if (!this.visual) return this.lineRange(this.row, this.row)
    const a = this.visual.anchor
    const c = this.visual.cursor
    if (this.visual.mode === 'line') return this.lineRange(a.row, c.row)
    return this.charRange(a, c, true)
  }

  private visualOp(op: 'd' | 'y' | 'c' | '>' | '<' | 'gu' | 'gU' | 'g~'): void {
    const range = this.visualRange()
    const linewise = this.visual?.mode === 'line'
    this.exitVisual()
    if (op === 'y') { this.yankRange(range, '"'); return }
    if (!this.modifiable()) return
    this.beginChange()
    switch (op) {
      case 'd': this.deleteRange(range, '"'); break
      case 'c':
        this.deleteRange(range, '"')
        this.pendingDot = { k: 'op', op: 'c', spec: { linewise, motion: null, motionCount: 1, textObj: null, inner: false }, reg: '"' }
        this.enterInsertMode()
        break
      case '>': this.shiftRange(range, 1); break
      case '<': this.shiftRange(range, -1); break
      case 'gu': this.caseRange(range, 'lower'); break
      case 'gU': this.caseRange(range, 'upper'); break
      case 'g~': this.caseRange(range, 'toggle'); break
      default: break
    }
    if (op !== 'c') this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private visualReplaceChar(ch: string): void {
    if (!this.visual) return
    const range = this.visualRange()
    this.exitVisual()
    if (!this.modifiable()) return
    this.beginChange()
    for (let r = range.r0; r <= range.r1 && r < this.lines.length; r++) {
      const line = this.lines[r]
      let c0 = 0
      let c1 = line.length
      if (!range.linewise) {
        if (r === range.r0) c0 = range.c0
        if (r === range.r1) c1 = Math.min(range.c1, line.length)
      }
      this.lines[r] = line.slice(0, c0) + ch.repeat(Math.max(0, c1 - c0)) + line.slice(c1)
    }
    this.modified = true
    this.row = range.r0
    this.col = range.linewise ? 0 : range.c0
    this.desired = this.colToScreen(this.row, this.col)
    this.endChange()
    this.ensureCursorVisible()
  }

  private visualJoin(): void {
    const range = this.visualRange()
    this.exitVisual()
    if (!this.modifiable()) return
    this.beginChange()
    this.joinRange(range.r0, range.r1)
    this.endChange()
  }

  private joinRange(r0: number, r1: number): void {
    const parts = this.lines.slice(r0, r1 + 1)
    if (parts.length < 2) return
    let out = parts[0]
    for (let i = 1; i < parts.length; i++) {
      out = out.replace(/[ \t]*$/, '') + ' ' + parts[i].replace(/^[ \t]*/, '')
    }
    this.lines.splice(r0, r1 - r0 + 1, out)
    this.row = r0
    this.col = parts[0].length
    this.modified = true
    this.desired = this.colToScreen(this.row, this.col)
  }

  private visualPaste(): void {
    if (!this.visual) return
    const range = this.visualRange()
    const content = this.registers.get('"')
    this.exitVisual()
    if (!this.modifiable() || !content) return
    this.beginChange()
    this.deleteRange(range, '"')
    if (content.linewise) {
      const parts = splitLines(content.text)
      this.lines.splice(this.row, 0, ...parts)
      this.row = Math.min(this.row, this.lastRow())
      this.col = firstNonBlank(this.lines[this.row] ?? '')
    } else {
      const end = this.insertRaw(content.text)
      this.row = end.row
      this.col = Math.max(0, end.col - 1)
    }
    this.modified = true
    this.endChange()
    this.ensureCursorVisible()
  }

  private visualInsert(atStart: boolean): void {
    if (!this.visual) return
    const range = this.visualRange()
    this.exitVisual()
    if (!this.modifiable()) return
    this.row = range.r0
    this.col = atStart ? range.c0 : Math.min(range.c1, this.lineLen(range.r0))
    if (!atStart && range.r1 !== range.r0) {
      this.row = range.r1
      this.col = range.linewise ? this.lineLen(range.r1) : Math.min(range.c1, this.lineLen(range.r1))
    }
    this.enterInsertMode()
  }

  // ---- cmdline ----

  protected openCmdline(kind: ':' | '/' | '?', from: Mode): void {
    this.cmdlineFrom = from
    this.cmdline = { kind, text: '', pos: 0 }
    if (kind === ':' && from === 'visual') {
      this.cmdline.text = `'<,'>`
      this.cmdline.pos = 5
    }
    this.mode = 'cmdline'
    this.histIdx = -1
  }

  private closeCmdline(cancel: boolean): void {
    this.cmdline = null
    if (cancel && this.cmdlineFrom === 'visual' && this.visual) this.mode = 'visual'
    else this.mode = 'normal'
  }

  private cmdlineKey(k: KeyInput): void {
    const cl = this.cmdline
    if (!cl) return
    const key = k.key
    if (k.ctrl) {
      if (key === '[' || key === 'c') { this.closeCmdline(true); return }
      if (key === 'u') { cl.text = cl.text.slice(cl.pos); cl.pos = 0; return }
      if (key === 'w') {
        let i = cl.pos - 1
        while (i >= 0 && isBlank(cl.text[i])) i--
        while (i >= 0 && !isBlank(cl.text[i])) i--
        cl.text = cl.text.slice(0, i + 1) + cl.text.slice(cl.pos)
        cl.pos = i + 1
        return
      }
      if (key === 'h') {
        if (cl.pos > 0) { cl.text = cl.text.slice(0, cl.pos - 1) + cl.text.slice(cl.pos); cl.pos-- }
        return
      }
      return
    }
    switch (key) {
      case 'Escape': this.closeCmdline(true); return
      case 'Enter': this.commitCmdline(); return
      case 'Backspace':
        if (cl.pos === 0) {
          if (cl.text === '') this.closeCmdline(true)
          return
        }
        cl.text = cl.text.slice(0, cl.pos - 1) + cl.text.slice(cl.pos)
        cl.pos--
        return
      case 'ArrowLeft': cl.pos = Math.max(0, cl.pos - 1); return
      case 'ArrowRight': cl.pos = Math.min(cl.text.length, cl.pos + 1); return
      case 'ArrowUp': this.histNav(cl.kind, -1); return
      case 'ArrowDown': this.histNav(cl.kind, 1); return
      case 'Home': cl.pos = 0; return
      case 'End': cl.pos = cl.text.length; return
      case 'Delete':
        if (cl.pos < cl.text.length) cl.text = cl.text.slice(0, cl.pos) + cl.text.slice(cl.pos + 1)
        return
      case 'Tab': return
      default:
        if (key.length === 1) {
          cl.text = cl.text.slice(0, cl.pos) + key + cl.text.slice(cl.pos)
          cl.pos++
        }
    }
  }

  private histNav(kind: ':' | '/' | '?', dir: -1 | 1): void {
    const h = this.hist[kind]
    if (h.length === 0) return
    if (this.histIdx === -1) this.histIdx = dir === -1 ? h.length - 1 : 0
    else this.histIdx = clamp(this.histIdx + dir, 0, h.length - 1)
    const cl = this.cmdline
    if (cl) {
      cl.text = h[this.histIdx]
      cl.pos = cl.text.length
    }
  }

  private commitCmdline(): void {
    const cl = this.cmdline
    this.cmdline = null
    this.mode = 'normal'
    if (!cl) return
    if (cl.text !== '') {
      const h = this.hist[cl.kind]
      h.push(cl.text)
      if (h.length > 50) h.shift()
    }
    if (cl.kind === ':') this.executeEx(cl.text)
    else this.commitSearch(cl.text, cl.kind === '/' ? 1 : -1)
  }

  protected abstract executeEx(input: string): void
  protected abstract cmdWriteQuit(force: boolean): void

  // ---- search ----

  protected compileSearch(pattern: string): RegExp | null {
    try {
      const vr = vimRegexToJs(pattern, { icase: this.settings.ic, smartcase: this.settings.smartcase })
      return new RegExp(vr.source, vr.flags)
    } catch { return null }
  }

  private commitSearch(pattern: string, dir: 1 | -1): void {
    const pat = pattern === '' ? this.lastSearch?.pattern ?? '' : pattern
    if (pat === '') return
    this.lastSearch = { pattern: pat, dir }
    const re = this.compileSearch(pat)
    if (!re) { this.err('E486: Pattern not found: ' + pat); return }
    const found = this.searchNext(re, dir, true)
    if (found.found) {
      this.hls = true
      if (found.wrapped) this.setMsg(dir === 1 ? 'search hit BOTTOM, continuing at TOP' : 'search hit TOP, continuing at BOTTOM')
    } else {
      this.err('E486: Pattern not found: ' + pat)
    }
  }

  protected searchNext(re: RegExp, dir: 1 | -1, fromCurrent = false): { found: boolean; wrapped: boolean } {
    const last = this.lastRow()
    const r0 = this.row
    const c0 = this.col
    let wrapped = false
    for (let pass = 0; pass < 2; pass++) {
      if (dir === 1) {
        const start = pass === 0 ? r0 : 0
        for (let rr = start; rr <= last; rr++) {
          const from = pass === 0 && rr === r0 ? (fromCurrent ? c0 : c0 + 1) : 0
          const line = this.lines[rr] ?? ''
          const m = firstMatchFrom(line, from, re)
          if (m) { this.jumpTo(rr, m.index); return { found: true, wrapped } }
        }
        if (wrapped) return { found: false, wrapped }
        wrapped = true
      } else {
        const start = pass === 0 ? r0 : last
        for (let rr = start; rr >= 0; rr--) {
          const upto = pass === 0 && rr === r0 ? (fromCurrent ? c0 : c0 - 1) : Infinity
          const line = this.lines[rr] ?? ''
          const m = lastMatchBefore(line, upto, re)
          if (m) { this.jumpTo(rr, m.index); return { found: true, wrapped } }
        }
        if (wrapped) return { found: false, wrapped }
        wrapped = true
      }
    }
    return { found: false, wrapped }
  }

  private repeatSearch(forward: boolean): void {
    if (!this.lastSearch) return
    const dir = (this.lastSearch.dir * (forward ? 1 : -1)) as 1 | -1
    const re = this.compileSearch(this.lastSearch.pattern)
    if (!re) return
    const found = this.searchNext(re, dir)
    if (found.found) {
      this.hls = true
      if (found.wrapped) this.setMsg(dir === 1 ? 'search hit BOTTOM, continuing at TOP' : 'search hit TOP, continuing at BOTTOM')
    } else {
      this.err('E486: Pattern not found: ' + this.lastSearch.pattern)
    }
  }

  private searchWord(dir: 1 | -1): void {
    const line = this.lines[this.row] ?? ''
    let c = this.col
    if (c >= line.length || !isWord(line[c])) c = Math.max(0, c - 1)
    if (!isWord(line[c] ?? '')) return
    let a = c
    let b = c
    while (a > 0 && isWord(line[a - 1])) a--
    while (b < line.length && isWord(line[b])) b++
    const word = line.slice(a, b)
    const pattern = '\\<' + word + '\\>'
    this.lastSearch = { pattern, dir }
    const re = this.compileSearch(pattern)
    if (!re) return
    const found = this.searchNext(re, dir)
    if (found.found) {
      this.hls = true
      if (found.wrapped) this.setMsg(dir === 1 ? 'search hit BOTTOM, continuing at TOP' : 'search hit TOP, continuing at BOTTOM')
    } else {
      this.err('E486: Pattern not found: ' + word)
    }
  }

  private jumpBackMark(): void {
    if (this.prevPos) this.jumpTo(this.prevPos.row, this.prevPos.col)
  }
  private jumpMarkLine(m: string): void {
    const mark = this.marks.get(m)
    if (!mark) { this.err('E20: Mark not set'); return }
    this.setPrev()
    this.pushJump()
    this.jumpTo(mark.row, firstNonBlank(this.lines[mark.row] ?? ''))
  }
  private jumpMark(m: string): void {
    const mark = this.marks.get(m)
    if (!mark) { this.err('E20: Mark not set'); return }
    this.setPrev()
    this.pushJump()
    this.jumpTo(mark.row, mark.col)
  }

  // ---- rendering ----

  render(): Screen {
    this.ensureCursorVisible()
    const lines: Run[][] = []
    const textRows = Math.max(0, this.rows - 1)
    const numWidth = this.settings.number ? Math.max(3, String(Math.max(1, this.lines.length)).length) + 1 : 0
    const textWidth = Math.max(0, this.cols - numWidth)
    for (let i = 0; i < textRows; i++) {
      const r = this.top + i
      if (r < this.lines.length) {
        const line = this.lines[r]
        const runs: Run[] = []
        if (this.settings.number) {
          runs.push({ t: String(r + 1).padStart(numWidth - 1, ' ') + ' ', s: 'dim' })
        }
        const hl = this.highlightRanges(line)
        const sel = this.selectionForLine(r)
        const cells = this.buildCells(line, sel, hl)
        const slice = cells.slice(this.left, this.left + textWidth)
        runs.push(...this.mergeCells(slice))
        if (runs.length === 0) runs.push({ t: '' })
        lines.push(runs)
      } else {
        const runs: Run[] = []
        if (this.settings.number) runs.push({ t: ' '.repeat(numWidth), s: 'dim' })
        runs.push({ t: '~', s: 'dim' })
        lines.push(runs)
      }
    }
    lines.push(this.statusRuns())
    let cursor: { row: number; col: number } | null = null
    if (this.mode === 'cmdline' && this.cmdline) {
      const cl = this.cmdline
      const ccol = cl.kind.length + cl.pos
      const shift = ccol >= this.cols ? ccol - this.cols + 1 : 0
      cursor = { row: this.rows - 1, col: ccol - shift }
    } else {
      const rr = this.row - this.top
      if (rr >= 0 && rr < textRows) {
        const sc = this.colToScreen(this.row, this.col)
        cursor = { row: rr, col: numWidth + (sc - this.left) }
      }
    }
    return { lines, cursor }
  }

  private statusRuns(): Run[] {
    let cells: Cell[]
    if (this.mode === 'cmdline' && this.cmdline) {
      const cl = this.cmdline
      const text = cl.kind + cl.text
      const ccol = cl.kind.length + cl.pos
      const shift = ccol >= this.cols ? ccol - this.cols + 1 : 0
      cells = text.slice(shift, shift + this.cols).split('').map((ch) => ({ ch }))
    } else {
      let leftCells: Cell[]
      if (this.msgErr) leftCells = this.msg.split('').map((ch) => ({ ch, s: 'err' as Style }))
      else if (this.msg !== '') leftCells = this.msg.split('').map((ch) => ({ ch }))
      else if (this.readOnly) {
        const end = this.top + Math.max(1, this.rows - 2) >= this.lines.length
        leftCells = (':' + this.name() + (end ? ' (END)' : '')).split('').map((ch) => ({ ch }))
      } else {
        leftCells = this.modeCells()
      }
      const ruler = this.ruler()
      const pad = Math.max(0, this.cols - leftCells.length - ruler.length)
      cells = [...leftCells, ...' '.repeat(pad).split('').map((ch) => ({ ch })), ...ruler.split('').map((ch) => ({ ch }))]
      if (cells.length > this.cols) cells = cells.slice(0, this.cols)
    }
    return this.mergeCells(cells)
  }

  private modeCells(): Cell[] {
    let text = ''
    switch (this.mode) {
      case 'insert': text = '-- INSERT --'; break
      case 'replace': text = '-- REPLACE --'; break
      case 'visual':
        text = this.visual?.mode === 'line' ? '-- VISUAL LINE --' : this.visual?.mode === 'block' ? '-- VISUAL BLOCK --' : '-- VISUAL --'
        break
      default: text = ''
    }
    return text.split('').map((ch) => ({ ch, s: 'bold' as Style }))
  }

  private ruler(): string {
    const total = Math.max(1, this.lines.length)
    const page = Math.max(1, this.rows - 2)
    const left = `${this.row + 1},${this.colToScreen(this.row, this.col) + 1}`
    let pos: string
    if (total <= page) pos = 'All'
    else if (this.top <= 0) pos = 'Top'
    else if (this.top + page >= total) pos = 'Bot'
    else pos = Math.floor(((this.row + 1) / total) * 100) + '%'
    return left + ' '.repeat(Math.max(1, 15 - left.length)) + pos
  }

  private highlightRanges(line: string): Array<[number, number]> {
    if (!this.hls || !this.lastSearch) return []
    try {
      const vr = vimRegexToJs(this.lastSearch.pattern, { icase: this.settings.ic, smartcase: this.settings.smartcase })
      const re = new RegExp(vr.source, vr.flags + 'g')
      const out: Array<[number, number]> = []
      let m: RegExpExecArray | null
      while ((m = re.exec(line))) {
        if (m[0].length === 0) { re.lastIndex++; continue }
        out.push([m.index, m.index + m[0].length])
      }
      return out
    } catch { return [] }
  }

  private selectionForLine(r: number): { c0: number; c1: number } | null {
    const v = this.visual
    if (!v) return null
    if (v.mode === 'line') {
      const lo = Math.min(v.anchor.row, v.cursor.row)
      const hi = Math.max(v.anchor.row, v.cursor.row)
      return r >= lo && r <= hi ? { c0: 0, c1: Infinity } : null
    }
    const p = posLess(v.anchor, v.cursor) ? v.anchor : v.cursor
    const q = posLess(v.anchor, v.cursor) ? v.cursor : v.anchor
    if (r < p.row || r > q.row) return null
    if (p.row === q.row) return { c0: p.col, c1: q.col + 1 }
    if (r === p.row) return { c0: p.col, c1: Infinity }
    if (r === q.row) return { c0: 0, c1: q.col + 1 }
    return { c0: 0, c1: Infinity }
  }

  private buildCells(line: string, sel: { c0: number; c1: number } | null, hl: Array<[number, number]>): Cell[] {
    const cells: Cell[] = []
    let screen = 0
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      let s: Style | undefined
      if (sel && i >= sel.c0 && i < sel.c1) s = 'sel'
      else if (hl.some(([a, b]) => i >= a && i < b)) s = 'hl'
      if (ch === '\t') {
        const w = this.settings.ts - (screen % this.settings.ts)
        for (let j = 0; j < w; j++) cells.push({ ch: ' ', s })
        screen += w
      } else {
        cells.push({ ch, s })
        screen += 1
      }
    }
    return cells
  }

  private mergeCells(cells: Cell[]): Run[] {
    const runs: Run[] = []
    let cur = ''
    let curS: Style | undefined
    for (const cell of cells) {
      if (cur !== '' && cell.s !== curS) {
        runs.push(curS ? { t: cur, s: curS } : { t: cur })
        cur = ''
      }
      curS = cell.s
      cur += cell.ch
    }
    if (cur !== '') runs.push(curS ? { t: cur, s: curS } : { t: cur })
    return runs
  }
}

// Hook for the vim-regex module so expandSubReplacement stays tree-shaken with the editor.
void expandSubReplacement
