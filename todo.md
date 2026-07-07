# Side Table + Digital Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two new pixel-art layers — a decorative side table and a clickable digital alarm clock sitting on it — to the room view (`/`), with a static custom time rendered in green LED digits skewed onto the clock's face plane, no hover pick-up on either object, and click-to-toggle 12/24-hour format persisted in `room-save-v1`.

**Architecture:** The two source PNGs (`assets/pixel-art/background/side-table.png` and `side-table-digital-clock-no-numbers.png`) are full 1408×768 stage canvases with the art pre-positioned. A new extraction script crops them to their alpha bbox +2 px pad into `public/room/` (established sprite pipeline). The side table renders as a plain decorative `<img>` layer in `Room.tsx` (no hotspot). The clock is a new `SideTableClock` component: a `RoomObject` button hotspot (tooltip + focus ring, **deliberately no** `motion.img` hover lift) with the sprite plus an aria-hidden digits overlay positioned on the face rect and skewed `-11°` (`skewY`) to match the isometric face plane. Format preference is a new `clock24h` boolean in the `room-save-v1` localStorage schema.

**Tech Stack:** Next.js (App Router), React client components, Tailwind + inline styles (room convention), sharp (build-time sprite extraction), Framer Motion available but NOT used for the clock sprite (no lift), i18n dictionaries (EN + FR).

## Global Constraints

