# CLAUDE.md — AI Agent Context for ahmedyhussain.com

This document contains non-obvious context for an AI agent picking up this project in a new session.
Read this before touching any code.

---

## What This Project Is

A production personal website for **Ahmed Hussain** — BCom/LLB(Hons) candidate at ANU, Canberra.
Domain: `ahmedyhussain.com`  
Repo: `https://github.com/XtremeBean99/ahmed-site`  
Vercel project: `ahmed-site` (ID: `prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`)

---

## Critical Constraints


### 2. Design must remain strictly monochrome
The design uses zinc-950 (`#09090b`) background, white text, zinc-800 borders. No colour accents.
No gradients except the subtle hero vignette. If you add new UI, match this palette exactly.
References: Vercel, Linear, Stripe aesthetic. Do not introduce any colour.

### 3. All user input is hostile
The contact form has server-side Zod validation, a honeypot field, and DB-based rate limiting.
If you add any new form or API route, apply the same pattern from `src/services/contact.ts`.
Never skip server-side validation even if client validation exists.

### 4. No raw SQL
All DB access goes through Prisma ORM. Never write raw SQL strings.

### 5. Secrets via environment variables only
`DATABASE_URL`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL` are env vars.
They are never hardcoded. Check `.env.example` for the full list.

---

## Architecture in One Page

```
src/
├── app/                   Next.js App Router pages + API routes
│   ├── api/contact/       POST handler — validate, rate-limit, store, email
│   ├── legal/             Terms + Privacy pages
│   ├── projects/          Coming-soon scaffold
│   ├── tutoring/          Full tutoring page (services, pricing, FAQ, form)
│   └── page.tsx           Homepage (7 sections, all static)
│
├── components/
│   ├── layout/            Header (client — scroll state), Footer (server)
│   ├── sections/          One file per homepage section (server components)
│   └── ui/                Button, SectionReveal, ParallaxImage, ContactForm
│
├── lib/
│   ├── prisma.ts          Prisma singleton (safe for serverless hot-reload)
│   ├── resend.ts          Lazy Resend client (does NOT init at module load)
│   ├── validations.ts     Zod schemas — single source of truth for form shapes
│   └── utils.ts           cn() and hashIP()
│
└── services/
    └── contact.ts         Business logic layer — DB rate-limit + create + email
```

**Default to Server Components.** Only add `'use client'` when you need browser APIs,
React state, or Framer Motion hooks. Current client components: Header, SectionReveal,
ParallaxImage, ContactForm.

---

## Database

Provider: **Neon** (serverless PostgreSQL)  
ORM: **Prisma 6**

Models in use today:
- `ContactSubmission` — stores form submissions, used for rate limiting

Pre-built for future use (no data yet):
- `Project`, `Article`, `NewsletterSubscriber`, `TutoringEnquiry`

**Critical for Vercel deploys:** `package.json` has a `"postinstall": "prisma generate"` script.
This runs automatically after `npm install` on Vercel and regenerates the Prisma client types.
Without it, the build fails with `Property 'X' does not exist on type 'PrismaClient'` because
the generated client in `node_modules/@prisma/client` isn't committed to git.
Do not remove the postinstall script.

To push schema changes:
```bash
npx prisma db push           # dev — no migration history
npx prisma migrate dev       # prod — creates a migration file
npx prisma migrate deploy    # apply migrations in production
```

---

## Contact System — How It Works

```
POST /api/contact
  1. Parse JSON body
  2. contactSchema.safeParse() — Zod, server side
  3. Honeypot check (website field must be empty)
  4. submitContact() in src/services/contact.ts
     a. hashIP(ip) — SHA-256, never store raw IP
     b. Count ContactSubmission rows by ipHash in last 1 hour
     c. If >= 3, return { rateLimited: true }
     d. prisma.contactSubmission.create()
     e. sendContactEmail() via Resend (failure is non-fatal)
  5. Return 200 / 429 / 400
