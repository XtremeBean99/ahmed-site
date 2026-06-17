/**
 * Pure bitwise operations over non-negative BigInts. NOT is masked to the
 * operand width (min 8 bits) so the result stays a sensible, displayable
 * non-negative value rather than an infinite two's-complement tail.
 */

export type BitOp = 'and' | 'or' | 'xor' | 'not' | 'shl' | 'shr'

export const BIT_OPS: { op: BitOp; symbol: string; label: string; unary?: boolean }[] = [
  { op: 'and', symbol: '&', label: 'AND' },
  { op: 'or', symbol: '|', label: 'OR' },
  { op: 'xor', symbol: '^', label: 'XOR' },
  { op: 'not', symbol: '~', label: 'NOT', unary: true },
  { op: 'shl', symbol: '<<', label: 'Left shift' },
  { op: 'shr', symbol: '>>', label: 'Right shift' },
]

/** Max shift distance we allow, to avoid pathological huge allocations. */
const MAX_SHIFT = 1024n

function width(value: bigint): number {
  const len = value <= 0n ? 0 : value.toString(2).length
  return Math.max(8, len)
}

/** Apply a bitwise op. `b` is ignored for the unary NOT. */
export function applyBitwise(op: BitOp, a: bigint, b: bigint): bigint {
  switch (op) {
    case 'and':
      return a & b
    case 'or':
      return a | b
    case 'xor':
      return a ^ b
    case 'not': {
      const mask = (1n << BigInt(width(a))) - 1n
      return ~a & mask
    }
    case 'shl': {
      const n = b > MAX_SHIFT ? MAX_SHIFT : b
      return a << n
    }
    case 'shr':
      return a >> b
  }
}
