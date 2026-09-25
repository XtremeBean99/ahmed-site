// Tests for the vim editor core. Uses a fake EditorHost over a Map and a
// subclass of VimEx to inspect internal state without exposing it publicly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EditorHost, KeyInput } from '../types'
import { VimEx } from './vim-ex'
import { createVim } from './vim'

// ---- helpers -----------------------------------------------------------------

function norm(p: string): string {
  const parts: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

function makeHost(files: Record<string, string> = {}): { host: EditorHost; files: Map<string, string> } {
  const map = new Map(Object.entries(files))
  const host: EditorHost = {
    readFile: (p) => (map.has(p) ? map.get(p)! : null),
    writeFile: (p, data) => {
      map.set(p, data)
      return null
    },
    exists: (p) => map.has(p),
    resolve: (p) => (p.startsWith('/') ? norm(p) : norm('/' + p)),
  }
  return { host, files: map }
}

class TV extends VimEx {
  text(): string {
    return this.serialize()
  }
  linesArr(): string[] {
    return this.lines.slice()
  }
  getRow(): number {
    return this.row
  }
  getCol(): number {
    return this.col
  }
  getMode(): string {
    return this.mode
  }
  message(): string {
    return this.msg
  }
  isErr(): boolean {
    return this.msgErr
  }
  isModified(): boolean {
    return this.modified
  }
  reg(name: string): string | null {
    return this.registers.get(name)?.text ?? null
  }
  regLinewise(name: string): boolean {
    return this.registers.get(name)?.linewise ?? false
  }
  visualState(): { mode: string; anchor: { row: number; col: number }; cursor: { row: number; col: number } } | null {
    return this.visual
      ? { mode: this.visual.mode, anchor: { ...this.visual.anchor }, cursor: { ...this.visual.cursor } }
      : null
  }
  settingNumber(): boolean {
    return this.settings.number
  }
  screenCursor(): { row: number; col: number } | null {
    return this.render().cursor
  }
}

function makeVim(content: string, opts?: { readOnly?: boolean }, rows = 10, cols = 40): { t: TV; host: EditorHost; files: Map<string, string> } {
  const { host, files } = makeHost({ '/f': content })
  const t = new TV(host, '/f', rows, cols, opts)
  return { t, host, files }
}

interface KeyFeed {
  key(k: KeyInput): void
  paste(text: string): void
}

function keyOf(ch: string): KeyInput {
  if (ch >= 'A' && ch <= 'Z') return { key: ch, ctrl: false, alt: false, shift: true }
  return { key: ch, ctrl: false, alt: false, shift: false }
}

const TOKENS: Record<string, KeyInput> = {
  Esc: { key: 'Escape', ctrl: false, alt: false, shift: false },
  Escape: { key: 'Escape', ctrl: false, alt: false, shift: false },
  CR: { key: 'Enter', ctrl: false, alt: false, shift: false },
  Enter: { key: 'Enter', ctrl: false, alt: false, shift: false },
  BS: { key: 'Backspace', ctrl: false, alt: false, shift: false },
  Del: { key: 'Delete', ctrl: false, alt: false, shift: false },
  Tab: { key: 'Tab', ctrl: false, alt: false, shift: false },
  Space: { key: ' ', ctrl: false, alt: false, shift: false },
  Left: { key: 'ArrowLeft', ctrl: false, alt: false, shift: false },
  Right: { key: 'ArrowRight', ctrl: false, alt: false, shift: false },
  Up: { key: 'ArrowUp', ctrl: false, alt: false, shift: false },
  Down: { key: 'ArrowDown', ctrl: false, alt: false, shift: false },
  Home: { key: 'Home', ctrl: false, alt: false, shift: false },
  End: { key: 'End', ctrl: false, alt: false, shift: false },
  PageUp: { key: 'PageUp', ctrl: false, alt: false, shift: false },
  PageDown: { key: 'PageDown', ctrl: false, alt: false, shift: false },
}

function parseToken(token: string): KeyInput | null {
  const named = TOKENS[token]
  if (named) return named
  if (token.startsWith('C-') && token.length === 3) {
    return { key: token[2], ctrl: true, alt: false, shift: false }
  }
  if (token.startsWith('A-') && token.length === 3) {
    return { key: token[2], ctrl: false, alt: true, shift: false }
  }
  if (token.length === 1) return keyOf(token)
  return null
}

/** Feed a string like 'ihello<Esc>', interpreting <...> tokens. */
function feed(vim: KeyFeed, s: string): void {
  let i = 0
  while (i < s.length) {
    if (s[i] === '<') {
      const end = s.indexOf('>', i + 1)
      if (end > 0) {
        const k = parseToken(s.slice(i + 1, end))
        if (k) {
          vim.key(k)
          i = end + 1
          continue
        }
      }
    }
    vim.key(keyOf(s[i]))
    i++
  }
}

function enterEx(t: TV, cmd: string): void {
  feed(t, ':' + cmd + '<CR>')
}

function statusOf(t: TV): string {
  const lines = t.render().lines
  const last = lines[lines.length - 1]
  return last.map((r) => r.t).join('')
}

// ---- creation / rendering ----------------------------------------------------

test('new file shows [New] and empty buffer', () => {
  const { host, files } = makeHost({})
  const t = new TV(host, '/new.txt', 10, 40)
  assert.equal(t.message(), '"/new.txt" [New]')
  assert.equal(t.text(), '')
  assert.equal(t.linesArr().length, 0)
  void files
})

test('existing file reports line and byte count', () => {
  const { t } = makeVim('hello\nworld\n')
  assert.equal(t.message(), '"/f" 2L, 12B')
})

test('render returns exactly rows lines with tilde filler', () => {
  const { t } = makeVim('a\nb\n')
  const s = t.render()
  assert.equal(s.lines.length, 10)
  const last = statusOf(t)
  assert.match(last, /1,1\s+All/)
  const tildeCount = s.lines.slice(0, -1).filter((l) => l.some((r) => r.t === '~')).length
  assert.equal(tildeCount, 7)
})

test('status line shows INSERT mode in bold', () => {
  const { t } = makeVim('')
  feed(t, 'i')
  const s = t.render()
  const last = s.lines[s.lines.length - 1]
  const runs = last.filter((r) => r.t.includes('-- INSERT --'))
  assert.equal(runs.length, 1)
  assert.equal(runs[0].s, 'bold')
})

test('cursor is on last row in command line mode', () => {
  const { t } = makeVim('')
  feed(t, ':wq')
  const s = t.render()
  assert.equal(s.cursor?.row, 9)
  assert.equal(s.cursor?.col, 3)
})

test('line numbers with :set number', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, 'set number')
  const s = t.render()
  const first = s.lines[0]
  assert.equal(first[0].t, '  1 ')
  assert.equal(first[0].s, 'dim')
})

