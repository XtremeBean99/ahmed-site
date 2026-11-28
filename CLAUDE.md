# CLAUDE.md: agent context for ahmedyhussain.com

Read this before touching code. It holds the rules and the map; the detail lives in `docs/`:

| File | What is in it |
|---|---|
| `docs/room.md` | Every desk app in depth, room features (splash, cat, bonsai, window, posters, calendar, tour, daily), room-object coordinates, the sprite pipeline and style guide, audio internals, audio licences |
| `docs/catan.md` | Pixel Catan (`/catan`): engine, bots, UI, saves, tests |
| `docs/gurtle.md` | Gurtle, the daily word ladder: engine, saves, streak board, mascot |
| `docs/recipes.md` | The cookbook / recipe blog: design draft (not built yet) |
| `docs/history.md` | Session log v1-v34, the old roadmap, notes on the retired conventional site |
| `docs/archive/todo-2026.md` | Design logs and build plans (Catan CAT*, mobile MOB*, terminal TRM, snake SNK) |
| `SECURITY-REVIEW.md` | Security status: what is open, fixed and accepted |

Last consolidated: 28 November 2026 (removed the retired site's leftovers; see v34 in `docs/history.md`).

## What this project is

Personal site of **Ahmed Hussain**, BComp/LLB(Hons) candidate at ANU, Canberra. Domain `ahmedyhussain.com`,
repo `github.com/XtremeBean99/ahmed-site`, Vercel project `ahmed-site` (`prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`).

The whole site is `/`, an interactive pixel-art bedroom: clickable room objects, a zoom into a desk close-up whose
monitor runs a small pixel OS (README, games, guestbook, terminal...), plus `/catan`. The conventional pages
(`/home`, `/games`, `/projects`, `/tutoring`, `/legal`, `/room`) redirect permanently (308) to `/`. Their code, the monochrome theme
and the Inter/Playfair fonts were deleted in `4a6f3cb` (recover from `4a6f3cb^`).

## Current state

v34 (28 November 2026). What each version added: `docs/history.md`.

## Critical constraints

1. **All user input is hostile.** Input routes: `guestbook`, `highscores`, `highscores/daily`, `feature-request`.
   Each POST runs, in order: CSRF (Origin/Referer must match the host, `src/lib/csrf.ts`), IP rate limit
   (`src/lib/ratelimit.ts`, Upstash with in-memory fallback), honeypot (`website` must be empty), Zod
   (`src/lib/validations.ts`), then stripping and profanity checks (`src/lib/input.ts`). Admin DELETE/GET take
   `GUESTBOOK_ADMIN_KEY` as `Authorization: Bearer` or `X-Admin-Key`, never a query param, rate-limited before
   the constant-time compare. Error text stays in server logs (Upstash errors can carry the token). A new
   input route copies this pattern.
2. **Persistence is localStorage-first.** Server state is only Upstash Redis behind `src/services/`: the
   guestbook (`guestbook:entries`, newest 500), highscores (`hiscores:<game>`, 100 kept per game, Gurtle streaks
   included), daily boards (`hiscores:daily:<game>:<YYYY-MM-DD>`, expire after 8 days) and feature requests
   (`feature-requests`, newest 500, with the optional contact). Names, scores, messages, contacts and times only:
   no IPs (rate-limit keys hold them for one hour, then expire). Everything else is `localStorage`: `room-save-v1`
   prefs (`audio, lampOn, visitCount, volume, clock24h, sideTableOpen, sfx, sfxVolume, splashAt`),
   `room-discoveries-v1`, `room-paint-v1`, `room-reader-v1`, `room-terminal-fs-v1`, `room-terminal-history-v1`,
   `catan-save-v2`, and the games namespace `ahmed-site:games:v1:*` (`src/lib/games/storage.ts`).
   **The Privacy Policy (`legal.privacy` in `en.ts`) lists all of this.** A change that stores or sends anything
   new updates the policy and its date in the same change.
3. **Secrets in env vars only** (`.env.example`). Without Upstash vars everything server-side fails soft
   (boards say "offline"); `getRedis()` and the Resend client are lazy so builds never need them.
4. **English only.** One dictionary, `src/lib/i18n/dictionaries/en.ts`; its shape is the `Dictionary` type. No
   em dashes in visitor-facing copy (removed site-wide in v12).
5. **Books and the film are static assets** (`public/books/<id>.json` from `scripts/extract-books.mjs`,
   `public/video/shrek.mp4`), never services.
6. **Room palette:** warm brown/mauve pixel art; UI bubbles `#3d2e1e` fill, `#5a4430` border, `#e8d5b0` text;
   app screens `#faf8f5` / `#fffef5` / `#e8e0d8` (`ARCADE` in `pixel-ui.tsx`). Pixel font `--font-pixel`
   (`src/fonts/Minecraft.ttf`). Pixel art is plain `<img>` with `image-rendering: pixelated`, never `next/image`;
   the image optimiser is off (`images.unoptimized`), so keep it off unless something truly needs it.
7. **Audio paths are case-sensitive on Vercel.** Keep `public/audio/` kebab-case lowercase. Tracks ship as
   `public/audio/<id>.m4a` encoded by `bash scripts/encode-audio.sh` from the MP3 masters in `assets/audio/`
   (not deployed); every track needs a cover file, since the encoded files carry no embedded art.

## Architecture

```
src/
  middleware.ts          per-request CSP nonce for pages (see Security)
  app/
    layout.tsx           fonts, metadata, I18nProvider, MotionProvider, Vercel metrics; connection() = dynamic
    page.tsx             the room: <XtremeSplash><RoomSfxProvider><Room/>
    catan/page.tsx       Pixel Catan
    api/                 guestbook, highscores (+ daily), feature-request, weather (Open-Meteo, cached 1 h)
  components/
    room/                Room.tsx (room view, state machine), DeskView.tsx (desk + screen modes), Desk*.tsx apps,
                         RoomObject/AnimatedSprite (hotspots), RoomCat, RoomTour, audio + SFX providers, ...
    catan/  providers/  seo/
  lib/
    room/                objects.ts (hotspot registry), deep-link.ts, tour.ts, lighting.tsx, storage.ts, ...
    games/               pure engines + tests (minesweeper, snake, chess, mahjong, solitaire, ...), highscores.ts,
                         daily.ts, storage.ts; catan/ engine
    terminal/            the desk terminal's bash, commands and editors
    i18n/ redis.ts ratelimit.ts input.ts csrf.ts validations.ts motion.ts use-reduced-motion.ts
  services/              guestbook.ts, highscores.ts, feature-requests.ts (all Redis access)
scripts/                 sprite drawing/extraction, lighting grades, icons, covers
```

## The room (`/`)

**Stage.** Fixed 1408x768 stage, fit-scaled. Two transforms: the outer wrapper centres and fit-scales about
`center center`; the inner one zooms about the monitor point in stage coordinates. Putting the fit scale on the
element whose origin is the monitor shifts the room off-centre (the v3 bug). On phones the room fills the height
and pans horizontally (`pan` state in Room, `clampPanX`).

**Views.** `room -> zooming (800 ms, Escape cancels, 1.5 s safety) -> desk`, and the site **opens on the desk**
(README). `#desk` is pushed on entry; popstate/Escape go back. Room and desk each mount their own
`RoomAudioProvider`.

**Deep links** (`src/lib/room/deep-link.ts`, tested): `/?app=<id>` lands on the desk with that app open, and while
the desk is up the address bar follows the open app via `replaceState` (desktop and README clear it). The
terminal is deliberately not linkable (Konami secret). `/?app=minesweeper&daily` opens today's daily board
(one-shot flag, removed on read). `/?tour` starts the room tour. `?light=dawn|day|dusk|night` forces lighting;
`?notrack` opts a browser out of Vercel analytics.

**Desk apps.** Screen modes: `desktop | readme | paint | minesweeper | snake | blackjack | solitaire | pong |
breakout | chess | mahjong | music | legal | guestbook | settings | terminal | movie | typing | highscores |
request | gurtle`. Each app but README and the desktop is a `next/dynamic` chunk listed in `APP_CHUNKS`, wrapped in
`AppBoundary`. Escape ladder: app's own layers -> desktop -> room. Details per app: `docs/room.md`.
Adding an app: build the 536x308 layout, then a portrait layout from `useDeskScreen()` checked at h 440 and 640;
add the dynamic import + `APP_CHUNKS` + screen mode in DeskView, a shortcut in Room's `deskShortcuts`, copy in
`en.ts`, a discovery id if wanted, and the id in `LINKABLE_APPS` if it should be shareable.

**Phones: the contract every desk app follows.**
- `isPortraitPhone()` (`desk-screen.ts`): portrait phones get a 320 x h screen (h 440-700) in a pixel bezel with a
  56 px music bar; everything else keeps the scaled 536x308 desk.
- `useDeskScreen()` gives `{ w, h, portrait }`. Lay out in logical px from it; never store layout-derived
  coordinates in state.
- Rotation keeps state: keep one element tree, branch inside your root (`ArcadeFrame` for games), never `key` on
  `portrait`. Pass `portrait` to `ArcadeFrame` once the app has a portrait layout.
- Portrait strip is 44 px with tools on a second row; `ArcadeButton size="xl"` (38 px) is the tap target; text
  at least 12 px (labels 10); inputs 16 px on coarse pointers (iOS zoom).
- Pointer events, never mouse events; `touchAction: 'none'` on anything dragged; hover only for
  `pointerType === 'mouse'`.

**Room objects.** Registry in `src/lib/room/objects.ts`; every hotspot is a real button/link inside the
`<nav>`, with a focus ring and a tooltip on hover and focus (`RoomObject`). Sprites are cropped to a shared
union bbox so frames never jitter; hover plays highlight frames (#f6da9c outline grown 1 then 2 px). Adding one:
registry entry -> sprites in `public/room/` -> add to `FILES` in `scripts/generate-lighting.mjs` and run
`npm run lighting` -> copy in `en.ts` -> render in `Room.tsx`. Overlapping sprites use `hitPath` masks.

**Room features.** Splash, bonsai, cat and bowl, window, both posters, calendar and tour each have their own
module in `src/lib/room/` (most with tests) and an art script in `scripts/`. Read their section in `docs/room.md`
("Room features") before changing one. Rules that apply to all of them: the cat and bonsai render only after prefs
load; the calendar's date is unknown until mount, so SSR and hydration agree; the owner prefers the splash's 28
hand-drawn frames as drawn, and the Kitagawa poster's figure never moves.

**Lighting.** Visitor-local dawn/day/dusk/night picks graded sprite sets in `public/room/lighting/<state>/`
(dusk = originals). Rerun `npm run lighting` after any sprite change. Emissive layers (boot screen, notes, LED
clock, the cat's Zs) are never graded.

**Audio.** One `Audio` element per provider. The provider must ALWAYS render its context (gating it on reduced
motion once crashed every such visitor). The element gets no `src` until the first `play()` (`ensureLoaded`)
and autoplay is only attempted after a user activation: Chrome fetches about 1 MB of a track for a refused
`play()` and the first bytes of any `src`, even with `preload="none"`. Track advance is random without
repeats. SFX are fetched once and played through Web Audio; arcade/cat sounds are synthesized `tone()`s.

**Accessibility.** Reduced motion disables decorative animation, never function. Read it with
`useReducedMotion` from `@/lib/use-reduced-motion`, never framer-motion's: framer's reads the media query on the
first client render, so reduced-motion visitors hydrated different styles from the server's and React re-rendered
the whole room. Decorative layers are
`aria-hidden` and `pointer-events: none`. Discoveries announce through an `aria-live` region.

## Games and scores

Desk games live in `src/components/room/Desk*.tsx` with pure engines and `node:test` suites in
`src/lib/games/`. Bests are per-browser (`BEST_KEYS`). **Scores** (`DeskHighscores`) shows your best beside the
public top 10 per game (`HISCORE_GAMES` in `highscores.ts` sets each game's plausible range; scores are
browser-reported, so ranges keep out junk, not a determined cheat).

**Daily challenge** (`src/lib/games/daily.ts`): one UTC-dated board for the whole world; details in `docs/room.md`.

Gurtle (daily word ladder, public streak board, turtle mascot): `docs/gurtle.md`. Pixel Catan: `docs/catan.md`.

## Security

- `src/middleware.ts` sets a fresh nonce per page request: `script-src 'self' 'nonce-...'` (plus
  `'unsafe-eval'` in `next dev` only, plus `va.vercel-scripts.com`). Next stamps the nonce on its own scripts
  because the root layout calls `connection()`, which makes every page render per request. A page that must be
  static again would lose its scripts under this policy. `style-src` keeps `'unsafe-inline'` (React and Framer
  Motion inline styles).
- The matcher skips `api/`, `_next/static`, `_next/image` and any path with a file extension; those keep the
  baseline CSP from `next.config.ts` (which still has `'unsafe-inline'`, harmless on non-HTML responses). On
  pages the middleware header replaces the config one (checked with `next start`).
- Other headers (`next.config.ts`): HSTS, `X-Frame-Options: DENY` and `frame-ancestors 'none'`, nosniff,
  Referrer-Policy, Permissions-Policy, `X-Robots-Tag: noai, noimageai`. `robots.ts` blocks AI crawlers; do not
  remove.
- JSON-LD (`JsonLd.tsx`) is escaped against `</script>` breakout and needs no nonce (not executed).

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | guestbook, scores, daily, requests, rate limits | absent: fail soft; `KV_REST_API_URL` / `_TOKEN` (Vercel's names) work too |
| `GUESTBOOK_ADMIN_KEY` | admin deletes and listing | header only, never a query param |
| `RESEND_API_KEY`, `FEATURE_REQUEST_TO_EMAIL` | emailing feature requests | otherwise only stored |
| `FEATURE_REQUEST_FROM_EMAIL` | optional sender | defaults to Resend's onboarding sender |

## Commands

- `npm run dev` (copy `.env.example` to `.env.local` first); production check: `npm run build && npx next start`.
- Before deploying: `npm run type-check && npm run lint && npm run build`. Lint is clean; keep it that way.
- Releases: a push to `master` only builds a preview. Production is a separate step (Promote to Production in
  the Vercel dashboard), and previews share the production Redis, so do not post test data from them.
- Keep `vercel.json`: the Vercel project has no framework preset, so that file is what tells it this is Next.js.
- `package.json` overrides Next's pinned PostCSS with the root one (audit fix); drop it when Next ships a
  patched version.
- Tests: `npm run test:room`, `test:games`, `test:terminal`, `test:catan` (`test:catan:long` for fuzzing).
- Art: `npm run lighting`, `node scripts/draw-side-table-side.mjs` (then `extract-side-table.mjs`), `node scripts/draw-cat.mjs`, `node scripts/draw-bonsai.mjs`, `draw-window.mjs`,
  `draw-poster.mjs`, `node scripts/extract-xtreme.mjs`, others in `docs/room.md`. Music: `bash scripts/encode-audio.sh`.
- Browser checks: the scratch Playwright approach (system Chromium via `playwright-core`) works well for the
  room; there is no committed E2E suite yet.

## Open roadmap

- Desk session persistence (remember the open app in `sessionStorage`), now partly covered by `?app=`.
- Ambient presence ("N people in the room") via a Redis counter with TTL keys.
- Playwright E2E of the room flows plus Lighthouse CI on previews.
- Daily Solitaire (needs a winnable-deal solver); a share card for scores (`next/og`).
- Seasonal art variants; a blog notebook (MDX); an admin page for moderating boards.
- Ideas backlog from the owner: `ideas.txt`.

