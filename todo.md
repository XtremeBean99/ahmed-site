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

## E-b. Real-weather window  ⟨API — plannable now⟩
**LOCKED:** fixed **Canberra** (no geolocation, no consent).
- [ ] `src/app/api/weather/route.ts` (re-adds one read-only route): fetch Open-Meteo
      (lat -35.28, lon 149.13, `current=weather_code,precipitation`), `export const revalidate = 3600`,
      fail-soft to `{ code: 0, precip: 0 }`. No key, no secrets.
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
- [ ] `RoomWeather.tsx`: fetch `/api/weather` on mount; map code → none/rain/snow; cheap CSS
      particle overlay clipped to the window rect (⟨ART optional⟩ swap for sprite frames later).
- [ ] Update CLAUDE.md (weather route re-added — note it re-introduces one API route after the
      Spec-1 purge); privacy policy needs no change (aggregate, fixed location, no personal data).

## E-c. Night sky + car-light sweeps  ⟨CSS — plannable now⟩
- [ ] At lighting state `night`, render moon + a few stars behind the window (emissive, never
      lighting-graded) and an occasional headlight sweep across the wall (soft moving gradient
      band ~every 20–40 s). `discover('night')`.
- [ ] Verify each sub-phase with `?light=night`. Commit per sub-phase.

---

*As each plan starts, keep it here until done, then replace it with a one-line entry + hash in
the "Done" log above. Update CLAUDE.md after each phase.*