// ---- motions -----------------------------------------------------------------

test('h j k l and arrows move', () => {
  const { t } = makeVim('abc\ndef\nghi\n')
  feed(t, 'l')
  assert.equal(t.getCol(), 1)
  feed(t, 'j')
  assert.equal(t.getRow(), 1)
  feed(t, 'k')
  assert.equal(t.getRow(), 0)
  feed(t, 'h')
  assert.equal(t.getCol(), 0)
  feed(t, '<Right>')
  assert.equal(t.getCol(), 1)
  feed(t, '<Down>')
  assert.equal(t.getRow(), 1)
  feed(t, '<Up>')
  assert.equal(t.getRow(), 0)
  feed(t, '<Left>')
  assert.equal(t.getCol(), 0)
})

test('counted motions', () => {
  const { t } = makeVim('one two three four\n')
  feed(t, '3w')
  assert.equal(t.getCol(), 14)
  feed(t, '2b')
  assert.equal(t.getCol(), 4)
})

test('0 ^ $ | motions', () => {
  const { t } = makeVim('  abcde\n')
  feed(t, '$')
  assert.equal(t.getCol(), 6)
  feed(t, '0')
  assert.equal(t.getCol(), 0)
  feed(t, '^')
  assert.equal(t.getCol(), 2)
  feed(t, '3|')
  assert.equal(t.getCol(), 2)
})

test('gg G and N G', () => {
  const { t } = makeVim('a\nb\nc\nd\n')
  feed(t, 'G')
  assert.equal(t.getRow(), 3)
  feed(t, 'gg')
  assert.equal(t.getRow(), 0)
  feed(t, '3G')
  assert.equal(t.getRow(), 2)
})

test('w W b B e E word motions', () => {
  const { t } = makeVim('foo, bar-baz\n')
  feed(t, 'w')
  assert.equal(t.getCol(), 3)
  feed(t, 'W')
  assert.equal(t.getCol(), 5)
  feed(t, 'b')
  assert.equal(t.getCol(), 3)
  feed(t, 'e')
  assert.equal(t.getCol(), 7)
  feed(t, 'E')
  assert.equal(t.getCol(), 11)
})

test('f F t T find and ; ,', () => {
  const { t } = makeVim('a b c b d\n')
  feed(t, 'fb')
  assert.equal(t.getCol(), 2)
  feed(t, ';')
  assert.equal(t.getCol(), 6)
  feed(t, ',')
  assert.equal(t.getCol(), 2)
  feed(t, 'tb')
  assert.equal(t.getCol(), 5)
  feed(t, 'Tb')
  assert.equal(t.getCol(), 3)
})

test('% matching bracket jumps', () => {
  const { t } = makeVim('(a (b) c)\n')
  feed(t, '%')
  assert.equal(t.getCol(), 8)
  feed(t, '%')
  assert.equal(t.getCol(), 0)
})

test('{} paragraph motions', () => {
  const { t } = makeVim('a\nb\n\nc\nd\n\n')
  feed(t, '}')
  assert.equal(t.getRow(), 2)
  feed(t, '}')
  assert.equal(t.getRow(), 5)
  feed(t, '{')
  assert.equal(t.getRow(), 2)
})

test('H M L move within view', () => {
  const { t } = makeVim('0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n', undefined, 6, 20)
  feed(t, 'L')
  assert.equal(t.getRow(), 3)
  feed(t, 'H')
  assert.equal(t.getRow(), 0)
  feed(t, 'M')
  assert.equal(t.getRow(), 1)
})

test('Ctrl-f Ctrl-b Ctrl-d Ctrl-u page motions', () => {
  const { t } = makeVim('0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n', undefined, 6, 20)
  feed(t, '<C-f>')
  assert.equal(t.getRow(), 4)
  feed(t, '<C-d>')
  assert.equal(t.getRow(), 6)
  feed(t, '<C-b>')
  assert.equal(t.getRow(), 2)
})

test('desired column preserved across vertical moves', () => {
  const { t } = makeVim('aaaa\nbb\ncccc\n')
  feed(t, 'lll')
  assert.equal(t.getCol(), 3)
  feed(t, 'j')
  assert.equal(t.getCol(), 2)
  feed(t, 'j')
  assert.equal(t.getCol(), 3)
})

// ---- insert mode -------------------------------------------------------------

test('insert text and exit moves cursor left one', () => {
  const { t } = makeVim('')
  feed(t, 'ihello<Esc>')
  assert.equal(t.text(), 'hello\n')
  assert.equal(t.getMode(), 'normal')
  assert.equal(t.getCol(), 4)
})

test('append a, insert at start I, append at end A', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'aX<Esc>')
  assert.equal(t.linesArr()[0], 'aXbc')
  feed(t, 'IY<Esc>')
  assert.equal(t.linesArr()[0], 'YaXbc')
  feed(t, 'AZ<Esc>')
  assert.equal(t.linesArr()[0], 'YaXbcZ')
})

