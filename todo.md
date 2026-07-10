# todo.md — Pixel-room: remaining work

Single source of truth (project convention). Only **unfinished** work lives here; completed
phases are summarised in the log below with commit hashes.

## ✅ Done (committed)
- **Spec 1** — room-only architecture, hover fix, Legal app, browser removed (`511ee9d`).
- **Spec 2** — global click SFX + iPod skip (`2cfe2c6`); five interaction sounds
  lamp/drawer/clock/poster/pc-start (`0576eb1`).
- **Plan A — Settings app** — SFX on/off + volume, music volume, clock 12/24 h, calm-mode
  reduced-motion opt-out (`3cad0bf`).

## ⚠ Current-state gate (read before starting anything below)
At last assessment (11 Jul 2026) an **English-only migration was in-flight and uncommitted**
(`fr.ts` + `LanguageToggle.tsx` deleted; `i18n/config`, `i18n/server`, `layout` modified; new
audio tracks added) and the build was **red**. Before starting a plan below:
1. `npm run type-check && npm run lint && npm run build` must be **green**. If still red, finish/
   commit the English-only migration first.
2. Update **CLAUDE.md**: the site is now **English-only** — retire the bilingual constraint
   (constraint 5). All plans below assume a **single `en.ts` dictionary** (no `fr.ts`).

## Project constraints (current)
- **English-only:** user-facing strings live in `src/lib/i18n/dictionaries/en.ts` only.
- **Room palette:** pixel font `var(--font-pixel)`; bubble/panel `#3d2e1e`/`#5a4430`/`#e8d5b0`;
  app screens `#faf8f5` / `#fffef5` / `#e8e0d8` (see `DeskReadme.tsx` / `DeskSettings.tsx`).
- **Pixel art via `<img>` + `image-rendering: pixelated`**, never `next/image`. New room sprites:
  `scripts/extract-*.mjs` union-bbox → `public/room/` → add to `FILES` in
  `scripts/generate-lighting.mjs` → `npm run lighting`.
- **localStorage only** (`room-save-v1`), no DB (sole exception: the read-only weather route in E-b).
- **Reduced motion forced on**; only opt-out is Plan A's calm mode (shipped).
- No unit-test runner: verify with `type-check && lint && build` + driving `npm run dev`.
- Escape ladder for every desk app: app → desktop → room.

