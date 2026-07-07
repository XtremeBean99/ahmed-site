# Monitor Hover Highlight + Loading Screen + Lamp-Off Desk + Room Speakers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hovering the PC in the room view plays a yellow-outline highlight animation on the monitor/keyboard/mousepad while a Windows-98-style boot sequence plays simultaneously on the monitor glass — both hold their last frame until the pointer leaves; the desk close-up view respects the persisted lamp state via a new lamp-off art variant; and new desktop speakers appear in the room view with lamp-on/lamp-off art that crossfades with the lamp toggle.

**Architecture:** New source art in `assets/pixel-art/sources/` is cropped into web sprites in `public/room/` by a new sharp extraction script (same union-bbox pattern as `scripts/extract-all-sprites.mjs`). `Monitor.tsx` gains a single interval "tick" clock driving two clamped frame sequences (4 highlight frames on the hotspot, 18 loading frames on an absolutely-positioned overlay over the glass). `DeskView.tsx` gains a `lampOn` prop and the same two-image crossfade already used for the room background. The room speakers are a decorative two-image layer in `Room.tsx` between the backgrounds and the monitor, crossfading on the existing `lampOn` state.

**Tech Stack:** Next.js App Router, React client components, sharp (available in `node_modules` transitively via Next — `import sharp from 'sharp'` works in `scripts/*.mjs` with no install; do NOT add it to package.json).

## Global Constraints (from CLAUDE.md — binding)

- Pixel art is served as raw `<img>` with `image-rendering: pixelated` — **never `next/image`**.
- Multi-frame / multi-variant sprites are cropped to a **shared union bbox +2px pad** across all frames so playback and crossfades never jitter.
- `public/room/` filenames are kebab-case lowercase (Vercel is case-sensitive; Windows is not).
- `prefers-reduced-motion` disables all decorative animation but **never functionality** (the monitor link must still navigate; the lamp crossfades become instant swaps).
- Decorative layers are `aria-hidden` + `pointer-events: none`.
- Every user-facing string goes in BOTH `src/lib/i18n/dictionaries/en.ts` and `fr.ts` — **this feature adds no user-facing strings** (the monitor label `room.monitorLabel` is unchanged; the loading overlay and speakers are decorative/aria-hidden), so no dictionary work is needed. Do not add any quoted UI strings.
- Room prefs live in localStorage key `room-save-v1` via `src/lib/room/storage.ts` — `lampOn` already exists there; no storage changes needed.
- There is no unit-test runner in this repo (scripts: `dev`, `build`, `start`, `lint`, `type-check`). Verification gates are `npm run type-check`, `npm run lint`, `npm run build`, plus the manual dev-server checks written into each task.
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## Measured Facts (already verified — do not re-derive, just use)

