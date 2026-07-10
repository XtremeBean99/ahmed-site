# todo-next.md — implementation plans for the remaining phases

Written while a subagent finishes the SFX sounds in `todo.md`. **Do not execute these until
the SFX task (`todo.md` → “NEXT UP — Finish Spec 2”) is committed**, since they build on that
codebase (`RoomSfxProvider`/`useSfx`, the `sfx`/`sfxVolume` prefs, the iPod, and the room-only
layout from Spec 1).

Recommended order: **A → B → C** (all art-free, fully executable) then **D → E** (blocked on
Ahmed’s sprites — designs + non-art steps are planned; sprite steps are marked ⟨ART⟩).

## Global constraints (every plan)
- **Bilingual, type-enforced:** every user-facing string in BOTH `en.ts` and `fr.ts` same
  commit (`Dictionary` derives from `en.ts`; a missing FR key fails `type-check`).
- **Room palette:** pixel font `var(--font-pixel)`; bubble/panel `#3d2e1e`/`#5a4430`/`#e8d5b0`;
  app screens `#faf8f5` desktop / `#fffef5` document / `#e8e0d8` strips (see `DeskReadme.tsx`).
- **Pixel art via `<img>` + `image-rendering: pixelated`**, never `next/image`. New room
  sprites go through an `extract-*.mjs` union-bbox script → `public/room/` → add to the
  `FILES` list in `scripts/generate-lighting.mjs` → `npm run lighting`.
- **localStorage only** (`room-save-v1`), no DB. The one server addition is the weather route (E).
- **Reduced motion is forced on**; the only opt-out is Plan A’s calm-mode toggle.
- No unit-test runner: verify with `npm run type-check && npm run lint && npm run build` + `npm run dev`.
- Escape ladder for every desk app: app → desktop → room.

---

# PLAN A — Settings app (Spec 7)

**Goal:** a `Settings` desktop app that exposes the prefs with no UI today: SFX on/off +
volume, music volume, clock 12/24 h, and an optional **calm mode** (reduced-motion opt-out).

**Files:** create `src/components/room/DeskSettings.tsx`; modify `DeskView.tsx` (screen mode +
props), `Room.tsx` (shortcut + props), `DeskIcon.tsx` (gear icon), `en.ts`/`fr.ts`,
`src/lib/room/storage.ts` (calmMode pref), and `MotionProvider` + `motion.ts` (calm mode).

### Task A1: `calmMode` pref
- [ ] In `storage.ts` add `calmMode: boolean` to `RoomSave`, `DEFAULTS` (`false`), and the
      `loadPrefs` parse (`typeof parsed.calmMode === 'boolean' ? … : DEFAULTS.calmMode`).
- [ ] `npm run type-check`.

### Task A2: Gear icon
- [ ] In `DeskIcon.tsx` add a 16×16 `ICON_SETTINGS` (a cog) next to the others, e.g.:
```tsx
export const ICON_SETTINGS = (
  <>
    <rect x="6" y="1" width="4" height="14" fill="#3a3028" />
    <rect x="1" y="6" width="14" height="4" fill="#3a3028" />
    <rect x="3" y="3" width="10" height="10" fill="#5a4a3a" />
    <rect x="6" y="6" width="4" height="4" fill="#faf8f5" />
  </>
)
```

### Task A3: `DeskSettings.tsx`
- [ ] Create the app (shell like `DeskReadme.tsx`: `ScreenStrip` + `StripButton` desktop
      button + footer close). Each row reads/writes `room-save-v1` via `loadPrefs`/`savePrefs`
      and, where a live provider exists, calls it too. It receives current values + setters as
      props from `Room` (which owns the audio context and pref state):
```tsx
'use client'
import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface SettingsLabels {
  title: string; sfx: string; sfxVolume: string; musicVolume: string
  clock: string; clock12: string; clock24: string; calm: string; calmHint: string
  on: string; off: string; close: string
}
interface DeskSettingsProps {
  labels: SettingsLabels
  desktopLabel: string
  sfxOn: boolean; onSfx: (v: boolean) => void
  sfxVolume: number; onSfxVolume: (v: number) => void
  musicVolume: number; onMusicVolume: (v: number) => void
  is24h: boolean; onClock: (v: boolean) => void
  calm: boolean; onCalm: (v: boolean) => void
  onDesktop: () => void
}

export function DeskSettings(p: DeskSettingsProps) {
  const Toggle = ({ on, onChange, aria }: { on: boolean; onChange: (v: boolean) => void; aria: string }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={aria}
      onClick={() => onChange(!on)} style={{ ...PIXEL, fontSize: '10px', padding: '2px 10px',
      border: '1px solid #c8b8a8', backgroundColor: on ? '#3d2e1e' : '#e8e0d8',
      color: on ? '#e8d5b0' : '#3a3028' }}>
      {on ? p.labels.on : p.labels.off}
    </button>
  )
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 4px', borderBottom: '1px solid #e0d8cc' } as const
  const slider = (v: number, on: (n: number) => void, aria: string) => (
    <input type="range" min={0} max={1} step={0.05} value={v} aria-label={aria}
      onChange={(e) => on(Number(e.target.value))}
      style={{ width: 90, accentColor: '#3d2e1e' }} />
  )
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={p.labels.title}>
        <StripButton onClick={p.onDesktop} ariaLabel={p.desktopLabel}>{p.desktopLabel}</StripButton>
      </ScreenStrip>
      <div className="flex-1 overflow-y-auto px-4 py-2" style={{ ...PIXEL, fontSize: '11px', color: '#2a2520' }}>
        <div style={row}><span>{p.labels.sfx}</span><Toggle on={p.sfxOn} onChange={p.onSfx} aria={p.labels.sfx} /></div>
        <div style={row}><span>{p.labels.sfxVolume}</span>{slider(p.sfxVolume, p.onSfxVolume, p.labels.sfxVolume)}</div>
        <div style={row}><span>{p.labels.musicVolume}</span>{slider(p.musicVolume, p.onMusicVolume, p.labels.musicVolume)}</div>
        <div style={row}><span>{p.labels.clock}</span><Toggle on={p.is24h} onChange={p.onClock} aria={p.labels.clock} /></div>
        <div style={{ ...row, borderBottom: 'none', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <span>{p.labels.calm}</span><Toggle on={p.calm} onChange={p.onCalm} aria={p.labels.calm} />
          </div>
          <span style={{ fontSize: '9px', color: '#8a8078' }}>{p.labels.calmHint}</span>
        </div>
      </div>
    </div>
  )
}
```
- [ ] Note: the SFX toggle must persist to `room-save-v1` AND update the live provider. Add a
      `setEnabled(v)`/`setVolume(v)` to `RoomSfxProvider`’s context (update `enabledRef`/
      `volumeRef` + `savePrefs`) and thread them through so changes take effect without reload.

### Task A4: `calmMode` actually reduces motion
The site forces motion via `MotionProvider reducedMotion="never"` (root layout) and
`prefersReducedMotion() → false` (`motion.ts`). Calm mode overrides both for opted-in users.
- [ ] Make `MotionProvider` a client component that reads `loadPrefs().calmMode` (in an effect,
      default `false` for SSR parity) and renders `<MotionConfig reducedMotion={calm ? 'user' : 'never'}>`.
      Re-read on a custom `room:calm-changed` event dispatched by the toggle.
- [ ] Make `prefersReducedMotion()` return `calmMode && matchMedia('(prefers-reduced-motion: reduce)').matches`
      (reads localStorage; keep it cheap/guarded). Canvas loops (none in room-only, but the
      helper is shared) then honour calm mode.
- [ ] Toggling calm mode dispatches `window.dispatchEvent(new Event('room:calm-changed'))`.

