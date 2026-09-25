import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Shell } from './shell'
import { seedFs } from '../seed'
import type { CmdCtx } from '../types'

// ---- test helpers ------------------------------------------------------------------------------

function makeShell(files: Record<string, string> = {}) {
  const fs = seedFs('readme', 'log\n')
  for (const [p, d] of Object.entries(files)) fs.writeFile(p, d)
  let out = ''
  const io = {
    write: (s: string) => { out += s },
    clear: () => {},
    readLine: async () => null,
    edit: async () => {},
    exit: () => {},
    download: () => {},
    setSfx: () => {},
    size: () => ({ cols: 80, rows: 24 }),
  }
  const commands = {
    cat: async (ctx: CmdCtx) => {
      if (ctx.args.length) {
        for (const a of ctx.args) {
          try { ctx.out(ctx.fs.readFile(ctx.resolve(a))) } catch { /* missing */ }
        }
      } else {
        ctx.out(await ctx.stdin.readAll())
      }
      return 0
    },
    chmod: (ctx: CmdCtx) => {
      ctx.fs.chmod(ctx.resolve(ctx.args[1] ?? ''), parseInt(ctx.args[0] ?? '0', 8))
      return 0
    },
    wc: async (ctx: CmdCtx) => {
      const data = await ctx.stdin.readAll()
      if (ctx.args.includes('-l')) { ctx.out(String(data.split('\n').filter((l) => l !== '').length) + '\n'); return 0 }
      ctx.out(String(data.length) + '\n')
      return 0
    },
    sort: async (ctx: CmdCtx) => {
      const data = await ctx.stdin.readAll()
      ctx.out(data.split('\n').filter((l) => l !== '').sort().join('\n') + (data ? '\n' : ''))
      return 0
    },
    tr: async (ctx: CmdCtx) => {
      const data = await ctx.stdin.readAll()
      const from = ctx.args[0] ?? ''
      const to = ctx.args[1] ?? ''
      let s = data
      for (let i = 0; i < from.length; i++) s = s.split(from[i]).join(to[i] ?? '')
      ctx.out(s)
      return 0
    },
    head: async (ctx: CmdCtx) => {
      const data = await ctx.stdin.readAll()
      let n = 10
      const ni = ctx.args.indexOf('-n')
      if (ni >= 0 && ctx.args[ni + 1]) n = Number(ctx.args[ni + 1])
      ctx.out(data.split('\n').slice(0, n).join('\n') + (data.split('\n').length > n ? '\n' : ''))
      return 0
    },
    showenv: (ctx: CmdCtx) => { ctx.out(`${ctx.env.MYVAR ?? ''}\n`); return 0 },
    both: (ctx: CmdCtx) => { ctx.out('OUT'); ctx.err('ERR'); return 0 },
    false: () => 1,
  }
  const shell = new Shell({ fs, io, commands })
  return { shell, fs, getOut: () => out, resetOut: () => { out = '' } }
}

async function run(shell: Shell, src: string) {
  return shell.run(src)
}

// ---- tests -------------------------------------------------------------------------------------

test('quoting: single, double, backslash, ansi-c', async () => {
  const t = makeShell()
  assert.deepEqual(await run(t.shell, "echo 'a b'"), { incomplete: false, status: 0 })
  assert.equal(t.getOut(), 'a b\n')
  t.resetOut()
  await run(t.shell, 'echo "a b"')
  assert.equal(t.getOut(), 'a b\n')
  t.resetOut()
  await run(t.shell, 'echo a\\ b')
  assert.equal(t.getOut(), 'a b\n')
  t.resetOut()
  await run(t.shell, 'echo "a\\"b"')
  assert.equal(t.getOut(), 'a"b\n')
  t.resetOut()
  await run(t.shell, "echo $'a\\tb'")
  assert.equal(t.getOut(), 'a\tb\n')
  t.resetOut()
  await run(t.shell, 'echo hi \\\nthere')
  assert.equal(t.getOut(), 'hi there\n')
})

