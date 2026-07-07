# CLAUDE.md — AI Agent Context for ahmedyhussain.com

The single consolidated context document for this project. Read this before touching any code.
It absorbs the former `docs/PLAN.md` (spec history), `docs/taskt.txt` (original room brief),
`docs/audio-licences.md`, `docs/suggestions.txt` (June audit), `assets/pixel-art/STYLE.md`,
`CONTENT.md`, and `SECURITY-REVIEW.md` (July 2026 review — see Security), all of which have
been retired. Last consolidated: 7 July 2026.

---

## What This Project Is

A production personal website for **Ahmed Hussain** — BCom/LLB(Hons) candidate at ANU, Canberra.
Domain: `ahmedyhussain.com`
Repo: `https://github.com/XtremeBean99/ahmed-site`
Vercel project: `ahmed-site` (ID: `prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`)

The homepage `/` is the **digital bedroom**: an interactive pixel-art room that acts as the
front door to the rest of the site (the original creative brief called for "a digital place,
not another developer portfolio" — warm, nostalgic, rewarding to explore, Y2K/Neocities spirit
with modern quality). The conventional site lives under `/home`, `/games`, `/projects`,
`/tutoring`, `/legal`.

## Current State (7 July 2026)

Monitor hover highlight (4-frame yellow outline + simultaneous 18-frame Win98 boot-screen
overlay, both play-once-hold), −2px hover lifts on all room objects (monitor, poster, bonsai,
coffee), clickable room-view speakers with mute/unmute + music notes, clickable lamp in
desk close-up with lamp-off art crossfade, desk close-up respects persisted lamp state.
Continuing: room scene with monitor/poster/bonsai/lamp/coffee hotspots, zoom transition into
a desk close-up, in-monitor browsing of the real site via same-origin iframe (site content
zoomed out 25% for readability), six-track music player with now-playing widget (with
embedded ID3 cover art extraction) and speaker mute, pointer-following desk mouse, music
notes from the speaker drivers, three-wisp coffee steam, lamp-off art crossfade with
flicker, dust motes,
idle screensaver (15 s), visitor counter, "My room" CTA on /home linking back to /,
EN/FR throughout. No pending actions remain.

---

## Critical Constraints

### 1. Design must remain strictly monochrome (except the room page)
The design uses zinc-950 (`#09090b`) background, white text, zinc-800 borders. No colour accents.
No gradients except the subtle hero vignette. If you add new UI, match this palette exactly.
References: Vercel, Linear, Stripe aesthetic.
**Exception:** `/` (the room) uses a warm brown/mauve pixel-art palette. This exemption is
scoped to `/` only. Do NOT add colour to any `(site)` page.

### 2. All user input is hostile
The contact form has server-side Zod validation and a honeypot field. Any new form or API route
applies the same pattern from `src/services/contact.ts`. Never skip server-side validation.

### 3. Minimal persistence — email-only except the ninja leaderboard
No general-purpose database. Contact submissions are emailed via Resend, not persisted. The one
exception: ninja leaderboard run times in Upstash Redis behind `src/services/leaderboard.ts`
(lazy client `src/lib/redis.ts`, env-var credentials). Future persistent storage must follow
the same pattern: behind `src/services/`, env vars only. (Room preferences use `localStorage`
client-side only: `room-save-v1` key, currently `{ audio, lampOn }`.)

### 4. Secrets via environment variables only
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` etc. Never hardcoded. See
`.env.example` and the Environment Variables table below.

### 5. The site is bilingual — every user-facing string must be translated
English and French. Single source of truth: `src/lib/i18n/dictionaries/en.ts` and `fr.ts`.
**Any new or changed user-facing text goes in BOTH dictionaries in the same commit.** The
`Dictionary` type derives from `en.ts`, so a missing French key fails `npm run type-check`.
This rule has been violated four separate times in room components ("MUSIC ON/OFF", "Toggle
speakers", "Pause"/"Skip", the clock tooltip) — grep room components for quoted capitalised
strings during any review.

### 6. Framing headers must stay SAMEORIGIN / 'self'
`next.config.ts` sends `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'`
(vercel.json mirrors this for `/games/ninja/*`). In-monitor browsing depends on it. Do NOT
"harden" these back to DENY/'none' — that silently kills the desk browser while adding
nothing (third-party embedding is already blocked by same-origin-only).

