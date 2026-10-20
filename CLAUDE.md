# CLAUDE.md: agent context for ahmedyhussain.com

Read this before touching code. It holds the rules and the map; the detail lives in `docs/`:

| File | What is in it |
|---|---|
| `docs/room.md` | Every desk app in depth, room-object coordinates, the sprite pipeline and style guide, audio internals, audio licences |
| `docs/catan.md` | Pixel Catan (`/catan`): engine, bots, UI, saves, tests |
| `docs/history.md` | Session log v1-v27, the old roadmap, notes on the retired conventional site |
| `docs/archive/todo-2026.md` | Design logs and build plans (Catan CAT*, mobile MOB*, terminal TRM, snake SNK) |
| `CONTENT.md` | Owner-editable site copy |
| `SECURITY-REVIEW.md` | The June 2026 audit |

Last consolidated: 13 October 2026.

## What this project is

Personal site of **Ahmed Hussain**, BComp/LLB(Hons) candidate at ANU, Canberra. Domain `ahmedyhussain.com`,
repo `github.com/XtremeBean99/ahmed-site`, Vercel project `ahmed-site` (`prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`).

The whole site is `/`, an interactive pixel-art bedroom: clickable room objects, a zoom into a desk close-up whose
monitor runs a small pixel OS (README, games, guestbook, terminal...), plus `/catan`. The conventional pages
(`/home`, `/games`, `/projects`, `/tutoring`, `/legal`, `/room`) redirect permanently (308) to `/`. Their code, the monochrome theme
and the Inter/Playfair fonts were deleted in `4a6f3cb` (recover from `4a6f3cb^`).

## Current state (20 October 2026)

v30: the window shows a pixel-art city for every time of day and weather (the CSS moon, stars, rain and snow
are gone), the My Dress Up Darling poster has a looping hover animation, the cat has a food bowl, and the
splash is back to its 28 hand-drawn frames at 120 ms.

v29: the Xtreme splash moved to one sprite sheet, plays
in full on the first visit and once a day with a short cut otherwise, and holds its first frame until the room
behind it has loaded; the bonsai grows with visits (5 stages, hover highlight, blossoms); the music is AAC
`.m4a` at 96 kbps (89 MB of MP3 down to 66 MB), with the MP3 masters in `assets/audio/`.

v28 added: shareable desk links (`/?app=chess`, the address bar follows the open app), a daily Minesweeper
challenge with a per-day public board, the cat on the bed, a guided room tour (`?tour`, the README's strip, the
room HUD), a per-request CSP nonce (no more `unsafe-inline` scripts), music that downloads nothing until it plays,
and this docs split. Before that: the desk shelf, Typing, Scores and Request apps (v23), phones (v22). See
`docs/history.md`.

## Critical constraints

1. **All user input is hostile.** Input routes: `guestbook`, `highscores`, `highscores/daily`, `feature-request`.
   Each POST runs, in order: CSRF (Origin/Referer must match the host, `src/lib/csrf.ts`), IP rate limit
   (`src/lib/ratelimit.ts`, Upstash with in-memory fallback), honeypot (`website` must be empty), Zod
   (`src/lib/validations.ts`), then stripping and profanity checks (`src/lib/input.ts`). Admin DELETE/GET take
   `GUESTBOOK_ADMIN_KEY` as `Authorization: Bearer` or `X-Admin-Key`, never a query param, rate-limited before
   the constant-time compare. Error text stays in server logs (Upstash errors can carry the token). A new
   input route copies this pattern.
2. **Persistence is localStorage-first.** Server state is only Upstash Redis behind `src/services/`: the
   guestbook (`guestbook:entries`), highscores (`hiscores:<game>`, 100 kept per game), daily boards
   (`hiscores:daily:<game>:<YYYY-MM-DD>`, expire after 8 days) and feature requests. Names, scores, messages
   and times only: no IPs (rate-limit keys expire). Everything else is `localStorage`: `room-save-v1` prefs
   (`audio, lampOn, visitCount, volume, clock24h, sideTableOpen, sfx, sfxVolume, calmMode, splashAt`), `room-discoveries-v1`,
   `room-paint-v1`, `room-reader-v1`, `room-terminal-fs-v1`, `catan-save-v2`, and the games namespace
   `ahmed-site:games:v1:*` (`src/lib/games/storage.ts`).
3. **Secrets in env vars only** (`.env.example`). Without Upstash vars everything server-side fails soft
   (boards say "offline"); `getRedis()` and the Resend client are lazy so builds never need them.