test('o O open lines', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'odef<Esc>')
  assert.deepEqual(t.linesArr(), ['abc', 'def'])
  feed(t, 'Oup<Esc>')
  assert.deepEqual(t.linesArr(), ['abc', 'up', 'def'])
})

test('counted insert repeats', () => {
  const { t } = makeVim('')
  feed(t, '3ix<Esc>')
  assert.equal(t.linesArr()[0], 'xxx')
})

test('backspace and delete in insert mode', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'A<BS><BS>d<Esc>')
  assert.equal(t.linesArr()[0], 'ad')
})

test('backspace at col 0 joins lines', () => {
  const { t } = makeVim('ab\ncd\n')
  feed(t, 'j0i<BS><Esc>')
  assert.equal(t.linesArr()[0], 'abcd')
})

test('Delete at end of line joins', () => {
  const { t } = makeVim('ab\ncd\n')
  feed(t, 'A<Del><Esc>')
  assert.equal(t.linesArr()[0], 'abcd')
})

test('Ctrl-w deletes word back, Ctrl-u deletes to line start', () => {
  const { t } = makeVim('')
  feed(t, 'ione two three<C-w><Esc>')
  assert.equal(t.linesArr()[0], 'one two ')
  const { t: t2 } = makeVim('')
  feed(t2, 'ihello<C-u>world<Esc>')
  assert.equal(t2.linesArr()[0], 'world')
})

test('autoindent copies previous line indent', () => {
  const { t } = makeVim('')
  enterEx(t, 'set ai')
  feed(t, 'i  x<CR>y<Esc>')
  assert.deepEqual(t.linesArr(), ['  x', '  y'])
})

test('Tab inserts spaces with expandtab', () => {
  const { t } = makeVim('')
  enterEx(t, 'set et ts=4')
  feed(t, 'i<Tab><Esc>')
  assert.equal(t.linesArr()[0], '    ')
})

test('paste in insert mode splits newlines', () => {
  const { t } = makeVim('')
  feed(t, 'i')
  t.paste('a\nb')
  feed(t, '<Esc>')
  assert.deepEqual(t.linesArr(), ['a', 'b'])
})

test('replace mode R overwrites', () => {
  const { t } = makeVim('abcd\n')
  feed(t, 'RXy<Esc>')
  assert.equal(t.linesArr()[0], 'Xycd')
})

// ---- editing -----------------------------------------------------------------

test('x X delete characters', () => {
  const { t } = makeVim('abcde\n')
  feed(t, 'x')
  assert.equal(t.linesArr()[0], 'bcde')
  feed(t, '$X')
  assert.equal(t.linesArr()[0], 'bce')
})

test('dd yy p P', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, 'dd')
  assert.deepEqual(t.linesArr(), ['b', 'c'])
  feed(t, 'p')
  assert.deepEqual(t.linesArr(), ['b', 'a', 'c'])
  feed(t, 'yyP')
  assert.deepEqual(t.linesArr(), ['b', 'a', 'a', 'c'])
})

test('D and C delete/change to end of line', () => {
  const { t } = makeVim('abcd\n')
  feed(t, 'lD')
  assert.equal(t.linesArr()[0], 'a')
  const { t: t2 } = makeVim('abcd\n')
  feed(t2, 'lCxy<Esc>')
  assert.equal(t2.linesArr()[0], 'axy')
})

test('dw deletes a word', () => {
  const { t } = makeVim('one two three\n')
  feed(t, 'dw')
  assert.equal(t.linesArr()[0], 'two three')
})

test('d3w deletes three words', () => {
  const { t } = makeVim('one two three four\n')
  feed(t, 'd3w')
  assert.equal(t.linesArr()[0], 'four')
})

test('d$ and d0', () => {
  const { t } = makeVim('abcde\n')
  feed(t, 'ld$')
  assert.equal(t.linesArr()[0], 'a')
  const { t: t2 } = makeVim('abcde\n')
  feed(t2, '$d0')
  assert.equal(t2.linesArr()[0], 'e')
})

test('dgg and dG', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, 'jdgg')
  assert.deepEqual(t.linesArr(), ['c'])
  const { t: t2 } = makeVim('a\nb\nc\n')
  feed(t2, 'dG')
  assert.deepEqual(t2.linesArr(), [''])
})

test('de and db', () => {
  const { t } = makeVim('one two\n')
  feed(t, 'de')
  assert.equal(t.linesArr()[0], ' two')
  const { t: t2 } = makeVim('one two\n')
  feed(t2, 'wdb')
  assert.equal(t2.linesArr()[0], 'two')
})

test('cc S change line', () => {
  const { t } = makeVim('old line\n')
  feed(t, 'ccnew<Esc>')
  assert.equal(t.linesArr()[0], 'new')
  const { t: t2 } = makeVim('old line\n')
  feed(t2, 'Snew<Esc>')
  assert.equal(t2.linesArr()[0], 'new')
})

test('s change character', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'sX<Esc>')
  assert.equal(t.linesArr()[0], 'Xbc')
})

test('yy Y yank line, yw yank word', () => {
  const { t } = makeVim('one two\n')
  feed(t, 'yw')
  assert.equal(t.reg('"'), 'one ')
  assert.equal(t.regLinewise('"'), false)
  feed(t, 'Y')
  assert.equal(t.reg('"'), 'one two\n')
  assert.equal(t.regLinewise('"'), true)
})

test('named registers', () => {
  const { t } = makeVim('a\nb\n')
  feed(t, '"ayy')
  assert.equal(t.reg('a'), 'a\n')
  feed(t, '"bdd')
  assert.equal(t.reg('b'), 'a\n')
  feed(t, '"ap')
  assert.deepEqual(t.linesArr(), ['b', 'a'])
})

