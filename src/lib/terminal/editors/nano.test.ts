import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNano } from './nano'
import type { Editor, EditorHost } from '../types'

class FakeHost implements EditorHost {
  files = new Map<string, string>()
  failWrites = new Set<string>()
  resolve(p: string): string { return p.startsWith('/') ? p : '/cwd/' + p }
  readFile(p: string): string | null { return this.files.has(p) ? this.files.get(p)! : null }
  writeFile(p: string, data: string): string | null {
    if (this.failWrites.has(p)) return 'Permission denied'
    this.files.set(p, data)
    return null
  }
  exists(p: string): boolean { return this.files.has(p) }
}

function key(e: Editor, k: string, opts: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): void {
  e.key({ key: k, ctrl: !!opts.ctrl, alt: !!opts.alt, shift: !!opts.shift })
}
function ctrl(e: Editor, ch: string): void { key(e, ch, { ctrl: true }) }
function alt(e: Editor, ch: string): void { key(e, ch, { alt: true }) }
function type(e: Editor, s: string): void { for (const ch of s) key(e, ch) }

function screenText(e: Editor): string[] {
  return e.render().lines.map((runs) => runs.map((r) => r.t).join(''))
}
function rowText(e: Editor, row: number): string { return screenText(e)[row] ?? '' }
function statusRaw(e: Editor): string {
  const lines = e.render().lines
  return lines[lines.length - 3].map((r) => r.t).join('')
}
function statusText(e: Editor): string { return statusRaw(e).trim() }
function titleText(e: Editor): string { return rowText(e, 0) }

function textRuns(e: Editor, row: number) { return e.render().lines[row] ?? [] }
function plainRunText(e: Editor, row: number): string {
  return textRuns(e, row).filter((r) => !r.s).map((r) => r.t).join('')
}

// ---- loading and title ----------------------------------------------------------------------

test('loads an existing file and reports the read count', () => {
  const host = new FakeHost()
  host.files.set('/cwd/a.txt', 'one\ntwo\nthree\n')
  const n = createNano(host, 'a.txt', 24, 80)
  assert.equal(statusText(n), '[ Read 3 lines ]')
  assert.equal(plainRunText(n, 1), 'one')
  assert.equal(plainRunText(n, 2), 'two')
  assert.equal(plainRunText(n, 3), 'three')
})

test('reports singular read count for one line', () => {
  const host = new FakeHost()
  host.files.set('/cwd/a.txt', 'solo\n')
  const n = createNano(host, 'a.txt', 24, 80)
  assert.equal(statusText(n), '[ Read 1 line ]')
})

test('a missing file starts empty with New File', () => {
  const host = new FakeHost()
  const n = createNano(host, 'ghost.txt', 24, 80)
  assert.equal(statusText(n), '[ New File ]')
  assert.equal(plainRunText(n, 1), '')
})

test('a nameless buffer shows New Buffer in the title', () => {
  const host = new FakeHost()
  const n = createNano(host, '', 24, 80)
  assert.ok(titleText(n).includes('New Buffer'))
  assert.ok(!titleText(n).includes('Modified'))
})

test('title bar has the exact left label, file name, Modified and padding', () => {
  const host = new FakeHost()
  const n = createNano(host, 'a.txt', 24, 80)
  assert.equal(titleText(n).length, 80)
  assert.ok(titleText(n).startsWith('  GNU nano 7.2'))
  assert.ok(titleText(n).includes('a.txt'))
  type(n, 'x')
  assert.ok(titleText(n).endsWith('Modified'))
  assert.equal(titleText(n).length, 80)
})

test('render returns exactly rows lines for several sizes', () => {
  const host = new FakeHost()
  for (const rows of [1, 2, 3, 4, 5, 24]) {
    const n = createNano(host, '', rows, 80)
    assert.equal(n.render().lines.length, rows, `rows=${rows}`)
  }
})

