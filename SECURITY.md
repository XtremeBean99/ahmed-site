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

1. **Honeypot field**: A hidden `website` field is included in the form. Legitimate users never see or fill it; bots typically do. Non-empty honeypot silently returns success.
2. **DB-based rate limiting**: The contact API checks `ContactSubmission` count by hashed IP in the last 60 minutes. Maximum 3 submissions per IP per hour. Enforced in `src/services/contact.ts`.
3. **IP hashing**: IPs are SHA-256 hashed before storage — the hash cannot be reversed. This gives abuse detection without storing PII.

## Data Protection

- All database queries use Prisma ORM — no raw SQL, no SQL injection surface
- Parameterised queries by default
- Secrets (DATABASE_URL, RESEND_API_KEY) via environment variables only — never hardcoded
- `.env` is in `.gitignore`

## Error Handling

- API routes return generic error messages to clients — no stack traces, no internal details
- Server-side errors are logged (error message only, no message body) with `console.error`
- The contact service catches email delivery failures without exposing them to the user response

## AI and Scraping Protections

- `robots.txt` explicitly disallows all major AI training crawlers
- `X-Robots-Tag: noai, noimageai` on all responses
- Terms of Use explicitly prohibit scraping and AI training use
- Rate limiting on all API routes limits bulk data collection

## Dependency Security

- Run `npm audit` regularly
- Keep dependencies updated with `npm update`
- No dependencies with known high-severity CVEs at time of build

## Future Security Work

- Add Vercel Firewall rules for additional bot blocking
- Consider Cloudflare Turnstile for the contact form on high-traffic scenarios
- Implement proper CSP nonces to eliminate `unsafe-inline` for scripts
- Audit and harden rate limits if abuse is observed