- Repo root for all paths/commands: `website/ahmed-site` (this file's directory).
- Stage coordinate space is fixed 1408×768; all rects below are stage coords.
- Room sprites are raw `<img>` with `image-rendering: pixelated` — **never `next/image`** (CLAUDE.md sprite pipeline).
- Every new user-facing string goes in BOTH `src/lib/i18n/dictionaries/en.ts` and `fr.ts` in the same commit (Critical Constraint 5 — this rule has been violated four times before, always in room components).
- `prefers-reduced-motion` disables decorative animation (the blinking colon) but never functionality (the click toggle).
- Every hotspot is a real `<button>` inside the room `<nav aria-label>`, with the shared focus-visible ring (handled by `RoomObject`).
- **The side table and the clock must NOT have the −2 px hover lift** that monitor/poster/bonsai/coffee have. This is an explicit owner requirement. Do not wrap either sprite in `motion.img` with a hover `y` animation.
- The clock shows a **static custom time, 21:07** (a 7/7 nod; the room is a frozen dusk photograph — do NOT wire it to `new Date()`). 24-hour mode shows `21:07`; 12-hour mode shows `9:07 PM`.
- Digit colour: LED green `#35e65c` with glow `text-shadow: 0 0 3px rgba(53,230,92,0.55)`. Colour is allowed here — the room page `/` is exempt from the monochrome constraint.
- There is **no test runner in this repo** (no jest/vitest). The test cycle for every task is: `npm run type-check` and `npm run lint` (and `npm run build` at the end), plus the visual verification task. Do not add a test framework.
- CLAUDE.md is slightly stale vs the code (it doesn't yet mention the Saitama poster at (761,76) or that the clock-tooltip bubble moved to (620,100)). **Trust the code**, and note the existing wall "clock bubble" (`Room.tsx` ~line 343, shows live time + visitor counter at (620,100)) is a separate feature — leave it alone.
- Commit after every task. Do not batch tasks into one commit.

## Measured Geometry (source of truth for all tasks)

Computed from the alpha channels of the two source PNGs (canvas 1408×768):

| Item | Raw bbox (l,t,r,b) | +2 px pad crop | Stage rect |
|---|---|---|---|
| Side table | 643,411 → 811,621 | (641,409) | 173×215 at (641,409) |
| Clock body | 660,388 → 726,438 | (658,386) | 71×55 at (658,386) |
| Clock dark face (digit plane) | measured corners TL(678,409) TR(722,400) BR(723,424) BL(679,432) | — | **43×22 at (679,409)** |

The face is a parallelogram: left/right edges vertical, top/bottom edges rising ~11° to the right (rise ≈ 9 px over run ≈ 44 px ⇒ atan(9/44) ≈ 11.2°). Vertical sides + slanted horizontals = a pure **`skewY(-11deg)`** with `transform-origin: top left` — do NOT use `rotate` (rotate would tilt the vertical edges and break alignment with the bezel).

The clock (top 386) overlaps the table (top 409) — render the table first, the clock after it. Neither rect overlaps any existing hotspot (monitor's right edge is x=637; the saitama poster's bottom is y=319).

---

### Task 1: Extract the two sprites into `public/room/`

**Files:**
- Create: `scripts/extract-side-table.mjs`
- Output (generated, committed): `public/room/side-table.png`, `public/room/side-table-clock.png`

**Interfaces:**
- Consumes: `assets/pixel-art/background/side-table.png`, `assets/pixel-art/background/side-table-digital-clock-no-numbers.png` (already in the repo, untracked — this task commits them too)
- Produces: `/room/side-table.png` (173×215, stage (641,409)) and `/room/side-table-clock.png` (71×55, stage (658,386)) referenced by Tasks 4 and 6

- [ ] **Step 1: Write the extraction script** (mirrors `scripts/extract-all-sprites.mjs`; `sharp` resolves from `node_modules` — the other extract scripts already import it)

```js
// scripts/extract-side-table.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const bgDir = join(__dirname, '..', 'assets', 'pixel-art', 'background')

async function getBounds(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 0) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right === -1) return null
  return { left, top, right, bottom }
}

const JOBS = [
  { src: 'side-table.png', out: 'side-table.png' },
  { src: 'side-table-digital-clock-no-numbers.png', out: 'side-table-clock.png' },
]

async function main() {
  await mkdir(outDir, { recursive: true })
  const pad = 2
  const imgW = 1408, imgH = 768
  for (const job of JOBS) {
    const srcPath = join(bgDir, job.src)
    const b = await getBounds(srcPath)
    if (!b) {
      console.error('No opaque pixels in', job.src)
      process.exitCode = 1
      continue
    }
    const left = Math.max(0, b.left - pad)
    const top = Math.max(0, b.top - pad)
    const right = Math.min(imgW - 1, b.right + pad)
    const bottom = Math.min(imgH - 1, b.bottom + pad)
    const w = right - left + 1
    const h = bottom - top + 1
    await sharp(srcPath)
      .extract({ left, top, width: w, height: h })
      .png()
      .toFile(join(outDir, job.out))
    console.log(`${job.out}: ${w}x${h} at stage (${left},${top})`)
  }
}

main().catch(console.error)
```

- [ ] **Step 2: Run it and verify the numbers**

Run: `node scripts/extract-side-table.mjs`
Expected output (exactly):

```
side-table.png: 173x215 at stage (641,409)
side-table-clock.png: 71x55 at stage (658,386)
```

If the numbers differ, the source art changed — use the printed values everywhere this plan says (641,409) 173×215 / (658,386) 71×55, and re-measure the face rect before Task 4.

- [ ] **Step 3: Verify output files are lowercase kebab-case and tracked sizes are sane**

Run: `ls -l public/room/side-table.png public/room/side-table-clock.png`
Expected: both exist, each under ~15 KB.

- [ ] **Step 4: Commit (script + source art + extracted sprites)**

```bash
git add scripts/extract-side-table.mjs assets/pixel-art/background/side-table.png "assets/pixel-art/background/side-table-digital-clock-no-numbers.png" public/room/side-table.png public/room/side-table-clock.png
git commit -m "feat(room): extract side-table and digital-clock sprites"
```

---

### Task 2: Add `clock24h` to the room save schema

**Files:**
- Modify: `src/lib/room/storage.ts` (whole file is 41 lines)

**Interfaces:**
- Produces: `loadPrefs(): RoomSave` now includes `clock24h: boolean` (default `true`); `savePrefs({ clock24h })` persists it. Task 6 consumes both.

- [ ] **Step 1: Extend the interface, defaults, and parser**

In `src/lib/room/storage.ts`, change the `RoomSave` interface and `DEFAULTS`:

```ts
interface RoomSave {
  audio: boolean
  lampOn: boolean
  visitCount: number
  /** Music volume 0–1 */
  volume: number
  /** Digital clock shows 24-hour time (false = 12-hour) */
  clock24h: boolean
}

const DEFAULTS: RoomSave = { audio: true, lampOn: true, visitCount: 0, volume: 0.3, clock24h: true }
```

And inside the object returned by `loadPrefs()`, after the `volume:` entry, add:

```ts
      clock24h: typeof parsed.clock24h === 'boolean' ? parsed.clock24h : DEFAULTS.clock24h,
```

(Same defensive-parse pattern as the other keys — old saves without the key fall back to the default, never crash.)

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: PASS (exit 0, no output errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/room/storage.ts
git commit -m "feat(room): persist clock 12/24h preference in room-save-v1"
```

---

### Task 3: Dictionary strings (EN + FR) and the Room dict interface

**Files:**
- Modify: `src/lib/i18n/dictionaries/en.ts` (room block, near line 462)
- Modify: `src/lib/i18n/dictionaries/fr.ts` (room block, near line 459)
- Modify: `src/components/room/Room.tsx` (the `RoomProps` dict interface, near line 36)

**Interfaces:**
- Produces: dictionary key `room.sideTableClockLabel: string`, consumed by Tasks 5–6 as `t.room.sideTableClockLabel`. `page.tsx` passes the whole `dict.room` through, so no page change is needed.

- [ ] **Step 1: Add the English key (the "failing test")**

In `src/lib/i18n/dictionaries/en.ts`, inside the `room` block after `coffeeLabel: 'Coffee mug',`:

```ts
    sideTableClockLabel: 'Digital clock — toggle 24-hour time',
```

- [ ] **Step 2: Run type-check to verify it fails**

Run: `npm run type-check`
Expected: FAIL — `fr.ts` no longer satisfies the `Dictionary` type (missing `sideTableClockLabel`). This is the guard rail from Critical Constraint 5 working.

- [ ] **Step 3: Add the French key**

In `src/lib/i18n/dictionaries/fr.ts`, inside the `room` block after `coffeeLabel: 'Tasse de café',`:

```ts
    sideTableClockLabel: 'Horloge numérique — basculer l\'affichage 24 h',
```

- [ ] **Step 4: Add the key to the Room dict interface**

In `src/components/room/Room.tsx`, in `RoomProps` → `dict.room`, after `coffeeLabel: string`:

```ts
      sideTableClockLabel: string
```

- [ ] **Step 5: Run type-check to verify it passes**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/dictionaries/en.ts src/lib/i18n/dictionaries/fr.ts src/components/room/Room.tsx
git commit -m "feat(room): add digital clock label to EN and FR dictionaries"
```

---

### Task 4: Register the clock object and geometry constants

**Files:**
- Modify: `src/lib/room/objects.ts` (append to `ROOM_OBJECTS` after the `coffee` entry, and export new consts at the bottom of the file)

**Interfaces:**
- Produces: `ROOM_OBJECTS` entry `id: 'clock'` (rect (658,386) 71×55, `labelKey: 'room.sideTableClockLabel'`, single frame `/room/side-table-clock.png`, `href: null`); exported consts `SIDE_TABLE_RECT`, `CLOCK_FACE_RECT`, `CLOCK_FACE_SKEW_DEG`. Tasks 5–6 consume all of these by exactly these names.

- [ ] **Step 1: Add the registry entry**

In `src/lib/room/objects.ts`, append inside the `ROOM_OBJECTS` array after the `coffee` entry:

```ts
  {
    id: 'clock',
    // Digital alarm clock on the side table. Single frame — the face is blank
    // in the art; SideTableClock renders the LED digits on it. Click toggles
    // 12/24-hour display. Deliberately no hover lift.
    x: 658,
    y: 386,
    w: 71,
    h: 55,
    labelKey: 'room.sideTableClockLabel',
    frames: ['/room/side-table-clock.png'],
    href: null,
  },
```

- [ ] **Step 2: Add the geometry constants at the end of the file** (after `MONITOR_LOADING_FRAMES`)

```ts
/**
 * Decorative side table between the desk and the bed. No hotspot, no hover
 * lift — rendered as a plain background layer in Room.tsx.
 */
export const SIDE_TABLE_RECT = { x: 641, y: 409, w: 173, h: 215 }

/**
 * The clock's dark face plane in stage coords. Left/right edges are vertical;
 * top/bottom edges rise ~11° to the right, so the digit layer uses
 * skewY(CLOCK_FACE_SKEW_DEG) with transform-origin top-left (NOT rotate —
 * rotation would tilt the vertical bezel edges).
 */
export const CLOCK_FACE_RECT = { x: 679, y: 409, w: 43, h: 22 }
export const CLOCK_FACE_SKEW_DEG = -11
```

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/room/objects.ts
git commit -m "feat(room): register digital clock object and side-table geometry"
```

---

### Task 5: `SideTableClock` component + colon-blink keyframes

**Files:**
- Create: `src/components/room/SideTableClock.tsx`
- Modify: `src/app/globals.css` (add keyframes next to the existing `steam-rise` / `lamp-flicker` room keyframes)

**Interfaces:**
- Consumes: `RoomObject` from `./RoomObject` (existing: props `label, showTooltip, onActivate, onDeactivate, onClick, tabIndex`; renders children inside a focus-ringed `<button>` with the speech-bubble tooltip).
- Produces: `SideTableClock` component with props `{ label: string; x: number; y: number; w: number; h: number; frame: string; faceRect: { x: number; y: number; w: number; h: number }; faceSkewDeg: number; is24h: boolean; lampOn: boolean; onToggle: () => void }`. Task 6 consumes it with exactly this signature.

- [ ] **Step 1: Write the component**

```tsx
// src/components/room/SideTableClock.tsx
'use client'

import { useState, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

/**
 * Static "photograph" time — the room is frozen at dusk, so the clock shows a
 * fixed 21:07 (a 7/7 nod), not the visitor's live time. The wall clock bubble
 * next to the posters already shows real time.
 */
const TIME_24 = '21:07'
const TIME_12 = '9:07'
const TIME_12_SUFFIX = 'PM'

interface SideTableClockProps {
  label: string
  /** Sprite rect in stage coords (from the ROOM_OBJECTS 'clock' entry) */
  x: number
  y: number
  w: number
  h: number
  frame: string
  /** Digit plane in stage coords (CLOCK_FACE_RECT) */
  faceRect: { x: number; y: number; w: number; h: number }
  /** skewY angle matching the face's isometric plane (CLOCK_FACE_SKEW_DEG) */
  faceSkewDeg: number
  is24h: boolean
  lampOn: boolean
  onToggle: () => void
}

export function SideTableClock({
  label,
  x,
  y,
  w,
  h,
  frame,
  faceRect,
  faceSkewDeg,
  is24h,
  lampOn,
  onToggle,
}: SideTableClockProps) {
  const [hovered, setHovered] = useState(false)
  const reduce = useReducedMotion()

  const activate = useCallback(() => setHovered(true), [])
  const deactivate = useCallback(() => setHovered(false), [])

  const [hh, mm] = (is24h ? TIME_24 : TIME_12).split(':')

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onFocus={activate}
      onBlur={deactivate}
    >
      <RoomObject
        label={label}
        showTooltip={hovered}
        onActivate={activate}
        onDeactivate={deactivate}
        onClick={onToggle}
        tabIndex={0}
      >
        {/* Plain <img>, NOT motion.img — the clock must not lift on hover. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{
            imageRendering: 'pixelated',
            filter: lampOn ? 'none' : 'brightness(0.72)',
            transition: reduce ? 'none' : 'filter 0.4s ease',
          }}
        />
        {/* LED digits, skewed onto the face plane. Emissive — not dimmed by
            the lamp. aria-hidden: the time is decoration; the button label
            carries the accessible meaning. */}
        <div
          aria-hidden
          className="absolute flex items-center justify-center"
          style={{
            left: faceRect.x - x,
            top: faceRect.y - y,
            width: faceRect.w,
            height: faceRect.h,
            transform: `skewY(${faceSkewDeg}deg)`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            fontFamily: 'var(--font-pixel), "Courier New", monospace',
            fontSize: '11px',
            lineHeight: 1,
            color: '#35e65c',
            textShadow: '0 0 3px rgba(53,230,92,0.55)',
          }}
        >
          {hh}
          <span className={reduce ? undefined : 'clock-colon'} style={{ position: 'relative', top: '-1px' }}>
            :
          </span>
          {mm}
          {!is24h && <span style={{ fontSize: '6px', marginLeft: '2px' }}>{TIME_12_SUFFIX}</span>}
        </div>
      </RoomObject>
    </div>
  )
}
```

- [ ] **Step 2: Add the colon-blink keyframes to `src/app/globals.css`**, next to the other room keyframes (search for `steam-rise`):

```css
/* Digital clock colon: hard LED-style 1 Hz blink (reduced motion: class not applied) */
@keyframes clock-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.25; }
}
.clock-colon {
  animation: clock-blink 1s steps(1) infinite;
}
```

- [ ] **Step 3: Verify**

Run: `npm run type-check` then `npm run lint`
Expected: both PASS. (The component isn't rendered anywhere yet — that's Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/components/room/SideTableClock.tsx src/app/globals.css
git commit -m "feat(room): SideTableClock component with skewed LED digits"
```

---

### Task 6: Wire the side table and clock into `Room.tsx`

**Files:**
- Modify: `src/components/room/Room.tsx`

**Interfaces:**
- Consumes: `SideTableClock` (Task 5 signature), `SIDE_TABLE_RECT` / `CLOCK_FACE_RECT` / `CLOCK_FACE_SKEW_DEG` and the `'clock'` registry entry (Task 4), `loadPrefs().clock24h` / `savePrefs({ clock24h })` (Task 2), `t.room.sideTableClockLabel` (Task 3).

- [ ] **Step 1: Imports** — extend the existing import from `@/lib/room/objects` (line 5) and add the component import:

```ts
import {
  ROOM_OBJECTS,
  MONITOR_LOADING_FRAMES,
  MONITOR_LOADING_RECT,
  SIDE_TABLE_RECT,
  CLOCK_FACE_RECT,
  CLOCK_FACE_SKEW_DEG,
} from '@/lib/room/objects'
import { SideTableClock } from './SideTableClock'
```

- [ ] **Step 2: State + prefs load** — next to the other `useState` calls (~line 72) add:

```ts
  const [clock24h, setClock24h] = useState(true)
```

and extend the mount-time prefs effect (line 79) to hydrate it — the effect becomes:

```ts
  useEffect(() => { const p = loadPrefs(); setLampOn(p.lampOn); setClock24h(p.clock24h); setVisitCount(p.visitCount + 1); savePrefs({ visitCount: p.visitCount + 1 }) }, [])
```

- [ ] **Step 3: Toggle callback** — after `toggleLamp` (~line 188), same persist-inside-updater pattern:

```ts
  // Digital clock: click toggles 12/24-hour display, persisted.
  const toggleClockFormat = useCallback(() => {
    setClock24h((v) => {
      const n = !v
      savePrefs({ clock24h: n })
      return n
    })
  }, [])
```

- [ ] **Step 4: Object lookup** — next to the other lookups (~line 194):

```ts
  const clockObj = ROOM_OBJECTS.find((o) => o.id === 'clock')!
```

- [ ] **Step 5: Render the layers** — inside `<RoomStage>`, immediately after the lamp-on background `<img>` (after line 280) and **before** `<Monitor …>`, add — table first, clock on top of it:

```tsx
          {/* Side table — decorative, no hotspot, no hover lift. Dims with the lamp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/room/side-table.png"
            alt=""
            draggable={false}
            className="absolute"
            style={{
              left: SIDE_TABLE_RECT.x,
              top: SIDE_TABLE_RECT.y,
              width: SIDE_TABLE_RECT.w,
              height: SIDE_TABLE_RECT.h,
              imageRendering: 'pixelated',
              filter: lampOn ? 'none' : 'brightness(0.72)',
              transition: reduce ? 'none' : 'filter 0.4s ease',
            }}
          />

          {/* Digital clock on the side table — click toggles 12/24 h. No hover lift. */}
          <SideTableClock
            label={t.room.sideTableClockLabel}
            x={clockObj.x}
            y={clockObj.y}
            w={clockObj.w}
            h={clockObj.h}
            frame={clockObj.frames[0]}
            faceRect={CLOCK_FACE_RECT}
            faceSkewDeg={CLOCK_FACE_SKEW_DEG}
            is24h={clock24h}
            lampOn={lampOn}
            onToggle={toggleClockFormat}
          />
```

- [ ] **Step 6: Verify**

Run: `npm run type-check && npm run lint && npm run build`
Expected: all three PASS (build completes with no new warnings about the room page).

- [ ] **Step 7: Commit**

```bash
git add src/components/room/Room.tsx
git commit -m "feat(room): render side table and interactive digital clock"
```

---

### Task 7: Visual verification and angle fine-tune

**Files:**
- Possibly modify: `src/lib/room/objects.ts` (`CLOCK_FACE_RECT` / `CLOCK_FACE_SKEW_DEG` only)

**Interfaces:**
- Consumes: everything above, running in the browser.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` and open `http://localhost:3000/`.

- [ ] **Step 2: Walk the checklist** (take screenshots where the harness allows; otherwise inspect carefully at 100% and zoomed):

1. Side table renders between the desk and the bed, clock sitting on its top surface; both crisp/pixelated, no seams against the background.
2. Green `21:07` digits sit **inside the dark face**, parallel to the face's top/bottom bezel edges. If the baseline visibly diverges from the bezel, adjust `CLOCK_FACE_SKEW_DEG` by ±1–2° and/or nudge `CLOCK_FACE_RECT` x/y by 1–2 px until it reads as printed on the face. Do not exceed the face: if digits clip, drop `fontSize` to `10px` in `SideTableClock.tsx`.
3. Hovering the clock shows the tooltip ("Digital clock — toggle 24-hour time") but **no lift** — compare against the poster, which does lift. Hovering the side table does nothing at all.
4. Clicking the clock switches `21:07` ⇄ `9:07 PM` (PM rendered small); clicking again switches back.
5. Reload the page: the chosen format survives (localStorage `room-save-v1` now contains `"clock24h"`).
6. Keyboard: Tab reaches the clock (focus ring visible), Enter/Space toggles the format.
7. Toggle the desk lamp: table and clock body dim smoothly with the room; the green digits stay bright (emissive LED).
8. Colon blinks ~1 Hz. Enable reduced motion (DevTools → Rendering → emulate `prefers-reduced-motion`): colon stops blinking, click toggle still works.
9. Switch the site to FR (header toggle sets the cookie; easiest: visit `/home`, toggle FR, return to `/`): tooltip reads "Horloge numérique — basculer l'affichage 24 h".
10. The pre-existing wall clock bubble (live time + 👁 counter at (620,100)) still renders and was not affected.

- [ ] **Step 3: If geometry was adjusted, re-verify and commit the tweak**

```bash
npm run type-check
git add src/lib/room/objects.ts src/components/room/SideTableClock.tsx
git commit -m "fix(room): fine-tune clock digit plane alignment"
```

(Skip this commit if nothing changed.)

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: final shipped state from Tasks 1–7.

- [ ] **Step 1: Update the Current State paragraph** (starts line 23) — prepend to the feature list:

```
Side table + digital alarm clock on it (static 21:07 in green LED digits skewY'd −11° onto
the face plane; click toggles 12/24 h, persisted as `clock24h`; deliberately no hover lift),
```

- [ ] **Step 2: Update Critical Constraint 3's localStorage note** (line 58) — the key list becomes:

```
`room-save-v1` key, currently `{ audio, lampOn, visitCount, volume, clock24h }`
```

- [ ] **Step 3: Extend the room-view objects section** (the `objects.ts` registry paragraph, ~line 167) — add after the coffee entry description:

```
· side table (641,409 173×215, decorative layer, no hotspot, dims with the lamp) ·
digital clock (658,386 71×55, single frame, no hover lift; SideTableClock renders static
21:07 in LED green #35e65c on the blank face — digit plane (679,409) 43×22, skewY(−11°),
1 Hz colon blink gated by reduced motion; click toggles 12/24 h via `clock24h` pref)
```

- [ ] **Step 4: Extend the sprite ledger** (~line 214) — append:

```
· side-table (641,409 173×215) · side-table-clock (658,386 71×55) — both extracted by
scripts/extract-side-table.mjs from assets/pixel-art/background/
```

- [ ] **Step 5: Add a session-history bullet** after the v6 entry:

```
- **v7** (7 July 2026): side table + digital clock (static 21:07, green LED digits on the
  isometric face plane, 12/24 h click toggle persisted, no hover pickup by design).
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record side table and digital clock in CLAUDE.md"
```

---

## Self-Review Notes (already run by the planner)

<!-- (Self-review notes for the clock plan are below; the approved lighting design follows at the end of this file.) -->

- **Spec coverage:** two PNGs implemented (T1/T4/T6) ✓ · custom time in green (T5: static 21:07, `#35e65c`) ✓ · angle appropriate to the clock (measured −11° skewY, T4/T5, fine-tune in T7) ✓ · no hover pickup on either (T5 plain `<img>`, T6 decorative table; verified in T7.3) ✓ · click toggles 24/12 h (T5/T6, persisted via T2) ✓ · plan per CLAUDE.md constraints (i18n T3, a11y via RoomObject, reduced motion, sprite pipeline, docs sync T8) ✓
- **Naming consistency:** `SideTableClock`, `sideTableClockLabel`, `clock24h`, `SIDE_TABLE_RECT`, `CLOCK_FACE_RECT`, `CLOCK_FACE_SKEW_DEG`, `/room/side-table.png`, `/room/side-table-clock.png` — used identically across all tasks.
- **Known stale-doc hazard:** CLAUDE.md predates the Saitama poster and the (620,100) clock bubble; this plan was written from the actual code (`objects.ts`, `Room.tsx` as of commit `37824a9`).

---

# APPROVED DESIGN — Lighting Engine (visitor's local time)

> Approved by the owner on 7 July 2026. Not yet planned into tasks — run
> superpowers:writing-plans against this design when ready to build. Build
> order note: this ships AFTER the clock plan above; it amends that feature
> (see "Ripple" below).

**States & schedule.** Four states from the visitor's local hour: **dawn** 5:00–7:59, **day** 8:00–16:59, **dusk** 17:00–19:59, **night** 20:00–4:59. Dusk is the identity state — the existing art *is* dusk, so it ships untouched. State is computed client-side on mount and re-checked every minute plus on tab-visibility change; a state change crossfades over 1.5 s (instant under reduced motion). A `?light=night` query param overrides the clock — it's the dev/preview affordance and a shareable easter egg.

**Build-time pipeline (no runtime shaders).** New script `scripts/generate-lighting.mjs` reads every room-view layer (both backgrounds, monitor ×4, saitama ×14, poster ×5, bonsai ×5, coffee ×6, speakers ×2, side table, clock, steam, notes) and applies a per-state colour grade defined once in the script: per-channel tint, brightness, and saturation curves (e.g. night ≈ tint toward blue, brightness ×0.65, saturation ×0.8; dawn ≈ warm pink lift). Two hard rules: pixels at or near pure black stay pure black (the 1 px outlines are the style), and the UI palette (tooltips, toasts) is never graded. Output lands in `public/room/lighting/<state>/…` — dusk maps to the original files, so no duplicates. Roughly 40 small generated PNGs per state.

**The window is the exception.** The glass shows a painted dusk city — no palette math turns that into noon. The pipeline therefore accepts optional hand-drawn override patches (`assets/pixel-art/background/window-<state>.png`, same full-canvas convention as the table/clock art) and composites them onto the graded background at generation time. Until the owner draws them, the generator falls back to the graded original — acceptable, just less convincing for `day`.

**Runtime.** A small `src/lib/room/lighting.ts` module: `useLightingState()` hook plus `lightingSrc(path, state)` that rewrites `/room/x.png` → `/room/lighting/night/x.png` (identity for dusk). `Room.tsx` provides the state via context; the background stack generalizes the existing lamp crossfade (the lamp axis stays independent — lamp-off backgrounds get graded too, so it's 4 lighting × 2 lamp background variants, all generated). Sprites consume the mapped src through `AnimatedSprite`/`Monitor` unchanged except for the src mapping. Desk close-up view keeps its current art in v1 — a deliberate boundary.

**Ripple: the clock un-freezes.** The clock plan's static 21:07 becomes live visitor-local time (30 s interval, same pattern as the wall bubble), keeping the green digits, skew, and 12/24 toggle. The clock and the room's light then always agree. The wall-bubble clock at (620,100) becomes redundant enough to consider retiring — open option, default keep.

**Perf/LCP.** Only the active state's background loads with `fetchpriority="high"`; other variants aren't fetched until a transition needs them. No new user-facing strings, so no dictionary work.

---

# APPROVED DESIGN — Pixel OS v1 (homescreen, Paint, Minesweeper)

> Approved by the owner on 7 July 2026 with amendments: launcher shows ONLY
> Home, Paint, Minesweeper (plus future links), and Minesweeper is room-only
> (no `/games` page). Detailed plan follows later in this file.

**Homescreen.** The desk desktop keeps its bones (top strip with clock + back button, icon grid) but the grid becomes a configurable launcher of three icons — **Home** (opens `/home` in the in-monitor browser), **Paint** (room-only app), **Minesweeper** (room-only app) — with a structural slot for future external links (friends' sites), which open in a new tab with `rel="noopener noreferrer"` and an external glyph. The previous six site shortcuts are removed; site sections are reached through the in-monitor browser via Home. Hovering or focusing an icon shows a pixel speech-bubble tooltip (dictionary-driven, shown on focus for keyboard users).

**Minesweeper — room-only app.** New `ScreenMode 'minesweeper'` rendering `DeskMinesweeper.tsx` in the 536×308 screen. Game logic is pure and testable in `src/lib/games/minesweeper-engine.ts` (board generation with first-click safety, flood reveal, flagging, win/loss detection). 9×9 grid, 10 mines; click reveals, right-click or long-press flags, roving-tabindex keyboard play (arrows + Enter/Space reveal, F flags). Timer with best time in the existing `games/storage.ts` localStorage pattern. Colour is allowed (room page). No `/games` page, hub card, or sitemap entry.

**Paint — room-only app.** `ScreenMode 'paint'` rendering `DeskPaint.tsx`: fixed logical pixel canvas (107×56 cells at 5 px) drawn via pointer events; tools: pencil, eraser, flood fill; swatch row of the room's warm palette. The drawing persists to localStorage (`room-paint-v1`); a Download button exports the PNG. Escape returns to the desktop, extending the ladder to app → desktop → room.

**Mobile.** Below 700 px there is no in-monitor screen, so Paint and Minesweeper icons are hidden in v1; Home still navigates full-page.

**Structure.** `DeskView.tsx` (369 lines, about to grow) extracts the desktop screen into `DeskDesktop.tsx`; the two apps and the desktop share a small `ScreenStrip.tsx` (clock + action buttons). `DeskView` remains the single owner of screen-mode state and the Escape ladder.

**i18n & a11y.** Every icon label, tooltip, and app string goes in BOTH dictionaries in the same commit (Constraint 5). Icons remain real anchors/buttons in the existing `<nav aria-label>`; the Paint canvas gets `role="img"` with a label and real-button tools; Minesweeper cells are real buttons with per-cell labels.

---

# Lighting Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The room's lighting follows the visitor's local time (dawn/day/dusk/night) via build-time colour-graded sprite variants and a runtime crossfade, per the approved lighting design above.

**Architecture:** `scripts/generate-lighting.mjs` grades every room-view sprite in `public/room/` into `public/room/lighting/<state>/` (dusk = the untouched originals). A `src/lib/room/lighting.tsx` module supplies the clock hook, a context provider, and `lightingSrc()` path mapping. `Room.tsx` computes the state, preloads the target backgrounds, crossfades the background stack over 1.5 s, and provides the state to `AnimatedSprite`, `Monitor`, and `RoomSpeakers`, which map their frame srcs through context.

**Tech Stack:** sharp (build-time), React context + hooks, CSS keyframes. No runtime WebGL.

## Global Constraints

- **PREREQUISITE:** Execute AFTER the clock plan at the top of this file (the side-table sprites must exist in `public/room/` and are graded/mapped here).
- Emissive things are NEVER graded: the monitor boot-screen frames (`monitor-loading-*`), the music notes (`note-*`), the clock's green digits, and the UI palette (tooltips/toasts/bubbles).
- Dusk is the identity state: it always resolves to the original `/room/*.png` files; the generator never duplicates them.
- Pixels with all channels ≤ 12 are outline ink — the grade must leave them untouched.
- Desk close-up view keeps current art (deliberate v1 boundary; it defaults to dusk via the context default).
- SSR and first client render are always dusk; the real state applies in an effect (hydration safety).
- `?light=dawn|day|dusk|night` query override beats the clock.
- Reduced motion: state changes apply instantly (no crossfade); lighting still changes.
- Generated PNGs under `public/room/lighting/` are committed (Vercel serves `public/` from git).
- Commit after every task.

---

### Task L1: Generator script

**Files:**
- Create: `scripts/generate-lighting.mjs`
- Modify: `package.json` (add script `"lighting": "node scripts/generate-lighting.mjs"`)
- Output (generated, committed): `public/room/lighting/{dawn,day,night}/*.png` (41 files each)

**Interfaces:**
- Produces: graded variants named identically to their originals under `public/room/lighting/<state>/`. Task L2's `lightingSrc()` relies on this exact layout.

- [ ] **Step 1: Write the script**

```js
// scripts/generate-lighting.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const roomDir = join(__dirname, '..', 'public', 'room')
const assetsBgDir = join(__dirname, '..', 'assets', 'pixel-art', 'background')

// Per-state grades. Dusk is the identity (the source art) and is not generated.
// tint = per-channel multiplier, bright = global multiplier, sat = saturation.
// Tuned visually in Task L5 — these are the starting values.
const GRADES = {
  dawn:  { tint: [1.08, 0.97, 0.92], bright: 0.95, sat: 0.95 },
  day:   { tint: [1.04, 1.02, 0.98], bright: 1.18, sat: 1.0 },
  night: { tint: [0.62, 0.68, 1.0],  bright: 0.62, sat: 0.78 },
}

// Pixels at or below this on every channel are outline ink — never graded.
const INK_MAX = 12

// Room-view layers to grade. Desk close-up art, the monitor boot screen and
// the music notes (emissive) are deliberately excluded.
const range = (name, n) => Array.from({ length: n }, (_, i) => `${name}-${i + 1}.png`)
const FILES = [
  'background.png',
  'background-lamp-off.png',
  ...range('monitor', 4),
  ...range('saitama', 14),
  ...range('poster', 5),
  ...range('bonsai', 5),
  'room-speakers.png',
  'room-speakers-lamp-off.png',
  ...range('coffee', 6),
  'coffee-steam.png',
  'side-table.png',
  'side-table-clock.png',
]

function gradePixel(data, i, { tint, bright, sat }) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  if (r <= INK_MAX && g <= INK_MAX && b <= INK_MAX) return
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  data[i]     = clamp((lum + (r - lum) * sat) * tint[0] * bright)
  data[i + 1] = clamp((lum + (g - lum) * sat) * tint[1] * bright)
  data[i + 2] = clamp((lum + (b - lum) * sat) * tint[2] * bright)
}

async function gradeFile(file, state, grade) {
  const { data, info } = await sharp(join(roomDir, file))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 0) continue
    gradePixel(data, i, grade)
  }
  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  // Optional hand-drawn window override, composited onto graded backgrounds
  if (file === 'background.png' || file === 'background-lamp-off.png') {
    const override = join(assetsBgDir, `window-${state}.png`)
    if (existsSync(override)) {
      img = sharp(await img.png().toBuffer()).composite([{ input: override }])
    }
  }
  const outDir = join(roomDir, 'lighting', state)
  await mkdir(outDir, { recursive: true })
  await img.png().toFile(join(outDir, file))
}

async function main() {
  for (const [state, grade] of Object.entries(GRADES)) {
    for (const file of FILES) await gradeFile(file, state, grade)
    console.log(`${state}: ${FILES.length} sprites -> public/room/lighting/${state}/`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Add the npm script** — in `package.json` `scripts`, after `"type-check"`:

```json
    "lighting": "node scripts/generate-lighting.mjs"
```

- [ ] **Step 3: Run and verify**

Run: `npm run lighting`
Expected output (exactly):

```
dawn: 41 sprites -> public/room/lighting/dawn/
day: 41 sprites -> public/room/lighting/day/
night: 41 sprites -> public/room/lighting/night/
```

Then `ls public/room/lighting/night` → 41 files matching the `FILES` list.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-lighting.mjs package.json public/room/lighting
git commit -m "feat(room): build-time lighting variant generator (dawn/day/night)"
```

---

### Task L2: Runtime lighting module + fade keyframes

**Files:**
- Create: `src/lib/room/lighting.tsx`
- Modify: `src/app/globals.css` (next to the existing room keyframes)

**Interfaces:**
- Produces (consumed by Tasks L3–L4 by these exact names): `type LightingState = 'dawn' | 'day' | 'dusk' | 'night'`, `LIGHTING_STATES`, `lightingStateForHour(hour: number): LightingState`, `useLightingClock(): LightingState`, `LightingProvider({ state, children })`, `useLighting(): LightingState` (defaults to `'dusk'` outside a provider), `lightingSrc(path: string, state: LightingState): string`.

- [ ] **Step 1: Write the module**

```tsx
// src/lib/room/lighting.tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type LightingState = 'dawn' | 'day' | 'dusk' | 'night'

export const LIGHTING_STATES: LightingState[] = ['dawn', 'day', 'dusk', 'night']

/** dawn 05:00–07:59 · day 08:00–16:59 · dusk 17:00–19:59 · night 20:00–04:59 */
export function lightingStateForHour(hour: number): LightingState {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

function overrideFromQuery(): LightingState | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('light')
  return (LIGHTING_STATES as string[]).includes(q ?? '') ? (q as LightingState) : null
}

/**
 * The visitor-local lighting clock. SSR and the first client render always
 * return 'dusk' (the identity art) so hydration never mismatches; the real
 * state applies in an effect, then refreshes every minute and when the tab
 * becomes visible. A ?light=<state> query param overrides the clock.
 */
export function useLightingClock(): LightingState {
  const [state, setState] = useState<LightingState>('dusk')
  useEffect(() => {
    const compute = () =>
      setState(overrideFromQuery() ?? lightingStateForHour(new Date().getHours()))
    compute()
    const id = setInterval(compute, 60_000)
    const onVis = () => { if (!document.hidden) compute() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return state
}

const LightingContext = createContext<LightingState>('dusk')

export function LightingProvider({ state, children }: { state: LightingState; children: ReactNode }) {
  return <LightingContext.Provider value={state}>{children}</LightingContext.Provider>
}

/** Current lighting state; 'dusk' outside a provider (e.g. the desk view in v1). */
export function useLighting(): LightingState {
  return useContext(LightingContext)
}

/** '/room/x.png' -> '/room/lighting/<state>/x.png'; identity for dusk. */
export function lightingSrc(path: string, state: LightingState): string {
  if (state === 'dusk') return path
  return path.replace(/^\/room\//, `/room/lighting/${state}/`)
}
```

- [ ] **Step 2: Add the fade keyframes** to `src/app/globals.css` next to `clock-blink`:

```css
/* Lighting-state crossfade: the outgoing background pair fades out over 1.5s */
@keyframes lighting-fade {
  from { opacity: 1; }
  to { opacity: 0; }
}
.lighting-fade {
  animation: lighting-fade 1.5s ease forwards;
}
```

- [ ] **Step 3: Verify** — `npm run type-check` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/room/lighting.tsx src/app/globals.css
git commit -m "feat(room): lighting state module (clock hook, context, src mapping)"
```

---

### Task L3: Integrate into Room.tsx and the sprite components

**Files:**
- Modify: `src/components/room/Room.tsx`
- Modify: `src/components/room/AnimatedSprite.tsx`
- Modify: `src/components/room/Monitor.tsx`
- Modify: `src/components/room/RoomSpeakers.tsx`

**Interfaces:**
- Consumes: everything from Task L2. Components self-map through `useLighting()`, so their public props DO NOT change.

- [ ] **Step 1: AnimatedSprite maps its frame src** — add the import:

```tsx
import { useLighting, lightingSrc } from '@/lib/room/lighting'
```

add `const lighting = useLighting()` in the component body, and change the `motion.img` src to:

```tsx
          src={lightingSrc(frames[frameIndex], lighting)}
```

- [ ] **Step 2: Monitor maps its hover frames (NOT the boot screen)** — same import + `const lighting = useLighting()`; change only:

```tsx
  const frameSrc = lightingSrc(frames[Math.min(tick, frames.length - 1)], lighting)
```

(`loadingSrc` stays unmapped — the boot screen is emissive.)

- [ ] **Step 3: RoomSpeakers maps both art layers** — same import + `const lighting = useLighting()`; the two art `<img>` srcs become:

```tsx
          src={lightingSrc('/room/room-speakers-lamp-off.png', lighting)}
```
```tsx
          src={lightingSrc('/room/room-speakers.png', lighting)}
```

- [ ] **Step 4: Room.tsx — clock, preload, crossfade state.** Add imports:

```tsx
import { useLightingClock, LightingProvider, lightingSrc, type LightingState } from '@/lib/room/lighting'
```

Add after the existing `useState` block:

```tsx
  // Lighting: target follows the visitor's local clock; `light` is what is
  // rendered; `prevLight` keeps the outgoing background pair mounted during
  // the 1.5s crossfade. The swap waits for the target backgrounds to load.
  const targetLight = useLightingClock()
  const [light, setLight] = useState<LightingState>('dusk')
  const [prevLight, setPrevLight] = useState<LightingState | null>(null)
  useEffect(() => {
    if (targetLight === light) return
    if (reduce) { setLight(targetLight); return }
    let cancelled = false
    const srcs = [
      lightingSrc('/room/background.png', targetLight),
      lightingSrc('/room/background-lamp-off.png', targetLight),
    ]
    Promise.all(srcs.map((s) => new Promise<void>((res) => {
      const img = new window.Image()
      img.onload = () => res(); img.onerror = () => res(); img.src = s
    }))).then(() => {
      if (cancelled) return
      setPrevLight(light)
      setLight(targetLight)
      setTimeout(() => setPrevLight(null), 1500)
    })
    return () => { cancelled = true }
  }, [targetLight, light, reduce])
```

- [ ] **Step 5: Room.tsx — background stack + provider.** The two background `<img>`s change src to the mapped versions:

```tsx
            src={lightingSrc('/room/background-lamp-off.png', light)}
```
```tsx
            src={lightingSrc('/room/background.png', light)}
```

Immediately AFTER the lamp-on background `<img>` (and before the side-table `<img>`), insert the outgoing overlay:

```tsx
          {/* Outgoing lighting state, fading out over the new one */}
          {prevLight && (
            <div className="absolute inset-0 lighting-fade pointer-events-none" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightingSrc('/room/background-lamp-off.png', prevLight)} alt="" draggable={false}
                className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightingSrc('/room/background.png', prevLight)} alt="" draggable={false}
                className="absolute inset-0 w-full h-full"
                style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0 }} />
            </div>
          )}