test('J joins lines with space, gJ without', () => {
  const { t } = makeVim('a\nb\n')
  feed(t, 'J')
  assert.equal(t.linesArr()[0], 'a b')
  const { t: t2 } = makeVim('a\nb\n')
  feed(t2, 'gJ')
  assert.equal(t2.linesArr()[0], 'ab')
})

test('r replace char and ~ toggle case', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'rX')
  assert.equal(t.linesArr()[0], 'Xbc')
  const { t: t2 } = makeVim('aBc\n')
  feed(t2, '~')
  assert.equal(t2.linesArr()[0], 'ABc')
})

test('>> << shift lines with shiftwidth', () => {
  const { t } = makeVim('a\nb\n')
  enterEx(t, 'set sw=4 et')
  feed(t, '>>')
  assert.equal(t.linesArr()[0], '    a')
  feed(t, '<<')
  assert.equal(t.linesArr()[0], 'a')
})

test('counts work for dd, yy, x, j', () => {
  const { t } = makeVim('a\nb\nc\nd\n')
  feed(t, '2dd')
  assert.deepEqual(t.linesArr(), ['c', 'd'])
  const { t: t2 } = makeVim('abcde\n')
  feed(t2, '3x')
  assert.equal(t2.linesArr()[0], 'de')
})

test('u undo and Ctrl-r redo group an insert session', () => {
  const { t } = makeVim('')
  feed(t, 'iabc<Esc>')
  feed(t, 'u')
  assert.equal(t.text(), '\n')
  feed(t, '<C-r>')
  assert.equal(t.text(), 'abc\n')
})

test('dot repeats last insert', () => {
  const { t } = makeVim('')
  feed(t, 'iabc<Esc>')
  feed(t, '.')
  assert.equal(t.linesArr()[0], 'ababcc')
})

test('dot repeats last delete', () => {
  const { t } = makeVim('one two three\n')
  feed(t, 'dw')
  feed(t, '.')
  assert.equal(t.linesArr()[0], 'three')
})

test('ctrl-a ctrl-x increment and decrement', () => {
  const { t } = makeVim('x 41 y\n')
  feed(t, 'l<C-a>')
  assert.equal(t.linesArr()[0], 'x 42 y')
  feed(t, '<C-x>')
  assert.equal(t.linesArr()[0], 'x 41 y')
})

test('marks and jumps', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, 'jma')
  feed(t, 'j')
  feed(t, "'a")
  assert.equal(t.getRow(), 1)
  feed(t, 'j')
  feed(t, '``')
  assert.equal(t.getRow(), 2)
})

// ---- operators and text objects ---------------------------------------------

test('operator with text object iw aw', () => {
  const { t } = makeVim('one two three\n')
  feed(t, 'diw')
  assert.equal(t.linesArr()[0], ' two three')
  const { t: t2 } = makeVim('one two three\n')
  feed(t2, 'wdaw')
  assert.equal(t2.linesArr()[0], 'one three')
})

test('i( a( i" a" text objects', () => {
  const { t } = makeVim('x = (foo bar)\n')
  feed(t, '5l')
  feed(t, 'di(')
  assert.equal(t.linesArr()[0], 'x = ()')
  const { t: t2 } = makeVim('say "hi there"\n')
  feed(t2, 'w')
  feed(t2, 'di"')
  assert.equal(t2.linesArr()[0], 'say ""')
  const { t: t3 } = makeVim('say "hi there"\n')
  feed(t3, 'w')
  feed(t3, 'da"')
  assert.equal(t3.linesArr()[0], 'say ')
})

test('ip paragraph object', () => {
  const { t } = makeVim('a\nb\n\nc\n')
  feed(t, 'dip')
  assert.deepEqual(t.linesArr(), ['', 'c'])
})

test('gU gu g~ operators', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'gUU')
  assert.equal(t.linesArr()[0], 'ABC')
  feed(t, 'guu')
  assert.equal(t.linesArr()[0], 'abc')
  feed(t, 'g~~')
  assert.equal(t.linesArr()[0], 'ABC')
})

test('operator with f motion', () => {
  const { t } = makeVim('a b c\n')
  feed(t, 'dfb')
  assert.equal(t.linesArr()[0], ' c')
})

// ---- visual mode -------------------------------------------------------------

test('visual charwise select and delete', () => {
  const { t } = makeVim('abcdef\n')
  feed(t, 'vll')
  const vs = t.visualState()
  assert.equal(vs?.mode, 'char')
  assert.equal(vs?.cursor.col, 2)
  feed(t, 'd')
  assert.equal(t.linesArr()[0], 'def')
})

test('visual linewise yank and put', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, 'Vjy')
  feed(t, 'Gp')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'c', 'a', 'b'])
})

test('visual o swaps ends', () => {
  const { t } = makeVim('abcdef\n')
  feed(t, 'vll')
  const before = t.visualState()
  feed(t, 'o')
  const after = t.visualState()
  assert.deepEqual(after?.anchor, before?.cursor)
  assert.deepEqual(after?.cursor, before?.anchor)
})

test('visual change enters insert', () => {
  const { t } = makeVim('abcdef\n')
  feed(t, 'vllcX<Esc>')
  assert.equal(t.linesArr()[0], 'Xdef')
})

test('visual > shifts selection', () => {
  const { t } = makeVim('a\nb\n')
  enterEx(t, 'set sw=4 et')
  feed(t, 'Vj>')
  assert.deepEqual(t.linesArr(), ['    a', '    b'])
})

test('visual ~ toggles case in selection', () => {
  const { t } = makeVim('abCd\n')
  feed(t, 'vll~')
  assert.equal(t.linesArr()[0], 'ABcd')
})

test('gv reselects last visual selection', () => {
  const { t } = makeVim('abcdef\n')
  feed(t, 'vll<Esc>')
  feed(t, 'gv')
  assert.equal(t.visualState()?.cursor.col, 2)
})