### 7. Audio filenames are case-sensitive in production
Vercel serves case-sensitively; Windows dev machines do not. A track that plays locally but
404s deployed is a case mismatch between git and `playlist.ts` (the Saffron incident). Keep
`public/audio/` kebab-case lowercase; verify with `git ls-files public/audio`.

### 8. Documentation policy — exactly three markdown files
Owner direction 7 July 2026: the repository contains exactly three markdown docs —
`CLAUDE.md` (this file, the single consolidated context), `README.md`, and, only while work
is in flight, `TODO.md` (the active task plan / checklist). `TODO.md` is **deleted in the
final commit** once its tasks are all complete. No `docs/` folder, no other `.md` files
anywhere (`CONTENT.md` and `SECURITY-REVIEW.md` were folded in and removed under this
policy — it has already been violated once by a parallel session resurrecting them).
Durable knowledge goes into this file; task plans go into `TODO.md`.

---

## Architecture in One Page

```
src/
├── app/
│   ├── (site)/            Route group — chrome for all content pages (URLs unchanged)
│   │   ├── layout.tsx     Site chrome: skip-link, CircuitBackdrop/Mesh, Header, main, Footer
│   │   ├── template.tsx   Per-route fade (client, reduced-motion safe)
│   │   ├── home/          The former homepage (Hero…Contact sections), now at /home
│   │   ├── games/         Hub + typing-test + breakout + ninja
│   │   ├── projects/      Hub + code + silicon + aglc4 + base-converter + ninja(redirect)
│   │   ├── tutoring/      Services, pricing, FAQ, enquiry form
│   │   └── legal/         Terms + Privacy
│   ├── layout.tsx         Root: fonts, metadata, I18nProvider only. No chrome.
│   ├── page.tsx           The room (server shell → <Room/>), chrome-free
│   └── api/               contact + ninja/leaderboard routes
│
├── components/
│   ├── room/              Room.tsx (state machine: room→zooming→desk), RoomStage,
│   │                      RoomObject (hotspot + tooltip), AnimatedSprite, Monitor,
│   │                      RoomSpeakers (art + mute/unmute + MusicNotes),
│   │                      DeskView (close-up + iframe browser), DeskIcon, MusicNotes,
│   │                      NowPlaying, RoomAudioProvider, RoomHud
│   ├── games/ layout/ projects/ sections/ ui/   (unchanged monochrome site components)
│
├── lib/
│   ├── room/              objects.ts (hotspot registry), playlist.ts (Track[]),
│   │                      storage.ts (localStorage prefs), useStageScale.ts
│   ├── aglc4/ convert/ games/ github/ i18n/ ninja/
│   ├── motion.ts redis.ts resend.ts ratelimit.ts utils.ts validations.ts
└── services/              contact.ts, leaderboard.ts
```

Default to Server Components; `'use client'` only for browser APIs, state, or Framer Motion.

---

## The Room (`/`) — Everything an Agent Must Know

### Stage and transforms (do NOT reintroduce the origin bug)
Fixed 1408×768 stage, fit-scaled with letterboxing. Two-element transform:
the **outer** wrapper centres and fit-scales about `center center`; the **inner** element
zooms about the monitor screen point *in stage coordinates*. Applying the fit scale on an
element whose transform-origin is the monitor point shifts the whole room off-centre — this
shipped once and was the v3 "site is off-centre" bug.

### View state machine (`Room.tsx`)
`room → zooming (800 ms, Escape-cancellable, 1.5 s safety) → desk`. Desk state is
`history.pushState('#desk')`; `/#desk` deep-links; popstate/Escape return. The room renders
inside its own monitor iframe (recursion guard removed — `/` is accessible from the desk browser).

