# ahmedyhussain.com

Personal website of **Ahmed Hussain** - BCom/LLB(Hons) candidate at the Australian National University, working at the intersection of law, computing, and AI governance.

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
│   ├── games/              # Games hub + typing test + breakout + contract
│   ├── legal/              # Terms and Privacy pages
│   ├── projects/           # Projects hub + code + silicon + aglc4 + base-converter
│   ├── tutoring/           # Tutoring services page
│   ├── layout.tsx          # Root layout (fonts, metadata, CircuitMesh backdrop)
│   ├── template.tsx        # Per-route transition wrapper (client)
│   ├── page.tsx            # Homepage
│   ├── robots.ts           # robots.txt (blocks AI crawlers)
│   └── sitemap.ts          # sitemap.xml
├── components/
│   ├── games/              # TypingTest, Breakout, ContractGame, GameShell, GameStat (client)
│   ├── layout/             # Header (client), Footer (server)
│   ├── projects/           # ToolShell, Aglc4Generator, BaseConverter, Silicon canvas
│   ├── sections/           # Homepage sections (server components)
│   └── ui/                 # Reusable primitives (CircuitMesh, SectionReveal, MotionCard)
├── lib/
│   ├── aglc4/              # AGLC4 citation formatters + field config (pure)
│   ├── convert/            # Base + bitwise conversion (pure, BigInt)
│   ├── games/              # Game logic: phrases, wpm, breakout-engine, contract-*, storage
│   ├── motion.ts           # Shared Framer Motion tokens and variants
│   ├── resend.ts           # Resend client + email helper (lazy init)
│   ├── utils.ts            # cn() utility
│   └── validations.ts      # Zod schemas
└── services/
    └── contact.ts          # Contact submission logic
```

## Design System

- **Monochrome only**: zinc-950 (`#09090b`) background, white text, zinc-800 borders. No colour accents.
- **Fonts**: Inter (body) + Playfair Display (headings), loaded via `next/font/google`
- **Defaults to Server Components** - `'use client'` only for interactivity (Header, animations, forms)
- **CircuitMesh**: Animated 3D canvas backdrop rendered site-wide behind all content
- **Respects `prefers-reduced-motion`**: animations honour the user's OS preference

## Contact Form

```
POST /api/contact
  → CSRF check (Origin/Referer validation against production domain)
  → Rate limiting (5 req/hr per IP, in-memory)
  → Zod validation (server-side)
  → Honeypot check (hidden `website` field)
  → submitContact() → sendContactEmail() via Resend
  → 200 / 400 / 429 / 500
```

The site uses no database. Contact submissions are emailed via Resend and not persisted.

## Project Tools

Two browser-side utilities under `/projects`, each pure logic behind a thin client shell:

- **AGLC4 citation generator** (`/projects/aglc4`) - footnote + bibliography citations in
  Australian Guide to Legal Citation (4th ed) style. Logic in `src/lib/aglc4/`.
- **Base converter** (`/projects/base-converter`) - live decimal/binary/hex/octal/text
  conversion plus a bitwise playground. Logic in `src/lib/convert/`.

## Games

The Games section at `/games` has three self-contained browser games:

- **Typing speed test** (`/games/typing-test`) - live WPM and accuracy over curated law, AI governance, and cybersecurity phrases (`src/lib/games/phrases.ts`).
- **Breakout** (`/games/breakout`) - a monochrome canvas game with falling power-ups (wider paddle, multi-ball, slow ball, extra life).
- **The Clause Game** (`/games/contract`) - pick contract clauses and win by landing a balanced, enforceable deal (`src/lib/games/contract-engine.ts`).

Game logic lives in `src/lib/games/` as side-effect-free modules (`wpm.ts`, `breakout-engine.ts`, `contract-engine.ts`) with thin `'use client'` render and input components in `src/components/games/`. Best scores are saved in the browser via `localStorage` (`storage.ts`); there is no server-side score storage.

## Security

- Security headers set in `next.config.ts` (HSTS, CSP, X-Frame-Options, etc.)
- CSRF protection on contact API via Origin/Referer header validation
- Rate limiting on contact form (5 req/hr per IP, in-memory)
- `robots.txt` disallows all major AI training crawlers
- `X-Robots-Tag: noai, noimageai` on all responses
- Terms of Use explicitly prohibit scraping and AI training
- All form data validated server-side with Zod + honeypot anti-spam
- Email subject sanitised before transmission
- No database = no stored personal data, no SQL injection surface
- Secrets via environment variables only - never hardcoded
- Centralised contact email constant in `src/lib/resend.ts`

## Pre-Deploy Checks

```bash
npm run type-check   # tsc --noEmit
npm run lint         # ESLint (flat config: eslint.config.mjs)
npm run build        # Full production build
```

## Deployment

Pushing to `master` triggers an automatic Vercel production deployment. Domain: `ahmedyhussain.com`.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free to use, modify, and share for **noncommercial** purposes. **Commercial use** and **use as AI/ML training data** require prior written permission - contact Ahmed Hussain (Ahmedyhussain07@gmail.com).
