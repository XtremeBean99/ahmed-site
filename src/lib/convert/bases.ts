/**
 * Pure number-base conversion. Everything funnels through a single canonical
 * non-negative `BigInt`, so the four numeric bases are exact two-way
 * representations of one another. Text is encoded/decoded as UTF-8 bytes
 * interpreted big-endian.
 *
 * Parsers return `null` on invalid input rather than throwing, so the UI can
 * flag the edited field without disturbing the others.
 */

export type Base = 'dec' | 'bin' | 'oct' | 'hex'
export type Field = Base | 'text'

const RADIX: Record<Base, number> = { dec: 10, bin: 2, oct: 8, hex: 16 }

const PATTERN: Record<Base, RegExp> = {
  dec: /^[0-9]+$/,
  bin: /^[01]+$/,
  oct: /^[0-7]+$/,
  hex: /^[0-9a-f]+$/i,
}

const PREFIX: Record<Base, RegExp> = {
  dec: /^$/, // no prefix
  bin: /^0b/i,
  oct: /^0o/i,
  hex: /^0x/i,
}

/** Parse a string in the given base into a non-negative BigInt, or null. */
export function parseToBigInt(raw: string, base: Base): bigint | null {
  let s = raw.trim().replace(/[\s_,]/g, '')
  if (s === '') return null
  if (s.startsWith('+')) s = s.slice(1)
  if (base !== 'dec' && PREFIX[base].test(s)) s = s.slice(2)
  if (s === '' || !PATTERN[base].test(s)) return null
  try {
    let value = 0n
    const r = BigInt(RADIX[base])
    for (const ch of s) value = value * r + BigInt(parseInt(ch, RADIX[base]))
    return value
  } catch {
    return null
  }
}

/** Format a non-negative BigInt in the given base. Hex is upper-cased. */
export function formatBigInt(value: bigint, base: Base): string {
  const s = value.toString(RADIX[base])
  return base === 'hex' ? s.toUpperCase() : s
}

/* ---- Text ↔ value (UTF-8, big-endian) ---- */

export function textToBigInt(text: string): bigint {
  const bytes = new TextEncoder().encode(text)
  let value = 0n
  for (const b of bytes) value = (value << 8n) | BigInt(b)
  return value
}

export function bigIntToText(value: bigint): string {
  if (value <= 0n) return ''
  const out: number[] = []
  let v = value
  while (v > 0n) {
    out.unshift(Number(v & 0xffn))
    v >>= 8n
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(out))
}

/** Derive every field's display string from the canonical value. */
export function deriveAll(value: bigint): Record<Field, string> {
  return {
    dec: formatBigInt(value, 'dec'),
    bin: formatBigInt(value, 'bin'),
    oct: formatBigInt(value, 'oct'),
    hex: formatBigInt(value, 'hex'),
    text: bigIntToText(value),
  }
}

/** Bit length of a non-negative value (0 → 0). */
export function bitLength(value: bigint): number {
  return value <= 0n ? 0 : value.toString(2).length
}
