# Security Review — ahmedyhussain.com

**Date:** 7 July 2026
**Scope:** `website/ahmed-site` (Next.js 15 App Router, deployed on Vercel)
**Reviewer:** automated assessment (source-level)
**Status:** Items 1, 2, 4, 6 resolved (same day). Items 3 & 5 tracked in roadmap.

## Summary

The site is in good shape. All user input flows through server-side Zod validation,
security headers are strong, the contact email path is injection-safe, and no secrets are
committed to git. There are **no critical or high-severity issues**. The findings below are
mostly low-severity hardening items and one local hygiene issue worth fixing now.

| # | Finding | Severity | Type | Status |
|---|---------|----------|------|--------|
| 1 | Live Vercel OIDC token present in working tree | Low–Medium | Secret hygiene | ✅ Resolved |
| 2 | Leaderboard scores are client-trusted (spoofable) | Low | Integrity | ✅ Documented |
| 3 | In-memory rate limiter is ineffective on serverless | Low | Abuse / DoS | → Roadmap #15 |
| 4 | Contact CSRF check skipped when `Origin` header absent | Low | CSRF | ✅ Resolved |
| 5 | Rate-limit key trusts leftmost `X-Forwarded-For` | Info | Abuse | → Roadmap #15 |
| 6 | `dangerouslySetInnerHTML` on translation/JSON-LD strings | Low | Latent XSS | ✅ Resolved |
| 7 | CSP keeps `script-src 'unsafe-inline'` | Low (accepted) | Hardening | Accepted |
| 8 | Dependencies: 2 moderate (build-time only) | Info | Dependencies | Monitor |

---

## Findings

### 1. Live Vercel OIDC token in the working tree — Low–Medium
`.vercel/.env.production.local` contains a real signed `VERCEL_OIDC_TOKEN` (a JWT). It is
**not committed** — `.gitignore` correctly ignores `.vercel` and `.env*`, and git history
confirms it was never tracked. However, the live token sits in plaintext on disk in the
project folder.

- **Impact:** the token is `environment:development`-scoped and short-lived (~12 h), so
  practical exposure is limited and it is very likely already expired. Risk arises only if the
  folder is zipped, backed up, screen-shared, or synced somewhere.
- **Fix:** delete the file — it is regenerated on demand by `vercel env pull` / the Vercel CLI.
  This is already tracked as roadmap item 15 in `CLAUDE.md`.

```bash
rm .vercel/.env.production.local
```

### 2. Leaderboard scores are client-trusted — Low
`POST /api/ninja/leaderboard` accepts `{name, timeCs, tokensPercent}` from the game client with
only *range* validation (`src/lib/validations.ts`). There is no proof-of-play, signature, or
auth, so anyone can submit a fabricated run (e.g. a 10.00 s "100%" clear under any name) with a
single curl request that passes validation.

- **Impact:** low — it is a cosmetic game leaderboard with no privileges or money attached. But
  the leaderboard cannot be trusted as genuine.
- **Options:** accept and document the limitation; or sign runs with a server-issued HMAC over
  gameplay events; or validate plausibility server-side. Given the stakes, documenting it is a
  reasonable choice.

### 3. In-memory rate limiter is ineffective on serverless — Low
`src/lib/ratelimit.ts` stores counters in a per-process `Map`. On Vercel each cold start / each
concurrent function instance has its own empty store, so the advertised "5 requests/hour" limit
is not enforced globally and is bypassable at scale. This governs both the contact form and the
leaderboard.

- **Impact:** contact-form email spam to the owner's inbox; leaderboard flooding. No data loss.
- **Fix:** move the limiter to Upstash Redis (already a project dependency) with a sliding-window
  counter keyed by IP. Already tracked as roadmap item 15.

### 4. Contact CSRF check is skipped when `Origin` is absent — Low
In `src/app/api/contact/route.ts` the origin check is guarded by `origin && …`. A request with
no `Origin` header skips the cross-origin rejection entirely.

- **Impact:** low. Browsers always send `Origin` on cross-site POSTs, so real CSRF is still
  blocked; and the endpoint's only effect is emailing the owner. A non-browser client without
  `Origin` isn't performing CSRF anyway.
- **Fix (optional):** require a valid `Origin` *or* `Referer` in production rather than treating
  "absent" as trusted.

### 5. Rate-limit key trusts leftmost `X-Forwarded-For` — Informational
Both routes derive the client IP from `x-forwarded-for.split(',')[0]`. On Vercel this value is
set by the platform edge and is generally trustworthy, so spoofing is limited — but combined
with finding #3 the per-IP limit is already weak. Revisit alongside the Redis limiter.

### 6. `dangerouslySetInnerHTML` on translation / JSON-LD strings — Low (latent)
Used in `src/app/(site)/projects/silicon/page.tsx` (renders dictionary strings containing
markup) and `src/components/seo/JsonLd.tsx` (serialised metadata). **Currently safe** — all
inputs are author-controlled static content, never user input.

- **Latent risk:** if any of those strings ever incorporate user-supplied data, it becomes a
  stored/reflected XSS. Keep the "author-controlled only" invariant.
- **Defense in depth:** `JsonLd` should escape `<` as `<` in the serialised JSON so a
  future value containing `</script>` cannot break out of the script tag.

### 7. CSP retains `script-src 'unsafe-inline'` — Low (accepted trade-off)
`next.config.ts` keeps `unsafe-inline` for scripts (a known Next.js requirement without nonces).
This weakens the XSS mitigation value of the CSP. Roadmap already notes CSP nonces as future
work. `unsafe-eval` has correctly been removed for production. No action required unless you
want to invest in nonce-based CSP.

### 8. Dependencies — Informational
- `next@15.5.19` (current; includes fixes for the 2025 middleware auth-bypass and cache CVEs),
  `react@19.2.7`, `zod@3.25.76` — all current.
- `npm audit` reports **2 moderate** advisories, both the build-time PostCSS `</style>`
  stringify issue. PostCSS runs only at build, not at runtime, so there is no runtime exposure.
- Keep dependencies patched; nothing urgent.

---

## What's already done well

- **Server-side Zod validation** on every input (`validations.ts`), with length caps and a
  strict name regex on leaderboard entries.
- **Contact email is injection-safe:** plaintext body (no HTML injection), subject stripped of
  control chars, `replyTo` is a validated email (no header/CRLF injection).
- **Strong security headers** (`next.config.ts`): HSTS with preload, `X-Frame-Options`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a CSP with `frame-ancestors 'self'`,
  `base-uri 'self'`, `form-action 'self'`.
- **Secrets via environment variables only**; `.gitignore` is correct and nothing sensitive is
  committed.
- **Lazy client init** for Resend and Redis (build-safe, no secrets at module load).
- **No SQL / no `eval`**; the GitHub integration is read-only and filters out private/fork repos.
- Honeypot field plus validation on the contact form.

## Recommended next steps (priority order)

1. ~~Delete `.vercel/.env.production.local`~~ ✅ Done 7 July 2026.
2. Move rate limiting to Upstash Redis (findings 3 & 5) — tracked as roadmap item #15.
3. ~~Decide and document the leaderboard trust model~~ ✅ Documented in route source, 7 July 2026.
4. ~~Escape `<` in `JsonLd`, and require Origin/Referer in the contact route~~ ✅ Done 7 July 2026.
5. Keep dependencies patched; consider nonce-based CSP later (findings 7 & 8).