### Desk view (`DeskView.tsx`)
Close-up art (`desk-closeup.png` and `desk-closeup-lamp-off.png`, crossfaded+flickered via
`lampOn`/`lampFlicker` props passed from Room) with a clickable lamp toggle at (8,88 160×480)
sharing Room's `toggleLamp` callback (one persistence path). Also: screen rect (436,152,536×308) hosting a pixel desktop
(clock strip + 6 shortcut icons) or the **in-monitor browser** — a same-origin `<iframe>` of
real site pages (zoomed out 25% via `scale(0.75)` for readability). Iframe navigation
between desk opens uses `contentWindow.location.replace()`
(keeps joint browser history clean); current path tracked by 500 ms same-origin polling;
strip gains Desktop/Expand buttons in browser mode; Expand opens in a new tab (`window.open`);
Escape ladder browser→desktop→room;
below 700 px viewport, icons navigate full-page instead. Speakers (left 190,265 175×300;
right 1005,270 215×300) are mute-toggle buttons with press-dip and muted glyph. Music notes
emit from the driver holes (left: 284,349 r34 / 284,478 r50; right: 1118,352 r38 /
1115,472 r52) at a constant 1100 ms rate, 2000 ms float, pooled `<img>`s + CSS keyframes.
The desk mouse (110×80 sprite) follows the pointer proportionally within x 975–1140,
y 572–635 via rAF + lerp writing transforms directly (never React state per pointer event);
rest point (1007,608); static on touch/reduced-motion. Idle screensaver after 15 s.
Mouse jitter triggers on any click outside the screen area.

### Audio (`RoomAudioProvider` + `playlist.ts` + `NowPlaying` + `id3.ts`)
One context provider mounted above both views owning a single `Audio` element.
**It must ALWAYS provide context** — gating it behind reduced motion crashed every
reduced-motion visitor once (`useRoomAudio()` throws outside the provider). Reduced motion
never disables sound, only animation. Track index lives in a ref (URL string-matching against
`audio.src` broke `ended` advancement once). Autoplay attempts on mount when the stored pref
allows, falling back to first-gesture. Volume 0.3. `NowPlaying` (bottom-left, both views):
36×36 cover — external cover file first, then embedded ID3 APIC frame via `id3.ts`, then
cassette-SVG placeholder. Title 12px, artist 10px, play/pause/skip 18px icons. All labels
from dictionaries. `id3.ts` is a zero-dependency ID3v2 parser that fetches the first 256 KB
of an MP3 and extracts APIC (attached picture) frames.

### Room-view objects (`objects.ts` registry + `AnimatedSprite`)
monitor (235,257 402×350, 4 frames: rest + 3-frame hover highlight, play-once-hold,
with an 18-frame Win98 boot-screen overlay on the glass (270,282 214×171) that plays
simultaneously and also holds its last frame → zoom to desk; zoom origin stays at
stage (360,331) = rect + (125,74)) · poster (997,78 134×247, 5 frames, play-once-hold,
click toast) · saitama poster (761,76 177×243, 14 frames, `play-all-loop-last-two` —
a third `SpriteMode` that plays all frames once then bounces between the last two) ·
bonsai (1241,291 99×131, 5 frames, loop, `tooltipAlign="right"` because the
centred bubble overflowed the right edge) · lamp (60,300 110×220, toggles lamp-off art
crossfade + flicker, persisted) · coffee (160,475 83×83, 6 frames: rest + 5-frame hover
highlight, play-once-hold) with three staggered CSS steam wisps (`steam-rise` keyframes,
per-wisp `--sway`/`--dur`, negative delays, rendered behind the mug). All AnimatedSprite
objects (poster, bonsai, coffee) and the Monitor share a −2px hover lift (`motion.img`/
`motion.div` with `animate={{ y: -2 }}`, `DURATION.fast`). Desktop speakers
(`RoomSpeakers.tsx`): art layer (146,292 435×218) crossfades/flickers with the lamp;
cabinets (left 148,355 108×154; right 490,290 91×141) are mute-toggle buttons rendered
AFTER the monitor so they win its overlapping anchor rect; notes emit from driver holes
(left 215,408 r15 / 215,463 r25; right 546,345 r14 / 546,397 r24). Clock bubble at
(620,100) (moved left of the saitama poster) uses `room.clockTip` dictionary key and shows a visitor counter (`👁 N`)
incremented on each page load (persisted in `room-save-v1`). Adding an object: entry in
`ROOM_OBJECTS` → sprites in `public/room/` → both dictionaries → render in `Room.tsx`.