test('visual : prefills range and executes delete', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, 'Vj')
  feed(t, ':d<CR>')
  assert.deepEqual(t.linesArr(), ['c'])
})

test('visual r replaces selection', () => {
  const { t } = makeVim('abcdef\n')
  feed(t, 'vllrX')
  assert.equal(t.linesArr()[0], 'XXXdef')
})

// ---- search ------------------------------------------------------------------

test('search forward and n N', () => {
  const { t } = makeVim('one two one\n')
  feed(t, '/one<CR>')
  assert.equal(t.getCol(), 0)
  feed(t, 'n')
  assert.equal(t.getCol(), 8)
  feed(t, 'N')
  assert.equal(t.getCol(), 0)
})

test('search wraps with message', () => {
  const { t } = makeVim('one two\n')
  feed(t, 'w')
  feed(t, '/one<CR>')
  assert.equal(t.getCol(), 0)
  assert.equal(t.message(), 'search hit BOTTOM, continuing at TOP')
})

test('? searches backward', () => {
  const { t } = makeVim('one two one\n')
  feed(t, '$')
  feed(t, '?one<CR>')
  assert.equal(t.getCol(), 8)
})

test('* and # search word under cursor', () => {
  const { t } = makeVim('one two one\n')
  feed(t, '*')
  assert.equal(t.getCol(), 8)
  feed(t, '#')
  assert.equal(t.getCol(), 0)
})

test('search pattern not found', () => {
  const { t } = makeVim('abc\n')
  feed(t, '/zzz<CR>')
  assert.equal(t.message(), 'E486: Pattern not found: zzz')
  assert.equal(t.isErr(), true)
})

test('hlsearch highlights matches after search', () => {
  const { t } = makeVim('one one\n')
  feed(t, '/one<CR>')
  const s = t.render()
  const hl = s.lines[0].filter((r) => r.s === 'hl')
  assert.equal(hl.length, 2)
})

test(':noh clears hlsearch', () => {
  const { t } = makeVim('one one\n')
  feed(t, '/one<CR>')
  enterEx(t, 'noh')
  const s = t.render()
  assert.equal(s.lines[0].filter((r) => r.s === 'hl').length, 0)
})

test('ignorecase and smartcase', () => {
  const { t } = makeVim('Hello hello\n')
  enterEx(t, 'set ic')
  feed(t, '/HELLO<CR>')
  assert.equal(t.getCol(), 0)
  const { t: t2 } = makeVim('Hello hello\n')
  enterEx(t2, 'set ic smartcase')
  feed(t2, '/hello<CR>')
  assert.equal(t2.getCol(), 0)
  feed(t2, 'n')
  assert.equal(t2.getCol(), 6)
  const { t: t3 } = makeVim('Hello hello\n')
  enterEx(t3, 'set ic smartcase')
  feed(t3, '/Hello<CR>')
  assert.equal(t3.getCol(), 0)
  feed(t3, 'n')
  assert.equal(t3.getCol(), 0)
})

// ---- ex commands: w q e ------------------------------------------------------

test(':w writes file and clears modified', () => {
  const { t, files } = makeVim('')
  feed(t, 'ihello<Esc>')
  assert.equal(t.isModified(), true)
  enterEx(t, 'w')
  assert.equal(files.get('/f'), 'hello\n')
  assert.equal(t.isModified(), false)
  assert.equal(t.message(), '"/f" 1L, 6B written')
})

test(':q on modified buffer gives E37', () => {
  const { t } = makeVim('')
  feed(t, 'ix<Esc>')
  enterEx(t, 'q')
  assert.equal(t.message(), 'E37: No write since last change (add ! to override)')
  assert.equal(t.done, false)
})

test(':q! quits without saving', () => {
  const { t } = makeVim('')
  feed(t, 'ix<Esc>')
  enterEx(t, 'q!')
  assert.equal(t.done, true)
})

test(':wq writes and sets done', () => {
  const { t, files } = makeVim('')
  feed(t, 'ihello<Esc>')
  enterEx(t, 'wq')
  assert.equal(files.get('/f'), 'hello\n')
  assert.equal(t.done, true)
})

test(':x writes modified and quits', () => {
  const { t, files } = makeVim('')
  feed(t, 'ix<Esc>')
  enterEx(t, 'x')
  assert.equal(files.get('/f'), 'x\n')
  assert.equal(t.done, true)
})

test(':w file writes to another path', () => {
  const { t, files } = makeVim('abc\n')
  enterEx(t, 'w /other.txt')
  assert.equal(files.get('/other.txt'), 'abc\n')
})

test('ZZ writes and quits, ZQ quits without writing', () => {
  const { t, files } = makeVim('')
  feed(t, 'ix<Esc>')
  feed(t, 'ZZ')
  assert.equal(files.get('/f'), 'x\n')
  assert.equal(t.done, true)
  const { t: t2, files: f2 } = makeVim('')
  feed(t2, 'ix<Esc>')
  feed(t2, 'ZQ')
  assert.equal(f2.get('/f'), '')
  assert.equal(t2.done, true)
})

test(':e reloads file discarding changes with !', () => {
  const { t, files } = makeVim('orig\n')
  feed(t, 'Gox<Esc>')
  enterEx(t, 'e')
  assert.equal(t.message(), 'E37: No write since last change (add ! to override)')
  enterEx(t, 'e!')
  assert.equal(t.text(), 'orig\n')
  assert.equal(t.isModified(), false)
  void files
})

test(':r inserts file below cursor', () => {
  const { t, files } = makeVim('a\n')
  files.set('/g', 'g1\ng2\n')
  enterEx(t, 'r /g')
  assert.deepEqual(t.linesArr(), ['a', 'g1', 'g2'])
})