```

Map the side-table `<img>` src and the steam wisp `<img>` src through `lightingSrc('/room/side-table.png', light)` / `lightingSrc('/room/coffee-steam.png', light)` the same way. The `SideTableClock` `frame` prop becomes `lightingSrc(clockObj.frames[0], light)`. Finally wrap the stage content in the provider so the sprite components see the state:

```tsx
      <nav aria-label={t.room.navLabel}>
        <LightingProvider state={light}>
          <RoomStage
            scale={scale}
            zoomScale={view === 'zooming' && !reduce ? 3.2 : 1}
            zoomOriginX={screenCenterX}
            zoomOriginY={screenCenterY}
          >
            {/* existing children unchanged */}
          </RoomStage>
        </LightingProvider>
      </nav>
```

- [ ] **Step 6: Verify** — `npm run type-check && npm run lint && npm run build` → all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/room/Room.tsx src/components/room/AnimatedSprite.tsx src/components/room/Monitor.tsx src/components/room/RoomSpeakers.tsx
git commit -m "feat(room): visitor-local lighting states with background crossfade"
```

---

### Task L4: Un-freeze the side-table clock

**Files:**
- Modify: `src/components/room/SideTableClock.tsx` (if the clock plan has shipped) — otherwise apply this same replacement to the code block in clock-plan Task 5 above and note it there.

- [ ] **Step 1: Replace the static time with live visitor-local time.** Delete the `TIME_24` / `TIME_12` / `TIME_12_SUFFIX` constants, their doc comment, and the `const [hh, mm] = ...` line; add `useEffect` to the react import; insert in the component body:

```tsx
  // Live visitor-local time — agrees with the room's lighting state.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const h24 = now.getHours()
  const mm = String(now.getMinutes()).padStart(2, '0')
  const hh = is24h ? String(h24).padStart(2, '0') : String(((h24 + 11) % 12) + 1)
  const suffix = h24 < 12 ? 'AM' : 'PM'
```

and the digits JSX suffix span becomes:

```tsx
          {!is24h && <span style={{ fontSize: '6px', marginLeft: '2px' }}>{suffix}</span>}
```

- [ ] **Step 2: Verify** — `npm run type-check` → PASS. In the browser the clock shows the actual time (updates within 30 s of a minute change); the 12/24 toggle still works and persists.

- [ ] **Step 3: Commit**

```bash
git add src/components/room/SideTableClock.tsx
git commit -m "feat(room): clock shows live visitor-local time"
```

---

### Task L5: Visual tuning and verification

**Files:**
- Possibly modify: `GRADES` in `scripts/generate-lighting.mjs`, then `npm run lighting` to regenerate.

- [ ] **Step 1: Walk the checklist** with `npm run dev`:

1. `/?light=night` — room reads as night: dimmer, blue-shifted; outlines still pure black; tooltip/toast colours unchanged; clock digits still bright green; boot screen and music notes unchanged.
2. `/?light=day` and `/?light=dawn` — same checks; day is brighter without white clipping (check the pillows and lamp shade).
3. No `?light` param — state matches your local hour; wall bubble, side-table clock, and lighting all agree.
4. Lamp toggle works in every state (graded lamp-off variants crossfade exactly as before).
5. Hover monitor/posters/bonsai/coffee under `?light=night` — animation frames stay graded (no bright pops mid-animation; the first hover may stream variant frames once — acceptable).
6. Trigger a real state change (change system clock or wait for a boundary): 1.5 s background crossfade, sprites swap at fade start, no flash of unloaded art.
7. Reduced motion: state changes apply instantly; everything still functional.
8. Adjust `GRADES`, `npm run lighting`, re-check — repeat until each state looks right.

- [ ] **Step 2: Final checks and commit**

```bash
npm run type-check && npm run lint && npm run build
git add scripts/generate-lighting.mjs public/room/lighting
git commit -m "feat(room): tune lighting grades"
```

---

### Task L6: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Current State paragraph: prepend `Visitor-local lighting states (dawn/day/dusk/night, build-time graded variants via scripts/generate-lighting.mjs + npm run lighting, ?light= override, 1.5 s background crossfade),`. Sprite pipeline section: add `Lighting variants: public/room/lighting/<state>/ generated from the public/room originals (dusk = originals); regenerate with npm run lighting after ANY sprite re-extraction.` Room objects section: note that AnimatedSprite/Monitor/RoomSpeakers map srcs through LightingProvider. Session history: add a v8 bullet for the lighting engine + live clock.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record lighting engine in CLAUDE.md"
```

---

# Pixel OS v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The desk screen becomes a launcher of three tooltip'd icons — Home (in-monitor browser), Paint, and Minesweeper (both room-only in-screen apps) — per the approved Pixel OS v1 design above.

**Architecture:** `ScreenMode` grows to `'desktop' | 'browser' | 'paint' | 'minesweeper'`. The desktop screen extracts from `DeskView.tsx` into `DeskDesktop.tsx`; the desktop and both apps share `ScreenStrip.tsx`. Minesweeper logic is pure in `src/lib/games/minesweeper-engine.ts`; both apps are components rendered in the 536×308 screen rect. `DeskView` stays the single owner of screen-mode state and the Escape ladder.

**Tech Stack:** React client components, canvas 2D (Paint), existing games localStorage helpers, i18n dictionaries.

## Global Constraints

- Independent of the clock and lighting plans — can be executed before or after them.
- The launcher shows ONLY Home, Paint, Minesweeper. Future external links are `kind: 'external'` registry entries (open new tab, `noopener,noreferrer`).
- Below 700 px (`isMobile` in DeskView) app icons are hidden; Home still navigates full-page.
- Every new string goes in BOTH dictionaries in the same commit (Critical Constraint 5).
- The old desk shortcut keys (`desk.games`, `desk.projects`, `desk.tutoring`, `desk.contact`, `desk.legal`) STAY in the dictionaries (the `Dictionary` type derives from `en.ts`) — they just stop being read by the desk.
- Escape ladder: paint/minesweeper/browser → desktop → room.
- Colour is allowed in both apps (they render on `/`, the room's exemption).
- Commit after every task.

---

### Task OS1: Minesweeper engine + best-time storage helper

**Files:**
- Create: `src/lib/games/minesweeper-engine.ts`
- Modify: `src/lib/games/storage.ts`

**Interfaces:**
- Produces: `createBoard(rows, cols, mines): Board`, `reveal(board, r, c, rng?): Board`, `toggleFlag(board, r, c): Board`, `flagCount(board): number`, types `Board`, `Cell`, `CellState`, `GameStatus` — consumed by Task OS6. Also `setBestIfLower(key, value): boolean` and `BEST_KEYS.minesweeper` in storage.ts.

- [ ] **Step 1: Write the engine** (pure, immutable — same philosophy as `breakout-engine.ts`)

```ts
// src/lib/games/minesweeper-engine.ts
/**
 * Pure minesweeper logic. No DOM, no React — every function returns a new
 * Board. Mines are placed on the FIRST reveal, never on or adjacent to it.
 */

export type CellState = 'hidden' | 'revealed' | 'flagged'
export type GameStatus = 'playing' | 'won' | 'lost'
export interface Cell { mine: boolean; adjacent: number; state: CellState }
export interface Board {
  rows: number
  cols: number
  mines: number
  minesPlaced: boolean
  status: GameStatus
  cells: Cell[]
}

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const

const idx = (b: Board, r: number, c: number) => r * b.cols + c
const inBounds = (b: Board, r: number, c: number) => r >= 0 && r < b.rows && c >= 0 && c < b.cols

export function createBoard(rows: number, cols: number, mines: number): Board {
  return {
    rows,
    cols,
    mines,
    minesPlaced: false,
    status: 'playing',
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, adjacent: 0, state: 'hidden' as CellState })),
  }
}

function placeMines(board: Board, safeR: number, safeC: number, rng: () => number): Board {
  const safe = new Set<number>([idx(board, safeR, safeC)])
  for (const [dr, dc] of DIRS) {
    if (inBounds(board, safeR + dr, safeC + dc)) safe.add(idx(board, safeR + dr, safeC + dc))
  }
  const candidates = board.cells.map((_, i) => i).filter((i) => !safe.has(i))
  // Partial Fisher–Yates: the first `mines` entries become mines
  for (let i = 0; i < board.mines; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const mineSet = new Set(candidates.slice(0, board.mines))
  const cells = board.cells.map((cell, i) => ({ ...cell, mine: mineSet.has(i) }))
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const i = r * board.cols + c
      if (cells[i].mine) continue
      let n = 0
      for (const [dr, dc] of DIRS) {
        if (inBounds(board, r + dr, c + dc) && cells[(r + dr) * board.cols + (c + dc)].mine) n++
      }
      cells[i] = { ...cells[i], adjacent: n }
    }
  }
  return { ...board, minesPlaced: true, cells }
}

export function reveal(board: Board, r: number, c: number, rng: () => number = Math.random): Board {
  if (board.status !== 'playing' || !inBounds(board, r, c)) return board
  const b = board.minesPlaced ? board : placeMines(board, r, c, rng)
  const start = idx(b, r, c)
  if (b.cells[start].state !== 'hidden') return b
  const cells = b.cells.slice()
  if (cells[start].mine) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].mine) cells[i] = { ...cells[i], state: 'revealed' }
    }
    return { ...b, cells, status: 'lost' }
  }
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()!
    if (cells[i].state !== 'hidden') continue
    cells[i] = { ...cells[i], state: 'revealed' }
    if (cells[i].adjacent === 0) {
      const cr = Math.floor(i / b.cols)
      const cc = i % b.cols
      for (const [dr, dc] of DIRS) {
        if (inBounds(b, cr + dr, cc + dc)) {
          const ni = (cr + dr) * b.cols + (cc + dc)
          if (!cells[ni].mine && cells[ni].state === 'hidden') stack.push(ni)
        }
      }
    }
  }
  const won = cells.every((cell) => cell.mine || cell.state === 'revealed')
  return { ...b, cells, status: won ? 'won' : 'playing' }
}

