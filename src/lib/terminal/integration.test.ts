import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Shell } from './shell/shell'
import { COMMANDS } from './commands/index'
import { seedFs } from './seed'
import { stripAnsi } from './ansi'
import type { TerminalIO } from './types'

function setup() {
  const fs = seedFs('Hello from the readme.\nSecond line.', '2026-07-11  log\n')
  let out = ''
  const edits: string[] = []
  const io: TerminalIO = {
    write: (s) => { out += s },
    clear: () => { out = '' },
    readLine: async () => null,
    edit: async (kind, path) => { edits.push(kind + ' ' + path) },
    exit: () => {},
    download: () => {},
    setSfx: () => {},
    size: () => ({ cols: 80, rows: 24 }),
  }
  const sh = new Shell({ fs, io, commands: COMMANDS })
  const run = async (src: string) => { out = ''; const r = await sh.run(src); return { out: stripAnsi(out), status: r.status } }
  return { fs, sh, run, edits }
}

test('real pipelines through the shell and commands', async () => {
  const { run, fs, sh } = setup()
  await sh.init()
  assert.equal((await run('cat readme.txt | grep -c line')).out, '1\n')
  assert.equal((await run('printf "b\\na\\nb\\n" | sort | uniq -c | sort -rn | head -1')).out.trim(), '2 b')
  assert.equal((await run("echo 'a,b,c' | cut -d, -f2 | tr a-z A-Z")).out, 'B\n')
  assert.equal((await run("seq 1 5 | awk '{s+=$1} END {print s}'")).out, '15\n')
  assert.equal((await run("echo hello world | sed 's/world/there/'")).out, 'hello there\n')
  await run('mkdir -p proj/src && echo "x=1" > proj/src/a.py && echo "y" >> proj/src/a.py')
  assert.equal(fs.readFile('/home/guest/proj/src/a.py'), 'x=1\ny\n')
  assert.equal((await run('find proj -name "*.py" | xargs wc -l')).out.trim(), '2 proj/src/a.py')
  assert.equal((await run('for f in *.txt; do echo "$f"; done | wc -l')).out.trim(), '3')
  assert.equal((await run('./hello.sh you | tail -1')).out, 'hello, you (3)\n')
  assert.equal((await run('ll | head -1')).out.startsWith('total'), true)
  assert.equal((await run('nosuch')).status, 127)
  assert.equal((await run('echo \'{"a":[1,2]}\' | jq -c .a')).out, '[1,2]\n')
  assert.equal((await run('echo "2^10" | bc')).out, '1024\n')
})

test('editors and man launch through io.edit', async () => {
  const { run, edits } = setup()
  await run('nano notes.txt; vim ~/Desktop/x.txt; vi')
  assert.deepEqual(edits.slice(0, 2), ['nano /home/guest/notes.txt', 'vim /home/guest/Desktop/x.txt'])
  const h = await run('help')
  assert.match(h.out, /Editors/)
  assert.equal((await run('man ls | head -1')).out.includes('LS(1)'), true)
})

test('infinite loop is stopped', async () => {
  const { run } = setup()
  const r = await run('while true; do :; done')
  assert.notEqual(r.status, 0)
})

test('Ctrl+C sets $? to 130', async () => {
  const { run, sh } = setup()
  const p = run('while true; do :; done')
  setTimeout(() => sh.abort(), 50)
  assert.equal((await p).status, 130)
  assert.equal((await run('echo $?')).out, '130\n')
})
