# ahmedyhussain.com

Personal website of **Ahmed Hussain** — BCom/LLB(Hons) candidate at the Australian National University, working at the intersection of law, computing, and AI governance.

**[ahmedyhussain.com](https://ahmedyhussain.com)**

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion 11 + Three.js (React Three Fiber) |
| Email | Resend (contact form) |
| Forms | React Hook Form + Zod |
| Tracker data | Typed module in `src/lib/litigation` (no database) |
| Deployment | Vercel |

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Fill in real values (Resend API key, etc.)

# Run development server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key for email delivery |
| `CONTACT_TO_EMAIL` | No | Notification recipient (defaults to `ahmedyhussain07@gmail.com`) |
| `CONTACT_FROM_EMAIL` | No | Sender address; must match a verified Resend domain |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL (defaults to `https://ahmedyhussain.com`) |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/contact/        # Contact form API route
│   ├── games/              # Games hub + typing test + breakout
│   ├── legal/              # Terms and Privacy pages
│   ├── projects/           # Projects hub + litigation tracker
│   ├── tutoring/           # Tutoring services page
│   ├── layout.tsx          # Root layout (fonts, metadata, CircuitMesh backdrop)
│   ├── template.tsx        # Per-route transition wrapper (client)
│   ├── page.tsx            # Homepage
│   ├── robots.ts           # robots.txt (blocks AI crawlers)
│   └── sitemap.ts          # sitemap.xml
├── components/
│   ├── games/              # TypingTest, Breakout, GameShell, GameStat (client)
│   ├── layout/             # Header (client), Footer (server)
│   ├── projects/           # Tracker UI: StatCounters, CaseList
│   ├── sections/           # Homepage sections (server components)
│   └── ui/                 # Reusable primitives (CircuitMesh, SectionReveal, MotionCard)
├── lib/
│   ├── games/              # Game logic: phrases, wpm, breakout-engine, storage, types
│   ├── litigation/         # Tracker dataset + types
│   ├── motion.ts           # Shared Framer Motion tokens and variants
│   ├── resend.ts           # Resend client + email helper (lazy init)
│   ├── utils.ts            # cn() utility
│   └── validations.ts      # Zod schemas
└── services/
    └── contact.ts          # Contact submission logic

scripts/
└── sync-litigation.ts      # CourtListener review helper (read-only)
```

## Design System

- **Monochrome only**: zinc-950 (`#09090b`) background, white text, zinc-800 borders. No colour accents.
- **Fonts**: Inter (body) + Playfair Display (headings), loaded via `next/font/google`
- **Defaults to Server Components** — `'use client'` only for interactivity (Header, animations, forms)
- **CircuitMesh**: Animated 3D canvas backdrop rendered site-wide behind all content
- **Respects `prefers-reduced-motion`**: animations honour the user's OS preference

## Contact Form

```
POST /api/contact
  → Zod validation (server-side)
  → Honeypot check (hidden `website` field)
  → submitContact() → sendContactEmail() via Resend
  → 200 / 400 / 500
```

The site uses no database. Contact submissions are emailed via Resend and not persisted.

## Litigation Tracker

The AI & Cyber Litigation Tracker at `/projects/litigation-tracker` runs on a curated, source-cited dataset in `src/lib/litigation/data.ts`. To check tracked US dockets for recent activity:

```bash
npm run sync:litigation   # read-only; prints a review queue from CourtListener
```

Human review is required before publishing updates — the script is read-only by design.

## Games

The Games section at `/games` has two self-contained browser games:

- **Typing speed test** (`/games/typing-test`) — live WPM and accuracy over curated law, AI governance, and cybersecurity phrases (`src/lib/games/phrases.ts`).
- **Breakout** (`/games/breakout`) — a monochrome canvas game with falling power-ups (wider paddle, multi-ball, slow ball, extra life).

Game logic lives in `src/lib/games/` as side-effect-free modules (`wpm.ts`, `breakout-engine.ts`) with thin `'use client'` render and input components in `src/components/games/`. Best scores are saved in the browser via `localStorage` (`storage.ts`); there is no server-side score storage.

## Security

- Security headers set in `next.config.ts` (HSTS, CSP, X-Frame-Options, etc.)
- `robots.txt` disallows all major AI training crawlers
- `X-Robots-Tag: noai, noimageai` on all responses
- Terms of Use explicitly prohibit scraping and AI training
- All form data validated server-side with Zod + honeypot anti-spam
- No database = no stored personal data, no SQL injection surface
- Secrets via environment variables only — never hardcoded

## Pre-Deploy Checks

```bash
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
npm run build        # Full production build
```

## Deployment

Pushing to `master` triggers an automatic Vercel production deployment. Domain: `ahmedyhussain.com`.
