# Architecture

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion 11 |
| Email | Resend (contact form) |
| Forms | React Hook Form + Zod |
| Tracker data | Typed module in `src/lib/litigation` (no database) |
| Version control | Git + GitHub |
| Deployment | Vercel |

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/contact/        # Contact form API route (validate, honeypot, email)
│   ├── legal/              # Terms and Privacy pages
│   ├── projects/           # AI & Cyber Litigation Tracker (flagship)
│   ├── tutoring/           # Tutoring services page
│   ├── layout.tsx          # Root layout (fonts, metadata, header/footer)
│   ├── page.tsx            # Homepage
│   ├── robots.ts           # robots.txt generation (blocks AI crawlers)
│   └── sitemap.ts          # sitemap.xml generation
├── components/
│   ├── layout/             # Header (client), Footer (server)
│   ├── projects/           # Tracker UI: StatCounters, CaseList
│   ├── sections/           # Full-width homepage sections
│   └── ui/                 # Reusable UI primitives (incl. CircuitMesh)
├── lib/
│   ├── litigation/         # Tracker dataset + types (types.ts, data.ts)
│   ├── resend.ts           # Resend client + email helper (lazy init)
│   ├── utils.ts            # cn()
│   └── validations.ts      # Zod schemas
└── services/
    └── contact.ts          # Contact submission logic (sends email via Resend)

scripts/
└── sync-litigation.ts      # CourtListener review helper (read-only)

public/                     # Static images and assets
```

The site currently uses **no database**. The `src/lib/litigation` dataset is a typed
module compiled into the build. A database and ORM can be reintroduced later if needed.

## Data Flow — Contact Form

```
Client ContactForm (React Hook Form + Zod)
  → POST /api/contact
    → contactSchema.safeParse()     server-side Zod validation
    → honeypot check (hidden `website` field)
    → submitContact() service
      → sendContactEmail() via Resend
    → 200 success / 400 validation error / 500 send failure
  → UI success / error state
```

There is no database. The contact form emails directly via Resend; submissions are not stored.

## Component Architecture

- **Server Components** by default for all pages (zero client JS unless needed)
- **`'use client'`** only where interactivity is needed: Header (scroll state), SectionReveal,
  ParallaxImage, ContactForm, and the tracker's StatCounters, CaseList and CircuitMesh
- **Section components** are server-side; only animated/interactive parts are client-side
- **Layout** is static — no dynamic data fetched at layout level

## Future Extension Points

- The site currently uses no database. If persistent storage is later needed (newsletter,
  stored enquiries, an admin dashboard), a database and ORM (e.g. Prisma + Postgres) can be
  reintroduced behind the existing service layer.
- The litigation tracker runs on a typed dataset (`src/lib/litigation`). It can later be migrated
  to a database-backed model and an admin route under `/app/admin/` behind auth middleware.
- The service layer (`src/services/`) is isolated from the API layer for easy testing.
- The CourtListener review script (`npm run sync:litigation`) keeps the tracker current; it is
  read-only and a human verifies updates before they are published.