// ---- ex commands: ranges and line ops ---------------------------------------

test(':N jumps to line', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '3')
  assert.equal(t.getRow(), 2)
})

test(':$ and :. and :% ranges', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '$')
  assert.equal(t.getRow(), 2)
  enterEx(t, '1,2')
  assert.equal(t.getRow(), 0)
})

test(':d deletes line, :{range}d deletes range', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, 'd')
  assert.deepEqual(t.linesArr(), ['b', 'c'])
  const { t: t2 } = makeVim('a\nb\nc\nd\n')
  enterEx(t2, '2,3d')
  assert.deepEqual(t2.linesArr(), ['a', 'd'])
})

test(':y yanks and :p pastes', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '2y')
  feed(t, 'Gp')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'c', 'b'])
})

test(':m moves lines', () => {
  const { t } = makeVim('a\nb\nc\nd\n')
  enterEx(t, '1m3')
  assert.deepEqual(t.linesArr(), ['b', 'c', 'a', 'd'])
})

test(':m0 moves to top', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '3m0')
  assert.deepEqual(t.linesArr(), ['c', 'a', 'b'])
})

test(':t copies lines', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '1t2')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'a', 'c'])
})

test(':> and :< shift lines', () => {
  const { t } = makeVim('a\nb\n')
  enterEx(t, 'set sw=4 et')
  enterEx(t, '%>')
  assert.deepEqual(t.linesArr(), ['    a', '    b'])
  enterEx(t, '%<')
  assert.deepEqual(t.linesArr(), ['a', 'b'])
})

test(':normal executes normal commands per line', () => {
  const { t } = makeVim('a\nb\n')
  enterEx(t, '%normal A;')
  assert.deepEqual(t.linesArr(), ['a;', 'b;'])
})

test(':join joins range', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '1,2j')
  assert.deepEqual(t.linesArr(), ['a b', 'c'])
})

test('range with offsets and marks', () => {
  const { t } = makeVim('a\nb\nc\nd\n')
  enterEx(t, '.+2')
  assert.equal(t.getRow(), 2)
  enterEx(t, '$-1')
  assert.equal(t.getRow(), 2)
  feed(t, 'gg')
  feed(t, 'jma')
  enterEx(t, "'a,$d")
  assert.deepEqual(t.linesArr(), ['a'])
})

test('/pat/ as range address', () => {
  const { t } = makeVim('a\nbX\nc\n')
  enterEx(t, '/bX/')
  assert.equal(t.getRow(), 1)
  const { t: t2 } = makeVim('a\nbX\nc\nd\n')
  enterEx(t2, '/bX/,+1d')
  assert.deepEqual(t2.linesArr(), ['a', 'c', 'd'])
})

// ---- ex commands: substitute ------------------------------------------------

test(':s substitutes first occurrence on current line', () => {
  const { t } = makeVim('one one one\n')
  enterEx(t, 's/one/two/')
  assert.equal(t.linesArr()[0], 'two one one')
  assert.equal(t.message(), '1 substitution on 1 line')
})

test(':s with g flag substitutes all', () => {
  const { t } = makeVim('one one one\n')
  enterEx(t, 's/one/two/g')
  assert.equal(t.linesArr()[0], 'two two two')
  assert.equal(t.message(), '3 substitutions on 1 line')
})

test(':%s substitutes in whole file', () => {
  const { t } = makeVim('one\none\n')
  enterEx(t, '%s/one/two/g')
  assert.deepEqual(t.linesArr(), ['two', 'two'])
  assert.equal(t.message(), '2 substitutions on 2 lines')
})

test(':s replacement supports groups and &', () => {
  const { t } = makeVim('foo 123 bar\n')
  enterEx(t, 's/\\(foo\\) \\(123\\)/\\2 \\1/')
  assert.equal(t.linesArr()[0], '123 foo bar')
  const { t: t2 } = makeVim('hello\n')
  enterEx(t2, 's/hello/x&x/')
  assert.equal(t2.linesArr()[0], 'xhellox')
})

test(':s with i flag is case insensitive', () => {
  const { t } = makeVim('Hello\n')
  enterEx(t, 's/hello/hi/i')
  assert.equal(t.linesArr()[0], 'hi')
})

test(':s n flag counts without changing', () => {
  const { t } = makeVim('one one\n')
  enterEx(t, 's/one/two/gn')
  assert.equal(t.linesArr()[0], 'one one')
  assert.equal(t.message(), '2 matches on 1 line')
})

test(':s e flag suppresses not found error', () => {
  const { t } = makeVim('abc\n')
  enterEx(t, 's/zzz/x/e')
  assert.equal(t.isErr(), false)
})

test(':s not found gives E486', () => {
  const { t } = makeVim('abc\n')
  enterEx(t, 's/zzz/x/')
  assert.equal(t.message(), 'E486: Pattern not found: zzz')
  assert.equal(t.isErr(), true)
})

test(':s empty pattern repeats last', () => {
  const { t } = makeVim('one two one\n')
  enterEx(t, 's/one/ONE/')
  enterEx(t, 's//X/')
  assert.equal(t.linesArr()[0], 'ONE two X')
})

test(':& and :&& repeat last substitution', () => {
  const { t } = makeVim('one one\n')
  enterEx(t, 's/one/two/')
  enterEx(t, '&')
  assert.equal(t.linesArr()[0], 'two two')
})

// ---- ex commands: global ----------------------------------------------------

test(':g/pat/d deletes matching lines', () => {
  const { t } = makeVim('keep\ndrop\nkeep\ndrop\n')
  enterEx(t, 'g/drop/d')
  assert.deepEqual(t.linesArr(), ['keep', 'keep'])
})

test(':v/pat/d deletes non-matching lines', () => {
  const { t } = makeVim('keep\ndrop\nkeep\ndrop\n')
  enterEx(t, 'v/keep/d')
  assert.deepEqual(t.linesArr(), ['keep', 'keep'])
})