4. **English only.** One dictionary, `src/lib/i18n/dictionaries/en.ts`; its shape is the `Dictionary` type. No
   em dashes in visitor-facing copy (removed site-wide in v12).
5. **Books and the film are static assets** (`public/books/<id>.json` from `scripts/extract-books.mjs`,
   `public/video/shrek.mp4`), never services.
6. **Room palette:** warm brown/mauve pixel art; UI bubbles `#3d2e1e` fill, `#5a4430` border, `#e8d5b0` text;
   app screens `#faf8f5` / `#fffef5` / `#e8e0d8` (`ARCADE` in `pixel-ui.tsx`). Pixel font `--font-pixel`
   (`src/fonts/Minecraft.ttf`). Pixel art is plain `<img>` with `image-rendering: pixelated`, never `next/image`.
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
    catan/  providers/  seo/  ui/
  lib/
    room/                objects.ts (hotspot registry), deep-link.ts, tour.ts, lighting.tsx, storage.ts, ...
    games/               pure engines + tests (minesweeper, snake, chess, mahjong, solitaire, ...), highscores.ts,
                         daily.ts, storage.ts; catan/ engine
    terminal/            the desk terminal's bash, commands and editors
    i18n/ redis.ts ratelimit.ts input.ts csrf.ts validations.ts motion.ts utils.ts
  services/              guestbook.ts, highscores.ts, feature-requests.ts (all Redis access)
scripts/                 sprite drawing/extraction, lighting grades, icons, covers
```

Dead code from the retired site, safe to delete when convenient: `src/lib/{aglc4,convert,github,ninja}/`,
`src/lib/og.tsx`, `public/favicon.svg`, `public/games/`, `public/lawyer.jpg` (check with grep first).

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
request`. Each app but README and the desktop is a `next/dynamic` chunk listed in `APP_CHUNKS`, wrapped in
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

**Splash** (`XtremeSplash.tsx`, timing in `src/lib/room/splash.ts`, tested): one sheet
`public/room/xtreme-sheet.png` from `scripts/extract-xtreme.mjs` (the 28 hand-drawn frames at 120 ms; the script
can generate in-betweens with `TWEENS`, but the owner prefers the animation as drawn). Full play on the first visit and when `splashAt` is a day old, else a short cut from the white
logo. The first frame is held until every eager `<img>` behind it has finished and fonts are in (4 s cap). Any key
or press skips it; reduced motion skips it entirely.

**The bonsai** (`src/lib/room/bonsai.ts`, tested; art from `scripts/draw-bonsai.mjs`): stage by visit (1 sprout,
2 from visit 2, 3 from visit 4, 4 the hand-drawn tree from visit 7, 5 in bloom from visit 12), `?bonsai=1..5`
forces one. Six frames per stage (`bonsai-<stage>-<frame>.png`): rest, 1 px highlight, then four 2 px swaying
frames that `AnimatedSprite` loops (`loopFrom`). Rendered only after prefs load, like the cat.

**The cat** (`RoomCat.tsx`, art from `scripts/draw-cat.mjs`, drawn in code on a 2 px grid): sleeps at one of
`CAT_SPOTS` chosen by `visitCount`, breathes on a 1.3 s two-frame loop with drifting Zs, wakes for 3.5 s on a
click (mew + purr tones, a toast line from `room.catWake`, the `cat` discovery). Rendered only after prefs load.
Its bowl (`CAT_BOWL` in `src/lib/room/cat-feeding.ts`, tested) is on the floor by the bed: a click fills it
(`kibble` tone) and the cat plays a timeline (`feedingTimeline`/`feedingPose`): sits up, walks to the mattress
edge, crouches, leaps down, walks to the bowl, eats for 4.8 s while it empties (`room.catFed` toast, `fed`
discovery), then leaps back up and curls up where it was. Profile sprites: `cat-walk-1..4` (frames advance with
distance, so paws never slide), `cat-crouch`, `cat-leap`, `cat-eat-1..2`. Reduced motion skips the walks.

**The window** (`RoomWindow.tsx`, `src/lib/room/window-view.ts`, tested; art from `scripts/draw-window.mjs`): a
pixel city cut to the two panes of glass, one still per lighting state and weather (`/room/window/<light>-<weather>.png`,
never graded), with looping rain, snow and night twinkle frames. Weather is Canberra's from `/api/weather`;
`?weather=clear|rain|snow|heavy-rain|heavy-snow` forces it.

