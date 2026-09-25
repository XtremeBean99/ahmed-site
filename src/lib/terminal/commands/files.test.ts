import test from 'node:test'
import assert from 'node:assert/strict'
import { VFS } from '../vfs'
import { Stdin } from '../types'
import type { CmdCtx, TerminalIO } from '../types'
import { commands, info } from './files'

// ---- test harness -------------------------------------------------------------------------------

interface RunOpts { stdin?: string; tty?: boolean; cols?: number; cwd?: string }

function run(fs: VFS, argv: string[], opts: RunOpts = {}) {
  let out = ''
  let err = ''
  const cwd = opts.cwd ?? '/home/guest'
  const io: TerminalIO = {
    write: (s: string): void => { out += s },
    clear: (): void => {},
    readLine: async (): Promise<string | null> => null,
    edit: async (): Promise<void> => {},
    exit: (): void => {},
    download: (): void => {},
    setSfx: (): void => {},
    size: (): { cols: number; rows: number } => ({ cols: opts.cols ?? 80, rows: 24 }),
  }
  const ctx: CmdCtx = {
    argv0: argv[0] ?? '',
    args: argv.slice(1),
    stdin: new Stdin(opts.stdin ?? ''),
    out: (s: string): void => { out += s },
    err: (s: string): void => { err += s },
    fs,
    cwd,
    env: { HOME: '/home/guest' },
    io,
    signal: new AbortController().signal,
    resolve: (p: string): string => VFS.resolve(cwd, p, '/home/guest'),
    exec: async (subArgv: string[], stdin?: string) => {
      const fn = commands[subArgv[0]]
      if (!fn) return { status: 127, out: '', err: `exec: ${subArgv[0]}: not found\n` }
      const r = run(fs, subArgv, { stdin, cwd })
      const status = await fn(r.ctx)
      return { status, out: r.out(), err: r.err() }
    },
    runScript: async (): Promise<number> => 0,
    isTTYOut: opts.tty ?? false,
    commandNames: (): string[] => Object.keys(commands).sort(),
    history: [],
  }
  return { ctx, out: (): string => out, err: (): string => err }
}

async function exec(fs: VFS, argv: string[], opts: RunOpts = {}): Promise<{ status: number; out: string; err: string }> {
  const r = run(fs, argv, opts)
  const status = await commands[argv[0]](r.ctx)
  return { status, out: r.out(), err: r.err() }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(ms: number): string {
  const d = new Date(ms)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MTIME = Date.now() - 60_000

function makeFs(): VFS {
  const fs = new VFS()
  fs.batch(() => {
    fs.mkdir('/home/guest', true)
    fs.mkdir('/tmp', true)
    fs.writeFile('/home/guest/a.txt', 'hello\n')
    fs.writeFile('/home/guest/b.txt', 'world\nworld\n')
    fs.writeFile('/home/guest/.hidden', 'secret\n')
    fs.writeFile('/home/guest/empty.txt', '')
    fs.writeFile('/home/guest/run.sh', '#!/bin/bash\necho hi\n')
    fs.chmod('/home/guest/run.sh', 0o755)
    fs.mkdir('/home/guest/sub', true)
    fs.writeFile('/home/guest/sub/inner.txt', 'inner\n')
    fs.writeFile('/home/guest/utf8.txt', 'caf\u00e9\n')
    fs.utimes('/home/guest/a.txt', MTIME)
    fs.utimes('/home/guest/b.txt', MTIME - 1000)
    fs.utimes('/home/guest/run.sh', MTIME - 2000)
    fs.utimes('/home/guest/.hidden', MTIME - 3000)
    fs.utimes('/home/guest/utf8.txt', MTIME - 4000)
    fs.utimes('/home/guest/sub', MTIME - 5000)
    fs.utimes('/home/guest/empty.txt', MTIME - 6000)
  })
  return fs
}

// ---- ls -----------------------------------------------------------------------------------------

test('ls lists one name per line when not a tty', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(r.out, 'a.txt\nb.txt\nempty.txt\nrun.sh\nsub\nutf8.txt\n')
})

test('ls -a and -A reveal hidden files', async () => {
  const fs = makeFs()
  const a = await exec(fs, ['ls', '-a'], { cwd: '/home/guest' })
  assert.ok(a.out.startsWith('.\n..\n'))
  assert.ok(a.out.includes('.hidden\n'))
  const A = await exec(fs, ['ls', '-A'], { cwd: '/home/guest' })
  assert.ok(A.out.includes('.hidden\n'))
  assert.ok(!A.out.startsWith('.\n'))
  const plain = await exec(fs, ['ls'], { cwd: '/home/guest' })
  assert.ok(!plain.out.includes('.hidden'))
})

test('ls -l prints GNU long format with total line', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', '-l'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  const lines = r.out.split('\n')
  assert.equal(lines[0], 'total 4')
  const date = fmtDate(MTIME)
  assert.ok(lines.some((l) => l === `-rw-r--r-- 1 guest guest  6 ${date} a.txt`))
  assert.ok(lines.some((l) => l === `-rwxr-xr-x 1 guest guest 20 ${fmtDate(MTIME - 2000)} run.sh`))
  assert.ok(lines.some((l) => l === `drwxr-xr-x 1 guest guest  0 ${fmtDate(MTIME - 5000)} sub`))
})

