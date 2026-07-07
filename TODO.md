# TODO — Monitor Hover + Loading Screen, Lamp Toggles Everywhere, Room Speakers, Hover Lifts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Docs policy (CLAUDE.md constraint 8):** this file is the repo's only task document. When every task below is complete, **delete this TODO.md in the final commit** (Task 7 includes that step). Do not create any other `.md` files.

**Goal:** (1) Hovering the PC in the room view plays a yellow-outline highlight animation and a Win98 boot sequence on the monitor glass simultaneously, both holding their last frame until the pointer leaves. (2) The subtle hover lift the monitor has is added to the poster, bonsai, and coffee cup. (3) The desk close-up respects the lamp state via lamp-off art **and the lamp there is clickable** to toggle it. (4) New desktop speakers appear in the room view with lamp-on/off art, are **click-to-mute/unmute**, and emit constant music notes while music plays. (5) The owner's edited poster frames are re-extracted.

**Architecture:** Source art in `assets/pixel-art/sources/` is cropped into web sprites in `public/room/` by a new sharp extraction script (union-bbox pattern of `scripts/extract-all-sprites.mjs`). `Monitor.tsx` gains a single interval "tick" clock driving two clamped frame sequences. `DeskView.tsx` gains lamp props + a lamp hotspot. A new `RoomSpeakers.tsx` client component (art + mute buttons + `MusicNotes`) consumes `useRoomAudio()` inside the provider — `Room` itself renders `RoomAudioProvider`, so it cannot call the hook directly.

**Tech Stack:** Next.js App Router, React client components, Framer Motion, sharp (available in `node_modules` transitively via Next — `import sharp from 'sharp'` works in `scripts/*.mjs` with no install; do NOT add it to package.json).

## Global Constraints (from CLAUDE.md — binding)

- Pixel art is served as raw `<img>` with `image-rendering: pixelated` — **never `next/image`**.
- Multi-frame / multi-variant sprites are cropped to a **shared union bbox +2px pad** across all frames so playback and crossfades never jitter.
- `public/room/` and `assets/pixel-art/` filenames are kebab-case lowercase (Vercel is case-sensitive; Windows is not). `assets/pixel-art/` is the owner's sprite-editing working folder — keep it organised.
- `prefers-reduced-motion` disables all decorative animation (lifts, frames, notes, crossfades become instant swaps) but **never functionality** — navigation, lamp toggling, and muting must all still work.
- Decorative layers are `aria-hidden` + `pointer-events: none`; every interactive hotspot is a real `<a>`/`<button>` with an `aria-label` and the standard warm focus-visible ring.
- Every user-facing string goes in BOTH dictionaries — **this plan adds no new strings**: the desk lamp button reuses `room.lampLabel`, the room speaker buttons reuse `room.audio.speakersLabel`. Do not add any quoted UI strings.
- Room prefs live in localStorage key `room-save-v1` (`{ audio, lampOn, visitCount }`) via `src/lib/room/storage.ts` — no storage changes needed; lamp toggles anywhere persist via the existing `savePrefs({ lampOn })`.
- No unit-test runner exists (scripts: `dev`, `build`, `start`, `lint`, `type-check`). Gates are `npm run type-check`, `npm run lint`, `npm run build`, plus each task's manual dev-server checks.
- Only three `.md` files may exist: `CLAUDE.md`, `README.md`, this `TODO.md` (deleted at completion).
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## Measured Facts (already verified — do not re-derive, just use)

All measurements were made with a sharp alpha-bbox scan and verified visually by compositing. Stage coordinate space is 1408×768. The assets tree was reorganised on this branch (owner-approved): full-canvas scene exports live in `assets/pixel-art/sources/`, multi-frame objects in subfolders (`sources/bonsai/`, `sources/poster/`, `sources/coffee/`), music-note art in `assets/pixel-art/music-sfx/`.

| Asset (`assets/pixel-art/sources/`) | Canvas | Content bbox (l,t → r,b) | Notes |
|---|---|---|---|
| `monitor-keyboard-mouse.png` (base) | 1408×768 | (242,263) → (630,601) | Identical crop to the current `public/room/monitor-desk.png` after +2 pad |
| `monitor-keyboard-mouse-highlight-1.png` | 1408×768 | (242,263) → (630,601) | Faint outline |
| `monitor-keyboard-mouse-highlight-2.png` | 1408×768 | (240,262) → (632,602) | Outline grows |
| `monitor-keyboard-mouse-highlight-3.png` | 1408×768 | (237,259) → (634,604) | Full yellow outline |
| `monitor-loading-screen-1..18.png` | **1380×752** | (266,275) → (479,445) — identical in all 18 | Win98 boot sequence in the glass's perspective |
| `desk-closeup-lamp-off.png` | 1408×768 | full canvas | Desk close-up, lamp dark, wall glow removed |
| `room-speakers.png` | 1408×768 | (148,294) → (578,507) | Desktop speakers flanking the monitor, lamp-lit |
| `room-speakers-lamp-off.png` | 1408×768 | (148,294) → (578,507) — identical | Same speakers, dusk lighting |
| `poster/kitagawa-1..5.png` | 1408×768 | union re-measured by script | Frames 2–4 carry fresh owner edits (uncommitted art brought onto this branch) |