test('the two shortcut rows list the nano commands', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  const r22 = rowText(n, 22)
  const r23 = rowText(n, 23)
  assert.equal(r22, '^G Help      ^O Write Out ^W Where Is  ^K Cut       ^T Execute   ^C Location  ')
  assert.equal(r23, '^X Exit      ^R Read File ^\\ Replace   ^U Paste     ^J Justify   ^/ Go To Line')
})

test('the initial status message disappears after the next keypress', () => {
  const host = new FakeHost()
  host.files.set('/cwd/a.txt', 'one\ntwo\n')
  const n = createNano(host, 'a.txt', 24, 80)
  assert.equal(statusText(n), '[ Read 2 lines ]')
  key(n, 'ArrowRight')
  assert.equal(statusText(n), '')
})

// ---- typing and cursor ----------------------------------------------------------------------

test('typing inserts characters and moves the cursor', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello')
  assert.equal(plainRunText(n, 1), 'hello')
  assert.deepEqual(n.render().cursor, { row: 1, col: 5 })
})

test('Enter splits the line and places the cursor on the new line', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'ab')
  key(n, 'Enter')
  type(n, 'cd')
  assert.equal(plainRunText(n, 1), 'ab')
  assert.equal(plainRunText(n, 2), 'cd')
  assert.deepEqual(n.render().cursor, { row: 2, col: 2 })
})

test('Backspace deletes a character and joins lines at the left edge', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'ab')
  key(n, 'Enter')
  type(n, 'cd')
  key(n, 'Home')
  key(n, 'Backspace')
  assert.equal(plainRunText(n, 1), 'abcd')
  assert.equal(plainRunText(n, 2), '')
  assert.deepEqual(n.render().cursor, { row: 1, col: 2 })
})

test('Delete removes a character and joins lines at the right edge', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'ab')
  key(n, 'Enter')
  type(n, 'cd')
  key(n, 'ArrowUp')
  key(n, 'Delete')
  assert.equal(plainRunText(n, 1), 'abcd')
  assert.deepEqual(n.render().cursor, { row: 1, col: 2 })
})

test('Backspace mid-line and Delete mid-line remove single characters', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abcd')
  key(n, 'Backspace')
  assert.equal(plainRunText(n, 1), 'abc')
  key(n, 'Home')
  key(n, 'Delete')
  assert.equal(plainRunText(n, 1), 'bc')
})

test('Ctrl-H is backspace and Ctrl-D is delete', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abc')
  ctrl(n, 'h')
  assert.equal(plainRunText(n, 1), 'ab')
  key(n, 'Home')
  ctrl(n, 'd')
  assert.equal(plainRunText(n, 1), 'b')
})

test('Tab inserts a tab character rendered as spaces to 8-column stops', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'a')
  key(n, 'Tab')
  type(n, 'b')
  assert.equal(plainRunText(n, 1), 'a       b')
  assert.deepEqual(n.render().cursor, { row: 1, col: 9 })
})

test('horizontal scrolling keeps the cursor visible on long lines', () => {
  const n = createNano(new FakeHost(), '', 10, 10)
  type(n, 'abcdefghijklmno')
  assert.equal(plainRunText(n, 1), 'ghijklmno')
  assert.deepEqual(n.render().cursor, { row: 1, col: 9 })
  key(n, 'Home')
  assert.equal(plainRunText(n, 1), 'abcdefghij')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
})

test('vertical scrolling follows the cursor down and up', () => {
  const n = createNano(new FakeHost(), '', 10, 20)
  n.paste('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n')
  assert.equal(plainRunText(n, 1), '6')
  assert.equal(plainRunText(n, 6), '')
  assert.deepEqual(n.render().cursor, { row: 6, col: 0 })
  for (let i = 0; i < 9; i++) key(n, 'ArrowUp')
  assert.equal(plainRunText(n, 1), '2')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
})

