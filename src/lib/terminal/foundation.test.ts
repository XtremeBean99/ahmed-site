import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VFS, FsError } from './vfs'
import { expandGlob, matchGlob } from './glob'
import { compilePosix } from './regex'
import { formatPrintf } from './printf'
import { appendOutput, parseAnsi } from './ansi'
import { seedFs } from './seed'

test('vfs: resolve, write, list, rename, copy, remove', () => {
  assert.equal(VFS.resolve('/a/b', '../c/./d'), '/a/c/d')
  assert.equal(VFS.resolve('/a', '~/x'), '/home/guest/x')
  const fs = new VFS()
  fs.mkdir('/a/b', true)
  fs.writeFile('/a/b/f.txt', 'hi')
  fs.writeFile('/a/b/f.txt', ' there', true)
  assert.equal(fs.readFile('/a/b/f.txt'), 'hi there')
  fs.copy('/a', '/z', true)
  fs.rename('/z/b/f.txt', '/z/g.txt')
  assert.deepEqual(fs.list('/z'), ['b', 'g.txt'])
  assert.throws(() => fs.remove('/a'), (e: unknown) => e instanceof FsError && e.code === 'ENOTEMPTY')
  assert.throws(() => fs.rename('/a', '/a/b/c'), (e: unknown) => e instanceof FsError && e.code === 'EINVAL')
  fs.remove('/a', true)
  assert.equal(fs.exists('/a'), false)
  assert.equal(VFS.fromJSON(JSON.parse(JSON.stringify(fs.toJSON())))?.readFile('/z/g.txt'), 'hi there')
})

test('glob', () => {
  const fs = seedFs('readme', 'log\n')
  assert.ok(matchGlob('*.txt', 'a.txt') && !matchGlob('*.txt', 'a/b.txt') && matchGlob('[a-c]?', 'bz'))
  assert.deepEqual(expandGlob(fs, '/home/guest', '*.txt'), ['changelog.txt', 'readme.txt', 'secrets.txt'])
  assert.deepEqual(expandGlob(fs, '/', 'home/*/Doc*'), ['home/guest/Documents'])
  assert.deepEqual(expandGlob(fs, '/home/guest', '.b*'), ['.bashrc'])
})

test('posix regex', () => {
  assert.ok(compilePosix('a\\(b\\)*c').test('abbc'))
  assert.ok(!compilePosix('a(b)c').test('abc') && compilePosix('a(b)c').test('a(b)c'))
  assert.ok(compilePosix('a(b)+c', { ere: true }).test('abbc'))
  assert.ok(compilePosix('^[[:digit:]]+$', { ere: true }).test('123'))
  assert.ok(compilePosix('*a').test('*a'))
  assert.ok(compilePosix('HELLO', { icase: true }).test('hello'))
})

test('printf', () => {
  assert.equal(formatPrintf('%s-%d\n', ['a', '1', 'b', '2']), 'a-1\nb-2\n')
  assert.equal(formatPrintf('%5.2f|%-4s|%04d|%x', ['3.14159', 'ab', '7', '255']), ' 3.14|ab  |0007|ff')
  assert.equal(formatPrintf('hi\\tthere', []), 'hi\tthere')
})

test('ansi', () => {
  const s = parseAnsi('a\x1b[1;31mb\x1b[0mc')
  assert.deepEqual(s.map((x) => x.t), ['a', 'b', 'c'])
  assert.equal(s[1].bold, true)
  assert.equal(s[2].bold, undefined)
  assert.deepEqual(appendOutput(['x'], 'y\nz\n'), ['xy', 'z', ''])
})
