# CLAUDE.md - AI Agent Context for ahmedyhussain.com

This document contains non-obvious context for an AI agent picking up this project in a new session.
Read this before touching any code.

---

## What This Project Is

A production personal website for **Ahmed Hussain** - BCom/LLB(Hons) candidate at ANU, Canberra.
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

### 3. No database - site is email-only
There is **no database** in this project. Contact form submissions are emailed via Resend and are
not persisted. If you add persistent storage in the future, introduce it behind the existing service
layer in `src/services/`.

### 4. Secrets via environment variables only
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` are env vars. They are never hardcoded.
Check `.env.example` for the full list.

### 5. The site is bilingual - every user-facing string must be translated
The site ships in **English and French**. There is a single source of truth for copy:
`src/lib/i18n/dictionaries/en.ts` (English) and `fr.ts` (French). **Any time you add or change
user-facing text, you MUST update BOTH dictionaries.** Never hardcode a user-facing string in a
component. The `Dictionary` type is derived from `en.ts`, so `fr.ts` will fail to compile if a key
is missing - `npm run type-check` is your safety net. See "Internationalisation" below for the full
workflow before touching any copy.

---

## Architecture in One Page

```
src/
├── app/                   Next.js App Router pages + API routes
│   ├── api/contact/       POST handler - validate, honeypot, email
│   ├── games/             Games hub + typing-test + breakout + contract
│   ├── legal/             Terms + Privacy pages
│   ├── projects/          Projects hub + code + silicon + aglc4 + base-converter
│   ├── tutoring/          Full tutoring page (services, pricing, FAQ, form)
│   ├── template.tsx       Per-route transition wrapper (client, reduced-motion safe)
│   └── page.tsx           Homepage (7 sections, all static)
│
├── components/
│   ├── games/             TypingTest, Breakout, ContractGame (client), GameShell, GameStat
│   ├── layout/            Header (client - scroll state), Footer (server)
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
│   ├── ratelimit.ts       In-memory rate limiter (5 req/hr per IP)
│   ├── utils.ts           cn()
│   └── validations.ts     Zod schemas - single source of truth for form shapes
│
└── services/
    └── contact.ts         Business logic - send contact email via Resend