test('ls -l on an empty directory prints total 0', async () => {
  const fs = makeFs()
  fs.mkdir('/home/guest/empty-dir')
  const r = await exec(fs, ['ls', '-l', 'empty-dir'], { cwd: '/home/guest' })
  assert.equal(r.out, 'total 0\n')
})

test('ls -F appends indicators', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', '-F'], { cwd: '/home/guest' })
  assert.ok(r.out.includes('run.sh*\n'))
  assert.ok(r.out.includes('sub/\n'))
})

test('ls -i and -s print inode and block columns', async () => {
  const fs = makeFs()
  const i = await exec(fs, ['ls', '-i'], { cwd: '/home/guest' })
  const inames = i.out.trimEnd().split('\n').map((l) => /^\s*\d+\s+(.*)$/.exec(l)![1])
  assert.deepEqual(inames, ['a.txt', 'b.txt', 'empty.txt', 'run.sh', 'sub', 'utf8.txt'])
  assert.ok(i.out.trimEnd().split('\n').every((l) => /^\s*\d+\s+/.test(l)))
  const s = await exec(fs, ['ls', '-s'], { cwd: '/home/guest' })
  assert.equal(s.out, 'total 4\n1 a.txt\n1 b.txt\n0 empty.txt\n1 run.sh\n0 sub\n1 utf8.txt\n')
})

test('ls -r reverses, -S sorts by size, -t sorts by mtime', async () => {
  const fs = makeFs()
  const rev = await exec(fs, ['ls', '-r'], { cwd: '/home/guest' })
  const plain = await exec(fs, ['ls'], { cwd: '/home/guest' })
  assert.equal(rev.out, plain.out.split('\n').filter(Boolean).reverse().join('\n') + '\n')
  const bySize = await exec(fs, ['ls', '-S'], { cwd: '/home/guest' })
  const first = bySize.out.split('\n')[0]
  assert.equal(first, 'run.sh')
  const byTime = await exec(fs, ['ls', '-t'], { cwd: '/home/guest' })
  assert.equal(byTime.out.split('\n')[0], 'a.txt')
})

test('ls -d lists directory operands themselves', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', '-d', 'sub', 'a.txt'], { cwd: '/home/guest' })
  assert.equal(r.out, 'a.txt\nsub\n')
})

test('ls -R recurses with headers', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', '-R', 'sub'], { cwd: '/home/guest' })
  assert.equal(r.out, 'sub:\ninner.txt\n')
})

test('ls sorts operands and separates files before directory listings', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', 'sub', 'a.txt', 'b.txt'], { cwd: '/home/guest' })
  assert.equal(r.out, 'a.txt\nb.txt\n\nsub:\ninner.txt\n')
})

test('ls multi-column fills columns top-to-bottom', async () => {
  const fs = new VFS()
  fs.batch(() => {
    fs.mkdir('/cols', true)
    for (const n of ['aa', 'bb', 'cc', 'dd']) fs.writeFile(`/cols/${n}`, '')
  })
  const r = await exec(fs, ['ls', '/cols'], { tty: true, cols: 8 })
  assert.equal(r.out, 'aa  cc\nbb  dd\n')
})

