import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
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
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

// The Ninja game's index.html is embedded in an <iframe> on /games/ninja and
// /projects/ninja (same origin). The site-wide X-Frame-Options: DENY and
// frame-ancestors 'none' above would block that iframe from rendering even
// though the frame and the framed page share an origin, so this path gets a
// same-origin-only override instead of the blanket deny.
// Godot's Emscripten output also spawns blob: URL Web Workers for audio worklets,
// so worker-src and script-src must include blob: here.
// COOP + COEP are also required: Godot 4's threaded WASM build needs SharedArrayBuffer,
// which is only available in a cross-origin isolated context. crossOriginIsolated becomes
// true only when the entire browsing context (outer page + iframe) opts in via these headers.
// credentialless is used instead of require-corp so any cross-origin sub-resources can still
// load without needing an explicit Cross-Origin-Resource-Policy response header.
const gameEmbedHeaders = [
  ...securityHeaders.map((header) => {
    if (header.key === 'X-Frame-Options') {
      return { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
    }
    if (header.key === 'Content-Security-Policy') {
      return {
        key: 'Content-Security-Policy',
        value: header.value
          .replace("frame-ancestors 'none'", "frame-ancestors 'self'")
          .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' blob:")
          .replace("connect-src 'self'", "connect-src 'self' blob:")
          + "; worker-src 'self' blob:",
      }
    }
    return header
  }),
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
]

// The outer pages that host the game iframe also need COOP + COEP; the iframe's
// window.crossOriginIsolated is only true when the parent browsing context is
// cross-origin isolated as well.
const gamePageHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
]

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
      {
        source: '/games/ninja/:path*',
        headers: gameEmbedHeaders,
      },
      {
        source: '/games/ninja',
        headers: gamePageHeaders,
      },
      {
        source: '/projects/ninja',
        headers: gamePageHeaders,
      },
    ]
  },
}

export default nextConfig
