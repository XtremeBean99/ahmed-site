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

### 1. Design must remain strictly monochrome
The design uses zinc-950 (`#09090b`) background, white text, zinc-800 borders. No colour accents.
No gradients except the subtle hero vignette. If you add new UI, match this palette exactly.
References: Vercel, Linear, Stripe aesthetic. Do not introduce any colour.

### 2. All user input is hostile
The contact form has server-side Zod validation and a honeypot field. If you add any new form or
API route, apply the same pattern from `src/services/contact.ts`. Never skip server-side validation
even if client validation exists.

### 3. No database — site is email-only
There is **no database** in this project. Contact form submissions are emailed via Resend and are
not persisted. If you add persistent storage in the future, introduce it behind the existing service
layer in `src/services/`.

### 4. Secrets via environment variables only
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` are env vars. They are never hardcoded.
Check `.env.example` for the full list.

---

## Architecture in One Page

```
src/
├── app/                   Next.js App Router pages + API routes
│   ├── api/contact/       POST handler — validate, honeypot, email
│   ├── games/             Games hub + typing-test + breakout + contract
│   ├── legal/             Terms + Privacy pages
│   ├── projects/          Projects hub + code + silicon + aglc4 + base-converter
│   ├── tutoring/          Full tutoring page (services, pricing, FAQ, form)
│   ├── template.tsx       Per-route transition wrapper (client, reduced-motion safe)
│   └── page.tsx           Homepage (7 sections, all static)
│
├── components/
│   ├── games/             TypingTest, Breakout, ContractGame (client), GameShell, GameStat
│   ├── layout/            Header (client — scroll state), Footer (server)
│   ├── projects/          ToolShell, Aglc4Generator, BaseConverter, SiliconCanvas
│   ├── sections/          One file per homepage section (server components)
│   └── ui/                Button, SectionReveal, ParallaxImage, ContactForm,
│                          CircuitMesh, CyberSigils, MotionCard
│
├── lib/
│   ├── aglc4/             AGLC4 citation formatters + field config (pure, no DB)
│   ├── convert/           Base + bitwise conversion (pure, BigInt)
│   ├── games/             phrases, wpm, breakout-engine, contract-*, storage (no DB)
│   ├── github/            GitHub API client for the code page
│   ├── motion.ts          Shared Framer Motion tokens (easings, durations, variants)
│   ├── resend.ts          Lazy Resend client (does NOT init at module load)
│   ├── utils.ts           cn()
│   └── validations.ts     Zod schemas — single source of truth for form shapes
│
└── services/
    └── contact.ts         Business logic — send contact email via Resend
```

**Default to Server Components.** Only add `'use client'` when you need browser APIs,
React state, or Framer Motion hooks. Current client components: Header, SectionReveal,
ParallaxImage, ContactForm, CircuitMesh, Template, MotionCard, TypingTest, Breakout,
ContractGame, Aglc4Generator, BaseConverter.

---

## CircuitMesh — Site-Wide Animated Background

`src/components/ui/CircuitMesh.tsx` is a `'use client'` canvas-based animated circuit mesh with 3D
perspective projection. It is included in the **root layout** and renders behind all page content as
a fixed backdrop (`pointer-events-none fixed inset-0 -z-10`).

- Strictly monochrome: white strokes/dots at low alpha over zinc-950
- Self-contained: no external dependencies, no global CSS
- Respects `prefers-reduced-motion`: renders one static frame, no RAF loop
- Pauses when the tab is hidden or scrolled out of view (IntersectionObserver)
- Fades toward edges via a CSS `mask-image` radial gradient

If you add any other fixed-position backgrounds, ensure they do not conflict with CircuitMesh.

---

## Games

`/games` is a hub (same card pattern as `/projects`) linking self-contained games.
No database, no API routes, no server state. Best scores live in the browser only.

- **Typing test** (`/games/typing-test`): live WPM + accuracy. Server shell renders the
  `'use client'` `TypingTest`. Phrases are a curated, editable dataset in
  `src/lib/games/phrases.ts` covering law, AI governance, and cybersecurity (NO
  silicon/computing-hardware copy by design). WPM/accuracy math is pure and isolated in
  `src/lib/games/wpm.ts`.
- **Breakout** (`/games/breakout`): canvas + `requestAnimationFrame`, DPR-aware, pauses on
  tab-hidden / off-screen (same pattern as CircuitMesh). All physics, multi-ball, and the
  power-up system live in `src/lib/games/breakout-engine.ts` (pure functions over a mutable
  `GameState`); `Breakout.tsx` is a thin render + input shell. Power-ups: `expand`, `multi`,
  `slow`, `life` — tune them via the `POWERUP_META` / drop-chance constants in the engine.
- **The Clause Game** (`/games/contract`): pick clauses across negotiation scenarios; win by
  landing the deal in the balanced/enforceable zone. Pure scoring in
  `src/lib/games/contract-engine.ts` + dataset in `contract-data.ts` (`contract-types.ts` for
  shared types). Middle option in each category is always `balance: 0`. UI: `ContractGame.tsx`.
- **Persistence:** `src/lib/games/storage.ts` — SSR-safe `localStorage` helpers
  (`getBest`, `setBestIfHigher`, `BEST_KEYS`). Namespaced under `ahmed-site:games:*`.
- **Monochrome:** everything is white-on-zinc; brick depth uses per-row alpha, never colour.
- **Reduced motion:** decorative animation (caret blink, power-up flourishes) is gated; the
  games themselves remain fully playable.

To add a game: add a card to `src/app/games/page.tsx`, create the route + shell under
`src/app/games/<slug>/`, put logic in `src/lib/games/`, and add the URL to `sitemap.ts`.

---

## Site-Wide Motion

All animation is **Framer Motion only (no GSAP)**. Shared tokens live in `src/lib/motion.ts`
(`EASE_OUT_EXPO`, `DURATION`, `fadeInUp`, `cardHover`, `springSubtle`) — reuse these instead
of hardcoding values so motion stays consistent.

- `src/app/template.tsx` gives a subtle per-route fade/rise (remounts on navigation). Fixed
  backgrounds stay in `layout.tsx`, outside the transition wrapper.
- `Header.tsx` has a shared-`layoutId` underline that slides to the active nav item.
- `MotionCard` (`src/components/ui/MotionCard.tsx`) is the subtle hover-lift wrapper for cards.

Every motion addition checks `useReducedMotion()` and degrades to no animation.

---

## Contact System — How It Works

```
POST /api/contact
  1. Parse JSON body
  2. contactSchema.safeParse() — Zod, server side
  3. Honeypot check (website field must be empty)
  4. submitContact() in src/services/contact.ts
     a. sendContactEmail() via Resend (throws on failure → 500)
  5. Return 200 / 400 / 500