test('ls --color=always colors directories and executables', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', '--color=always', '-d', 'sub', 'run.sh'], { cwd: '/home/guest' })
  assert.equal(r.out, 'run.sh\n\x1b[01;34msub\x1b[0m\n'.replace('run.sh', '\x1b[01;32mrun.sh\x1b[0m'))
})

test('ls invalid option and missing operand errors', async () => {
  const fs = makeFs()
  const bad = await exec(fs, ['ls', '-z'])
  assert.equal(bad.status, 2)
  assert.equal(bad.err, "ls: invalid option -- 'z'\nTry 'ls --help' for more information.\n")
  const missing = await exec(fs, ['ls', 'nope'])
  assert.equal(missing.status, 2)
  assert.ok(missing.err.includes("ls: cannot access 'nope': No such file or directory"))
})

test('ls --help prints usage', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ls', '--help'])
  assert.equal(r.status, 0)
  assert.ok(r.out.includes('Usage') === false && r.out.startsWith('ls [OPTION]'))
})

// ---- cat / tac -----------------------------------------------------------------------------------

test('cat prints files, reports missing files and continues', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['cat', 'a.txt', 'nope', 'b.txt'], { cwd: '/home/guest' })
  assert.equal(r.status, 1)
  assert.equal(r.out, 'hello\nworld\nworld\n')
  assert.equal(r.err, 'cat: nope: No such file or directory\n')
})

test('cat on a directory errors', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['cat', 'sub'], { cwd: '/home/guest' })
  assert.equal(r.status, 1)
  assert.equal(r.err, 'cat: sub: Is a directory\n')
})

test('cat -n -b -s -E -T -A', async () => {
  const fs = makeFs()
  const data = 'a\n\n\nb\tc\n'
  fs.writeFile('/home/guest/x.txt', data)
  const n = await exec(fs, ['cat', '-n', 'x.txt'])
  assert.equal(n.out, '     1\ta\n     2\t\n     3\t\n     4\tb\tc\n')
  const b = await exec(fs, ['cat', '-b', 'x.txt'])
  assert.equal(b.out, '     1\ta\n\n\n     2\tb\tc\n')
  const s = await exec(fs, ['cat', '-s', 'x.txt'])
  assert.equal(s.out, 'a\n\nb\tc\n')
  const E = await exec(fs, ['cat', '-E', 'x.txt'])
  assert.equal(E.out, 'a$\n$\n$\nb\tc$\n')
  const T = await exec(fs, ['cat', '-T', 'x.txt'])
  assert.equal(T.out, 'a\n\n\nb^Ic\n')
  const A = await exec(fs, ['cat', '-A', 'x.txt'])
  assert.equal(A.out, 'a$\n$\n$\nb^Ic$\n')
})

test('cat with - reads stdin', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['cat', '-'], { stdin: 'stdin-data\n' })
  assert.equal(r.out, 'stdin-data\n')
})

test('tac reverses lines', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['tac', 'a.txt', 'b.txt'], { cwd: '/home/guest' })
  assert.equal(r.out, 'hello\nworld\nworld\n')
})

// ---- head / tail ---------------------------------------------------------------------------------

test('head -n, -c, -N and negative counts', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['head', '-n', '1', 'a.txt'])).out, 'hello\n')
  assert.equal((await exec(fs, ['head', '-n1', 'a.txt'])).out, 'hello\n')
  assert.equal((await exec(fs, ['head', '-1', 'a.txt'])).out, 'hello\n')
  assert.equal((await exec(fs, ['head', '-c', '3', 'a.txt'])).out, 'hel')
  fs.writeFile('/home/guest/lines.txt', '1\n2\n3\n4\n5\n')
  assert.equal((await exec(fs, ['head', '-n', '-3', 'lines.txt'])).out, '1\n2\n')
  assert.equal((await exec(fs, ['head', '-c', '-2', 'lines.txt'])).out, '1\n2\n3\n4\n')
})

test('head prints headers for multiple files and honours -q', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['head', '-n', '1', 'a.txt', 'b.txt'])
  assert.equal(r.out, '==> a.txt <==\nhello\n\n==> b.txt <==\nworld\n')
  const q = await exec(fs, ['head', '-q', '-n', '1', 'a.txt', 'b.txt'])
  assert.equal(q.out, 'hello\nworld\n')
})

