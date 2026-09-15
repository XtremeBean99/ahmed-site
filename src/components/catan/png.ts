/**
 * Minimal PNG encode/decode for RGBA and 8-bit RGB, non-interlaced, no DOM or
 * Node imports (browser-safe). Encoding writes filter-0 scanlines and either
 * uses the caller-provided deflate (scripts pass node:zlib.deflateSync) or a
 * dependency-free stored-block zlib stream. Decoding accepts the same choice
 * for inflate and supports all five PNG filter types.
 */

import type { PixelBuffer } from './pixel-art'

export interface PngEncodeOptions {
  /** Returns a zlib-wrapped deflate stream. Defaults to stored (uncompressed) blocks. */
  deflate?: (data: Uint8Array) => Uint8Array
}

export interface PngDecodeOptions {
  /** Decompresses a zlib stream. Defaults to a stored-block only inflate. */
  inflate?: (data: Uint8Array) => Uint8Array
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

let crcTable: Uint32Array | null = null

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

/** Dependency-free zlib stream made of stored (uncompressed) deflate blocks. */
export function zlibStoredCompress(data: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01]
  let offset = 0
  do {
    const end = Math.min(offset + 65535, data.length)
    const len = end - offset
    const final = end === data.length ? 1 : 0
    out.push(final)
    out.push(len & 0xff, (len >>> 8) & 0xff)
    out.push(~len & 0xff, ((~len >>> 8) & 0xff))
    for (let i = offset; i < end; i++) out.push(data[i])
    offset = end
  } while (offset < data.length)
  const adler = adler32(data)
  out.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff)
  return new Uint8Array(out)
}

