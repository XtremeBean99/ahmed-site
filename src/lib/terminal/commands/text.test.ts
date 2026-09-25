import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commands, info } from './text'
import { VFS } from '../vfs'
import { Stdin, type CmdCtx, type TerminalIO, type ExecResult } from '../types'

interface Result { out: string; err: string; status: number }

function makeFs(): VFS {
  const fs = new VFS()
  fs.mkdir('/home/guest', true)
  return fs
}

function writeFiles(fs: VFS, files: Record<string, string>): void {
  for (const [p, data] of Object.entries(files)) {
    const abs = p.startsWith('/') ? p : '/home/guest/' + p
    const dir = abs.slice(0, abs.lastIndexOf('/'))
    if (dir && dir !== '/') { try { fs.mkdir(dir, true) } catch { /* exists */ } }
    fs.writeFile(abs, data)
  }
}

async function run(argv: string[], stdin = '', opts: { fs?: VFS; cwd?: string; isTTYOut?: boolean } = {}): Promise<Result> {
  const fs = opts.fs ?? makeFs()
  const cwd = opts.cwd ?? '/home/guest'
  const outChunks: string[] = []
  const errChunks: string[] = []
  const io: TerminalIO = {
    write() {}, clear() {},
    readLine: async () => null,
    edit: async () => {},
    exit() {}, download() {}, setSfx() {},
    size: () => ({ cols: 80, rows: 24 }),
  }
  const ctx: CmdCtx = {
    argv0: argv[0] ?? '',
    args: argv.slice(1),
    stdin: new Stdin(stdin),
    out: (s) => { outChunks.push(s) },
    err: (s) => { errChunks.push(s) },
    fs,
    cwd,
    env: {},
    io,
    signal: new AbortController().signal,
    resolve: (p) => VFS.resolve(cwd, p),
    exec: async (subArgv: string[], subStdin = ''): Promise<ExecResult> => {
      if (subArgv[0] === 'echo') return { status: 0, out: subArgv.slice(1).join(' ') + '\n', err: '' }
      const r = await run(subArgv, subStdin, { fs, cwd, isTTYOut: opts.isTTYOut ?? false })
      return { status: r.status, out: r.out, err: r.err }
    },
    runScript: async () => 0,
    isTTYOut: opts.isTTYOut ?? false,
    commandNames: () => Object.keys(commands).sort(),
    history: [],
  }
  const cmd = commands[argv[0]]
  if (!cmd) return { out: '', err: `${argv[0]}: command not found\n`, status: 127 }
  const ret = cmd(ctx)
  const status = typeof ret === 'number' ? ret : await ret
  return { out: outChunks.join(''), err: errChunks.join(''), status }
}

// -------------------------------------------------------------------------------------------------
// grep
// -------------------------------------------------------------------------------------------------

