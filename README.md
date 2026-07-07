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

## Technical Architecture

### The Pixel-Art Room (Homepage)

The homepage (`/`) is an interactive pixel-art bedroom rendered as a 1408 by 768 pixel stage. Every hotspot on the stage is a real `<a>` or `<button>` element inside a `<nav>` with an accessible label, visible focus ring, and tooltip on both hover and focus. The stage uses CSS `image-rendering: pixelated` throughout; Next.js `<Image>` is never used because its resampling destroys pixel art.

#### Stage Scaling

The stage is scaled to fit the viewport via `useStageScale()`, which computes a uniform scale factor from the viewport dimensions and the fixed stage size (1408 by 768). The scale is applied as a CSS `transform: scale()` on a container div, keeping mouse coordinate mapping correct because the DOM hit-testing occurs after the transform.

#### Hotspot System (`RoomObject`)

Every interactive element on the stage wraps its content in `RoomObject`, a client component that renders an `<a>` (if `href` is provided) or a `<div>` (otherwise) with:

- `onMouseEnter`/`onMouseLeave` and `onFocus`/`onBlur` handlers forwarded from the parent
- A tooltip bubble positioned above the hotspot, shown on hover and focus
- `aria-label` pulled from the i18n dictionary
- A warm 2px outline on `focus-visible` matching the room palette (`rgba(200,184,154,0.7)`)

#### Frame-Based Sprite Animation (`AnimatedSprite`)

Multi-frame pixel art objects (posters, bonsai, coffee mug) use `AnimatedSprite`, which drives frame playback through a `setInterval` clock. Three modes are supported:

- **`loop`**: Cycles through all frames continuously at the configured `frameDuration` (used by the bonsai tree).
- **`play-once-hold`**: Steps through frames 0 to N-1 once, then holds frame N-1 until the pointer leaves (used by the kitagawa poster and coffee mug highlight).
- **`play-all-loop-last-two`**: Plays all frames once, then loops the final two frames indefinitely while hovered (used by the saitama poster).

Frame indices are tracked via a ref to avoid stale closures in the interval callback. The timer is cleared on unmount and on pointer leave, resetting to frame 0. All frames share a union bounding box with a 2px pad, cropped at extraction time, so playback never jitters. Under `prefers-reduced-motion`, the static frame 0 is shown and the timer never starts.

All `AnimatedSprite` instances share a 2px upward hover lift implemented as a Framer Motion `motion.img` with `animate={{ y: hovered && !reduce ? -2 : 0 }}` at `DURATION.fast`.

#### Monitor Component

The monitor, keyboard, and mousepad form a single composite sprite with two simultaneous hover animations driven by one 80ms interval clock:

1. **Highlight sequence**: 4 frames (`monitor-1` through `monitor-4`) that step from the rest frame through a growing yellow outline. These replace the base sprite image.
2. **Boot-screen overlay**: 18 frames (`monitor-loading-1` through `monitor-loading-18`) of a Windows 98 style boot sequence, rendered as an absolutely positioned `<img>` over the monitor glass. The overlay appears starting at tick 1 and updates at the same 80ms rate.

Both sequences clamp to their last frame once complete and hold until the pointer leaves. Frame pre-warming (instantiating `new Image()` for all 21 non-rest frames on mount) prevents visible loading on first hover. The sprite and overlay are wrapped in a `motion.div` so they lift together. Under reduced motion, the static rest frame is shown with no overlay.

The monitor is also the entry point to the desk close-up. Clicking it triggers a zoom transition.

#### Zoom Transition

Clicking the monitor initiates a state transition `room` to `zooming` to `desk`. During `zooming`:

- The `RoomStage` component applies a `transform-origin` at the centre of the monitor glass (stage coordinates 360, 331) and scales to 3.2x over approximately 800ms via CSS transition.
- A radial glow bloom (`radial-gradient` centred on the glass point) and a white overlay fade in concurrently to mask the transition.
- A safety timeout (1500ms) forces entry to the desk view if the animation stalls.
- Pressing Escape cancels the zoom and returns to the room.

After the zoom completes (or immediately under reduced motion), `view` becomes `desk` and `window.history.pushState` sets `#desk`. The back button and popstate event return to the room.

#### Room Speakers (`RoomSpeakers`)

A separate client component rendered inside `RoomAudioProvider`. It contains:

- A decorative art layer: two stacked `<img>` elements (lamp-on and lamp-off speaker art) that crossfade with `opacity` and `transition: opacity 0.4s ease`, matching the room background crossfade. The lamp-on layer also carries the `lamp-flicker` CSS animation class on toggle.
- Two `<button>` elements over the left and right speaker cabinets (stage coords 148,355 108x154 and 490,290 91x141) that call `useRoomAudio().toggle()` to mute or unmute.
- Two `MusicNotes` instances emitting from the driver holes (tweeter and woofer per cabinet).