### Accessibility invariants
Every hotspot is a real `<a>`/`<button>` inside `<nav aria-label>`; visible focus-visible
rings (2 px warm outline, offset); tooltips on focus as well as hover; skip link first in tab
order targeting `/home`; decorative layers (`MusicNotes`, steam, dust, pad mouse) are
`aria-hidden` + `pointer-events: none`; `prefers-reduced-motion` disables all decorative
animation but never functionality.

### Sprite pipeline and style guide (former STYLE.md)
Source art in `assets/pixel-art/` (repo-internal, not deployed); web sprites in `public/room/`
as raw PNG served via `<img>` with `image-rendering: pixelated` — **never `next/image`**
(resampling destroys pixel art). Multi-frame sprites are cropped to a **shared union bbox
+2 px pad** across all frames so playback never jitters (`scripts/extract-*.mjs`).
Source art is organised by category under `assets/pixel-art/`:
- `background/` — full-canvas room backgrounds + bedroom-gen-original
- `bonsai/` — bonsai tree frames (`tree1..5.png`)
- `close-up-desk/` — desk close-up art + mouse-only-closeup
- `coffee/` — coffee mug + steam source frames
- `music-sfx/` — music-note sprite art
- `poster/` — kitagawa poster frames (`kitagawa-1..5.png`) + saitama frames
  (`saitama-1..14.png`, `saitama.ase`)
- `room-view-monitor/` — monitor+keyboard+mouse base + highlight frames,
  `room-view-monitor/monitor-loading/` — Win98 boot-screen frames,
  room-speakers lamp-on/off art
Palette: warm dusk bedroom — wall #4a3e3a, wood #6b4d3a/#5a3d2a/#4a3020, floor #3a2820,
bezel #2a2220; lamp amber from the left, dusk-blue window light from the right; clean 1 px
outlines, no anti-aliasing. UI palette for bubbles/toasts: #3d2e1e fill, #5a4430 border,
#e8d5b0 text. Pixel font: `src/fonts/Minecraft.ttf` (fan recreation, free for personal use)
via `next/font/local` → `--font-pixel`, fallback `"Courier New", monospace`.
Extracted sprite ledger: poster-1..5 (997,78 134×247) ·
saitama-1..14 (761,76 177×243) ·
monitor-1..4 (235,257 402×350, rest + hover highlight) ·
monitor-loading-1..18 (270,282 214×171, boot screen on the glass) ·
room-speakers / room-speakers-lamp-off (146,292 435×218) ·
bonsai-1..5 (1241,291 99×131) · desk-closeup (full canvas) ·
desk-closeup-lamp-off (full canvas) · background / background-lamp-off
(full canvas) · mouse (1007,608 110×80) · speaker-left/right (speaker rects) · note-1..3
(~16–21×22) · coffee-1..6 (160,475 83×83) · coffee-steam (187,460 25×45).
Background (`background.png`, ~55 KB) loads `fetchpriority="high"` as the LCP element.

### Audio licences (former audio-licences.md)
Owner direction 6 July 2026: deployment treated as private/testing; commercial recordings ship
at the owner's informed risk; revisit before public promotion. The domain is publicly
reachable. (General information, not legal advice.) Tracks in `public/audio/`:
lo-fi-beat (TBC) · saffron (TBC) · cant-look-in-my-eyes ⚠ commercial ·
big-poppa-habaytak-remix ⚠ commercial remix · remember-summer-days ⚠ commercial ·
sky-restaurant ⚠ commercial. Covers: fayrouz.jpg, sky-restaurant.jpg, summer-days.jpg.
The same private/testing caveat applies to the poster art: kitagawa (My Dress-Up Darling)
and saitama (One Punch Man) are fan art of commercial IP — revisit alongside the audio
before public promotion.

### Session history (condensed from the retired PLAN.md specs)
- **v1** `b70857e`–`a109482`: `(site)` restructure, room v1 (monitor→/home, poster, bonsai).
- **v2** `5643ee2`–`e7a40e4`+: defect fixes, Minecraft font, desk view + shortcuts.
- **v3** `0127b8d` era: centring fix, audio provider + playlist, now-playing, speakers, pad
  mouse, lamp art. Notable bugs fixed: off-centre transform origin; dead toggle when audio
  pref false.
- **v4** `aa9db95`–`ca70b5b`: reduced-motion crash fix, in-monitor browsing, music notes,
  coffee mug + owner extras (clock, flicker, dust, jitter, screensaver).
