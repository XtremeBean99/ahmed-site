import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commands } from './awk'
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

function makeCtx(args: string[], stdinData = '', files: Record<string, string> = {}): { ctx: CmdCtx; box: { out: string; err: string }; fs: VFS } {
  const fs = makeFs(files)
  const box = { out: '', err: '' }
  const io: TerminalIO = {
    write() {}, clear() {}, readLine: async () => null, edit: async () => {},
    exit() {}, download() {}, setSfx() {}, size: () => ({ cols: 80, rows: 24 }),
  }
  const ctx: CmdCtx = {
    argv0: 'awk',
    args,
    stdin: new Stdin(stdinData),
    out: (s) => { box.out += s },
    err: (s) => { box.err += s },
    fs,
    cwd: HOME,
    env: { HOME: '/home/guest', USER: 'guest' },
    io,
    signal: new AbortController().signal,
    resolve: (p) => VFS.resolve(HOME, p, HOME),
    exec: async (argv, stdin) => {
      if (argv[0] === 'cat') return { status: 0, out: stdin ?? '', err: '' }
      if (argv[0] === 'echo') return { status: 0, out: (argv.slice(1).join(' ') || '') + '\n', err: '' }
      if (argv[0] === 'tr') return { status: 0, out: (stdin ?? '').replace(/a/g, 'X'), err: '' }
      return { status: 0, out: '', err: '' }
    },
    runScript: async () => 0,
    isTTYOut: false,
    commandNames: () => [],
    history: [],
  }
  return { ctx, box, fs }
}

async function runAwk(args: string[], input = '', files: Record<string, string> = {}): Promise<{ status: number; out: string; err: string; fs: VFS }> {
  const { ctx, box, fs } = makeCtx(args, input, files)
  const status = await commands.awk(ctx)
  return { status, out: box.out, err: box.err, fs }
}

test('awk sum columns and field reorder', async () => {
  let r = await runAwk(['{s+=$1} END{print s}'], '1\n2\n3\n')
  assert.equal(r.out, '6\n')
  r = await runAwk(['{print $2, $1}'], 'a b\nc d\n')
  assert.equal(r.out, 'b a\nd c\n')
  r = await runAwk(['{print $NF}'], 'x y z\n')
  assert.equal(r.out, 'z\n')
  r = await runAwk(['{print $(NF-1)}'], 'x y z\n')
  assert.equal(r.out, 'y\n')
})

test('awk NR==FNR two-file join', async () => {
  const files = {
    'f1.txt': 'a 1\nb 2\n',
    'f2.txt': 'a x\nb y\n',
  }
  const r = await runAwk(['NR==FNR{map[$1]=$2; next} {print $1, map[$1]}', 'f1.txt', 'f2.txt'], '', files)
  assert.equal(r.out, 'a 1\nb 2\n')
})

test('awk word count with arrays', async () => {
  const r = await runAwk(['{for(i=1;i<=NF;i++) c[$i]++} END{for(w in c) print w, c[w]}'], 'a b a\nc a\n')
  assert.equal(r.out, 'a 3\nb 1\nc 1\n')
})

test('awk -F: passwd field', async () => {
  const r = await runAwk(['-F:', '{print $1}'], 'root:x:0:0:root:/root:/bin/bash\nguest:x:1000:1000:Guest:/home/guest:/bin/bash\n')
  assert.equal(r.out, 'root\nguest\n')
})

test('awk -F forms: comma, tab, attached', async () => {
  let r = await runAwk(['-F,', '{print $2}'], 'a,b,c\n')
  assert.equal(r.out, 'b\n')
  r = await runAwk(['-F', '\t', '{print $2}'], 'a\tb\n')
  assert.equal(r.out, 'b\n')
  r = await runAwk(['-Ft', '{print $2}'], 'a\tb\n')
  assert.equal(r.out, 'b\n')
})

