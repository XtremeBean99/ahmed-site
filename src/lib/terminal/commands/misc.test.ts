import test from 'node:test'
import assert from 'node:assert/strict'
import { VFS, FsError } from '../vfs'
import { seedFs, HOME } from '../seed'
import type { CmdCtx, ExecResult } from '../types'
import { Stdin } from '../types'
import { commands, info } from './misc'

interface EditCall {
  kind: string
  path: string
  opts?: { readOnly?: boolean; lineNumbers?: boolean }
  content: string | null
}

const DEFAULT_NAMES = [
  'apt', 'apt-get', 'apropos', 'arch', 'at', 'bash', 'bc', 'cal', 'cat', 'changelog',
  'chsh', 'clear', 'clock', 'compgen', 'crontab', 'curl', 'date', 'dmesg', 'dig', 'dl',
  'download', 'echo', 'env', 'fdisk', 'free', 'git', 'groups', 'halt', 'host', 'hostname',
  'htop', 'id', 'ifconfig', 'ip', 'kill', 'last', 'less', 'locale', 'logname', 'ls', 'lsblk',
  'lscpu', 'lsb_release', 'mesg', 'mkfs', 'more', 'most', 'mount', 'nano', 'netstat',
  'nproc', 'nslookup', 'nvim', 'open', 'passwd', 'pgrep', 'ping', 'pkill', 'poweroff',
  'printenv', 'ps', 'reboot', 'reset', 'scp', 'screen', 'service', 'sfx', 'sh', 'shutdown',
  'sleep', 'ssh', 'stty', 'su', 'sudo', 'systemctl', 'sftp', 'tmux', 'top', 'tput', 'tty',
  'umount', 'uname', 'uptime', 'users', 'vi', 'view', 'vim', 'w', 'watch', 'wget', 'whatis',
  'whereis', 'who', 'whoami', 'xdg-open', 'yes',
].sort()

function makeCtx(opts: {
  fs?: VFS
  cwd?: string
  env?: Record<string, string>
  isTTY?: boolean
  names?: string[]
  stdinData?: string
  exec?: (argv: string[], stdin: string | undefined, env: Record<string, string>) => Promise<ExecResult> | ExecResult
} = {}) {
  const fs = opts.fs ?? seedFs('readme\n', 'changes\n')
  const env = opts.env ?? { HOME, USER: 'guest', PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TERM: 'xterm-256color' }
  const outChunks: string[] = []
  const errChunks: string[] = []
  const edits: EditCall[] = []
  const downloads: [string, string][] = []
  const sfx: boolean[] = []
  let clears = 0
  const ac = new AbortController()
  const ctx: CmdCtx = {
    argv0: '',
    args: [],
    stdin: new Stdin(opts.stdinData ?? ''),
    out: (s) => { outChunks.push(s) },
    err: (s) => { errChunks.push(s) },
    fs,
    cwd: opts.cwd ?? HOME,
    env,
    io: {
      write: (s) => { outChunks.push(s) },
      clear: () => { clears++ },
      readLine: async () => null,
      edit: async (kind, path, o) => {
        let content: string | null = null
        try { content = path ? fs.readFile(path) : null } catch { content = null }
        edits.push({ kind, path, opts: o, content })
      },
      exit: () => {},
      download: (name, data) => { downloads.push([name, data]) },
      setSfx: (on) => { sfx.push(on) },
      size: () => ({ cols: 80, rows: 24 }),
    },
    signal: ac.signal,
    resolve: (p) => VFS.resolve(ctx.cwd, p, HOME),
    exec: (argv, stdin) => opts.exec ? Promise.resolve(opts.exec(argv, stdin, { ...env })) : Promise.resolve({ status: 0, out: '', err: '' }),
    runScript: async () => 0,
    isTTYOut: opts.isTTY ?? true,
    commandNames: () => opts.names ?? DEFAULT_NAMES,
    history: [],
  }
  const run = (name: string, args: string[]): Promise<number> => {
    outChunks.length = 0
    errChunks.length = 0
    ctx.argv0 = name
    ctx.args = args
    return Promise.resolve(commands[name](ctx))
  }
  return {
    ctx, fs, env, run,
    out: () => outChunks.join(''),
    err: () => errChunks.join(''),
    edits, downloads, sfx,
    clears: () => clears,
    abort: () => ac.abort(),
  }
}

test('every command has an info entry', () => {
  for (const name of Object.keys(commands)) {
    assert.ok(info[name], `missing info for ${name}`)
    assert.ok(info[name].summary.length > 0)
    assert.ok(info[name].usage.length > 0)
  }
})

