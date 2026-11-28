import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // DENY (not SAMEORIGIN): the in-monitor browser was removed (Spec 1, Jul 2026);
  // the site is room-only with no self-iframe.
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
      // unsafe-inline required by Next.js runtime; unsafe-eval only in `next dev`
      // (webpack dev runtime evals modules; production doesn't need it)
      // va.vercel-scripts.com serves both Speed Insights and Web Analytics
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      // 'none': the in-monitor browser was removed (Spec 1, Jul 2026)
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // next/image is never used (it resamples pixel art), so the optimiser stays off.
  // That also closes /_next/image, which has had remote code execution advisories.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/room', destination: '/', permanent: true },
      { source: '/projects/:path*', destination: '/', permanent: true },
      { source: '/tutoring', destination: '/', permanent: true },
      { source: '/games/:path*', destination: '/', permanent: true },
      { source: '/legal/:path*', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig
