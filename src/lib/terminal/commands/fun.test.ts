import test from 'node:test'
import assert from 'node:assert/strict'
import { seedFs, HOME } from '../seed'
import type { CmdCtx } from '../types'
import { Stdin } from '../types'
import { commands, info } from './fun'
import { runJq, type JqOptions, type JqVal } from './fun-jq'
import { runBc } from './fun-bc'
import { FORTUNES } from './fun-data'

function makeCtx(opts: {
  stdinData?: string
  cwd?: string
  isTTY?: boolean
  cols?: number
  rows?: number
  env?: Record<string, string>
} = {}) {
  const fs = seedFs('readme\n', 'changes\n')
  const env = opts.env ?? { HOME, USER: 'guest', PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TERM: 'xterm-256color' }
  const outChunks: string[] = []
  const errChunks: string[] = []
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
      clear: () => {},
      readLine: async () => null,
      edit: async () => {},
      exit: () => {},
      download: () => {},
      setSfx: () => {},
      size: () => ({ cols: opts.cols ?? 80, rows: opts.rows ?? 24 }),
    },
    signal: ac.signal,
    resolve: (p) => {
      let s = p
      if (s === '~' || s.startsWith('~/')) s = HOME + s.slice(1)
      const parts = (s.startsWith('/') ? s : ctx.cwd + '/' + s).split('/')
      const out: string[] = []
      for (const part of parts) {
        if (!part || part === '.') continue
        if (part === '..') out.pop()
        else out.push(part)
      }
      return '/' + out.join('/')
    },
    exec: async () => ({ status: 0, out: '', err: '' }),
    runScript: async () => 0,
    isTTYOut: opts.isTTY ?? true,
    commandNames: () => [],
    history: [],
  }
  const run = async (name: string, args: string[]): Promise<number> => {
    outChunks.length = 0
    errChunks.length = 0
    ctx.argv0 = name
    ctx.args = args
    return commands[name](ctx)
  }
  return {
    ctx, fs, run,
    out: () => outChunks.join(''),
    err: () => errChunks.join(''),
    abort: () => ac.abort(),
  }
}

// ---- info / help ------------------------------------------------------------------------------------

test('every fun command has an info entry', () => {
  for (const name of Object.keys(commands)) {
    assert.ok(info[name], `missing info for ${name}`)
    assert.ok(info[name].summary.length > 0)
    assert.ok(info[name].usage.length > 0)
  }
})

test('--help prints the usage text', async () => {
  for (const name of ['expr', 'bc', 'jq', 'tar', 'cowsay', 'figlet', 'neofetch', 'fortune']) {
    const t = makeCtx()
    assert.equal(await t.run(name, ['--help']), 0)
    assert.ok(t.out().includes(info[name].usage), `${name} help should include usage`)
  }
})

// ---- expr -------------------------------------------------------------------------------------------

const EXPR_CASES: [string[], string, number][] = [
  [['1', '+', '2'], '3\n', 0],
  [['7', '*', '6'], '42\n', 0],
  [['10', '/', '3'], '3\n', 0],
  [['10', '%', '3'], '1\n', 0],
  [['10', '-', '3'], '7\n', 0],
  [['1', '<', '2'], '1\n', 0],
  [['2', '<=', '2'], '1\n', 0],
  [['1', '>', '2'], '0\n', 1],
  [['foo', '=', 'foo'], '1\n', 0],
  [['foo', '==', 'bar'], '0\n', 1],
  [['foo', '!=', 'bar'], '1\n', 0],
  [['length', 'abcdef'], '6\n', 0],
  [['substr', 'abcdef', '2', '3'], 'bcd\n', 0],
  [['index', 'abcdef', 'cz'], '3\n', 0],
  [['match', 'abcdef', 'a.*'], '6\n', 0],
  [['abcdef', ':', 'a\\(b\\)'], 'b\n', 0],
  [['abc', ':', 'z'], '0\n', 1],
  [['5', '|', '0'], '5\n', 0],
  [['0', '|', '7'], '7\n', 0],
  [['5', '&', '4'], '5\n', 0],
  [['0', '&', '4'], '0\n', 1],
  [['(', '2', '+', '3', ')', '*', '4'], '20\n', 0],
  [['+', '5', '+', '1'], '6\n', 0],
]

test('expr table', async () => {
  for (const [args, out, status] of EXPR_CASES) {
    const t = makeCtx()
    assert.equal(await t.run('expr', args), status, `expr ${args.join(' ')} status`)
    assert.equal(t.out(), out, `expr ${args.join(' ')} out`)
  }
})

test('expr error paths', async () => {
  let t = makeCtx()
  assert.equal(await t.run('expr', ['1', '/', '0']), 2)
  assert.equal(t.err(), 'expr: division by zero\n')

  t = makeCtx()
  assert.equal(await t.run('expr', ['a', '+', '1']), 2)
  assert.equal(t.err(), 'expr: non-integer argument\n')

  t = makeCtx()
  assert.equal(await t.run('expr', []), 2)
  assert.equal(t.err(), 'expr: missing operand\n')

  t = makeCtx()
  assert.equal(await t.run('expr', ['1', '+']), 2)
  assert.ok(t.err().includes('expr: syntax error'))
})

// ---- bc ---------------------------------------------------------------------------------------------

test('bc scale, precision, bases and functions', () => {
  const o = { mathlib: false, quiet: true }
  const cases: [string, string][] = [
    ['1+2', '3\n'],
    ['scale=2; 10/3', '3.33\n'],
    ['10/3', '3\n'],
    ['scale=0; 5/2', '2\n'],
    ['2^10', '1024\n'],
    ['sqrt(16)', '4\n'],
    ['scale=5; sqrt(2)', '1.41421\n'],
    ['length(12345)', '5\n'],
    ['ibase=16; FF', '255\n'],
    ['obase=2; 10', '1010\n'],
    ['define f(x) { return (x*x) }\nf(5)', '25\n'],
    ['(1+2)*4', '12\n'],
    ['10 % 3', '1\n'],
    ['5 > 3', '1\n'],
    ['scale=2; 1/8', '0.12\n'],
  ]
  for (const [prog, out] of cases) {
    const r = runBc(prog, o)
    assert.equal(r.out, out, `bc ${prog}`)
    assert.equal(r.status, 0, `bc ${prog} status`)
  }
  const r = runBc('1/0', o)
  assert.equal(r.status, 1)
  assert.ok(r.err.includes('Divide by zero'))
  const m = runBc('s(0)', { mathlib: true, quiet: true })
  assert.equal(m.out, '0.00000000000000000000\n')
})

test('bc command reads stdin', async () => {
  const t = makeCtx({ stdinData: '1+2\nscale=2; 10/3\n' })
  assert.equal(await t.run('bc', []), 0)
  assert.equal(t.out(), '3\n3.33\n')
})

// ---- factor -----------------------------------------------------------------------------------------

test('factor table', async () => {
  let t = makeCtx()
  assert.equal(await t.run('factor', ['12']), 0)
  assert.equal(t.out(), '12: 2 2 3\n')

  t = makeCtx()
  assert.equal(await t.run('factor', ['97']), 0)
  assert.equal(t.out(), '97: 97\n')

  t = makeCtx()
  assert.equal(await t.run('factor', ['1']), 0)
  assert.equal(t.out(), '1:\n')

  t = makeCtx()
  assert.equal(await t.run('factor', ['100', '17']), 0)
  assert.equal(t.out(), '100: 2 2 5 5\n17: 17\n')

  t = makeCtx({ stdinData: '6 7\n' })
  assert.equal(await t.run('factor', []), 0)
  assert.equal(t.out(), '6: 2 3\n7: 7\n')

  t = makeCtx()
  assert.equal(await t.run('factor', ['x']), 1)
  assert.equal(t.err(), "factor: 'x' is not a valid positive integer\n")

  t = makeCtx()
  assert.equal(await t.run('factor', ['0']), 1)
  assert.equal(t.err(), "factor: '0' is not a valid positive integer\n")
})

// ---- jq ---------------------------------------------------------------------------------------------

const JQ: JqOptions = { raw: false, compact: false, exitStatus: false, slurp: false, nullInput: false, sortKeys: false, tab: false, indent: 2 }

function jq(p: string, input: string, opts: Partial<JqOptions> = {}, vars: Record<string, JqVal> = {}) {
  return runJq(p, [{ name: '<stdin>', text: input }], { ...JQ, ...opts }, { HOME: '/home/guest' }, vars)
}