Recommended order: **B → C** (art-free) then **D → E** (need Ahmed's sprites; steps marked ⟨ART⟩).

---

# PLAN B — Discoverability & reward

**Goal:** reward exploration — first-visit hint pulses, an achievements/"things you found"
system with toasts, and a konami→terminal easter egg.

**Files:** create `src/lib/room/discoveries.ts`, `src/components/room/DiscoveriesBadge.tsx`,
`src/components/room/DeskTerminal.tsx`; modify `Room.tsx`, `DeskView.tsx`, `en.ts`.

### Task B1: discoveries store
- [ ] `src/lib/room/discoveries.ts`: localStorage string-set (`room-discoveries-v1`) with
      `getDiscoveries(): Set<string>`, `addDiscovery(id): boolean` (true if newly added), and
      `DISCOVERY_IDS = ['lamp','drawer','clock','music','poster','saitama','bonsai','coffee','ipod','paint','minesweeper','readme','legal','settings','terminal','screensaver'] as const`.

### Task B2: toast host + `discover()`
- [ ] Generalise the existing poster toast in `Room.tsx` into a reusable announcer: a
      `discoveryToast` state + an `aria-live="polite"` container + a `discover(id, label)`
      callback that calls `addDiscovery(id)` and, if newly added, shows the pixel toast 2 s and
      dispatches `window.dispatchEvent(new Event('room:discovery'))`.
- [ ] Call `discover(...)` from the existing handlers in `Room.tsx`
      (lamp/drawer/clock/poster/saitama/bonsai/coffee/ipod). For desk apps, fire
      `discover('paint'|'minesweeper'|'readme'|'legal'|'settings', …)` when a `screenMode` is
      first entered (hook `DeskView`'s `handleShortcutClick`).

### Task B3: discoveries badge
- [ ] `DiscoveriesBadge.tsx`: fixed bottom-right chip (room palette) `✦ {found}/{total}`; click
      opens a small popup listing each id with a found/locked glyph. Reads the store; re-renders
      on `room:discovery`. Render in `Room.tsx` room view.

### Task B4: first-visit hints
- [ ] In `Room.tsx`, when `loadPrefs().visitCount <= 1`, show a decorative, `aria-hidden` pulse
      on the interactable hotspot rects (from `ROOM_OBJECTS`) for ~4 s, staggered, warm
      `rgba(200,184,154,·)` CSS-keyframe outline; cancel on first pointer/key interaction;
      re-trigger on `?` keypress.

### Task B5: konami → terminal
- [ ] In `Room.tsx` buffer the last 10 keys; on `↑↑↓↓←→←→ b a` open a new `'terminal'` screen
      mode and `discover('terminal')`.
- [ ] `DeskTerminal.tsx`: green-on-dark monospace, in-screen scrollback + input line
      `guest@ahmed:~$`. Commands: `help`, `whoami`, `ls`, `cat readme.txt` (prints
      `readmeContent`), `cat secrets.txt` (playful line), `clock`, `sfx on|off`, `clear`,
      `exit` (→ desktop). Unknown → `command not found`. Joins the Escape ladder. Add
      `'terminal'` to `ScreenMode` + a `DeskView` render branch (no desktop icon — it's hidden).

### Task B6: verify
- [ ] Add discovery + terminal labels to `en.ts`. `type-check && lint && build`; `dev`:
      interacting unlocks toasts; badge counts up; first visit (clear localStorage) shows hints;
      konami opens the terminal; commands work. Commit.

---

# PLAN C — Mobile & polish

**Goal:** make the room usable on phones (fill-height + drag-to-pan), enlarge tap targets,
tidy loading.

**Files:** modify `useStageScale.ts`, `RoomStage.tsx`, `Room.tsx`; possibly `RoomObject.tsx`.

### Task C1: fill-height + mobile mode in `useStageScale`
- [ ] Extend the hook to report mobile mode: when `matchMedia('(pointer: coarse)').matches` or
      `innerWidth < 700`, use `fillScale = innerHeight / STAGE_H` (fill height) instead of the
      letterbox `min(...)`; expose `{ scale, mobile, fillScale }`. Desktop path unchanged.

### Task C2: pan offset in `RoomStage`
- [ ] Add optional `panX`/`panY` props applied as a translate on the **outer** wrapper only
      (`translate(${panX}px,${panY}px) scale(${scale})`), preserving the two-transform rule
      (inner still zooms about the monitor point). Clamping is the caller's job.

### Task C3: drag-to-pan in `Room`
- [ ] When `mobile`, render at `fillScale` and enable drag: pointer handlers update a `panRef`
      and write the transform via `rAF` (never per-event React state — same discipline as the
      desk pad-mouse). Clamp so stage edges never leave the viewport. Ignore drags that start on
      a hotspot (`closest('a,button')`) so taps still work.
- [ ] One-time "drag to explore" hint on first mobile visit (reuse Plan B's hint/toast).

### Task C4: bigger tap targets + perf
- [ ] On coarse pointers ensure each hotspot's effective size is ≥44 CSS px after scale (pad the
      `RoomObject` rects when `mobile`).
- [ ] Preload the desk close-up art + first sprite sets on `requestIdleCallback`. Confirm
      `background.png` keeps `fetchPriority="high"`. Reserve the stage box to avoid CLS.

### Task C5: verify
- [ ] `type-check && lint && build`; devtools device emulation (iPhone): room fills height, pans
      smoothly, all hotspots tappable, apps usable, no horizontal body scroll; Lighthouse mobile
      no CLS regression. Commit.

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
      stretch then resettle). Rest pose varies by `visitCount`. `discover('cat')` (add to B's ids).
      ⟨if purr⟩ via `RoomSfxProvider`. `room.catLabel` in `en.ts`.

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
- [ ] Update CLAUDE.md (weather route re-added); privacy policy needs no change (aggregate, fixed
      location, no personal data).

## E-c. Night sky + car-light sweeps  ⟨CSS — plannable now⟩
- [ ] At lighting state `night`, render moon + a few stars behind the window (emissive, never
      lighting-graded) and an occasional headlight sweep across the wall (soft moving gradient
      band ~every 20–40 s). `discover('night')`.
- [ ] Verify each sub-phase with `?light=night`. Commit per sub-phase.

---

*As each plan starts, keep it here until done, then replace it with a one-line entry + hash in
the "Done" log above. Update CLAUDE.md after each phase.*