test('nano launcher delegates to the host editor', async () => {
  const t = makeCtx()
  assert.equal(await t.run('nano', ['file.txt']), 0)
  assert.equal(t.edits.length, 1)
  assert.equal(t.edits[0].kind, 'nano')
  assert.equal(t.edits[0].path, HOME + '/file.txt')
  assert.deepEqual(t.edits[0].opts, { lineNumbers: false })

  assert.equal(await t.run('nano', ['-l', 'notes.txt']), 0)
  assert.equal(t.edits[1].path, HOME + '/notes.txt')
  assert.deepEqual(t.edits[1].opts, { lineNumbers: true })

  assert.equal(await t.run('nano', ['+12', 'a.txt']), 0)
  assert.equal(t.edits[2].path, HOME + '/a.txt')

  assert.equal(await t.run('nano', []), 0)
  assert.equal(t.edits[3].path, '')

  assert.equal(await t.run('pico', ['p.txt']), 0)
  assert.equal(t.edits[4].kind, 'nano')
  assert.equal(t.edits[4].path, HOME + '/p.txt')

  assert.equal(await t.run('edit', ['e.txt']), 0)
  assert.equal(t.edits[5].kind, 'nano')
  assert.equal(t.edits[5].path, HOME + '/e.txt')
})

test('nano directory operand errors', async () => {
  const t = makeCtx()
  t.fs.mkdir(HOME + '/docs')
  assert.equal(await t.run('nano', ['docs']), 1)
  assert.equal(t.err(), 'Error reading docs: Is a directory\n')
  assert.equal(t.edits.length, 0)
})

test('vim family delegates with readOnly flags', async () => {
  const t = makeCtx()
  assert.equal(await t.run('vim', ['f.txt']), 0)
  assert.deepEqual(t.edits[0], { kind: 'vim', path: HOME + '/f.txt', opts: { readOnly: false }, content: null })
  assert.equal(await t.run('vi', ['f.txt']), 0)
  assert.equal(t.edits[1].kind, 'vim')
  assert.deepEqual(t.edits[1].opts, { readOnly: false })
  assert.equal(await t.run('nvim', ['f.txt']), 0)
  assert.deepEqual(t.edits[2].opts, { readOnly: false })
  assert.equal(await t.run('ex', ['f.txt']), 0)
  assert.deepEqual(t.edits[3].opts, { readOnly: false })
  assert.equal(await t.run('view', ['f.txt']), 0)
  assert.deepEqual(t.edits[4].opts, { readOnly: true })
})

test('pagers open files read-only or act like cat when piped', async () => {
  const t = makeCtx()
  t.fs.writeFile(HOME + '/f.txt', 'hello\n')
  assert.equal(await t.run('less', ['f.txt']), 0)
  assert.equal(t.edits[0].kind, 'less')
  assert.equal(t.edits[0].path, HOME + '/f.txt')
  assert.deepEqual(t.edits[0].opts, { readOnly: true })
  assert.equal(await t.run('more', ['f.txt']), 0)
  assert.equal(await t.run('most', ['f.txt']), 0)

  const cat = makeCtx({ isTTY: false })
  cat.fs.writeFile(HOME + '/f.txt', 'hello\n')
  assert.equal(await cat.run('less', ['f.txt']), 0)
  assert.equal(cat.out(), 'hello\n')
  assert.equal(cat.edits.length, 0)

  const piped = makeCtx({ isTTY: false, stdinData: 'a\nb\n' })
  assert.equal(await piped.run('less', []), 0)
  assert.equal(piped.out(), 'a\nb\n')
})

test('less with piped stdin uses and deletes a temp file', async () => {
  const t = makeCtx({ stdinData: 'piped data\n' })
  assert.equal(await t.run('less', []), 0)
  assert.equal(t.edits.length, 1)
  assert.equal(t.edits[0].kind, 'less')
  assert.match(t.edits[0].path, /^\/tmp\/\.pager-/)
  assert.equal(t.edits[0].content, 'piped data\n')
  assert.equal(t.fs.exists(t.edits[0].path), false)
})

test('less error paths', async () => {
  const t = makeCtx()
  assert.equal(await t.run('less', ['nope.txt']), 1)
  assert.equal(t.err(), 'less: nope.txt: No such file or directory\n')
  t.fs.mkdir(HOME + '/docs')
  assert.equal(await t.run('less', ['docs']), 1)
  assert.equal(t.err(), 'less: docs: Is a directory\n')
})

