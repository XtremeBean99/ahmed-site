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

Build is green (`type-check && lint && build`). CLAUDE.md reconciled to the room-only,
English-only reality (constraints 2–4, i18n section, roadmap, v14 note).

## ⚠ Two follow-ups from the agent's v12/v13 work (decide before/with the next phase)
1. **Global click SFX was removed** (v12) — the click no longer plays on every click (an
   explicit earlier request). `'click'` is registered in `RoomSfxProvider` but never triggered.
   Re-add a `pointerdown → play('click')` listener if you still want it.
2. **Calm mode is a dead toggle** — `MotionProvider` is hardcoded `reducedMotion="never"` and
   `prefersReducedMotion()` returns false, but `DeskSettings` still shows a Calm-mode switch.
   Either restore the pref wiring or remove the control.

## Project constraints (current)
- **English-only:** user-facing strings live in `src/lib/i18n/dictionaries/en.ts` only.
- **Room palette:** pixel font `var(--font-pixel)`; bubble/panel `#3d2e1e`/`#5a4430`/`#e8d5b0`;
  app screens `#faf8f5` / `#fffef5` / `#e8e0d8` (see `DeskReadme.tsx` / `DeskSettings.tsx`).
- **Pixel art via `<img>` + `image-rendering: pixelated`**, never `next/image`. New room sprites:
  `scripts/extract-*.mjs` union-bbox → `public/room/` → add to `FILES` in
  `scripts/generate-lighting.mjs` → `npm run lighting`.
- **localStorage only** (`room-save-v1`, `room-paint-v1`, `room-discoveries-v1`), no DB (sole
  exception: the read-only weather route in E-b).
- **Reduced motion forced on** site-wide (calm-mode opt-out is currently inert — see follow-up 2).
- No unit-test runner: verify with `type-check && lint && build` + driving `npm run dev`.
- Escape ladder for every desk app: app → desktop → room.

Remaining order: **D → E** (both need Ahmed's sprites; art steps marked ⟨ART⟩; E-b/E-c can
proceed without art).

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
      `en.ts`. Verify play/pause/skip sync with `NowPlaying`; reduced-motion still plays audio +
      spin. Commit.
- [ ] ⟨DECIDE⟩ placement (desk vs shelf); whether the speaker mute-toggle is removed (default:
      keep speakers as art, mute lives on turntable + NowPlaying).

---

# SPEC E — Life & atmosphere  ⟨PARTLY ART-BLOCKED⟩

Three independently shippable sub-phases.

## E-a. Cat on the bed  ⟨ART-BLOCKED⟩
⟨ART⟩ sleep loop (2–3 frames), wake/stretch (4–6 frames), optional sit pose; optional `purr.mp3`.
- [ ] `scripts/extract-cat.mjs` → `public/room/cat-*.png`; add to lighting `FILES`; `npm run lighting`.
- [ ] `ROOM_OBJECTS` `cat` entry; render via `AnimatedSprite` (loop sleep; click → play-once
      stretch then resettle). Rest pose varies by `visitCount`. `discover('cat')` (add to the
      Plan B `DISCOVERY_IDS`). ⟨if purr⟩ via `RoomSfxProvider`. `room.catLabel` in `en.ts`.

### DESIGN DECISIONS (locked 11 Jul 2026)
- Weather is **always visible** (not gated by time of day).
- Night addition is **moon + stars only** — no car-headlight sweep.
- Window glass rect (stage coords, verify against `background.png`): approx
  **`WINDOW_GLASS = { x: 1185, y: 52, w: 223, h: 300 }`** (upper-right two-pane window;
  the bonsai sits on its sill, so both overlays render BEFORE the bonsai in z-order).
- Both overlays live inside `RoomStage` (stage coords), are `aria-hidden` + `pointer-events:none`,
  and are **emissive** (not passed through `lightingSrc`). Motion always on (site rule).

## E-a. Cat on the bed  ⟨ART-BLOCKED — deferred⟩
(unchanged; needs cat sprites — see above.)

## E-b. Real-weather window  ⟨buildable now⟩

