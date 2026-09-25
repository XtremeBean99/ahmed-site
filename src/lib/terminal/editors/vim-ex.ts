// Ex command layer for the vim editor core: ranges, :w/:q/:e, :set, :s, :g, :sort and friends.
import { VimCore, splitLines, clamp } from './vim-core'
import { vimRegexToJs, expandSubReplacement } from './vim-regex'

interface ExRange { r0: number; r1: number }

export class VimEx extends VimCore {
  protected executeEx(input: string): void {
    const s = input.trim()
    if (s === '') return
    if (s.startsWith('!')) {
      this.err('E: shell commands are not available here')
      return
    }
    let range: ExRange | null = null
    let cmd = s
    if (/^[%.$0-9'/?]/.test(s)) {
      const parsed = this.parseRangeAndCmd(s)
      if (!parsed) return
      range = parsed.range
      cmd = parsed.cmd
    }
    if (this.visual) this.exitVisual()
    if (cmd === '') {
      if (range) this.jumpToLine(range.r0)
      return
    }
    this.dispatch(cmd, range)
  }

  protected cmdWriteQuit(_force: boolean): void {
    if (this.readOnly) {
      this.doneFlag = true
      return
    }
    if (this.modified && !this.writeCurrent(true)) return
    this.doneFlag = true
  }

  // ---- command dispatch ----

  private dispatch(cmd: string, range: ExRange | null): void {
    const c0 = cmd[0]
    if (cmd === 'version') { this.setMsg('Vim-like editor (client-side) 1.0'); return }
    if (cmd === 'help' || cmd.startsWith('help ') || cmd === 'h' || cmd.startsWith('h ')) {
      this.err(`E149: Sorry, no help for ${cmd.slice(cmd[0] === 'h' && cmd[1] === ' ' ? 2 : 4).trim() || 'vim'}`)
      return
    }
    if (cmd === 'set' || cmd.startsWith('set ')) { this.setCmd(cmd.slice(3).trim()); return }
    if (cmd === 'sort' || cmd.startsWith('sort ')) { this.sortCmd(cmd.slice(4).trim(), range); return }
    if (cmd === 'noh' || cmd === 'nohlsearch') { this.hls = false; this.msg = ''; return }
    if (cmd === 'undo' || cmd === 'u') { this.undo(); return }
    if (cmd === 'redo' || cmd === 'red') { this.redo(); return }
    if (cmd === 'earlier') { this.undo(); return }
    if (cmd === 'later') { this.redo(); return }
    if (cmd === 'reg' || cmd === 'registers' || cmd.startsWith('reg ') || cmd.startsWith('registers ')) {
      this.registersCmd()
      return
    }
    if (cmd === 'marks') { this.marksCmd(); return }
    if (cmd === 'retab') { this.retabCmd(range); return }
    if (c0 === 'w') { this.writeCmd(cmd, range); return }
    if (c0 === 'q') { this.quitCmd(cmd); return }
    if (c0 === 'x') { this.quitWriteCmd(cmd); return }
    if (c0 === 'e') { this.editCmd(cmd); return }
    if (c0 === 'r') { this.readCmd(cmd, range); return }
    if (cmd === '&' || cmd === '&&') { this.repeatSubCmd(cmd, range); return }
    if (c0 === 's' && (cmd.length === 1 || !/[A-Za-z0-9_ ]/.test(cmd[1] ?? ''))) {
      this.substituteCmd(cmd, range)
      return
    }
    if ((c0 === 'g' || c0 === 'v') && cmd.length > 1 && !/[A-Za-z0-9_]/.test(cmd[1] ?? '')) {
      this.globalCmd(cmd, range)
      return
    }
    if (cmd === 'd' || cmd.startsWith('d ') || cmd === 'delete' || cmd.startsWith('delete ')) {
      this.deleteCmd(range)
      return
    }
    if (cmd === 'y' || cmd.startsWith('y ') || cmd === 'yank' || cmd.startsWith('yank ')) {
      this.yankCmd(range)
      return
    }
    if (c0 === 'm') { this.moveCmd(cmd, range); return }
    if (c0 === 't' || cmd.startsWith('co')) { this.copyCmd(cmd, range); return }
    if (cmd === '>' || cmd.startsWith('> ') || cmd === '<' || cmd.startsWith('< ')) {
      this.shiftCmd(cmd[0] === '>' ? 1 : -1, range)
      return
    }
    if (cmd === 'j' || cmd.startsWith('j ') || cmd === 'join' || cmd.startsWith('join ')) {
      this.joinCmd(range)
      return
    }
    if (cmd.startsWith('normal ') || cmd === 'normal') {
      this.normalCmd(cmd.slice(6).trim(), range)
      return
    }
    this.err(`E492: Not an editor command: ${cmd.split(/[ !]/)[0]}`)
  }

  // ---- range parsing ----

  private parseRangeAndCmd(s: string): { range: ExRange; cmd: string } | null {
    let i = 0
    let r0: number
    let r1: number
    if (s[0] === '%') {
      r0 = 0
      r1 = this.lastRow()
      i = 1
    } else {
      const a = this.parseAddress(s, 0)
      if (!a) return null
      r0 = a.row
      r1 = a.row
      i = a.next
      if (s[i] === ',') {
        i++
        const b = this.parseAddress(s, i)
        if (!b) return null
        r1 = b.row
        i = b.next
      }
      if (r0 > r1) {
        const t = r0
        r0 = r1
        r1 = t
      }
    }
    let cmd = s.slice(i)
    if (cmd.startsWith(' ')) cmd = cmd.replace(/^ +/, '')
    return { range: { r0, r1 }, cmd }
  }

  private parseAddress(s: string, i: number): { row: number; next: number } | null {
    const c = s[i]
    let row: number
    if (c === '.') {
      row = this.row
      i++
    } else if (c === '$') {
      row = this.lastRow()
      i++
    } else if (c === "'") {
      i++
      const m = s[i]
      if (!m) return null
      const mark = this.marks.get(m)
      if (!mark) {
        this.err('E20: Mark not set')
        return null
      }
      row = mark.row
      i++
    } else if (c >= '0' && c <= '9') {
      let n = 0
      while (i < s.length && s[i] >= '0' && s[i] <= '9') {
        n = n * 10 + (s.charCodeAt(i) - 48)
        i++
      }
      row = clamp(n - 1, 0, this.lastRow())
    } else if (c === '+' || c === '-') {
      row = this.row
    } else if (c === '/' || c === '?') {
      const pat = this.readUntil(s, i + 1, c)
      if (!pat) return null
      i = pat.next
      const re = this.compileSearch(pat.text)
      if (!re) {
        this.err(`E486: Pattern not found: ${pat.text}`)
        return null
      }
      const found = this.findPatternLine(re, c === '/' ? 1 : -1, this.row)
      if (found === null) {
        this.err(`E486: Pattern not found: ${pat.text}`)
        return null
      }
      row = found
    } else {
      return null
    }
    while (i < s.length && (s[i] === '+' || s[i] === '-')) {
      const sign = s[i] === '+' ? 1 : -1
      i++
      const start = i
      let n = 0
      while (i < s.length && s[i] >= '0' && s[i] <= '9') {
        n = n * 10 + (s.charCodeAt(i) - 48)
        i++
      }
      if (i === start) n = 1
      row = clamp(row + sign * n, 0, this.lastRow())
    }
    return { row, next: i }
  }

  private readUntil(s: string, start: number, d: string): { text: string; next: number } | null {
    let j = start
    let out = ''
    while (j < s.length) {
      const ch = s[j]
      if (ch === '\\' && j + 1 < s.length) {
        out += ch + s[j + 1]
        j += 2
        continue
      }
      if (ch === d) return { text: out, next: j + 1 }
      out += ch
      j++
    }
    return null
  }

  private findPatternLine(re: RegExp, dir: 1 | -1, fromRow: number): number | null {
    const last = this.lastRow()
    const test = (r: number): boolean => {
      re.lastIndex = 0
      return re.test(this.lines[r] ?? '')
    }
    if (dir === 1) {
      for (let r = fromRow; r <= last; r++) if (test(r)) return r
      for (let r = 0; r < fromRow; r++) if (test(r)) return r
    } else {
      for (let r = fromRow; r >= 0; r--) if (test(r)) return r
      for (let r = last; r > fromRow; r--) if (test(r)) return r
    }
    return null
  }

  // ---- file commands ----

  private writeCurrent(force: boolean): boolean {
    if (!force && this.readOnly) {
      this.err("E45: 'readonly' option is set (add ! to override)")
      return false
    }
    const data = this.serialize()
    const err = this.host.writeFile(this.absPath, data)
    if (err) {
      this.err(err)
      return false
    }
    this.modified = false
    const lineCount = splitLines(data).length
    this.setMsg(`"${this.name()}" ${lineCount}L, ${data.length}B written`)
    return true
  }

  private writeCmd(cmd: string, range: ExRange | null): void {
    let rest = cmd.slice(1)
    let bang = false
    if (rest.startsWith('!')) {
      bang = true
      rest = rest.slice(1)
    }
    let quit = false
    if (rest.startsWith('q')) {
      quit = true
      rest = rest.slice(1)
      if (rest.startsWith('!')) {
        bang = true
        rest = rest.slice(1)
      }
      if (rest.startsWith('a')) rest = rest.slice(1)
    } else if (rest.startsWith('a')) {
      rest = rest.slice(1)
    }
    if (rest.startsWith('!')) {
      bang = true
      rest = rest.slice(1)
    }
    const file = rest.trim()
    if (file.startsWith('!')) {
      this.err('E: shell commands are not available here')
      return
    }
    let ok: boolean
    if (file !== '') {
      const data = range ? this.lines.slice(range.r0, range.r1 + 1).join('\n') + '\n' : this.serialize()
      const path = this.host.resolve(file)
      const err = this.host.writeFile(path, data)
      if (err) {
        this.err(err)
        return
      }
      const base = path.split('/').pop() || file
      this.setMsg(`"${base}" ${splitLines(data).length}L, ${data.length}B written`)
      ok = true
    } else {
      if (!bang && this.readOnly) {
        this.err("E45: 'readonly' option is set (add ! to override)")
        return
      }
      const data = range ? this.lines.slice(range.r0, range.r1 + 1).join('\n') + '\n' : this.serialize()
      const err = this.host.writeFile(this.absPath, data)
      if (err) {
        this.err(err)
        return
      }
      if (!range) this.modified = false
      this.setMsg(`"${this.name()}" ${splitLines(data).length}L, ${data.length}B written`)
      ok = true
    }
    if (ok && quit) this.doneFlag = true
  }

  private quitCmd(cmd: string): void {
    let rest = cmd.slice(1)
    let bang = false
    if (rest.startsWith('!')) {
      bang = true
      rest = rest.slice(1)
    }
    if (rest.startsWith('a')) rest = rest.slice(1)
    if (rest.startsWith('!')) {
      bang = true
      rest = rest.slice(1)
    }
    if (rest.trim() !== '') {
      this.err(`E492: Not an editor command: ${cmd}`)
      return
    }
    if (!bang && this.modified && !this.readOnly) {
      this.err('E37: No write since last change (add ! to override)')
      return
    }
    this.doneFlag = true
  }

  private quitWriteCmd(cmd: string): void {
    let rest = cmd === 'x' ? '' : cmd.slice(3)
    if (rest.startsWith('!')) rest = rest.slice(1)
    if (rest.trim() !== '') {
      this.err(`E492: Not an editor command: ${cmd}`)
      return
    }
    if (!this.readOnly && this.modified && !this.writeCurrent(true)) return
    this.doneFlag = true
  }

  private editCmd(cmd: string): void {
    let rest = cmd.slice(1)
    let bang = false
    if (rest.startsWith('!')) {
      bang = true
      rest = rest.slice(1)
    }
    const file = rest.trim()
    if (!bang && this.modified && !this.readOnly) {
      this.err('E37: No write since last change (add ! to override)')
      return
    }
    const path = file !== '' ? this.host.resolve(file) : this.absPath
    const data = this.host.readFile(path)
    this.absPath = path
    if (file !== '') this.userPath = file
    this.lines = data === null ? [''] : splitLines(data)
    this.eol = data === null ? true : data.endsWith('\n')
    this.modified = false
    this.row = 0
    this.col = 0
    this.top = 0
    this.left = 0
    this.desired = 0
    this.undoStack = []
    this.redoStack = []
    this.inChange = false
    this.lastChange = null
    this.pendingDot = null
    if (data === null) this.setMsg(`"${this.name()}" [New]`)
    else this.setMsg(`"${this.name()}" ${this.lines.length}L, ${data.length}B`)
    this.ensureCursorVisible()
  }

  private readCmd(cmd: string, range: ExRange | null): void {
    if (!this.modifiable()) return
    const file = cmd.slice(1).trim()
    if (file === '') {
      this.err('E32: No file name')
      return
    }
    const path = this.host.resolve(file)
    const data = this.host.readFile(path)
    if (data === null) {
      this.err(`E484: Can't open file ${file}`)
      return
    }
    const parts = splitLines(data)
    const target = range ? range.r1 : this.row
    this.beginChange()
    this.lines.splice(target + 1, 0, ...parts)
    this.row = target + 1
    this.col = 0
    this.desired = 0
    this.modified = true
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  // ---- ex editing commands ----

  private deleteCmd(range: ExRange | null): void {
    if (!this.modifiable()) return
    const r = range ?? { r0: this.row, r1: this.row }
    this.beginChange()
    this.deleteRange(this.lineRange(r.r0, r.r1), '"')
    this.endChange()
    this.lastChange = {
      k: 'op',
      op: 'd',
      spec: { linewise: true, motion: null, motionCount: r.r1 - r.r0 + 1, textObj: null, inner: false },
      reg: '"',
    }
    this.ensureCursorVisible()
  }

  private yankCmd(range: ExRange | null): void {
    const r = range ?? { r0: this.row, r1: this.row }
    this.yankRange(this.lineRange(r.r0, r.r1), '"')
  }

  private moveCmd(cmd: string, range: ExRange | null): void {
    if (!this.modifiable()) return
    const arg = cmd.slice(1).trim()
    const target = this.parseMoveAddr(arg)
    if (target === null) {
      this.err('E14: Invalid address')
      return
    }
    const r = range ?? { r0: this.row, r1: this.row }
    const block = this.lines.slice(r.r0, r.r1 + 1)
    const rest = this.lines.slice(0, r.r0).concat(this.lines.slice(r.r1 + 1))
    const size = r.r1 - r.r0 + 1
    const insertIdx = target < r.r0 ? target + 1 : target - size + 1
    const at = clamp(insertIdx, 0, rest.length)
    this.beginChange()
    this.lines = rest.slice(0, at).concat(block, rest.slice(at))
    if (this.lines.length === 0) this.lines = ['']
    this.modified = true
    this.row = at
    this.col = 0
    this.desired = 0
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private copyCmd(cmd: string, range: ExRange | null): void {
    if (!this.modifiable()) return
    const arg = cmd.startsWith('co') ? cmd.slice(2).trim() : cmd.slice(1).trim()
    const target = this.parseMoveAddr(arg)
    if (target === null) {
      this.err('E14: Invalid address')
      return
    }
    const r = range ?? { r0: this.row, r1: this.row }
    const block = this.lines.slice(r.r0, r.r1 + 1)
    const at = clamp(target + 1, 0, this.lines.length)
    this.beginChange()
    this.lines = this.lines.slice(0, at).concat(block, this.lines.slice(at))
    this.modified = true
    this.row = at
    this.col = 0
    this.desired = 0
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private parseMoveAddr(s: string): number | null {
    if (s === '0') return -1
    const a = this.parseAddress(s, 0)
    if (!a || a.next !== s.length) return null
    return a.row
  }

  private shiftCmd(dir: 1 | -1, range: ExRange | null): void {
    if (!this.modifiable()) return
    const r = range ?? { r0: this.row, r1: this.row }
    this.beginChange()
    this.shiftRange(this.lineRange(r.r0, r.r1), dir)
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private joinCmd(range: ExRange | null): void {
    if (!this.modifiable()) return
    const r = range ?? { r0: this.row, r1: this.row }
    if (r.r0 >= r.r1) return
    const parts = this.lines.slice(r.r0, r.r1 + 1)
    let out = parts[0]
    for (let i = 1; i < parts.length; i++) {
      out = out.replace(/[ \t]*$/, '') + ' ' + parts[i].replace(/^[ \t]*/, '')
    }
    this.beginChange()
    this.lines.splice(r.r0, r.r1 - r.r0 + 1, out)
    this.modified = true
    this.row = r.r0
    this.col = parts[0].length
    this.desired = this.colToScreen(this.row, this.col)
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private normalCmd(cmds: string, range: ExRange | null): void {
    if (!this.modifiable()) return
    const r = range ?? { r0: this.row, r1: this.row }
    this.beginChange()
    for (let row = r.r0; row <= r.r1 && row < this.lines.length; row++) {
      this.row = row
      this.col = 0
      this.desired = 0
      for (const ch of cmds) {
        this.key({ key: ch, ctrl: false, alt: false, shift: false })
        if (this.doneFlag) break
      }
      if (!this.doneFlag && this.mode !== 'normal') {
        this.key({ key: 'Escape', ctrl: false, alt: false, shift: false })
      }
    }
    if (this.inChange) this.endChange()
    this.ensureCursorVisible()
  }

  private sortCmd(flags: string, range: ExRange | null): void {
    if (!this.modifiable()) return
    const r = range ?? { r0: 0, r1: this.lastRow() }
    const numeric = flags.includes('n')
    const reverse = flags.includes('r')
    const unique = flags.includes('u')
    const icase = flags.includes('i')
    let sorted = this.lines.slice(r.r0, r.r1 + 1)
    sorted.sort((a, b) => {
      let cmp: number
      if (numeric) {
        const na = parseFloat(a.trim())
        const nb = parseFloat(b.trim())
        cmp = (Number.isNaN(na) ? Infinity : na) - (Number.isNaN(nb) ? Infinity : nb)
      } else if (icase) {
        cmp = a.localeCompare(b, undefined, { sensitivity: 'base' })
      } else {
        cmp = a < b ? -1 : a > b ? 1 : 0
      }
      return reverse ? -cmp : cmp
    })
    if (unique) {
      const seen = new Set<string>()
      sorted = sorted.filter((l) => {
        if (seen.has(l)) return false
        seen.add(l)
        return true
      })
    }
    this.beginChange()
    this.lines.splice(r.r0, r.r1 - r.r0 + 1, ...sorted)
    this.modified = true
    this.row = r.r0
    this.col = 0
    this.desired = 0
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private retabCmd(range: ExRange | null): void {
    if (!this.modifiable()) return
    const r = range ?? { r0: 0, r1: this.lastRow() }
    this.beginChange()
    for (let row = r.r0; row <= r.r1 && row < this.lines.length; row++) {
      const line = this.lines[row]
      if (this.settings.et) {
        this.lines[row] = line.replace(/\t/g, ' '.repeat(this.settings.ts))
      } else {
        this.lines[row] = line.replace(new RegExp(` {${this.settings.ts}}`, 'g'), '\t')
      }
    }
    this.modified = true
    this.endChange()
    this.lastChange = null
  }

  // ---- substitute ----

  private substituteCmd(cmd: string, range: ExRange | null): void {
    const r = range ?? { r0: this.row, r1: this.row }
    let pat: string
    let rep: string
    let flags: string
    if (cmd === 's') {
      if (!this.lastSub) {
        this.err('E33: No previous substitute regular expression')
        return
      }
      pat = this.lastSub.pat
      rep = this.lastSub.rep
      flags = this.lastSub.flags
    } else {
      const parsed = this.parseSubstitute(cmd)
      if (!parsed) {
        this.err('E488: Trailing characters')
        return
      }
      pat = parsed.pat
      rep = parsed.rep
      flags = parsed.flags
      if (pat === '') {
        if (!this.lastSub) {
          this.err('E33: No previous substitute regular expression')
          return
        }
        pat = this.lastSub.pat
      }
    }
    this.lastSub = { pat, rep, flags }
    const rows: number[] = []
    for (let row = r.r0; row <= r.r1 && row < this.lines.length; row++) rows.push(row)
    this.applySubstitute(pat, rep, flags, rows)
  }

  private repeatSubCmd(cmd: string, range: ExRange | null): void {
    if (!this.lastSub) {
      this.err('E33: No previous substitute regular expression')
      return
    }
    const r = range ?? { r0: this.row, r1: this.row }
    const rows: number[] = []
    for (let row = r.r0; row <= r.r1 && row < this.lines.length; row++) rows.push(row)
    this.applySubstitute(this.lastSub.pat, this.lastSub.rep, this.lastSub.flags, rows)
  }

  private parseSubstitute(cmd: string): { pat: string; rep: string; flags: string } | null {
    const d = cmd[1]
    if (!d || /[A-Za-z0-9_\\ ]/.test(d)) return null
    const patRead = this.readUntil(cmd, 2, d)
    if (!patRead) return null
    const repRead = this.readUntil(cmd, patRead.next, d)
    if (!repRead) return null
    return { pat: patRead.text, rep: repRead.text, flags: cmd.slice(repRead.next) }
  }

  private applySubstitute(pat: string, rep: string, flags: string, rows: number[]): void {
    const ic = this.settings.ic || flags.includes('i')
    let vr: { source: string; flags: string }
    try {
      vr = vimRegexToJs(pat, { icase: ic, smartcase: this.settings.smartcase })
    } catch {
      this.err(`E486: Pattern not found: ${pat}`)
      return
    }
    const re = new RegExp(vr.source, vr.flags)
    const global = flags.includes('g')
    const onlyCount = flags.includes('n')
    const noErr = flags.includes('e')
    const newLines = this.lines.slice()
    let total = 0
    let linesChanged = 0
    for (const row of rows) {
      const out = this.subLine(newLines[row] ?? '', re, rep, global)
      if (out.count > 0) {
        newLines[row] = out.line
        total += out.count
        linesChanged++
      }
    }
    if (total === 0 && !noErr && !onlyCount) {
      this.err(`E486: Pattern not found: ${pat}`)
      return
    }
    if (total > 0 && !onlyCount) {
      this.beginChange()
      this.lines = newLines
      this.modified = true
      this.endChange()
      this.lastChange = null
    }
    const target = rows[0] ?? this.row
    this.row = Math.min(target, this.lastRow())
    this.col = Math.min(this.col, this.lineLen(this.row))
    this.desired = this.colToScreen(this.row, this.col)
    this.ensureCursorVisible()
    if (onlyCount) this.setMsg(`${total} matches on ${linesChanged} line${linesChanged === 1 ? '' : 's'}`)
    else if (total > 0) this.setMsg(`${total} substitution${total === 1 ? '' : 's'} on ${linesChanged} line${linesChanged === 1 ? '' : 's'}`)
    else this.setMsg('')
  }

  private subLine(line: string, re: RegExp, rep: string, global: boolean): { line: string; count: number } {
    if (!global) {
      const m = new RegExp(re.source, re.flags).exec(line)
      if (!m) return { line, count: 0 }
      return { line: line.slice(0, m.index) + this.subReplacement(rep, m) + line.slice(m.index + m[0].length), count: 1 }
    }
    const g = new RegExp(re.source, re.flags + 'g')
    let out = ''
    let last = 0
    let count = 0
    let m: RegExpExecArray | null
    while ((m = g.exec(line))) {
      if (m[0].length === 0) {
        g.lastIndex++
        continue
      }
      out += line.slice(last, m.index) + this.subReplacement(rep, m)
      last = m.index + m[0].length
      count++
    }
    out += line.slice(last)
    return { line: out, count }
  }

  private subReplacement(rep: string, m: RegExpExecArray): string {
    const groups: { [n: number]: string | undefined } = {}
    for (let i = 1; i < m.length; i++) groups[i] = m[i]
    return expandSubReplacement(rep, groups, m[0])
  }

  // ---- global ----

  private globalCmd(cmd: string, range: ExRange | null): void {
    let i = 0
    let neg = false
    if (cmd[0] === 'v') {
      neg = true
      i = 1
    } else {
      i = 1
      if (cmd[i] === '!') {
        neg = true
        i++
      }
    }
    const d = cmd[i]
    if (!d || /[A-Za-z0-9_ ]/.test(d)) {
      this.err('E146: Regular expressions can not be delimited by letters')
      return
    }
    const patRead = this.readUntil(cmd, i + 1, d)
    if (!patRead) {
      this.err('E146: Regular expressions can not be delimited by letters')
      return
    }
    const sub = cmd.slice(patRead.next).trim()
    const re = this.compileSearch(patRead.text)
    if (!re) {
      this.err(`E486: Pattern not found: ${patRead.text}`)
      return
    }
    const r = range ?? { r0: 0, r1: this.lastRow() }
    const rows: number[] = []
    for (let row = r.r0; row <= r.r1 && row < this.lines.length; row++) {
      re.lastIndex = 0
      const m = re.test(this.lines[row] ?? '')
      if (neg ? !m : m) rows.push(row)
    }
    if (sub === '' || sub === 'p' || sub === 'print') {
      const text = rows.map((row) => this.lines[row]).join('\n')
      this.setMsg(text.length > 200 ? text.slice(0, 200) : text)
      return
    }
    if (sub === 'd') {
      this.deleteRows(rows)
      return
    }
    if (sub === 's' || (sub.length > 1 && sub[0] === 's' && !/[A-Za-z0-9_ ]/.test(sub[1] ?? ''))) {
      this.globalSubstitute(rows, sub)
      return
    }
    if (sub === 'normal' || sub.startsWith('normal ')) {
      this.globalNormal(rows, sub.slice(6).trim())
      return
    }
    if (sub === 'm0' || sub === 'm 0') {
      this.globalMoveTop(rows)
      return
    }
    if (sub === 't.' || sub === 't .') {
      this.globalCopy(rows)
      return
    }
    this.err(`E492: Not an editor command: ${sub.split(/[ !]/)[0]}`)
  }

  private deleteRows(rows: number[]): void {
    if (!this.modifiable()) return
    this.beginChange()
    for (let i = rows.length - 1; i >= 0; i--) this.lines.splice(rows[i], 1)
    if (this.lines.length === 0) this.lines = ['']
    this.modified = true
    this.row = Math.min(rows[0] ?? 0, this.lastRow())
    this.col = 0
    this.desired = 0
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private globalSubstitute(rows: number[], sub: string): void {
    if (!this.modifiable()) return
    let pat: string
    let rep: string
    let flags: string
    if (sub === 's') {
      if (!this.lastSub) {
        this.err('E33: No previous substitute regular expression')
        return
      }
      pat = this.lastSub.pat
      rep = this.lastSub.rep
      flags = this.lastSub.flags
    } else {
      const parsed = this.parseSubstitute(sub)
      if (!parsed) {
        this.err('E488: Trailing characters')
        return
      }
      if (parsed.pat !== '') pat = parsed.pat
      else if (this.lastSub) pat = this.lastSub.pat
      else {
        this.err('E33: No previous substitute regular expression')
        return
      }
      rep = parsed.rep
      flags = parsed.flags
    }
    this.lastSub = { pat, rep, flags }
    this.applySubstitute(pat, rep, flags, rows)
  }

  private globalNormal(rows: number[], cmds: string): void {
    if (!this.modifiable()) return
    this.beginChange()
    for (const row of rows) {
      this.row = row
      this.col = 0
      this.desired = 0
      for (const ch of cmds) {
        this.key({ key: ch, ctrl: false, alt: false, shift: false })
        if (this.doneFlag) break
      }
      if (!this.doneFlag && this.mode !== 'normal') {
        this.key({ key: 'Escape', ctrl: false, alt: false, shift: false })
      }
    }
    if (this.inChange) this.endChange()
    this.ensureCursorVisible()
  }

  private globalMoveTop(rows: number[]): void {
    if (!this.modifiable()) return
    this.beginChange()
    const block: string[] = []
    for (const row of rows) block.push(this.lines[row])
    for (let i = rows.length - 1; i >= 0; i--) this.lines.splice(rows[i], 1)
    this.lines.splice(0, 0, ...block)
    this.modified = true
    this.row = 0
    this.col = 0
    this.desired = 0
    this.endChange()
    this.lastChange = null
    this.ensureCursorVisible()
  }

  private globalCopy(rows: number[]): void {
    if (!this.modifiable()) return
    this.beginChange()
    for (let i = rows.length - 1; i >= 0; i--) {
      this.lines.splice(rows[i] + 1, 0, this.lines[rows[i]])
    }
    this.modified = true
    this.endChange()
    this.lastChange = null
  }

  // ---- set / registers / marks ----

  private setCmd(args: string): void {
    if (args === '') {
      const set: string[] = []
      if (this.settings.number) set.push('number')
      if (this.settings.ai) set.push('ai')
      if (this.settings.ic) set.push('ic')
      if (this.settings.smartcase) set.push('smartcase')
      if (this.settings.hls) set.push('hls')
      if (this.settings.et) set.push('et')
      if (this.settings.wrap) set.push('wrap')
      if (this.settings.list) set.push('list')
      if (this.settings.is) set.push('is')
      if (this.settings.sw !== 8) set.push(`sw=${this.settings.sw}`)
      if (this.settings.ts !== 8) set.push(`ts=${this.settings.ts}`)
      this.setMsg(set.length ? set.join(' ') : '')
      return
    }
    for (const opt of args.split(/\s+/)) {
      if (opt === '') continue
      const neg = opt.startsWith('no')
      const bang = opt.endsWith('!')
      const name = (neg ? opt.slice(2) : bang ? opt.slice(0, -1) : opt).split('=')[0]
      const val = opt.includes('=') ? opt.slice(opt.indexOf('=') + 1) : null
      const setBool = (fn: (v: boolean) => void): void => {
        fn(bang ? !this.curBool(name) : !neg)
      }
      switch (name) {
        case 'number': case 'nu': setBool((v) => { this.settings.number = v }); break
        case 'rnu': setBool((v) => { this.settings.number = v }); break
        case 'ignorecase': case 'ic': setBool((v) => { this.settings.ic = v }); break
        case 'smartcase': case 'scs': setBool((v) => { this.settings.smartcase = v }); break
        case 'hlsearch': case 'hls': setBool((v) => { this.settings.hls = v }); break
        case 'autoindent': case 'ai': setBool((v) => { this.settings.ai = v }); break
        case 'expandtab': case 'et': setBool((v) => { this.settings.et = v }); break
        case 'wrap': setBool((v) => { this.settings.wrap = v }); break
        case 'list': setBool((v) => { this.settings.list = v }); break
        case 'incsearch': case 'is': setBool((v) => { this.settings.is = v }); break
        case 'shiftwidth': case 'sw':
          if (val !== null && /^\d+$/.test(val)) this.settings.sw = parseInt(val, 10)
          else this.err(`E518: Unknown option: ${opt}`)
          break
        case 'tabstop': case 'ts':
          if (val !== null && /^\d+$/.test(val)) this.settings.ts = parseInt(val, 10)
          else this.err(`E518: Unknown option: ${opt}`)
          break
        default:
          this.err(`E518: Unknown option: ${opt}`)
      }
    }
  }

  private curBool(name: string): boolean {
    switch (name) {
      case 'number': case 'nu': case 'rnu': return this.settings.number
      case 'ignorecase': case 'ic': return this.settings.ic
      case 'smartcase': case 'scs': return this.settings.smartcase
      case 'hlsearch': case 'hls': return this.settings.hls
      case 'autoindent': case 'ai': return this.settings.ai
      case 'expandtab': case 'et': return this.settings.et
      case 'wrap': return this.settings.wrap
      case 'list': return this.settings.list
      case 'incsearch': case 'is': return this.settings.is
      default: return false
    }
  }

  private registersCmd(): void {
    const out: string[] = []
    for (let code = 'a'.charCodeAt(0); code <= 'z'.charCodeAt(0); code++) {
      const c = String.fromCharCode(code)
      const r = this.registers.get(c)
      if (r) out.push(`"${c}   ${r.text.replace(/\n/g, '\\n').slice(0, 40)}`)
    }
    const d = this.registers.get('"')
    if (d) out.unshift(`""   ${d.text.replace(/\n/g, '\\n').slice(0, 40)}`)
    this.setMsg(out.length ? out.join(' | ').slice(0, 200) : '')
  }

  private marksCmd(): void {
    const out: string[] = []
    for (const [m, p] of this.marks) out.push(`${m} ${p.row + 1},${p.col + 1}`)
    this.setMsg(out.length ? out.join(' | ').slice(0, 200) : '')
  }
}