- **Union bbox of the 4 hover frames +2px pad = (235, 257), 402×350** — the new monitor hotspot rect (current: (240,261) 393×343; the highlight outline extends past it).
- **The loading frames' 1380×752 canvas is TOP-LEFT ALIGNED with the 1408×768 stage** (verified pixel-perfect by compositing at offset (0,0)). Crop all 18 at exactly **(266, 275), 214×171** — constant bbox, no pad (pad would sample outside the glass).
- **The zoom origin must stay at stage point (360, 331).** With the new monitor rect (235,257) the offsets in `Room.tsx` become **+125 / +74** (currently `+22+98` / `+12+58` against the old rect). Getting this wrong re-introduces the v3 "site is off-centre" bug.
- Loading overlay position inside the new monitor rect: left = 266−235 = **31**, top = 275−257 = **18**.
- **Room speakers: union bbox +2px pad = (146, 292), 435×218** (identical in both lamp variants). Cabinet hotspots (stage): **left (148, 355) 108×154**, **right (490, 290) 91×141**. Driver holes (stage, measured from 4× crops): left tweeter (215,408) r15, left woofer (215,463) r25; right tweeter (546,345) r14, right woofer (546,397) r24.
- **Overlap layering (important):** the monitor hotspot rect (235,257 402×350) fully covers the right speaker cabinet and grazes the left one, and the coffee mug hotspot (160,475 83×83) overlaps the left cabinet's bottom. Render order in `Room.tsx` must be: backgrounds → **Monitor** → **RoomSpeakers** → …poster/bonsai… → coffee. RoomSpeakers after Monitor makes the cabinet buttons win clicks over the monitor's big anchor rect (clicking a speaker must mute, not zoom); coffee later still wins its own overlap (the mug is in front of the left cabinet, which is correct).
- **Desk close-up lamp hotspot (stage): (8, 88) 160×480** — covers shade, stem, and base at the left edge of `desk-closeup.png`. Verify visually in dev and nudge if needed.

---

### Task 1: Extract the new sprites

**Files:**
- Create: `scripts/extract-monitor-hover.mjs`
- Generated output: `public/room/monitor-1..4.png`, `public/room/monitor-loading-1..18.png`, `public/room/desk-closeup-lamp-off.png`, `public/room/room-speakers.png`, `public/room/room-speakers-lamp-off.png`

**Interfaces:**
- Consumes: source PNGs in `assets/pixel-art/sources/` (committed on this branch — verify with `git ls-files assets/pixel-art/sources`)
- Produces: the 25 web sprites listed above, referenced by later tasks as `/room/<name>.png`

- [ ] **Step 1: Write the extraction script**

Create `scripts/extract-monitor-hover.mjs` with exactly this content:

```js
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const srcDir = join(__dirname, '..', 'assets', 'pixel-art', 'sources')

// Union bbox of the base + 3 highlight frames, +2px pad (pre-measured across
// all four 1408×768 canvases so hover playback never jitters).
const MON = { left: 235, top: 257, width: 402, height: 350 }

// Constant bbox of all 18 loading frames (identical in every frame — the
// screen-glass quad). The 1380×752 loading canvas is top-left aligned with
// the 1408×768 stage, so these are stage coordinates.
const LOAD = { left: 266, top: 275, width: 214, height: 171 }

// Room-view desktop speakers: lamp-on/lamp-off pair, union bbox +2px pad
// (identical content bbox in both variants, so the crossfade cannot jitter).
const SPK = { left: 146, top: 292, width: 435, height: 218 }

const hoverSources = [
  'monitor-keyboard-mouse.png',
  'monitor-keyboard-mouse-highlight-1.png',
  'monitor-keyboard-mouse-highlight-2.png',
  'monitor-keyboard-mouse-highlight-3.png',
]

for (let i = 0; i < hoverSources.length; i++) {
  await sharp(join(srcDir, hoverSources[i]))
    .extract(MON)
    .png()
    .toFile(join(outDir, `monitor-${i + 1}.png`))
  console.log(`monitor-${i + 1}.png ${MON.width}x${MON.height} at stage (${MON.left},${MON.top})`)
}

for (let i = 1; i <= 18; i++) {
  await sharp(join(srcDir, `monitor-loading-screen-${i}.png`))
    .extract(LOAD)
    .png()
    .toFile(join(outDir, `monitor-loading-${i}.png`))
}
console.log(`monitor-loading-1..18 ${LOAD.width}x${LOAD.height} at stage (${LOAD.left},${LOAD.top})`)

for (const name of ['room-speakers.png', 'room-speakers-lamp-off.png']) {
  await sharp(join(srcDir, name))
    .extract(SPK)
    .png()
    .toFile(join(outDir, name))
  console.log(`${name} ${SPK.width}x${SPK.height} at stage (${SPK.left},${SPK.top})`)
}

// Lamp-off desk close-up is used at full canvas size; pass through sharp to
// normalise the PNG encoding.
await sharp(join(srcDir, 'desk-closeup-lamp-off.png'))
  .png()
  .toFile(join(outDir, 'desk-closeup-lamp-off.png'))
console.log('desk-closeup-lamp-off.png (full canvas)')
```