All measurements were made with a sharp alpha-bbox scan and verified visually by compositing. Stage coordinate space is 1408×768. Source filenames below are the **cleaned-up names committed on this branch** (the owner's original exports had typos — `highighted`, `keybaord`, `speakrs` — and were renamed; the room-speaker files were also renamed from `monitor speakrs in rooml.png` / `monitor speakrs in room_lamp_light_off.png`).

| Asset (`assets/pixel-art/sources/`) | Canvas | Content bbox (l,t → r,b) | Notes |
|---|---|---|---|
| `monitor-keyboard-mouse.png` (base, previously tracked) | 1408×768 | (242,263) → (630,601) | Identical crop to the current `public/room/monitor-desk.png` after +2 pad |
| `monitor-keyboard-mouse-highlight-1.png` | 1408×768 | (242,263) → (630,601) | Faint outline |
| `monitor-keyboard-mouse-highlight-2.png` | 1408×768 | (240,262) → (632,602) | Outline grows |
| `monitor-keyboard-mouse-highlight-3.png` | 1408×768 | (237,259) → (634,604) | Full yellow outline |
| `monitor-loading-screen-1..18.png` | **1380×752** | (266,275) → (479,445) — identical in all 18 frames | Win98 boot sequence drawn in the glass's perspective |
| `desk-closeup-lamp-off.png` | 1408×768 | full canvas | Desk close-up with the lamp dark and wall glow removed |
| `room-speakers.png` | 1408×768 | (148,294) → (578,507) | Desktop speakers flanking the monitor, lamp-lit (left cabinet glows warm) |
| `room-speakers-lamp-off.png` | 1408×768 | (148,294) → (578,507) — identical to lamp-on | Same speakers, dusk lighting |

- **Union bbox of the 4 hover frames +2px pad = (235, 257), 402×350.** This becomes the new monitor hotspot rect (the current one is (240,261) 393×343 — the highlight outline extends past it).
- **The loading frames' 1380×752 canvas is TOP-LEFT ALIGNED with the 1408×768 stage.** Verified pixel-perfect by compositing frame 1 over highlight frame 3 at offset (0,0) — the boot screen fills the glass exactly. So loading-frame coordinates ARE stage coordinates. Crop all 18 at exactly **(266, 275), 214×171** (bbox is constant across frames, so no jitter; no pad needed or wanted — pad would sample outside the glass).
- **The zoom origin must stay at stage point (360, 331).** `Room.tsx` currently computes it as `monitorObj.x + 22 + 98` / `monitorObj.y + 12 + 58` against the old rect (240,261). With the new rect (235,257) the offsets become **+125 / +74**. Getting this wrong re-introduces the v3 "site is off-centre" zoom bug.
- Loading overlay position inside the new monitor hotspot: left = 266−235 = **31**, top = 275−257 = **18**.
- **Room speakers: union bbox +2px pad = (146, 292), 435×218.** Both variants share the exact same bbox, so a single crop rect serves both and the crossfade cannot jitter. The right speaker (x 490–580) sits beside the monitor's right bezel and slightly inside the monitor hotspot's horizontal span, so the speakers layer must render **before (under) the `<Monitor>` sprite** in the DOM — the monitor art and its hover highlight outline paint on top of any overlap.

## File Structure

- Create: `scripts/extract-monitor-hover.mjs` — one-shot sprite extraction (mirrors `extract-all-sprites.mjs`)
- Create (generated): `public/room/monitor-1.png` … `monitor-4.png`, `public/room/monitor-loading-1.png` … `monitor-loading-18.png`, `public/room/desk-closeup-lamp-off.png`, `public/room/room-speakers.png`, `public/room/room-speakers-lamp-off.png`
- Delete: `public/room/monitor-desk.png` (superseded by `monitor-1.png`; deleted in Task 2 together with the code that stops referencing it)
- Modify: `src/lib/room/objects.ts` — monitor rect + frames, new exported loading constants
- Modify: `src/components/room/Monitor.tsx` — dual play-once-hold hover animation
- Modify: `src/components/room/Room.tsx` — zoom-origin offsets, new Monitor props, speakers layer, pass `lampOn` to DeskView
- Modify: `src/components/room/DeskView.tsx` — `lampOn` prop + art crossfade
- Modify: `CLAUDE.md` — sprite ledger + room sections kept accurate

---

### Task 1: Extract the new sprites

**Files:**
- Create: `scripts/extract-monitor-hover.mjs`
- Generated output: `public/room/monitor-1..4.png`, `public/room/monitor-loading-1..18.png`, `public/room/desk-closeup-lamp-off.png`, `public/room/room-speakers.png`, `public/room/room-speakers-lamp-off.png`

**Interfaces:**
- Consumes: source PNGs in `assets/pixel-art/sources/` (committed on this branch under the cleaned names in the Measured Facts table — verify with `git ls-files assets/pixel-art/sources`)
- Produces: the 25 web sprites listed above, which Tasks 2–4 reference by URL path (`/room/monitor-1.png` etc.)

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
Expected output: four `monitor-N.png 402x350 at stage (235,257)` lines, `monitor-loading-1..18 214x171 at stage (266,275)`, two `room-speakers… 435x218 at stage (146,292)` lines, `desk-closeup-lamp-off.png (full canvas)`. No errors.

- [ ] **Step 3: Verify the output files**

Run: `node -e "const s=require('sharp');Promise.all(['monitor-1','monitor-4','monitor-loading-1','monitor-loading-18','room-speakers','room-speakers-lamp-off','desk-closeup-lamp-off'].map(n=>s('public/room/'+n+'.png').metadata().then(m=>console.log(n,m.width+'x'+m.height))))"`
Expected: `monitor-1 402x350`, `monitor-4 402x350`, `monitor-loading-1 214x171`, `monitor-loading-18 214x171`, `room-speakers 435x218`, `room-speakers-lamp-off 435x218`, `desk-closeup-lamp-off 1408x768`.

Also confirm all filenames are lowercase kebab-case: `git status --short public/room` should show only the 25 new files, no case oddities.

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
- Consumes: sprites from Task 1 (`/room/monitor-1..4.png`, `/room/monitor-loading-1..18.png`); existing `RoomObject` component (props: `label, showTooltip, onActivate, onDeactivate, onClick, href, tabIndex, style, children`).
- Produces: `Monitor` component with new required props `loadingFrames: string[]` and `loadingRect: { x: number; y: number; w: number; h: number }`; `objects.ts` exports `MONITOR_LOADING_FRAMES: string[]` and `MONITOR_LOADING_RECT: { x: number; y: number; w: number; h: number }`. Tasks 3–4 do not depend on these.

Behavioural spec (owner's words): on hover, the highlight animation and the loading-screen animation **play at the same time**; each **remains at its last frame until the mouse moves off**; moving off resets both. This is the existing `play-once-hold` pattern (see `AnimatedSprite.tsx`) except two sequences of different lengths share one start/stop. Focus/blur must behave like hover/leave (accessibility invariant — `RoomObject` already forwards both). Under reduced motion: static base frame, no overlay, and the click/navigation behaviour is unchanged.

- [ ] **Step 1: Update the object registry**

In `src/lib/room/objects.ts`, replace the monitor entry (currently `x: 240, y: 261, w: 393, h: 343` with `frames: ['/room/monitor-desk.png']`) with:

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

Then append at the bottom of the file (after the `ROOM_OBJECTS` array):

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
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

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
    </RoomObject>
  )
}
```

Notes for the implementer:
- The old `motion.img` hover lift (`animate={{ y: -2 }}`) is **deliberately removed** — the highlight frames are the hover feedback now, and a lift would visibly detach the sprite (and the loading overlay) from the desk art behind it.
- The overlay `<img>` positions against the `RoomObject` root `<div>` (it carries `position: 'absolute'` via `style`), so `left: 31, top: 18` lands the boot screen exactly on the glass. Painting order (overlay after base img) keeps it above the sprite; the tooltip is `z-20` and stays above both.
- Timing that falls out of `FRAME_MS = 80`: highlight completes in 240 ms, loading in 1.44 s — both then hold. This matches the owner's "play at the same time, hold at last frame" spec.

- [ ] **Step 3: Wire Room.tsx**

In `src/components/room/Room.tsx`:

(a) Update the import:

```ts
import { ROOM_OBJECTS, MONITOR_LOADING_FRAMES, MONITOR_LOADING_RECT } from '@/lib/room/objects'
```

(b) Replace the zoom-origin/glow block (currently `monitorObj.x + 22 + 98` etc., ~lines 181–187) with:

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

(c) Add the two new props to the `<Monitor …/>` element:

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
Then confirm nothing else references it: `grep -rn "monitor-desk" src/` must return nothing.

- [ ] **Step 5: Static verification**

Run: `npm run type-check && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 6: Manual verification in the dev server**