test('arrows, Home/End and their Ctrl aliases move the cursor', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abc')
  key(n, 'ArrowLeft')
  assert.deepEqual(n.render().cursor, { row: 1, col: 2 })
  ctrl(n, 'b')
  assert.deepEqual(n.render().cursor, { row: 1, col: 1 })
  key(n, 'Home')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
  key(n, 'End')
  assert.deepEqual(n.render().cursor, { row: 1, col: 3 })
  ctrl(n, 'a')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
  ctrl(n, 'e')
  assert.deepEqual(n.render().cursor, { row: 1, col: 3 })
})

test('Ctrl-P and Ctrl-N move between lines', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'ab')
  key(n, 'Enter')
  type(n, 'cd')
  key(n, 'Home')
  ctrl(n, 'p')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
  ctrl(n, 'n')
  assert.deepEqual(n.render().cursor, { row: 2, col: 0 })
})

test('PageUp and PageDown move by one screenful', () => {
  const n = createNano(new FakeHost(), '', 10, 20)
  n.paste('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n')
  key(n, 'PageUp')
  assert.equal(plainRunText(n, 1), '5')
  key(n, 'PageDown')
  assert.equal(plainRunText(n, 1), '6')
})

test('word movement: Ctrl-Space, Alt-Space and ctrl+arrows', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello, world')
  key(n, 'Home')
  key(n, ' ', { ctrl: true })
  assert.deepEqual(n.render().cursor, { row: 1, col: 7 })
  key(n, 'Home')
  key(n, ' ', { alt: true })
  assert.deepEqual(n.render().cursor, { row: 1, col: 7 })
  key(n, 'ArrowLeft', { ctrl: true })
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
  key(n, 'ArrowRight', { ctrl: true })
  assert.deepEqual(n.render().cursor, { row: 1, col: 7 })
})

test('Alt-backslash and Alt-slash jump to the first and last line', () => {
  const n = createNano(new FakeHost(), '', 10, 20)
  n.paste('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n')
  alt(n, '\\')
  assert.equal(n.render().cursor!.row, 1)
  alt(n, '/')
  assert.equal(n.render().cursor!.row, 6)
})

// ---- line numbers ---------------------------------------------------------------------------

test('lineNumbers option shows a right-aligned gutter', () => {
  const n = createNano(new FakeHost(), '', 24, 80, { lineNumbers: true })
  type(n, 'hello')
  assert.equal(plainRunText(n, 1), '  1 hello')
  assert.deepEqual(n.render().cursor, { row: 1, col: 9 })
})

test('Alt-# toggles line numbers on and off', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hi')
  alt(n, '#')
  assert.equal(plainRunText(n, 1), '  1 hi')
  alt(n, '#')
  assert.equal(plainRunText(n, 1), 'hi')
})

// ---- cut, copy, paste -----------------------------------------------------------------------

test('Ctrl-K cuts the current line and Ctrl-U pastes it', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  n.paste('a\nb\nc')
  key(n, 'ArrowUp')
  ctrl(n, 'k')
  assert.equal(plainRunText(n, 1), 'a')
  assert.equal(plainRunText(n, 2), 'c')
  ctrl(n, 'u')
  assert.equal(plainRunText(n, 1), 'a')
  assert.equal(plainRunText(n, 2), 'b')
  assert.equal(plainRunText(n, 3), 'c')
})

test('consecutive Ctrl-K cuts append to the cut buffer', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  n.paste('a\nb\nc')
  alt(n, '\\')
  ctrl(n, 'k')
  ctrl(n, 'k')
  ctrl(n, 'u')
  assert.equal(plainRunText(n, 1), 'a')
  assert.equal(plainRunText(n, 2), 'b')
  assert.equal(plainRunText(n, 3), 'c')
})

test('Alt-6 copies the current line without cutting', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello')
  alt(n, '6')
  key(n, 'Enter')
  ctrl(n, 'u')
  assert.equal(plainRunText(n, 1), 'hello')
  assert.equal(plainRunText(n, 2), 'hello')
})

test('mark, cut region and paste region', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abcdef')
  key(n, 'Home')
  key(n, 'ArrowRight')
  key(n, 'ArrowRight')
  alt(n, 'a')
  key(n, 'End')
  ctrl(n, 'k')
  assert.equal(plainRunText(n, 1), 'ab')
  ctrl(n, 'u')
  assert.equal(plainRunText(n, 1), 'abcdef')
})

