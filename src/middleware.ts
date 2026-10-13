import { NextResponse, type NextRequest } from 'next/server'

/**
 * Per-request CSP nonce, so script-src no longer needs 'unsafe-inline'.
 * Next reads the nonce back out of the request's Content-Security-Policy
 * header and stamps it on its own inline scripts (the RSC payload and
 * bootstrap), which is why pages render per request (see connection() in
 * the root layout). style-src keeps 'unsafe-inline': React and Framer Motion
 * write inline styles everywhere, and styles cannot run code.
 *
 * next.config.ts still sends the old baseline CSP on every response; on pages
 * the browser enforces both, and this stricter one wins for scripts.
 */
function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    // unsafe-eval only in `next dev` (webpack's dev runtime evals modules).
    // va.vercel-scripts.com serves Speed Insights and Web Analytics.
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes, build assets or files in public/ (anything with an extension).
      source: '/((?!api/|_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)',
      // Link prefetches reuse the page's policy.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