test('parameter expansion: defaults, alternates, length', async () => {
  const t = makeShell()
  await run(t.shell, 'x=hello; echo $x ${x}')
  assert.equal(t.getOut(), 'hello hello\n')
  t.resetOut()
  await run(t.shell, 'unset x; echo ${x:-d}')
  assert.equal(t.getOut(), 'd\n')
  t.resetOut()
  await run(t.shell, 'x=; echo ${x:-d}')
  assert.equal(t.getOut(), 'd\n')
  t.resetOut()
  await run(t.shell, 'unset x; echo ${x-d}')
  assert.equal(t.getOut(), 'd\n')
  t.resetOut()
  await run(t.shell, 'unset x; echo ${x:=assigned}; echo $x')
  assert.equal(t.getOut(), 'assigned\nassigned\n')
  t.resetOut()
  await run(t.shell, 'x=hello; echo ${x:+alt}; x=; echo ${x:+alt}')
  assert.equal(t.getOut(), 'alt\n\n')
  t.resetOut()
  await run(t.shell, 'x=abcdef; echo ${#x}')
  assert.equal(t.getOut(), '6\n')
})

test('parameter expansion: pattern removal and replace', async () => {
  const t = makeShell()
  await run(t.shell, 'x=abcdef; echo ${x#abc} ${x%def}')
  assert.equal(t.getOut(), 'def abc\n')
  t.resetOut()
  await run(t.shell, 'x=abcc; echo ${x#a*c} ${x##a*c}')
  assert.equal(t.getOut(), 'c\n')
  t.resetOut()
  await run(t.shell, 'x=abcdef; echo ${x%%c*f}')
  assert.equal(t.getOut(), 'ab\n')
  t.resetOut()
  await run(t.shell, 'x=hello; echo ${x/l/L} ${x//l/L}')
  assert.equal(t.getOut(), 'heLlo heLLo\n')
  t.resetOut()
  await run(t.shell, 'x=hello; echo ${x/#h/H} ${x/%o/O}')
  assert.equal(t.getOut(), 'Hello hellO\n')
  t.resetOut()
  await run(t.shell, 'x=abcdef; echo ${x:1:3} ${x:2}')
  assert.equal(t.getOut(), 'bcd cdef\n')
})

test('parameter expansion: case changes and indirect', async () => {
  const t = makeShell()
  await run(t.shell, 'x=hello; echo ${x^} ${x^^}')
  assert.equal(t.getOut(), 'Hello HELLO\n')
  t.resetOut()
  await run(t.shell, 'x=HELLO; echo ${x,} ${x,,}')
  assert.equal(t.getOut(), 'hELLO hello\n')
  t.resetOut()
  await run(t.shell, 'y=x; x=indirect; echo ${!y}')
  assert.equal(t.getOut(), 'indirect\n')
})

test('positional and special parameters', async () => {
  const t = makeShell()
  await run(t.shell, 'set -- a b c; echo $1 $2 $# $@')
  assert.equal(t.getOut(), 'a b 3 a b c\n')
  t.resetOut()
  await run(t.shell, 'echo $?')
  assert.equal(t.getOut(), '0\n')
  t.resetOut()
  await run(t.shell, 'echo $USER $HOSTNAME $SHELL')
  assert.equal(t.getOut(), 'guest ahmed /bin/bash\n')
  t.resetOut()
  await run(t.shell, 'echo $PWD')
  assert.equal(t.getOut(), '/home/guest\n')
  t.resetOut()
  await run(t.shell, 'echo $$ $RANDOM')
  assert.match(t.getOut(), /^\d+ \d+\n$/)
})

test('brace expansion', async () => {
  const t = makeShell()
  await run(t.shell, 'echo {a,b,c}')
  assert.equal(t.getOut(), 'a b c\n')
  t.resetOut()
  await run(t.shell, 'echo {1..5}')
  assert.equal(t.getOut(), '1 2 3 4 5\n')
  t.resetOut()
  await run(t.shell, 'echo {01..10}')
  assert.equal(t.getOut(), '01 02 03 04 05 06 07 08 09 10\n')
  t.resetOut()
  await run(t.shell, 'echo {a..e}')
  assert.equal(t.getOut(), 'a b c d e\n')
  t.resetOut()
  await run(t.shell, 'echo pre{x,y}post')
  assert.equal(t.getOut(), 'prexpost preypost\n')
  t.resetOut()
  await run(t.shell, 'echo {5..1}')
  assert.equal(t.getOut(), '5 4 3 2 1\n')
})