### Task E1: weather API route
- [ ] Create `src/app/api/weather/route.ts`:
```ts
export const revalidate = 3600
export async function GET() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-35.28&longitude=149.13&current=weather_code,precipitation', { next: { revalidate } })
    const j = await r.json()
    return Response.json({ code: j?.current?.weather_code ?? 0, precip: j?.current?.precipitation ?? 0 })
  } catch { return Response.json({ code: 0, precip: 0 }) }
}
```
- [ ] Verify: `npm run dev`, `curl localhost:3000/api/weather` → `{ "code": <n>, "precip": <n> }`.

### Task E2: pure weather-code mapping
- [ ] Create `src/lib/room/weather.ts` (pure, testable — WMO codes):
```ts
export type WeatherKind = 'clear' | 'rain' | 'snow'
export interface Weather { kind: WeatherKind; heavy: boolean }

const SNOW = new Set([71, 73, 75, 77, 85, 86])
const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

export function mapWeather(code: number, precip: number): Weather {
  if (SNOW.has(code)) return { kind: 'snow', heavy: [75, 86].includes(code) }
  if (RAIN.has(code)) return { kind: 'rain', heavy: precip > 2 || [65, 82, 95, 96, 99].includes(code) }
  return { kind: 'clear', heavy: false }
}
```

### Task E3: `RoomWeather.tsx` (rain/snow overlay)
- [ ] Create `src/components/room/RoomWeather.tsx` (`'use client'`): fetch `/api/weather` on mount,
      `mapWeather(...)`, and render an absolute overlay at `WINDOW_GLASS` (`overflow:hidden`,
      `aria-hidden`, `pointer-events:none`). Render pooled particle divs:
      rain = thin diagonal streaks via `@keyframes room-rain` (translateY + slight X); snow = dots
      via `@keyframes room-snow` (translateY + gentle sway). Count = `heavy ? ~40 : ~18`; random
      left%, delay, duration. `clear` → render nothing. Fail-soft: on fetch error stay `clear`.
- [ ] Add `@keyframes room-rain` / `room-snow` to `src/app/globals.css` (translate from above the
      glass to below; opacity fade). Colours: rain `rgba(200,210,230,.35)`, snow `rgba(240,240,250,.8)`.

### Task E4: verify weather
- [ ] Temporarily hardcode `code=61` (rain) then `71` (snow) in the route to eyeball both, then
      revert. Confirm streaks/dots fall inside the window glass only and sit behind the bonsai.

## E-c. Night sky (moon + stars)  ⟨buildable now⟩

### Task E5: `RoomNightSky.tsx`
- [ ] Create `src/components/room/RoomNightSky.tsx` (`'use client'`): prop `light: LightingState`.
      Render only when `light === 'night'`. A **moon** (soft radial-gradient circle) in the upper
      pane (approx stage `(1330, 80)`) and **~6 stars** (tiny bright dots) scattered in the upper
      glass, each with a subtle `@keyframes room-twinkle` opacity pulse (staggered). Emissive:
      plain positioned divs, NOT `lightingSrc`. `aria-hidden`, `pointer-events:none`.
- [ ] Add `@keyframes room-twinkle` to `globals.css`.

### Task E6: wire into `Room.tsx` + docs
- [ ] In `Room.tsx`, inside `RoomStage` and BEFORE the bonsai `AnimatedSprite`, render
      `<RoomNightSky light={light} />` then `<RoomWeather />` (both above the background, below the
      bonsai/sill). Weather always mounted; night sky self-gates on `light`.
- [ ] `discover('night')` when `light === 'night'` is first seen (add `'night'` to `DISCOVERY_IDS`).
- [ ] Update `CLAUDE.md`: new **weather API route** (re-introduces one read-only route after the
      Spec-1 purge — privacy policy unchanged: aggregate, fixed Canberra, no personal data),
      `RoomWeather`/`RoomNightSky`, the `WINDOW_GLASS` rect, and a v15 session note.
- [ ] `npm run type-check && lint && build`; drive with `?light=night` (moon + stars) and the
      hardcoded-weather check. Commit.

---

*As each plan starts, keep it here until done, then replace it with a one-line entry + hash in
the "Done" log above. Update CLAUDE.md after each phase.*