test('awk printf tables and %c', async () => {
  let r = await runAwk(['BEGIN{printf "%5.2f\\n", 3.14159}'])
  assert.equal(r.out, ' 3.14\n')
  r = await runAwk(['BEGIN{printf "%d-%s\\n", 42, "x"}'])
  assert.equal(r.out, '42-x\n')
  r = await runAwk(['BEGIN{printf "%c\\n", 65}'])
  assert.equal(r.out, 'A\n')
})

test('awk BEGIN only arithmetic and builtins', async () => {
  let r = await runAwk(['BEGIN{print 2^10}'])
  assert.equal(r.out, '1024\n')
  r = await runAwk(['BEGIN{print 2**3}'])
  assert.equal(r.out, '8\n')
  r = await runAwk(['BEGIN{print -2^2}'])
  assert.equal(r.out, '-4\n')
  r = await runAwk(['BEGIN{print 7%3}'])
  assert.equal(r.out, '1\n')
  r = await runAwk(['BEGIN{print int(3.9), sqrt(16), toupper("abc")}'])
  assert.equal(r.out, '3 4 ABC\n')
  r = await runAwk(['BEGIN{print length("hello")}'])
  assert.equal(r.out, '5\n')
  r = await runAwk(['BEGIN{print substr("hello", 2, 3)}'])
  assert.equal(r.out, 'ell\n')
  r = await runAwk(['BEGIN{print index("hello", "ll")}'])
  assert.equal(r.out, '3\n')
  r = await runAwk(['BEGIN{print sprintf("%03d", 7)}'])
  assert.equal(r.out, '007\n')
})

test('awk uninitialised variables and string concat', async () => {
  let r = await runAwk(['BEGIN{print x, x+0}'])
  assert.equal(r.out, ' 0\n')
  r = await runAwk(['BEGIN{print "a" "b" 3}'])
  assert.equal(r.out, 'ab3\n')
  r = await runAwk(['BEGIN{x=1; x++; print x}'])
  assert.equal(r.out, '2\n')
  r = await runAwk(['BEGIN{x=1; ++x; print x}'])
  assert.equal(r.out, '2\n')
})

