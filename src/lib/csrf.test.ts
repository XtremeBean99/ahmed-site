import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSameSiteRequest } from './csrf'

const HOST = 'ahmedyhussain.com'

test('accepts the site origin and its www variant', () => {
  assert.equal(isSameSiteRequest('https://ahmedyhussain.com', null, HOST), true)
  assert.equal(isSameSiteRequest('https://www.ahmedyhussain.com', null, HOST), true)
  assert.equal(isSameSiteRequest(null, 'https://ahmedyhussain.com/#desk', HOST), true)
})

test('rejects look-alike hosts that share the prefix', () => {
  assert.equal(isSameSiteRequest(null, 'https://ahmedyhussain.com.evil.com/', HOST), false)
  assert.equal(isSameSiteRequest(null, 'https://ahmedyhussain.com@evil.com/', HOST), false)
  assert.equal(isSameSiteRequest('https://ahmedyhussain.com.evil.com', 'https://ahmedyhussain.com/', HOST), false)
})

test('a mismatched Origin is not rescued by a matching Referer', () => {
  assert.equal(isSameSiteRequest('https://evil.com', 'https://ahmedyhussain.com/', HOST), false)
})

test('rejects missing, malformed and non-https values', () => {
  assert.equal(isSameSiteRequest(null, null, HOST), false)
  assert.equal(isSameSiteRequest(null, 'not a url', HOST), false)
  assert.equal(isSameSiteRequest('http://ahmedyhussain.com', null, HOST), false)
})
