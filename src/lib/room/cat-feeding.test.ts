import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAT_BED_EDGE, CAT_EAT_AT, CAT_EAT_MS, feedingPose, feedingTimeline, timelineMs } from './cat-feeding'

const SPOT = { x: 1036, y: 440 }

function sample(segments: ReturnType<typeof feedingTimeline>, step = 20) {
  const out = []
  for (let t = 0; t <= timelineMs(segments) + step; t += step) out.push({ t, ...feedingPose(segments, t) })
  return out
}

test('the outing starts on the bed, reaches the bowl, eats, and ends back on the spot', () => {
  const tl = feedingTimeline(SPOT)
  const poses = sample(tl)
  assert.deepEqual(poses[0].at, SPOT)
  assert.equal(poses[0].sprite, 'awake')
  const eating = poses.filter((p) => p.eating)
  assert.ok(eating.length > 0)
  assert.ok(eating.every((p) => p.at.x === CAT_EAT_AT.x && p.at.y === CAT_EAT_AT.y))
  const last = poses[poses.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.at, SPOT)
})

test('it jumps rather than walks between the bed and the floor', () => {
  const poses = sample(feedingTimeline(SPOT))
  const leaps = poses.filter((p) => p.sprite === 'leap')
  assert.ok(leaps.length >= 2)
  // nothing walks across the drop from the mattress edge to the floor
  const walkingBelowEdge = poses.filter((p) => p.sprite.startsWith('walk') && p.at.y > CAT_BED_EDGE.y + 30 && p.at.x > 852)
  assert.equal(walkingBelowEdge.length, 0)
})

test('walking frames advance with distance and the moving cat stays on the 2 px grid', () => {
  const poses = sample(feedingTimeline(SPOT), 10)
  const walking = poses.filter((p) => p.sprite.startsWith('walk'))
  assert.ok(new Set(walking.map((p) => p.sprite)).size === 4)
  const moving = poses.filter((p) => p.sprite.startsWith('walk') || p.sprite === 'leap')
  assert.ok(moving.every((p) => p.at.x % 2 === 0 && p.at.y % 2 === 0))
})

test('the cat faces where it is going', () => {
  const poses = sample(feedingTimeline(SPOT))
  const out = poses.findIndex((p) => p.eating)
  assert.ok(poses.slice(1, out).filter((p) => p.sprite.startsWith('walk')).every((p) => !p.facingRight))
  const back = poses.slice(out).filter((p) => p.sprite.startsWith('walk') && !p.done)
  assert.ok(back.length > 0 && back.every((p) => p.facingRight))
})

test('it turns round in a crouch after eating, before walking off', () => {
  const poses = sample(feedingTimeline(SPOT))
  const lastEat = poses.map((p) => p.eating).lastIndexOf(true)
  const after = poses[lastEat + 1]
  assert.equal(after.sprite, 'crouch')
  assert.equal(after.facingRight, true)
})

test('the bowl is full until the meal runs it down, then empty', () => {
  const poses = sample(feedingTimeline(SPOT))
  const first = poses.findIndex((p) => p.eating)
  assert.equal(poses[first - 1].food, 2)
  assert.equal(poses[first].food, 2)
  assert.ok(poses.some((p) => p.eating && p.food === 1))
  assert.equal(poses[poses.length - 1].food, 0)
})

test('reduced motion goes straight to the bowl', () => {
  const tl = feedingTimeline(SPOT, true)
  assert.equal(timelineMs(tl), CAT_EAT_MS)
  assert.equal(feedingPose(tl, 0).eating, true)
})
