# Security status: ahmedyhussain.com

**Last updated:** 28 November 2026. This was a dependency and configuration pass, not a fresh source audit. The
July and September 2026 review it replaces covered pages and routes that no longer exist; read it with
`git show 955d279:SECURITY-REVIEW.md`.

## Open

| Item | Severity | What to do |
|---|---|---|
| A Neon Postgres integration is still connected in Vercel. It adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to preview deployments, and nothing in this repo uses a database. | Medium (unused credentials) | Disconnect the integration in the Vercel dashboard. |

## Fixed on 28 November 2026

- Next.js 15.5.29, clearing GHSA-2464-fhr4-w9xw (critical, image optimisation) and the related advisories.
- Zod 4.6.7, clearing GHSA-mrhx-c7xc-m3w5. `npm audit` reported no vulnerabilities.
- The image optimiser is off (`images.unoptimized`), since nothing uses `next/image`.
- Unused Google Fonts allowances removed from the Content-Security-Policy.
- The Privacy Policy now describes the score boards, feature requests and analytics.

## Fixed earlier

- Per-request CSP nonce, so page scripts no longer need `'unsafe-inline'` (v28).
- Rate limits in Upstash, with the client IP taken from `x-real-ip` or the rightmost forwarded hop.
- CSRF requires a matching Origin or Referer; `JsonLd` is escaped against `</script>` breakout.
- The live Vercel token in the working tree was deleted; the retired contact form and Ninja leaderboard are gone.
- The unused database, session and admin-password variables from the September review are gone, apart from the
  Neon item above.

## Accepted

- `style-src 'unsafe-inline'`: React and Framer Motion write inline styles.
- Non-page responses keep the baseline CSP from `next.config.ts`, which still has `script-src 'unsafe-inline'`.
- Scores are reported by the browser; range checks keep out junk, not a determined cheat.

How the input routes are protected is in [CLAUDE.md](CLAUDE.md) (Critical constraints and Security).