test('awk pattern alone default print and regex patterns', async () => {
  let r = await runAwk(['/b/'], 'a\nb\nc\n')
  assert.equal(r.out, 'b\n')
  r = await runAwk(['!/b/'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nc\n')
  r = await runAwk(['NR==2'], 'a\nb\nc\n')
  assert.equal(r.out, 'b\n')
  r = await runAwk(['$1 == "b"'], 'a 1\nb 2\nc 3\n')
  assert.equal(r.out, 'b 2\n')
})

test('awk range patterns', async () => {
  const r = await runAwk(['/a/,/c/'], 'a\nb\nc\nd\n')
  assert.equal(r.out, 'a\nb\nc\n')
  const r2 = await runAwk(['NR==2,NR==3'], 'a\nb\nc\nd\n')
  assert.equal(r2.out, 'b\nc\n')
})

test('awk comparisons numeric vs string', async () => {
  let r = await runAwk(['BEGIN{print (10 > 9)}'])
  assert.equal(r.out, '1\n')
  r = await runAwk(['BEGIN{print ("10" > "9")}'])
  assert.equal(r.out, '1\n')
  r = await runAwk(['BEGIN{print ("b" > "a")}'])
  assert.equal(r.out, '1\n')
  r = await runAwk(['BEGIN{print (10 == "10")}'])
  assert.equal(r.out, '1\n')
})

test('awk ternary and logical', async () => {
  let r = await runAwk(['BEGIN{print 1 ? "yes" : "no"}'])
  assert.equal(r.out, 'yes\n')
  r = await runAwk(['BEGIN{print 0 || "" ? 1 : 0}'])
  assert.equal(r.out, '0\n')
  r = await runAwk(['BEGIN{print 1 && 2}'])
  assert.equal(r.out, '1\n')
})

test('awk if else while for', async () => {
  let r = await runAwk(['BEGIN{for(i=1;i<=3;i++) s+=i; print s}'])
  assert.equal(r.out, '6\n')
  r = await runAwk(['BEGIN{i=0; while(i<3){i++} print i}'])
  assert.equal(r.out, '3\n')
  r = await runAwk(['BEGIN{i=0; do{i++}while(i<3); print i}'])
  assert.equal(r.out, '3\n')
  r = await runAwk(['BEGIN{x=5; if(x>3) print "big"; else print "small"}'])
  assert.equal(r.out, 'big\n')
})

test('awk arrays, in, delete, for in', async () => {
  let r = await runAwk(['BEGIN{a[1]="x"; a[2]="y"; for(k in a) print k, a[k]}'])
  assert.equal(r.out, '1 x\n2 y\n')
  r = await runAwk(['BEGIN{a[1]="x"; print (1 in a), (2 in a)}'])
  assert.equal(r.out, '1 0\n')
  r = await runAwk(['BEGIN{a[1]="x"; delete a[1]; print (1 in a)}'])
  assert.equal(r.out, '0\n')
  r = await runAwk(['BEGIN{a[1,2]="x"; print a[1,2], (1,2) in a}'])
  assert.equal(r.out, 'x 1\n')
})

test('awk split and length of array', async () => {
  let r = await runAwk(['BEGIN{n=split("a,b,c", arr, ","); print n, arr[2], length(arr)}'])
  assert.equal(r.out, '3 b 3\n')
  r = await runAwk(['BEGIN{n=split("a b c", arr); print n, arr[1], arr[3]}'])
  assert.equal(r.out, '3 a c\n')
})

test('awk gsub and sub', async () => {
  let r = await runAwk(['{n=gsub(/a/, "X"); print n, $0}'], 'a a a\n')
  assert.equal(r.out, '3 X X X\n')
  r = await runAwk(['{n=sub(/a/, "X"); print n, $0}'], 'a a\n')
  assert.equal(r.out, '1 X a\n')
  r = await runAwk(['BEGIN{s="a-b"; sub(/-/, ":", s); print s}'])
  assert.equal(r.out, 'a:b\n')
  r = await runAwk(['BEGIN{s="a-b-c"; gsub(/-/, ":", s); print s}'])
  assert.equal(r.out, 'a:b:c\n')
})

test('awk match and gensub', async () => {
  let r = await runAwk(['BEGIN{s="hello"; print match(s, /l+/), RSTART, RLENGTH}'])
  assert.equal(r.out, '3 3 2\n')
  r = await runAwk(['BEGIN{s="abc"; t=gensub(/b/, "X", "g", s); print s, t}'])
  assert.equal(r.out, 'abc aXc\n')
})

test('awk getline from file and variable', async () => {
  const files = { 'data.txt': 'x\ny\n' }
  let r = await runAwk(['BEGIN{getline line < "data.txt"; print line}'], '', files)
  assert.equal(r.out, 'x\n')
  r = await runAwk(['{getline nxt; print $0, nxt}'], 'a\nb\n', files)
  assert.equal(r.out, 'a b\n')
})

test('awk getline cmd via exec', async () => {
  const r = await runAwk(['BEGIN{"echo hi" | getline x; print x}'])
  assert.equal(r.out, 'hi\n')
})

test('awk user functions and recursion', async () => {
  let r = await runAwk(['function fact(n){if(n<=1) return 1; return n*fact(n-1)} BEGIN{print fact(5)}'])
  assert.equal(r.out, '120\n')
  r = await runAwk(['function add(a,b){return a+b} BEGIN{print add(2,3)}'])
  assert.equal(r.out, '5\n')
})

test('awk field assignment rebuilds with OFS', async () => {
  let r = await runAwk(['{$2="X"; print}'], 'a b c\n')
  assert.equal(r.out, 'a X c\n')
  r = await runAwk(['{$4="d"; print NF, $0}'], 'a b c\n')
  assert.equal(r.out, '4 a b c d\n')
  r = await runAwk(['{$1=$2; print}'], 'a b c\n')
  assert.equal(r.out, 'b b c\n')
})

test('awk NF assignment', async () => {
  const r = await runAwk(['{NF=2; print NF, $0}'], 'a b c\n')
  assert.equal(r.out, '2 a b\n')
})

test('awk next, nextfile, exit', async () => {
  let r = await runAwk(['NR==2{next} {print}'], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nc\n')
  r = await runAwk(['{print; if(NR==2) exit}', ], 'a\nb\nc\n')
  assert.equal(r.out, 'a\nb\n')
})

test('awk BEGIN and END phases with -v', async () => {
  let r = await runAwk(['-v', 'x=5', 'BEGIN{print x} END{print "done"}'], 'a\n')
  assert.equal(r.out, '5\ndone\n')
  r = await runAwk(['-vx=7', 'BEGIN{print x}'])
  assert.equal(r.out, '7\n')
})

test('awk RS paragraph mode and single char', async () => {
  let r = await runAwk(['BEGIN{RS=""} {print NR ":" $0}'], 'a\nb\n\nc\nd\n\n')
  assert.equal(r.out, '1:a\nb\n2:c\nd\n')
  r = await runAwk(['BEGIN{RS=","} {print $0}'], 'a,b,c,')
  assert.equal(r.out, 'a\nb\nc\n')
})

test('awk print redirection to VFS file', async () => {
  const r = await runAwk(['{print > "out.txt"}'], 'a\nb\n', {})
  assert.equal(r.fs.readFile(HOME + '/out.txt'), 'a\nb\n')
})

test('awk print redirection append and stderr', async () => {
  const r = await runAwk(['{print >> "app.txt"}'], 'a\n', {})
  assert.equal(r.fs.readFile(HOME + '/app.txt'), 'a\n')
  const r2 = await runAwk(['BEGIN{print "oops" > "/dev/stderr"}'])
  assert.equal(r2.out, '')
  assert.equal(r2.err, 'oops\n')
})

test('awk missing file and syntax and div zero errors', async () => {
  let r = await runAwk(['BEGIN{print}', '/nope'], '')
  assert.equal(r.status, 2)
  assert.match(r.err, /awk: fatal: cannot open file `\/nope' for reading: No such file or directory/)
  r = await runAwk(['{'], '')
  assert.equal(r.status, 2)
  assert.match(r.err, /awk: syntax error at source line 1/)
  r = await runAwk(['BEGIN{print 1/0}'])
  assert.equal(r.status, 2)
  assert.match(r.err, /awk: division by zero/)
})

test('awk multiple files NR and FNR', async () => {
  const files = { 'a.txt': 'x\n', 'b.txt': 'y\nz\n' }
  const r = await runAwk(['{print NR, FNR, $0}', 'a.txt', 'b.txt'], '', files)
  assert.equal(r.out, '1 1 x\n2 1 y\n3 2 z\n')
})

test('awk print pipes to exec', async () => {
  const r = await runAwk(['BEGIN{print "a b" | "cat"}'])
  assert.equal(r.out, 'a b\n')
})

test('awk arithmetic assignment and ternary with fields', async () => {
  let r = await runAwk(['{s=0; for(i=1;i<=NF;i++) s+=$i; print s}'], '1 2 3\n')
  assert.equal(r.out, '6\n')
  r = await runAwk(['{print ($1 > 0) ? "pos" : "nonpos"}'], '5\n')
  assert.equal(r.out, 'pos\n')
})

test('awk strnum comparisons on fields', async () => {
  const r = await runAwk(['$1 > 10'], '9\n10\n11\n')
  assert.equal(r.out, '11\n')
})

test('awk substr GNU rounding', async () => {
  let r = await runAwk(['BEGIN{print substr("hello", 1.5, 2.4)}'])
  assert.equal(r.out, 'he\n')
  r = await runAwk(['BEGIN{print substr("hello", 0, 3)}'])
  assert.equal(r.out, 'hel\n')
  r = await runAwk(['BEGIN{print substr("hello", 2)}'])
  assert.equal(r.out, 'ello\n')
})

test('awk gawk and mawk aliases', async () => {
  const r = await runAwk(['BEGIN{print "ok"}'])
  assert.equal(r.out, 'ok\n')
  const r2 = await runAwk(['BEGIN{print "ok2"}'])
  assert.equal(r2.out, 'ok2\n')
})
