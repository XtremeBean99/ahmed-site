# TODO — Hardening, Skip-No-Repeat, Volume Slider, Room OG Image

> **READ FIRST, EVERY SESSION:** re-read `CLAUDE.md` **in full at the start of every session** before touching any code — it is the single consolidated context for this repo and it changes between sessions (constraints, room geometry, docs policy). Do not rely on a summary from a previous session.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Docs policy (CLAUDE.md constraint 8):** this file is the repo's only task document. When every task below is complete, **delete this TODO.md in the final commit** (Task 5 includes that step). Do not create any other `.md` files.

**Goal:** Four owner-picked roadmap items: (15) durable rate limiting on Upstash + trusted client-IP extraction; (1) track skip never repeats the current track; (7) a volume slider on the NowPlaying widget, persisted; (3) the room OG image — replace the text-card `opengraph-image.tsx` on `/` with a static crop of `background.png`. Everything else in the roadmap is explicitly deferred.

**Architecture:** `checkRateLimit` becomes async, Upstash-backed (INCR + EXPIRE fixed window) behind the existing lazy `getRedis()` client, with the current in-memory Map kept as a dev/outage fallback; a `getClientIp()` helper stops trusting the spoofable leftmost `X-Forwarded-For` hop. Audio changes live in `RoomAudioProvider` (random-no-repeat pick, `volume`/`setVolume` in context, pref persisted in `room-save-v1`). The OG image is generated once by a sharp script into `src/app/opengraph-image.png` (Next's static file convention), deleting the dynamic `.tsx`.

## Global Constraints (from CLAUDE.md — binding)

- **Re-read CLAUDE.md at the start of every session** (see banner above).
- Minimal persistence: server-side state only in Upstash Redis behind existing patterns (`src/lib/redis.ts` lazy client, env vars only). No new services.
- Every user-facing string goes in BOTH dictionaries in the same commit — this plan adds ONE new key: `room.audio.volume` (EN `'Volume'` / FR `'Volume'`). The `Dictionary` type derives from `en.ts`, so a missing FR key fails type-check.
- Room prefs live in localStorage `room-save-v1` via `src/lib/room/storage.ts` — extend the validated shape, never write raw.
- Do NOT touch the per-page OG images under `src/app/(site)/**` — only the root `/` one.
- Reduced motion never disables functionality; none of these tasks add decorative animation.
- No unit-test runner exists. Gates: `npm run type-check && npm run lint && npm run build` + each task's manual verification.
- Only three `.md` files may exist: `CLAUDE.md`, `README.md`, this `TODO.md` (deleted at completion).
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Durable rate limiting + trusted client IP (Roadmap 15)

**Files:**
- Rewrite: `src/lib/ratelimit.ts`
- Modify: `src/app/api/contact/route.ts` (~lines 22–24)
- Modify: `src/app/api/ninja/leaderboard/route.ts` (~lines 44–45)

**Interfaces:**
- Consumes: `getRedis()` from `@/lib/redis` (lazy Upstash client; throws if env vars missing — that's why we check env before calling it); env vars `UPSTASH_REDIS_REST_URL`/`_TOKEN` (or `KV_REST_API_*`), already used by the leaderboard.
- Produces: `checkRateLimit(key: string): Promise<{ allowed: boolean; remaining: number }>` (now **async**) and `getClientIp(headers: Headers): string`. Both routes must `await`.

Why: the current limiter is a per-process `Map` — on Vercel every cold start / concurrent instance has an empty store, so the "5/hour" limit barely exists (security review finding #3). And both routes take the **leftmost** `X-Forwarded-For` value, which the client controls (finding #5); the rightmost hop is appended by the platform, and Vercel also sets `x-real-ip`.

- [ ] **Step 1: Rewrite `src/lib/ratelimit.ts`**

Replace the entire file with:

```ts
import { getRedis } from '@/lib/redis'

/**
 * Fixed-window rate limiter: 5 requests per hour per key.
 *
 * Primary store is Upstash Redis (INCR + EXPIRE), so limits survive
 * serverless cold starts and apply across concurrent instances. When the
 * Redis env vars are absent (local dev) or Redis errors, we fall back to
 * the old in-memory Map — best-effort limiting rather than a broken form.
 */
const WINDOW_S = 60 * 60
const WINDOW_MS = WINDOW_S * 1000
const MAX_REQUESTS = 5

interface Entry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, Entry>()

// Clean up expired in-memory entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key)
  }
}, 5 * 60 * 1000).unref?.()

function checkMemory(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_REQUESTS - 1 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}

export async function checkRateLimit(
  key: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (url && token) {
    try {
      const redis = getRedis()
      const redisKey = `rl:${key}`
      const count = await redis.incr(redisKey)
      if (count === 1) await redis.expire(redisKey, WINDOW_S)
      return {
        allowed: count <= MAX_REQUESTS,
        remaining: Math.max(0, MAX_REQUESTS - count),
      }
    } catch {
      // Redis outage — degrade to per-instance limiting rather than 500ing
    }
  }
  return checkMemory(key)
}

/**
 * Client IP for rate-limit keys. The LEFTMOST X-Forwarded-For hop is
 * client-supplied and spoofable; prefer Vercel's x-real-ip, then the
 * rightmost XFF hop (appended by the platform).
 */
export function getClientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')
  if (real) return real.trim()
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }
  return 'unknown'
}
```

- [ ] **Step 2: Update the contact route**

In `src/app/api/contact/route.ts`, change the import and the rate-limit block:

```ts
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
```

```ts
  // Rate-limit by IP (durable via Upstash; see src/lib/ratelimit.ts)
  const ip = getClientIp(request.headers)
  const { allowed } = await checkRateLimit(`contact:${ip}`)
```

(The handler is already `async`; only the two lines change. Note the key gains a
`contact:` prefix so contact and ninja counters no longer share a bucket.)

- [ ] **Step 3: Update the leaderboard route**

In `src/app/api/ninja/leaderboard/route.ts`, same import change, and:

```ts
  const ip = getClientIp(req.headers)
  const { allowed } = await checkRateLimit(`ninja:${ip}`)
```

- [ ] **Step 4: Static verification**

Run: `npm run type-check && npm run lint` — both pass (type-check catches any call site missing `await`).

- [ ] **Step 5: Manual verification**

With `npm run dev` (no Upstash env → memory fallback, or with env → real Redis):

```bash
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" -d '{}'; done
```

Expected: five `400`s (invalid body — but rate-counted) then a `429` on the sixth. If testing against real Upstash, clean up after: the key is `rl:contact:<your-ip>` (or just let it expire in an hour).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ratelimit.ts src/app/api/contact/route.ts src/app/api/ninja/leaderboard/route.ts
git commit -m "feat: durable Upstash rate limiting with trusted client-IP extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Skip never repeats the current track (Roadmap 1)

**Files:**
- Modify: `src/components/room/RoomAudioProvider.tsx` (the `ended` listener ~lines 51–56 and `nextTrack` ~lines 110–117)

**Interfaces:**
- Consumes: `PLAYLIST` (6 tracks). No API change — `nextTrack()` signature unchanged.
- Produces: both skip and natural track-end pick a **random track that is never the one just played**.

- [ ] **Step 1: Add the picker and use it in both advance paths**

Add this module-level function at the bottom of `RoomAudioProvider.tsx` (next to `loadTrack`):

```ts
/** Random next index, never the current one (unless the playlist has 1 track). */
function pickNextIndex(current: number): number {
  if (PLAYLIST.length <= 1) return current
  let next = current
  while (next === current) {
    next = Math.floor(Math.random() * PLAYLIST.length)
  }
  return next
}
```

In the `ended` listener, replace `trackIdxRef.current = (trackIdxRef.current + 1) % PLAYLIST.length` with:

```ts
      trackIdxRef.current = pickNextIndex(trackIdxRef.current)
```

In `nextTrack`, replace the same `(trackIdxRef.current + 1) % PLAYLIST.length` line with:

```ts
    trackIdxRef.current = pickNextIndex(trackIdxRef.current)
```

- [ ] **Step 2: Static verification**

Run: `npm run type-check && npm run lint` — both pass.

- [ ] **Step 3: Manual verification**

In dev on `/`: click Skip on the NowPlaying widget ~10 times — the title must change on **every** click (never the same track twice in a row), in non-sequential order. Let a track finish naturally (or seek near the end in devtools: `document.querySelector('audio')` is not in the DOM — instead temporarily log in the `ended` handler, or just verify skip behaviour and trust the shared code path).

- [ ] **Step 4: Commit**

```bash
git add src/components/room/RoomAudioProvider.tsx
git commit -m "feat: random skip-no-repeat track advance

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Volume slider on NowPlaying, persisted (Roadmap 7)

**Files:**
- Modify: `src/lib/room/storage.ts` (add `volume` to the validated pref shape)
- Modify: `src/components/room/RoomAudioProvider.tsx` (volume state + context)
- Modify: `src/components/room/NowPlaying.tsx` (slider UI)
- Modify: `src/components/room/Room.tsx` (dict type only)
- Modify: `src/lib/i18n/dictionaries/en.ts` and `fr.ts` (ONE new key, same commit)

**Interfaces:**
- Consumes: existing `loadPrefs`/`savePrefs`; `room.audio.*` label object passed as `labels` into `NowPlaying`.
- Produces: `useRoomAudio()` additionally returns `volume: number` (0–1) and `setVolume(v: number): void`; `RoomSave` gains `volume: number` (default 0.3).

- [ ] **Step 1: Extend the pref shape in `storage.ts`**

```ts
interface RoomSave {
  audio: boolean
  lampOn: boolean
  visitCount: number
  /** Music volume 0–1 */
  volume: number
}

const DEFAULTS: RoomSave = { audio: true, lampOn: true, visitCount: 0, volume: 0.3 }
```

and in `loadPrefs()` add to the returned object:

```ts
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULTS.volume,
```

- [ ] **Step 2: Volume state in `RoomAudioProvider.tsx`**

(a) Extend the context interface:

```ts
interface AudioState {
  playing: boolean
  trackIndex: number
  volume: number
  toggle: () => void
  nextTrack: () => void
  setVolume: (v: number) => void
}
```

(b) Add state next to the others: `const [volume, setVolumeState] = useState(0.3)`

(c) In the init effect, replace `audio.volume = 0.3` with the stored value (the effect runs client-side, so `loadPrefs()` is safe):

```ts
    const prefs = loadPrefs()
    audio.volume = prefs.volume
    setVolumeState(prefs.volume)
```

(d) Add the setter callback next to `nextTrack`:

```ts
  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    if (audioRef.current) audioRef.current.volume = clamped
    setVolumeState(clamped)
    savePrefs({ volume: clamped })
  }, [])
```

(e) Provide it: `value={{ playing, trackIndex, volume, toggle, nextTrack, setVolume }}`

- [ ] **Step 3: Slider in `NowPlaying.tsx`**

(a) `labels` prop type gains `volume: string`.

(b) Destructure the new context values: `const { playing, trackIndex, volume, toggle, nextTrack, setVolume } = useRoomAudio()`

(c) After the Skip button, add:

```tsx
      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label={labels.volume}
        className="flex-shrink-0 cursor-pointer outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c8b89a]"
        style={{ width: 56, height: 14, accentColor: '#c8b89a' }}
      />
```

- [ ] **Step 4: Dictionaries + Room dict type (same commit — constraint 5)**

In `en.ts`, inside `room.audio` (after `speakersLabel`): `volume: 'Volume',`
In `fr.ts`, at the identical path: `volume: 'Volume',`
In `Room.tsx`, the `RoomProps` dict type's `audio` object gains `volume: string`.

- [ ] **Step 5: Static verification**

Run: `npm run type-check && npm run lint` — both pass (type-check proves the FR key and the dict type).

- [ ] **Step 6: Manual verification**

In dev on `/` with music playing: drag the slider — loudness changes live; set ~0.7, reload — the slider AND the audible level come back at 0.7 (pref persisted); slider is Tab-reachable and arrow keys adjust it; works in the desk view too (NowPlaying renders in both). Toggle FR in the site header, come back to `/` — the slider's accessible name is from the dictionary either way.

- [ ] **Step 7: Commit**

```bash
git add src/lib/room/storage.ts src/components/room/RoomAudioProvider.tsx src/components/room/NowPlaying.tsx src/components/room/Room.tsx src/lib/i18n/dictionaries/en.ts src/lib/i18n/dictionaries/fr.ts
git commit -m "feat: persisted volume slider on the now-playing widget

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Room OG image from background.png (Roadmap 3)

**Files:**
- Create: `scripts/generate-og-image.mjs`
- Create (generated): `src/app/opengraph-image.png` (1200×630)
- Create: `src/app/opengraph-image.alt.txt`
- Delete: `src/app/opengraph-image.tsx` (the monochrome text card)

**Interfaces:**
- Consumes: `public/room/background.png` (1408×768 room art). sharp resolves from `node_modules` (transitive via Next — do NOT add it to package.json).
- Produces: Next's static-file OG convention — `/opengraph-image.png` is picked up automatically for `og:image` on `/`. Per-page OG images under `(site)` are untouched.

Geometry: 1408×768 is 1.833:1; the OG target 1200×630 is 1.905:1 — so crop the source to 1408×739 (centred vertically, offset y=14) and then resize. Default lanczos resampling is correct here — this is a share-card thumbnail, and nearest-neighbour downscaling would produce uneven pixel widths.

- [ ] **Step 1: Write the generator script**

Create `scripts/generate-og-image.mjs`:

```js
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..', 'public', 'room', 'background.png')
const out = join(__dirname, '..', 'src', 'app', 'opengraph-image.png')

// 1408×768 (1.833:1) → crop to 1.905:1 (1408×739, centred) → 1200×630
await sharp(src)
  .extract({ left: 0, top: 14, width: 1408, height: 739 })
  .resize(1200, 630)
  .png()
  .toFile(out)

const meta = await sharp(out).metadata()
console.log(`opengraph-image.png ${meta.width}x${meta.height}`)
```

- [ ] **Step 2: Run it**

Run: `node scripts/generate-og-image.mjs`
Expected: `opengraph-image.png 1200x630`.

- [ ] **Step 3: Alt text + delete the old card**

Create `src/app/opengraph-image.alt.txt` containing exactly:

```
Ahmed Hussain's pixel-art bedroom — the front door to ahmedyhussain.com
```

Then: `git rm src/app/opengraph-image.tsx`

- [ ] **Step 4: Verification**

Run: `npm run type-check && npm run lint && npm run build` — all pass. Then `npm run dev`, load `http://localhost:3000/`, view source: the `og:image` meta URL must end in `/opengraph-image.png` (not a hashed dynamic route), and opening that URL in the browser shows the warm room crop at 1200×630. Check one `(site)` page (e.g. `/games`) still serves its own dynamic OG card.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-og-image.mjs src/app/opengraph-image.png src/app/opengraph-image.alt.txt
git commit -m "feat: room art as the / social share image

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: CLAUDE.md sync, full gate, delete this TODO

**Files:**
- Modify: `CLAUDE.md`
- Delete: `TODO.md` (this file — per docs policy, in this final commit)

- [ ] **Step 1: Update CLAUDE.md**

Precise edits:

(a) **Roadmap** — strike the completed items with the shipped facts:
- Item 1 → `~~Skip-no-repeat~~ — random advance, never repeats current (shared by skip + ended).`
- Item 3 → `~~Room OG image~~ — static 1200×630 crop of background.png at src/app/opengraph-image.png (scripts/generate-og-image.mjs); regenerate if the background art changes.`
- Item 7 → `~~Volume control~~ — range slider on NowPlaying, volume pref in room-save-v1.`
- Item 15 → strike the rate-limiter clause: `~~move the rate limiter to Upstash~~ (done — rl:* keys, in-memory fallback, getClientIp uses x-real-ip/rightmost XFF)`; keep the CSP-nonces clause unstruck.

(b) **Contact System** section — update step 2 of the flow diagram to:
```
  2. Rate-limit by IP (5 req/hr, Upstash-backed fixed window — src/lib/ratelimit.ts;
     in-memory fallback in dev/outage; IP via getClientIp: x-real-ip → rightmost XFF)
```

(c) **Audio** section — after the "Volume 0.3." sentence, replace it with: `Volume defaults to 0.3, adjustable via a NowPlaying range slider, persisted as `volume` in `room-save-v1`. Track advance (skip and `ended`) picks randomly, never repeating the current track.`

(d) **Critical Constraint 3** — update the prefs shape note to `{ audio, lampOn, visitCount, volume }`.

(e) **What Does Not Exist Yet** — remove `durable rate limiting (Roadmap 15)` from the list.

(f) **Assessment paragraph in the Roadmap** — remove the now-stale "then 15 … then the quick wins 1, 2, 7 … then 3 …" recommendation clause or mark those items done, leaving 23 (E2E) as the standing top recommendation.

- [ ] **Step 2: Full pre-deploy gate**

Run: `npm run type-check && npm run lint && npm run build` — all three pass.

- [ ] **Step 3: Final commit — including deleting this file**

```bash
git rm TODO.md
git add CLAUDE.md
git commit -m "docs: CLAUDE.md sync for hardening/audio/OG work; complete and remove TODO

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of Scope (deliberately deferred by the owner)

- Everything else in the CLAUDE.md roadmap — notably 23 (Playwright E2E), 2 (desk session persistence), 8 (SFX), 6 (bonsai growth), 25 (sprite sheets), 26 (server-backed visitor counter). Leave them listed.
- CSP nonces (the remaining unstruck part of item 15).
- Any change to `(site)` page OG images, the desk browser, or room art.
- New dependencies of any kind (sharp stays transitive; no @upstash/ratelimit package — the hand-rolled INCR window is deliberate and dependency-free).