```

Rate limit is DB-based so it works across Vercel's stateless serverless instances.
In-memory rate limiting would NOT work on Vercel.

---

## Resend — Important Lazy Init Pattern

`src/lib/resend.ts` creates the Resend client **lazily** (only when `sendContactEmail` is called).
This is intentional — `new Resend(undefined)` throws immediately at module load, which breaks
`next build` when `RESEND_API_KEY` is not set in the build environment.

Do not change this to an eager initialisation.

---

## Fonts

Loaded via `next/font/google` in `src/app/layout.tsx`:
- `Inter` → CSS var `--font-sans` → Tailwind class `font-sans`
- `Playfair Display` → CSS var `--font-serif` → Tailwind class `font-serif`

All `h1`–`h5` elements default to `font-serif` via `globals.css`. Body text is `font-sans`.

---

## Security Headers

Set in `next.config.ts` `headers()` function. Applied to all routes (`source: '/(.*)'`).
Includes: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy, and `X-Robots-Tag: noai, noimageai`.

The CSP uses `unsafe-inline` for scripts — this is a known trade-off with Next.js (which inlines
runtime scripts). To harden further, implement CSP nonces via middleware.

---

## AI Crawler Blocking

`src/app/robots.ts` disallows all major AI training crawlers by name (GPTBot, ClaudeBot,
Google-Extended, PerplexityBot, CCBot, Bytespider, etc.).

The Terms of Use (`/legal/terms`) explicitly prohibits scraping and AI training use.

Do not remove these protections.

---

## Lawyer Image

`public/lawyer.jpg` — source: `a-lawyer-and-a-client-are-writing-on-a-paper-free-photo.JPG`
in the parent project directory. Used in `src/components/sections/About.tsx` as a parallax
element via `ParallaxImage`. Rendered with `grayscale` CSS filter to stay monochrome.

---

## Environment Variables Reference

| Variable | Required | Where set | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | Vercel + local `.env.local` | Neon PostgreSQL connection string |
| `RESEND_API_KEY` | Yes | Vercel + local `.env.local` | Resend API key |
| `CONTACT_TO_EMAIL` | No | Vercel (optional) | Defaults to `ahmedyhussain07@gmail.com` |
| `NEXT_PUBLIC_BASE_URL` | No | Vercel (optional) | Defaults to `https://ahmedyhussain.com` |

See `.env.example` for exact format. **Never commit `.env.local` or `.env`.**

---

## Common Tasks

### Add a new page
Create `src/app/[route]/page.tsx`. Export `metadata` for SEO. Add to `src/app/sitemap.ts`.
Add nav link in `src/components/layout/Header.tsx` if it should appear in navigation.

### Add a new section to the homepage
Create `src/components/sections/NewSection.tsx` (server component by default).
Import and add to `src/app/page.tsx`.

### Change pricing or content
Most copy is hardcoded in the section components. Search for the string you want to change.
Tutoring pricing is in `src/app/tutoring/page.tsx`.

### Run locally
```bash
cp .env.example .env.local   # add real values
npx prisma db push           # first time only
npm run dev
```

### Pre-deploy checks
```bash
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
npm run build        # full production build
```

---

## What Does Not Exist Yet (and Why)

- **Admin dashboard** — intentionally deferred. Infrastructure (Prisma models, service layer,
  clean separation) is ready for it. When building, add under `/app/admin/` with a
  middleware-based auth guard.
- **Projects content** — the `/projects` page is a coming-soon scaffold. Real projects go into
  the `Project` Prisma model and a new `src/app/projects/[slug]/page.tsx` route.
- **Newsletter** — `NewsletterSubscriber` model exists. Needs a signup form and Resend audience.
- **Blog/Articles** — `Article` model exists. Needs a Markdown renderer (consider `next-mdx-remote`
  or `@next/mdx`).

---

## Git History Note

Commits before `fdc7d2c` are the old codebase. Commit `43f63f0` (or similar) is this new build.
Do not cherry-pick or reference the old frontend code. The old backend patterns were used as
reference for the new implementation.