- [ ] **Step 2: Run it**

Run: `node scripts/extract-monitor-hover.mjs`
Expected: four `monitor-N.png 402x350 at stage (235,257)` lines, `monitor-loading-1..18 214x171 at stage (266,275)`, two `room-speakers… 435x218 at stage (146,292)` lines, `desk-closeup-lamp-off.png (full canvas)`. No errors.

- [ ] **Step 3: Verify the output files**

Run: `node -e "const s=require('sharp');Promise.all(['monitor-1','monitor-4','monitor-loading-1','monitor-loading-18','room-speakers','room-speakers-lamp-off','desk-closeup-lamp-off'].map(n=>s('public/room/'+n+'.png').metadata().then(m=>console.log(n,m.width+'x'+m.height))))"`
Expected: `monitor-1 402x350`, `monitor-4 402x350`, `monitor-loading-1 214x171`, `monitor-loading-18 214x171`, `room-speakers 435x218`, `room-speakers-lamp-off 435x218`, `desk-closeup-lamp-off 1408x768`.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-monitor-hover.mjs public/room
git commit -m "feat: extract monitor hover, loading-screen, room-speaker, and lamp-off desk sprites

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Monitor hover highlight + simultaneous loading screen

**Files:**
- Modify: `src/components/room/Monitor.tsx` (full rewrite below)
- Modify: `src/lib/room/objects.ts` (monitor entry + new exports)
- Modify: `src/components/room/Room.tsx` (zoom-origin offsets ~lines 181–187, Monitor props ~lines 260–269)
- Delete: `public/room/monitor-desk.png`

**Interfaces:**
- Consumes: sprites from Task 1; existing `RoomObject` component (props: `label, showTooltip, onActivate, onDeactivate, onClick, href, tabIndex, style, children`); `DURATION` from `@/lib/motion`.
- Produces: `Monitor` with new required props `loadingFrames: string[]`, `loadingRect: { x: number; y: number; w: number; h: number }`; `objects.ts` exports `MONITOR_LOADING_FRAMES: string[]`, `MONITOR_LOADING_RECT: { x: number; y: number; w: number; h: number }`.

Behavioural spec (owner's words): on hover, the highlight animation and the loading-screen animation **play at the same time**; each **remains at its last frame until the mouse moves off**; moving off resets both. The existing −2px hover lift is **kept** (the owner likes it — it's also being added to the other objects in Task 3): a `motion.div` wraps both the sprite and the loading overlay so they lift together. Focus/blur behaves like hover/leave. Reduced motion: static base frame, no overlay, no lift, navigation unchanged.

- [ ] **Step 1: Update the object registry**

In `src/lib/room/objects.ts`, replace the monitor entry (currently `x: 240, y: 261, w: 393, h: 343`, `frames: ['/room/monitor-desk.png']`) with:

```ts
  {
    id: 'monitor',
    // Monitor+keyboard+mousepad. Union bbox +2px pad across the rest frame and
    // the 3 hover-highlight frames (the yellow outline extends past the art).
    x: 235,
    y: 257,
    w: 402,
    h: 350,
    labelKey: 'room.monitorLabel',
    // Frame 1 = rest, frames 2–4 = hover highlight steps (play-once-hold).
    frames: [
      '/room/monitor-1.png',
      '/room/monitor-2.png',
      '/room/monitor-3.png',
      '/room/monitor-4.png',
    ],
    href: '/home',
  },
```

Then append after the `ROOM_OBJECTS` array:

```ts
/**
 * Windows-98-style boot sequence drawn on the monitor glass while the PC is
 * hovered. Decorative overlay (aria-hidden). Rect is in stage coordinates —
 * the loading source canvases are top-left aligned with the stage, and the
 * content bbox is identical in all 18 frames.
 */
export const MONITOR_LOADING_RECT = { x: 266, y: 275, w: 214, h: 171 }

export const MONITOR_LOADING_FRAMES = Array.from(
  { length: 18 },
  (_, i) => `/room/monitor-loading-${i + 1}.png`,
)
```

- [ ] **Step 2: Rewrite Monitor.tsx**

Replace the entire contents of `src/components/room/Monitor.tsx` with:

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'

/** One clock drives both the highlight steps and the loading sequence. */
const FRAME_MS = 80

interface MonitorProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  /** Hover frames: index 0 = rest art, 1..n = highlight steps (holds on last) */
  frames: string[]
  /** Loading-screen frames shown over the glass while hovered (holds on last) */
  loadingFrames: string[]
  /** Stage-space rect of the monitor glass the loading frames cover */
  loadingRect: { x: number; y: number; w: number; h: number }
  href: string
  onEnter?: () => void
}

export function Monitor({
  label,
  x,
  y,
  w,
  h,
  frames,
  loadingFrames,
  loadingRect,
  href,
  onEnter,
}: MonitorProps) {
  const [hovered, setHovered] = useState(false)
  const [tick, setTick] = useState(0)
  const router = useRouter()
  const reduce = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef(0)

  useEffect(() => {
    router.prefetch(href)
  }, [router, href])

  // Warm the browser cache for the highlight + loading frames so the first
  // hover doesn't skip frames while 21 images stream in.
  useEffect(() => {
    for (const src of [...frames.slice(1), ...loadingFrames]) {
      const img = new window.Image()
      img.src = src
    }
  }, [frames, loadingFrames])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startHover = useCallback(() => {
    setHovered(true)
    if (reduce) return
    clearTimer()
    tickRef.current = 0
    setTick(0)
    // Highlight needs frames.length - 1 ticks; the loading overlay appears on
    // tick 1 and needs loadingFrames.length ticks. Each clamps to its own
    // last frame; the timer stops once the longer sequence finishes.
    const maxTick = Math.max(frames.length - 1, loadingFrames.length)
    timerRef.current = setInterval(() => {
      tickRef.current = Math.min(tickRef.current + 1, maxTick)
      setTick(tickRef.current)
      if (tickRef.current >= maxTick) clearTimer()
    }, FRAME_MS)
  }, [reduce, frames.length, loadingFrames.length, clearTimer])

  const stopHover = useCallback(() => {
    setHovered(false)
    clearTimer()
    tickRef.current = 0
    setTick(0)
  }, [clearTimer])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Middle-click, ctrl+click, etc. — let the browser handle natively
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return

      if (reduce) {
        // Reduced motion: navigate immediately (the <a> handles it natively)
        return
      }

      e.preventDefault()
      onEnter?.()
    },
    [reduce, onEnter],
  )

  const frameSrc = frames[Math.min(tick, frames.length - 1)]
  const loadingSrc =
    tick >= 1 ? loadingFrames[Math.min(tick, loadingFrames.length) - 1] : null

  return (
    <RoomObject
      label={label}
      showTooltip={hovered}
      onActivate={startHover}
      onDeactivate={stopHover}
      onClick={handleClick}
      href={href}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
    >
      {/* Lift wrapper: the sprite and the glass overlay rise together. The
          transform makes this div the containing block for the overlay, so
          the overlay's offsets stay relative to the monitor rect. */}
      <motion.div
        className="w-full h-full"
        animate={hovered && !reduce ? { y: -2 } : { y: 0 }}
        transition={{ duration: DURATION.fast }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frameSrc}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {loadingSrc && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={loadingSrc}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              left: loadingRect.x - x,
              top: loadingRect.y - y,
              width: loadingRect.w,
              height: loadingRect.h,
              imageRendering: 'pixelated',
            }}
          />
        )}
      </motion.div>
    </RoomObject>
  )
}
```

- [ ] **Step 3: Wire Room.tsx**

(a) Update the import:

```ts
import { ROOM_OBJECTS, MONITOR_LOADING_FRAMES, MONITOR_LOADING_RECT } from '@/lib/room/objects'
```

(b) Replace the zoom-origin/glow block (currently `monitorObj.x + 22 + 98` etc.):

```ts
  // Stage point the zoom converges on: the centre of the monitor glass,
  // (360, 331) in stage coords. Offsets are relative to the monitor rect
  // (235, 257) — re-derive if the sprite crop ever changes.
  const screenCenterX = monitorObj.x + 125
  const screenCenterY = monitorObj.y + 74

  const STAGE_W = 1408
  const STAGE_H = 768
  const glowX = (screenCenterX / STAGE_W) * 100
  const glowY = (screenCenterY / STAGE_H) * 100