const JQ_CASES: { p: string; input: string; out: string; opts?: Partial<JqOptions>; status?: number }[] = [
  { p: '.', input: '{"a":1,"b":[1,2]}', out: '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n' },
  { p: '.a', input: '{"a":1}', out: '1\n' },
  { p: '.a.b', input: '{"a":{"b":7}}', out: '7\n' },
  { p: '.a?', input: '1', out: '' },
  { p: '.[0]', input: '[10,20]', out: '10\n' },
  { p: '.[1]', input: '[10,20]', out: '20\n' },
  { p: '.[-1]', input: '[10,20]', out: '20\n' },
  { p: '.[1:3]', input: '[0,1,2,3,4]', out: '[\n  1,\n  2\n]\n' },
  { p: '.[:2]', input: '[0,1,2,3]', out: '[\n  0,\n  1\n]\n' },
  { p: '.[2:]', input: '[0,1,2,3]', out: '[\n  2,\n  3\n]\n' },
  { p: '.[]', input: '[1,2]', out: '1\n2\n' },
  { p: '.a[]', input: '{"a":[1,2]}', out: '1\n2\n' },
  { p: '..', input: '[1,[2]]', out: '[\n  1,\n  [\n    2\n  ]\n]\n1\n[\n  2\n]\n2\n' },
  { p: '.a | .b', input: '{"a":{"b":5}}', out: '5\n' },
  { p: '1,2', input: 'null', out: '1\n2\n' },
  { p: 'select(. > 1)', input: '2', out: '2\n' },
  { p: 'select(. > 1)', input: '1', out: '' },
  { p: 'map(.+1)', input: '[1,2]', out: '[\n  2,\n  3\n]\n' },
  { p: 'map_values(.+1)', input: '{"a":1}', out: '{\n  "a": 2\n}\n' },
  { p: 'length', input: '"abc"', out: '3\n' },
  { p: 'length', input: '[1,2,3]', out: '3\n' },
  { p: 'length', input: '{"a":1,"b":2}', out: '2\n' },
  { p: 'length', input: 'null', out: '0\n' },
  { p: 'keys', input: '{"b":1,"a":2}', out: '[\n  "a",\n  "b"\n]\n' },
  { p: 'keys', input: '[7,8]', out: '[\n  0,\n  1\n]\n' },
  { p: 'values', input: '{"a":1,"b":2}', out: '1\n2\n' },
  { p: 'add', input: '[1,2,3]', out: '6\n' },
  { p: 'add', input: '["a","b","c"]', out: '"abc"\n' },
  { p: 'sort', input: '[3,1,2]', out: '[\n  1,\n  2,\n  3\n]\n' },
  { p: 'sort_by(-.)', input: '[3,1,2]', out: '[\n  3,\n  2,\n  1\n]\n' },
  { p: 'group_by(.%2)', input: '[1,2,3,4]', out: '[\n  [\n    2,\n    4\n  ],\n  [\n    1,\n    3\n  ]\n]\n' },
  { p: 'unique', input: '[3,1,2,1]', out: '[\n  1,\n  2,\n  3\n]\n' },
  { p: 'unique_by(.%2)', input: '[1,2,3,4]', out: '[\n  2,\n  1\n]\n' },
  { p: 'reverse', input: '[1,2,3]', out: '[\n  3,\n  2,\n  1\n]\n' },
  { p: 'reverse', input: '"abc"', out: '"cba"\n' },
  { p: 'join(",")', input: '["a","b"]', out: '"a,b"\n' },
  { p: 'join(",")', input: '[1,2]', out: '"1,2"\n' },
  { p: 'join(",")', input: '["a",null,"b"]', out: '"a,,b"\n' },
  { p: 'split(",")', input: '"a,b"', out: '[\n  "a",\n  "b"\n]\n' },
  { p: 'split("")', input: '"ab"', out: '[\n  "a",\n  "b"\n]\n' },
  { p: 'first', input: '[1,2]', out: '1\n' },
  { p: 'last', input: '[1,2]', out: '2\n' },
  { p: 'min', input: '[3,1,2]', out: '1\n' },
  { p: 'max', input: '[3,1,2]', out: '3\n' },
  { p: 'contains("b")', input: '"abc"', out: 'true\n' },
  { p: 'contains([1,3])', input: '[1,2,3]', out: 'true\n' },
  { p: 'has("k")', input: '{"k":1}', out: 'true\n' },
  { p: 'has("z")', input: '{"k":1}', out: 'false\n' },
  { p: 'has(1)', input: '[7,8]', out: 'true\n' },
  { p: 'test("^a")', input: '"abc"', out: 'true\n' },
  { p: 'test("z")', input: '"abc"', out: 'false\n' },
  { p: 'match("b")', input: '"abc"', out: '{\n  "offset": 1,\n  "length": 1,\n  "string": "b",\n  "captures": []\n}\n' },
  { p: 'sub("a";"x")', input: '"banana"', out: '"bxnana"\n' },
  { p: 'gsub("a";"x")', input: '"banana"', out: '"bxnxnx"\n' },
  { p: 'tostring', input: '123', out: '"123"\n' },
  { p: 'tostring', input: '[1,2]', out: '"[1,2]"\n' },
  { p: 'tonumber', input: '"42"', out: '42\n' },
  { p: 'type', input: 'true', out: '"boolean"\n' },
  { p: 'type', input: 'null', out: '"null"\n' },
  { p: 'not', input: 'false', out: 'true\n' },
  { p: 'not', input: '0', out: 'false\n' },
  { p: 'empty', input: '1', out: '' },
  { p: 'if . > 1 then "big" else "small" end', input: '2', out: '"big"\n' },
  { p: 'if . > 1 then "big" else "small" end', input: '0', out: '"small"\n' },
  { p: 'if . > 1 then "big" elif . == 1 then "one" else "small" end', input: '1', out: '"one"\n' },
  { p: 'true and false', input: 'null', out: 'false\n' },
  { p: 'false or true', input: 'null', out: 'true\n' },
  { p: 'empty // 42', input: 'null', out: '42\n' },
  { p: 'false // 1', input: 'null', out: 'false\n' },
  { p: '{a: .x, "b": 1}', input: '{"x":9}', out: '{\n  "a": 9,\n  "b": 1\n}\n' },
  { p: '{x}', input: '{"x":5}', out: '{\n  "x": 5\n}\n' },
  { p: '[.[] | .x]', input: '[{"x":1},{"x":2}]', out: '[\n  1,\n  2\n]\n' },
  { p: '"a\\(.x)"', input: '{"x":9}', out: '"a9"\n' },
  { p: 'to_entries', input: '{"a":1}', out: '[\n  {\n    "key": "a",\n    "value": 1\n  }\n]\n' },
  { p: 'from_entries', input: '[{"key":"a","value":1}]', out: '{\n  "a": 1\n}\n' },
  { p: 'with_entries({key: .key, value: (.value + 1)})', input: '{"a":1}', out: '{\n  "a": 2\n}\n' },
  { p: 'paths', input: '{"a":1,"b":[2]}', out: '[\n  "a"\n]\n[\n  "b"\n]\n[\n  "b",\n  0\n]\n' },
  { p: 'limit(2; .[])', input: '[1,2,3]', out: '1\n2\n' },
  { p: 'range(3)', input: 'null', out: '0\n1\n2\n' },
  { p: 'range(1;3)', input: 'null', out: '1\n2\n' },
  { p: 'range(0;5;2)', input: 'null', out: '0\n2\n4\n' },
  { p: 'env', input: 'null', out: '{\n  "HOME": "/home/guest"\n}\n' },
  { p: '.a', input: '{"a":"hi"}', opts: { raw: true }, out: 'hi\n' },
  { p: '.', input: '{"a":1}', opts: { compact: true }, out: '{"a":1}\n' },
  { p: 'length', input: '1 2 3', opts: { slurp: true }, out: '3\n' },
  { p: 'range(2)', input: '', opts: { nullInput: true }, out: '0\n1\n' },
  { p: '.', input: '{"b":1,"a":2}', opts: { sortKeys: true }, out: '{\n  "a": 2,\n  "b": 1\n}\n' },
  { p: '.', input: '{"a":1}', opts: { indent: 4 }, out: '{\n    "a": 1\n}\n' },
  { p: '.', input: '{"a":1}', opts: { tab: true }, out: '{\n\t"a": 1\n}\n' },
  { p: '.', input: '1 2', out: '1\n2\n' },
  { p: '. + $x', input: '2', out: '5\n' },
  { p: 'false', input: 'null', opts: { exitStatus: true }, out: 'false\n', status: 1 },
  { p: 'empty', input: 'null', opts: { exitStatus: true }, out: '', status: 4 },
]