The `RoomSpeakers` component renders after `<Monitor>` in the DOM. Speaker cabinet buttons carry `z-index: 2` so they win click events over the monitor's anchor rect where they overlap; the Monitor itself has `z-index: 1` so its highlight frames paint above the speaker art.

#### Lamp Toggle

The desk lamp state (`lampOn: boolean`) is persisted in `localStorage` under the key `room-save-v1` alongside `audio` and `visitCount`. A shared `toggleLamp` callback in `Room.tsx` writes to storage and triggers a 500ms flicker animation class. This single callback is used by both the room lamp hotspot (a `<button>` at 60,300 110x220) and the desk close-up lamp button (at 8,88 160x480), ensuring one persistence path and synchronised state across both views.

The room background and desk close-up art each use a two-layer crossfade: the lamp-off art is always present; the lamp-on art sits on top and fades its `opacity` from 0 to 1 (or 1 to 0) over 400ms. This avoids any layout shift or reflow.

#### Desk Close-Up (`DeskView`)

The desk view renders the close-up art at full 1408x768 with the same stage scaling as the room. It contains:

- A functional screen area (436,152 536x308) hosting either a pixel desktop (clock strip plus six shortcut icons in a 3 by 2 grid) or an in-monitor browser.
- Two speaker mute buttons (same `useRoomAudio().toggle()` as the room speakers).
- `MusicNotes` from the desk speaker driver holes.
- A pointer-following mouse sprite (position lerped at 0.15 per frame via `requestAnimationFrame`).
- An idle screensaver that appears after 15 seconds of inactivity.
- The lamp toggle button on the left edge.

**In-monitor browsing**: Clicking a desktop shortcut opens a same-origin `<iframe>` displaying the real site page, scaled to 75 percent for readability within the screen rect. The iframe uses `sandbox="allow-same-origin allow-scripts allow-forms allow-popups"`. Navigation between pages happens via `contentWindow.location.replace()` to avoid building up joint browser history. The current path is tracked by a 500ms same-origin polling interval. A top strip provides Desktop and Expand buttons; Expand opens the current URL in a new tab via `window.open`. The Escape key acts as a ladder: browser to desktop to room.

The desktop uses no database and no server state; all interactions are client-side only.

### Sprite Pipeline

Pixel art source files live in `assets/pixel-art/` organised by category (`poster/`, `bonsai/`, `coffee/`, `close-up-desk/`, `room-view-monitor/`, `background/`, `music-sfx/`). Web sprites are extracted to `public/room/` by Node.js scripts using the `sharp` library (available transitively through Next.js; not a direct dependency).

The extraction process for multi-frame sprites:

1. Scan every frame with sharp's raw pixel API, finding the bounding box of non-transparent pixels in each frame.
2. Compute the union bounding box across all frames.
3. Add a 2px pad on each side, clamped to the 1408x768 canvas bounds.
4. Crop every frame to the identical union rect and write as PNG.

This ensures all frames in an animation share exactly the same pixel dimensions, so swapping between them never causes layout jitter. Three extraction scripts implement this pattern: `extract-all-sprites.mjs` (backgrounds, bonsai, original monitor), `extract-posters.mjs` (kitagawa poster), and `extract-monitor-hover.mjs` (monitor hover and loading frames, room speakers, desk close-up variants).

### Audio System

`RoomAudioProvider` wraps the entire application and provides an audio context via React context:

- A six-track playlist defined in `src/lib/room/playlist.ts`.
- Audio playback uses an HTML `<audio>` element ref, not the Web Audio API, for simplicity and mobile compatibility.
- `NowPlaying` renders a fixed-position widget (bottom-left) showing the current track title, artist, and cover art. Cover art is loaded from external image files or extracted from embedded ID3v2 APIC (attached picture) frames by `src/lib/room/id3.ts`, a zero-dependency ID3v2 parser that fetches the first 256KB of the MP3 and parses APIC frames.
- A skip button advances to the next track; play and pause toggle via a single button.
- Audio preferences (`audio: boolean`) are persisted in `room-save-v1`.

`MusicNotes` is a decorative component that spawns floating note sprites from speaker driver holes at a constant rate while audio is playing. Each note is absolutely positioned, scaled, and faded out via CSS animation. Notes are staggered between left and right channels with a 550ms offset.

### Internationalisation (i18n)