test('tail -n, -n +N, -c and -N', async () => {
  const fs = makeFs()
  fs.writeFile('/home/guest/lines.txt', '1\n2\n3\n4\n5\n')
  assert.equal((await exec(fs, ['tail', '-n', '2', 'lines.txt'])).out, '4\n5\n')
  assert.equal((await exec(fs, ['tail', '-n', '+4', 'lines.txt'])).out, '4\n5\n')
  assert.equal((await exec(fs, ['tail', '-2', 'lines.txt'])).out, '4\n5\n')
  assert.equal((await exec(fs, ['tail', '-c', '2', 'lines.txt'])).out, '5\n')
  assert.equal((await exec(fs, ['tail', '-n', '0', 'lines.txt'])).out, '')
})

test('head and tail error on missing files but continue', async () => {
  const fs = makeFs()
  const h = await exec(fs, ['head', 'nope', 'a.txt'])
  assert.equal(h.status, 1)
  assert.equal(h.err, "head: cannot open 'nope' for reading: No such file or directory\n")
  assert.equal(h.out, '==> a.txt <==\nhello\n')
  const t = await exec(fs, ['tail', 'nope'])
  assert.equal(t.status, 1)
  assert.ok(t.err.includes("tail: cannot open 'nope' for reading"))
})

// ---- touch / mkdir / rmdir / rm -------------------------------------------------------------------

test('touch creates and updates files', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['touch', 'new.txt'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.ok(fs.isFile('/home/guest/new.txt'))
  const c = await exec(fs, ['touch', '-c', 'never.txt'])
  assert.equal(c.status, 0)
  assert.ok(!fs.exists('/home/guest/never.txt'))
  const bad = await exec(fs, ['touch', '-d', 'not-a-date', 'a.txt'])
  assert.equal(bad.status, 1)
  assert.ok(bad.err.includes("touch: invalid date format 'not-a-date'"))
})

test('mkdir creates with -p and -v', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['mkdir', '-p', '-v', 'x/y/z'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.ok(fs.isDir('/home/guest/x/y/z'))
  assert.equal(r.out, "mkdir: created directory 'x/y/z'\n")
  const dup = await exec(fs, ['mkdir', 'x'])
  assert.equal(dup.status, 1)
  assert.ok(dup.err.includes("mkdir: cannot create directory 'x': File exists"))
})