Run `npm run dev`, open `http://localhost:3000/`:
- Hover the PC: the yellow outline steps in over ~¼ s while the Win98 boot screen plays on the glass for ~1.4 s; **both then freeze on their final frames** for as long as the pointer stays.
- Move the pointer off: the sprite snaps back to the rest art and the glass goes dark. Re-hover: both replay from the start.
- The boot screen must sit exactly inside the monitor glass — no dark fringe on the bezel, no glass showing around it (if it's offset, the `loadingRect`/monitor-rect arithmetic was mis-typed; recheck 31/18).
- Press Tab until the monitor gets focus: same animation runs (focus == hover).
- Click the monitor: the zoom must still converge on the centre of the glass, exactly as before this change (regression check for the v3 off-centre bug).
- DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, reload: hovering shows the static rest frame with no overlay; clicking the monitor still navigates to `/home`.

- [ ] **Step 7: Commit**

```bash
git add src/components/room/Monitor.tsx src/lib/room/objects.ts src/components/room/Room.tsx
git commit -m "feat: monitor hover highlight with simultaneous boot-screen animation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Lamp-off variant of the desk close-up

**Files:**
- Modify: `src/components/room/DeskView.tsx` (props ~lines 33–45, background img ~line 215)
- Modify: `src/components/room/Room.tsx` (desk-view branch ~lines 199–215)

**Interfaces:**
- Consumes: `public/room/desk-closeup-lamp-off.png` from Task 1; `Room`'s existing `lampOn` state (already loaded from `room-save-v1` prefs on mount and toggled by the room lamp hotspot — no storage changes).
- Produces: `DeskView` gains a required prop `lampOn: boolean`.

The pattern is copied from the room view's background crossfade (`Room.tsx` ~lines 235–258): the lamp-off art always sits underneath; the lamp-on art sits on top and fades its opacity. Reduced motion swaps instantly (`transition: 'none'`).

- [ ] **Step 1: Add the prop to DeskView**

In `src/components/room/DeskView.tsx`, add to `DeskViewProps`:

```ts
  /** Persisted lamp state from the room — picks the desk close-up art variant */
  lampOn: boolean
```

and add `lampOn` to the destructuring line:

```ts
  const { shortcuts, backLabel, screenLabel, desktopLabel, expandLabel, browserTitle, speakersLabel, lampOn, onBack } = props
```

- [ ] **Step 2: Stack the two art layers**

Replace the single background img (currently `<img src="/room/desk-closeup.png" …/>`, ~line 215) with:

```tsx
        {/* Lamp-off close-up (always present, behind the lit version) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup-lamp-off.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
        {/* Lamp-on close-up (fades out when the lamp is off) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0, transition: reduce ? 'none' : 'opacity 0.4s ease' }} />
```

(`reduce` is already in scope in `DeskView`.)

- [ ] **Step 3: Pass the state from Room**

In `src/components/room/Room.tsx`, in the `view === 'desk'` branch, add the prop to `<DeskView …>`:

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
          onBack={handleDeskBack}
        />
```

(`lampOn` state already exists in `Room` and is loaded from prefs on mount, so this works for the `/#desk` deep-link path too.)

- [ ] **Step 4: Static verification**

Run: `npm run type-check && npm run lint`
Expected: both pass. (Type-check is the gate that proves every `DeskView` call site passes the new required prop.)

- [ ] **Step 5: Manual verification in the dev server**

With `npm run dev` on `http://localhost:3000/`:
- Click the lamp (left edge, the room darkens), then click the monitor: the desk close-up must show the **dark** art — unlit lamp shade, no warm wall glow.
- Press Escape back to the room, click the lamp on, re-enter the desk: bright art.
- While in the desk view, confirm the screen content (clock strip + icons), speakers, and mouse still sit correctly on the art — the two desk artworks are pixel-aligned, so nothing should shift.
- Reload with the lamp left off, then deep-link to `http://localhost:3000/#desk`: dark art must appear (prefs load on mount).

- [ ] **Step 6: Commit**

```bash
git add src/components/room/DeskView.tsx src/components/room/Room.tsx
git commit -m "feat: desk close-up respects the lamp state via lamp-off art

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Desktop speakers in the room view (lamp-on/lamp-off)

**Files:**
- Modify: `src/components/room/Room.tsx` (room-view stage children, directly after the two background `<img>`s and **before** `<Monitor …/>`)

**Interfaces:**
- Consumes: `public/room/room-speakers.png` and `public/room/room-speakers-lamp-off.png` from Task 1; `Room`'s existing `lampOn` + `lampFlicker` state and `reduce`.
- Produces: nothing consumed by other tasks — a purely decorative layer.

The speakers are decorative room furniture (no hotspot, no tooltip, no dictionary entry — the mute-toggle speakers live in the desk view). They must dim in sync with the room background when the lamp toggles, including the 0.5 s flicker animation on switch-on, which is why the lamp-on layer copies the background's `lamp-flicker` class binding exactly.

- [ ] **Step 1: Add the speakers layer to Room.tsx**

In the room-view return of `src/components/room/Room.tsx`, insert between the lamp-on background `<img>` (ends ~line 258) and `<Monitor …/>`:

```tsx
          {/* Desktop speakers flanking the monitor. Decorative furniture —
              rendered under the Monitor sprite so its hover highlight paints
              on top. Lamp-on/off art crossfades in sync with the background. */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{ left: 146, top: 292, width: 435, height: 218 }}
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
```

- [ ] **Step 2: Static verification**

Run: `npm run type-check && npm run lint`
Expected: both pass.

- [ ] **Step 3: Manual verification in the dev server**

With `npm run dev` on `http://localhost:3000/`:
- Two speaker cabinets sit on the desk flanking the monitor (left one beside the lamp, right one beside the monitor's right bezel), grounded on the desk art with no floating edges or misaligned outlines.
- Toggle the lamp: the speakers dim/brighten **together with** the background crossfade, and the lamp-on art flickers in sync with the background's flicker on switch-on.
- Hover the PC: the yellow highlight outline paints **over** the right speaker where they meet (speakers render under the monitor sprite).
- The speakers are not clickable, show no tooltip, and don't affect tab order (aria-hidden + pointer-events-none).
- Emulate `prefers-reduced-motion: reduce`: lamp toggle swaps the speaker art instantly, no flicker.

- [ ] **Step 4: Commit**

```bash
git add src/components/room/Room.tsx
git commit -m "feat: desktop speakers in the room view with lamp-off variant

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Documentation sync + full pre-deploy gate

**Files:**
- Modify: `CLAUDE.md` (sprite ledger + room sections)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–4.
- Produces: accurate agent context for future sessions (CLAUDE.md is the single consolidated context doc and must stay truthful).

- [ ] **Step 1: Update CLAUDE.md**

Four precise edits:

(a) In the **Room-view objects** section, replace the monitor line's description `monitor (240,261 393×343 → zoom to desk)` with:

```
monitor (235,257 402×350, 4 frames: rest + 3-frame hover highlight, play-once-hold,
with an 18-frame Win98 boot-screen overlay on the glass (266,275 214×171) that plays
simultaneously and also holds its last frame → zoom to desk; zoom origin stays at
stage (360,331) = rect + (125,74))
```

and add to the same section:

```
Decorative desktop speakers (146,292 435×218) flank the monitor, rendered under the
monitor sprite; lamp-on/off art crossfades and flickers in sync with the background.
```

(b) In the **Desk view** section, after the sentence describing `desk-closeup.png`, add:

```
The close-up respects the persisted lamp state: `desk-closeup-lamp-off.png` sits
under the lit art with the same opacity-crossfade pattern as the room background
(`lampOn` prop passed from Room).
```

(c) In the **Extracted sprite ledger**, replace `monitor-desk (240,261 393×343)` with:

```
monitor-1..4 (235,257 402×350, rest + hover highlight) ·
monitor-loading-1..18 (266,275 214×171, boot screen on the glass) ·
room-speakers / room-speakers-lamp-off (146,292 435×218)
```

and after `desk-closeup (full canvas)` add ` · desk-closeup-lamp-off (full canvas)`.

(d) In the **Sprite pipeline** section, note the source-file cleanup: source exports for these sprites live in `assets/pixel-art/sources/` under kebab-case names (`monitor-keyboard-mouse-highlight-1..3.png`, `monitor-loading-screen-1..18.png`, `room-speakers[-lamp-off].png`, `desk-closeup-lamp-off.png`) — the owner's original typo'd filenames were renamed on this branch.

- [ ] **Step 2: Full pre-deploy gate**

Run: `npm run type-check && npm run lint && npm run build`
Expected: all three pass. (The build is the final gate — CLAUDE.md's pre-deploy standard.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: sprite ledger + room sections for monitor hover, room speakers, lamp-off desk

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of Scope (do not do)

- The `assets/pixel-art/music sfx/` folder (relocated music-note sprites + a new `.ase`) — separate future work, likely Roadmap item 8 (interaction SFX). Leave untouched.
- Making the room-view speakers interactive (mute toggle like the desk view's) — they are decorative furniture unless the owner asks otherwise.
- Any change to the desk-view screen rect, iframe browser, desk speakers, or mouse follower.
- Any new dictionary keys (nothing user-facing changes).
- Adding sharp to package.json, adding a test framework, or touching `next.config.ts` headers.