/** Dependency-free inflate for zlib streams that only contain stored blocks. */
export function zlibStoredDecompress(data: Uint8Array): Uint8Array {
  if (data.length < 6) throw new Error('truncated zlib stream')
  const cmf = data[0]
  const flg = data[1]
  if ((cmf & 0x0f) !== 8) throw new Error('unsupported zlib compression method')
  if (((cmf << 8) + flg) % 31 !== 0) throw new Error('bad zlib header checksum')
  if ((flg & 0x20) !== 0) throw new Error('zlib preset dictionaries are unsupported')
  const out: number[] = []
  let offset = 2
  for (;;) {
    if (offset >= data.length) throw new Error('truncated deflate stream')
    const header = data[offset]
    offset += 1
    const final = header & 1
    const blockType = (header >> 1) & 3
    if (blockType !== 0) throw new Error('compressed deflate blocks need an inflate implementation')
    if (offset + 4 > data.length) throw new Error('truncated stored block header')
    const len = data[offset] | (data[offset + 1] << 8)
    const nlen = data[offset + 2] | (data[offset + 3] << 8)
    offset += 4
    if ((~len & 0xffff) !== nlen) throw new Error('stored block length check failed')
    if (offset + len > data.length) throw new Error('truncated stored block')
    for (let i = 0; i < len; i++) out.push(data[offset + i])
    offset += len
    if (final) break
  }
  if (offset + 4 !== data.length) throw new Error('unexpected trailing zlib data')
  const adler = ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
  const result = new Uint8Array(out)
  if (adler !== adler32(result)) throw new Error('bad zlib adler32 checksum')
  return result
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function writeUint32BE(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function asciiBytes(text: string): number[] {
  return [...text].map((ch) => ch.charCodeAt(0))
}

function chunk(type: string, data: Uint8Array | number[]): Uint8Array {
  const typeBytes = asciiBytes(type)
  const body = new Uint8Array(typeBytes.length + data.length)
  body.set(typeBytes, 0)
  if (Array.isArray(data)) body.set(data, typeBytes.length)
  else body.set(data, typeBytes.length)
  const out = new Uint8Array(12 + data.length)
  out.set(writeUint32BE(body.length - typeBytes.length), 0)
  out.set(body, 4)
  out.set(writeUint32BE(crc32(body)), 4 + body.length)
  return out
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** RGBA 8-bit, non-interlaced PNG encoder. */
export function encodePNG(buffer: PixelBuffer, options: PngEncodeOptions = {}): Uint8Array {
  if (buffer.width <= 0 || buffer.height <= 0) throw new Error('PNG dimensions must be positive')
  if (buffer.data.length !== buffer.width * buffer.height * 4) throw new Error('pixel buffer length mismatch')
  const stride = buffer.width * 4
  const raw = new Uint8Array((stride + 1) * buffer.height)
  for (let y = 0; y < buffer.height; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(buffer.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  const deflate = options.deflate ?? zlibStoredCompress
  const ihdr = new Uint8Array([
    ...writeUint32BE(buffer.width),
    ...writeUint32BE(buffer.height),
    8, // bit depth
    6, // RGBA
    0, // compression
    0, // filter
    0, // interlace
  ])
  const parts = [
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(raw)),
    chunk('IEND', []),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** 8-bit RGB/RGBA, non-interlaced PNG decoder with all five filter types. */
export function decodePNG(bytes: Uint8Array, options: PngDecodeOptions = {}): PixelBuffer {
  if (bytes.length < 8) throw new Error('not a PNG file')
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('bad PNG signature')
  }
  let width = 0
  let height = 0
  let colorType = 0
  const idatParts: Uint8Array[] = []
  let offset = 8
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('truncated PNG chunk header')
    const length = readUint32BE(bytes, offset)
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > bytes.length) throw new Error(`truncated PNG chunk ${type}`)
    const expectedCrc = readUint32BE(bytes, dataEnd)
    if (crc32(bytes.subarray(offset + 4, dataEnd)) !== expectedCrc) throw new Error(`PNG chunk ${type} failed CRC`)
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('bad IHDR length')
      width = readUint32BE(bytes, dataStart)
      height = readUint32BE(bytes, dataStart + 4)
      const bitDepth = bytes[dataStart + 8]
      colorType = bytes[dataStart + 9]
      const interlace = bytes[dataStart + 12]
      if (bitDepth !== 8) throw new Error('only 8-bit PNGs are supported')
      if (colorType !== 2 && colorType !== 6) throw new Error('only RGB and RGBA PNGs are supported')
      if (interlace !== 0) throw new Error('interlaced PNGs are unsupported')
    } else if (type === 'IDAT') {
      idatParts.push(bytes.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      break
    }
    offset = dataEnd + 4
  }
  if (width <= 0 || height <= 0) throw new Error('missing IHDR')
  const idat = new Uint8Array(idatParts.reduce((sum, part) => sum + part.length, 0))
  let idatOffset = 0
  for (const part of idatParts) {
    idat.set(part, idatOffset)
    idatOffset += part.length
  }
  const inflate = options.inflate ?? zlibStoredDecompress
  const raw = inflate(idat)
  const bpp = colorType === 6 ? 4 : 3
  const stride = width * bpp
  if (raw.length !== (stride + 1) * height) throw new Error('PNG scanline length mismatch')
  const out = new Uint8ClampedArray(width * height * 4)
  let prev = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    const filter = raw[rowStart]
    if (filter > 4) throw new Error(`unsupported PNG filter ${filter}`)
    const cur = new Uint8Array(stride)
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? cur[x - bpp] : 0
      const up = prev[x]
      const upLeft = x >= bpp ? prev[x - bpp] : 0
      let value = raw[rowStart + 1 + x]
      if (filter === 1) value = (value + left) & 0xff
      else if (filter === 2) value = (value + up) & 0xff
      else if (filter === 3) value = (value + ((left + up) >> 1)) & 0xff
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 0xff
      cur[x] = value
    }
    prev = cur
    for (let x = 0; x < width; x++) {
      const si = x * bpp
      const di = (y * width + x) * 4
      out[di] = cur[si]
      out[di + 1] = cur[si + 1]
      out[di + 2] = cur[si + 2]
      out[di + 3] = colorType === 6 ? cur[si + 3] : 255
    }
  }
  return { width, height, data: out }
}