test('date default and strftime formats', async () => {
  const t = makeCtx()
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00']), 0)
  assert.equal(t.out(), 'Fri Sep 25 10:30:00 UTC 2026\n')

  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%F']), 0)
  assert.equal(t.out(), '2026-09-25\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%T']), 0)
  assert.equal(t.out(), '10:30:00\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%Y-%m-%d']), 0)
  assert.equal(t.out(), '2026-09-25\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%a %A %b %B %y']), 0)
  assert.equal(t.out(), 'Fri Friday Sep September 26\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%j']), 0)
  assert.equal(t.out(), '268\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%p %I']), 0)
  assert.equal(t.out(), 'AM 10\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%z']), 0)
  assert.equal(t.out(), '+0000\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%s']), 0)
  assert.equal(t.out(), '1790332200\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '+%u %w %U']), 0)
  assert.equal(t.out(), '5 5 38\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '-I']), 0)
  assert.equal(t.out(), '2026-09-25\n')
  assert.equal(await t.run('date', ['-u', '-d', '2026-09-25 10:30:00', '-R']), 0)
  assert.equal(t.out(), 'Fri, 25 Sep 2026 10:30:00 +0000\n')
})

test('date -d string forms', async () => {
  const t = makeCtx()
  assert.equal(await t.run('date', ['-u', '-d', '@1700000000', '+%F']), 0)
  assert.equal(t.out(), '2023-11-14\n')
  assert.equal(await t.run('date', ['-u', '-d', '@1700000000']), 0)
  assert.equal(t.out(), 'Tue Nov 14 22:13:20 UTC 2023\n')
  assert.equal(await t.run('date', ['-d', '2026-09-25', '+%F']), 0)
  assert.equal(t.out(), '2026-09-25\n')
  assert.equal(await t.run('date', ['-u', '-d', 'tomorrow', '+%F']), 0)
  const tomorrow = new Date(Date.now() + 86400000)
  assert.equal(t.out(), `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}\n`)
  assert.equal(await t.run('date', ['-u', '-d', 'yesterday', '+%F']), 0)
  const yesterday = new Date(Date.now() - 86400000)
  assert.equal(t.out(), `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}\n`)
  assert.equal(await t.run('date', ['-u', '-d', '3 days ago', '+%F']), 0)
  const ago = new Date(Date.now() - 3 * 86400000)
  assert.equal(t.out(), `${ago.getUTCFullYear()}-${String(ago.getUTCMonth() + 1).padStart(2, '0')}-${String(ago.getUTCDate()).padStart(2, '0')}\n`)
  assert.equal(await t.run('date', ['-d', 'not a date']), 1)
  assert.equal(t.err(), "date: invalid date 'not a date'\n")
})

test('cal layouts for known months', async () => {
  const t = makeCtx({ isTTY: false })
  assert.equal(await t.run('cal', ['2', '2026']), 0)
  assert.equal(t.out(), [
    '   February 2026',
    'Su Mo Tu We Th Fr Sa',
    ' 1  2  3  4  5  6  7',
    ' 8  9 10 11 12 13 14',
    '15 16 17 18 19 20 21',
    '22 23 24 25 26 27 28',
    '',
  ].join('\n'))

  assert.equal(await t.run('cal', ['9', '2026']), 0)
  assert.equal(t.out(), [
    '   September 2026',
    'Su Mo Tu We Th Fr Sa',
    '       1  2  3  4  5',
    ' 6  7  8  9 10 11 12',
    '13 14 15 16 17 18 19',
    '20 21 22 23 24 25 26',
    '27 28 29 30',
    '',
  ].join('\n'))

  assert.equal(await t.run('cal', ['2', '2028']), 0)
  assert.equal(t.out(), [
    '   February 2028',
    'Su Mo Tu We Th Fr Sa',
    '       1  2  3  4  5',
    ' 6  7  8  9 10 11 12',
    '13 14 15 16 17 18 19',
    '20 21 22 23 24 25 26',
    '27 28 29',
    '',
  ].join('\n'))
})

