# Architecture

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion 11 |
| ORM | Prisma 6 |
| Database | PostgreSQL (Neon) |
| Email | Resend |
| Forms | React Hook Form + Zod |
| Deployment | Vercel |

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/contact/        # Contact form API route
│   ├── legal/              # Terms and Privacy pages
│   ├── projects/           # Projects showcase
│   ├── tutoring/           # Tutoring services page
│   ├── layout.tsx          # Root layout (fonts, metadata, header/footer)
│   ├── page.tsx            # Homepage
│   ├── robots.ts           # robots.txt generation
│   └── sitemap.ts          # sitemap.xml generation
├── components/
│   ├── layout/             # Header, Footer (server + client)
│   ├── sections/           # Full-width homepage sections
│   └── ui/                 # Reusable UI primitives
├── lib/
│   ├── prisma.ts           # Prisma singleton
│   ├── resend.ts           # Resend client + email helpers
│   ├── utils.ts            # cn(), hashIP()
│   └── validations.ts      # Zod schemas
├── services/
│   └── contact.ts          # Contact submission business logic
└── types/                  # Shared TypeScript types (future)

prisma/
└── schema.prisma           # Database schema

public/
├── lawyer.jpg              # Legal/professional hero image
└── favicon.svg
```

## Data Flow — Contact Form

```
Client ContactForm (React Hook Form + Zod)
  → POST /api/contact
    → contactSchema.safeParse()         server-side Zod validation
    → honeypot check
    → submitContact() service
      → DB rate-limit check (count by ipHash in last hour)
      → prisma.contactSubmission.create()
      → sendContactEmail() via Resend
    → 200 success / 429 rate-limited / 400 validation error
  → UI success / error state
```

## Component Architecture

- **Server Components** by default for all pages (zero client JS unless needed)
- **`'use client'`** only on: Header (scroll state), SectionReveal, ParallaxImage, ContactForm
- **Section components** are server-side; only animated wrappers are client-side
- **Layout** is static — no dynamic data fetched at layout level

## Future Extension Points

- `Project` and `Article` Prisma models are pre-created for future content
- `NewsletterSubscriber` model ready for a newsletter feature
- `TutoringEnquiry` model available for a dedicated tutoring booking flow
- Service layer (`src/services/`) is isolated from the API layer for easy testing
- Admin dashboard can be added under `/app/admin/` behind an auth middleware
