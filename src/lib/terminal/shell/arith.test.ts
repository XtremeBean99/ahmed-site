import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evalArith, ArithError } from './arith'

function env(vars: Record<string, string> = {}) {
  const m = new Map(Object.entries(vars))
  return {
    get: (name: string) => m.get(name),
    set: (name: string, value: string) => { m.set(name, value) },
    dump: () => Object.fromEntries(m),
  }
}

test('arith: basic operators', () => {
  const cases: [string, number][] = [
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['7 / 2', 3],
    ['7 % 3', 1],
    ['2 ** 10', 1024],
    ['-2 ** 2', -4],
    ['2 ** 3 ** 2', 512],
    ['1 << 4', 16],
    ['16 >> 2', 4],
    ['5 & 3', 1],
    ['5 | 3', 7],
    ['5 ^ 3', 6],
    ['~0', -1],
    ['!0', 1],
    ['!5', 0],
    ['1 && 2', 1],
    ['0 && 2', 0],
    ['0 || 2', 1],
    ['1 < 2', 1],
    ['2 <= 2', 1],
    ['3 > 4', 0],
    ['1 == 1', 1],
    ['1 != 1', 0],
    ['1 ? 10 : 20', 10],
    ['0 ? 10 : 20', 20],
  ]
  for (const [expr, want] of cases) assert.equal(evalArith(expr, env()), want, expr)
})

test('arith: bases and variables', () => {
  const e = env({ x: '10', y: '5' })
  assert.equal(evalArith('0x1f', e), 31)
  assert.equal(evalArith('0755', e), 493)
  assert.equal(evalArith('2#101', e), 5)
  assert.equal(evalArith('x + y', e), 15)
  assert.equal(evalArith('nope', e), 0)
})

test('arith: assignments and increment', () => {
  const e = env()
  assert.equal(evalArith('a = 1, a += 1, a', e), 2)
  assert.equal(e.dump().a, '2')
  assert.equal(evalArith('i++', e), 0)
  assert.equal(e.dump().i, '1')
  assert.equal(evalArith('++i', e), 2)
  assert.equal(e.dump().i, '2')
  assert.equal(evalArith('i--', e), 2)
  assert.equal(e.dump().i, '1')
  assert.equal(evalArith('arr[1] = 7', e), 7)
  assert.equal(evalArith('arr[1]', e), 7)
  assert.equal(evalArith('arr[0]', e), 0)
})

test('arith: division by zero throws', () => {
  assert.throws(() => evalArith('1 / 0', env()), (e: unknown) => e instanceof ArithError && /division by 0/.test(e.message))
  assert.throws(() => evalArith('1 % 0', env()), (e: unknown) => e instanceof ArithError)
})