test('word splitting and "$@"', async () => {
  const t = makeShell()
  await run(t.shell, 'set -- "a b" c; printf "<%s>\n" "$@"')
  assert.equal(t.getOut(), '<a b>\n<c>\n')
  t.resetOut()
  await run(t.shell, 'x="a b"; printf "<%s>\n" $x')
  assert.equal(t.getOut(), '<a>\n<b>\n')
  t.resetOut()
  await run(t.shell, 'x="a b"; printf "<%s>\n" "$x"')
  assert.equal(t.getOut(), '<a b>\n')
})

test('command substitution and backticks, nested', async () => {
  const t = makeShell()
  await run(t.shell, 'echo $(echo $(echo inner))')
  assert.equal(t.getOut(), 'inner\n')
  t.resetOut()
  await run(t.shell, 'echo `echo bt`')
  assert.equal(t.getOut(), 'bt\n')
  t.resetOut()
  await run(t.shell, 'x=$(echo cap); echo $x')
  assert.equal(t.getOut(), 'cap\n')
})

test('globbing and tilde', async () => {
  const t = makeShell()
  await run(t.shell, 'echo *.txt')
  assert.equal(t.getOut(), 'changelog.txt readme.txt secrets.txt\n')
  t.resetOut()
  await run(t.shell, 'echo ~/hello.sh')
  assert.equal(t.getOut(), '/home/guest/hello.sh\n')
  t.resetOut()
  await run(t.shell, 'echo *.nomatch')
  assert.equal(t.getOut(), '*.nomatch\n')
  t.resetOut()
  await run(t.shell, 'echo "*.txt"')
  assert.equal(t.getOut(), '*.txt\n')
})

test('if / elif / else', async () => {
  const t = makeShell()
  await run(t.shell, 'if true; then echo yes; else echo no; fi')
  assert.equal(t.getOut(), 'yes\n')
  t.resetOut()
  await run(t.shell, 'if false; then echo yes; elif true; then echo elif; else echo no; fi')
  assert.equal(t.getOut(), 'elif\n')
  t.resetOut()
  await run(t.shell, 'if false; then echo yes; else echo no; fi')
  assert.equal(t.getOut(), 'no\n')
})

test('for loops: words, positionals, arithmetic', async () => {
  const t = makeShell()
  await run(t.shell, 'for i in 1 2 3; do echo $i; done')
  assert.equal(t.getOut(), '1\n2\n3\n')
  t.resetOut()
  await run(t.shell, 'set -- a b; for x; do echo $x; done')
  assert.equal(t.getOut(), 'a\nb\n')
  t.resetOut()
  await run(t.shell, 'for ((i=0;i<3;i++)); do echo $i; done')
  assert.equal(t.getOut(), '0\n1\n2\n')
})

test('while / until / break / continue', async () => {
  const t = makeShell()
  await run(t.shell, 'i=0; while (( i < 3 )); do echo $i; ((i++)); done')
  assert.equal(t.getOut(), '0\n1\n2\n')
  t.resetOut()
  await run(t.shell, 'i=0; until (( i >= 2 )); do echo $i; ((i++)); done')
  assert.equal(t.getOut(), '0\n1\n')
  t.resetOut()
  await run(t.shell, 'for i in 1 2 3 4; do if (( i == 2 )); then continue; fi; if (( i == 4 )); then break; fi; echo $i; done')
  assert.equal(t.getOut(), '1\n3\n')
})

test('case statement', async () => {
  const t = makeShell()
  await run(t.shell, 'x=b; case $x in a) echo A;; b|c) echo BC;; *) echo other;; esac')
  assert.equal(t.getOut(), 'BC\n')
  t.resetOut()
  await run(t.shell, 'x=z; case $x in a) echo A;; *) echo other;; esac')
  assert.equal(t.getOut(), 'other\n')
})