test('cal -m and validation', async () => {
  const t = makeCtx({ isTTY: false })
  assert.equal(await t.run('cal', ['-m', '9', '2026']), 0)
  assert.equal(t.out(), [
    '   September 2026',
    'Mo Tu We Th Fr Sa Su',
    '    1  2  3  4  5  6',
    ' 7  8  9 10 11 12 13',
    '14 15 16 17 18 19 20',
    '21 22 23 24 25 26 27',
    '28 29 30',
    '',
  ].join('\n'))
  assert.equal(await t.run('cal', ['13', '2026']), 1)
  assert.equal(t.err(), 'cal: 13 is not a month number (1..12)\n')
  assert.equal(await t.run('cal', ['-y', '2026']), 0)
  assert.ok(t.out().includes('2026'))
  assert.ok(t.out().includes('January'))
  assert.ok(t.out().includes('December'))
  assert.equal(await t.run('cal', ['-3', '9', '2026']), 0)
  assert.ok(t.out().includes('August 2026'))
  assert.ok(t.out().includes('September 2026'))
  assert.ok(t.out().includes('October 2026'))
})

test('env and printenv', async () => {
  const t = makeCtx()
  assert.equal(await t.run('printenv', ['HOME']), 0)
  assert.equal(t.out(), HOME + '\n')
  assert.equal(await t.run('printenv', ['NOPE']), 1)
  assert.equal(t.out(), '')
  assert.equal(await t.run('env', []), 0)
  assert.ok(t.out().includes(`HOME=${HOME}\n`))
  assert.ok(t.out().includes('USER=guest\n'))
  assert.ok(t.out().includes('PATH=/usr/bin:/bin\n'))

  assert.equal(await t.run('env', ['FOO=bar']), 0)
  assert.ok(t.out().includes('FOO=bar\n'))
  assert.ok(t.out().includes(`HOME=${HOME}\n`))
})

test('env runs commands with a modified environment', async () => {
  const t = makeCtx({
    exec: (argv, _stdin, env) => {
      if (argv[0] === 'printenv' && argv[1]) {
        return { status: env[argv[1]] !== undefined ? 0 : 1, out: env[argv[1]] !== undefined ? env[argv[1]] + '\n' : '', err: '' }
      }
      return { status: 0, out: '', err: '' }
    },
  })
  assert.equal(await t.run('env', ['FOO=bar', 'printenv', 'FOO']), 0)
  assert.equal(t.out(), 'bar\n')
  assert.equal(t.env.FOO, undefined)

  assert.equal(await t.run('env', ['-u', 'USER', 'printenv', 'USER']), 1)
  assert.equal(t.out(), '')
  assert.equal(t.env.USER, 'guest')

  assert.equal(await t.run('env', ['-i', 'FOO=x', 'printenv', 'PATH']), 1)
  assert.equal(t.out(), '')
  assert.equal(t.env.PATH, '/usr/bin:/bin')
})

test('identity and system info commands', async () => {
  const t = makeCtx()
  assert.equal(await t.run('whoami', []), 0)
  assert.equal(t.out(), 'guest\n')
  assert.equal(await t.run('id', []), 0)
  assert.equal(t.out(), 'uid=1000(guest) gid=1000(guest) groups=1000(guest)\n')
  assert.equal(await t.run('id', ['-u']), 0)
  assert.equal(t.out(), '1000\n')
  assert.equal(await t.run('id', ['-g']), 0)
  assert.equal(t.out(), '1000\n')
  assert.equal(await t.run('id', ['-un']), 0)
  assert.equal(t.out(), 'guest\n')
  assert.equal(await t.run('groups', []), 0)
  assert.equal(t.out(), 'guest\n')
  assert.equal(await t.run('hostname', []), 0)
  assert.equal(t.out(), 'ahmed\n')
  assert.equal(await t.run('uname', []), 0)
  assert.equal(t.out(), 'Linux\n')
  assert.equal(await t.run('uname', ['-a']), 0)
  assert.equal(t.out(), 'Linux ahmed 6.8.0-ahmed #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n')
  assert.equal(await t.run('uname', ['-s', '-m']), 0)
  assert.equal(t.out(), 'Linux x86_64\n')
  assert.equal(await t.run('nproc', []), 0)
  assert.equal(t.out(), '4\n')
  assert.equal(await t.run('arch', []), 0)
  assert.equal(t.out(), 'x86_64\n')
  assert.equal(await t.run('tty', []), 0)
  assert.equal(t.out(), '/dev/pts/0\n')
  assert.equal(await t.run('logname', []), 0)
  assert.equal(t.out(), 'guest\n')
  assert.equal(await t.run('users', []), 0)
  assert.equal(t.out(), 'guest\n')
  assert.equal(await t.run('mesg', []), 0)
  assert.equal(t.out(), 'is y\n')
})

