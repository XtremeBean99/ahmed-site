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

Build is green (`type-check && lint && build`). CLAUDE.md current through the **v16** note.

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

# SPEC F — Personal-web features (ported from the `./reference` neocities site)  ⟨PLANNED⟩

**Origin:** assess of `./reference` ("cinni's dream home", a Web 1.0 kawaii homepage) vs this room.
The reference's *soul* (cozy, hand-made personal web) is ported as room-native behaviours, not its
iframe layout. Owner picked: **custom cursor · status note · terminal changelog · links/webring app ·
real server guestbook**. Guestbook decisions locked: **instant-publish + spam filters**, **Upstash
Redis** storage, **desktop-OS app** surface (no room sprite).

Two phases. **Phase 1 is server-free and low-risk (ship first)**; **Phase 2 reintroduces a server
write path** (reverses Constraints #2/#3/#4 — needs CLAUDE.md + privacy-policy updates).

---

> **For agentic workers:** implement task-by-task, in order. This project has **no unit-test
> runner** — "verify" means `npm run type-check` (fast, per-task) and, at phase boundaries,
> `npm run lint && npm run build` plus driving `npm run dev`. Commit after each task.
> **Global constraints (apply to every task):** pixel art via `<img>` + `image-rendering:pixelated`,
> never `next/image`; room palette bubble `#3d2e1e` / border `#5a4430` / text `#e8d5b0`, app screens
> `#faf8f5`/`#fffef5`/`#e8e0d8`; pixel font `var(--font-pixel), "Courier New", monospace`; every
> hotspot a real `<a>`/`<button>` with focus-visible ring; escape ladder app→desktop→room; English
> strings only in `src/lib/i18n/dictionaries/en.ts`; no em dashes in user-facing copy.

## Phase 1 — cosmetic + client-only (no server, ships independently)

### Task F0 — Desk close-up art refresh  ⟨ART LANDED — do first⟩
Owner updated `assets/pixel-art/close-up-desk/desk-closeup.png` + `-lamp-off.png` (2026-07-11) to
draw **sticky notes bearing the konami code** (diegetic hint for the konami→terminal egg). Deployed
`public/room/desk-closeup*.png` are stale (Jul 6–7). The close-up is full-canvas, lamp on/off
crossfade, and **not** in the lighting `FILES` array, so it skips `npm run lighting`.

**Files:** Modify `scripts/extract-monitor-hover.mjs` (after line 58); output `public/room/desk-closeup.png` + `-lamp-off.png`.
- [ ] Append a lamp-**on** passthrough mirroring lines 55–58 (which only re-emit lamp-off):
```js
// Lamp-on desk close-up, same full-canvas passthrough as lamp-off above.
await sharp(join(srcDir, 'close-up-desk', 'desk-closeup.png'))
  .png()
  .toFile(join(outDir, 'desk-closeup.png'))
console.log('desk-closeup.png (full canvas)')
```
- [ ] Run `node scripts/extract-monitor-hover.mjs`; confirm both PNGs in `public/room/` now dated today.
- [ ] Verify: `npm run dev`, zoom into desk, sticky notes with the konami code are visible in both lamp states.
- [ ] Commit: `chore(room): refresh desk close-up art with konami sticky notes`.

### Task F1 — Custom pixel cursor (room `/` only)
**Files:** Create `scripts/generate-cursors.mjs`, `public/room/cursor/{pointer,grab}.png`; Modify `src/app/globals.css`, `src/components/room/Room.tsx` (root div ~line 520), `src/components/room/DeskView.tsx` (root div line 237).
- [ ] Create `scripts/generate-cursors.mjs` (sharp renders pixel-art SVGs → 24×24 PNGs, room palette):
```js
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'room', 'cursor')
await mkdir(out, { recursive: true })
const svg = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" shape-rendering="crispEdges" viewBox="0 0 24 24">${paths}</svg>`
// Arrow pointer: dark #3d2e1e body, light #e8d5b0 fill
const pointer = svg('<path d="M2 2 L2 17 L6 13 L9 20 L12 19 L9 12 L15 12 Z" fill="#e8d5b0" stroke="#3d2e1e" stroke-width="1.5"/>')
// "Grab" hand-ish blob for interactive elements
const grab = svg('<rect x="6" y="4" width="12" height="14" rx="3" fill="#e8d5b0" stroke="#3d2e1e" stroke-width="1.5"/><rect x="9" y="1" width="2" height="6" fill="#3d2e1e"/><rect x="13" y="1" width="2" height="6" fill="#3d2e1e"/>')
await sharp(Buffer.from(pointer)).png().toFile(join(out, 'pointer.png'))
await sharp(Buffer.from(grab)).png().toFile(join(out, 'grab.png'))
console.log('cursors -> public/room/cursor/')
```
- [ ] Run `node scripts/generate-cursors.mjs`. (⟨ART⟩ owner may later replace the two PNGs by hand; keep names.)
- [ ] `globals.css` — append (scoped, room-only, pointer-devices only so mobile is untouched):
```css
@media (pointer: fine) {
  .room-cursor { cursor: url('/room/cursor/pointer.png') 2 2, auto; }
  .room-cursor a, .room-cursor button, .room-cursor [role="button"] { cursor: url('/room/cursor/grab.png') 8 4, pointer; }
}
```
- [ ] `Room.tsx` room-view root: add `room-cursor` to the `className` of `<div className="relative w-full h-screen overflow-hidden bg-[#1a1210]">`.
- [ ] `DeskView.tsx` root (line 237): add `className="relative room-cursor"` and **remove** the inline `cursor: 'default'` from its `style` (inline style would beat the stylesheet).
- [ ] Verify: `npm run type-check`; `npm run dev` — custom arrow over the room, grab cursor over hotspots; a `(site)` page (e.g. `/home`) still shows the OS default. Commit: `feat(room): custom pixel cursor scoped to the room`.

### Task F2 — "Currently" status note (art-free)
**Files:** Modify `src/lib/i18n/dictionaries/en.ts` (add `room.statusNote`; NOTE `room.status` already exists = 'Expected 2031', do not reuse), `src/lib/room/discoveries.ts` (DISCOVERY_IDS), `en.ts` `room.discoveryLabels`, `src/components/room/DeskDesktop.tsx`, `src/components/room/DeskView.tsx` (pass prop), `src/components/room/Room.tsx` (pass `t.room.statusNote`).
**Interfaces:** `DeskDesktop` gains prop `statusNote: string`; threaded Room → DeskView → DeskDesktop.
- [ ] `en.ts`: in `room:` add `statusNote: 'currently: reading about AI liability, drinking too much coffee'`; in `room.discoveryLabels` add `status: 'Sticky note'`.
- [ ] `discoveries.ts`: add `'status'` to the `DISCOVERY_IDS` array.
- [ ] `DeskDesktop.tsx`: add `statusNote: string` to `DeskDesktopProps`; render a sticky pinned bottom-left of the desktop, and fire the discovery on mount (reuses the existing `room:app-open`→`discover` handler in Room):
```tsx
useEffect(() => { window.dispatchEvent(new CustomEvent('room:app-open', { detail: 'status' })) }, [])
// ...inside the root div, after the <nav>:
<div className="absolute left-2 bottom-2 max-w-[52%] px-2 py-1" style={{
  backgroundColor: '#3d2e1e', border: '2px solid #5a4430', borderRadius: 2,
  fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: 9, lineHeight: 1.4,
  color: '#e8d5b0', transform: 'rotate(-2deg)', textShadow: '1px 1px 0 #1a0e04',
}}>{statusNote}</div>
```
  (add `import { useEffect } from 'react'`.)
- [ ] `DeskView.tsx`: add `statusNote: string` to `DeskViewProps`, destructure it, pass to `<DeskDesktop ... statusNote={statusNote} />`.
- [ ] `Room.tsx`: pass `statusNote={t.room.statusNote}` to `<DeskView>`.
- [ ] Verify: `npm run type-check`; dev — sticky note shows on the desktop, "Sticky note" discovery toast fires once. Commit: `feat(room): currently status note on the desktop`.

### Task F3 — Terminal changelog
**Files:** Create `src/lib/room/changelog.ts`; Modify `src/components/room/DeskTerminal.tsx`.
- [ ] Create `changelog.ts`:
```ts
export interface ChangelogEntry { date: string; line: string }
export const CHANGELOG: ChangelogEntry[] = [
  { date: '2026-07-11', line: 'Guestbook, links wall, status note, and a custom cursor.' },
  { date: '2026-07-11', line: 'Window weather, night sky, and a hidden terminal.' },
  { date: '2026-07-11', line: 'Discoveries and mobile drag-to-pan.' },
  { date: '2026-07-10', line: 'Room-only redesign; README and Legal apps on the desktop.' },
  { date: '2026-07-07', line: 'Pixel OS launcher, Paint, Minesweeper, day/night lighting.' },
]
```
- [ ] `DeskTerminal.tsx`: `import { CHANGELOG } from '@/lib/room/changelog'`; add a branch in `handleCommand` and a `help` line + `ls` filename:
```ts
} else if (command === 'changelog' || command === 'cat changelog.txt') {
  for (const e of CHANGELOG) addLines(e.date + '  ' + e.line)
```
  In `help`, add `'  changelog      Recent updates',`; in `ls`, change to `'readme.txt   changelog.txt   secrets.txt'`.
- [ ] Verify: `npm run type-check`; dev — konami into terminal, `changelog` prints the list. Commit: `feat(room): changelog command in the terminal`.

### Task F4 — Links / webring app (the 88×31 button wall)
**Files:** Create `src/lib/room/links.ts`, `src/components/room/DeskLinks.tsx`; Modify `DeskView.tsx` (ScreenMode + import + render branch), `Room.tsx` (shortcut), `en.ts` (labels + discoveryLabels), `discoveries.ts`. ⟨CONTENT non-blocking: owner adds friends' 88×31 PNGs to `public/buttons/` and rows to `links.ts`.⟩
**Interfaces:** `DeskLinks` props `{ labels: { title: string; close: string }; desktopLabel: string; onDesktop: () => void }`.
- [ ] `links.ts`:
```ts
export interface SiteLink { label: string; url: string; button?: string } // button = /buttons/foo.png (88x31)
export const LINKS: SiteLink[] = [
  { label: 'GitHub', url: 'https://github.com/XtremeBean99' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/ahmed-hussain-0880ba25a/' },
]
```
- [ ] `DeskLinks.tsx` (mirror `DeskReadme.tsx` chrome — ScreenStrip header + footer Close button):
```tsx
'use client'
import { ScreenStrip, StripButton } from './ScreenStrip'
import { LINKS } from '@/lib/room/links'
const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
interface DeskLinksProps { labels: { title: string; close: string }; desktopLabel: string; onDesktop: () => void }
export function DeskLinks({ labels, desktopLabel, onDesktop }: DeskLinksProps) {
  const buttons = LINKS.filter((l) => l.button)
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>
      <div className="flex-1 overflow-y-auto p-3 mx-2 my-2" style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0' }}>
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {buttons.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" title={l.label}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.button} alt={l.label} width={88} height={31} style={{ imageRendering: 'pixelated' }} />
              </a>
            ))}
          </div>
        )}
        <ul style={{ ...PIXEL, fontSize: 10, lineHeight: 1.8, color: '#2a2520', listStyle: 'none', margin: 0, padding: 0 }}>
          {LINKS.map((l) => (
            <li key={l.url}>★ <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3d2e1e', textDecoration: 'underline' }}>{l.label}</a></li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```
- [ ] `discoveries.ts`: add `'links'` to `DISCOVERY_IDS`. `en.ts`: `desk.links: 'Links'`, `desk.linksTip: 'My corners of the web'`, `desk.linksApp: { title: 'Links', close: 'Close' }`, `room.discoveryLabels.links: 'Links'`.
- [ ] `DeskView.tsx`: `ScreenMode` union `+ 'links'`; `import { DeskLinks } from './DeskLinks'`; add prop `linksLabels: { title: string; close: string }` to `DeskViewProps` + destructure; add render branch mirroring the `readme` branch:
```tsx
{screenMode === 'links' && (
  <motion.div key="links" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
    <DeskLinks labels={linksLabels} desktopLabel={desktopLabel} onDesktop={goDesktop} />
  </motion.div>
)}
```
- [ ] `Room.tsx`: add to `deskShortcuts` (id `'links'` MUST match target for auto-discovery): `{ id: 'links', kind: 'app', target: 'links', label: t.desk.links, tooltip: t.desk.linksTip, icon: ICON_README }` (reuse an existing icon or add one); pass `linksLabels={t.desk.linksApp}` to `<DeskView>`.
- [ ] Verify: `npm run type-check`; dev — Links icon opens the app, buttons + list render, Esc returns to desktop, "Links" discovery fires. Commit: `feat(room): links/webring desktop app`.

**End of Phase 1** — run `npm run lint && npm run build`, drive `npm run dev` through every new surface, then commit any lint fixes. Update CLAUDE.md session log (v17) and collapse F0–F4 into the Done log.

---

## Phase 2 — Server guestbook  ⟨reverses Constraints #2/#3/#4; docs + privacy updates required⟩

Restore-and-adapt from `_archive/` (verified templates): `_archive/lib/redis.ts` (lazy `getRedis`),
`_archive/lib/ratelimit.ts` (`checkRateLimit` + `getClientIp`), `_archive/services/leaderboard.ts`
(sorted-set pattern), and the CSRF/honeypot/Zod flow in `_archive/app/api/contact/route.ts`.

### Task F5 — Storage + service layer
**Files:** Copy `_archive/lib/redis.ts`, `_archive/lib/ratelimit.ts` → `src/lib/`; Create `src/lib/validations.ts` (or add to it), `src/services/guestbook.ts`; Modify `.env.example`.
**Interfaces (consumed by F6):** `addEntry({name,message}) → Promise<GuestbookEntry>`, `listEntries(limit?) → Promise<GuestbookEntry[]>` (newest first), `deleteEntry(id) → Promise<void>`; `GuestbookEntry = { id: string; name: string; message: string; at: number }`; `guestbookSchema` (Zod).
- [ ] Copy the two `_archive/lib` files to `src/lib/` verbatim (they already import `@/lib/redis`).
- [ ] `src/lib/validations.ts` — add:
```ts
import { z } from 'zod'
export const guestbookSchema = z.object({
  name: z.string().trim().min(1).max(32),
  message: z.string().trim().min(1).max(280),
  website: z.string().max(0).optional(), // honeypot: must be empty
})
export type GuestbookInput = z.infer<typeof guestbookSchema>
```
- [ ] `src/services/guestbook.ts` (sorted set scored by timestamp; keep newest 500; delete matches the raw member string):
```ts
import { getRedis } from '@/lib/redis'
export interface GuestbookEntry { id: string; name: string; message: string; at: number }
const KEY = 'guestbook:entries'
const MAX_STORED = 500
export async function addEntry(input: { name: string; message: string }): Promise<GuestbookEntry> {
  const redis = getRedis()
  const entry: GuestbookEntry = { id: crypto.randomUUID(), name: input.name, message: input.message, at: Date.now() }
  await redis.zadd(KEY, { score: entry.at, member: JSON.stringify(entry) })
  await redis.zremrangebyrank(KEY, 0, -(MAX_STORED + 1)) // drop oldest beyond the cap
  return entry
}
export async function listEntries(limit = 50): Promise<GuestbookEntry[]> {
  const redis = getRedis()
  const raw = await redis.zrange<string[]>(KEY, 0, limit - 1, { rev: true }) // newest first
  return raw.map((m) => JSON.parse(m) as GuestbookEntry)
}
export async function deleteEntry(id: string): Promise<void> {
  const redis = getRedis()
  const raw = await redis.zrange<string[]>(KEY, 0, -1)
  for (const member of raw) {
    if ((JSON.parse(member) as GuestbookEntry).id === id) { await redis.zrem(KEY, member); return }
  }
}
```
  (Upstash auto-deserialises JSON on read; `zrange<string[]>` + `JSON.parse` is defensive and matches the archived leaderboard. If type-check flags the generic, mirror leaderboard's `(GuestbookEntry | string)[]` union.)
- [ ] `.env.example`: add `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`, `GUESTBOOK_ADMIN_KEY=`.
- [ ] Verify: `npm run type-check`. Commit: `feat(guestbook): redis service + schema (restore from archive)`.

### Task F6 — API route
**Files:** Create `src/app/api/guestbook/route.ts`.
**Interfaces (consumed by F7):** `GET → { entries: GuestbookEntry[] }`; `POST {name,message,website?} → 200 {success:true} | 400 | 429`; `DELETE ?id=&key= → 200 | 401 | 400`.
- [ ] Create the route (POST adapts `_archive/app/api/contact/route.ts` CSRF+rate-limit+honeypot):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { guestbookSchema } from '@/lib/validations'
import { addEntry, listEntries, deleteEntry } from '@/services/guestbook'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

const stripUnsafe = (s: string) => s.replace(/[ -]/g, '').replace(/<[^>]*>/g, '').trim()
const BAD = /\b(fuck|shit|cunt|nigg|faggot)\b/i // minimal; expand as needed

export async function GET() {
  try { return NextResponse.json({ entries: await listEntries(50) }) }
  catch { return NextResponse.json({ entries: [] }) } // fail soft (e.g. env unset)
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host') || 'ahmedyhussain.com'
  const allowed = [`https://${host}`, `https://www.${host}`]
  if (process.env.NODE_ENV === 'production') {
    const ok = (origin && allowed.includes(origin)) || (referer && allowed.some((o) => referer.startsWith(o)))
    if (!ok) return NextResponse.json({ success: true }) // silently reject cross-origin
  }
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`guestbook:${ip}`)).allowed)
    return NextResponse.json({ error: 'Too many messages. Try again later.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const parsed = guestbookSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  const { name, message, website } = parsed.data
  if (website && website.length > 0) return NextResponse.json({ success: true }) // honeypot

  const cleanName = stripUnsafe(name), cleanMsg = stripUnsafe(message)
  if (!cleanName || !cleanMsg || BAD.test(cleanName) || BAD.test(cleanMsg))
    return NextResponse.json({ error: 'Message rejected.' }, { status: 400 })
  try {
    const entry = await addEntry({ name: cleanName, message: cleanMsg })
    return NextResponse.json({ success: true, entry })
  } catch { return NextResponse.json({ error: 'Could not save right now.' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id'); const key = searchParams.get('key')
  const admin = process.env.GUESTBOOK_ADMIN_KEY
  if (!admin || key !== admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  await deleteEntry(id)
  return NextResponse.json({ success: true })
}
```
- [ ] Verify with local Upstash creds in `.env.local`: `npm run dev`, `curl` a POST then GET; without creds GET returns `{entries:[]}` (no 500). Commit: `feat(guestbook): api route (get/post/delete)`.

### Task F7 — Desktop-OS Guestbook app
**Files:** Create `src/components/room/DeskGuestbook.tsx`; Modify `DeskView.tsx` (ScreenMode + import + branch + prop), `Room.tsx` (shortcut + labels), `en.ts`, `discoveries.ts`.
**Interfaces:** `DeskGuestbook` props `{ labels: GuestbookLabels; desktopLabel: string; onDesktop: () => void }` where `GuestbookLabels = { title; close; namePh; messagePh; sign; empty; posting; error }`.
- [ ] `DeskGuestbook.tsx` (chrome mirrors DeskReadme; fetches `GET /api/guestbook` on mount, posts the form, optimistic prepend):
```tsx
'use client'
import { useEffect, useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'
import type { GuestbookEntry } from '@/services/guestbook'
const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
export interface GuestbookLabels { title: string; close: string; namePh: string; messagePh: string; sign: string; empty: string; posting: string; error: string }
interface Props { labels: GuestbookLabels; desktopLabel: string; onDesktop: () => void }
export function DeskGuestbook({ labels, desktopLabel, onDesktop }: Props) {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null)
  const [name, setName] = useState(''); const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { fetch('/api/guestbook').then((r) => r.json()).then((d) => setEntries(d.entries ?? [])).catch(() => setEntries([])) }, [])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message, website }) })
      const d = await r.json()
      if (!r.ok || !d.success) { setErr(d.error || labels.error); return }
      if (d.entry) setEntries((prev) => [d.entry, ...(prev ?? [])])
      setName(''); setMessage('')
    } catch { setErr(labels.error) } finally { setBusy(false) }
  }
  const inputStyle: React.CSSProperties = { ...PIXEL, fontSize: 10, color: '#2a2520', backgroundColor: '#fffef5', border: '1px solid #c8b8a8', padding: '2px 4px', width: '100%' }
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>
      <div className="flex-1 overflow-y-auto p-2 mx-2 mt-2" style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0', ...PIXEL, fontSize: 10, color: '#2a2520' }}>
        {entries === null ? null : entries.length === 0 ? <p>{labels.empty}</p> : entries.map((en) => (
          <div key={en.id} className="mb-2 pb-1" style={{ borderBottom: '1px dotted #d8d0c0' }}>
            <b style={{ color: '#3d2e1e' }}>{en.name}</b> <span style={{ opacity: 0.6 }}>{new Date(en.at).toLocaleDateString()}</span>
            <div style={{ wordBreak: 'break-word' }}>{en.message}</div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-1 px-2 py-2">
        <input aria-label={labels.namePh} placeholder={labels.namePh} maxLength={32} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input aria-label={labels.messagePh} placeholder={labels.messagePh} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} style={inputStyle} />
        <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
        {err && <span style={{ ...PIXEL, fontSize: 9, color: '#a33' }}>{err}</span>}
        <button type="submit" disabled={busy || !name.trim() || !message.trim()} style={{ ...PIXEL, fontSize: 10, backgroundColor: '#e8e0d8', color: '#3a3028', border: '1px solid #c8b8a8', padding: '2px 6px', opacity: busy ? 0.6 : 1 }}>{busy ? labels.posting : labels.sign}</button>
      </form>
    </div>
  )
}
```
- [ ] `discoveries.ts`: add `'guestbook'`. `en.ts`: `desk.guestbook: 'Guestbook'`, `desk.guestbookTip: 'Sign my guestbook'`, `desk.guestbookApp: { title: 'Guestbook', close: 'Close', namePh: 'your name', messagePh: 'leave a message', sign: 'Sign', empty: 'No messages yet. Be the first!', posting: 'Signing...', error: 'Could not post. Try again.' }`, `room.discoveryLabels.guestbook: 'Guestbook'`.
- [ ] `DeskView.tsx`: `ScreenMode + 'guestbook'`; import; add prop `guestbookLabels: GuestbookLabels`; render branch mirroring `readme` with `<DeskGuestbook labels={guestbookLabels} desktopLabel={desktopLabel} onDesktop={goDesktop} />`.
- [ ] `Room.tsx`: add shortcut `{ id: 'guestbook', kind: 'app', target: 'guestbook', label: t.desk.guestbook, tooltip: t.desk.guestbookTip, icon: ICON_README }`; pass `guestbookLabels={t.desk.guestbookApp}`.
- [ ] Verify: dev — open Guestbook, sign an entry, it appears; reload keeps it; empty state shows without creds. Commit: `feat(guestbook): desktop app`.

### Task F8 — Docs, privacy, security
**Files:** Modify legal/privacy source (`en.ts` `legal.privacy` or `DeskLegal` content), `CLAUDE.md`, `.env.example`, `README.md`; check `next.config.ts`.
- [ ] Privacy policy: add a clause disclosing stored **name, message, timestamp** and transient IP-based rate-limiting; remove/replace any "no server storage" wording. Bump the effective date.
- [ ] `CLAUDE.md`: amend Constraint #2 (now GET/POST/DELETE `/api/guestbook` accepts user input — points at this route's Zod+honeypot+CSRF), #3 (Upstash `guestbook:entries` store), #4 (`UPSTASH_*` + `GUESTBOOK_ADMIN_KEY` un-retired); update the env-var table and architecture map; add v18 to the session log.
- [ ] Confirm `next.config.ts` needs no change (same-origin POST, no new external hosts; CSP `connect-src 'self'` already permits the fetch).
- [ ] **End of Phase 2:** `npm run type-check && npm run lint && npm run build`; drive `npm run dev` end to end (sign → appears → `curl -X DELETE '.../api/guestbook?id=<id>&key=<key>'` removes it). Commit: `docs: guestbook privacy + constraint updates`. Collapse F5–F8 into the Done log.

## Self-review (checked against SPEC F)
- Coverage: F1 cursor · F2 status · F3 changelog · F4 links · F5–F8 guestbook (storage/api/app/docs) — all five picked features mapped. ✔
- Consistency: `GuestbookEntry`/`addEntry`/`listEntries`/`deleteEntry`/`guestbookSchema` names identical across F5→F6→F7; discovery auto-fires because each app shortcut's `id` == `target` == a `DISCOVERY_IDS` member (matches the existing `room:app-open` handler). ✔
- Note: `room.status` ('Expected 2031') already exists → new key is `room.statusNote` to avoid collision. ✔

---

*As a phase starts, keep it here until done, then replace it with a one-line entry + hash in the
"Done" log above. Update CLAUDE.md after each phase.*