test('rmdir removes empty dirs and -p removes ancestors', async () => {
  const fs = makeFs()
  fs.mkdir('/home/guest/r/a/b', true)
  const r = await exec(fs, ['rmdir', '-p', 'r/a/b'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.ok(!fs.exists('/home/guest/r'))
  const bad = await exec(fs, ['rmdir', 'sub'])
  assert.equal(bad.status, 1)
  assert.ok(bad.err.includes("rmdir: failed to remove 'sub': Directory not empty"))
})

test('rm removes files and directories, refuses . and /', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['rm', '-r', '-v', 'sub'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.ok(!fs.exists('/home/guest/sub'))
  assert.equal(r.out, "removed 'sub/inner.txt'\nremoved directory 'sub'\n")
  const dot = await exec(fs, ['rm', '.'])
  assert.equal(dot.status, 1)
  assert.equal(dot.err, "rm: refusing to remove '.' or '..' directory: skipping '.'\n")
  const root = await exec(fs, ['rm', '-r', '/'])
  assert.equal(root.status, 1)
  assert.ok(root.err.includes("rm: it is dangerous to operate recursively on '/'"))
  const dirNoR = await exec(fs, ['rm', 'sub2'])
  fs.mkdir('/home/guest/sub2')
  const d2 = await exec(fs, ['rm', 'sub2'])
  assert.equal(d2.status, 1)
  assert.ok(d2.err.includes("rm: cannot remove 'sub2': Is a directory"))
  const missing = await exec(fs, ['rm', '-f', 'nope'])
  assert.equal(missing.status, 0)
  assert.equal(missing.err, '')
})

// ---- cp / mv / ln --------------------------------------------------------------------------------

test('cp copies files, into directories and recurses', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['cp', '-v', 'a.txt', 'copy.txt'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(r.out, "'a.txt' -> 'copy.txt'\n")
  assert.equal(fs.readFile('/home/guest/copy.txt'), 'hello\n')
  const into = await exec(fs, ['cp', 'a.txt', 'sub'], { cwd: '/home/guest' })
  assert.equal(into.status, 0)
  assert.equal(fs.readFile('/home/guest/sub/a.txt'), 'hello\n')
  fs.mkdir('/home/guest/dir-src')
  fs.writeFile('/home/guest/dir-src/f.txt', 'x')
  const rec = await exec(fs, ['cp', '-r', 'dir-src', 'dir-dst'], { cwd: '/home/guest' })
  assert.equal(rec.status, 0)
  assert.equal(fs.readFile('/home/guest/dir-dst/f.txt'), 'x')
})

test('cp errors: dir without -r, same file, target not a directory', async () => {
  const fs = makeFs()
  const d = await exec(fs, ['cp', 'sub', 'x'], { cwd: '/home/guest' })
  assert.equal(d.status, 1)
  assert.equal(d.err, "cp: -r not specified; omitting directory 'sub'\n")
  const same = await exec(fs, ['cp', 'a.txt', 'a.txt'])
  assert.equal(same.status, 1)
  assert.equal(same.err, "cp: 'a.txt' and 'a.txt' are the same file\n")
  const multi = await exec(fs, ['cp', 'a.txt', 'b.txt', 'not-a-dir'])
  assert.equal(multi.status, 1)
  assert.ok(multi.err.includes("cp: target 'not-a-dir' is not a directory"))
  const noClobber = await exec(fs, ['cp', '-n', 'a.txt', 'b.txt'])
  assert.equal(noClobber.status, 0)
  assert.equal(fs.readFile('/home/guest/b.txt'), 'world\nworld\n')
})

test('mv renames and moves into directories', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['mv', '-v', 'a.txt', 'renamed.txt'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(r.out, "renamed 'a.txt' -> 'renamed.txt'\n")
  assert.ok(!fs.exists('/home/guest/a.txt'))
  const into = await exec(fs, ['mv', 'renamed.txt', 'sub'], { cwd: '/home/guest' })
  assert.equal(into.status, 0)
  assert.equal(fs.readFile('/home/guest/sub/renamed.txt'), 'hello\n')
  const multi = await exec(fs, ['mv', 'b.txt', 'empty.txt', 'nope-dir'])
  assert.equal(multi.status, 1)
  assert.ok(multi.err.includes("mv: target 'nope-dir' is not a directory"))
})

test('ln copies for hard links, errors for symlinks', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['ln', 'a.txt', 'hard.txt'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(fs.readFile('/home/guest/hard.txt'), 'hello\n')
  const s = await exec(fs, ['ln', '-s', 'a.txt', 'soft'])
  assert.equal(s.status, 1)
  assert.equal(s.err, 'ln: symbolic links are not supported on this filesystem\n')
})

// ---- stat / file ---------------------------------------------------------------------------------

test('stat -c prints requested fields', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['stat', '-c', '%n %s %a %A %F', 'a.txt'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(r.out, 'a.txt 6 644 -rw-r--r-- regular file')
  const d = await exec(fs, ['stat', '-c', '%F', 'sub'])
  assert.equal(d.out, 'directory')
})

test('stat default format contains the GNU fields', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['stat', 'a.txt'])
  assert.equal(r.status, 0)
  assert.ok(r.out.includes('  File: a.txt\n'))
  assert.ok(r.out.includes('  Size: 6'))
  assert.ok(r.out.includes('IO Block: 4096   regular file'))
  assert.ok(r.out.includes('Access: (0644/-rw-r--r--)'))
})

test('file detects types and shebangs', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['file', 'a.txt'])).out, 'a.txt: ASCII text\n')
  assert.equal((await exec(fs, ['file', 'empty.txt'])).out, 'empty.txt: empty\n')
  assert.equal((await exec(fs, ['file', 'sub'])).out, 'sub: directory\n')
  assert.equal((await exec(fs, ['file', 'run.sh'])).out, 'run.sh: Bourne-Again shell script, ASCII text executable\n')
  assert.equal((await exec(fs, ['file', 'utf8.txt'])).out, 'utf8.txt: UTF-8 Unicode text\n')
  assert.equal((await exec(fs, ['file', '-b', 'a.txt'])).out, 'ASCII text\n')
})