```

**Default to Server Components.** Only add `'use client'` when you need browser APIs,
React state, or Framer Motion hooks. Current client components: Header, SectionReveal,
ParallaxImage, ContactForm, CircuitMesh, Template, MotionCard, TypingTest, Breakout,
ContractGame, Aglc4Generator, BaseConverter.

---

## CircuitMesh - Site-Wide Animated Background

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
  `slow`, `life` - tune them via the `POWERUP_META` / drop-chance constants in the engine.
- **Super Ninja Monk Fighter IV** (`/games/ninja`): Godot 4.7 WebAssembly build embedded via iframe.
  A fast 2D platformer with a hand-drawn ink-and-void aesthetic. The game files live in
  `public/games/ninja/` (index.html + .js + .wasm + .pck). The pck file (~20 MB) is committed
  directly — it was previously gitignored but is required for the game to run. To update the
  build, copy all files from `beam/build/web/` into `public/games/ninja/`. A bug report form
  (using the shared `/api/contact` endpoint) appears on both `/games/ninja` and
  `/projects/ninja`.
- **The Clause Game** (`/games/contract`): pick clauses across negotiation scenarios; win by
  landing the deal in the balanced/enforceable zone. Pure scoring in
  `src/lib/games/contract-engine.ts` + dataset in `contract-data.ts` (`contract-types.ts` for
  shared types). Middle option in each category is always `balance: 0`. UI: `ContractGame.tsx`.
- **Persistence:** `src/lib/games/storage.ts` - SSR-safe `localStorage` helpers
  (`getBest`, `setBestIfHigher`, `BEST_KEYS`). Namespaced under `ahmed-site:games:v1:*`
  with versioned key prefixing for schema migration safety.
- **Monochrome:** everything is white-on-zinc; brick depth uses per-row alpha, never colour.
- **Reduced motion:** decorative animation (caret blink, power-up flourishes) is gated; the
  games themselves remain fully playable.

To add a game: add a card to `src/app/games/page.tsx`, create the route + shell under
`src/app/games/<slug>/`, put logic in `src/lib/games/`, and add the URL to `sitemap.ts`.

---

## Site-Wide Motion

All animation is **Framer Motion only (no GSAP)**. Shared tokens live in `src/lib/motion.ts`
(`EASE_OUT_EXPO`, `DURATION`, `fadeInUp`, `cardHover`, `springSubtle`) - reuse these instead
of hardcoding values so motion stays consistent.

- `src/app/template.tsx` gives a subtle per-route fade/rise (remounts on navigation). Fixed
  backgrounds stay in `layout.tsx`, outside the transition wrapper.
- `Header.tsx` has a shared-`layoutId` underline that slides to the active nav item.
- `MotionCard` (`src/components/ui/MotionCard.tsx`) is the subtle hover-lift wrapper for cards.

Every motion addition checks `useReducedMotion()` and degrades to no animation.

---

## Internationalisation (i18n) - English + French

The site is bilingual. Language is chosen with an **EN / FR toggle in the header**, stored in a
`locale` cookie, and read on the server - **there are no `/fr` URLs**. English is the canonical URL.

### Where everything lives (`src/lib/i18n/`)
- `config.ts` - `locales` (`en`, `fr`), `defaultLocale`, the `locale` cookie name/age, `isLocale()`.
- `dictionaries/en.ts` - **the single source of truth for all copy.** Its shape defines the
  `Dictionary` type.
- `dictionaries/fr.ts` - `fr: Dictionary`. Structurally identical to `en.ts` or it won't compile.
- `server.ts` - `getLocale()` and `getDictionary()` for **server components**. `getLocale()` reads
  the cookie; on a first visit with no cookie it falls back to the `Accept-Language` header.
- `client.tsx` - `I18nProvider` + `useI18n()` / `useT()` for **client components**.
- `src/components/ui/LanguageToggle.tsx` - writes the cookie and `router.refresh()`es.

### How to render copy
- **Server component:** `const t = await getDictionary()` then `t.section.key`. The component must
  be `async`. (This is how the layout, footer, sections, and most pages work.)
- **Client component (`'use client'`):** `const t = useT()` then `t.section.key`. The provider is
  wired in `src/app/layout.tsx`, which reads the locale and sets `<html lang>`.

### The rule for ALL future changes
1. Add the string to `en.ts` under a sensible section key.
2. Add the **French translation** to `fr.ts` at the identical path (formal *vous* for the visitor;
   first person for Ahmed's bio).
3. Reference it via `t.…` in the component - never inline a literal.
4. Run `npm run type-check` - a missing French key is a compile error.
5. Keep `CONTENT.md` (the human-editable copy inventory) in sync if you add/restructure copy.

Rich prose with inline emphasis (the silicon explainer) is stored as HTML strings containing
`<strong>` and rendered with `dangerouslySetInnerHTML` inside a `.rich` container; `.rich strong`
in `globals.css` applies the monochrome emphasis style. Content is trusted (our own dictionary).

### Deliberate boundaries (these stay English on purpose)
- **SEO metadata and Open Graph / Twitter images** - emitted in the canonical language (English).
  Because switching is cookie-based (no `/fr` URL), there is no separate page for crawlers to index.
- **Large editorial datasets** - typing-test phrases (`src/lib/games/phrases.ts`), Clause Game
  scenarios/clauses (`src/lib/games/contract-data.ts`, `OUTCOME_COPY` in `contract-engine.ts`), and
  AGLC4 field configs/examples (`src/lib/aglc4/fields.ts`). The **UI chrome around them is
  translated**; the specialist content is not. If you localise these later, give each its own
  locale-keyed module rather than bloating the dictionaries.

### Consequences to be aware of
- Reading the cookie makes content pages **dynamically rendered** (`ƒ` in the build output) rather
  than static. This is the accepted trade-off for URL-stable switching. OG images, sitemap and
  robots remain static.
- A single `locale` cookie now exists. It holds no personal data and is not used for tracking; the
  privacy policy already discloses it. Keep that disclosure accurate if you change cookie use.
- Contact-form validation messages are localised: `makeContactSchema(messages)` in
  `src/lib/validations.ts` builds the schema from dictionary strings on the client; the server API
  uses the English default (its errors are not surfaced to users).

---

## Contact System - How It Works

```
POST /api/contact
  1. CSRF check: Origin/Referer must match production domain
  2. Rate-limit by IP (5 req/hr, in-memory — see src/lib/ratelimit.ts)
  3. Parse JSON body
  4. contactSchema.safeParse() - Zod, server side
  5. Honeypot check (website field must be empty)
  6. submitContact() in src/services/contact.ts
     a. sendContactEmail() via Resend (throws on failure → 500)
  7. Return 200 / 400 / 429 / 500