test('uptime, w, who, last formats', async () => {
  const t = makeCtx()
  assert.equal(await t.run('uptime', []), 0)
  assert.match(t.out(), /up \d+ min,  1 user,  load average: 0\.00, 0\.01, 0\.05\n$/)
  assert.equal(await t.run('w', []), 0)
  assert.ok(t.out().includes('USER     TTY      FROM'))
  assert.ok(t.out().includes('load average: 0.00, 0.01, 0.05'))
  assert.ok(t.out().includes('bash'))
  assert.equal(await t.run('who', []), 0)
  assert.match(t.out(), /^guest    pts\/0        .* \(browser\)\n$/)
  assert.equal(await t.run('last', []), 0)
  assert.ok(t.out().includes('still logged in'))
})

test('free -h and -m', async () => {
  const t = makeCtx()
  assert.equal(await t.run('free', []), 0)
  assert.ok(t.out().includes('Mem:'))
  assert.ok(t.out().includes('Swap:'))
  assert.ok(t.out().includes('8042044'))
  assert.equal(await t.run('free', ['-m']), 0)
  assert.ok(t.out().includes('7854'))
  assert.equal(await t.run('free', ['-h']), 0)
  assert.ok(t.out().includes('Gi'))
})

test('ps lists bash and ps with stable pids', async () => {
  const t = makeCtx()
  assert.equal(await t.run('ps', []), 0)
  assert.ok(t.out().includes('PID TTY'))
  assert.ok(t.out().includes('bash'))
  assert.ok(t.out().includes(' ps\n'))
  assert.equal(await t.run('ps', ['aux']), 0)
  assert.ok(t.out().includes('USER       PID'))
  assert.ok(t.out().includes('bash'))
  assert.ok(t.out().includes('ps aux'))
  assert.equal(await t.run('ps', ['-ef']), 0)
  assert.ok(t.out().includes('UID        PID  PPID'))
  assert.ok(t.out().includes('ps -ef'))
})

test('top and htop print one snapshot', async () => {
  const t = makeCtx()
  assert.equal(await t.run('top', []), 0)
  assert.ok(t.out().includes('load average: 0.00, 0.01, 0.05'))
  assert.ok(t.out().includes('Tasks:'))
  assert.ok(t.out().includes('bash'))
  assert.equal(await t.run('htop', []), 0)
  assert.ok(t.out().includes('Mem['))
  assert.ok(t.out().includes('Command'))
})

test('kill, pgrep, pkill', async () => {
  const t = makeCtx()
  assert.equal(await t.run('kill', ['-l']), 0)
  assert.ok(t.out().includes('SIGHUP'))
  assert.ok(t.out().includes('SIGKILL'))
  assert.equal(await t.run('kill', ['9999']), 1)
  assert.equal(t.err(), 'bash: kill: (9999) - No such process\n')
  assert.equal(await t.run('kill', ['abc']), 2)
  assert.ok(t.err().includes('arguments must be process or job IDs'))
  assert.equal(await t.run('pgrep', ['bash']), 1)
  assert.equal(t.out(), '')
  assert.equal(await t.run('pkill', ['bash']), 1)
  assert.equal(t.out(), '')
})

test('sleep parses durations and aborts', async () => {
  const t = makeCtx()
  assert.equal(await t.run('sleep', ['0.01']), 0)
  assert.equal(await t.run('sleep', ['x']), 1)
  assert.equal(t.err(), "sleep: invalid time interval 'x'\n")
  assert.equal(await t.run('sleep', []), 1)
  assert.ok(t.err().includes('sleep: missing operand'))

  const a = makeCtx()
  const p = a.run('sleep', ['10'])
  await new Promise((r) => setTimeout(r, 20))
  a.abort()
  assert.equal(await p, 130)
})

test('yes emits joined args capped at 20000 lines', async () => {
  const t = makeCtx()
  assert.equal(await t.run('yes', ['a', 'b']), 0)
  const lines = t.out().split('\n')
  assert.equal(lines[0], 'a b')
  assert.equal(lines.length - 1, 20000)
  assert.equal(lines[19999], 'a b')
})

test('timeout runs commands and enforces the deadline', async () => {
  const t = makeCtx({ exec: () => ({ status: 3, out: 'child out\n', err: 'child err\n' }) })
  assert.equal(await t.run('timeout', ['1', 'sh', '-c', 'exit 3']), 3)
  assert.equal(t.out(), 'child out\n')
  assert.equal(t.err(), 'child err\n')

  const slow = makeCtx({ exec: () => new Promise((r) => setTimeout(() => r({ status: 0, out: '', err: '' }), 80)) })
  assert.equal(await slow.run('timeout', ['0.02', 'sleep', '1']), 124)

  const bad = makeCtx()
  assert.equal(await bad.run('timeout', ['x', 'echo']), 125)
  assert.ok(bad.err().includes("timeout: invalid time interval 'x'"))
})