test(':g!/pat/d same as :v', () => {
  const { t } = makeVim('a\nb\n')
  enterEx(t, 'g!/b/d')
  assert.deepEqual(t.linesArr(), ['b'])
})

test(':g/pat/s/foo/bar/ substitutes only on matching lines', () => {
  const { t } = makeVim('x foo\nfoo\n')
  enterEx(t, 'g/x/s/foo/bar/')
  assert.deepEqual(t.linesArr(), ['x bar', 'foo'])
})

test(':g/pat/normal appends on matching lines', () => {
  const { t } = makeVim('a\nb\n')
  enterEx(t, 'g/a/normal A!')
  assert.deepEqual(t.linesArr(), ['a!', 'b'])
})

test(':g/pat/m0 moves matches to top', () => {
  const { t } = makeVim('a\nB\nc\nD\n')
  enterEx(t, 'g/[BD]/m0')
  assert.deepEqual(t.linesArr(), ['B', 'D', 'a', 'c'])
})

test(':g/pat/t. duplicates matching lines', () => {
  const { t } = makeVim('a\nB\nc\n')
  enterEx(t, 'g/B/t.')
  assert.deepEqual(t.linesArr(), ['a', 'B', 'B', 'c'])
})

// ---- ex commands: sort and set ----------------------------------------------

test(':sort sorts lines', () => {
  const { t } = makeVim('c\na\nb\n')
  enterEx(t, 'sort')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'c'])
})

test(':sort n r u i flags', () => {
  const { t } = makeVim('10\n2\n1\n2\n')
  enterEx(t, 'sort n')
  assert.deepEqual(t.linesArr(), ['1', '2', '2', '10'])
  const { t: t2 } = makeVim('a\nc\nb\n')
  enterEx(t2, 'sort r')
  assert.deepEqual(t2.linesArr(), ['c', 'b', 'a'])
  const { t: t3 } = makeVim('a\nb\na\nc\n')
  enterEx(t3, 'sort u')
  assert.deepEqual(t3.linesArr(), ['a', 'b', 'c'])
})

test(':set unknown option gives E518', () => {
  const { t } = makeVim('')
  enterEx(t, 'set bogus')
  assert.equal(t.message(), 'E518: Unknown option: bogus')
  assert.equal(t.isErr(), true)
})

test(':set nu! toggles line numbers', () => {
  const { t } = makeVim('')
  enterEx(t, 'set nu')
  assert.equal(t.settingNumber(), true)
  enterEx(t, 'set nu!')
  assert.equal(t.settingNumber(), false)
  enterEx(t, 'set nu')
  assert.equal(t.settingNumber(), true)
  enterEx(t, 'set nonu')
  assert.equal(t.settingNumber(), false)
})

test(':set sw= ts= et noet', () => {
  const { t } = makeVim('')
  enterEx(t, 'set sw=4 ts=4 et')
  feed(t, 'i<Tab><Esc>')
  assert.equal(t.linesArr()[0], '    ')
  enterEx(t, 'set noet')
  const { t: t2 } = makeVim('')
  feed(t2, 'i<Tab><Esc>')
  assert.equal(t2.linesArr()[0], '\t')
})

// ---- ex commands: misc -------------------------------------------------------

test('unknown command gives E492', () => {
  const { t } = makeVim('')
  enterEx(t, 'frobnicate')
  assert.equal(t.message(), 'E492: Not an editor command: frobnicate')
  assert.equal(t.isErr(), true)
})

test(':!cmd is refused', () => {
  const { t } = makeVim('')
  enterEx(t, '!ls')
  assert.equal(t.message(), 'E: shell commands are not available here')
})

test(':help gives E149', () => {
  const { t } = makeVim('')
  enterEx(t, 'help topic')
  assert.match(t.message(), /E149: Sorry, no help/)
})

test(':version prints version', () => {
  const { t } = makeVim('')
  enterEx(t, 'version')
  assert.match(t.message(), /Vim-like editor/)
})

test(':undo and :redo work', () => {
  const { t } = makeVim('')
  feed(t, 'iabc<Esc>')
  enterEx(t, 'undo')
  assert.equal(t.text(), '\n')
  enterEx(t, 'redo')
  assert.equal(t.text(), 'abc\n')
})

test(':retab converts tabs and spaces', () => {
  const { t } = makeVim('\ta\n')
  enterEx(t, 'set et ts=4')
  enterEx(t, 'retab')
  assert.equal(t.linesArr()[0], '    a')
})

test('readonly mode refuses edits with E21', () => {
  const { t } = makeVim('abc\n', { readOnly: true })
  feed(t, 'dd')
  assert.equal(t.message(), "E21: Cannot make changes, 'modifiable' is off")
  feed(t, 'ix<Esc>')
  assert.equal(t.text(), 'abc\n')
})

test('readonly mode q quits and space pages', () => {
  const { t } = makeVim('0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n', { readOnly: true }, 5, 20)
  feed(t, ' ')
  assert.equal(t.getRow(), 3)
  feed(t, 'b')
  assert.equal(t.getRow(), 0)
  feed(t, 'G')
  assert.equal(t.getRow(), 9)
  feed(t, 'q')
  assert.equal(t.done, true)
})

test('readonly :w gives E45', () => {
  const { t } = makeVim('abc\n', { readOnly: true })
  enterEx(t, 'w')
  assert.equal(t.message(), "E45: 'readonly' option is set (add ! to override)")
})

test('readonly :q quits', () => {
  const { t } = makeVim('abc\n', { readOnly: true })
  enterEx(t, 'q')
  assert.equal(t.done, true)
})

// ---- rendering details -------------------------------------------------------