### Task A5: Wire into DeskView + Room
- [ ] `DeskView.tsx`: add `'settings'` to `ScreenMode`; add `settingsLabels` + the value/setter
      props; import `DeskSettings`; add a render branch mirroring the `readme`/`legal` ones.
- [ ] `Room.tsx`: add the `settings` shortcut (`ICON_SETTINGS`, `kind:'app'`, `target:'settings'`)
      to `deskShortcuts`; own `sfx`/`sfxVolume`/`calm` state (load in the mount effect); pass
      values + setters (setters call `savePrefs` + the live providers + calm event) to `DeskView`.

### Task A6: i18n + verify
- [ ] Add `desk.settings`, `desk.settingsTip`, and a `desk.settingsApp` group (title, sfx,
      sfxVolume, musicVolume, clock, calm, calmHint, on, off, close) to `en.ts` and `fr.ts`.
- [ ] `npm run type-check && lint && build`; `npm run dev`: Settings opens, SFX toggle silences
      the click + interaction sounds live, sliders work, clock toggle mirrors the room clock,
      calm mode makes OS reduce-motion take effect. Commit.

---

# PLAN B — Discoverability & reward (Spec 3)

**Goal:** reward exploration — first-visit hint pulses, an achievements/“things you found”
system with toasts, and a konami→terminal easter egg.

**Files:** create `src/lib/room/discoveries.ts`, `src/components/room/DiscoveriesBadge.tsx`,
`src/components/room/DeskTerminal.tsx`; modify `Room.tsx`, `DeskView.tsx`, `AnimatedSprite.tsx`
(hint pulse prop) or add a hint overlay in `Room`, `en.ts`/`fr.ts`, `storage.ts`.

### Task B1: discoveries store
- [ ] `src/lib/room/discoveries.ts`: a localStorage string-set (`room-discoveries-v1`) with
      `getDiscoveries(): Set<string>`, `addDiscovery(id): boolean` (returns true if newly added),
      and `DISCOVERY_IDS = ['lamp','drawer','clock','music','poster','saitama','bonsai','coffee','paint','minesweeper','readme','legal','ipod','terminal','screensaver'] as const`.
- [ ] No pref migration needed (separate key).

### Task B2: toast host + `useDiscovery`
- [ ] Generalise the existing poster toast in `Room.tsx` into a reusable announcer: a small
      `discoveryToast` state + an `aria-live="polite"` container, and a `discover(id, label)`
      callback that calls `addDiscovery(id)` and, if newly added, shows the pixel toast (reuse
      the existing toast markup) for 2 s.
- [ ] Call `discover(...)` from each interaction handler already in `Room.tsx`
      (lamp/drawer/clock/poster/saitama/bonsai/coffee/ipod) and, for desk apps, pass a
      `onOpen` that fires `discover('paint'|'minesweeper'|'readme'|'legal', …)` when a
      `screenMode` is first entered (hook in `DeskView`’s `handleShortcutClick`).

### Task B3: discoveries badge
- [ ] `DiscoveriesBadge.tsx`: a fixed bottom-right chip (room palette) showing `✦ {found}/{total}`;
      click opens a small popup listing each id with a found/locked glyph (labels from dict).
      Reads the store; re-renders on a `room:discovery` event that `discover()` dispatches.
- [ ] Render it in `Room.tsx` room view (and desk view if desired). `aria-label` from dict.

### Task B4: first-visit hints
- [ ] In `Room.tsx`, when `loadPrefs().visitCount <= 1` (first visit), show a decorative hint
      pulse on the interactable hotspots for ~4 s, staggered, then fade; cancel on first
      pointer/key interaction. Implement as an `aria-hidden` overlay of soft outlines at each
      `ROOM_OBJECTS` rect (warm `rgba(200,184,154,·)`, CSS keyframe pulse). Re-trigger when the
      user presses `?`.