test('jq filter table', () => {
  for (const c of JQ_CASES) {
    const r = jq(c.p, c.input, c.opts, c.p === '. + $x' ? { x: 3 } : {})
    assert.equal(r.out, c.out, `jq ${c.p} on ${c.input}`)
    assert.equal(r.status, c.status ?? 0, `jq ${c.p} status`)
  }
})

test('jq runtime and compile errors', () => {
  const r = jq('.a', '1')
  assert.equal(r.status, 5)
  assert.equal(r.err, 'jq: error (at <stdin>:1): Cannot index number with "a"\n')

  const r2 = jq('.[]', '1')
  assert.equal(r2.status, 5)
  assert.ok(r2.err.includes('Cannot iterate over number (1)'))

  const r3 = jq('tonumber', '"x"')
  assert.equal(r3.status, 5)
  assert.ok(r3.err.includes('cannot be parsed as a number'))

  const r4 = jq('.[', '1')
  assert.equal(r4.status, 2)
  assert.ok(r4.err.includes('jq: 1 compile error'))
})

test('jq command handles --arg and --argjson', async () => {
  let t = makeCtx({ stdinData: 'null\n' })
  assert.equal(await t.run('jq', ['-n', '--arg', 'x', 'hello', '$x']), 0)
  assert.equal(t.out(), '"hello"\n')

  t = makeCtx({ stdinData: 'null\n' })
  assert.equal(await t.run('jq', ['-n', '--argjson', 'x', '5', '$x + 1']), 0)
  assert.equal(t.out(), '6\n')
})