test('watch runs a command three times with a header', async () => {
  const t = makeCtx({ exec: () => ({ status: 0, out: 'hi\n', err: '' }) })
  assert.equal(await t.run('watch', ['-n', '0.01', 'echo', 'hi']), 0)
  assert.equal(t.out().split('hi\n').length - 1, 3)
  assert.ok(t.out().includes('Every 0.0s: echo hi'))
  assert.ok(t.out().includes('ahmed:'))
})

test('clear and reset clear the terminal', async () => {
  const t = makeCtx()
  assert.equal(await t.run('clear', []), 0)
  assert.equal(t.clears(), 1)
  assert.equal(await t.run('reset', []), 0)
  assert.equal(t.clears(), 2)
})

test('tput and stty capabilities', async () => {
  const t = makeCtx()
  assert.equal(await t.run('tput', ['cols']), 0)
  assert.equal(t.out(), '80')
  assert.equal(await t.run('tput', ['lines']), 0)
  assert.equal(t.out(), '24')
  assert.equal(await t.run('tput', ['colors']), 0)
  assert.equal(t.out(), '256')
  assert.equal(await t.run('tput', ['bold']), 0)
  assert.equal(t.out(), '\x1b[1m')
  assert.equal(await t.run('tput', ['sgr0']), 0)
  assert.equal(t.out(), '\x1b[0m')
  assert.equal(await t.run('tput', ['setaf', '1']), 0)
  assert.equal(t.out(), '\x1b[31m')
  assert.equal(await t.run('stty', ['size']), 0)
  assert.equal(t.out(), '24 80\n')
})

test('network commands print fake failures', async () => {
  const t = makeCtx()
  assert.equal(await t.run('curl', ['-V']), 0)
  assert.ok(t.out().includes('curl 8.5.0'))
  assert.equal(await t.run('curl', ['http://example.com/x']), 6)
  assert.equal(t.err(), 'curl: (6) Could not resolve host: example.com\n')
  assert.equal(await t.run('wget', ['http://example.com/x']), 4)
  assert.ok(t.err().includes('failed: Temporary failure in name resolution.'))
  assert.equal(await t.run('ssh', ['example.com']), 255)
  assert.equal(t.err(), 'ssh: connect to host example.com port 22: Connection refused\n')
  assert.equal(await t.run('scp', ['example.com:file']), 255)
  assert.equal(t.err(), 'scp: connect to host example.com port 22: Connection refused\n')
  assert.equal(await t.run('sftp', ['example.com']), 255)
  assert.ok(t.err().includes('sftp: connect to host'))
  assert.equal(await t.run('dig', ['example.com']), 1)
  assert.equal(t.err(), 'connection timed out; no servers could be reached\n')
  assert.equal(await t.run('nslookup', ['example.com']), 1)
  assert.ok(t.err().includes('no servers could be reached'))
  assert.equal(await t.run('host', ['example.com']), 1)
  assert.ok(t.err().includes('no servers could be reached'))
})

test('ping prints fake replies and rejects unknown hosts', async () => {
  const t = makeCtx()
  assert.equal(await t.run('ping', ['foo']), 2)
  assert.equal(t.err(), 'ping: foo: Name or service not known\n')
  assert.equal(await t.run('ping', ['-c', '1', 'example.com']), 0)
  const out = t.out()
  assert.match(out, /^PING example\.com \(\d+\.\d+\.\d+\.\d+\) 56\(84\) bytes of data\.\n/)
  assert.match(out, /64 bytes from \d+\.\d+\.\d+\.\d+: icmp_seq=1 ttl=57 time=\d+\.\d ms\n/)
  assert.ok(out.includes('1 packets transmitted, 1 received, 0% packet loss'))
  assert.equal(await t.run('ping', ['-c', '1', 'localhost']), 0)
  assert.ok(t.out().includes('PING localhost (127.0.0.1)'))
})