// ---- find ----------------------------------------------------------------------------------------

test('find -name, -type, -empty, -size and default print', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['find', '.', '-name', '*.txt'], { cwd: '/home/guest' })
  assert.equal(r.out, './a.txt\n./b.txt\n./empty.txt\n./sub/inner.txt\n./utf8.txt\n')
  const t = await exec(fs, ['find', '.', '-type', 'd'], { cwd: '/home/guest' })
  assert.equal(t.out, '.\n./sub\n')
  const e = await exec(fs, ['find', '.', '-empty'], { cwd: '/home/guest' })
  assert.equal(e.out, './empty.txt\n')
  const s = await exec(fs, ['find', '.', '-size', '+7c', '-size', '-20c'], { cwd: '/home/guest' })
  assert.equal(s.out, './b.txt\n')
})

test('find operators, parens and ! work', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['find', '.', '(', '-name', 'a.txt', '-o', '-name', 'b.txt', ')', '-print'], { cwd: '/home/guest' })
  assert.equal(r.out, './a.txt\n./b.txt\n')
  const not = await exec(fs, ['find', '.', '!', '-name', '*.txt', '-type', 'f'], { cwd: '/home/guest' })
  assert.equal(not.out, './.hidden\n./run.sh\n')
})

test('find -maxdepth and -mindepth', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['find', '.', '-maxdepth', '1', '-type', 'f'], { cwd: '/home/guest' })
  assert.ok(!r.out.includes('./sub/'))
  const m = await exec(fs, ['find', '.', '-mindepth', '1', '-type', 'f'], { cwd: '/home/guest' })
  assert.equal(m.out, './.hidden\n./a.txt\n./b.txt\n./empty.txt\n./run.sh\n./sub/inner.txt\n./utf8.txt\n')
})

test('find -print0 and -delete', async () => {
  const fs = makeFs()
  const p = await exec(fs, ['find', '.', '-name', 'a.txt', '-print0'], { cwd: '/home/guest' })
  assert.equal(p.out, './a.txt\0')
  const d = await exec(fs, ['find', '.', '-name', 'b.txt', '-delete'], { cwd: '/home/guest' })
  assert.equal(d.status, 0)
  assert.ok(!fs.exists('/home/guest/b.txt'))
})

test('find -exec with ; and + forms', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['find', '.', '-name', 'a.txt', '-exec', 'cat', '{}', ';'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(r.out, 'hello\n')
  const plus = await exec(fs, ['find', '.', '-name', '*.txt', '-exec', 'cat', '{}', '+'], { cwd: '/home/guest' })
  assert.ok(plus.out.includes('hello\n'))
  assert.ok(plus.out.includes('inner\n'))
})

test('find -mtime and -perm', async () => {
  const fs = makeFs()
  fs.writeFile('/home/guest/old.txt', 'old\n')
  fs.utimes('/home/guest/old.txt', Date.now() - 10 * 86400000)
  const m = await exec(fs, ['find', '.', '-mtime', '+1', '-name', 'old.txt'], { cwd: '/home/guest' })
  assert.equal(m.out, './old.txt\n')
  fs.chmod('/home/guest/empty.txt', 0o600)
  const p = await exec(fs, ['find', '.', '-perm', '600'], { cwd: '/home/guest' })
  assert.equal(p.out, './empty.txt\n')
})

test('find reports missing start paths', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['find', 'nope'])
  assert.equal(r.status, 1)
  assert.equal(r.err, "find: 'nope': No such file or directory\n")
})

// ---- du / df / tree ------------------------------------------------------------------------------

test('du -s, -a, -d and -c compute block counts', async () => {
  const fs = new VFS()
  fs.batch(() => {
    fs.mkdir('/du', true)
    fs.writeFile('/du/f.txt', '1234567890')
    fs.mkdir('/du/sub', true)
    fs.writeFile('/du/sub/g.txt', 'abc')
  })
  const s = await exec(fs, ['du', '-s', '/du'])
  assert.equal(s.out, '16\t/du\n')
  const a = await exec(fs, ['du', '-a', '/du'])
  assert.equal(a.out, '4\t/du/f.txt\n4\t/du/sub/g.txt\n8\t/du/sub\n16\t/du\n')
  const d = await exec(fs, ['du', '-d', '0', '/du'])
  assert.equal(d.out, '16\t/du\n')
  const c = await exec(fs, ['du', '-c', '-s', '/du/f.txt', '/du/sub'])
  assert.equal(c.out, '4\t/du/f.txt\n8\t/du/sub\n12\ttotal\n')
})