test('mark, copy region and paste region', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abcdef')
  key(n, 'Home')
  key(n, 'ArrowRight')
  alt(n, 'a')
  key(n, 'End')
  alt(n, '6')
  key(n, 'Home')
  ctrl(n, 'u')
  assert.equal(plainRunText(n, 1), 'bcdefabcdef')
})

test('selection is rendered with the sel style', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abcdef')
  key(n, 'Home')
  key(n, 'ArrowRight')
  alt(n, 'a')
  key(n, 'End')
  const runs = textRuns(n, 1)
  assert.ok(runs.some((r) => r.s === 'sel'))
  assert.equal(runs.filter((r) => r.s === 'sel').map((r) => r.t).join(''), 'bcdef')
})

test('typing clears the mark', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abcdef')
  key(n, 'Home')
  alt(n, 'a')
  key(n, 'End')
  assert.ok(textRuns(n, 1).some((r) => r.s === 'sel'))
  type(n, 'x')
  assert.ok(!textRuns(n, 1).some((r) => r.s === 'sel'))
})

test('pasting multiple lines inserts a block at the cursor', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'az')
  key(n, 'Home')
  key(n, 'ArrowRight')
  n.paste('b\nc')
  assert.equal(plainRunText(n, 1), 'ab')
  assert.equal(plainRunText(n, 2), 'cz')
})

// ---- undo and redo --------------------------------------------------------------------------

test('undo groups a typing run into one step', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello')
  alt(n, 'u')
  assert.equal(plainRunText(n, 1), '')
  alt(n, 'e')
  assert.equal(plainRunText(n, 1), 'hello')
})

test('Enter is its own undo step', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'ab')
  key(n, 'Enter')
  type(n, 'cd')
  alt(n, 'u')
  assert.equal(plainRunText(n, 1), 'ab')
  alt(n, 'u')
  assert.equal(plainRunText(n, 1), 'ab')
  assert.equal(plainRunText(n, 2), '')
})

test('cut and paste are undo steps', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  n.paste('a\nb\nc')
  key(n, 'ArrowUp')
  ctrl(n, 'k')
  assert.equal(plainRunText(n, 2), 'c')
  alt(n, 'u')
  assert.equal(plainRunText(n, 1), 'a')
  assert.equal(plainRunText(n, 2), 'b')
  assert.equal(plainRunText(n, 3), 'c')
  alt(n, 'e')
  assert.equal(plainRunText(n, 2), 'c')
})

test('undo back to the saved state clears Modified', () => {
  const host = new FakeHost()
  host.files.set('/cwd/a.txt', 'one\n')
  const n = createNano(host, 'a.txt', 24, 80)
  type(n, 'x')
  assert.ok(titleText(n).includes('Modified'))
  alt(n, 'u')
  assert.ok(!titleText(n).includes('Modified'))
})

// ---- search ---------------------------------------------------------------------------------

test('search finds a match, moves the cursor and highlights it', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello world hello')
  key(n, 'Home')
  ctrl(n, 'w')
  type(n, 'world')
  key(n, 'Enter')
  assert.deepEqual(n.render().cursor, { row: 1, col: 6 })
  const hl = textRuns(n, 1).filter((r) => r.s === 'hl')
  assert.equal(hl.map((r) => r.t).join(''), 'world')
})

test('search wraps around and reports Search Wrapped', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello world')
  key(n, 'End')
  ctrl(n, 'w')
  type(n, 'hello')
  key(n, 'Enter')
  assert.equal(statusText(n), 'Search Wrapped')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
})

test('search not found reports the quoted needle', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello')
  key(n, 'Home')
  ctrl(n, 'w')
  type(n, 'zzz')
  key(n, 'Enter')
  assert.equal(statusText(n), '"zzz" not found')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
})

