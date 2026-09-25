import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commands } from './sed'
import type { CmdCtx, TerminalIO } from '../types'
import { Stdin } from '../types'
import { VFS } from '../vfs'
import { HOME } from '../seed'

function makeFs(files: Record<string, string>): VFS {
  const fs = new VFS()
  fs.batch(() => {
    fs.mkdir('/home/guest', true)
    fs.mkdir('/tmp', true)
    for (const [p, data] of Object.entries(files)) fs.writeFile(p.startsWith('/') ? p : HOME + '/' + p, data)
  })
  return fs
}

function makeCtx(args: string[], stdinData = '', files: Record<string, string> = {}): { ctx: CmdCtx; out: string; err: string; fs: VFS } {
  const fs = makeFs(files)
  const box = { out: '', err: '' }
  const io: TerminalIO = {
    write() {}, clear() {}, readLine: async () => null, edit: async () => {},
    exit() {}, download() {}, setSfx() {}, size: () => ({ cols: 80, rows: 24 }),
  }
  const ctx: CmdCtx = {
    argv0: 'sed',
    args,
    stdin: new Stdin(stdinData),
    out: (s) => { box.out += s },
    err: (s) => { box.err += s },
    fs,
    cwd: HOME,
    env: {},
    io,
    signal: new AbortController().signal,
    resolve: (p) => VFS.resolve(HOME, p, HOME),
    exec: async () => ({ status: 0, out: '', err: '' }),
    runScript: async () => 0,
    isTTYOut: false,
    commandNames: () => [],
    history: [],
  }
  return { ctx, get out() { return box.out }, get err() { return box.err }, fs }
}

async function runSed(args: string[], input = '', files: Record<string, string> = {}): Promise<{ status: number; out: string; err: string; fs: VFS }> {
  const m = makeCtx(args, input, files)
  const status = await commands.sed(m.ctx)
  return { status, out: m.out, err: m.err, fs: m.fs }
}

test('sed s/// basic, global, occurrence', async () => {
  let r = await runSed(['s/a/X/'], 'a\n')
  assert.equal(r.out, 'X\n')
  r = await runSed(['s/a/X/g'], 'aaa\n')
  assert.equal(r.out, 'XXX\n')
  r = await runSed(['s/a/X/2'], 'aaa\n')
  assert.equal(r.out, 'aXa\n')
  r = await runSed(['s/a/X/2g'], 'aaa\n')
  assert.equal(r.out, 'aXX\n')
  r = await runSed(['s/a/X/3'], 'aaa\n')
  assert.equal(r.out, 'aaX\n')
})

test('sed s/// delimiters and special regexes', async () => {
  let r = await runSed(['s|/usr|/opt|'], '/usr/bin\n')
  assert.equal(r.out, '/opt/bin\n')
  r = await runSed(['s/[^,]*,//'], 'a,b,c\n')
  assert.equal(r.out, 'b,c\n')
  r = await runSed(['s;a;b;'], 'a\n')
  assert.equal(r.out, 'b\n')
})

test('sed replacement escapes & and groups', async () => {
  let r = await runSed(['s/ab/&c/'], 'ab\n')
  assert.equal(r.out, 'abc\n')
  r = await runSed(['s/\\(a\\)\\(b\\)/\\2\\1/'], 'ab\n')
  assert.equal(r.out, 'ba\n')
  r = await runSed(['s/a/\\t/'], 'a\n')
  assert.equal(r.out, '\t\n')
  r = await runSed(['s/a/X\\nY/'], 'a\n')
  assert.equal(r.out, 'X\nY\n')
})

test('sed case conversion in replacement', async () => {
  let r = await runSed(['s/abc/\\U&/'], 'abc\n')
  assert.equal(r.out, 'ABC\n')
  r = await runSed(['s/ABC/\\L&/'], 'ABC\n')
  assert.equal(r.out, 'abc\n')
  r = await runSed(['s/abc/\\u&/'], 'abc\n')
  assert.equal(r.out, 'Abc\n')
  r = await runSed(['s/ABC/\\l&/'], 'ABC\n')
  assert.equal(r.out, 'aBC\n')
  r = await runSed(['s/abc/\\U\\u&\\E&/'], 'abc\n')
  assert.equal(r.out, 'ABCabc\n')
})

