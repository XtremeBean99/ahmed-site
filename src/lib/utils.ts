import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { createHash } from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** SHA-256 hash of an IP address for privacy-safe rate limiting storage. */
export function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}