test('search is case-insensitive by default and Alt-C toggles case', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'Hello')
  key(n, 'Home')
  ctrl(n, 'w')
  type(n, 'hello')
  key(n, 'Enter')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
  ctrl(n, 'w')
  alt(n, 'c')
  key(n, 'Enter')
  assert.equal(statusText(n), '"hello" not found')
})

test('search prompt shows the previous search and empty answer reuses it', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'one two one')
  ctrl(n, 'w')
  type(n, 'two')
  key(n, 'Enter')
  key(n, 'End')
  ctrl(n, 'w')
  assert.equal(statusRaw(n), 'Search [two]: ')
  key(n, 'Enter')
  assert.equal(statusText(n), 'Search Wrapped')
})

test('Alt-W repeats the last search from the cursor', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'a b a')
  key(n, 'Home')
  ctrl(n, 'w')
  type(n, 'a')
  key(n, 'Enter')
  key(n, 'ArrowRight')
  alt(n, 'w')
  assert.deepEqual(n.render().cursor, { row: 1, col: 4 })
})

test('Alt-B searches backwards', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'cat dog cat')
  key(n, 'End')
  ctrl(n, 'w')
  type(n, 'cat')
  alt(n, 'b')
  key(n, 'Enter')
  assert.deepEqual(n.render().cursor, { row: 1, col: 8 })
})

// ---- replace --------------------------------------------------------------------------------

test('replace: yes on first, no on second', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'foo bar foo')
  key(n, 'Home')
  ctrl(n, '\\')
  assert.equal(statusRaw(n), 'Search (to replace): ')
  type(n, 'foo')
  key(n, 'Enter')
  assert.equal(statusRaw(n), 'Replace with: ')
  type(n, 'X')
  key(n, 'Enter')
  assert.equal(statusText(n), 'Replace this instance?')
  key(n, 'y')
  key(n, 'n')
  assert.equal(statusText(n), 'Replaced 1 occurrence')
  assert.equal(plainRunText(n, 1), 'X bar foo')
})

test('replace all occurrences with A', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'foo bar foo')
  key(n, 'Home')
  ctrl(n, '\\')
  type(n, 'foo')
  key(n, 'Enter')
  type(n, 'X')
  key(n, 'Enter')
  key(n, 'a')
  assert.equal(statusText(n), 'Replaced 2 occurrences')
  assert.equal(plainRunText(n, 1), 'X bar X')
})

test('replace prompt shows the per-match shortcut row', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'foo')
  key(n, 'Home')
  ctrl(n, '\\')
  type(n, 'foo')
  key(n, 'Enter')
  type(n, 'X')
  key(n, 'Enter')
  assert.ok(rowText(n, 22).includes('Y Yes'))
  assert.ok(rowText(n, 22).includes('N No'))
  assert.ok(rowText(n, 22).includes('^C Cancel'))
  assert.ok(rowText(n, 22).includes('A All'))
})

test('replace can be cancelled with Escape', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'foo')
  key(n, 'Home')
  ctrl(n, '\\')
  type(n, 'foo')
  key(n, 'Enter')
  type(n, 'X')
  key(n, 'Enter')
  key(n, 'Escape')
  assert.equal(statusText(n), '[ Cancelled ]')
  assert.equal(plainRunText(n, 1), 'foo')
})

test('replace with no matches reports Replaced 0 occurrences', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'foo')
  key(n, 'Home')
  ctrl(n, '\\')
  type(n, 'bar')
  key(n, 'Enter')
  type(n, 'X')
  key(n, 'Enter')
  assert.equal(statusText(n), 'Replaced 0 occurrences')
})

// ---- go to line and location -----------------------------------------------------------------

test('go to line accepts a bare line number', () => {
  const n = createNano(new FakeHost(), '', 10, 20)
  n.paste('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n')
  alt(n, 'g')
  type(n, '8')
  key(n, 'Enter')
  assert.equal(plainRunText(n, 1), 'f')
})

