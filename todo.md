# todo.md — Pixel-room: remaining work

Single source of truth (project convention). Only **unfinished** work lives here; completed
phases are summarised in the log below with commit hashes.

## ✅ Done (committed)
- **Spec 1** — room-only architecture, hover fix, Legal app, browser removed (`511ee9d`).
- **Spec 2** — global click SFX + iPod skip (`2cfe2c6`); five interaction sounds
  lamp/drawer/clock/poster/pc-start (`0576eb1`).
- **Plan A — Settings app** — SFX on/off + volume, music volume, clock 12/24 h, calm-mode
  toggle (`3cad0bf`).
- **English-only migration** — French removed; single `en.ts` dictionary (`de15697`).
- **Plan B — Discoverability** — discoveries/achievements + toasts, DiscoveriesBadge,
  first-visit hints, konami→terminal (`963ead1`).
- **Plan C — Mobile** — fill-height, drag-to-pan, larger hit areas, idle preload (`ff2700d`).
- **Room bug fixes** — desk centering, sprites hover-only, lighting-aware preload (`6579eff`, `10358e6`).
- **Spec E (part 1) — Weather window + night sky** — `/api/weather` (Open-Meteo), `RoomWeather`
  (rain/snow), `RoomNightSky` (moon + stars), `WINDOW_GLASS`, `'night'` discovery (`30233e1`).
- **Spec F — Personal-web features (from `./reference`)** — v17: custom pixel cursor (`.room-cursor`),
  "currently" status sticky note, `changelog` terminal command, Links/webring app (`DeskLinks`),
  and a **server guestbook** (Upstash Redis, `/api/guestbook` GET/POST/DELETE, `DeskGuestbook`);
  privacy policy updated; F0 desk-art refresh with konami sticky notes; plus an unplanned
  `XtremeSplash` intro. Review fix: `DISCOVERY_IDS` restored `settings`/`terminal`/`screensaver`
  (now 20). *(hash on this commit.)*

Build is green (`type-check && lint && build`). CLAUDE.md current through the **v17** note.

## Resolved (v16) — the two earlier follow-ups are closed
1. **Global click SFX** — final decision: **off** (`f9e1dd6`→`cd3a463`). The click sound plays
   only on explicit interactions, not on every click.
2. **Calm mode** — the inert toggle was **removed** from Settings. Motion is always on, no opt-out.
   Minor leftover: the `calmMode` pref is orphaned in `storage.ts` (harmless; nothing reads it).
   Optional cleanup if you ever touch `storage.ts`.

## Project constraints (current)
- **English-only:** user-facing strings live in `src/lib/i18n/dictionaries/en.ts` only.
- **Room palette:** pixel font `var(--font-pixel)`; bubble/panel `#3d2e1e`/`#5a4430`/`#e8d5b0`;
  app screens `#faf8f5` / `#fffef5` / `#e8e0d8` (see `DeskReadme.tsx` / `DeskSettings.tsx`).
- **Pixel art via `<img>` + `image-rendering: pixelated`**, never `next/image`. New room sprites:
  `scripts/extract-*.mjs` union-bbox → `public/room/` → add to `FILES` in
  `scripts/generate-lighting.mjs` → `npm run lighting`.
- **localStorage only** (`room-save-v1`, `room-paint-v1`, `room-discoveries-v1`), no DB. The one
  server route is read-only `/api/weather` (no secrets, aggregate, fixed Canberra).
- **Reduced motion forced on** site-wide (`MotionProvider reducedMotion="never"`); no opt-out.
- No unit-test runner: verify with `type-check && lint && build` + driving `npm run dev`
  (kill stale servers with `taskkill //F //IM node.exe` — Git Bash has no `pkill`).
- Escape ladder for every desk app: app → desktop → room.

**Everything remaining is blocked on Ahmed drawing sprites.** Two items left:

---

# SPEC D — Diegetic record player  ⟨ART-BLOCKED⟩

**Goal:** a turntable you operate as the music control (iPod already skips; the turntable adds
play/pause + a spinning record for tactility).

⟨ART⟩ **Needed from Ahmed** (full-canvas 1408×768 sources so `extract-*.mjs` can bbox them):
turntable base (rest), platter+record, tonearm parked, tonearm on-record, and a 2–4 frame spin
loop. Optional audio: `vinyl-crackle.mp3` (loopable).

### Planned steps (executable once art lands)
- [ ] `scripts/extract-turntable.mjs` (mirror `extract-side-table.mjs`, union bbox across spin
      frames) → `public/room/turntable-*.png`; add to `generate-lighting.mjs` `FILES`; `npm run lighting`.
- [ ] `ROOM_OBJECTS` `turntable` entry; `RoomTurntable.tsx` (inside `RoomAudioProvider`):
      needle-down/click platter → `toggle()`; click arm-return → `skip()`; spin loop plays while
      `playing`, holds parked when paused (drive frames like `AnimatedSprite`).
- [ ] ⟨if crackle⟩ add a looping ambient channel to `RoomSfxProvider` (a dedicated `<audio loop>`
      started/stopped with `playing`, `sfx`-gated).
- [ ] Keep desk speakers as passive art (still emit music notes). `room.turntableLabel` in
      `en.ts`. Verify play/pause/skip sync with `NowPlaying`; reduced-motion still plays audio + spin.
- [ ] ⟨DECIDE⟩ placement (desk vs shelf); whether the speaker mute-toggle is removed (default:
      keep speakers as art, mute lives on turntable + NowPlaying).

---

# SPEC E-a — Cat on the bed  ⟨ART-BLOCKED⟩

(Spec E parts b/c — weather window + night sky — shipped in `30233e1`. The cat is the last piece.)

⟨ART⟩ **Needed from Ahmed:** sleep loop (2–3 frames), wake/stretch (4–6 frames), optional sit
pose; optional `purr.mp3`.

### Planned steps (executable once art lands)
- [ ] `scripts/extract-cat.mjs` → `public/room/cat-*.png`; add to lighting `FILES`; `npm run lighting`.
- [ ] `ROOM_OBJECTS` `cat` entry; render via `AnimatedSprite` (sleep loop on hover; click →
      play-once stretch then resettle). Rest pose varies by `visitCount`. `discover('cat')` (add
      `'cat'` to `DISCOVERY_IDS` + a `room.discoveryLabels.cat` label). ⟨if purr⟩ via
      `RoomSfxProvider`. `room.catLabel` in `en.ts`.

---

*As a phase starts, keep it here until done, then replace it with a one-line entry + hash in the
"Done" log above. Update CLAUDE.md after each phase.*
