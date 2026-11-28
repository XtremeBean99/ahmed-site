import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadSprites, spriteSrc } from './sprites'

const asked: string[] = []
let status = 200
globalThis.fetch = (async (path: string) => {
  asked.push(path)
  return new Response('png', { status })
}) as typeof fetch

const arrive = () => new Promise((res) => setTimeout(res, 20))

test('a sprite is its own path until it has arrived, then an in-memory blob URL', async () => {
  loadSprites(['/a.png'])
  assert.equal(spriteSrc('/a.png'), '/a.png')
  await arrive()
  assert.match(spriteSrc('/a.png'), /^blob:/)
})

test('each sprite is fetched once, however often it is asked for', async () => {
  asked.length = 0
  loadSprites(['/b.png', '/b.png'])
  loadSprites(['/b.png'])
  await arrive()
  loadSprites(['/b.png'])
  assert.deepEqual(asked, ['/b.png'])
})

test('a sprite that did not arrive keeps its path and is fetched again next time', async () => {
  status = 404
  loadSprites(['/c.png'])
  await arrive()
  assert.equal(spriteSrc('/c.png'), '/c.png')
  status = 200
  loadSprites(['/c.png'])
  await arrive()
  assert.match(spriteSrc('/c.png'), /^blob:/)
})