test('go to line accepts line,column', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abcdef')
  alt(n, 'g')
  type(n, '1,4')
  key(n, 'Enter')
  assert.deepEqual(n.render().cursor, { row: 1, col: 3 })
})

test('Ctrl-underscore opens go to line', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'abc')
  key(n, '_', { ctrl: true })
  assert.equal(statusRaw(n), 'Enter line number, column number: ')
  type(n, '1')
  key(n, 'Enter')
  assert.deepEqual(n.render().cursor, { row: 1, col: 0 })
})

test('Ctrl-C reports the cursor location', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'hello')
  key(n, 'Enter')
  type(n, 'world')
  ctrl(n, 'c')
  assert.equal(statusText(n), '[ line 2/2 (100%), col 6/6 (100%), char 12/12 (100%) ]')
})

// ---- write out ------------------------------------------------------------------------------

test('write out saves under a new name and clears Modified', () => {
  const host = new FakeHost()
  const n = createNano(host, '', 24, 80)
  type(n, 'hi')
  ctrl(n, 'o')
  assert.equal(statusRaw(n), 'File Name to Write: ')
  type(n, 'new.txt')
  key(n, 'Enter')
  assert.equal(host.files.get('/cwd/new.txt'), 'hi\n')
  assert.equal(statusText(n), '[ Wrote 1 line ]')
  assert.ok(!titleText(n).includes('Modified'))
})

test('write out prompt is prefilled with the current path', () => {
  const n = createNano(new FakeHost(), 'a.txt', 24, 80)
  type(n, 'x')
  ctrl(n, 'o')
  assert.equal(statusText(n), 'File Name to Write: a.txt')
})

test('write out to a different existing file asks for overwrite confirmation', () => {
  const host = new FakeHost()
  host.files.set('/cwd/other.txt', 'old\n')
  const n = createNano(host, 'new.txt', 24, 80)
  type(n, 'hi')
  ctrl(n, 'o')
  ctrl(n, 'u')
  type(n, 'other.txt')
  key(n, 'Enter')
  assert.equal(statusText(n), 'File exists, OVERWRITE ?')
  key(n, 'y')
  assert.equal(host.files.get('/cwd/other.txt'), 'hi\n')
  assert.equal(statusText(n), '[ Wrote 1 line ]')
})

test('write out overwrite prompt: N cancels without writing', () => {
  const host = new FakeHost()
  host.files.set('/cwd/other.txt', 'old\n')
  const n = createNano(host, 'new.txt', 24, 80)
  type(n, 'hi')
  ctrl(n, 'o')
  ctrl(n, 'u')
  type(n, 'other.txt')
  key(n, 'Enter')
  key(n, 'n')
  assert.equal(host.files.get('/cwd/other.txt'), 'old\n')
  assert.equal(statusText(n), '')
})

test('write out overwrites the current file without asking', () => {
  const host = new FakeHost()
  host.files.set('/cwd/same.txt', 'one\n')
  const n = createNano(host, 'same.txt', 24, 80)
  key(n, 'End')
  type(n, '!')
  ctrl(n, 'o')
  key(n, 'Enter')
  assert.equal(host.files.get('/cwd/same.txt'), 'one!\n')
  assert.equal(statusText(n), '[ Wrote 1 line ]')
})

test('write out errors are reported', () => {
  const host = new FakeHost()
  host.failWrites.add('/cwd/bad.txt')
  const n = createNano(host, '', 24, 80)
  type(n, 'x')
  ctrl(n, 'o')
  type(n, 'bad.txt')
  key(n, 'Enter')
  assert.equal(statusText(n), '[ Error writing bad.txt: Permission denied ]')
})

test('write out prompt supports editing: backspace, arrows, Ctrl-U', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'o')
  type(n, 'abc')
  key(n, 'ArrowLeft')
  key(n, 'Backspace')
  assert.equal(statusText(n), 'File Name to Write: ac')
  key(n, 'Home')
  key(n, 'ArrowRight')
  key(n, 'ArrowRight')
  key(n, 'ArrowRight')
  ctrl(n, 'u')
  assert.equal(statusRaw(n), 'File Name to Write: ')
})