test('git version, init, status, unsupported subcommands', async () => {
  const t = makeCtx()
  assert.equal(await t.run('git', ['--version']), 0)
  assert.equal(t.out(), 'git version 2.43.0\n')
  assert.equal(await t.run('git', ['status']), 128)
  assert.equal(t.err(), 'fatal: not a git repository (or any of the parent directories): .git\n')
  assert.equal(await t.run('git', ['init']), 0)
  assert.equal(t.out(), `Initialized empty Git repository in ${HOME}/.git/\n`)
  assert.equal(t.fs.isDir(HOME + '/.git'), true)
  assert.equal(await t.run('git', ['status']), 0)
  assert.ok(t.out().includes('On branch main'))
  assert.ok(t.out().includes('No commits yet'))
  assert.equal(await t.run('git', ['log']), 1)
  assert.equal(t.err(), "git: 'log' is not supported in this sandbox\n")
  assert.equal(await t.run('git', []), 1)
  assert.ok(t.err().includes('usage: git'))
})

test('apt prints the dpkg lock error', async () => {
  const t = makeCtx()
  assert.equal(await t.run('apt', ['update']), 100)
  assert.equal(t.err(), 'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n')
  assert.equal(await t.run('apt-get', ['install', 'x']), 100)
  assert.equal(t.err(), 'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n')
})

test('sudo, su, passwd, chsh messages', async () => {
  const t = makeCtx()
  assert.equal(await t.run('sudo', ['ls']), 1)
  assert.equal(t.err(), 'guest is not in the sudoers file.  This incident will be reported.\n')
  assert.equal(await t.run('sudo', ['-l']), 1)
  assert.equal(t.err(), 'Sorry, user guest may not run sudo on ahmed.\n')
  assert.equal(await t.run('sudo', ['-v']), 1)
  assert.equal(t.err(), 'Sorry, user guest may not run sudo on ahmed.\n')
  assert.equal(await t.run('su', []), 1)
  assert.equal(t.err(), 'su: Authentication failure\n')
  assert.equal(await t.run('passwd', []), 1)
  assert.equal(t.err(), 'passwd: Authentication token manipulation error\n')
  assert.equal(await t.run('chsh', []), 1)
  assert.equal(t.err(), 'chsh: PAM: Authentication failure\n')
})

test('power, mount, umount, crontab, at messages', async () => {
  const t = makeCtx()
  assert.equal(await t.run('reboot', []), 1)
  assert.equal(t.err(), 'Failed to connect to bus: browser tabs cannot power off. Nice try.\n')
  assert.equal(await t.run('shutdown', ['-h', 'now']), 1)
  assert.ok(t.err().includes('Nice try.'))
  assert.equal(await t.run('halt', []), 1)
  assert.equal(await t.run('poweroff', []), 1)
  assert.equal(await t.run('mount', []), 0)
  assert.ok(t.out().includes('proc on /proc type proc'))
  assert.equal(await t.run('umount', ['/mnt']), 1)
  assert.equal(t.err(), 'umount: /mnt: not mounted.\n')
  assert.equal(await t.run('crontab', ['-l']), 1)
  assert.equal(t.err(), 'no crontab for guest\n')
  assert.equal(await t.run('at', ['now']), 1)
  assert.equal(t.err(), 'at: not supported in this sandbox\n')
})

test('systemd and service messages', async () => {
  const t = makeCtx()
  assert.equal(await t.run('systemctl', ['status']), 1)
  assert.equal(t.err(), "System has not been booted with systemd as init system (PID 1). Can't operate.\n")
  assert.equal(await t.run('service', ['nginx', 'start']), 1)
  assert.ok(t.err().includes("service: this system is not booted with systemd"))
})

test('hardware and network inspection commands', async () => {
  const t = makeCtx()
  assert.equal(await t.run('lscpu', []), 0)
  assert.ok(t.out().includes('Architecture:            x86_64'))
  assert.equal(await t.run('lsb_release', ['-a']), 0)
  assert.ok(t.out().includes('Distributor ID: ahmed-os'))
  assert.equal(await t.run('lsblk', []), 0)
  assert.ok(t.out().includes('sda'))
  assert.equal(await t.run('ip', ['addr']), 0)
  assert.ok(t.out().includes('127.0.0.1'))
  assert.ok(t.out().includes('10.0.0.2'))
  assert.equal(await t.run('ifconfig', []), 0)
  assert.ok(t.out().includes('10.0.0.2'))
  assert.equal(await t.run('netstat', []), 0)
  assert.ok(t.out().includes('ESTABLISHED'))
  assert.equal(await t.run('lsof', []), 0)
  assert.ok(t.out().includes('bash'))
  assert.equal(await t.run('dmesg', []), 0)
  assert.ok(t.out().includes('Linux version 6.8.0-ahmed'))
  assert.equal(await t.run('locale', []), 0)
  assert.ok(t.out().includes('LANG=C.UTF-8'))
  assert.equal(await t.run('fdisk', ['/dev/sda']), 1)
  assert.equal(t.err(), 'fdisk: Permission denied\n')
  assert.equal(await t.run('mkfs', ['/dev/sda']), 1)
  assert.equal(t.err(), 'mkfs: Permission denied\n')
})