test('functions: args, return, local', async () => {
  const t = makeShell()
  await run(t.shell, 'f() { echo hi $1; }; f there')
  assert.equal(t.getOut(), 'hi there\n')
  t.resetOut()
  await run(t.shell, 'function g { echo g; }; g')
  assert.equal(t.getOut(), 'g\n')
  t.resetOut()
  await run(t.shell, 'f() { return 7; }; f; echo $?')
  assert.equal(t.getOut(), '7\n')
  t.resetOut()
  await run(t.shell, 'x=1; f() { local x=2; echo $x; }; f; echo $x')
  assert.equal(t.getOut(), '2\n1\n')
  t.resetOut()
  const r = await run(t.shell, 'f() { echo x; f; }; f')
  assert.equal(r.status, 1)
  assert.match(t.getOut(), /recursion limit/)
})

test('pipelines with fake commands', async () => {
  const t = makeShell()
  await run(t.shell, 'echo hi | cat')
  assert.equal(t.getOut(), 'hi\n')
  t.resetOut()
  await run(t.shell, 'printf "b\na\n" | sort')
  assert.equal(t.getOut(), 'a\nb\n')
  t.resetOut()
  await run(t.shell, 'echo abc | tr abc ABC')
  assert.equal(t.getOut(), 'ABC\n')
  t.resetOut()
  await run(t.shell, 'printf "1\n2\n3\n4\n" | head -n 2')
  assert.equal(t.getOut(), '1\n2\n')
  t.resetOut()
  await run(t.shell, 'echo hi | wc -l')
  assert.equal(t.getOut(), '1\n')
})

test('pipeline statuses: PIPESTATUS, pipefail, negation', async () => {
  const t = makeShell()
  await run(t.shell, 'false | true; echo $? ${PIPESTATUS[0]} ${PIPESTATUS[1]}')
  assert.equal(t.getOut(), '0 1 0\n')
  t.resetOut()
  await run(t.shell, 'set -o pipefail; false | true; echo $?')
  assert.equal(t.getOut(), '1\n')
  t.resetOut()
  const r = await run(t.shell, '! true')
  assert.equal(r.status, 1)
  const r2 = await run(t.shell, '! false')
  assert.equal(r2.status, 0)
})

test('redirections: files, append, stdin, heredoc, here-string', async () => {
  const t = makeShell()
  await run(t.shell, 'echo hi > /tmp/f; cat /tmp/f')
  assert.equal(t.getOut(), 'hi\n')
  t.resetOut()
  await run(t.shell, 'echo more >> /tmp/f; cat /tmp/f')
  assert.equal(t.getOut(), 'hi\nmore\n')
  t.resetOut()
  await run(t.shell, 'cat < /tmp/f')
  assert.equal(t.getOut(), 'hi\nmore\n')
  t.resetOut()
  await run(t.shell, 'cat <<EOF\nheredoc body\nEOF')
  assert.equal(t.getOut(), 'heredoc body\n')
  t.resetOut()
  await run(t.shell, "x=yo; cat <<EOF\n$x\nEOF")
  assert.equal(t.getOut(), 'yo\n')
  t.resetOut()
  await run(t.shell, "cat <<'EOF'\n$x\nEOF")
  assert.equal(t.getOut(), '$x\n')
  t.resetOut()
  await run(t.shell, 'cat <<< herestring')
  assert.equal(t.getOut(), 'herestring\n')
  t.resetOut()
  await run(t.shell, 'echo hi > /dev/null')
  assert.equal(t.getOut(), '')
})

test('redirections: 2>&1 and &>', async () => {
  const t = makeShell()
  await run(t.shell, 'both > /tmp/f 2>&1; cat /tmp/f')
  assert.equal(t.getOut(), 'OUTERR')
  t.resetOut()
  await run(t.shell, 'both 2>&1 > /tmp/f; cat /tmp/f')
  assert.equal(t.getOut(), 'ERROUT')
  t.resetOut()
  await run(t.shell, 'both &> /tmp/f; cat /tmp/f')
  assert.equal(t.getOut(), 'OUTERR')
})

test('and/or lists and exit statuses', async () => {
  const t = makeShell()
  await run(t.shell, 'true && echo yes')
  assert.equal(t.getOut(), 'yes\n')
  t.resetOut()
  await run(t.shell, 'false && echo no')
  assert.equal(t.getOut(), '')
  t.resetOut()
  await run(t.shell, 'false || echo ok')
  assert.equal(t.getOut(), 'ok\n')
  t.resetOut()
  await run(t.shell, 'true || echo no')
  assert.equal(t.getOut(), '')
  t.resetOut()
  await run(t.shell, 'false; echo after')
  assert.equal(t.getOut(), 'after\n')
  t.resetOut()
  await run(t.shell, 'false; echo $?')
  assert.equal(t.getOut(), '1\n')
})