test('grep basic, -v, -n, -c, -l, -L, -o', async () => {
  const fs = makeFs()
  writeFiles(fs, {
    'f.txt': 'apple\nbanana\napricot\n',
    'g.txt': 'melon\n',
  })
  let r = await run(['grep', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, 'apple\napricot\n')
  assert.equal(r.status, 0)

  r = await run(['grep', '-v', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, 'banana\n')

  r = await run(['grep', '-n', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, '1:apple\n3:apricot\n')

  r = await run(['grep', '-c', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, '2\n')

  r = await run(['grep', '-c', 'ap', 'f.txt', 'g.txt'], '', { fs })
  assert.equal(r.out, 'f.txt:2\ng.txt:0\n')

  r = await run(['grep', '-l', 'ap', 'f.txt', 'g.txt'], '', { fs })
  assert.equal(r.out, 'f.txt\n')

  r = await run(['grep', '-L', 'ap', 'f.txt', 'g.txt'], '', { fs })
  assert.equal(r.out, 'g.txt\n')

  r = await run(['grep', '-o', 'ap.', 'f.txt'], '', { fs })
  assert.equal(r.out, 'app\napr\n')
  assert.equal(r.status, 0)
})

test('grep errors and usage', async () => {
  const fs = makeFs()
  let r = await run(['grep', 'ap', 'nope'], '', { fs })
  assert.equal(r.status, 2)
  assert.equal(r.err, 'grep: nope: No such file or directory\n')

  fs.mkdir('/home/guest/d', true)
  r = await run(['grep', 'ap', 'd'], '', { fs })
  assert.equal(r.status, 2)
  assert.equal(r.err, 'grep: d: Is a directory\n')

  r = await run(['grep', '-z', 'ap'], '', { fs })
  assert.equal(r.status, 2)
  assert.equal(r.err, "grep: invalid option -- 'z'\nUsage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n")

  r = await run(['grep', '--help'], '', { fs })
  assert.equal(r.out, info.grep.usage + '\n')
  assert.equal(r.status, 0)

  r = await run(['grep'], '', { fs })
  assert.equal(r.status, 2)

  r = await run(['grep', 'ap'], 'apple\nbanana\n', { fs })
  assert.equal(r.out, 'apple\n')
  assert.equal(r.status, 0)

  r = await run(['grep', '-s', 'ap', 'nope'], '', { fs })
  assert.equal(r.err, '')
  assert.equal(r.status, 2)

  r = await run(['grep', '-e', ''], 'x\ny\n', { fs })
  assert.equal(r.out, 'x\ny\n')
})

test('grep -w, -x, -i, -E, -F, -m, -e, -f, --', async () => {
  const fs = makeFs()
  writeFiles(fs, {
    'w.txt': 'cat\nconcatenate\na cat here\n',
    'e.txt': 'aa\nb\n',
    'd.txt': 'a.b\nab\n',
    'pats.txt': 'ap\nban\n',
    'f.txt': 'apple\nbanana\napricot\n',
  })
  let r = await run(['grep', '-w', 'cat', 'w.txt'], '', { fs })
  assert.equal(r.out, 'cat\na cat here\n')
  r = await run(['grep', '-x', 'cat', 'w.txt'], '', { fs })
  assert.equal(r.out, 'cat\n')
  r = await run(['grep', '-i', 'APPLE', 'w.txt'], '', { fs })
  assert.equal(r.out, '')
  r = await run(['grep', '-E', 'a+', 'e.txt'], '', { fs })
  assert.equal(r.out, 'aa\n')
  r = await run(['egrep', 'a+', 'e.txt'], '', { fs })
  assert.equal(r.out, 'aa\n')
  r = await run(['grep', '-F', 'a.', 'd.txt'], '', { fs })
  assert.equal(r.out, 'a.b\n')
  r = await run(['fgrep', 'a.', 'd.txt'], '', { fs })
  assert.equal(r.out, 'a.b\n')
  r = await run(['grep', '-m', '1', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, 'apple\n')
  r = await run(['grep', '-m', '1', '-c', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, '1\n')
  r = await run(['grep', '-e', 'ap', '-e', 'ban', 'f.txt'], '', { fs })
  assert.equal(r.out, 'apple\nbanana\napricot\n')
  r = await run(['grep', '-f', 'pats.txt', 'f.txt'], '', { fs })
  assert.equal(r.out, 'apple\nbanana\napricot\n')
  r = await run(['grep', '--', 'ap', 'f.txt'], '', { fs })
  assert.equal(r.out, 'apple\napricot\n')
})

test('grep context groups and separators', async () => {
  const fs = makeFs()
  writeFiles(fs, {
    'c.txt': 'm1\nc1\nc2\nm2\nc3\n',
  })
  let r = await run(['grep', '-A1', 'm', 'c.txt'], '', { fs })
  assert.equal(r.out, 'm1\nc1\n--\nm2\nc3\n')
  r = await run(['grep', '-B1', 'm', 'c.txt'], '', { fs })
  assert.equal(r.out, 'm1\n--\nc2\nm2\n')
  r = await run(['grep', '-A1', '-n', 'm', 'c.txt'], '', { fs })
  assert.equal(r.out, '1:m1\n2-c1\n--\n4:m2\n5-c3\n')
})

test('grep recursive, include, exclude, -H, -h', async () => {
  const fs = makeFs()
  writeFiles(fs, {
    'd/a.txt': 'apple\n',
    'd/b.log': 'apple\n',
    'd/sub/c.txt': 'apricot\n',
  })
  let r = await run(['grep', '-r', 'ap', 'd'], '', { fs })
  assert.equal(r.out, 'd/a.txt:apple\nd/b.log:apple\nd/sub/c.txt:apricot\n')
  r = await run(['grep', '-r', '--include=*.txt', 'ap', 'd'], '', { fs })
  assert.equal(r.out, 'd/a.txt:apple\nd/sub/c.txt:apricot\n')
  r = await run(['grep', '-r', '--exclude=*.log', 'ap', 'd'], '', { fs })
  assert.equal(r.out, 'd/a.txt:apple\nd/sub/c.txt:apricot\n')
  r = await run(['grep', '-H', 'ap', 'd/a.txt'], '', { fs })
  assert.equal(r.out, 'd/a.txt:apple\n')
  r = await run(['grep', '-h', 'ap', 'd/a.txt', 'd/b.log'], '', { fs })
  assert.equal(r.out, 'apple\napple\n')
})

test('grep --color=always highlights matches', async () => {
  const fs = makeFs()
  writeFiles(fs, { 'f.txt': 'apple\n' })
  const r = await run(['grep', '--color=always', 'pp', 'f.txt'], '', { fs })
  assert.equal(r.out, 'a\x1b[01;31m\x1b[Kpp\x1b[m\x1b[Kle\n')
  assert.equal(r.status, 0)
})

// -------------------------------------------------------------------------------------------------
// sort
// -------------------------------------------------------------------------------------------------

test('sort basic, -r, -n, -u, -k, -t', async () => {
  const fs = makeFs()
  let r = await run(['sort'], 'b\na\nc\n', { fs })
  assert.equal(r.out, 'a\nb\nc\n')
  r = await run(['sort', '-r'], 'b\na\nc\n', { fs })
  assert.equal(r.out, 'c\nb\na\n')
  r = await run(['sort', '-n'], '10\n2\n1\n', { fs })
  assert.equal(r.out, '1\n2\n10\n')
  r = await run(['sort', '-u'], 'a\na\nb\n', { fs })
  assert.equal(r.out, 'a\nb\n')
  r = await run(['sort', '-k2'], 'b 2\na 1\n', { fs })
  assert.equal(r.out, 'a 1\nb 2\n')
  r = await run(['sort', '-k2,2nr'], 'a 1\nb 2\n', { fs })
  assert.equal(r.out, 'b 2\na 1\n')
  r = await run(['sort', '-t', ':', '-k2'], 'b:1\na:2\n', { fs })
  assert.equal(r.out, 'b:1\na:2\n')
  r = await run(['sort', '-t', ':', '-k2,2n'], 'b:10\na:2\n', { fs })
  assert.equal(r.out, 'a:2\nb:10\n')
})

test('sort -h, -V, -M, -f', async () => {
  const fs = makeFs()
  let r = await run(['sort', '-h'], '1K\n2\n100\n', { fs })
  assert.equal(r.out, '2\n100\n1K\n')
  r = await run(['sort', '-V'], '1.10\n1.2\n1.1\n', { fs })
  assert.equal(r.out, '1.1\n1.2\n1.10\n')
  r = await run(['sort', '-M'], 'Jan\nMar\nFeb\n', { fs })
  assert.equal(r.out, 'Jan\nFeb\nMar\n')
  r = await run(['sort', '-f'], 'b\nA\na\n', { fs })
  assert.equal(r.out, 'A\na\nb\n')
})

test('sort -c and -o', async () => {
  const fs = makeFs()
  let r = await run(['sort', '-c'], 'b\na\n', { fs })
  assert.equal(r.status, 1)
  assert.equal(r.err, 'sort: -:2: disorder: a\n')
  r = await run(['sort', '-c'], 'a\nb\n', { fs })
  assert.equal(r.status, 0)
  r = await run(['sort', '-o', 'out.txt'], 'b\na\n', { fs })
  assert.equal(r.out, '')
  assert.equal(fs.readFile('/home/guest/out.txt'), 'a\nb\n')
})

// -------------------------------------------------------------------------------------------------
// uniq
// -------------------------------------------------------------------------------------------------

test('uniq default, -c, -d, -u, -i, -f, -s, -w', async () => {
  const fs = makeFs()
  let r = await run(['uniq'], 'a\na\nb\n', { fs })
  assert.equal(r.out, 'a\nb\n')
  r = await run(['uniq', '-c'], 'a\na\nb\n', { fs })
  assert.equal(r.out, '      2 a\n      1 b\n')
  r = await run(['uniq', '-d'], 'a\na\nb\n', { fs })
  assert.equal(r.out, 'a\n')
  r = await run(['uniq', '-u'], 'a\na\nb\n', { fs })
  assert.equal(r.out, 'b\n')
  r = await run(['uniq', '-i'], 'A\na\n', { fs })
  assert.equal(r.out, 'A\n')
  r = await run(['uniq', '-f', '1'], '1 a\n2 a\n', { fs })
  assert.equal(r.out, '1 a\n')
  r = await run(['uniq', '-s', '1'], 'ab\ncb\n', { fs })
  assert.equal(r.out, 'ab\n')
  r = await run(['uniq', '-w', '2'], 'abc\nabd\n', { fs })
  assert.equal(r.out, 'abc\n')
})

// -------------------------------------------------------------------------------------------------
// cut
// -------------------------------------------------------------------------------------------------

test('cut fields, chars, bytes, complement, output delimiter', async () => {
  const fs = makeFs()
  let r = await run(['cut', '-d:', '-f1,3'], 'a:b:c\n', { fs })
  assert.equal(r.out, 'a:c\n')
  r = await run(['cut', '-d:', '-f2-'], 'a:b:c\n', { fs })
  assert.equal(r.out, 'b:c\n')
  r = await run(['cut', '-d:', '-f-2'], 'a:b:c\n', { fs })
  assert.equal(r.out, 'a:b\n')
  r = await run(['cut', '-d:', '-f1', '-s'], 'abc\n', { fs })
  assert.equal(r.out, '')
  r = await run(['cut', '-d:', '-f1', '--complement'], 'a:b:c\n', { fs })
  assert.equal(r.out, 'b:c\n')
  r = await run(['cut', '-c1-3'], 'abcdef\n', { fs })
  assert.equal(r.out, 'abc\n')
  r = await run(['cut', '-b1-2'], 'abcdef\n', { fs })
  assert.equal(r.out, 'ab\n')
  r = await run(['cut', '-d:', '-f1,2', '--output-delimiter=,'], 'a:b\n', { fs })
  assert.equal(r.out, 'a,b\n')
})

// -------------------------------------------------------------------------------------------------
// tr
// -------------------------------------------------------------------------------------------------

test('tr translate, delete, squeeze, classes, escapes, complement', async () => {
  const fs = makeFs()
  let r = await run(['tr', 'a-z', 'A-Z'], 'hello\n', { fs })
  assert.equal(r.out, 'HELLO\n')
  r = await run(['tr', '-d', 'aeiou'], 'hello\n', { fs })
  assert.equal(r.out, 'hll\n')
  r = await run(['tr', '-s', ' '], 'a  b\n', { fs })
  assert.equal(r.out, 'a b\n')
  r = await run(['tr', '[:lower:]', '[:upper:]'], 'Hi\n', { fs })
  assert.equal(r.out, 'HI\n')
  r = await run(['tr', '\\n', ' '], 'a\nb\n', { fs })
  assert.equal(r.out, 'a b ')
  r = await run(['tr', '-cd', 'a-z'], 'a1b2\n', { fs })
  assert.equal(r.out, 'ab')
  r = await run(['tr', 'ab', '12'], 'abc\n', { fs })
  assert.equal(r.out, '12c\n')
})

// -------------------------------------------------------------------------------------------------
// rev / nl / paste / fold / fmt / column
// -------------------------------------------------------------------------------------------------

test('rev reverses each line', async () => {
  const fs = makeFs()
  const r = await run(['rev'], 'abc\ndef\n', { fs })
  assert.equal(r.out, 'cba\nfed\n')
})

test('nl numbering styles', async () => {
  const fs = makeFs()
  let r = await run(['nl'], 'a\n\nb\n', { fs })
  assert.equal(r.out, '     1\ta\n\n     2\tb\n')
  r = await run(['nl', '-b', 'a'], 'a\n\nb\n', { fs })
  assert.equal(r.out, '     1\ta\n     2\t\n     3\tb\n')
  r = await run(['nl', '-v', '10'], 'a\n', { fs })
  assert.equal(r.out, '    10\ta\n')
  r = await run(['nl', '-n', 'rz', '-w', '3'], 'a\n', { fs })
  assert.equal(r.out, '001\ta\n')
  r = await run(['nl', '-s', '|'], 'a\n', { fs })
  assert.equal(r.out, '     1|a\n')
})

test('paste merges files', async () => {
  const fs = makeFs()
  writeFiles(fs, { 'f1': 'a\nb\n', 'f2': '1\n2\n' })
  let r = await run(['paste', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, 'a\t1\nb\t2\n')
  r = await run(['paste', '-d,', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, 'a,1\nb,2\n')
  r = await run(['paste', '-s', 'f1'], '', { fs })
  assert.equal(r.out, 'a\tb\n')
})

test('fold wraps lines', async () => {
  const fs = makeFs()
  let r = await run(['fold', '-w', '5'], 'abcdefghi\n', { fs })
  assert.equal(r.out, 'abcde\nfghi\n')
  r = await run(['fold', '-w', '3', '-s'], 'ab cd ef\n', { fs })
  assert.equal(r.out, 'ab \ncd \nef\n')
})

test('fmt simple word wrap', async () => {
  const fs = makeFs()
  const r = await run(['fmt', '-w', '10'], 'one two three four\n', { fs })
  assert.equal(r.out, 'one two\nthree four\n')
})

test('column -t aligns a table', async () => {
  const fs = makeFs()
  let r = await run(['column', '-t'], 'a b\ncc d\n', { fs })
  assert.equal(r.out, 'a   b\ncc  d\n')
  r = await run(['column', '-t', '-s,', '-o;'], 'a,b\ncc,d\n', { fs })
  assert.equal(r.out, 'a ;b\ncc;d\n')
})

// -------------------------------------------------------------------------------------------------
// expand / unexpand / comm / join
// -------------------------------------------------------------------------------------------------

test('expand and unexpand', async () => {
  const fs = makeFs()
  let r = await run(['expand', '-t', '4'], 'a\tb\n', { fs })
  assert.equal(r.out, 'a   b\n')
  r = await run(['unexpand', '-t', '4'], '    a\n', { fs })
  assert.equal(r.out, '\ta\n')
})

test('comm column selection', async () => {
  const fs = makeFs()
  writeFiles(fs, { 'f1': 'a\nc\ne\n', 'f2': 'b\nc\nd\n' })
  let r = await run(['comm', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, 'a\n\tb\n\t\tc\n\td\ne\n')
  r = await run(['comm', '-12', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, 'c\n')
  r = await run(['comm', '-1', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, 'b\n\tc\nd\n')
})

test('join basic and -v', async () => {
  const fs = makeFs()
  writeFiles(fs, { 'f1': '1 a\n2 b\n', 'f2': '1 x\n3 y\n' })
  let r = await run(['join', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, '1 a x\n')
  r = await run(['join', '-v', '1', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, '2 b\n')
  writeFiles(fs, { 'g1': '1:a\n2:b\n', 'g2': '1:x\n' })
  r = await run(['join', '-t', ':', 'g1', 'g2'], '', { fs })
  assert.equal(r.out, '1:a:x\n')
})

// -------------------------------------------------------------------------------------------------
// shuf / wc / tee / xargs
// -------------------------------------------------------------------------------------------------

test('shuf -e, -i, -n', async () => {
  const fs = makeFs()
  let r = await run(['shuf', '-e', 'a', 'b', 'c'], '', { fs })
  assert.equal(r.status, 0)
  assert.equal(r.out.split('\n').filter(Boolean).sort().join(','), 'a,b,c')
  r = await run(['shuf', '-i', '1-3', '-n', '2'], '', { fs })
  const lines = r.out.split('\n').filter(Boolean)
  assert.equal(lines.length, 2)
  for (const l of lines) assert.ok(['1', '2', '3'].includes(l))
  r = await run(['shuf', '-n', '1'], 'a\nb\nc\n', { fs })
  assert.equal(r.out.split('\n').filter(Boolean).length, 1)
})

test('wc default and flags with total line', async () => {
  const fs = makeFs()
  let r = await run(['wc'], 'a b\nc\n', { fs })
  assert.equal(r.out, '2 3 6\n')
  r = await run(['wc', '-l'], 'a b\nc\n', { fs })
  assert.equal(r.out, '2\n')
  r = await run(['wc', '-w'], 'a b\nc\n', { fs })
  assert.equal(r.out, '3\n')
  r = await run(['wc', '-c'], 'a b\nc\n', { fs })
  assert.equal(r.out, '6\n')
  r = await run(['wc', '-m'], 'a b\nc\n', { fs })
  assert.equal(r.out, '6\n')
  r = await run(['wc', '-L'], 'a\nbbb\n', { fs })
  assert.equal(r.out, '3\n')
  writeFiles(fs, { 'f1': 'a\n', 'f2': 'bb\n' })
  r = await run(['wc', 'f1', 'f2'], '', { fs })
  assert.equal(r.out, '1 1 2 f1\n1 1 3 f2\n2 2 5 total\n')
  writeFiles(fs, { 'big': 'hello world\n', 'small': 'x\n' })
  r = await run(['wc', 'big', 'small'], '', { fs })
  assert.equal(r.out, ' 1  2 12 big\n 1  1  2 small\n 2  3 14 total\n')
})

test('tee writes files and echoes, -a appends', async () => {
  const fs = makeFs()
  let r = await run(['tee', 'out.txt'], 'hi\n', { fs })
  assert.equal(r.out, 'hi\n')
  assert.equal(fs.readFile('/home/guest/out.txt'), 'hi\n')
  r = await run(['tee', '-a', 'out.txt'], 'yo\n', { fs })
  assert.equal(fs.readFile('/home/guest/out.txt'), 'hi\nyo\n')
})

test('xargs builds command lines', async () => {
  const fs = makeFs()
  let r = await run(['xargs'], 'a b c\n', { fs })
  assert.equal(r.out, 'a b c\n')
  r = await run(['xargs', '-n', '2'], 'a b c\n', { fs })
  assert.equal(r.out, 'a b\nc\n')
  r = await run(['xargs', '-0'], 'a\0b\0', { fs })
  assert.equal(r.out, 'a b\n')
  r = await run(['xargs', '-d,'], 'a,b', { fs })
  assert.equal(r.out, 'a b\n')
  r = await run(['xargs', '-r'], '', { fs })
  assert.equal(r.out, '')
  r = await run(['xargs', '-I', '{}', 'echo', '{}!'], 'x y\n', { fs })
  assert.equal(r.out, 'x y!\n')
  r = await run(['xargs', '-t', '-n', '1'], 'a\n', { fs })
  assert.equal(r.out, 'a\n')
  assert.equal(r.err, 'echo a\n')
})

// -------------------------------------------------------------------------------------------------
// diff
// -------------------------------------------------------------------------------------------------

test('diff -q and normal format', async () => {
  const fs = makeFs()
  writeFiles(fs, { 'a': 'a\nb\nc\n', 'b': 'a\nx\nc\n', 'same1': 'x\n', 'same2': 'x\n' })
  let r = await run(['diff', 'a', 'b'], '', { fs })
  assert.equal(r.status, 1)
  assert.equal(r.out, '2c2\n< b\n---\n> x\n')
  r = await run(['diff', '-q', 'a', 'b'], '', { fs })
  assert.equal(r.status, 1)
  assert.equal(r.out, 'Files a and b differ\n')
  r = await run(['diff', 'same1', 'same2'], '', { fs })
  assert.equal(r.status, 0)
  assert.equal(r.out, '')
  r = await run(['diff', 'a', 'missing'], '', { fs })
  assert.equal(r.status, 2)
  assert.equal(r.err, 'diff: missing: No such file or directory\n')
})

test('diff -u hunks with headers', async () => {
  const fs = makeFs()
  fs.writeFile('/home/guest/a', 'a\nb\nc\nd\ne\nf\ng\nh\n')
  fs.writeFile('/home/guest/b', 'a\nb\nX\nd\ne\nf\ng\nh\n')
  const r = await run(['diff', '-u', 'a', 'b'], '', { fs })
  assert.equal(r.status, 1)
  const lines = r.out.split('\n')
  assert.ok(lines[0].startsWith('--- a\t'))
  assert.ok(lines[0].includes(' +0000'))
  assert.ok(lines[1].startsWith('+++ b\t'))
  assert.equal(lines[2], '@@ -1,6 +1,6 @@')
  assert.equal(lines[3], ' a')
  assert.equal(lines[4], ' b')
  assert.equal(lines[5], '-c')
  assert.equal(lines[6], '+X')
  assert.equal(lines[7], ' d')
  assert.equal(lines[8], ' e')
  assert.equal(lines[9], ' f')
})

// -------------------------------------------------------------------------------------------------
// base64 / hashes / cksum / sum
// -------------------------------------------------------------------------------------------------

test('base64 encode and decode', async () => {
  const fs = makeFs()
  let r = await run(['base64'], 'hello\n', { fs })
  assert.equal(r.out, 'aGVsbG8K\n')
  r = await run(['base64', '-d'], 'aGVsbG8=\n', { fs })
  assert.equal(r.out, 'hello')
  r = await run(['base64', '-w0'], 'hi', { fs })
  assert.equal(r.out, 'aGk=')
  assert.equal(r.status, 0)
})

test('md5sum and sha sums with check mode', async () => {
  const fs = makeFs()
  let r = await run(['md5sum'], '', { fs })
  assert.equal(r.out, 'd41d8cd98f00b204e9800998ecf8427e  -\n')
  writeFiles(fs, { 'f': 'abc' })
  r = await run(['md5sum', 'f'], '', { fs })
  assert.equal(r.out, '900150983cd24fb0d6963f7d28e17f72  f\n')
  r = await run(['sha256sum'], '', { fs })
  assert.equal(r.out, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  -\n')
  r = await run(['sha1sum', 'f'], '', { fs })
  assert.equal(r.out, 'a9993e364706816aba3e25717850c26c9cd0d89d  f\n')
  r = await run(['sha512sum'], '', { fs })
  assert.equal(r.out, 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e  -\n')
  writeFiles(fs, { 'empty.txt': '' })
  r = await run(['md5sum', '-c'], 'd41d8cd98f00b204e9800998ecf8427e  empty.txt\n', { fs })
  assert.equal(r.out, 'empty.txt: OK\n')
  assert.equal(r.status, 0)
  r = await run(['md5sum', '-c'], 'd41d8cd98f00b204e9800998ecf8427e  missing.txt\n', { fs })
  assert.equal(r.status, 1)
  assert.ok(r.out.includes('missing.txt: FAILED open or read'))
})

test('cksum and sum', async () => {
  const fs = makeFs()
  let r = await run(['cksum'], '', { fs })
  assert.equal(r.out, '4294967295 0 -\n')
  r = await run(['sum'], '', { fs })
  assert.equal(r.out, '    0     0 -\n')
})

// -------------------------------------------------------------------------------------------------
// od / xxd / hexdump / strings
// -------------------------------------------------------------------------------------------------

test('od layouts', async () => {
  const fs = makeFs()
  let r = await run(['od', '-t', 'x1'], 'ab\n', { fs })
  assert.equal(r.out, '0000000 61 62 0a\n')
  r = await run(['od', '-c'], 'a\n', { fs })
  assert.equal(r.out, '0000000    a\\n \n')
  r = await run(['od', '-A', 'x', '-t', 'x1'], 'a', { fs })
  assert.equal(r.out, '000000 61\n')
  r = await run(['od', '-N', '1', '-t', 'x1'], 'ab', { fs })
  assert.equal(r.out, '0000000 61\n')
  r = await run(['od', '-x'], 'ab\n', { fs })
  assert.equal(r.out, '0000000 6261 000a\n')
})

test('xxd standard, plain, revert', async () => {
  const fs = makeFs()
  let r = await run(['xxd'], 'Hi', { fs })
  assert.equal(r.out, '00000000: 4869' + ' '.repeat(35) + '  Hi\n')
  r = await run(['xxd', '-p'], 'Hi', { fs })
  assert.equal(r.out, '4869\n')
  r = await run(['xxd', '-r', '-p'], '48656c6c6f\n', { fs })
  assert.equal(r.out, 'Hello')
  r = await run(['xxd', '-c', '2'], 'Hi', { fs })
  assert.equal(r.out, '00000000: 4869  Hi\n')
})

test('hexdump -C canonical layout', async () => {
  const fs = makeFs()
  const r = await run(['hexdump', '-C'], 'ab\n', { fs })
  assert.equal(r.out, '00000000  61 62 0a' + ' '.repeat(40) + '  |ab.|\n')
})

test('strings extracts printable runs', async () => {
  const fs = makeFs()
  let r = await run(['strings'], 'ab\x00cd\x00efgh\x00ij', { fs })
  assert.equal(r.out, 'efgh\n')
  r = await run(['strings', '-n', '2'], 'ab\x00cd\x00efgh', { fs })
  assert.equal(r.out, 'ab\ncd\nefgh\n')
})

// -------------------------------------------------------------------------------------------------
// seq / split / iconv / line endings
// -------------------------------------------------------------------------------------------------

test('seq sequences', async () => {
  const fs = makeFs()
  let r = await run(['seq', '3'], '', { fs })
  assert.equal(r.out, '1\n2\n3\n')
  r = await run(['seq', '2', '4'], '', { fs })
  assert.equal(r.out, '2\n3\n4\n')
  r = await run(['seq', '5', '1'], '', { fs })
  assert.equal(r.out, '5\n4\n3\n2\n1\n')
  r = await run(['seq', '1', '2', '7'], '', { fs })
  assert.equal(r.out, '1\n3\n5\n7\n')
  r = await run(['seq', '-s', ',', '1', '3'], '', { fs })
  assert.equal(r.out, '1,2,3\n')
  r = await run(['seq', '-w', '8', '10'], '', { fs })
  assert.equal(r.out, '08\n09\n10\n')
  r = await run(['seq', '1.0', '2.0'], '', { fs })
  assert.equal(r.out, '1.0\n2.0\n')
})

test('split writes chunks', async () => {
  const fs = makeFs()
  let r = await run(['split', '-l', '2', '-', 'part'], 'a\nb\nc\n', { fs })
  assert.equal(r.status, 0)
  assert.equal(fs.readFile('/home/guest/partaa'), 'a\nb\n')
  assert.equal(fs.readFile('/home/guest/partab'), 'c\n')
  r = await run(['split', '-b', '3', '-', 'px'], 'abcdef', { fs })
  assert.equal(fs.readFile('/home/guest/pxaa'), 'abc')
  assert.equal(fs.readFile('/home/guest/pxab'), 'def')
  writeFiles(fs, { 'in.txt': 'a\nb\nc\n' })
  r = await run(['split', '-l', '2', 'in.txt'], '', { fs })
  assert.equal(fs.readFile('/home/guest/xaa'), 'a\nb\n')
  assert.equal(fs.readFile('/home/guest/xab'), 'c\n')
})

test('iconv and line ending converters', async () => {
  const fs = makeFs()
  let r = await run(['iconv', '-f', 'UTF-8', '-t', 'UTF-8'], 'hi\n', { fs })
  assert.equal(r.out, 'hi\n')
  r = await run(['iconv', '-f', 'UTF-8', '-t', 'UTF-16'], '', { fs })
  assert.equal(r.status, 1)
  writeFiles(fs, { 'dos.txt': 'a\r\nb\r\n' })
  r = await run(['dos2unix', 'dos.txt'], '', { fs })
  assert.equal(fs.readFile('/home/guest/dos.txt'), 'a\nb\n')
  r = await run(['unix2dos', 'dos.txt'], '', { fs })
  assert.equal(fs.readFile('/home/guest/dos.txt'), 'a\r\nb\r\n')
  r = await run(['unix2dos'], 'a\n', { fs })
  assert.equal(r.out, 'a\r\n')
})