export function toggleFlag(board: Board, r: number, c: number): Board {
  if (board.status !== 'playing' || !inBounds(board, r, c)) return board
  const i = idx(board, r, c)
  const cell = board.cells[i]
  if (cell.state === 'revealed') return board
  const cells = board.cells.slice()
  cells[i] = { ...cell, state: cell.state === 'flagged' ? 'hidden' : 'flagged' }
  return { ...board, cells }
}

export function flagCount(board: Board): number {
  return board.cells.reduce((n, c) => n + (c.state === 'flagged' ? 1 : 0), 0)
}
```

- [ ] **Step 2: Storage helper.** In `src/lib/games/storage.ts`, add `minesweeper: 'minesweeper-best'` to `BEST_KEYS`, and after `setBestIfHigher` add:

```ts
/** Write value only if it is LOWER than the stored best (for times). 0/absent means no best yet. */
export function setBestIfLower(key: string, value: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    const current = getBest(key)
    if (value > 0 && (current === 0 || value < current)) {
      window.localStorage.setItem(vk(key), String(value))
      return true
    }
    return false
  } catch {
    return false
  }
}
```

- [ ] **Step 3: Verify** — `npm run type-check` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/games/minesweeper-engine.ts src/lib/games/storage.ts
git commit -m "feat(games): pure minesweeper engine and best-time storage helper"
```

---

### Task OS2: Dictionary strings (EN + FR)

**Files:**
- Modify: `src/lib/i18n/dictionaries/en.ts` (`desk` block)
- Modify: `src/lib/i18n/dictionaries/fr.ts` (`desk` block)

**Interfaces:**
- Produces: `desk.paint`, `desk.minesweeper`, `desk.homeTip`, `desk.paintTip`, `desk.minesweeperTip`, `desk.paintApp.{pencil,eraser,fill,clear,download,color,canvas}`, `desk.mines.{board,cell,minesLeft,time,best,reset,won,lost}` — consumed by Tasks OS5–OS7.

- [ ] **Step 1: English** — inside the `desk` block of `en.ts` add:

```ts
    paint: 'Paint',
    minesweeper: 'Minesweeper',
    homeTip: 'Browse the site inside the monitor',
    paintTip: 'Doodle on a pixel canvas — it saves itself',
    minesweeperTip: 'Classic mines, room edition',
    paintApp: {
      pencil: 'Pencil',
      eraser: 'Eraser',
      fill: 'Fill',
      clear: 'Clear canvas',
      download: 'Download PNG',
      color: 'Colour {n}',
      canvas: 'Pixel drawing canvas',
    },
    mines: {
      board: 'Minesweeper board',
      cell: 'Cell {r}, {c}',
      minesLeft: 'Mines: {n}',
      time: 'Time: {s}s',
      best: 'Best: {s}s',
      reset: 'New game',
      won: 'Cleared!',
      lost: 'Boom.',
    },
```

- [ ] **Step 2: Run `npm run type-check`** — expected FAIL (fr.ts missing the new keys). That's the bilingual guard rail working.

- [ ] **Step 3: French** — inside the `desk` block of `fr.ts` add:

```ts
    paint: 'Dessin',
    minesweeper: 'Démineur',
    homeTip: 'Parcourir le site dans l\'écran',
    paintTip: 'Dessinez sur une toile pixel — sauvegarde automatique',
    minesweeperTip: 'Le démineur classique, version chambre',
    paintApp: {
      pencil: 'Crayon',
      eraser: 'Gomme',
      fill: 'Remplir',
      clear: 'Effacer la toile',
      download: 'Télécharger le PNG',
      color: 'Couleur {n}',
      canvas: 'Toile de dessin pixel',
    },
    mines: {
      board: 'Grille du démineur',
      cell: 'Case {r}, {c}',
      minesLeft: 'Mines : {n}',
      time: 'Temps : {s} s',
      best: 'Record : {s} s',
      reset: 'Nouvelle partie',
      won: 'Gagné !',
      lost: 'Boum.',
    },
```

- [ ] **Step 4: `npm run type-check`** → PASS. Commit:

```bash
git add src/lib/i18n/dictionaries/en.ts src/lib/i18n/dictionaries/fr.ts
git commit -m "feat(room): pixel OS launcher and app strings in EN and FR"
```

---

### Task OS3: DeskIcon — tooltips, button mode, two new icons

**Files:**
- Modify: `src/components/room/DeskIcon.tsx`

**Interfaces:**
- Produces: `DeskIcon` props become `{ label: string; tooltip?: string; href?: string; icon: ReactNode; onClick }` — no `href` renders a `<button>` (apps), `href` renders `<a>` (site links). New exports `ICON_PAINT`, `ICON_MINESWEEPER`. Existing `ICON_*` exports unchanged.

- [ ] **Step 1: Rewrite the component** (tooltip bubble + anchor/button split; the label/icon markup is unchanged):

```tsx
import { useId, type ReactNode } from 'react'

interface DeskIconProps {
  label: string
  /** Speech-bubble hint shown on hover/focus */
  tooltip?: string
  /** Site links render an <a>; apps omit href and render a <button> */
  href?: string
  icon: ReactNode
  onClick: (e: React.MouseEvent) => void
}

export function DeskIcon({ label, tooltip, href, icon, onClick }: DeskIconProps) {
  const tipId = useId()
  const className =
    'relative flex flex-col items-center gap-1 group outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(0,0,0,0.4)] focus-visible:outline-offset-1'
  const style = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as React.CSSProperties
  const inner = (
    <>
      {tooltip && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 border whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 z-10"
          style={{ backgroundColor: '#3d2e1e', borderColor: '#5a4430', borderRadius: '2px', fontSize: '9px', color: '#e8d5b0' }}
        >
          {tooltip}
        </span>
      )}
      <div className="w-10 h-10 flex items-center justify-center group-hover:-translate-y-px transition-transform duration-100">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="none" shapeRendering="crispEdges" aria-hidden="true">
          {icon}
        </svg>
      </div>
      <span
        className="text-[9px] text-[#2a2520] text-center leading-tight max-w-[56px]"
        style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', textShadow: 'none' }}
      >
        {label}
      </span>
    </>
  )
  return href ? (
    <a href={href} onClick={onClick} className={className} aria-label={label} aria-describedby={tooltip ? tipId : undefined} style={style}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className} aria-label={label} aria-describedby={tooltip ? tipId : undefined} style={style}>
      {inner}
    </button>
  )
}
```

- [ ] **Step 2: Add the two icons** after `ICON_LEGAL` (same 16×16 rect style and palette):

```tsx
export const ICON_PAINT = (
  <>
    {/* Brush handle + ferrule */}
    <rect x="10" y="1" width="2" height="5" fill="#5a4a3a" />
    <rect x="9" y="6" width="4" height="2" fill="#3a3028" />
    <rect x="10" y="8" width="2" height="2" fill="#e8d5b0" />
    {/* Paint blob */}
    <rect x="3" y="10" width="8" height="3" fill="#8a4a3a" />
    <rect x="2" y="11" width="1" height="2" fill="#8a4a3a" />
    <rect x="11" y="11" width="1" height="1" fill="#8a4a3a" />
    <rect x="5" y="9" width="3" height="1" fill="#8a4a3a" />
    <rect x="4" y="13" width="5" height="1" fill="#6a3a2a" />
  </>
)

export const ICON_MINESWEEPER = (
  <>
    {/* Mine body */}
    <rect x="5" y="5" width="6" height="6" fill="#3a3028" />
    <rect x="6" y="4" width="4" height="8" fill="#3a3028" />
    <rect x="4" y="6" width="8" height="4" fill="#3a3028" />
    {/* Spikes */}
    <rect x="7" y="1" width="2" height="2" fill="#5a4a3a" />
    <rect x="7" y="13" width="2" height="2" fill="#5a4a3a" />
    <rect x="1" y="7" width="2" height="2" fill="#5a4a3a" />
    <rect x="13" y="7" width="2" height="2" fill="#5a4a3a" />
    {/* Glint */}
    <rect x="6" y="6" width="2" height="2" fill="#faf8f5" />
  </>
)
```

- [ ] **Step 3: Verify** — `npm run type-check && npm run lint` → PASS (existing DeskView call sites still pass `href`, so nothing breaks).

- [ ] **Step 4: Commit**

```bash
git add src/components/room/DeskIcon.tsx
git commit -m "feat(room): desk icon tooltips, button mode, paint and minesweeper icons"
```

---

### Task OS4: ScreenStrip + DeskDesktop extraction

**Files:**
- Create: `src/components/room/ScreenStrip.tsx`
- Create: `src/components/room/DeskDesktop.tsx`

**Interfaces:**
- Produces: `ScreenStrip({ time, children })`, `StripButton({ onClick, children, ariaLabel?, pressed? })`, `DeskDesktop(props: DeskDesktopProps)` and `interface DesktopShortcut { id: string; label: string; tooltip: string; kind: 'site' | 'app' | 'external'; target: string; icon: React.ReactNode }` — consumed by Tasks OS5–OS7.

- [ ] **Step 1: ScreenStrip**

```tsx
// src/components/room/ScreenStrip.tsx
import type { ReactNode } from 'react'

const PIXEL_FONT = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

/** The 28px status strip across the top of every desk screen mode. */
export function ScreenStrip({ time, children }: { time: string; children?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-3 h-7 border-b flex-shrink-0"
      style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px', color: '#3a3028', ...PIXEL_FONT }}
    >
      <span>{time}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function StripButton({
  onClick,
  children,
  ariaLabel,
  pressed,
}: {
  onClick: (e: React.MouseEvent) => void
  children: ReactNode
  ariaLabel?: string
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
      style={{ textDecoration: pressed ? 'underline' : 'none', ...PIXEL_FONT }}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: DeskDesktop** — the desktop-mode JSX moves here from `DeskView.tsx` (strip + icon grid + screensaver, byte-for-byte except the strip uses `ScreenStrip`):

```tsx
// src/components/room/DeskDesktop.tsx
'use client'

import { DeskIcon } from './DeskIcon'
import { ScreenStrip, StripButton } from './ScreenStrip'

export interface DesktopShortcut {
  id: string
  label: string
  tooltip: string
  kind: 'site' | 'app' | 'external'
  target: string
  icon: React.ReactNode
}

interface DeskDesktopProps {
  time: string
  backLabel: string
  screenLabel: string
  shortcuts: DesktopShortcut[]
  screensaver: boolean
  reduce: boolean | null
  screenW: number
  screenH: number
  onBack: (e: React.MouseEvent) => void
  onShortcutClick: (e: React.MouseEvent, s: DesktopShortcut) => void
}