// ---- tar / zip / gzip -------------------------------------------------------------------------------

function archFs() {
  const t = makeCtx()
  t.fs.mkdir(HOME + '/arch')
  t.fs.writeFile(HOME + '/arch/f1.txt', 'hello\n')
  t.fs.writeFile(HOME + '/arch/f2.txt', 'world')
  return t
}

test('tar create, list and extract round trip', async () => {
  const t = archFs()
  assert.equal(await t.run('tar', ['-cf', 'a.tar', 'arch']), 0)
  assert.ok(t.fs.isFile(HOME + '/a.tar'))

  t.run('tar', ['-tf', 'a.tar'])
  assert.equal(t.out(), 'arch/\narch/f1.txt\narch/f2.txt\n')

  t.fs.remove(HOME + '/arch', true)
  assert.equal(await t.run('tar', ['-xf', 'a.tar']), 0)
  assert.equal(t.fs.readFile(HOME + '/arch/f1.txt'), 'hello\n')
  assert.equal(t.fs.readFile(HOME + '/arch/f2.txt'), 'world')
  assert.ok(t.fs.isDir(HOME + '/arch'))

  t.run('tar', ['-tvf', 'a.tar'])
  const lines = t.out().trim().split('\n')
  assert.equal(lines.length, 3)
  assert.ok(/^drwxr-xr-x guest\/guest\s+\d+ \d{4}-\d{2}-\d{2} \d{2}:\d{2} arch\/$/.test(lines[0]))
  assert.ok(/^-rw-r--r-- guest\/guest\s+\d+ \d{4}-\d{2}-\d{2} \d{2}:\d{2} arch\/f1\.txt$/.test(lines[1]))
})

test('tar verbose extract prints names', async () => {
  const t = archFs()
  await t.run('tar', ['-cf', 'a.tar', 'arch'])
  t.fs.remove(HOME + '/arch', true)
  assert.equal(await t.run('tar', ['-xvf', 'a.tar']), 0)
  assert.equal(t.out(), 'arch/\narch/f1.txt\narch/f2.txt\n')
})

