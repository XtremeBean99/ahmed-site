/**
 * Lightweight ID3v2 parser — extracts embedded cover art (APIC frame)
 * from an MP3 file. Reads only the tag header from the start of the file.
 * No dependencies, pure JS.
 */

interface ID3Cover {
  mime: string
  data: Uint8Array
}

/** Fetch the first `bytes` bytes of a URL and look for an APIC frame. */
export async function extractCoverFromMp3(src: string): Promise<ID3Cover | null> {
  try {
    // Fetch enough bytes to cover the tag (ID3v2 tags are typically < 128 KB)
    const resp = await fetch(src, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok || !resp.body) return null

    const reader = resp.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    const MAX = 256 * 1024 // 256 KB — enough for any embedded art

    while (total < MAX) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        total += value.length
      }
      // After we have enough for a tag header + potential APIC, stop early
      // if we've already found the tag. But we keep reading in case APIC is later.
    }
    reader.cancel()

    const buf = concatChunks(chunks, total)
    return parseID3v2(buf)
  } catch {
    return null
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function parseID3v2(buf: Uint8Array): ID3Cover | null {
  if (buf.length < 10) return null

  // Check ID3v2 magic
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return null // "ID3"

  const majorVer = buf[3]
  if (majorVer < 2 || majorVer > 4) return null

  // Read syncsafe size (4 bytes, bit 7 ignored)
  const size =
    ((buf[6] & 0x7f) << 21) |
    ((buf[7] & 0x7f) << 14) |
    ((buf[8] & 0x7f) << 7) |
    (buf[9] & 0x7f)

  let offset = 10

  // Skip extended header if present (v2.4+)
  // In v2.3, extended header is different. We'll handle common cases.
  if (majorVer >= 3) {
    const flags = buf[5]
    const hasExtendedHeader = (flags & 0x40) !== 0
    if (hasExtendedHeader && offset + 4 <= buf.length) {
      const extSize =
        ((buf[offset] & 0x7f) << 21) |
        ((buf[offset + 1] & 0x7f) << 14) |
        ((buf[offset + 2] & 0x7f) << 7) |
        (buf[offset + 3] & 0x7f)
      offset += 4 + extSize
    }
  }

  const tagEnd = offset + size

  // Walk frames looking for APIC
  while (offset + 10 <= buf.length && offset < tagEnd) {
    // Check for padding (null bytes)
    if (buf[offset] === 0x00) {
      offset++
      continue
    }

    let frameId: string
    let frameSize: number

    if (majorVer >= 3) {
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3])
      if (majorVer === 4) {
        frameSize =
          ((buf[offset + 4] & 0x7f) << 21) |
          ((buf[offset + 5] & 0x7f) << 14) |
          ((buf[offset + 6] & 0x7f) << 7) |
          (buf[offset + 7] & 0x7f)
      } else {
        frameSize =
          (buf[offset + 4] << 24) |
          (buf[offset + 5] << 16) |
          (buf[offset + 6] << 8) |
          buf[offset + 7]
      }
      offset += 10
    } else {
      // v2.2 — 3-char frame IDs
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2])
      frameSize =
        (buf[offset + 3] << 16) |
        (buf[offset + 4] << 8) |
        buf[offset + 5]
      offset += 6
    }

    if (frameSize <= 0 || offset + frameSize > buf.length) break

    // Valid frame ID?
    if (!/^[A-Z0-9]{3,4}$/.test(frameId)) break

    if (frameId === 'APIC' || frameId === 'PIC') {
      // Found cover art!
      let pos = offset

      // Skip text encoding byte
      pos++

      let mime = ''
      if (frameId === 'APIC') {
        // Read null-terminated MIME type
        while (pos < offset + frameSize && buf[pos] !== 0x00) {
          mime += String.fromCharCode(buf[pos])
          pos++
        }
        pos++ // skip null terminator
      } else {
        // PIC: skip format byte, then read 3-char format
        pos++ // skip picture type
        const ext = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2])
        mime = ext === 'JPG' ? 'image/jpeg' : ext === 'PNG' ? 'image/png' : 'image/' + ext.toLowerCase()
        pos += 3
      }

      // Skip picture type byte for APIC
      if (frameId === 'APIC') pos++

      // Skip description (null-terminated string)
      while (pos < offset + frameSize && buf[pos] !== 0x00) pos++
      pos++ // skip null

      // Remaining bytes are the image data
      const imgLen = offset + frameSize - pos
      if (imgLen > 0) {
        const imgData = new Uint8Array(buf.slice(pos, pos + imgLen))
        return { mime: mime || 'image/jpeg', data: imgData }
      }
      return null
    }

    offset += frameSize
  }

  return null
}