export function DeskDesktop({
  time,
  backLabel,
  screenLabel,
  shortcuts,
  screensaver,
  reduce,
  screenW,
  screenH,
  onBack,
  onShortcutClick,
}: DeskDesktopProps) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={onBack} ariaLabel={backLabel}>← {backLabel}</StripButton>
      </ScreenStrip>
      <nav aria-label={screenLabel} className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-x-8 gap-y-5 px-4">
          {shortcuts.map((s) => (
            <DeskIcon
              key={s.id}
              label={s.label}
              tooltip={s.tooltip}
              href={s.kind === 'app' ? undefined : s.target}
              icon={s.icon}
              onClick={(e) => onShortcutClick(e, s)}
            />
          ))}
        </div>
      </nav>

      {/* Idle screensaver overlay (moved verbatim from DeskView) */}
      {screensaver && !reduce && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#faf8f5' }} aria-hidden>
          <div
            className="relative"
            style={{
              width: 40,
              height: 20,
              animation: 'screensaver-drift 10s linear infinite',
              '--sw': screenW + 'px',
              '--sh': screenH + 'px',
            } as React.CSSProperties}
          >
            <div
              style={{
                width: 40,
                height: 20,
                backgroundColor: '#3a3028',
                borderRadius: '2px',
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                fontSize: '8px',
                color: '#faf8f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              AH
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify** — `npm run type-check && npm run lint` → PASS (files are not imported yet; that's Task OS7).

- [ ] **Step 4: Commit**

```bash
git add src/components/room/ScreenStrip.tsx src/components/room/DeskDesktop.tsx
git commit -m "feat(room): extract ScreenStrip and DeskDesktop launcher components"
```

---

### Task OS5: DeskPaint

**Files:**
- Create: `src/components/room/DeskPaint.tsx`

**Interfaces:**
- Consumes: `ScreenStrip`/`StripButton` (OS4), `desk.paintApp` labels (OS2).
- Produces: `DeskPaint({ time, backLabel, desktopLabel, labels: PaintLabels, onBack, onDesktop })` and `export interface PaintLabels` — consumed by Task OS7.

- [ ] **Step 1: Write the component** (107×50 logical cells at 5 px → 535×250 canvas; strip 28 px + toolbar 24 px + canvas fits the 536×308 screen):

```tsx
// src/components/room/DeskPaint.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'

const COLS = 107
const ROWS = 50
const CELL = 5
const KEY = 'room-paint-v1'
// Room-adjacent palette; index 1 (paper) is the blank colour.
const PALETTE = ['#1a1210', '#faf8f5', '#6b4d3a', '#3d2e1e', '#e8d5b0', '#c8a064', '#8a4a3a', '#4a6a8a', '#5a8a4a', '#35e65c']
const BLANK = 1

type Tool = 'pencil' | 'eraser' | 'fill'

export interface PaintLabels {
  pencil: string
  eraser: string
  fill: string
  clear: string
  download: string
  color: string
  canvas: string
}

interface DeskPaintProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: PaintLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
}

function loadCells(): Uint8Array {
  const cells = new Uint8Array(COLS * ROWS).fill(BLANK)
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length === COLS * ROWS) {
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i]
          cells[i] = typeof v === 'number' && v >= 0 && v < PALETTE.length ? v : BLANK
        }
      }
    }
  } catch {
    /* fresh canvas */
  }
  return cells
}

export function DeskPaint({ time, backLabel, desktopLabel, labels, onBack, onDesktop }: DeskPaintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellsRef = useRef<Uint8Array | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [tool, setTool] = useState<Tool>('pencil')
  const [colorIdx, setColorIdx] = useState(0)

  const repaint = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const cells = cellsRef.current
    if (!ctx || !cells) return
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = PALETTE[cells[y * COLS + x]]
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
  }, [])

  useEffect(() => {
    cellsRef.current = loadCells()
    repaint()
    const timer = saveTimer.current
    return () => clearTimeout(timer)
  }, [repaint])

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(Array.from(cellsRef.current ?? [])))
      } catch {
        /* storage full — drawing stays in memory */
      }
    }, 400)
  }, [])

  const setCell = useCallback(
    (x: number, y: number, idx: number) => {
      const cells = cellsRef.current
      const ctx = canvasRef.current?.getContext('2d')
      if (!cells || !ctx || x < 0 || x >= COLS || y < 0 || y >= ROWS) return
      if (cells[y * COLS + x] === idx) return
      cells[y * COLS + x] = idx
      ctx.fillStyle = PALETTE[idx]
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      persist()
    },
    [persist],
  )

  const flood = useCallback(
    (x: number, y: number, idx: number) => {
      const cells = cellsRef.current
      if (!cells || x < 0 || x >= COLS || y < 0 || y >= ROWS) return
      const from = cells[y * COLS + x]
      if (from === idx) return
      const stack = [y * COLS + x]
      while (stack.length) {
        const i = stack.pop()!
        if (cells[i] !== from) continue
        cells[i] = idx
        const cx = i % COLS
        const cy = Math.floor(i / COLS)
        if (cx > 0) stack.push(i - 1)
        if (cx < COLS - 1) stack.push(i + 1)
        if (cy > 0) stack.push(i - COLS)
        if (cy < ROWS - 1) stack.push(i + COLS)
      }
      repaint()
      persist()
    },
    [repaint, persist],
  )

  // The stage transform scales the canvas; map pointer coords via the box.
  const cellFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS)
    return { x, y }
  }

  const applyAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = cellFromEvent(e)
    if (tool === 'fill') flood(x, y, colorIdx)
    else setCell(x, y, tool === 'eraser' ? BLANK : colorIdx)
  }

  const clearAll = () => {
    cellsRef.current?.fill(BLANK)
    repaint()
    persist()
  }

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'room-painting.png'
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={() => onDesktop()}>{desktopLabel}</StripButton>
        <StripButton onClick={onBack} ariaLabel={backLabel}>← {backLabel}</StripButton>
      </ScreenStrip>

      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-2 border-b flex-shrink-0"
        style={{ height: 24, backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px' }}
      >
        <StripButton pressed={tool === 'pencil'} onClick={() => setTool('pencil')}>{labels.pencil}</StripButton>
        <StripButton pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>{labels.eraser}</StripButton>
        <StripButton pressed={tool === 'fill'} onClick={() => setTool('fill')}>{labels.fill}</StripButton>
        <span className="flex items-center gap-1 ml-2">
          {PALETTE.map((hex, i) => (
            <button
              key={hex}
              type="button"
              onClick={() => {
                setColorIdx(i)
                if (tool === 'eraser') setTool('pencil')
              }}
              aria-label={labels.color.replace('{n}', String(i + 1))}
              aria-pressed={colorIdx === i}
              className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
              style={{
                width: 12,
                height: 12,
                backgroundColor: hex,
                border: colorIdx === i ? '2px solid #3a3028' : '1px solid #c8b8a8',
              }}
            />
          ))}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <StripButton onClick={clearAll}>{labels.clear}</StripButton>
          <StripButton onClick={download}>{labels.download}</StripButton>
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          role="img"
          aria-label={labels.canvas}
          style={{ imageRendering: 'pixelated', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            applyAt(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1 && tool !== 'fill') applyAt(e)
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `npm run type-check && npm run lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/room/DeskPaint.tsx
git commit -m "feat(room): pixel paint app with persistent canvas"
```

---

### Task OS6: DeskMinesweeper

**Files:**
- Create: `src/components/room/DeskMinesweeper.tsx`

**Interfaces:**
- Consumes: the engine + `setBestIfLower`/`BEST_KEYS` (OS1), `ScreenStrip`/`StripButton` (OS4), `desk.mines` labels (OS2).
- Produces: `DeskMinesweeper({ time, backLabel, desktopLabel, labels: MinesLabels, onBack, onDesktop })` and `export interface MinesLabels` — consumed by Task OS7.

- [ ] **Step 1: Write the component** (9×9×10; grid 216 px + two 28/24 px strips fits 536×308; roving tabindex keyboard play):

```tsx
// src/components/room/DeskMinesweeper.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBoard, reveal, toggleFlag, flagCount, type Board } from '@/lib/games/minesweeper-engine'
import { getBest, setBestIfLower, BEST_KEYS } from '@/lib/games/storage'
import { ScreenStrip, StripButton } from './ScreenStrip'

const ROWS = 9
const COLS = 9
const MINES = 10
const CELL = 24
const NUMBER_COLORS = ['', '#2a4a8a', '#2a6a3a', '#8a2a2a', '#4a2a6a', '#6a4a2a', '#2a6a6a', '#3a3028', '#111111']

export interface MinesLabels {
  board: string
  cell: string
  minesLeft: string
  time: string
  best: string
  reset: string
  won: string
  lost: string
}

interface DeskMinesweeperProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: MinesLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
}

export function DeskMinesweeper({ time, backLabel, desktopLabel, labels, onBack, onDesktop }: DeskMinesweeperProps) {
  const [board, setBoard] = useState<Board>(() => createBoard(ROWS, COLS, MINES))
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState(0)
  const [focus, setFocus] = useState({ r: 0, c: 0 })
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressFlagged = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setBest(getBest(BEST_KEYS.minesweeper))
  }, [])

  // Timer runs from the first reveal until the game ends
  useEffect(() => {
    if (board.status !== 'playing' || !board.minesPlaced) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [board.status, board.minesPlaced])

  useEffect(() => {
    if (board.status === 'won' && setBestIfLower(BEST_KEYS.minesweeper, elapsed)) {
      setBest(elapsed)
    }
  }, [board.status, elapsed])

  const reset = useCallback(() => {
    setBoard(createBoard(ROWS, COLS, MINES))
    setElapsed(0)
  }, [])

  const doReveal = (r: number, c: number) => setBoard((b) => reveal(b, r, c))
  const doFlag = (r: number, c: number) => setBoard((b) => toggleFlag(b, r, c))

  const onKeyDown = (e: React.KeyboardEvent) => {
    const move = ({
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    } as Record<string, [number, number]>)[e.key]
    if (move) {
      e.preventDefault()
      const r = Math.min(ROWS - 1, Math.max(0, focus.r + move[0]))
      const c = Math.min(COLS - 1, Math.max(0, focus.c + move[1]))
      setFocus({ r, c })
      ;(gridRef.current?.querySelector(`[data-cell="${r}-${c}"]`) as HTMLButtonElement | null)?.focus()
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault()
      doFlag(focus.r, focus.c)
    }
  }

  const status = board.status === 'won' ? labels.won : board.status === 'lost' ? labels.lost : ''
  const pixelFont = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={() => onDesktop()}>{desktopLabel}</StripButton>
        <StripButton onClick={onBack} ariaLabel={backLabel}>← {backLabel}</StripButton>
      </ScreenStrip>

      {/* Status bar */}
      <div
        className="flex items-center gap-3 px-3 border-b flex-shrink-0"
        style={{ height: 24, backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px', color: '#3a3028', ...pixelFont }}
      >
        <span>{labels.minesLeft.replace('{n}', String(MINES - flagCount(board)))}</span>
        <span>{labels.time.replace('{s}', String(elapsed))}</span>
        {best > 0 && <span>{labels.best.replace('{s}', String(best))}</span>}
        <span aria-live="polite">{status}</span>
        <span className="ml-auto">
          <StripButton onClick={reset}>{labels.reset}</StripButton>
        </span>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center">
        <div
          ref={gridRef}
          role="group"
          aria-label={labels.board}
          onKeyDown={onKeyDown}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const r = Math.floor(i / COLS)
            const c = i % COLS
            const cell = board.cells[i]
            const revealed = cell.state === 'revealed'
            return (
              <button
                key={i}
                type="button"
                data-cell={`${r}-${c}`}
                tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                aria-label={labels.cell.replace('{r}', String(r + 1)).replace('{c}', String(c + 1))}
                onFocus={() => setFocus({ r, c })}
                onClick={() => {
                  if (pressFlagged.current) { pressFlagged.current = false; return }
                  doReveal(r, c)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  doFlag(r, c)
                }}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'mouse') {
                    longPress.current = setTimeout(() => {
                      pressFlagged.current = true
                      doFlag(r, c)
                    }, 350)
                  }
                }}
                onPointerUp={() => clearTimeout(longPress.current)}
                onPointerLeave={() => clearTimeout(longPress.current)}
                className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                style={{
                  width: CELL,
                  height: CELL,
                  fontSize: '12px',
                  lineHeight: 1,
                  backgroundColor: revealed ? '#e8e0d8' : '#c8b8a8',
                  border: revealed ? '1px solid #d8c8b8' : '2px outset #e8e0d8',
                  color: revealed && cell.adjacent > 0 ? NUMBER_COLORS[cell.adjacent] : '#3a3028',
                  ...pixelFont,
                }}
              >
                {cell.state === 'flagged' ? '⚑' : revealed ? (cell.mine ? '✱' : cell.adjacent || '') : ''}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `npm run type-check && npm run lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/room/DeskMinesweeper.tsx
git commit -m "feat(room): in-monitor minesweeper app"
```

---

### Task OS7: Wire it all into DeskView and Room

**Files:**
- Modify: `src/components/room/DeskView.tsx`
- Modify: `src/components/room/Room.tsx`

**Interfaces:**
- Consumes: everything from OS1–OS6 by the exact names above.

- [ ] **Step 1: DeskView imports and types**

```tsx
import { DeskDesktop, type DesktopShortcut } from './DeskDesktop'
import { DeskPaint, type PaintLabels } from './DeskPaint'
import { DeskMinesweeper, type MinesLabels } from './DeskMinesweeper'
import { ScreenStrip, StripButton } from './ScreenStrip'
```

`type ScreenMode = 'desktop' | 'browser' | 'paint' | 'minesweeper'`. Delete the local `Shortcut` interface. Props: `shortcuts: DesktopShortcut[]`, plus new `paintLabels: PaintLabels` and `minesLabels: MinesLabels`.

- [ ] **Step 2: Shortcut click handler** — replace `handleShortcutClick` with:

```tsx
  const handleShortcutClick = useCallback(
    (e: React.MouseEvent, s: DesktopShortcut) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      if (s.kind === 'external') {
        window.open(s.target, '_blank', 'noopener,noreferrer')
        return
      }
      if (s.kind === 'app') {
        setScreenMode(s.target as ScreenMode)
        return
      }
      if (reduce || isMobile) { router.push(s.target); return }
      if (screenMode === 'browser') {
        try {
          iframeRef.current?.contentWindow?.location.replace(s.target)
          setBrowserPath(s.target)
        } catch { /* ignore */ }
        return
      }
      activeIconRef.current = e.currentTarget as HTMLAnchorElement
      setBrowserPath(s.target)
      setScreenMode('browser')
      setIframeLoaded(false)
    },
    [reduce, isMobile, router, screenMode],
  )
```

The prefetch effect only prefetches site targets: `for (const s of shortcuts) if (s.kind === 'site') router.prefetch(s.target)`.

- [ ] **Step 3: Escape ladder** — in the Escape key effect, the condition generalises: any non-desktop mode returns to the desktop, desktop exits to the room:

```tsx
      if (screenMode !== 'desktop') {
        setScreenMode('desktop')
        activeIconRef.current?.focus()
      } else {
        onBack()
      }
```

- [ ] **Step 4: Screen area render** — the desktop branch becomes (mobile hides app icons):

```tsx
            {screenMode === 'desktop' && showDesktop && (
              <motion.div key="desktop" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}>
                <DeskDesktop
                  time={time}
                  backLabel={backLabel}
                  screenLabel={screenLabel}
                  shortcuts={isMobile ? shortcuts.filter((s) => s.kind === 'site') : shortcuts}
                  screensaver={screensaver}
                  reduce={reduce}
                  screenW={SCREEN_W}
                  screenH={SCREEN_H}
                  onBack={(e) => { e.stopPropagation(); onBack() }}
                  onShortcutClick={handleShortcutClick}
                />
              </motion.div>
            )}
```

and after the browser branch, add the two app branches:

```tsx
            {screenMode === 'paint' && (
              <motion.div key="paint" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskPaint time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={paintLabels} onDesktop={goDesktop}
                  onBack={(e) => { e.stopPropagation(); onBack() }} />
              </motion.div>
            )}

            {screenMode === 'minesweeper' && (
              <motion.div key="minesweeper" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskMinesweeper time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={minesLabels} onDesktop={goDesktop}
                  onBack={(e) => { e.stopPropagation(); onBack() }} />
              </motion.div>
            )}
```

The browser-mode strip may stay as-is or switch to `ScreenStrip`/`StripButton` — either is fine; if switched, behaviour must be identical.

- [ ] **Step 5: Room.tsx** — update the `RoomProps` desk interface to exactly:

```ts
    desk: {
      home: string
      paint: string
      minesweeper: string
      homeTip: string
      paintTip: string
      minesweeperTip: string
      back: string
      desktop: string
      expand: string
      browserTitle: string
      screenLabel: string
      paintApp: { pencil: string; eraser: string; fill: string; clear: string; download: string; color: string; canvas: string }
      mines: { board: string; cell: string; minesLeft: string; time: string; best: string; reset: string; won: string; lost: string }
    }
```

Replace the `deskShortcuts` array (imports shrink to `ICON_HOME, ICON_PAINT, ICON_MINESWEEPER` from `./DeskIcon`, plus `type DesktopShortcut` from `./DeskDesktop`):

```tsx
  // Desktop launcher. Future friends' links: append { kind: 'external', target: 'https://…' } entries.
  const deskShortcuts: DesktopShortcut[] = [
    { id: 'home', kind: 'site', target: '/home', label: t.desk.home, tooltip: t.desk.homeTip, icon: ICON_HOME },
    { id: 'paint', kind: 'app', target: 'paint', label: t.desk.paint, tooltip: t.desk.paintTip, icon: ICON_PAINT },
    { id: 'minesweeper', kind: 'app', target: 'minesweeper', label: t.desk.minesweeper, tooltip: t.desk.minesweeperTip, icon: ICON_MINESWEEPER },
  ]
```

and the `<DeskView>` call gains `paintLabels={t.desk.paintApp}` and `minesLabels={t.desk.mines}`.

- [ ] **Step 6: Verify** — `npm run type-check && npm run lint && npm run build` → all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/room/DeskView.tsx src/components/room/Room.tsx
git commit -m "feat(room): pixel OS launcher with paint and minesweeper screen modes"
```

---

### Task OS8: Verification and docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Walk the checklist** with `npm run dev`, enter the desk (`/#desk`):

1. Desktop shows exactly three icons: Home, Paint, Minesweeper; hover and keyboard focus each shows its speech-bubble tooltip.
2. Home opens the in-monitor browser exactly as before (Desktop/Expand buttons, path polling, Escape → desktop).
3. Paint: draws with pencil (pointer press-drag), eraser, fill; colour swatches switch; drawing survives leaving the app AND a full page reload; Clear empties; Download saves a PNG that opens correctly.
4. Minesweeper: first click is never a mine; flood reveal works on zeros; right-click flags (no context menu); mines counter and timer tick; win shows "Cleared!" and records best time (survives reload); loss reveals all mines; New game resets; arrow keys + Enter + F play a full game keyboard-only.
5. Escape ladder from each app → desktop → room; clicking outside the screen area still jitters the mouse and exits.
6. FR locale: all tooltips, tool names, and status strings are French.
7. Narrow window below 700 px: only Home shows; it navigates full-page.
8. Reduced motion: everything above still functions (only fade transitions drop).

- [ ] **Step 2: Update CLAUDE.md** — Current State: prepend `Pixel OS v1 desk launcher (Home/Paint/Minesweeper icons with bubble tooltips; Paint app with persistent localStorage canvas room-paint-v1 + PNG download; in-monitor Minesweeper with pure engine in src/lib/games/minesweeper-engine.ts and best time via games storage),`. Desk view section: screen modes are now `desktop | browser | paint | minesweeper`; the six site shortcuts were replaced by the three-icon launcher; note `DeskDesktop.tsx`/`ScreenStrip.tsx`/`DeskPaint.tsx`/`DeskMinesweeper.tsx`. Session history: add a bullet. Constraint 3 note: add `room-paint-v1` to the client-side localStorage list.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record pixel OS v1 in CLAUDE.md"
```

---

## Plan Self-Review Notes (lighting + pixel OS, already run by the planner)

- **Design coverage:** lighting — states/schedule ✓ pipeline+ink rule ✓ window override hook ✓ runtime module/provider ✓ crossfade+preload ✓ clock un-freeze ✓ `?light=` override ✓ v1 desk boundary ✓. Pixel OS — three-icon launcher + tooltips ✓ future external links ✓ Paint (persist/download/palette) ✓ Minesweeper (first-click safety, flags, keyboard, best time) ✓ Escape ladder ✓ mobile hiding ✓ i18n both dictionaries ✓ DeskDesktop/ScreenStrip extraction ✓.
- **Name consistency:** `lightingSrc`/`useLighting`/`useLightingClock`/`LightingProvider`/`LIGHTING_STATES` and `DesktopShortcut`/`PaintLabels`/`MinesLabels`/`ScreenStrip`/`StripButton`/`setBestIfLower`/`BEST_KEYS.minesweeper` used identically across tasks.
- **Known interaction:** the lighting plan grades `side-table*.png` (from the clock plan) — hence its prerequisite note; the OS plan is order-independent.