test('[[ ]] and test builtin', async () => {
  const t = makeShell()
  assert.equal((await run(t.shell, '[[ a == a ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ a == b ]]')).status, 1)
  assert.equal((await run(t.shell, '[[ abc == a* ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ abc == "a*" ]]')).status, 1)
  assert.equal((await run(t.shell, '[[ a != b ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ 5 -gt 3 ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ -n "" ]]')).status, 1)
  assert.equal((await run(t.shell, '[[ -z "" ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ ! -e /nope ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ -f /home/guest/readme.txt ]]')).status, 0)
  assert.equal((await run(t.shell, '[[ ( a == a && b == b ) ]]')).status, 0)
  t.resetOut()
  await run(t.shell, '[[ hello =~ ^he ]] && echo ${BASH_REMATCH[0]}')
  assert.equal(t.getOut(), 'he\n')
  assert.equal((await run(t.shell, '[ a = a ]')).status, 0)
  assert.equal((await run(t.shell, '[ 3 -lt 2 ]')).status, 1)
  assert.equal((await run(t.shell, 'test -n x')).status, 0)
  assert.equal((await run(t.shell, 'test -z x')).status, 1)
})

test('indexed arrays', async () => {
  const t = makeShell()
  await run(t.shell, 'a=(x y z); echo ${a[0]} ${a[1]} ${a[2]}')
  assert.equal(t.getOut(), 'x y z\n')
  t.resetOut()
  await run(t.shell, 'a=(x y z); echo ${#a[@]} ${a[@]}')
  assert.equal(t.getOut(), '3 x y z\n')
  t.resetOut()
  await run(t.shell, 'a=(x y); a[1]=Q; echo ${a[1]}')
  assert.equal(t.getOut(), 'Q\n')
  t.resetOut()
  await run(t.shell, 'a=(x y); a+=(z); echo ${a[2]}')
  assert.equal(t.getOut(), 'z\n')
  t.resetOut()
  await run(t.shell, 'a=(x y z); unset a[1]; echo ${#a[@]} ${a[0]} ${a[2]}')
  assert.equal(t.getOut(), '2 x z\n')
  t.resetOut()
  await run(t.shell, 'declare -a arr=(p q); echo ${arr[0]} ${arr[1]}')
  assert.equal(t.getOut(), 'p q\n')
})

test('associative arrays', async () => {
  const t = makeShell()
  await run(t.shell, 'declare -A m; m[k]=v; echo ${m[k]}')
  assert.equal(t.getOut(), 'v\n')
  const t2 = makeShell()
  await run(t2.shell, 'declare -A m; m[a]=1; m[b]=2; echo ${!m[@]}')
  assert.equal(t2.getOut(), 'a b\n')
  const t3 = makeShell()
  await run(t3.shell, 'declare -A m; m[a]=1; m[b]=2; echo ${m[@]}')
  assert.equal(t3.getOut(), '1 2\n')
})

test('read: file redirect and read loop', async () => {
  const t = makeShell({ '/tmp/f': 'a\nb\n', '/tmp/g': 'a b\n' })
  await run(t.shell, 'while read -r line; do echo "L$line"; done < /tmp/f')
  assert.equal(t.getOut(), 'La\nLb\n')
  t.resetOut()
  await run(t.shell, 'read x y < /tmp/g; echo $x $y')
  assert.equal(t.getOut(), 'a b\n')
  t.resetOut()
  await run(t.shell, "printf 'p q r\n' | read a b c; echo $a $b $c")
  assert.equal(t.getOut(), 'p q r\n')
})

test('alias and unalias', async () => {
  const t = makeShell()
  await run(t.shell, "alias ll='echo hi'\nll")
  assert.equal(t.getOut(), 'hi\n')
  t.resetOut()
  await run(t.shell, "alias x='echo one'\nalias x='echo two'\nx")
  assert.equal(t.getOut(), 'two\n')
  t.resetOut()
  await run(t.shell, "alias x='echo hi'\nunalias x\nx")
  assert.equal(t.getOut(), 'bash: x: command not found\n')
})