test('write out prompt cancels with Escape and reports Cancelled', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'o')
  key(n, 'Escape')
  assert.equal(statusText(n), '[ Cancelled ]')
})

test('write out prompt shows Y Yes and N No on the overwrite prompt', () => {
  const host = new FakeHost()
  host.files.set('/cwd/other.txt', 'old\n')
  const n = createNano(host, 'new.txt', 24, 80)
  type(n, 'x')
  ctrl(n, 'o')
  ctrl(n, 'u')
  type(n, 'other.txt')
  key(n, 'Enter')
  assert.ok(rowText(n, 22).includes('Y Yes'))
  assert.ok(rowText(n, 22).includes('N No'))
})

// ---- read file ------------------------------------------------------------------------------

test('read file inserts another file at the cursor', () => {
  const host = new FakeHost()
  host.files.set('/cwd/ins.txt', 'x\ny\n')
  const n = createNano(host, '', 24, 80)
  type(n, 'a')
  ctrl(n, 'r')
  assert.equal(statusRaw(n), 'File to insert [from ./]: ')
  type(n, 'ins.txt')
  key(n, 'Enter')
  assert.equal(plainRunText(n, 1), 'ax')
  assert.equal(plainRunText(n, 2), 'y')
  assert.equal(statusText(n), '[ Read 2 lines ]')
})

test('read file reports a missing file', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'r')
  type(n, 'nope.txt')
  key(n, 'Enter')
  assert.equal(statusText(n), '[ Error reading nope.txt: No such file or directory ]')
})

test('read file cancels on an empty answer', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'r')
  key(n, 'Enter')
  assert.equal(statusText(n), '[ Cancelled ]')
})

// ---- exit flow ------------------------------------------------------------------------------

test('exit on an unmodified buffer finishes immediately', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'x')
  assert.equal(n.done, true)
})

test('exit on a modified buffer prompts Save modified buffer', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'x')
  ctrl(n, 'x')
  assert.equal(n.done, false)
  assert.equal(statusText(n), 'Save modified buffer?')
  assert.ok(rowText(n, 22).includes('Y Yes'))
  assert.ok(rowText(n, 22).includes('N No'))
})

test('exit flow: N discards changes and exits', () => {
  const host = new FakeHost()
  const n = createNano(host, 'a.txt', 24, 80)
  type(n, 'x')
  ctrl(n, 'x')
  key(n, 'n')
  assert.equal(n.done, true)
  assert.equal(host.files.has('/cwd/a.txt'), false)
})

test('exit flow: Y saves through the filename prompt and exits', () => {
  const host = new FakeHost()
  const n = createNano(host, 'a.txt', 24, 80)
  type(n, 'x')
  ctrl(n, 'x')
  key(n, 'y')
  assert.equal(statusText(n), 'File Name to Write: a.txt')
  key(n, 'Enter')
  assert.equal(n.done, true)
  assert.equal(host.files.get('/cwd/a.txt'), 'x\n')
})

test('exit flow: Ctrl-C cancels back to editing', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'x')
  ctrl(n, 'x')
  ctrl(n, 'c')
  assert.equal(n.done, false)
  assert.equal(statusText(n), '[ Cancelled ]')
  assert.equal(plainRunText(n, 1), 'x')
})

// ---- help -----------------------------------------------------------------------------------

test('Ctrl-G opens help and Escape closes it', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'g')
  assert.ok(rowText(n, 0).includes('GNU nano 7.2  Help'))
  key(n, 'Escape')
  assert.ok(rowText(n, 0).startsWith('  GNU nano 7.2'))
})

test('help closes with Enter and with Ctrl-X without exiting', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'g')
  key(n, 'Enter')
  assert.equal(n.done, false)
  ctrl(n, 'g')
  ctrl(n, 'x')
  assert.equal(n.done, false)
  assert.ok(rowText(n, 0).startsWith('  GNU nano 7.2'))
})