test('zip and unzip round trip', async () => {
  const t = archFs()
  assert.equal(await t.run('zip', ['-r', 'a.zip', 'arch']), 0)
  assert.equal(t.out(), '  adding: arch/ (stored 0%)\n  adding: arch/f1.txt (stored 0%)\n  adding: arch/f2.txt (stored 0%)\n')

  t.fs.remove(HOME + '/arch', true)
  assert.equal(await t.run('unzip', ['a.zip']), 0)
  assert.equal(t.out(), 'Archive:  a.zip\n   creating: arch/\n  inflating: arch/f1.txt\n  inflating: arch/f2.txt\n')
  assert.equal(t.fs.readFile(HOME + '/arch/f1.txt'), 'hello\n')

  t.run('unzip', ['-l', 'a.zip'])
  const listing = t.out()
  assert.ok(listing.startsWith('Archive:  a.zip\n'))
  assert.ok(listing.includes('  Length      Date    Time    Name'))
  assert.ok(listing.includes('arch/f1.txt'))
  assert.ok(listing.includes('3 files'))
})

test('unzip -d extracts into a target directory', async () => {
  const t = archFs()
  await t.run('zip', ['-r', 'a.zip', 'arch'])
  t.fs.remove(HOME + '/arch', true)
  assert.equal(await t.run('unzip', ['-d', 'out', 'a.zip']), 0)
  assert.equal(t.fs.readFile(HOME + '/out/arch/f1.txt'), 'hello\n')
})

test('gzip, gunzip and zcat round trip', async () => {
  const t = makeCtx()
  t.fs.writeFile(HOME + '/f.txt', 'hello')
  assert.equal(await t.run('gzip', ['f.txt']), 0)
  assert.ok(!t.fs.exists(HOME + '/f.txt'))
  assert.ok(t.fs.isFile(HOME + '/f.txt.gz'))

  t.run('zcat', ['f.txt.gz'])
  assert.equal(t.out(), 'hello')

  assert.equal(await t.run('gunzip', ['f.txt.gz']), 0)
  assert.ok(t.fs.exists(HOME + '/f.txt'))
  assert.equal(t.fs.readFile(HOME + '/f.txt'), 'hello')
})

test('gzip -k keeps the original and -c writes the archive to stdout', async () => {
  const t = makeCtx()
  t.fs.writeFile(HOME + '/f.txt', 'hello')
  assert.equal(await t.run('gzip', ['-k', 'f.txt']), 0)
  assert.ok(t.fs.exists(HOME + '/f.txt'))
  assert.ok(t.fs.isFile(HOME + '/f.txt.gz'))

  t.run('gzip', ['-c', 'f.txt'])
  assert.ok(t.out().startsWith('!<ahmed-archive>\n'))
  assert.ok(t.out().includes('"path":"f.txt"'))
})

test('gzip and gunzip work on stdin', async () => {
  let t = makeCtx({ stdinData: 'hello' })
  assert.equal(await t.run('gzip', []), 0)
  const archive = t.out()
  assert.ok(archive.startsWith('!<ahmed-archive>\n'))

  t = makeCtx({ stdinData: archive })
  assert.equal(await t.run('gunzip', []), 0)
  assert.equal(t.out(), 'hello')
})

// ---- figlet / banner --------------------------------------------------------------------------------

test('figlet renders the standard font', async () => {
  const t = makeCtx()
  assert.equal(await t.run('figlet', ['Hi']), 0)
  assert.equal(t.out(), '  _   _ _ \n | | | (_)\n | |_| | |\n |  _  | |\n |_| |_|_|\n          \n')
})

test('toilet and banner produce text', async () => {
  const t = makeCtx()
  assert.equal(await t.run('toilet', ['Hi']), 0)
  assert.ok(t.out().includes('_'))

  const t2 = makeCtx()
  assert.equal(await t2.run('banner', ['HI']), 0)
  assert.equal(t2.out(), '#    #  #####\n#    #    #  \n#    #    #  \n######    #  \n#    #    #  \n#    #    #  \n#    #  #####\n')
})

test('figlet reads stdin when no args', async () => {
  const t = makeCtx({ stdinData: 'Hi\n' })
  assert.equal(await t.run('figlet', []), 0)
  assert.ok(t.out().includes('_'))
})

// ---- cowsay / cowthink ------------------------------------------------------------------------------