### Task B5: konami → terminal
- [ ] In `Room.tsx` add a global key listener buffering the last 10 keys; on
      `↑↑↓↓←→←→ b a` set `view`/`screenMode` to open the terminal and `discover('terminal')`.
- [ ] `DeskTerminal.tsx`: green-on-dark monospace, in-screen scrollback + input line
      `guest@ahmed:~$`. Commands: `help`, `whoami`, `ls`, `cat readme.txt` (prints
      `readmeContent`), `cat secrets.txt` (playful line), `clock`, `sfx on|off`, `clear`,
      `exit` (→ desktop). Unknown → `command not found`. Joins the Escape ladder. Add
      `'terminal'` to `ScreenMode` + a `DeskView` render branch (no desktop icon — it is hidden).
- [ ] i18n: terminal is deliberately English (a shell), but its wrapper labels
      (`desk.terminalApp.title`, prompt aria) go in both dictionaries.

### Task B6: i18n + verify
- [ ] Add discovery labels (`room.discoveries.*` names + badge aria) and terminal wrapper
      labels to `en.ts`/`fr.ts`.
- [ ] `type-check && lint && build`; `dev`: interacting unlocks toasts; badge counts up; first
      visit (clear localStorage) shows hints; konami opens the terminal; commands work. Commit.

---

# PLAN C — Mobile & polish (Spec 4)

**Goal:** make the room usable on phones (fill-height + drag-to-pan), enlarge tap targets,
and tidy loading.

**Files:** modify `useStageScale.ts`, `RoomStage.tsx`, `Room.tsx`; possibly `RoomObject.tsx`.

### Task C1: fill-height + pan model in `useStageScale`
- [ ] Extend the hook to also report a **mobile mode**: when `matchMedia('(pointer: coarse)').matches`
      or `innerWidth < 700`, use `fillScale = innerHeight / STAGE_H` (fill height) instead of the
      letterbox `min(...)`, and expose `{ scale, mobile, fillScale }`. Desktop unchanged.

### Task C2: pan offset in `RoomStage`
- [ ] Add optional `panX`/`panY` props. Apply them as a translate on the **outer** wrapper only
      (`transform: translate(${panX}px, ${panY}px) scale(${scale})`), preserving the
      two-transform rule (inner still zooms about the monitor point). Clamp is done by the caller.

### Task C3: drag-to-pan in `Room`
- [ ] When `mobile`, render at `fillScale` and enable horizontal (and vertical if overflow)
      drag: pointer handlers update a `panRef` and write the transform via `rAF` (never
      per-event React state — same discipline as the desk pad-mouse). Clamp pan so the stage
      edges never leave the viewport. Disable the zoom-to-desk pan conflict by ignoring drags
      that start on a hotspot (`closest('a,button')`).
- [ ] A one-time “drag to explore” hint on first mobile visit (reuse Plan B’s hint system if
      built; else a 3 s pixel toast).

### Task C4: bigger tap targets + perf
- [ ] On coarse pointers, ensure each hotspot’s effective size is ≥44 CSS px after scale (pad
      the `RoomObject` rects via a `minHitPad` style when `mobile`).
- [ ] Preload the desk close-up art + first sprite sets on `requestIdleCallback` so entering the
      desk is instant. Confirm `background.png` keeps `fetchPriority="high"`. Reserve the stage
      box to avoid CLS.

### Task C5: verify
- [ ] `type-check && lint && build`; test in devtools device emulation (e.g. iPhone): room fills
      height, pans smoothly, all hotspots tappable, apps usable, no horizontal body scroll.
      Lighthouse mobile: no CLS regression. Commit.

---

# SPEC D — Diegetic record player (Spec 5)  ⟨ART-BLOCKED⟩

**Goal:** a turntable you operate as the music control (the iPod already skips; the turntable
adds play/pause + a spinning record for tactility). Ahmed may add this later.