test('source and eval', async () => {
  const t = makeShell({ '/tmp/s.sh': 'echo sourced $1\n' })
  await run(t.shell, 'source /tmp/s.sh arg')
  assert.equal(t.getOut(), 'sourced arg\n')
  t.resetOut()
  await run(t.shell, '. /tmp/s.sh arg2')
  assert.equal(t.getOut(), 'sourced arg2\n')
  t.resetOut()
  await run(t.shell, "eval 'echo evaled'")
  assert.equal(t.getOut(), 'evaled\n')
})

test('cd and pwd', async () => {
  const t = makeShell()
  await run(t.shell, 'cd /tmp; pwd')
  assert.equal(t.getOut(), '/tmp\n')
  t.resetOut()
  await run(t.shell, 'cd -; pwd')
  assert.equal(t.getOut(), '/home/guest\n/home/guest\n')
  t.resetOut()
  const r = await run(t.shell, 'cd /nope')
  assert.equal(r.status, 1)
  assert.equal(t.getOut(), 'bash: cd: /nope: No such file or directory\n')
})

test('export and command environment', async () => {
  const t = makeShell()
  await run(t.shell, 'export MYVAR=hi; showenv')
  assert.equal(t.getOut(), 'hi\n')
  t.resetOut()
  await run(t.shell, 'MYVAR=temp showenv; showenv')
  assert.equal(t.getOut(), 'temp\nhi\n')
})

test('set -e, set -u, set --, xtrace', async () => {
  const t = makeShell()
  const r = await run(t.shell, 'set -e; false; echo no')
  assert.equal(r.status, 1)
  assert.equal(t.getOut(), '')
  t.resetOut()
  await run(t.shell, 'set -e; true; echo ok')
  assert.equal(t.getOut(), 'ok\n')
  t.resetOut()
  const r2 = await run(t.shell, 'set -u; echo $nope')
  assert.equal(r2.status, 1)
  assert.match(t.getOut(), /unbound variable/)
  t.resetOut()
  await run(t.shell, 'set -- a b; echo $1 $2')
  assert.equal(t.getOut(), 'a b\n')
  t.resetOut()
  await run(t.shell, 'set -x; echo hi')
  assert.equal(t.getOut(), '+ echo hi\nhi\n')
})

test('bash -c and bash script file', async () => {
  const t = makeShell({ '/tmp/sc.sh': 'echo script $1\n' })
  await run(t.shell, "bash -c 'echo hi $1' name arg")
  assert.equal(t.getOut(), 'hi arg\n')
  t.resetOut()
  await run(t.shell, 'bash /tmp/sc.sh X')
  assert.equal(t.getOut(), 'script X\n')
  t.resetOut()
  await run(t.shell, "sh -c 'echo sh'")
  assert.equal(t.getOut(), 'sh\n')
})

test('echo and printf builtins', async () => {
  const t = makeShell()
  await run(t.shell, 'echo -n hi')
  assert.equal(t.getOut(), 'hi')
  t.resetOut()
  await run(t.shell, "echo -e 'a\\tb'")
  assert.equal(t.getOut(), 'a\tb\n')
  t.resetOut()
  await run(t.shell, 'printf "%s-%d\\n" a 1 b 2')
  assert.equal(t.getOut(), 'a-1\nb-2\n')
  t.resetOut()
  await run(t.shell, "printf -v v '%s' hello; echo $v")
  assert.equal(t.getOut(), 'hello\n')
})

test('type, command, which', async () => {
  const t = makeShell()
  await run(t.shell, 'type echo')
  assert.equal(t.getOut(), 'echo is a shell builtin\n')
  t.resetOut()
  await run(t.shell, 'type -t echo')
  assert.equal(t.getOut(), 'builtin\n')
  t.resetOut()
  await run(t.shell, 'type cat')
  assert.equal(t.getOut(), 'cat is /usr/bin/cat\n')
  t.resetOut()
  await run(t.shell, 'command -v cat')
  assert.equal(t.getOut(), '/usr/bin/cat\n')
  t.resetOut()
  await run(t.shell, 'command echo hi')
  assert.equal(t.getOut(), 'hi\n')
  t.resetOut()
  await run(t.shell, 'which cat')
  assert.equal(t.getOut(), '/usr/bin/cat\n')
  t.resetOut()
  await run(t.shell, 'which nope')
  assert.equal(t.getOut(), '')
})

