import assert from 'node:assert/strict'
import test from 'node:test'
import zlib from 'node:zlib'
import { createBuffer } from './pixel-art'
import { crc32, decodePNG, encodePNG, zlibStoredCompress } from './png'

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)))
  const body = new Uint8Array(4 + data.length)
  body.set(typeBytes, 0)
  body.set(data, 4)
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(4 + body.length, crc32(body))
  return out
}

function makePng(width: number, height: number, colorType: 2 | 6, rawScanlines: Uint8Array, deflate?: (data: Uint8Array) => Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = colorType
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', (deflate ?? zlibStoredCompress)(rawScanlines)), pngChunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function makeRawScanlines(width: number, height: number, bpp: number, filter: number): Uint8Array {
  const stride = width * bpp
  const raw = new Uint8Array((stride + 1) * height)
  let prev = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const cur = new Uint8Array(stride)
    for (let x = 0; x < stride; x++) cur[x] = (y * stride + x) % 251
    raw[y * (stride + 1)] = filter
    const rowStart = y * (stride + 1) + 1
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? cur[x - bpp] : 0
      const up = prev[x]
      const upLeft = x >= bpp ? prev[x - bpp] : 0
      let value = cur[x]
      if (filter === 1) value = (cur[x] - left) & 0xff
      else if (filter === 2) value = (cur[x] - up) & 0xff
      else if (filter === 3) value = (cur[x] - ((left + up) >> 1)) & 0xff
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
        value = (cur[x] - predictor) & 0xff
      }
      raw[rowStart + x] = value
    }
    prev = cur
  }
  return raw
}

test('RGBA PNG round-trips through the dependency-free stored-block path', () => {
  const buffer = createBuffer(5, 4)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 5; x++) {
      const i = (y * 5 + x) * 4
      buffer.data[i] = (x * 37 + y * 11) % 256
      buffer.data[i + 1] = (x * 19 + y * 53) % 256
      buffer.data[i + 2] = (x * 7 + y * 29) % 256
      buffer.data[i + 3] = (x + y) % 2 === 0 ? 255 : 0
    }
  }
  const decoded = decodePNG(encodePNG(buffer))
  assert.equal(decoded.width, buffer.width)
  assert.equal(decoded.height, buffer.height)
  for (let i = 0; i < buffer.data.length; i++) {
    assert.equal(decoded.data[i], buffer.data[i], `byte ${i} differs`)
  }
})

test('RGBA PNG round-trips through node:zlib deflate/inflate', () => {
  const buffer = createBuffer(7, 3)
  for (let i = 0; i < buffer.data.length; i++) buffer.data[i] = (i * 13) % 256
  const decoded = decodePNG(encodePNG(buffer, { deflate: zlib.deflateSync }), { inflate: zlib.inflateSync })
  assert.equal(decoded.width, buffer.width)
  assert.equal(decoded.height, buffer.height)
  for (let i = 0; i < buffer.data.length; i++) {
    assert.equal(decoded.data[i], buffer.data[i], `byte ${i} differs`)
  }
})

test('decodePNG handles RGB and all five filter types', () => {
  const width = 4
  const height = 3
  for (let filter = 0; filter <= 4; filter++) {
    const decoded = decodePNG(makePng(width, height, 2, makeRawScanlines(width, height, 3, filter)))
    assert.equal(decoded.width, width)
    assert.equal(decoded.height, height)
    const stride = width * 3
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = x * 3
        const di = (y * width + x) * 4
        assert.equal(decoded.data[di], (y * stride + si) % 251, `filter ${filter} R at ${x},${y}`)
        assert.equal(decoded.data[di + 1], (y * stride + si + 1) % 251, `filter ${filter} G at ${x},${y}`)
        assert.equal(decoded.data[di + 2], (y * stride + si + 2) % 251, `filter ${filter} B at ${x},${y}`)
        assert.equal(decoded.data[di + 3], 255, `filter ${filter} A at ${x},${y}`)
      }
    }
  }
})

test('decodePNG rejects a bad signature', () => {
  assert.throws(() => decodePNG(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])), /bad PNG signature/)
})
