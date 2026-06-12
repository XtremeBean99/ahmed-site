# CLAUDE.md — ahmedyhussain.com

This file is for AI coding agents (Claude Code, etc.) starting a new session on this
project. Read it first.

## What this is

Personal website for Ahmed Hussain. Live at `ahmedyhussain.com` (or the Vercel alias
`ahmed-site-zeta.vercel.app`). Built to the spec in `../ahmed-site-kit/SITE_SPEC.md`.

## Stack (fixed — do not substitute)

- Next.js 15, App Router, TypeScript strict, `src/` directory
- Tailwind CSS (dark theme: `#0a0a0f` background, `#2dd4bf` teal accent, `#f59e0b` amber)
- Prisma ORM + PostgreSQL (Neon serverless)
- Auth: `bcryptjs` for password verification, `jose` for JWT session cookie signing
- `resend` for contact-form email delivery
- `framer-motion` v12+ for animation (NOT `motion` — the `motion` npm wrapper has bundler
  issues with Next.js; always import from `framer-motion` directly)
- `lenis` for smooth scrolling
- `react-markdown` + `rehype-sanitize` for blog post rendering
- `zod` for all API input validation
- Fonts: Fraunces (serif headings) + Inter (body) via `next/font`

## Environment variables

All live in Vercel project settings (never in `.env` files committed to git):

| Variable              | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `DATABASE_URL`        | Neon PostgreSQL connection string           |
| `RESEND_API_KEY`      | Resend API key for contact form emails      |
| `CONTACT_TO_EMAIL`    | Email address contact messages are sent to  |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password           |
| `SESSION_SECRET`      | 32+ char random string for JWT signing      |

## Project structure

```
src/
├── app/                  # App Router pages and API routes
│   ├── layout.tsx        # Root layout (fonts, metadata, Shell wrapper)
│   ├── template.tsx      # Page transition animations (crossfade + slide)
│   ├── sitemap.ts        # Dynamic sitemap (force-dynamic — queries DB)
│   ├── robots.ts         # Disallows /admin/ and /api/
│   ├── page.tsx          # Home: hero + stats + projects + posts + CTA
│   ├── about/page.tsx    # About (static)
│   ├── experience/       # Experience page with Timeline component
│   ├── projects/         # Project grid + [slug] detail pages
│   ├── blog/             # Blog list + [slug] post pages
│   ├── contact/          # Contact form page
│   ├── admin/            # Admin section (plain layout, no public chrome)
│   │   ├── layout.tsx    # Overrides Shell — no Nav/Footer for admin
│   │   ├── login/        # Password form (Suspense-wrapped for useSearchParams)
│   │   ├── page.tsx      # Dashboard with counts
│   │   ├── posts/        # CRUD list + new + [id] edit
│   │   ├── projects/     # CRUD list + new + [id] edit
│   │   └── messages/     # Read/mark-read/delete
│   └── api/              # API routes
│       ├── contact/      # POST: zod + rate limit + honeypot + Resend + DB store
│       ├── projects/     # GET: published projects
│       └── admin/        # Session-protected CRUD for posts/projects/messages
├── components/           # All React components
├── lib/                  # Utilities
│   ├── prisma.ts         # Singleton Prisma client
│   ├── auth.ts           # bcrypt verify, JWT sign/verify, cookie helpers
│   ├── rate-limiter.ts   # In-memory token bucket (per-IP, 5 req/min)
│   ├── email.ts          # Resend email sender
│   ├── utils.ts          # formatDate, calculateReadingTime, cn()
│   └── useReducedMotion.ts
└── middleware.ts          # Protects /admin/* except /admin/login
prisma/
├── schema.prisma         # Post, Project, Message models
└── seed.ts               # 3 projects + 1 blog post from WEBSITE_COPY.md
scripts/
└── hash-password.mjs     # bcrypt hash generator
```

## Non-obvious things

### framer-motion import bug
Do NOT `import { motion } from "motion"`. The `motion` package v12+ re-exports from
`framer-motion` but Next.js's bundler doesn't resolve the re-exports correctly at build
time. Always use `import { motion, useScroll, ... } from "framer-motion"` directly.
`framer-motion` is already a dependency.

### Lenis + framer-motion scroll hooks
`useScroll()` from framer-motion reads the native scroll position. Lenis overrides
native scrolling with transforms, so scroll-linked animations (scroll progress bar,
timeline pathLength) may not track smoothly. If this becomes an issue, either remove
Lenis or sync framer-motion's scroll with Lenis's `scroll` event.

### Vercel Deployment Protection
New Vercel accounts have SSO/Authentication enabled by default. If the site returns
a 401 or SSO login page, go to:
Vercel Dashboard → Project Settings → Deployment Protection → disable Vercel Authentication.
This has nothing to do with the app code.

### Admin login Suspense boundary
`/admin/login` uses `useSearchParams()` which requires a `<Suspense>` wrapper in
Next.js 15 production builds. The form logic lives in a `LoginForm` component
wrapped by `Suspense` in the page export. If you refactor this page, keep the
Suspense boundary.

### Sitemap is dynamic
`sitemap.ts` has `export const dynamic = "force-dynamic"` because it queries the
database. Pre-rendering at build time fails on Vercel because `DATABASE_URL` is a
runtime environment variable. Keep it dynamic.

### Database connection pooling
Neon's serverless PostgreSQL works well with Vercel functions, but Prisma's default
connection pool can exhaust Neon's connection limit under heavy load. If scaling up,
add `pgbouncer=true` to the Neon connection string and set Prisma's connection_limit.

### No filesystem writes
The site runs on Vercel serverless functions. Never write to the filesystem at
runtime (no `fs.writeFile`, no local file uploads). All data goes through Prisma
to the database.

### Contact form honeypot
The contact form has a hidden `website` field. If filled (bots auto-fill all fields),
the API returns 200 silently and stores nothing. The field is `aria-hidden="true"`
and `tabIndex={-1}` so real users never see it.

### Admin pages skip public chrome
`Shell.tsx` checks `usePathname()` — if the path starts with `/admin`, it renders
children directly without Nav, Footer, ScrollProgress, or LenisProvider. Admin pages
are plain and functional as the spec requires.

### Dark theme only
There is no light theme. The color scheme is hardcoded to dark. If adding light mode
later, you'll need to refactor all components to use CSS variables or Tailwind's
`dark:` prefix.

## Common commands

```bash
npm run dev              # Start dev server (needs .env with DATABASE_URL)
npm run build            # Production build (needs all env vars)
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Push schema changes to dev database
npx prisma db seed       # Re-run seed script
npx prisma studio        # Open Prisma database browser
node scripts/hash-password.mjs "password"  # Generate bcrypt hash
```

## Deployment

Deployed on Vercel (xtremebean-s-projects1 team). The GitHub repo is connected for
automatic deploys on push to `master`.

To deploy manually: `vercel --prod`
To check logs: `vercel logs <url>`
To check env vars: `vercel env ls`