test('command not found and path execution', async () => {
  const t = makeShell()
  const r = await run(t.shell, 'nosuchcmd')
  assert.equal(r.status, 127)
  assert.equal(t.getOut(), 'bash: nosuchcmd: command not found\n')
  t.resetOut()
  await run(t.shell, "printf '#!/bin/bash\\necho ran $1\\n' > /tmp/x.sh; chmod 755 /tmp/x.sh; /tmp/x.sh arg")
  assert.equal(t.getOut(), 'ran arg\n')
  t.resetOut()
  const r2 = await run(t.shell, 'chmod 644 /tmp/x.sh; /tmp/x.sh')
  assert.equal(r2.status, 126)
  assert.equal(t.getOut(), 'bash: /tmp/x.sh: Permission denied\n')
})

test('history builtin', async () => {
  const t = makeShell()
  t.shell.addHistory('echo hi')
  t.shell.addHistory('ls')
  await run(t.shell, 'history')
  assert.equal(t.getOut(), '    1  echo hi\n    2  ls\n')
  t.resetOut()
  await run(t.shell, 'history 1')
  assert.equal(t.getOut(), '    2  ls\n')
  t.resetOut()
  await run(t.shell, 'history -c; history')
  assert.equal(t.getOut(), '')
})

test('incompleteness detection', async () => {
  const t = makeShell()
  const cases = ['echo "abc', 'if true; then', 'for i in 1 2; do', 'f() {', 'cat <<EOF', 'echo hi \\', 'echo hi |', 'echo hi &&', 'echo hi ||']
  for (const src of cases) {
    const r = await run(t.shell, src)
    assert.equal(r.incomplete, true, src)
    assert.equal(t.getOut(), '', src)
  }
  const complete = ['echo hi', 'if true; then :; fi', 'while false; do :; done', 'echo "abc"']
  for (const src of complete) {
    const r = await run(t.shell, src)
    assert.equal(r.incomplete, false, src)
  }
  t.resetOut()
  assert.equal((await run(t.shell, 'fi')).status, 2)
  assert.equal(t.getOut(), 'bash: syntax error near unexpected token `fi\'\n')
  t.resetOut()
  assert.equal((await run(t.shell, 'done')).status, 2)
  assert.match(t.getOut(), /syntax error/)
})

test('abort stops a running loop', async () => {
  const t = makeShell()
  const p = run(t.shell, 'while true; do :; done')
  await new Promise((r) => setTimeout(r, 20))
  t.shell.abort()
  const r = await p
  assert.equal(r.status, 130)
})

test('completion', async () => {
  const t = makeShell()
  let c = t.shell.complete('ec')
  assert.equal(c.start, 0)
  assert.ok(c.candidates.includes('echo'))
  c = t.shell.complete('cat ~/re')
  assert.equal(c.start, 4)
  assert.ok(c.candidates.includes('~/readme.txt'))
  c = t.shell.complete('ls $HO')
  assert.ok(c.candidates.includes('$HOME'))
  assert.ok(c.candidates.includes('$HOSTNAME'))
  const uniq = new Set(c.candidates)
  assert.equal(uniq.size, c.candidates.length)
})

test('prompt expansion', async () => {
  const t = makeShell()
  const p = t.shell.prompt()
  assert.match(p, /guest@ahmed/)
  assert.match(p, /~/)
  assert.ok(!p.includes('\\['))
})

test('run script with several lines and status', async () => {
  const t = makeShell()
  const r = await run(t.shell, 'x=1\ny=2\necho $x$y')
  assert.equal(r.status, 0)
  assert.equal(t.getOut(), '12\n')
})

test('command substitution output cap and nested run', async () => {
  const t = makeShell()
  await run(t.shell, 'echo $(echo a; echo b)')
  assert.equal(t.getOut(), 'a b\n')
})