test('df prints a single vda1 line', async () => {
  const fs = new VFS()
  const r = await exec(fs, ['df'])
  assert.equal(r.status, 0)
  assert.ok(r.out.includes('/dev/vda1'))
  assert.ok(r.out.includes('1465'))
  const h = await exec(fs, ['df', '-h'])
  assert.ok(h.out.includes('1.4M'))
  assert.ok(h.out.includes('0%'))
})

test('tree prints glyphs and report', async () => {
  const fs = new VFS()
  fs.batch(() => {
    fs.mkdir('/tree', true)
    fs.writeFile('/tree/a', '')
    fs.mkdir('/tree/d', true)
    fs.writeFile('/tree/d/e', '')
  })
  const r = await exec(fs, ['tree', '/tree'])
  assert.equal(r.out, '/tree\n├── a\n└── d\n    └── e\n\n1 directory, 2 files\n')
  const d = await exec(fs, ['tree', '-d', '/tree'])
  assert.equal(d.out, '/tree\n└── d\n\n1 directory, 0 files\n')
  const L = await exec(fs, ['tree', '-L', '1', '/tree'])
  assert.equal(L.out, '/tree\n├── a\n└── d\n\n1 directory, 1 file\n')
})

// ---- basename / dirname / realpath / readlink ------------------------------------------------------

test('basename strips directory and suffix', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['basename', '/a/b/c.txt'])).out, 'c.txt\n')
  assert.equal((await exec(fs, ['basename', '/a/b/c.txt', '.txt'])).out, 'c\n')
  assert.equal((await exec(fs, ['basename', '-s', '.txt', 'c.txt'])).out, 'c\n')
  assert.equal((await exec(fs, ['basename', '-a', 'a.txt', 'b.txt'])).out, 'a.txt\nb.txt\n')
})

test('dirname prints parent directory', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['dirname', '/a/b/c'])).out, '/a/b\n')
  assert.equal((await exec(fs, ['dirname', 'c'])).out, '.\n')
  assert.equal((await exec(fs, ['dirname', '/'])).out, '/\n')
})

test('realpath -e, -m and default checks', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['realpath', 'a.txt'])).out, '/home/guest/a.txt\n')
  assert.equal((await exec(fs, ['realpath', '-m', 'missing/path'])).out, '/home/guest/missing/path\n')
  const e = await exec(fs, ['realpath', '-e', 'missing'])
  assert.equal(e.status, 1)
  assert.ok(e.err.includes("realpath: 'missing': No such file or directory"))
})

test('readlink -f resolves like realpath', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['readlink', '-f', 'sub/../a.txt'])).out, '/home/guest/a.txt\n')
})

// ---- chmod / mktemp / truncate ---------------------------------------------------------------------

test('chmod octal and symbolic modes', async () => {
  const fs = makeFs()
  const o = await exec(fs, ['chmod', '600', 'a.txt'])
  assert.equal(o.status, 0)
  assert.equal(fs.stat('/home/guest/a.txt').mode & 0o777, 0o600)
  const sym = await exec(fs, ['chmod', 'u+x,g-w,o=r', 'a.txt'])
  assert.equal(sym.status, 0)
  assert.equal(fs.stat('/home/guest/a.txt').mode & 0o777, 0o704)
  const plus = await exec(fs, ['chmod', '+x', 'empty.txt'])
  assert.equal(fs.stat('/home/guest/empty.txt').mode & 0o111, 0o111)
})