test('sed empty-match advancement', async () => {
  let r = await runSed(['s/x*/Y/g'], 'abc\n')
  assert.equal(r.out, 'YaYbYcY\n')
  r = await runSed(['s/[a-z]*/Y/g'], 'ab\n')
  assert.equal(r.out, 'Y\n')
  r = await runSed(['s/a*/Y/2'], 'abc\n')
  assert.equal(r.out, 'aYbc\n')
})

test('sed print and delete commands', async () => {
  let r = await runSed(['p'], 'a\n')
  assert.equal(r.out, 'a\na\n')
  r = await runSed(['-n', 'p'], 'a\n')
  assert.equal(r.out, 'a\n')
  r = await runSed(['d'], 'a\nb\n')
  assert.equal(r.out, '')
  r = await runSed(['2d'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nc\n')
  r = await runSed(['/^$/d'], 'a\n\nb\n')
  assert.equal(r.out, 'a\nb\n')
})

test('sed N, P, D and multiline', async () => {
  let r = await runSed(['N;s/\\n/ /'], 'a\nb\nc\n')
  assert.equal(r.out, 'a b\nc\n')
  r = await runSed(['$!N;s/\\n/,/'], 'a\nb\nc\n')
  assert.equal(r.out, 'a,b\nc\n')
  r = await runSed(['N;P'], 'a\nb\n')
  assert.equal(r.out, 'a\na\nb\n')
})

test('sed hold space: G double space and tac', async () => {
  let r = await runSed(['G'], 'a\nb\n')
  assert.equal(r.out, 'a\n\nb\n\n')
  r = await runSed(['1!G;h;$!d'], 'a\nb\nc\n')
  assert.equal(r.out, 'c\nb\na\n')
  r = await runSed(['H;x'], 'a\nb\n')
  assert.equal(r.out, '\na\na\nb\n')
})

test('sed y transliteration', async () => {
  let r = await runSed(['y/abc/xyz/'], 'abcabc\n')
  assert.equal(r.out, 'xyzxyz\n')
  r = await runSed(['y/abc/ABC/'], 'a\n')
  assert.equal(r.out, 'A\n')
})

test('sed line number commands = and $=', async () => {
  let r = await runSed(['='], 'a\nb\n')
  assert.equal(r.out, '1\na\n2\nb\n')
  r = await runSed(['-n', '$='], 'a\nb\n')
  assert.equal(r.out, '2\n')
  r = await runSed(['-n', '$='], '')
  assert.equal(r.out, '')
})

test('sed q, Q and print then quit', async () => {
  let r = await runSed(['2q'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nb\n')
  r = await runSed(['2Q'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\n')
  r = await runSed(['-n', '2{p;q}'], 'a\nb\nc\n')
  assert.equal(r.out, 'b\n')
  r = await runSed(['q 5'], 'a\n')
  assert.equal(r.status, 5)
})

test('sed addresses: N, $, step, ranges, negation', async () => {
  let r = await runSed(['-n', '1~2p'], 'a\nb\nc\nd\n')
  assert.equal(r.out, 'a\nc\n')
  r = await runSed(['-n', '2~3p'], 'a\nb\nc\nd\ne\n')
  assert.equal(r.out, 'b\ne\n')
  r = await runSed(['-n', '2,+2p'], 'a\nb\nc\nd\ne\n')
  assert.equal(r.out, 'b\nc\nd\n')
  r = await runSed(['-n', '2,~4p'], 'a\nb\nc\nd\ne\n')
  assert.equal(r.out, 'b\nc\nd\n')
  r = await runSed(['-n', '/a/,/c/p'], 'a\nb\nc\nd\n')
  assert.equal(r.out, 'a\nb\nc\n')
  r = await runSed(['-n', '0,/b/p'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nb\n')
  r = await runSed(['-n', '2!p'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nc\n')
  r = await runSed(['-n', '$p'], 'a\nb\n')
  assert.equal(r.out, 'b\n')
})

test('sed regex address flags and alternate delimiter', async () => {
  let r = await runSed(['-n', '/B/Ip'], 'a\nb\nc\n')
  assert.equal(r.out, 'b\n')
  r = await runSed(['-n', '\\%b%p'], 'a\nb\nc\n')
  assert.equal(r.out, 'b\n')
})

test('sed empty regex reuses last', async () => {
  let r = await runSed(['/a/s//X/'], 'a\n')
  assert.equal(r.out, 'X\n')
  r = await runSed(['s/a/X/;s//Y/'], 'a\n')
  assert.equal(r.out, 'X\n')
})

test('sed a, i, c text commands', async () => {
  let r = await runSed(['a\\hello'], 'x\n')
  assert.equal(r.out, 'x\nhello\n')
  r = await runSed(['i\\hello'], 'x\n')
  assert.equal(r.out, 'hello\nx\n')
  r = await runSed(['c\\hello'], 'x\n')
  assert.equal(r.out, 'hello\n')
  r = await runSed(['a hello'], 'x\n')
  assert.equal(r.out, 'x\nhello\n')
  r = await runSed(['a\\\nfoo\\\nbar'], 'x\n')
  assert.equal(r.out, 'x\nfoo\nbar\n')
  r = await runSed(['a\\\n  indented'], 'x\n')
  assert.equal(r.out, 'x\n  indented\n')
  r = await runSed(['c\\\n'], 'x\n')
  assert.equal(r.out, '')
  r = await runSed(['c\\\n\n'], 'x\n')
  assert.equal(r.out, '\n')
})

test('sed r and w file commands', async () => {
  const files = { 'inc.txt': 'INC\n', 'out.txt': '' }
  let r = await runSed(['r inc.txt'], 'x\n', files)
  assert.equal(r.out, 'x\nINC\n')
  r = await runSed(['w out.txt'], 'x\ny\n', {})
  assert.equal(r.fs.readFile(HOME + '/out.txt'), 'x\ny\n')
  r = await runSed(['s/x/y/w out2.txt'], 'x\n', {})
  assert.equal(r.fs.readFile(HOME + '/out2.txt'), 'y\n')
})

test('sed s/// w flag and p flag', async () => {
  let r = await runSed(['s/a/b/p'], 'a\n')
  assert.equal(r.out, 'b\nb\n')
  r = await runSed(['s/a/b/w cap.txt'], 'a\nc\n', {})
  assert.equal(r.fs.readFile(HOME + '/cap.txt'), 'b\n')
})

test('sed l visible escape', async () => {
  let r = await runSed(['-n', 'l'], 'a\tb\n')
  assert.equal(r.out, 'a\\tb$\n')
  r = await runSed(['-n', 'N;l'], 'a\nb\n')
  assert.equal(r.out, 'a\\nb$\n')
})

test('sed range print -n /start/,/end/p', async () => {
  const input = 'start\none\ntwo\nend\nlast\n'
  const r = await runSed(['-n', '/start/,/end/p'], input)
  assert.equal(r.out, 'start\none\ntwo\nend\n')
})

test('sed blocks with ; and newlines', async () => {
  let r = await runSed(['/a/{s/a/b/;p}'], 'a\nc\n')
  assert.equal(r.out, 'b\nb\nc\n')
  r = await runSed(['1,2{s/a/b/;p}'], 'a\na\na\n')
  assert.equal(r.out, 'b\nb\nb\nb\na\n')
  r = await runSed(['-n', '2{p;q}'], 'a\nb\nc\n')
  assert.equal(r.out, 'b\n')
})

test('sed branches and labels', async () => {
  let r = await runSed(['s/a/x/;t L;d;: L;p'], 'a\nb\n')
  assert.equal(r.out, 'x\nx\n')
  r = await runSed(['s/a/x/;T L;d;: L;p'], 'b\n')
  assert.equal(r.out, 'b\nb\n')
  r = await runSed(['b L;d;: L;p'], 'a\n')
  assert.equal(r.out, 'a\na\n')
})

test('sed # comments', async () => {
  let r = await runSed(['# comment\ns/a/b/'], 'a\n')
  assert.equal(r.out, 'b\n')
  r = await runSed(['s/a/b/ # trailing\n'], 'a\n')
  assert.equal(r.out, 'b\n')
})

test('sed -e multiple scripts', async () => {
  let r = await runSed(['-e', 's/a/b/', '-e', 's/b/c/'], 'a\n')
  assert.equal(r.out, 'c\n')
  r = await runSed(['--expression=s/a/b/'], 'a\n')
  assert.equal(r.out, 'b\n')
})

test('sed -E extended regex', async () => {
  const r = await runSed(['-E', 's/(a)(b)/\\2\\1/'], 'ab\n')
  assert.equal(r.out, 'ba\n')
  const r2 = await runSed(['s/(a)(b)/\\2\\1/'], 'ab\n')
  assert.equal(r2.out, 'ab\n') // BRE: parens are literal
})

test('sed -f script file', async () => {
  const files = { 'script.sed': 's/a/b/\n' }
  const r = await runSed(['-f', 'script.sed'], 'a\n', files)
  assert.equal(r.out, 'b\n')
})

test('sed multiple files continuous line numbers and -s', async () => {
  const files = { 'f1.txt': 'a\nb\n', 'f2.txt': 'c\nd\n' }
  let r = await runSed(['='], 'a\nb\n', files)
  assert.equal(r.out, '1\na\n2\nb\n')
  r = await runSed(['=', 'f1.txt', 'f2.txt'], '', files)
  assert.equal(r.out, '1\na\n2\nb\n3\nc\n4\nd\n')
  r = await runSed(['-s', '=', 'f1.txt', 'f2.txt'], '', files)
  assert.equal(r.out, '1\na\n2\nb\n1\nc\n2\nd\n')
})

test('sed -i in place with and without backup', async () => {
  let r = await runSed(['-i', 's/a/X/', 'f.txt'], '', { 'f.txt': 'a\na\n' })
  assert.equal(r.fs.readFile(HOME + '/f.txt'), 'X\nX\n')
  assert.equal(r.out, '')
  r = await runSed(['-i.bak', 's/a/X/', 'f.txt'], '', { 'f.txt': 'a\n' })
  assert.equal(r.fs.readFile(HOME + '/f.txt'), 'X\n')
  assert.equal(r.fs.readFile(HOME + '/f.txt.bak'), 'a\n')
})

test('sed stdin via - and default', async () => {
  let r = await runSed(['s/a/b/'], 'a\n')
  assert.equal(r.out, 'b\n')
  r = await runSed(['s/a/b/', '-'], 'a\n')
  assert.equal(r.out, 'b\n')
})

test('sed trailing newline behaviour', async () => {
  let r = await runSed(['s/a/b/'], 'a')
  assert.equal(r.out, 'b')
  r = await runSed(['p'], 'a')
  assert.equal(r.out, 'a\na')
  r = await runSed(['G'], 'a')
  assert.equal(r.out, 'a\n\n')
})

test('sed error: unknown command', async () => {
  const r = await runSed(['V'], 'a\n')
  assert.equal(r.status, 1)
  assert.match(r.err, /sed: -e expression #1, char 1: unknown command: `V'/)
})

test('sed error: missing file', async () => {
  const r = await runSed(['=', '/nope'], '')
  assert.equal(r.status, 2)
  assert.match(r.err, /sed: can't read \/nope: No such file or directory/)
})

test('sed error: y lengths and e flag', async () => {
  let r = await runSed(['y/ab/a/'], '')
  assert.equal(r.status, 1)
  assert.match(r.err, /strings for `y' command are different lengths/)
  r = await runSed(['s/a/b/e'], '')
  assert.equal(r.status, 1)
  assert.match(r.err, /e modifier not supported/)
  r = await runSed(['s//x/'], '')
  assert.equal(r.status, 1)
  assert.match(r.err, /no previous regular expression/)
})

test('sed unknown option', async () => {
  const r = await runSed(['-Z'], '')
  assert.equal(r.status, 1)
  assert.match(r.err, /sed: invalid option -- 'Z'/)
})

test('sed --help', async () => {
  const r = await runSed(['--help'], '')
  assert.equal(r.status, 0)
  assert.match(r.out, /Usage: sed/)
})

test('sed q with pending a text and Q without', async () => {
  let r = await runSed(['a\\X\nq'], 'a\nb\n')
  assert.equal(r.out, 'a\nX\n')
  r = await runSed(['a\\X\nQ'], 'a\nb\n')
  assert.equal(r.out, '')
})

test('sed n and N with pending text flush', async () => {
  const r = await runSed(['-n', 'a\\X\nN\np'], 'a\nb\n')
  assert.equal(r.out, 'X\na\nb\n')
})
