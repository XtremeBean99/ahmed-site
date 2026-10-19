import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bonsaiFrames, bonsaiStage } from './bonsai'

test('the bonsai is a sprout on the first visit and grows with visits', () => {
  assert.equal(bonsaiStage(0), 1)
  assert.equal(bonsaiStage(1), 2)
  assert.equal(bonsaiStage(2), 2)
  assert.equal(bonsaiStage(3), 3)
  assert.equal(bonsaiStage(6), 4)
  assert.equal(bonsaiStage(11), 5)
  assert.equal(bonsaiStage(500), 5)
})

test('a bad stored count counts as a first visit', () => {
  assert.equal(bonsaiStage(-3), 1)
  assert.equal(bonsaiStage(Number.NaN), 1)
})

test('?bonsai= forces a valid stage and ignores anything else', () => {
  assert.equal(bonsaiStage(0, '?bonsai=5'), 5)
  assert.equal(bonsaiStage(20, '?x=1&bonsai=2'), 2)
  assert.equal(bonsaiStage(0, '?bonsai=9'), 1)
  assert.equal(bonsaiStage(0, '?bonsai=abc'), 1)
})

test('each stage has six frames named by stage', () => {
  assert.deepEqual(bonsaiFrames(3).slice(0, 2), ['/room/bonsai-3-1.png', '/room/bonsai-3-2.png'])
  assert.equal(bonsaiFrames(1).length, 6)
})
