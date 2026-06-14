import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { createHash } from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** SHA-256 hash of an IP address for privacy-safe rate limiting storage.
 *  Salt via RATE_LIMIT_SALT env var to prevent rainbow-table reversal. */
export function hashIP(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? ''
  return createHash('sha256').update(salt + ip).digest('hex')
}