- **v5** `ea902e8`–`64101ee`: frame-headers fix (XFO DENY → SAMEORIGIN), constant-rate
  notes from driver holes, coffee highlight frames + 3-wisp steam, bonsai `tooltipAlign`,
  clock i18n, docs consolidation into this file, saffron case rename done.
- **Post-v5** `674c158`–`9820230`: "My room" CTA on /home hero, recursion guard removed
  (room renders inside its own iframe), body `overflow:hidden` removed (iframe scroll fix),
  ID3 embedded cover art extractor, iframe site content zoomed out 25%, expand opens new tab,
  visitor counter, window tint removed, animation speeds bumped, UI sizes increased.
- **v6 (security hardening)** `7 July 2026`: Deleted live Vercel OIDC token from
  `.vercel/.env.production.local` (never committed, now removed). Tightened contact CSRF
  check: absent Origin is now rejected in production (previously skipped). Escaped `<` and
  `-->` sequences in `JsonLd` component's serialized JSON as defense-in-depth against
  script-tag breakout. Documented leaderboard client-trust model in route source.
- Recurring session hazard: the agent sandbox's mount of this repo went stale repeatedly
  (phantom deletions, NUL-padded reads, unremovable `.git/index.lock`). Builds and `git
  status` from a sandbox are unreliable; trust direct file reads and run builds locally.

---

## Roadmap — Suggestions From Basic to Ambitious

Owner-curated backlog. Tiers are effort/scope, not priority order. ~~Struck~~ = done.

**Assessment, 7 July 2026 — recommended order.** The room feature set is now rich and has
a documented history of regressions (reduced-motion crash, off-centre zoom, XFO DENY,
four i18n misses, audio `ended` bug), so the highest-leverage next step is **23 (Playwright
E2E of the room flows)** — every future feature lands faster once the zoom/desk/audio/
reduced-motion paths are pinned. Owner's picks from this assessment — **15 (rate-limiter
hardening), 1 (skip-no-repeat), 7 (volume slider), 3 (room OG image from background.png)** —
are in flight via `TODO.md` (7 July); the rest (2, 8, 6, 25, 26, …) stay deferred here.
New items 25–26 below came out of the same assessment.

**Basic (hours)**
1. Skip-no-repeat: `nextTrack` avoids repeating the last-played track.
2. Desk session persistence: remember `screenMode`/`browserPath` in `sessionStorage`.
3. Room OG image: replace the text-card `opengraph-image.tsx` on `/` with a 1200×630 room crop.
4. `/room` alias redirect to `/`.
5. ~~Visit odometer~~ — visitor counter next to clock (9820230).
6. Bonsai growth: resting frame advances with a `visits` counter in prefs (5 stages drawn).
7. Volume control: small 3-step volume on the NowPlaying widget (prefs-persisted).

**Intermediate (a day or two each)**
8. Interaction SFX behind a separate `sfx` pref: icon clicks, poster flip, lamp switch, purr.
9. Monitor wallpaper unlocks: settings icon on the desk screen; stored in prefs.
10. Window weather: Open-Meteo API route (no key) with hourly cache; rain/snow overlays over
    the window; time-of-day tint already scaffolds this.
11. Cat on the bed: sleeping loop, wake/stretch on click, position varies by visit counter —
    needs new art through the union-bbox pipeline.
12. Achievements/discoveries: localStorage set + pixel toast + `aria-live=polite`; the poster
    toast is the seed of this system.
13. Konami code → `terminal` screenMode on the desk (state machine already supports modes):
    `help`, `whoami`, `cat todo.txt`, `exit`.
14. Mobile polish: drag-to-pan the room stage on phones, larger hit areas, tap hints.
15. Hardening (June audit carry-overs): move the rate limiter to Upstash so cold starts don't
    reset it; ~~confirm the stray `VERCEL_OIDC_TOKEN` was never committed and delete it~~;
    consider CSP nonces to drop `unsafe-inline`.

**Ambitious (multi-day, design-heavy)**
16. Desktop OS expansion: draggable pixel windows on the monitor — file-explorer window
    mapping site content, the terminal, a music-player window; keep it same-origin DOM.