⟨ART⟩ **Needed from Ahmed** (full-canvas 1408×768 source like the other sprites, so the extract
script can bbox them): turntable base (rest), platter+record, tonearm parked, tonearm on-record,
and a 2–4 frame spin loop. Optional audio: `vinyl-crackle.mp3` (loopable).

### Planned steps (executable once art lands)
- [ ] `scripts/extract-turntable.mjs` (mirror `extract-side-table.mjs`, union bbox across the
      spin frames) → `public/room/turntable-*.png`; add them to `generate-lighting.mjs` `FILES`;
      `npm run lighting`.
- [ ] `ROOM_OBJECTS` entry `turntable` at the extracted rect; `RoomTurntable.tsx` (inside
      `RoomAudioProvider`): needle-down/click platter → `toggle()`; click arm-return → `skip()`;
      spin loop plays while `playing`, holds parked when paused (drive frames like `AnimatedSprite`).
- [ ] ⟨if crackle⟩ add `crackle` to `RoomSfxProvider` as a **looping ambient channel** (a
      dedicated `<audio loop>` started/stopped with `playing`, `sfx`-gated) — small extension to
      the provider.
- [ ] Keep the desk speakers as passive art (they still emit music notes). `room.turntableLabel`
      EN+FR. Verify play/pause/skip sync with `NowPlaying`; reduced-motion still plays audio +
      spin. Commit.
- [ ] ⟨DECIDE⟩ placement (desk vs shelf) and whether the speaker mute-toggle is removed — default:
      keep speakers as art, mute lives on turntable + NowPlaying.

---

# SPEC E — Life & atmosphere (Spec 6)  ⟨PARTLY ART-BLOCKED⟩

Three independently shippable sub-phases.

## E-a. Cat on the bed  ⟨ART-BLOCKED⟩
⟨ART⟩ Needed: sleep loop (2–3 frames), wake/stretch sequence (4–6 frames), optional sit pose;
optional `purr.mp3`.
- [ ] `scripts/extract-cat.mjs` → `public/room/cat-*.png`; add to lighting `FILES`; `npm run lighting`.
- [ ] `ROOM_OBJECTS` `cat` entry; render via `AnimatedSprite` (loop sleep; click → play-once
      stretch then resettle). Rest pose varies by `visitCount`. `discover('cat')` (add to Plan B
      ids). ⟨if purr⟩ via `RoomSfxProvider`. `room.catLabel` EN+FR.

## E-b. Real-weather window  ⟨API — fully plannable now⟩
**LOCKED:** fixed **Canberra** (no geolocation, no consent, no privacy-policy change).
- [ ] `src/app/api/weather/route.ts` (re-adds one read-only API route after the Spec-1 purge):
      fetch Open-Meteo for Canberra (lat -35.28, lon 149.13, `current=weather_code,precipitation`),
      `export const revalidate = 3600`, fail-soft to `{ code: 0 }`. No key, no secrets.
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
- [ ] `RoomWeather.tsx`: fetch `/api/weather` on mount; map weather code → none/rain/snow; render
      a cheap CSS particle overlay clipped to the window rect (⟨ART optional⟩ swap for rain/snow
      sprite frames later). Ties into the existing time-of-day lighting tint.
- [ ] Update `CLAUDE.md` (re-added weather route) — privacy policy needs no change (aggregate,
      no personal data, fixed location).

## E-c. Night sky + car-light sweeps  ⟨CSS — plannable now, light art optional⟩
- [ ] When lighting state is `night`, render moon + a few stars behind the window (CSS/emissive,
      never lighting-graded) and an occasional headlight sweep across the wall (a soft moving
      gradient band every ~20–40 s). `discover('night')`.
- [ ] Verify each sub-phase: `type-check && lint && build` + `dev` with `?light=night`. Commit
      per sub-phase.

---

## When these move to `todo.md`
As each plan becomes active, move it into `todo.md` (project convention) and delete its copy
here, so `todo.md` always shows the current work first. Update `CLAUDE.md` after each phase.
