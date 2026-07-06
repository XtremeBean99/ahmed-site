import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // SAMEORIGIN (not DENY): the desk view on `/` renders site pages inside a
  // same-origin <iframe> ("site in the monitor"). Third-party embedding
  // remains blocked by both this header and frame-ancestors 'self' below.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Instruct AI crawlers not to index or use content for training
  { key: 'X-Robots-Tag', value: 'noai, noimageai' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-inline required by Next.js runtime; unsafe-eval removed (not needed in production)
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      // 'self' (not 'none'): required for the in-monitor iframe on `/`
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

// The Ninja game files are served as a standalone top-level page (not in an iframe).
// The game opens via a link so it runs in its own browsing context with no embedding
// restrictions. COOP + COEP and blob: CSP permissions are set via vercel.json (which
// reliably applies to static public/ files) rather than here.

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