test('whereis, whatis, apropos, compgen', async () => {
  const t = makeCtx()
  assert.equal(await t.run('whereis', ['ls', 'zzz']), 0)
  assert.equal(t.out(), 'ls: /usr/bin/ls\nzzz:\n')
  assert.equal(await t.run('whatis', ['date']), 0)
  assert.equal(t.out(), 'date - print or set the system date and time\n')
  assert.equal(await t.run('whatis', ['zzz']), 0)
  assert.equal(t.out(), 'zzz: nothing appropriate.\n')
  assert.equal(await t.run('apropos', ['calendar']), 0)
  assert.equal(t.out(), 'cal - display a calendar\n')
  assert.equal(await t.run('apropos', ['zzz']), 0)
  assert.equal(t.out(), 'zzz: nothing appropriate.\n')
  assert.equal(await t.run('compgen', ['-c']), 0)
  const names = t.out().trim().split('\n')
  assert.ok(names.includes('ls'))
  assert.ok(names.includes('vim'))
  assert.deepEqual(names, [...names].sort())
})

test('xdg-open and open print no-method errors', async () => {
  const t = makeCtx()
  assert.equal(await t.run('xdg-open', ['https://example.com']), 1)
  assert.equal(t.err(), "xdg-open: no method available for opening 'https://example.com'\n")
  assert.equal(await t.run('open', ['https://example.com']), 1)
  assert.equal(t.err(), "xdg-open: no method available for opening 'https://example.com'\n")
})

test('screen and tmux are unavailable', async () => {
  const t = makeCtx()
  assert.equal(await t.run('tmux', []), 1)
  assert.equal(t.err(), 'tmux: sessions are not available in this terminal\n')
  assert.equal(await t.run('screen', []), 1)
  assert.equal(t.err(), 'screen: sessions are not available in this terminal\n')
})

test('sfx toggles and reports status', async () => {
  const t = makeCtx()
  assert.equal(await t.run('sfx', ['off']), 0)
  assert.equal(t.out(), 'SFX: off\n')
  assert.deepEqual(t.sfx, [false])
  assert.equal(await t.run('sfx', ['on']), 0)
  assert.equal(t.out(), 'SFX: on\n')
  assert.deepEqual(t.sfx, [false, true])
  assert.equal(await t.run('sfx', ['status']), 0)
  assert.equal(t.out(), 'SFX: on\n')
})

test('changelog prints the seeded file and errors when missing', async () => {
  const t = makeCtx()
  assert.equal(await t.run('changelog', []), 0)
  assert.equal(t.out(), 'changes\n')
  t.fs.remove(HOME + '/changelog.txt')
  assert.equal(await t.run('changelog', []), 1)
  assert.equal(t.err(), `changelog: ${HOME}/changelog.txt: No such file or directory\n`)
})

test('download saves files and dl is an alias', async () => {
  const t = makeCtx()
  t.fs.writeFile(HOME + '/a.txt', 'hello')
  t.fs.writeFile(HOME + '/b.txt', 'world')
  assert.equal(await t.run('download', ['a.txt', 'b.txt']), 0)
  assert.deepEqual(t.downloads, [['a.txt', 'hello'], ['b.txt', 'world']])
  assert.equal(t.out(), 'Saving a.txt...\nSaving b.txt...\n')
  assert.equal(await t.run('dl', ['missing.txt']), 1)
  assert.equal(t.err(), 'download: missing.txt: No such file or directory\n')
  t.fs.mkdir(HOME + '/docs')
  assert.equal(await t.run('download', ['docs']), 1)
  assert.equal(t.err(), 'download: docs: Is a directory\n')
})

test('clock prints a locale string', async () => {
  const t = makeCtx()
  const before = new Date().toLocaleString() + '\n'
  assert.equal(await t.run('clock', []), 0)
  // The run can cross a second boundary, so either side of it is correct.
  assert.ok([before, new Date().toLocaleString() + '\n'].includes(t.out()), t.out())
})