17. Playable arcade: Breakout as an "app" running inside the monitor screen (engine is
    already pure in `src/lib/games/breakout-engine.ts`).
18. Guestbook: pixel notebook on the desk writing short messages to Redis behind
    `src/services/` (validation + rate limiting per the contact pattern).
19. Seasonal/diurnal art variants: full day/night/season background sets via the generation
    pipeline; the lamp-off crossfade pattern generalises.
20. Ambient presence: anonymous "N people are in the room" via Redis presence counter.
21. Blog in the room: notebook object opens an MDX-backed `/blog` (needs `@next/mdx`,
    monochrome outside the room, dictionaries for chrome).
22. Full French SEO: `/fr` routes with localised metadata (today FR is cookie-based with
    English-only SEO by design — this is a deliberate boundary, revisit only with intent).
23. Regression net: Playwright E2E of the room flows (zoom, desk, iframe, audio, reduced
    motion) + Lighthouse CI on previews.
24. Admin dashboard under `/app/admin/` with middleware auth (service layer is ready).
25. Room asset weight: consolidate the 18 boot-screen frames (and other frame sets) into
    single sprite-sheet PNGs animated via CSS `steps()` / background-position — cuts ~30
    requests on first hover; audit which of the ~60 room sprites deserve `<link rel=preload>`.
26. Honest visitor counter: the clock's `👁 N` is localStorage-only (it counts only your own
    visits). Replace with a Redis `INCR` behind `src/services/` (same pattern as the
    leaderboard) or relabel it — currently it reads as a site-wide count but isn't.

---

## Games

`/games` hub links self-contained games; best scores in `localStorage`
(`src/lib/games/storage.ts`, namespaced `ahmed-site:games:v1:*`). The one server-backed
feature is the ninja leaderboard.

- **Typing test** (`/games/typing-test`): live WPM + accuracy; phrases dataset in
  `src/lib/games/phrases.ts` (law/AI governance/cyber; no silicon copy by design); pure math
  in `wpm.ts`.
- **Breakout** (`/games/breakout`): canvas + rAF, DPR-aware, pauses when hidden; physics and
  power-ups (`expand`/`multi`/`slow`/`life`) pure in `breakout-engine.ts`; `Breakout.tsx` is a
  thin shell.
- **Super Ninja Monk Fighter IV** (`/games/ninja`, v1.0): Godot 4.7 WASM export served as a
  standalone page (launch link opens `public/games/ninja/index.html` in a new tab; COOP/COEP +
  `wasm-unsafe-eval` CSP via `vercel.json`). Build updates: copy from `beam/build/web/`.
  Leaderboards: game POSTs `{name, timeCs, tokensPercent}` to `/api/ninja/leaderboard`
  (Zod, rate-limited, foreign Origin rejected, absent Origin allowed for desktop builds);
  Upstash sorted sets `ninja:lb:any` / `ninja:lb:100` via `services/leaderboard.ts`; page
  reads top 20 server-side, fails soft.

To add a game: card on the hub, route + shell under `(site)/games/<slug>/`, logic in
`src/lib/games/`, URL in `sitemap.ts`, strings in both dictionaries.

---

## Site-Wide Motion

Framer Motion only (no GSAP). Shared tokens in `src/lib/motion.ts` (`EASE_OUT_EXPO`,
`DURATION`, `fadeInUp`, `cardHover`, `springSubtle`). `(site)/template.tsx` provides the
per-route fade; `Header.tsx` has a shared-`layoutId` nav underline; `MotionCard` is the card
hover-lift. Every motion addition checks `useReducedMotion()`.

`CircuitMesh` (`src/components/ui/CircuitMesh.tsx`): canvas circuit-mesh backdrop for `(site)`
pages — monochrome, self-contained, reduced-motion renders one static frame, pauses when
hidden/off-screen, edge fade via CSS mask.

---

## Internationalisation (EN + FR)

Language via an EN/FR header toggle stored in a `locale` cookie, read server-side; **no `/fr`
URLs** (English canonical). `src/lib/i18n/`: `config.ts`, `dictionaries/en.ts` (canonical,
defines `Dictionary`), `fr.ts`, `server.ts` (`getLocale`/`getDictionary` for server
components), `client.tsx` (`I18nProvider`, `useT()`).