**The poster** (`scripts/draw-poster.mjs`): 14 frames from `kitagawa-1.png`: rest, 1 px highlight, then a
12-frame hover loop (`POSTER_LOOP_FROM`): the printed hearts bob behind her, a glint sweeps the glossy print, a
sparkle at her fingertips. She herself never moves (an earlier version that moved her looked wrong).

**The Saitama poster** (`scripts/draw-saitama.mjs`, box widened 16 px left to x 745 for the punch): built from
the layers of `assets/pixel-art/poster/saitama.ase` (the script reads the .ase itself): 26 frames at 50 ms: rest,
highlight, the fist growing out of his raised hand and over the poster's edge (drawn above the frame and cape),
an impact (overshoot, jolt, burst), then a 12-frame idle loop (`SAITAMA_LOOP_FROM`): the
sunburst boils with streaks flying out, power ticks round the fist, a shine on his head. Click still swaps to
`poster-alt.png`.

**The tour** (`RoomTour.tsx`, steps and target rects in `src/lib/room/tour.ts`): a spotlight inside the stage
(stage coordinates, so it follows scale and pan) and a caption card fixed to the viewport. Phones pan each
target to the centre. Arrow keys step, Escape closes (capture phase, before the room's own handlers). The last
step can zoom straight to the desk.

**Lighting.** Visitor-local dawn/day/dusk/night picks graded sprite sets in `public/room/lighting/<state>/`
(dusk = originals). Rerun `npm run lighting` after any sprite change. Emissive layers (boot screen, notes, LED
clock, the cat's Zs) are never graded.

**Audio.** One `Audio` element per provider. The provider must ALWAYS render its context (gating it on reduced
motion once crashed every such visitor). The element gets no `src` until the first `play()` (`ensureLoaded`)
and autoplay is only attempted after a user activation: Chrome fetches about 1 MB of a track for a refused
`play()` and the first bytes of any `src`, even with `preload="none"`. Track advance is random without
repeats. SFX are fetched once and played through Web Audio; arcade/cat sounds are synthesized `tone()`s.

**Accessibility.** Reduced motion disables decorative animation, never function. Decorative layers are
`aria-hidden` and `pointer-events: none`. Discoveries announce through an `aria-live` region.

## Games and scores

Desk games live in `src/components/room/Desk*.tsx` with pure engines and `node:test` suites in
`src/lib/games/`. Bests are per-browser (`BEST_KEYS`). **Scores** (`DeskHighscores`) shows your best beside the
public top 10 per game (`HISCORE_GAMES` in `highscores.ts` sets each game's plausible range; scores are
browser-reported, so ranges keep out junk, not a determined cheat).

**Daily challenge** (`src/lib/games/daily.ts`): the day is the UTC date, so the whole world shares one board.
Minesweeper's daily board is seeded from `dailySeed('minesweeper', date)` (FNV-1a -> `mulberry32`) with the
centre pre-opened (`createDailyBoard`), so it does not depend on the first click. One try a day, remembered in
games storage (`minesweeper-daily`); the clock starts on the first move; daily wins never touch the classic best.
`POST /api/highscores/daily` accepts today or yesterday (UTC) only. Scores has a "Daily Minesweeper" tab. To add
a daily game, extend `DAILY_GAMES`; Solitaire would need a solver first, since some Klondike deals cannot be won.

Pixel Catan: `docs/catan.md`.

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
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | guestbook, scores, daily, requests, rate limits | absent: fail soft |
| `GUESTBOOK_ADMIN_KEY` | admin deletes and listing | header only, never a query param |
| `RESEND_API_KEY`, `FEATURE_REQUEST_TO_EMAIL` | emailing feature requests | otherwise only stored |
| `FEATURE_REQUEST_FROM_EMAIL` | optional sender | defaults to Resend's onboarding sender |
| `NEXT_PUBLIC_BASE_URL` | optional | defaults to `https://ahmedyhussain.com` |

## Commands

- `npm run dev` (copy `.env.example` to `.env.local` first); production check: `npm run build && npx next start`.
- Before deploying: `npm run type-check && npm run lint && npm run build`.
- Tests: `npm run test:room`, `test:games`, `test:terminal`, `test:catan` (`test:catan:long` for fuzzing).
- Art: `npm run lighting`, `node scripts/draw-cat.mjs`, `node scripts/draw-bonsai.mjs`, `draw-window.mjs`,
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