```

No database. No rate limiting. No IP logging. The privacy policy (`/legal/privacy`) was
corrected on 2026-06-16 to match this reality (email-only via Resend, no stored IP, no
database) and to disclose Vercel Speed Insights and the games' `localStorage` use. Keep it
accurate if you change data handling.

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
Includes: HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
CSP, and `X-Robots-Tag: noai, noimageai`.

The CSP uses `unsafe-inline` for scripts — this is a known trade-off with Next.js.

---

## AI Crawler Blocking

`src/app/robots.ts` disallows all major AI training crawlers by name (GPTBot, ClaudeBot,
Google-Extended, PerplexityBot, CCBot, Bytespider, etc.).

The Terms of Use (`/legal/terms`) explicitly prohibits scraping and AI training use.

Do not remove these protections.

---

## Lawyer Image

`public/lawyer.jpg` — used in `src/components/sections/About.tsx` as a parallax element via
`ParallaxImage`. Rendered with `grayscale` CSS filter to stay monochrome.

---

## Project Tools (AGLC4 generator, base converter)

Two interactive utilities live under `/projects`, each a server route + thin `'use client'`
shell over pure logic. Both share `ToolShell` (`src/components/projects/ToolShell.tsx`) for
page chrome (back-to-projects link + header), the projects analogue of `GameShell`.

- **AGLC4 citation generator** (`/projects/aglc4`): builds footnote + bibliography citations
  in AGLC4 (4th ed) style for 9 source types. All rules are pure functions in
  `src/lib/aglc4/`: `types.ts`, `fields.ts` (declarative field config per source type), and
  `format.ts` (formatters returning `Segment[]` so italics render as `<em>` and copy as plain
  text). To add a source type: extend the `SourceType` union, add a `SOURCES` entry + a
  `FORMATTERS` entry. UI: `src/components/projects/Aglc4Generator.tsx`.
- **Base converter** (`/projects/base-converter`): live decimal/binary/hex/octal/UTF-8
  conversion plus a bitwise playground. Pure logic in `src/lib/convert/` — `bases.ts`
  (BigInt-backed parse/format + text↔value) and `bitwise.ts` (AND/OR/XOR/NOT/shifts; NOT is
  width-masked). Everything funnels through one canonical non-negative `BigInt`. UI:
  `src/components/projects/BaseConverter.tsx`.

Note: BigInt literals (`0n`) require `tsconfig` `target` ES2020+ — do not lower it.

---

## Environment Variables Reference

| Variable | Required | Where set | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | Yes | Vercel + local `.env.local` | Resend API key |
| `CONTACT_TO_EMAIL` | No | Vercel (optional) | Defaults to `ahmedyhussain07@gmail.com` |
| `CONTACT_FROM_EMAIL` | No | Vercel (optional) | Defaults to `Ahmed Hussain <noreply@ahmedyhussain.com>` |
| `NEXT_PUBLIC_BASE_URL` | No | Vercel (optional) | Defaults to `https://ahmedyhussain.com` |
| `GITHUB_TOKEN` | No | Vercel (optional) | Raises unauthenticated API rate limit for code page |

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

- **Admin dashboard** — intentionally deferred. Service layer is ready for it. When building,
  add under `/app/admin/` with middleware-based auth guard.
- **Database** — currently no database in the project. Contact form emails directly via Resend.
  If you add persistent storage (newsletter, stored enquiries, admin), introduce it behind the
  service layer and use environment variables for the connection string.
- **Newsletter** — needs a signup form and Resend audience integration.
- **Blog/Articles** — needs a Markdown renderer (consider `next-mdx-remote` or `@next/mdx`).
- **Rate limiting** — not currently implemented. If abuse of the contact endpoint is observed,
  add it via Vercel KV, Upstash, or a database-backed approach.