Workflow for any copy change: add to `en.ts` → add French at the identical path (formal
*vous*; first person for Ahmed's bio) → reference via `t.…` → `npm run type-check`.

Deliberate English-only boundaries: SEO metadata/OG images; large editorial datasets
(typing phrases, AGLC4 configs). Cookie-read makes content pages dynamically rendered —
accepted trade-off. Contact-form client validation messages are localised via
`makeContactSchema(messages)`; the server uses English defaults.

---

## Contact System

```
POST /api/contact
  1. CSRF: Origin/Referer must match production domain
  2. Rate-limit by IP (5 req/hr, in-memory — src/lib/ratelimit.ts; resets on cold start)
  3. contactSchema.safeParse() server-side + honeypot ("website" must be empty)
  4. services/contact.ts → lazy Resend client → email
  5. 200 / 400 / 429 / 500
```
No database, no IP logging. The privacy policy (2026-06-16) matches this reality — keep it
accurate if data handling changes.

**Resend lazy init** (`src/lib/resend.ts`): the client is created only when sending —
`new Resend(undefined)` at module load breaks `next build` without the env var. Do not make
it eager. `CONTACT_EMAIL` constant lives here too. Subjects are sanitised.

---

## Fonts

`next/font/google` in root layout: Inter → `--font-sans`; Playfair Display → `--font-serif`
(headings via `globals.css`). Room-only: local Minecraft.ttf → `--font-pixel` (see room
section). Do not apply the pixel font to `(site)` pages.

---

## Security

Headers in `next.config.ts` `headers()` for all routes: HSTS, **X-Frame-Options SAMEORIGIN**,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP with
**`frame-ancestors 'self'`** (see Critical Constraint 6 — required by in-monitor browsing),
`X-Robots-Tag: noai, noimageai`. CSP retains `unsafe-inline` for scripts (Next.js trade-off).
`vercel.json` sets COOP/COEP + game CSP for `/games/ninja/*` static files.

AI crawler blocking: `robots.ts` disallows GPTBot, ClaudeBot, Google-Extended, PerplexityBot,
CCBot, Bytespider, etc.; Terms prohibit scraping/AI training. Do not remove.

**July 2026 security review** (absorbed from the retired `SECURITY-REVIEW.md`): no critical
or high findings. Resolved same-day: stray Vercel OIDC token deleted from disk (never
committed); contact CSRF now rejects header-less requests in production; `JsonLd` escapes
`<`/`-->` against script-tag breakout; leaderboard client-trust model documented in the
route source (scores are spoofable by design — cosmetic board, no privileges). Open items,
tracked as Roadmap 15: in-memory rate limiter is per-instance on serverless (move to
Upstash) and its IP key trusts the leftmost `X-Forwarded-For` value; CSP `unsafe-inline`
accepted as a Next.js trade-off (nonces would be the upgrade). Dependencies: two moderate
advisories, build-time only — monitor.

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key |
| `CONTACT_TO_EMAIL` | No | Defaults to `ahmedyhussain07@gmail.com` |
| `CONTACT_FROM_EMAIL` | No | Defaults to `Ahmed Hussain <noreply@ahmedyhussain.com>` |
| `NEXT_PUBLIC_BASE_URL` | No | Defaults to `https://ahmedyhussain.com` |
| `GITHUB_TOKEN` | No | Raises API rate limit for the code page |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | For leaderboard | `KV_REST_API_*` also read |

Never commit `.env.local` / `.env`. (June audit flagged a stray `VERCEL_OIDC_TOKEN` in
`.env.local` — confirm never committed, then delete; see Roadmap item 15.)

---

## Common Tasks

- **New page:** `src/app/(site)/[route]/page.tsx`, export `metadata`, add to `sitemap.ts`,
  Header nav if appropriate, strings in both dictionaries.
- **New room object:** see the room Object registry section.
- **Run locally:** `cp .env.example .env.local` then `npm run dev`.
- **Pre-deploy:** `npm run type-check && npm run lint && npm run build`.

## What Does Not Exist Yet (deliberately)

Admin dashboard (service layer ready; `/app/admin/` + middleware auth when built), newsletter
(Resend audiences), blog (needs MDX; see Roadmap 21), durable rate limiting (Roadmap 15),
general-purpose database (constraint 3).