test('chmod -R -v and invalid mode', async () => {
  const fs = makeFs()
  fs.mkdir('/home/guest/rec')
  fs.writeFile('/home/guest/rec/f', '')
  const r = await exec(fs, ['chmod', '-R', '-v', '700', 'rec'])
  assert.equal(r.status, 0)
  assert.equal(fs.stat('/home/guest/rec/f').mode & 0o777, 0o700)
  assert.ok(r.out.includes("mode of 'rec/f' changed from 0644 (rw-r--r--) to 0700 (rwx------)"))
  const bad = await exec(fs, ['chmod', 'x', 'a.txt'])
  assert.equal(bad.status, 1)
  assert.equal(bad.err, "chmod: invalid mode: 'x'\n")
})

test('mktemp creates files and dirs from templates', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['mktemp', '/tmp/xx.XXXXXX'])
  assert.equal(r.status, 0)
  const path = r.out.trim()
  assert.match(path, /^\/tmp\/xx\.[A-Za-z0-9]{6}$/)
  assert.ok(fs.isFile(path))
  const d = await exec(fs, ['mktemp', '-d', '/tmp/dd.XXXXXX'])
  assert.ok(fs.isDir(d.out.trim()))
  const bad = await exec(fs, ['mktemp', 'no-xs'])
  assert.equal(bad.status, 1)
  assert.ok(bad.err.includes("mktemp: too few X's in template 'no-xs'"))
})

test('truncate -s sets file size', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['truncate', '-s', '10', 'a.txt'])
  assert.equal(r.status, 0)
  assert.equal(fs.readFile('/home/guest/a.txt'), 'hello\n\0\0\0\0')
  const shrink = await exec(fs, ['truncate', '-s', '2', 'a.txt'])
  assert.equal(fs.readFile('/home/guest/a.txt'), 'he')
})

// ---- chown / chgrp / sync / dd / cmp ----------------------------------------------------------------

test('chown, chgrp and sync are silent no-ops', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['chown', 'root', 'a.txt'])).status, 0)
  assert.equal((await exec(fs, ['chgrp', 'root', 'a.txt'])).status, 0)
  assert.equal((await exec(fs, ['sync'])).status, 0)
})

test('dd copies with if/of/bs/count and prints records to stderr', async () => {
  const fs = makeFs()
  fs.writeFile('/home/guest/in.bin', 'abcdefghij')
  const r = await exec(fs, ['dd', 'if=in.bin', 'of=out.bin', 'bs=4', 'count=2'], { cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(fs.readFile('/home/guest/out.bin'), 'abcdefgh')
  assert.ok(r.err.includes('2+0 records in\n2+0 records out\n'))
  assert.ok(r.err.includes('8 bytes copied'))
  const none = await exec(fs, ['dd', 'if=in.bin', 'of=out2.bin', 'status=none'], { cwd: '/home/guest' })
  assert.equal(none.err, '')
  assert.equal(fs.readFile('/home/guest/out2.bin'), 'abcdefghij')
})

test('dd reads stdin when no if given', async () => {
  const fs = makeFs()
  const r = await exec(fs, ['dd', 'of=out.bin', 'status=none'], { stdin: 'hello', cwd: '/home/guest' })
  assert.equal(r.status, 0)
  assert.equal(fs.readFile('/home/guest/out.bin'), 'hello')
})

test('cmp reports equal, differing and missing files', async () => {
  const fs = makeFs()
  assert.equal((await exec(fs, ['cmp', 'a.txt', 'a.txt'])).status, 0)
  fs.writeFile('/home/guest/c1', 'aa\nbb\n')
  fs.writeFile('/home/guest/c2', 'aa\nbc\n')
  const diff = await exec(fs, ['cmp', 'c1', 'c2'])
  assert.equal(diff.status, 1)
  assert.equal(diff.out, 'c1 c2 differ: byte 5, line 2\n')
  const missing = await exec(fs, ['cmp', 'c1', 'nope'])
  assert.equal(missing.status, 2)
  assert.equal(missing.err, 'cmp: nope: No such file or directory\n')
})

// ---- module metadata ------------------------------------------------------------------------------

test('info covers every command and every command has info', async () => {
  const names = Object.keys(commands)
  for (const name of names) {
    assert.ok(info[name], `missing info for ${name}`)
    assert.ok(info[name].summary.length > 0)
    assert.ok(info[name].usage.length > 0)
  }
  assert.ok(names.includes('ls'))
  assert.ok(names.includes('find'))
  assert.ok(!names.includes('pwd'))
})