```

(c) Add the two new props to `<Monitor …/>`:

```tsx
          <Monitor
            label={t.room.monitorLabel}
            x={monitorObj.x}
            y={monitorObj.y}
            w={monitorObj.w}
            h={monitorObj.h}
            frames={monitorObj.frames}
            loadingFrames={MONITOR_LOADING_FRAMES}
            loadingRect={MONITOR_LOADING_RECT}
            href={monitorObj.href!}
            onEnter={handleEnter}
          />
```

- [ ] **Step 4: Delete the superseded sprite**

Run: `git rm public/room/monitor-desk.png`
Then: `grep -rn "monitor-desk" src/` must return nothing.

- [ ] **Step 5: Static verification**

Run: `npm run type-check && npm run lint` — both pass.

- [ ] **Step 6: Manual verification in the dev server**

`npm run dev`, open `http://localhost:3000/`:
- Hover the PC: it lifts 2px, the yellow outline steps in over ~¼s, the Win98 boot screen plays on the glass for ~1.4s and moves with the lift; **both freeze on their final frames** while the pointer stays.
- Move off: rest art, dark glass, no lift. Re-hover: replays from the start.
- Boot screen sits exactly on the glass — no dark fringe on the bezel (offsets 31/18 if not).
- Tab focus triggers the same animation; blur resets.
- Click: zoom still converges on the glass centre (v3 off-centre regression check).
- Emulate `prefers-reduced-motion: reduce`: static frame, no overlay/lift; click still navigates to `/home`.

- [ ] **Step 7: Commit**

```bash
git add src/components/room/Monitor.tsx src/lib/room/objects.ts src/components/room/Room.tsx
git commit -m "feat: monitor hover highlight with simultaneous boot-screen animation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Hover lift for poster, bonsai, and coffee cup

**Files:**
- Modify: `src/components/room/AnimatedSprite.tsx` (imports + the `<img>` element)

**Interfaces:**
- Consumes: `DURATION` from `@/lib/motion`; the component's existing `hovered` state and `reduce` flag.
- Produces: no API change — poster, bonsai, and coffee all render through `AnimatedSprite`, so they get the lift automatically.

- [ ] **Step 1: Swap the img for a motion.img with the lift**

In `src/components/room/AnimatedSprite.tsx`, change the framer-motion import to:

```ts
import { motion, useReducedMotion } from 'framer-motion'
```

add:

```ts
import { DURATION } from '@/lib/motion'
```

and replace the `<img …/>` inside `RoomObject` with (keep the eslint-disable comment above it):

```tsx
        <motion.img
          src={frames[frameIndex]}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
          animate={hovered && !reduce ? { y: -2 } : { y: 0 }}
          transition={{ duration: DURATION.fast }}
        />
```

- [ ] **Step 2: Static verification**

Run: `npm run type-check && npm run lint` — both pass.

- [ ] **Step 3: Manual verification**

In dev: hovering the poster, the bonsai, and the coffee mug lifts each 2px (matching the monitor) alongside their existing frame animations; mouse-off settles back. Reduced motion: no lift, no frames, clicks still work (poster toast).

- [ ] **Step 4: Commit**

```bash
git add src/components/room/AnimatedSprite.tsx
git commit -m "feat: hover lift on poster, bonsai, and coffee cup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Desk close-up — lamp-off art + clickable lamp

**Files:**
- Modify: `src/components/room/DeskView.tsx` (props, background imgs ~line 215, new lamp button)
- Modify: `src/components/room/Room.tsx` (shared `toggleLamp` callback; desk-view branch props)

**Interfaces:**
- Consumes: `public/room/desk-closeup-lamp-off.png` from Task 1; `Room`'s `lampOn` + `lampFlicker` state; existing dictionary key `room.lampLabel` (already in the `dict` type of `Room.tsx` — no dictionary changes).
- Produces: `DeskView` gains required props `lampOn: boolean`, `lampFlicker: boolean`, `lampLabel: string`, `onToggleLamp: () => void`. `Room` gains a `toggleLamp` callback used by BOTH the room lamp hotspot and the desk lamp button (one code path, one persistence point).

- [ ] **Step 1: Extract the shared lamp toggle in Room.tsx**

Add near the other callbacks:

```ts
  // One lamp toggle for both views: persists the pref and fires the flicker.
  const toggleLamp = useCallback(() => {
    setLampOn((v) => {
      const n = !v
      savePrefs({ lampOn: n })
      setLampFlicker(true)
      setTimeout(() => setLampFlicker(false), 500)
      return n
    })
  }, [])
```

