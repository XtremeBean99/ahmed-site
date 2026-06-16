# Deployment

## Platform

Vercel — project ID `prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`  
Domain: `ahmedyhussain.com`

## Prerequisites

1. A Resend account with an API key (https://resend.com)
2. Resend sending domain verified for `ahmedyhussain.com`

## Environment Variables

Set the following in Vercel project settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key for email delivery |
| `CONTACT_TO_EMAIL` | No | Notification recipient (defaults to `ahmedyhussain07@gmail.com`) |
| `CONTACT_FROM_EMAIL` | No | Sender address; must match a verified Resend domain (defaults to `Ahmed Hussain <noreply@ahmedyhussain.com>`) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL (defaults to `https://ahmedyhussain.com`) |

## First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local
# Fill in real values (Resend API key, etc.)

# 3. Run development server
npm run dev
```

## Litigation Tracker

The `/projects` tracker runs on a typed dataset in `src/lib/litigation` (no database).
To check tracked US dockets for recent activity:
```bash
npm run sync:litigation   # read-only; prints a review queue from CourtListener
```

## Deploy to Production

Pushing to the default branch (`master`) triggers an automatic Vercel production deployment.

To deploy manually via CLI:
```bash
vercel --prod
```

## Build Validation

Before merging to main, run locally:
```bash
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run build        # Full production build
```

## Post-Deployment Checklist

- [ ] Contact form submits successfully and email arrives
- [ ] `/projects` tracker renders, filters work, and case source links open
- [ ] Security headers visible in browser DevTools → Network → Response headers
- [ ] robots.txt accessible at `/robots.txt`
- [ ] sitemap.xml accessible at `/sitemap.xml`
- [ ] All pages load without JS errors in console
- [ ] Mobile layout correct on iOS Safari and Android Chrome
