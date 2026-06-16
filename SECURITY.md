# Security

## Security Headers

All responses include the following HTTP security headers (configured in `next.config.ts`):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera, microphone, geolocation disabled |
| `Content-Security-Policy` | Strict policy, no external scripts |
| `X-Robots-Tag` | `noai, noimageai` |

## Input Validation

- All contact form data is validated on **both** client (React Hook Form + Zod) and server (Zod in API route)
- Server-side validation is authoritative; client-side is UX-only
- Schema defined in `src/lib/validations.ts`
- Never trust client-supplied data

## Anti-Spam Measures

1. **Honeypot field**: A hidden `website` field is included in the form. Legitimate users never see or fill it; bots typically do. A non-empty honeypot silently returns success, so the bot believes it worked.
2. **Server-side validation**: Every submission is re-validated with Zod on the server (see Input Validation); malformed data is rejected with a generic 400.

> Note: request-level rate limiting is not currently implemented. The earlier database-backed rate
> limit was removed when the contact flow became email-only via Resend. See Future Security Work.

## Data Protection

- The site uses no database, so there is no stored personal data and no SQL injection surface
- Contact submissions are delivered as email via Resend and are not persisted
- Secrets (e.g. `RESEND_API_KEY`) are provided via environment variables only — never hardcoded
- `.env*` files are git-ignored

## Error Handling

- API routes return generic error messages to clients — no stack traces, no internal details
- Server-side errors are logged (error message only, no message body) with `console.error`
- The contact service catches email delivery failures without exposing them to the user response

## AI and Scraping Protections

- `robots.txt` explicitly disallows all major AI training crawlers
- `X-Robots-Tag: noai, noimageai` on all responses
- Terms of Use explicitly prohibit scraping and AI training use

## Dependency Security

- Run `npm audit` regularly
- Keep dependencies updated with `npm update`
- No dependencies with known high-severity CVEs at time of build

## Future Security Work

- Add Vercel Firewall rules for additional bot blocking
- Consider Cloudflare Turnstile for the contact form on high-traffic scenarios
- Implement proper CSP nonces to eliminate `unsafe-inline` for scripts
- Reintroduce request-level rate limiting on the contact endpoint (e.g. via Vercel KV or Upstash) if abuse is observed