and change the room lamp hotspot button to `onClick={toggleLamp}` (replacing its inline arrow function, which this callback is copied from).

- [ ] **Step 2: Pass the new props from the desk branch**

```tsx
        <DeskView
          shortcuts={deskShortcuts}
          backLabel={t.desk.back}
          screenLabel={t.desk.screenLabel}
          desktopLabel={t.desk.desktop}
          expandLabel={t.desk.expand}
          browserTitle={t.desk.browserTitle}
          speakersLabel={t.room.audio.speakersLabel}
          lampOn={lampOn}
          lampFlicker={lampFlicker}
          lampLabel={t.room.lampLabel}
          onToggleLamp={toggleLamp}
          onBack={handleDeskBack}
        />
```

- [ ] **Step 3: DeskView — props, art crossfade, lamp button**

(a) Add to `DeskViewProps` and the destructuring line:

```ts
  /** Persisted lamp state — picks the close-up art variant */
  lampOn: boolean
  /** True for 500ms after a toggle; drives the flicker animation */
  lampFlicker: boolean
  /** Accessible label for the lamp button (room.lampLabel) */
  lampLabel: string
  onToggleLamp: () => void
```

(b) Replace the single background img (`<img src="/room/desk-closeup.png" …/>`) with:

```tsx
        {/* Lamp-off close-up (always present, behind the lit version) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup-lamp-off.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
        {/* Lamp-on close-up (fades out when the lamp is off, flickers on toggle) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false}
          className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
          style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0, transition: reduce ? 'none' : 'opacity 0.4s ease' }} />
```

