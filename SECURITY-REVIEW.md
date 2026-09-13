# Security Review — ahmedyhussain.com

**Date:** 7 July 2026 (updated 13 September 2026)
**Scope:** `website/ahmed-site` (Next.js 15 App Router, deployed on Vercel)
**Reviewer:** automated assessment (source-level)
**Status:** Items 1, 2, 4, 6 resolved (7 July). Items 3 & 5 resolved (Upstash rate limiter
shipped in Spec F, v17). See the 13 September 2026 addendum below for current findings —
**item 9 is critical and needs action.**

## Summary

The site is in good shape. All user input flows through server-side Zod validation,
security headers are strong, the guestbook write path is injection-safe (React auto-escapes,
control chars/HTML stripped server-side), and no secrets are committed to git. The rate
limiter now runs on Upstash Redis in production (fixed serverless statefulness, findings 3 & 5
below). The one **critical** issue is an outdated Next.js dependency (finding 9) — patch
immediately.

| # | Finding | Severity | Type | Status |
|---|---------|----------|------|--------|
| 1 | Live Vercel OIDC token present in working tree | Low–Medium | Secret hygiene | ✅ Resolved |
| 2 | Leaderboard scores are client-trusted (spoofable) | Low | Integrity | N/A — ninja game removed from build |
| 3 | In-memory rate limiter is ineffective on serverless | Low | Abuse / DoS | ✅ Resolved (Upstash primary store) |
| 4 | Contact CSRF check skipped when `Origin` header absent | Low | CSRF | N/A — contact form removed; guestbook requires Origin/Referer match in production |
| 5 | Rate-limit key trusts leftmost `X-Forwarded-For` | Info | Abuse | ✅ Resolved (`getClientIp` now uses `x-real-ip`/rightmost XFF) |
| 6 | `dangerouslySetInnerHTML` on translation/JSON-LD strings | Low | Latent XSS | ✅ Resolved (silicon page removed; `JsonLd` escapes `<` and `-->`) |
| 7 | CSP keeps `script-src 'unsafe-inline'` | Low (accepted) | Hardening | Accepted |
| 8 | Dependencies: 2 moderate (build-time only, July review) | Info | Dependencies | Superseded by #9 |
| **9** | **`next@15.5.20` — unauthenticated RCE in Image Optimization API (AVIF)** | **Critical** | **Dependency / RCE** | **Open — patch now** |
| 10 | Unused live credentials sitting in the Vercel project (Postgres/Neon, session secret, admin password hash) | Medium | Attack-surface / blast radius | Open — recommend deletion |

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

### 8. Dependencies — Informational (superseded by #9)
- `react@19.x`, `zod@3.x` current as of July.
- July's "2 moderate PostCSS" note is now superseded by the critical Next.js advisory below.

---

## Addendum — 13 September 2026

### 9. `next@15.5.20` — unauthenticated RCE in the Image Optimization API (AVIF) — Critical
`npm audit` on the installed tree flags [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4):
a critical (CVSS 9.5) unauthenticated remote-code-execution vulnerability in Next.js's built-in
`/_next/image` optimizer, triggered by a flaw in `libheif`/`sharp` when processing AVIF input.

- **Affected:** Next.js 10.0.0–15.5.23 and 16.0.0–16.3.2. **Installed: 15.5.20** (confirmed via
  `npm list next` and the dev server banner) — squarely in the vulnerable range.
- **Fixed in:** 15.5.24 (also 16.3.3). `package.json` pins `^15.1.0`, so a plain
  `npm install` today should already resolve to a patched 15.x once available — the lockfile
  simply predates the fix release.
- **Why this project is exposed:** `next.config.ts` explicitly enables
  `images: { formats: ['image/avif', 'image/webp'] }`. The `/_next/image` route is part of the
  Next.js server itself — reachable regardless of whether `next/image` is used in room
  components (it deliberately isn't, per Critical Constraint 6 — pixel art uses raw `<img>`).
  Any Vercel deployment on an unpatched build is exposed to unauthenticated attackers on the
  open internet.
- **Fix:**
  ```bash
  npm install next@latest   # within ^15.1.0, resolves to the patched 15.5.x
  npm run type-check && npm run lint && npm run build
  git add package.json package-lock.json
  git commit -m "fix: patch Next.js RCE (GHSA-2xp9-vwfh-vxw4)"
  git push   # redeploy on Vercel
  ```
  There is no code-level workaround short of upgrading — Vercel's own patched builds disable
  AVIF optimization internally until the upstream `libheif` fix lands, so upgrading is both
  the fix and the mitigation.
- A related critical advisory, [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36)
  (path-traversal RCE on Windows-hosted Next.js servers, same affected/fixed range), does not
  apply to the Linux-based Vercel deployment but is resolved by the same upgrade.

### 10. Unused live credentials in the Vercel project — Medium
`vercel env ls` shows ~28 environment variables on the `ahmed-site` project. Cross-referencing
against every `process.env.*` reference in `src/` and `scripts/` (both `master` and the stale
`assessment-cleanup` branch) and `package.json`'s dependencies (no `pg`/`postgres`/`neon`/`prisma`
package is installed) shows only three variables are actually read by any code path:
`GUESTBOOK_ADMIN_KEY`, and `KV_REST_API_URL`/`KV_REST_API_TOKEN` (read as a fallback alias for
`UPSTASH_REDIS_REST_URL`/`_TOKEN` in `src/lib/redis.ts` and `src/lib/ratelimit.ts`).

Everything else — a full Postgres/Neon credential set (`DATABASE_URL` in four environments,
20 `Vercel_Storage_*` vars), `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `CONTACT_TO_EMAIL`,
`RESEND_API_KEY` (confirmed retired, Spec 1), `KV_REST_API_READ_ONLY_TOKEN`, `REDIS_URL`, and
`KV_URL` — is unreferenced by this codebase in any branch.

- **Impact:** not itself an active exploit path (Vercel encrypts these at rest and the app never
  reads or logs them), but it's unnecessary blast radius: a real database connection string, a
  password hash, and a session-signing secret sit exposed to anyone with project/team access for
  no functional reason, and nothing in this repo would notice or care if they were rotated,
  leaked, or misused elsewhere. `SESSION_SECRET`/`ADMIN_PASSWORD_HASH`/`DATABASE_URL` don't match
  any feature this codebase has ever had (no DB client dependency, no session auth — the
  guestbook's only auth is `GUESTBOOK_ADMIN_KEY`), so they most likely belong to an abandoned
  experiment or a different project that got connected to this one by mistake.
- **Fix:** delete the unused variables from the Vercel project (see the step-by-step below).
  Removing a project's env var only unlinks it from that project — it does not delete the
  underlying Neon database or any other resource, so this is safe even if that storage is still
  used elsewhere in the Vercel team.

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

1. **Upgrade `next` to 15.5.24+ and redeploy (finding 9) — do this first, today.**
2. Delete the unused Vercel env vars (finding 10) — see step-by-step below.
3. ~~Delete `.vercel/.env.production.local`~~ ✅ Done 7 July 2026.
4. ~~Move rate limiting to Upstash Redis~~ ✅ Done (Spec F, v17).
5. ~~Decide and document the leaderboard trust model~~ N/A — ninja game removed.
6. ~~Escape `<` in `JsonLd`, and require Origin/Referer~~ ✅ Done 7 July 2026.
5. Keep dependencies patched; consider nonce-based CSP later (findings 7 & 8).