```

No database. Rate limiting via `src/lib/ratelimit.ts` (5 req/hr per IP, in-memory). No IP logging. The privacy policy (`/legal/privacy`) was
corrected on 2026-06-16 to match this reality (email-only via Resend, no stored IP, no
database) and to disclose Vercel Speed Insights and the games' `localStorage` use. Keep it
accurate if you change data handling.

---

## Resend - Important Lazy Init Pattern

`src/lib/resend.ts` creates the Resend client **lazily** (only when `sendContactEmail` is called).
This is intentional - `new Resend(undefined)` throws immediately at module load, which breaks
`next build` when `RESEND_API_KEY` is not set in the build environment.

Do not change this to an eager initialisation.

The module also exports a centralised `CONTACT_EMAIL` constant used by the Footer and other
components — update it in one place if the email address changes. The `sendContactEmail`
function sanitises the email subject (strips control characters and limits length) before
sending.

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

The CSP uses `unsafe-inline` for scripts - this is a known trade-off with Next.js.

---

## AI Crawler Blocking

`src/app/robots.ts` disallows all major AI training crawlers by name (GPTBot, ClaudeBot,
Google-Extended, PerplexityBot, CCBot, Bytespider, etc.).

The Terms of Use (`/legal/terms`) explicitly prohibits scraping and AI training use.

Do not remove these protections.

---

## Lawyer Image

`public/lawyer.jpg` - used in `src/components/sections/About.tsx` as a parallax element via
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
  conversion plus a bitwise playground. Pure logic in `src/lib/convert/` - `bases.ts`
  (BigInt-backed parse/format + text↔value) and `bitwise.ts` (AND/OR/XOR/NOT/shifts; NOT is
  width-masked). Everything funnels through one canonical non-negative `BigInt`. UI:
  `src/components/projects/BaseConverter.tsx`.

Note: BigInt literals (`0n`) require `tsconfig` `target` ES2020+ - do not lower it.

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

- **Admin dashboard** - intentionally deferred. Service layer is ready for it. When building,
  add under `/app/admin/` with middleware-based auth guard.
- **Database** - currently no database in the project. Contact form emails directly via Resend.
  If you add persistent storage (newsletter, stored enquiries, admin), introduce it behind the
  service layer and use environment variables for the connection string.
- **Newsletter** - needs a signup form and Resend audience integration.
- **Blog/Articles** - needs a Markdown renderer (consider `next-mdx-remote` or `@next/mdx`).
- **Rate limiting** — in-memory rate limiter exists (`src/lib/ratelimit.ts`, 5 req/hr/IP
  for the contact form). NOTE: does not survive serverless cold starts on Vercel.
  For production resilience, migrate to Upstash Redis or Vercel KV.