The site supports English and French, selected via a `LanguageToggle` button in the header. The implementation uses a thin custom solution rather than a library:

- `src/lib/i18n/config.ts` defines the locale list and default locale.
- `src/lib/i18n/dictionaries/en.ts` and `fr.ts` export typed dictionary objects with identical structure.
- `src/lib/i18n/server.ts` reads the `Accept-Language` header server-side.
- `src/lib/i18n/client.tsx` provides `I18nProvider` (wraps the root layout) and `useI18n()` hook for client components.

Every user-facing string in the room, desk view, games, projects, and all chrome elements exists in both dictionaries. The room object labels, tooltips, HUD text, and desk shortcut names are all dictionary-driven.

### Technology Stack Details

**Next.js 15 (App Router)**: The entire site uses the App Router with React Server Components as the default. Pages under `src/app/(site)/` share a common layout (Header, Footer, CircuitMesh backdrop) via a route group. The room at `/` bypasses this chrome in its own layout. API routes (`/api/contact`, `/api/ninja/leaderboard`) use Route Handlers. Static pages are prerendered at build time; dynamic pages are server-rendered on demand.

**TypeScript 5 (strict mode)**: All code is in TypeScript with `strict: true`. The i18n dictionaries use a shared interface to guarantee both locales have identical keys. Room object definitions use the `RoomObjectDef` interface. Component props are fully typed.

**Tailwind CSS 3**: Utility-first CSS for all styling outside the pixel-art room. The room uses inline styles because its coordinate system (absolute positioning in a 1408x768 space) is not a good fit for utility classes. Custom keyframes (`lamp-flicker`, `steam-rise`, `screensaver-drift`, `dust-float`, `mouse-jitter`) are defined in `globals.css`.

**Framer Motion 11**: Used for the zoom transition (scale and glow overlay via `AnimatePresence`), the hover lift on sprites (`motion.img` and `motion.div`), page transitions in the site chrome (`template.tsx`), and the `SectionReveal` scroll-triggered animations on content pages.

**sharp (indirect dependency)**: Used exclusively in build-time extraction scripts (`scripts/*.mjs`). Available through Next.js's transitive dependency tree; not listed in `package.json`. Converts and crops source PNGs to web sprites with precise pixel control.

**localStorage**: Persists user preferences (`room-save-v1`: lamp state, audio preference, visit count) and game high scores. No server-side storage exists; contact form submissions are emailed via Resend and not retained.

**Resend**: Handles contact form email delivery. The client is lazily initialised only when the API route is invoked. The `From` address must match a verified Resend domain.

**Zod**: Validates contact form input server-side. Also used for the ninja game leaderboard API validation.

**React Hook Form**: Manages form state and validation on the client side for the contact form, with Zod resolver integration.

**Three.js (React Three Fiber)**: Powers the `CircuitMesh` animated 3D wireframe backdrop rendered behind all content pages. The mesh is a client component with its own Canvas, independent of the page render tree.

### The Room View Rendering Order

The stage children in `Room.tsx` are rendered in a specific DOM order that determines both visual stacking and click event priority:

1. Lamp-off background (`<img>`, always present)
2. Lamp-on background (`<img>`, opacity-crossfaded)
3. Monitor (`<Monitor>`, z-index 1, wraps `RoomObject` with the monitor anchor)
4. Room speakers (`<RoomSpeakers>`, cabinet buttons at z-index 2)
5. Kitagawa poster (`<AnimatedSprite>`)
6. Saitama poster (`<AnimatedSprite>`)
7. Bonsai tree (`<AnimatedSprite>`)
8. Clock bubble (`<div>`)
9. Lamp toggle hotspot (`<button>`)
10. Coffee steam wisps (`<div>`)
11. Coffee mug (`<AnimatedSprite>`)

Later siblings paint above earlier ones in the CSS stacking context. The RoomSpeakers render after Monitor so their cabinet buttons (z-index 2) win click events over the monitor's anchor rect. The coffee mug renders last so it wins its overlap with the left speaker cabinet, which is visually correct because the mug sits in front of the cabinet.

### Pre-Deploy Gates

Every push to `master` triggers a Vercel deployment. The repository enforces no CI pipeline beyond Vercel's built-in build step, but the following manual gates are standard:

```bash
npm run type-check   # tsc --noEmit, strict mode
npm run lint         # ESLint flat config (eslint.config.mjs)
npm run build        # Next.js production build
```

All three must pass with zero errors before a commit is considered deployable.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free to use, modify, and share for **noncommercial** purposes. **Commercial use** and **use as AI/ML training data** require prior written permission - contact Ahmed Hussain (Ahmedyhussain07@gmail.com).