const COW_SAY_HELLO = ' _______\n< hello >\n -------\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n'
const COW_SAY_MULTI = ' _______\n/ hello \\\n\\ world /\n -------\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n'
const COW_THINK_HI = ' ____\n( hi )\n ----\n        o   ^__^\n         o  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n'

test('cowsay balloon shapes', async () => {
  let t = makeCtx()
  assert.equal(await t.run('cowsay', ['hello']), 0)
  assert.equal(t.out(), COW_SAY_HELLO)

  t = makeCtx()
  assert.equal(await t.run('cowsay', ['-W', '5', 'hello', 'world']), 0)
  assert.equal(t.out(), COW_SAY_MULTI)

  t = makeCtx()
  assert.equal(await t.run('cowthink', ['hi']), 0)
  assert.equal(t.out(), COW_THINK_HI)

  t = makeCtx()
  assert.equal(await t.run('cowsay', ['-e', '==', '-T', 'U ', 'hi']), 0)
  assert.ok(t.out().includes('(==)'))
  assert.ok(t.out().includes('U  ||----w |'))
})

// ---- fortune / lolcat / sl / cmatrix ----------------------------------------------------------------

test('fortune returns a known fortune', async () => {
  const t = makeCtx()
  assert.equal(await t.run('fortune', []), 0)
  assert.ok(FORTUNES.includes(t.out().trim()))
})

test('lolcat is plain when not a tty and coloured when it is', async () => {
  let t = makeCtx({ isTTY: false, stdinData: 'ab' })
  assert.equal(await t.run('lolcat', []), 0)
  assert.equal(t.out(), 'ab')

  t = makeCtx({ isTTY: true, stdinData: 'ab' })
  assert.equal(await t.run('lolcat', []), 0)
  assert.ok(t.out().includes('\x1b[38;5;'))
  assert.ok(t.out().endsWith('\x1b[0m\n'))
})

test('sl prints a train and the message', async () => {
  const t = makeCtx()
  assert.equal(await t.run('sl', []), 0)
  assert.ok(t.out().includes('You meant ls. Anyway.'))
  assert.ok(t.out().includes('OO'))
})

test('cmatrix prints green random characters', async () => {
  const t = makeCtx({ cols: 20 })
  assert.equal(await t.run('cmatrix', []), 0)
  assert.ok(t.out().startsWith('\x1b[32m'))
  assert.ok(t.out().endsWith('\x1b[0m'))
  const body = t.out().slice(5, -4)
  assert.equal(body.trim().split('\n').length, 14)
})

// ---- neofetch / screenfetch / emacs -----------------------------------------------------------------

test('neofetch prints the labelled info lines', async () => {
  const t = makeCtx({ isTTY: false })
  assert.equal(await t.run('neofetch', []), 0)
  const out = t.out()
  for (const label of ['guest@ahmed', 'OS: ahmed-os 1.0 (in your browser)', 'Host: ahmedyhussain.com', 'Kernel: 6.8.0-ahmed', 'Uptime: ', 'Packages: 90 (bash-js)', 'Shell: bash 5.2', 'Resolution: 80x24 chars', 'Terminal: the monitor on the desk', 'CPU: 1x imagination', 'Memory: ']) {
    assert.ok(out.includes(label), `neofetch should include ${label}`)
  }
})

test('neofetch adds colour blocks on a tty', async () => {
  const t = makeCtx({ isTTY: true })
  assert.equal(await t.run('neofetch', []), 0)
  assert.ok(t.out().includes('\x1b[40m   \x1b[0m'))
  assert.ok(t.out().includes('\x1b[47m   \x1b[0m'))
  assert.ok(t.out().includes('\x1b[107m   \x1b[0m'))
})

test('screenfetch prints info and a pixel X', async () => {
  const t = makeCtx({ isTTY: false })
  assert.equal(await t.run('screenfetch', []), 0)
  assert.ok(t.out().includes('guest@ahmed'))
  assert.ok(t.out().includes('##....##'))
})

test('emacs refuses politely', async () => {
  const t = makeCtx()
  assert.equal(await t.run('emacs', []), 1)
  assert.equal(t.err(), "emacs: this is a vim/nano household. Try 'nano' or 'vim'.\n")
})
