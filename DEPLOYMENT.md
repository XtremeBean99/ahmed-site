# Deployment

## Platform

Vercel — project ID `prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`  
Domain: `ahmedyhussain.com`

## Prerequisites

1. A Neon PostgreSQL database (https://neon.tech)
2. A Resend account with API key (https://resend.com)
3. Resend sending domain verified for `ahmedyhussain.com`

## Environment Variables

Set the following in Vercel project settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `RESEND_API_KEY` | Yes | Resend API key for email delivery |
| `CONTACT_TO_EMAIL` | No | Override notification recipient (defaults to `ahmedyhussain07@gmail.com`) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL (defaults to `https://ahmedyhussain.com`) |

## First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local
# Fill in real values

# 3. Run database migrations
npx prisma db push

# 4. Generate Prisma client
npx prisma generate

# 5. Run development server
npm run dev
```

## Database Migrations

For schema changes:
```bash
# Development: push schema changes without migration history
npx prisma db push

# Production: create and apply a migration
npx prisma migrate dev --name describe-the-change
npx prisma migrate deploy
```

## Deploy to Production

Pushing to `main` branch triggers an automatic Vercel production deployment.

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
- [ ] Rate limiting works (submit 4+ times rapidly from same IP)
- [ ] Security headers visible in browser DevTools → Network → Response headers
- [ ] robots.txt accessible at `/robots.txt`
- [ ] sitemap.xml accessible at `/sitemap.xml`
- [ ] All pages load without JS errors in console
- [ ] Mobile layout correct on iOS Safari and Android Chrome