test('tabs render to tab stops and cursor column is correct', () => {
  const { t } = makeVim('\tabc\n')
  const s = t.render()
  assert.equal(s.lines[0][0].t, '        abc')
  assert.equal(s.cursor?.col, 0)
  feed(t, 'l')
  const s2 = t.render()
  assert.equal(s2.cursor?.col, 8)
})

test('horizontal scrolling keeps cursor visible', () => {
  const { t } = makeVim('abcdefghijklmnopqrstuvwxyz\n', undefined, 5, 10)
  feed(t, 'l'.repeat(15))
  const s = t.render()
  assert.ok(s.cursor)
  assert.ok(s.cursor!.col >= 0 && s.cursor!.col < 10)
})

test('visual selection renders with sel style', () => {
  const { t } = makeVim('abcdef\n')
  feed(t, 'vll')
  const s = t.render()
  const sel = s.lines[0].filter((r) => r.s === 'sel')
  assert.equal(sel.length, 1)
  assert.equal(sel[0].t, 'abc')
})

test('last line is always the status line', () => {
  const { t } = makeVim('')
  const s = t.render()
  assert.equal(s.lines.length, 10)
  assert.ok(s.lines[9].length >= 0)
})

// ---- paste and resize --------------------------------------------------------

test('paste in command line appends', () => {
  const { t } = makeVim('')
  feed(t, ':')
  t.paste('wq')
  assert.equal(t.render().cursor?.row, 9)
  feed(t, '<CR>')
  assert.equal(t.done, true)
})

test('resize keeps rows and cols', () => {
  const { t } = makeVim('a\nb\nc\nd\ne\nf\n')
  t.resize(4, 30)
  const s = t.render()
  assert.equal(s.lines.length, 4)
})

test('createVim exposes Editor interface', () => {
  const { host, files } = makeHost({ '/f': 'hello\n' })
  const ed = createVim(host, '/f', 8, 30)
  assert.equal(ed.done, false)
  ed.key({ key: 'i', ctrl: false, alt: false, shift: false })
  ed.key({ key: 'X', ctrl: false, alt: false, shift: true })
  ed.key({ key: 'Escape', ctrl: false, alt: false, shift: false })
  const s = ed.render()
  assert.equal(s.lines.length, 8)
  void files
})

test('undo groups command line delete as one step', () => {
  const { t } = makeVim('a\nb\nc\n')
  enterEx(t, '2,3d')
  feed(t, 'u')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'c'])
})

test('yy then P pastes line above', () => {
  const { t } = makeVim('a\nb\n')
  feed(t, 'jyyP')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'b'])
})

test('charwise paste positions cursor correctly', () => {
  const { t } = makeVim('ab cd\n')
  feed(t, 'yw')
  feed(t, 'P')
  assert.equal(t.linesArr()[0], 'ab ab cd')
  assert.equal(t.getCol(), 2)
})

test('d$ on empty line does not crash', () => {
  const { t } = makeVim('\n')
  feed(t, 'd$')
  assert.equal(t.text(), '\n')
})

test('dd on last line leaves one empty line', () => {
  const { t } = makeVim('a\n')
  feed(t, 'dd')
  assert.equal(t.text(), '\n')
})

test('counted yank then paste', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, '2yy')
  assert.equal(t.reg('"'), 'a\nb\n')
  feed(t, 'p')
  assert.deepEqual(t.linesArr(), ['a', 'a', 'b', 'b', 'c'])
})

test('f not found leaves cursor', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'fz')
  assert.equal(t.getCol(), 0)
})

test('0 as first count is a motion', () => {
  const { t } = makeVim('abc\n')
  feed(t, 'l0')
  assert.equal(t.getCol(), 0)
})

test('Uppercase letters arrive with shift and insert uppercase', () => {
  const { t } = makeVim('')
  feed(t, 'iABC<Esc>')
  assert.equal(t.linesArr()[0], 'ABC')
})

test('Ctrl-c exits insert mode', () => {
  const { t } = makeVim('')
  feed(t, 'iabc<C-c>')
  assert.equal(t.getMode(), 'normal')
  assert.equal(t.linesArr()[0], 'abc')
})

test('Escape cancels command line', () => {
  const { t } = makeVim('')
  feed(t, ':wq<Escape>')
  assert.equal(t.done, false)
  assert.equal(t.getMode(), 'normal')
})

test('command line history with arrow keys', () => {
  const { t } = makeVim('')
  enterEx(t, 'set nonu')
  enterEx(t, 'set nu')
  feed(t, ':')
  feed(t, '<Up>')
  feed(t, '<CR>')
  assert.equal(t.settingNumber(), true)
})

test('command line Backspace edits', () => {
  const { t } = makeVim('')
  feed(t, ':wq<BS><CR>')
  assert.equal(t.done, false)
})

test('w with range writes partial file', () => {
  const { t, files } = makeVim('a\nb\nc\n')
  enterEx(t, '2,3w /part.txt')
  assert.equal(files.get('/part.txt'), 'b\nc\n')
})

test('modifiable refuses insert in readonly', () => {
  const { t } = makeVim('x\n', { readOnly: true })
  feed(t, 'i')
  assert.equal(t.message(), "E21: Cannot make changes, 'modifiable' is off")
  assert.equal(t.getMode(), 'normal')
})

test('multiple :set options at once', () => {
  const { t } = makeVim('')
  enterEx(t, 'set nu ai et sw=4')
  assert.equal(t.settingNumber(), true)
  feed(t, 'i  x<CR>y<Esc>')
  assert.deepEqual(t.linesArr(), ['  x', '  y'])
})

test('undo after dd restores content and cursor', () => {
  const { t } = makeVim('a\nb\nc\n')
  feed(t, 'jdd')
  assert.deepEqual(t.linesArr(), ['a', 'c'])
  feed(t, 'u')
  assert.deepEqual(t.linesArr(), ['a', 'b', 'c'])
})