test('F1 opens help and PageDown scrolls it', () => {
  const n = createNano(new FakeHost(), '', 10, 40)
  key(n, 'F1')
  assert.equal(rowText(n, 0), '  GNU nano 7.2  Help')
  key(n, 'PageDown')
  assert.notEqual(rowText(n, 0), '  GNU nano 7.2  Help')
  key(n, 'PageUp')
  assert.equal(rowText(n, 0), '  GNU nano 7.2  Help')
})

// ---- function keys and misc -----------------------------------------------------------------

test('F2 exits, F3 writes, F4 justifies, F5 reads, F6 searches', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  key(n, 'F3')
  assert.equal(statusRaw(n), 'File Name to Write: ')
  key(n, 'Escape')
  key(n, 'F5')
  assert.equal(statusRaw(n), 'File to insert [from ./]: ')
  key(n, 'Escape')
  key(n, 'F6')
  assert.equal(statusRaw(n), 'Search: ')
  key(n, 'Escape')
  type(n, 'aaa bbb ccc')
  key(n, 'F4')
  assert.equal(plainRunText(n, 1), 'aaa bbb ccc')
})

test('F7/F8 page up and down', () => {
  const n = createNano(new FakeHost(), '', 10, 20)
  n.paste('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n')
  key(n, 'F7')
  assert.equal(plainRunText(n, 1), '5')
  key(n, 'F8')
  assert.equal(plainRunText(n, 1), '6')
})

test('F9 cuts, F10 pastes and F11 shows the location', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  n.paste('a\nb\nc')
  key(n, 'F9')
  assert.equal(plainRunText(n, 1), 'a')
  assert.equal(plainRunText(n, 2), 'b')
  key(n, 'F10')
  assert.equal(plainRunText(n, 1), 'a')
  assert.equal(plainRunText(n, 2), 'c')
  assert.equal(plainRunText(n, 3), 'b')
  key(n, 'F11')
  assert.ok(statusText(n).includes('[ line '))
})

test('F12 is ignored and F2 exits when unmodified', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  key(n, 'F12')
  assert.equal(n.done, false)
  key(n, 'F2')
  assert.equal(n.done, true)
})

test('Ctrl-T reports that command execution is unavailable', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 't')
  assert.equal(statusText(n), '[ Command execution is not available here ]')
})

test('Ctrl-J justifies a paragraph to the text width', () => {
  const n = createNano(new FakeHost(), '', 10, 10)
  type(n, 'aaa bbb ccc')
  ctrl(n, 'j')
  assert.equal(plainRunText(n, 1), 'aaa bbb')
  assert.equal(plainRunText(n, 2), 'ccc')
})

test('Alt-D reports line, word and character counts', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  type(n, 'one two')
  alt(n, 'd')
  assert.equal(statusText(n), '[ 1 lines, 2 words, 7 chars ]')
})

test('paste in a prompt appends text and drops newlines', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'o')
  n.paste('ab\ncd')
  assert.equal(statusText(n), 'File Name to Write: abcd')
})

test('paste in the buffer inserts multiple lines', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  n.paste('ab\ncd')
  assert.equal(plainRunText(n, 1), 'ab')
  assert.equal(plainRunText(n, 2), 'cd')
  assert.deepEqual(n.render().cursor, { row: 2, col: 2 })
})

test('resize changes the number of rendered rows', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  n.resize(30, 100)
  assert.equal(n.render().lines.length, 30)
  assert.equal(titleText(n).length, 100)
})

test('empty write out prompt cancels on Enter', () => {
  const n = createNano(new FakeHost(), '', 24, 80)
  ctrl(n, 'o')
  key(n, 'Enter')
  assert.equal(statusText(n), '[ Cancelled ]')
})

test('a new file path that does not exist still shows New File', () => {
  const host = new FakeHost()
  host.files.set('/cwd/exists.txt', 'x\n')
  const n = createNano(host, 'missing.txt', 24, 80)
  assert.equal(statusText(n), '[ New File ]')
})