(c) Add the lamp button next to the speaker buttons (the `e.stopPropagation()` matters — the outer container's click handler exits to the room):

```tsx
        {/* Desk lamp toggle (left edge of the close-up) */}
        <button onClick={(e) => { e.stopPropagation(); onToggleLamp() }} aria-label={lampLabel}
          className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2"
          style={{ left: 8, top: 88, width: 160, height: 480 }} />
```

- [ ] **Step 4: Static verification**

Run: `npm run type-check && npm run lint` — both pass (type-check proves the call site passes the new required props).

- [ ] **Step 5: Manual verification**

In dev:
- Enter the desk, click the lamp (left edge): the close-up flickers and goes dark; click again: flickers bright. The click must NOT bounce you back to the room (stopPropagation check).
- Go back to the room (Escape): the room background matches the state you left the lamp in (shared state + prefs).
- Toggle the lamp in the room, enter the desk: desk art matches. Reload with lamp off + `/#desk` deep link: dark art.
- Screen content, speakers, and mouse sit identically on both artworks (they're pixel-aligned).
- Tab reaches the lamp button; Enter toggles. Reduced motion: instant swap, no flicker.

- [ ] **Step 6: Commit**

```bash
git add src/components/room/DeskView.tsx src/components/room/Room.tsx
git commit -m "feat: desk close-up lamp-off art with clickable lamp toggle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Room-view desktop speakers — mute/unmute + music notes

**Files:**
- Create: `src/components/room/RoomSpeakers.tsx`
- Modify: `src/components/room/Room.tsx` (render `<RoomSpeakers …/>` immediately **after** `<Monitor …/>`)

**Interfaces:**
- Consumes: `public/room/room-speakers[-lamp-off].png` from Task 1; `useRoomAudio()` (`{ playing, toggle }`) — legal here because `RoomSpeakers` renders inside the `RoomAudioProvider` that `Room` mounts; `MusicNotes` (props: `holes: {cx,cy,r}[]` in stage coords, `startDelay?: number`); `Room`'s `lampOn`/`lampFlicker`; dictionary key `room.audio.speakersLabel` (already in the dict type).
- Produces: nothing consumed by other tasks.

Why a separate component: `Room` itself renders `<RoomAudioProvider>`, so it cannot call `useRoomAudio()` — the hook must live in a child (this mirrors how `DeskView` consumes the context).

Why rendered AFTER `<Monitor>`: the monitor's anchor rect (235,257 402×350) covers the right cabinet entirely; the later DOM element wins pointer hits. Speakers after Monitor ⇒ clicking a cabinet mutes instead of zooming. The coffee mug (rendered later still) keeps winning its own overlap with the left cabinet — correct, the mug is in front.

- [ ] **Step 1: Create RoomSpeakers.tsx**

```tsx
'use client'

import { useReducedMotion } from 'framer-motion'
import { useRoomAudio } from './RoomAudioProvider'
import { MusicNotes } from './MusicNotes'

// Stage-space geometry measured from sources/room-speakers.png.
const ART = { x: 146, y: 292, w: 435, h: 218 }
const CABINET_LEFT = { x: 148, y: 355, w: 108, h: 154 }
const CABINET_RIGHT = { x: 490, y: 290, w: 91, h: 141 }
// Driver holes (tweeter + woofer) per cabinet; notes spawn on their rims.
const HOLES_LEFT = [
  { cx: 215, cy: 408, r: 15 },
  { cx: 215, cy: 463, r: 25 },
]
const HOLES_RIGHT = [
  { cx: 546, cy: 345, r: 14 },
  { cx: 546, cy: 397, r: 24 },
]

interface RoomSpeakersProps {
  lampOn: boolean
  lampFlicker: boolean
  /** Accessible label for the mute buttons (room.audio.speakersLabel) */
  speakersLabel: string
}

/**
 * Desktop speakers flanking the monitor in the room view. The art layer
 * crossfades with the lamp exactly like the background; each cabinet is a
 * mute/unmute button; music notes emit from the driver holes while playing.
 */
export function RoomSpeakers({ lampOn, lampFlicker, speakersLabel }: RoomSpeakersProps) {
  const reduce = useReducedMotion()
  const { playing, toggle } = useRoomAudio()

  const cabinetClass =
    'absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2 transition-transform duration-[120ms] active:scale-[0.98]'

  const mutedGlyph = !playing && (
    <span
      className="absolute top-1 right-1 text-[#a09080] opacity-70 pointer-events-none"
      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px' }}
    >
      ✕♪
    </span>
  )

  return (
    <>
      {/* Art: lamp-off under, lamp-on crossfades/flickers like the background */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{ left: ART.x, top: ART.y, width: ART.w, height: ART.h }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/room/room-speakers-lamp-off.png"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/room/room-speakers.png"
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
          style={{
            imageRendering: 'pixelated',
            opacity: lampOn ? 1 : 0,
            transition: reduce ? 'none' : 'opacity 0.4s ease',
          }}
        />
      </div>

      {/* Mute/unmute — one button per cabinet */}
      <button
        onClick={toggle}
        aria-label={speakersLabel}
        className={cabinetClass}
        style={{ left: CABINET_LEFT.x, top: CABINET_LEFT.y, width: CABINET_LEFT.w, height: CABINET_LEFT.h }}
      >
        {mutedGlyph}
      </button>
      <button
        onClick={toggle}
        aria-label={speakersLabel}
        className={cabinetClass}
        style={{ left: CABINET_RIGHT.x, top: CABINET_RIGHT.y, width: CABINET_RIGHT.w, height: CABINET_RIGHT.h }}
      >
        {mutedGlyph}
      </button>

      {/* Constant-rate notes from the driver holes while music plays */}
      <MusicNotes holes={HOLES_LEFT} startDelay={0} />
      <MusicNotes holes={HOLES_RIGHT} startDelay={550} />
    </>
  )
}
```

- [ ] **Step 2: Render it in Room.tsx**

Add the import:

```ts
import { RoomSpeakers } from './RoomSpeakers'
```

and insert immediately after the `<Monitor …/>` element (inside `RoomStage`):

```tsx
          <RoomSpeakers
            lampOn={lampOn}
            lampFlicker={lampFlicker}
            speakersLabel={t.room.audio.speakersLabel}
          />
```

- [ ] **Step 3: Static verification**

Run: `npm run type-check && npm run lint` — both pass.

- [ ] **Step 4: Manual verification**

In dev, room view with music playing:
- Two speaker cabinets flank the monitor, grounded on the desk art; music notes float from their driver holes at a constant rate (~1.1s), staggered between cabinets.
- Click either cabinet: music mutes, notes stop, the small `✕♪` glyph appears on both cabinets. Click again: unmute, notes resume. The `NowPlaying` widget play/pause state stays in sync (same `toggle`).
- Clicking a cabinet must NOT zoom into the desk (button wins over the monitor anchor). Clicking the monitor bezel/screen still zooms. Clicking the coffee mug still plays the mug animation.
- Toggle the lamp: speakers dim/brighten and flicker in sync with the background.
- Hover the PC: the highlight outline and speakers look correct where they meet the right cabinet.
- Tab order reaches both cabinets; Enter toggles mute. Reduced motion: no notes, instant lamp swap, mute still works.
- If notes appear to emit from slightly the wrong spot, nudge the `HOLES_*` constants (they were measured from 4× crops, ±3px tolerance).

- [ ] **Step 5: Commit**

```bash
git add src/components/room/RoomSpeakers.tsx src/components/room/Room.tsx
git commit -m "feat: room-view desktop speakers with mute toggle and music notes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Re-extract the poster frames (owner's art edits)

**Files:**
- Regenerated: `public/room/poster-1..5.png`
- Possibly modify: `src/lib/room/objects.ts` (poster rect, only if the union bbox moved)

**Interfaces:**
- Consumes: `assets/pixel-art/sources/poster/kitagawa-1..5.png` (frames 2–4 carry fresh owner edits, already committed on this branch) via `scripts/extract-posters.mjs` (paths already updated for the reorganised tree).
- Produces: refreshed poster web sprites.

- [ ] **Step 1: Run the poster extraction**

Run: `node scripts/extract-posters.mjs`
The script prints the union crop box and a `poster: { x, y, w, h }` registry line.

- [ ] **Step 2: Reconcile the registry**

If the printed rect equals the current `objects.ts` poster entry `(997, 78, 134×247)` — nothing to do. If it differs, update the poster entry in `src/lib/room/objects.ts` to the printed values (and update the CLAUDE.md ledger in Task 7).

- [ ] **Step 3: Verify in dev**

Poster hover plays its 5-frame flip with the owner's updated art, no jitter, no misalignment against the wall.

- [ ] **Step 4: Commit**

```bash
git add public/room src/lib/room/objects.ts
git commit -m "feat: refresh poster sprites with updated art

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: CLAUDE.md sync, full gate, delete this TODO

**Files:**
- Modify: `CLAUDE.md`
- Delete: `TODO.md` (this file — per docs policy, in this final commit)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–6.
- Produces: accurate agent context; a clean repo with only `CLAUDE.md` and `README.md` remaining as docs.

- [ ] **Step 1: Update CLAUDE.md**

Precise edits (the docs-policy, assets-layout, and CONTENT.md-removal changes are already done on this branch — do NOT redo them):

(a) **Room-view objects** section — replace `monitor (240,261 393×343 → zoom to desk)` with:

```
monitor (235,257 402×350, 4 frames: rest + 3-frame hover highlight, play-once-hold,
with an 18-frame Win98 boot-screen overlay on the glass (266,275 214×171) that plays
simultaneously and also holds its last frame → zoom to desk; zoom origin stays at
stage (360,331) = rect + (125,74))
```

and add to the same section:

```
Desktop speakers (`RoomSpeakers.tsx`): art layer (146,292 435×218) crossfades/flickers
with the lamp; cabinets (left 148,355 108×154; right 490,290 91×141) are mute-toggle
buttons rendered AFTER the monitor so they win its overlapping anchor rect; notes emit
from driver holes (left 215,408 r15 / 215,463 r25; right 546,345 r14 / 546,397 r24).
All AnimatedSprite objects (poster, bonsai, coffee) and the monitor share the −2px
hover lift.
```

(b) **Desk view** section — after the `desk-closeup.png` sentence, add:

```
The close-up respects the persisted lamp state (`desk-closeup-lamp-off.png` under the
lit art, opacity crossfade + flicker), and the lamp itself is a toggle button at
(8,88 160×480) sharing Room's `toggleLamp` (one persistence path).
```

(c) **Extracted sprite ledger** — replace `monitor-desk (240,261 393×343)` with:

```
monitor-1..4 (235,257 402×350, rest + hover highlight) ·
monitor-loading-1..18 (266,275 214×171, boot screen on the glass) ·
room-speakers / room-speakers-lamp-off (146,292 435×218)
```

after `desk-closeup (full canvas)` add ` · desk-closeup-lamp-off (full canvas)`, and if Task 6 changed the poster rect, update `poster-1..5 (997,78 134×247)` to match.

(d) **Current State** paragraph — refresh to mention: monitor hover highlight + boot-screen animation, hover lifts on all room objects, clickable lamp in both views with lamp-off desk art, room-view speakers with mute + notes.

(e) **Architecture in One Page** — add `RoomSpeakers` to the room components list.

- [ ] **Step 2: Full pre-deploy gate**

Run: `npm run type-check && npm run lint && npm run build` — all three pass.

- [ ] **Step 3: Final commit — including deleting this file**

```bash
git rm TODO.md
git add CLAUDE.md
git commit -m "docs: CLAUDE.md sync for room interactivity work; complete and remove TODO

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of Scope (do not do)

- `assets/pixel-art/music-sfx/` (music-note art + `.ase`) — future interaction-SFX work (Roadmap 8). Leave untouched.
- Any change to the desk-view screen rect, iframe browser, desk speaker buttons, or mouse follower.
- Any new dictionary keys (all labels reuse existing `room.lampLabel` / `room.audio.speakersLabel`).
- Adding sharp to package.json, adding a test framework, touching `next.config.ts` headers, or creating any `.md` file.
