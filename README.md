# ahmedyhussain.com

Personal website of **Ahmed Hussain** -- BComp/LLB(Hons) candidate at the Australian National University, working at the intersection of law, computing, and AI governance.

**[ahmedyhussain.com](https://ahmedyhussain.com)**

---

The site is a single-page interactive pixel-art digital bedroom. Every element on screen is a real DOM element with accessible labels, focus rings, and tooltips. The room view contains clickable hotspots (monitor, posters, lamp, speakers, side table, clock, coffee, bonsai) triggering animations, audio, weather effects, and a desk close-up with functional desktop apps.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion 11 |
| Storage | Upstash Redis (guestbook only) |
| Validation | Zod |
| Deployment | Vercel |

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Add your Upstash Redis credentials

# Run development server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL for the guestbook |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `GUESTBOOK_ADMIN_KEY` | Yes | Admin key for guestbook DELETE endpoint |
| `GITHUB_TOKEN` | No | GitHub PAT; raises unauthenticated API rate limit |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for OG images and canonical URLs (defaults to `https://ahmedyhussain.com`) |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── guestbook/        # Guestbook API (GET/POST/DELETE, Upstash Redis)
│   │   └── weather/          # Weather API (read-only, Open-Meteo, fixed Canberra)
│   ├── layout.tsx            # Root layout (fonts, metadata, providers)
│   ├── page.tsx              # Homepage (the pixel-art room)
│   ├── globals.css           # Tailwind directives + custom keyframes
│   ├── robots.ts             # robots.txt (blocks AI crawlers)
│   └── sitemap.ts            # sitemap.xml
├── components/
│   ├── room/                 # Room stage, desk view, desktop apps, audio, SFX
│   ├── ui/                   # Reusable primitives (SectionReveal, MotionCard)
│   ├── providers/            # MotionProvider (reduced motion forced on)
│   └── seo/                  # JsonLd structured data
├── lib/
│   ├── room/                 # Room objects, playlist, discoveries, storage, lighting, ID3 parser
│   ├── games/                # Minesweeper engine + game storage
│   ├── i18n/                 # English-only dictionary + provider wrapper
│   ├── redis.ts              # Lazy Upstash Redis client
│   ├── ratelimit.ts          # IP-based rate limiting (Upstash + in-memory fallback)
│   ├── validations.ts        # Zod schemas (guestbook)
│   ├── motion.ts             # Shared Framer Motion tokens and variants
│   └── utils.ts              # cn() utility
└── services/
    └── guestbook.ts          # Guestbook CRUD logic
```

- **Room palette**: warm brown and mauve pixel art on the homepage (`/`). Bubble and panel colours: `#3d2e1e`, `#5a4430`, `#e8d5b0`. App screens: `#faf8f5`, `#fffef5`, `#e8e0d8`.
- **Font**: A single pixel font (`var(--font-pixel)`) loaded via `next/font/local` from `src/fonts/Minecraft.ttf`.
- **Defaults to Server Components**: `'use client'` only for interactivity (animations, forms, audio).
- **`image-rendering: pixelated`** everywhere; `next/image` is never used because its resampling destroys pixel art.
- **Reduced motion forced on**: `MotionProvider` sets `reducedMotion="never"` site-wide.

## The Room

The homepage (`/`) is an interactive pixel-art bedroom rendered on a 1408 by 768 pixel stage, scaled to fit the viewport via CSS `transform: scale()`.

### Room View

Interactive hotspots on the main room stage:

- **Monitor**: 4-frame yellow outline highlight on hover plus an 18-frame Windows 98 boot-screen overlay. Clicking triggers a zoom transition into the desk close-up.
- **Posters** (Kitagawa and Saitama): Multi-frame animated hover effects via `AnimatedSprite`. Play-once-hold and play-all-loop-last-two modes.
- **Lamp**: Toggles on/off with a warm glow overlay and 500ms flicker animation. State persists across room and desk views via `localStorage`.
- **Speakers**: Clickable mute/unmute toggle. Emit floating music note sprites while audio plays. Two-layer lamp-on/lamp-off art crossfade.
- **Side table**: Click toggles a 2-frame drawer open/close animation, persisted to `localStorage`.
- **Digital alarm clock**: Green LED digits skewY'd onto the table face plane. Click toggles 12/24h format.
- **Bonsai tree**: Looping animated sprite.
- **Coffee mug**: Animated hover highlight with three-wisp steam animation.
- **Weather window**: Rain or snow particles via Open-Meteo API, rendered inside the window glass area.
- **Night sky**: Moon and stars rendered when the room is in night mode.

All hotspots use `RoomObject`, a client component wrapping content in an `<a>` or `<button>` with `aria-label`, focus-visible ring, and tooltip bubble on hover and focus. CSS `image-rendering: pixelated` is used throughout; `next/image` is never used because its resampling destroys pixel art.

### Zoom Transition

Clicking the monitor initiates a CSS `transform: scale(3.2)` with `transform-origin` at the monitor glass centre, plus a radial glow bloom and white overlay fade. The transition runs for approximately 800ms. Escape cancels the zoom and returns to the room. After the zoom completes, `window.history.pushState` sets `#desk`; the back button and `popstate` event return to the room.

### Desk Close-Up

The desk view renders at full 1408 by 768 with the same stage scaling. It contains:

- **Desktop**: A pixel-art desktop with a clock strip and shortcut icons in a 3 by 2 grid, each launching a desk app.
- **Pointer-following mouse**: Sprite that follows the user's cursor, position lerped at 0.15 per frame via `requestAnimationFrame`.
- **Idle screensaver**: Appears after 15 seconds of inactivity.
- **Speaker mute buttons**: Same `useRoomAudio().toggle()` as the room speakers.
- **Lamp toggle**: Same persistence path as the room lamp.

**Desktop apps** (each with an escape ladder: app to desktop to room):

- **README**: Project overview and credits.
- **Paint**: Persistent pixel-art canvas saved to `localStorage` (`room-paint-v1`) with PNG download.
- **Minesweeper**: In-monitor Minesweeper with a pure engine in `src/lib/games/minesweeper-engine.ts`. Best time saved via game storage.
- **Terminal**: Command-line interface with `help`, `changelog`, `konami` commands. Activated by the Konami code or desktop icon.
- **Settings**: SFX on/off and volume, music volume, clock 12/24h toggle.
- **Guestbook**: Reads and writes entries via `/api/guestbook` (Upstash Redis sorted set, newest 500, name + message + timestamp only).
- **Links**: Webring and 88 by 31 buttons linking to friends' sites.
- **Legal**: Privacy Policy and Terms of Use tabs.

### Sprite Pipeline

Pixel art source files live in `assets/pixel-art/`. Web sprites are extracted to `public/room/` by Node.js scripts using `sharp`:

1. Scan every frame for the bounding box of non-transparent pixels.
2. Compute the union bounding box across all frames.
3. Add a 2px pad on each side, clamped to the 1408 by 768 canvas bounds.
4. Crop every frame to the identical union rect and write as PNG.

This ensures all frames in an animation share the same pixel dimensions, so frame swapping never causes layout jitter. After extracting new sprites, add them to `FILES` in `scripts/generate-lighting.mjs` and run `npm run lighting` to generate lighting variants.

### Audio System

`RoomAudioProvider` wraps the application with an audio context:

- A six-track playlist defined in `src/lib/room/playlist.ts`.
- Playback via an HTML `<audio>` element, not the Web Audio API.
- `NowPlaying` widget (fixed-position, bottom-left) showing current track title, artist, and cover art. Cover art is loaded from external image files or extracted from embedded ID3v2 APIC frames by `src/lib/room/id3.ts`, a zero-dependency ID3v2 parser.
- Audio preferences persisted in `room-save-v1`.

`MusicNotes` spawns floating note sprites from speaker driver holes at a constant rate while audio is playing. Notes are staggered between left and right channels with a 550ms offset.

### Persistence

All user preferences are client-side `localStorage`:

- `room-save-v1`: audio, lampOn, visitCount, volume, clock24h, sideTableOpen, sfx, sfxVolume
- `room-paint-v1`: Paint canvas pixel data
- `room-discoveries-v1`: Discovered achievements set

The one server-side store is the guestbook: an Upstash Redis sorted set `guestbook:entries` storing name, message, and timestamp only. Rate-limit keys expire after one hour. No email addresses or IPs are persisted.

### Discoveries

Achievements unlock as the user explores the room (first lamp toggle, first drawer open, finding the terminal, night mode, etc.). A toast notification appears on unlock. The `DiscoveriesBadge` in the room HUD shows the count.

### Lighting States

Four visitor-local lighting states (dawn, day, dusk, night), cycled via build-time graded PNG variants generated by `scripts/generate-lighting.mjs`. Background crossfades over 1.5 seconds between states. The `?light=` query parameter overrides the automatic cycle for testing.

## API Routes

### GET/POST/DELETE /api/guestbook

- **GET**: Returns the 50 most recent guestbook entries.
- **POST**: Creates an entry after CSRF check (Origin/Referer must match the production domain), IP rate-limiting (5/hr, Upstash + in-memory fallback), honeypot check (`website` must be empty), Zod validation (name max 32 chars, message max 280 chars), and control-character/HTML/profanity stripping.
- **DELETE**: Clears entries (requires `GUESTBOOK_ADMIN_KEY` header).

Without Upstash credentials, the guestbook fails soft: GET returns `[]`, POST returns 500.

### GET /api/weather

Read-only, no secrets. Proxies Open-Meteo for Canberra's current conditions. Hourly-cached, fail-soft. Used by `RoomWeather` for rain and snow particle effects and by `RoomNightSky` for the night state.

## Security

- Security headers set in `next.config.ts` (HSTS, CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`)
- CSRF protection on guestbook POST via Origin/Referer header validation
- Rate limiting on guestbook POST (5 req/hr per IP)
- `robots.txt` disallows all major AI training crawlers
- `X-Robots-Tag: noai, noimageai` on all responses
- Terms of Use explicitly prohibit scraping and AI training
- All user input validated server-side with Zod + honeypot anti-spam + sanitisation
- Secrets via environment variables only, never hardcoded

## Pre-Deploy Checks

```bash
npm run type-check   # tsc --noEmit, strict mode
npm run lint         # ESLint flat config (eslint.config.mjs)
npm run build        # Next.js production build
```

All three must pass with zero errors before a commit is considered deployable.

## Deployment

Pushing to `master` triggers an automatic Vercel production deployment. Domain: `ahmedyhussain.com`.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free to use, modify, and share for **noncommercial** purposes. **Commercial use** and **use as AI/ML training data** require prior written permission -- contact Ahmed Hussain (Ahmedyhussain07@gmail.com).
