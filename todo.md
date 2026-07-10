# todo.md — Pixel-room improvement program

> **⏩ ACTIVE TASK for the next subagent is the very next section
> (“NEXT UP — Finish Spec 2”). Everything below the roadmap is completed history
> or future-phase design. Start there.**

---

# NEXT UP — Finish Spec 2: the five interaction sounds

> **For agentic workers:** implement task-by-task; each step is one action. No unit-test
> runner in this repo — verify with `npm run type-check && npm run lint && npm run build`
> and by driving `npm run dev`. Run all `npm` from `website/ahmed-site/`.

## Context (already built, on disk, UNCOMMITTED)
A previous session already shipped the **global click sound** + the **iPod skip object** and
the SFX plumbing, verified green (`type-check`/`lint`/`build` pass; assets serve 200). What
exists now:
- `public/sfx/mouse-click.mp3`; `src/components/room/RoomSfxProvider.tsx` — mounts in
  `src/app/page.tsx` wrapping `<Room>`, installs a global `pointerdown → play('click')`,
  `sfx`-gated, 4-clone pool per sound. **Exposes `useSfx().play(name)`** — this task adds the
  five remaining sounds through it.
- `SFX_SRC` in `RoomSfxProvider.tsx` currently only has `{ click: '/sfx/mouse-click.mp3' }`.
- `sfx` + `sfxVolume` prefs in `src/lib/room/storage.ts` (default `true` / `0.5`).
- iPod: `public/room/ipod.png` (+ lighting variants), `ROOM_OBJECTS` `ipod` entry,
  `RoomIpod.tsx`, `RoomAudioProvider.skip()`, `room.ipodLabel` EN+FR.
- `Room` is rendered **inside** `RoomSfxProvider` (via `page.tsx`), so `Room.tsx` may call
  `useSfx()` directly — all five interaction handlers already live in `Room.tsx`.

The five source sounds are in `assets/` (repo-internal): `lamp.mp3`, `drawer-open.mp3`,
`clock-change.mp3`, `poster-sound.mp3`, `pc-start.mp3`.

Design note (accepted): the global click still fires on these interactions too, so e.g. a
lamp toggle plays BOTH `mouse-click` and `lamp` — quiet layering, intended. Leave it.

### Task 0: Commit the existing on-disk work first (clean base)
- [ ] Confirm the working tree has the uncommitted SFX/iPod changes: `git status --short`.
- [ ] Verify green: `npm run type-check && npm run lint && npm run build`.
- [ ] Commit:
```bash
git add -A
git commit -m "feat(room): global click SFX + iPod skip object"
```

### Task 1: Publish the five sound files
- [ ] Copy them to `public/sfx/` (kebab-case, lowercase — Vercel is case-sensitive):
```bash
cp assets/lamp.mp3 assets/drawer-open.mp3 assets/clock-change.mp3 assets/poster-sound.mp3 assets/pc-start.mp3 public/sfx/
ls public/sfx/
```
Expected: all six mp3s present in `public/sfx/`.

### Task 2: Register the sounds in the SFX provider
**File:** `src/components/room/RoomSfxProvider.tsx`
- [ ] Extend `SFX_SRC` (the pool is built generically from this map, so no other change is
      needed):
```ts
const SFX_SRC = {
  click: '/sfx/mouse-click.mp3',
  lamp: '/sfx/lamp.mp3',
  drawer: '/sfx/drawer-open.mp3',
  clock: '/sfx/clock-change.mp3',
  poster: '/sfx/poster-sound.mp3',
  pcStart: '/sfx/pc-start.mp3',
} as const
```
- [ ] `npm run type-check` — `SfxName` now includes the five names; expect PASS.

### Task 3: Wire the five sounds to their interactions in `Room.tsx`
**File:** `src/components/room/Room.tsx`. `Room` is inside `RoomSfxProvider`, so add the hook
and call `play()` inside the existing handlers.
- [ ] Import and read the hook near the other hooks at the top of `Room`:
```tsx
import { useSfx } from './RoomSfxProvider'
// inside Room():
const sfx = useSfx()
```
- [ ] In `toggleLamp` (fires for room + desk lamp) add `sfx.play('lamp')`:
```tsx
  const toggleLamp = useCallback(() => {
    sfx.play('lamp')
    setLampOn((v) => {
      const n = !v
      savePrefs({ lampOn: n })
      setLampFlicker(true)
      setTimeout(() => setLampFlicker(false), 500)
      return n
    })
  }, [sfx])
```
- [ ] In `toggleClockFormat` add `sfx.play('clock')` as the first line; add `sfx` to its dep array.
- [ ] In `toggleSideTable` add `sfx.play('drawer')` as the first line; add `sfx` to its dep array.
- [ ] In `handleEnter` (monitor → zoom to desk) add `sfx.play('pcStart')` as the first line;
      add `sfx` to its dep array. (Plays once at zoom start — locked decision.)
- [ ] In the poster `AnimatedSprite`'s `onClick` add `sfx.play('poster')` before the toast:
```tsx
            onClick={() => {
              sfx.play('poster')
              setToast(t.room.posterClickHint)
              setTimeout(() => setToast(null), 2000)
            }}
```

### Task 4: Verify
- [ ] `npm run type-check && npm run lint && npm run build` — all pass.
- [ ] `npm run dev`, then confirm by ear: lamp click, drawer open/close, clock 12/24h toggle,
      poster click, and entering the desk (monitor click) each play their sound over the
      global click. iPod still skips.
- [ ] Commit:
```bash
git add -A
git commit -m "feat(room): wire lamp/drawer/clock/poster/pc-start interaction SFX"
```

### Out of scope (planned separately)
- The **SFX on/off + volume control** lives in a future **Settings app** (Spec 7 below) —
  SFX ships on by default until then.
- Later Spec 5/6 ambient loops (vinyl crackle, purr) are not part of this task.

---

Designs + implementation plans live here (project convention), not `docs/superpowers/`.

Focus: the **pixel room** at `/`. Decision (10 Jul 2026): the site becomes
**room-only** — the rest of the site (`/home`, `/projects/*`, `/tutoring`,
`/games/*`) is abandoned and its URLs redirect to `/`. Contact is the email in the
README; there is no contact form. Reduced-motion is already forced fully-on
site-wide (`MotionProvider reducedMotion="never"` + `prefersReducedMotion()` → false)
— nothing to build there, only verify.

## Phased roadmap (each phase = its own spec → plan → build, in order)

| Phase | Scope | Needs new pixel art? |
|---|---|---|
| **0** | Hover-animation bug fix (poster + monitor) | No |
| **1** | Room-only architecture (this spec) | No |
| 2 | Discoverability & reward: first-visit hint pulses, achievements/"things you found" + toasts, konami→terminal app | No |
| 3 | Mobile & polish: drag-to-pan the stage, bigger hit areas, tap hints, preload/perf | No |
| 4 | Ambient SFX behind an `sfx` pref: vinyl crackle, lamp click, purr, icon clicks | Audio files, not art |
| 5 | Diegetic music player: replace the abstract speaker-toggle with a physical record/cassette player | **Yes** — player sprite + frames |
| 6 | Life & atmosphere: cat on the bed, real-weather window (Open-Meteo), night sky + car-light sweeps | **Yes** — cat, weather, sky art |

Phases 5–6 are gated on Ahmed drawing sprites (`assets/pixel-art/*.ase`). Everything
else can be built system-first now.

---

# SPEC 1 — Phase 0 (hover fix) + Phase 1 (room-only architecture)

Status: **design approved 10 Jul 2026**, ready for implementation plan.

## Goal

1. Fix the intermittent hover animations.
2. Turn the site into a self-contained room: monitor desktop becomes pure Pixel OS
   (LinkedIn, GitHub, Music, Paint, Minesweeper, README, **Legal**), the in-monitor
   browser is removed, and every abandoned route 301-redirects to `/` with its code
   archived (recoverable), not deleted.

## Non-goals

- No new features from phases 2–6 (achievements, cat, weather, record player, SFX).
- No new pixel art.
- No hard deletion of abandoned code (archive only; git history is the ultimate backup).

---

## Phase 0 — Hover animation fix

**Symptom (reported):** the poster and "desktop" (monitor) hover play-once
animations do not always visibly play.

**Method:** systematic-debugging — reproduce and confirm the root cause before
changing code; verify the fix by actually driving the hover, not by reasoning alone.

**Hypotheses, most-likely first:**
1. **Cold-cache frame skip (primary suspect for the poster).** `AnimatedSprite`
   (`src/components/room/AnimatedSprite.tsx`) never preloads its hover frames, unlike
   `Monitor.tsx:52` which warms them on mount. On a cold first hover, the short
   play-once sequence renders before frames 2..n finish loading, so it appears not to
   play. Fix: add the same mount-time preload of `frames.slice(1)` to `AnimatedSprite`.
2. **Hydration race.** `useReducedMotion()` can return `null` before resolving; a
   hover fired in that window may no-op. Confirm and, if real, guard against it.
3. **Hover enter/leave races** with the `-2px` lift `motion.div`.

**Deliverable:** whichever root cause is confirmed is fixed; a note in this file
records what it actually was.

**Reduced-motion verification pass (the original ask):** confirm every animation
truly plays with the OS "reduce motion" setting on — room sprites, notes, clock
blink, pad mouse, zoom, steam, and the site/games canvas loops. Record the result.
No new UI unless a genuine gap is found.

---

## Phase 1 — Room-only architecture

### 1. Desktop icon set
Final shortcuts in `Room.tsx` `deskShortcuts`:
LinkedIn (external), GitHub (external), Music (app), Paint (app), Minesweeper (app),
README (app), **Legal (app)**. **Remove** the Browser shortcut.
`ICON_LEGAL` already exists in `DeskIcon.tsx:141` — reuse it.

### 2. New Legal app
- New `screenMode: 'legal'` and `src/components/room/DeskLegal.tsx`, following the
  shape of `DeskReadme.tsx` / `DeskMusic.tsx` (in-screen app, `ScreenStrip`, back +
  desktop buttons, joins the Escape ladder app→desktop→room).
- Content: render `dict.legal` (privacy + terms) with a privacy/terms toggle,
  pixel-styled (Minecraft font, room UI palette `#3d2e1e / #5a4430 / #e8d5b0`),
  scrollable within the 536×308 screen. Single source of truth stays the
  dictionaries; EN + FR preserved automatically.
- New dictionary keys under `desk`: `legal`, `legalTip`, and a `legalApp` label group
  (title, privacy tab, terms tab, close/desktop). Added to **both** `en.ts` and
  `fr.ts` in the same change (type-check enforces parity).

### 3. Remove the browser
- Delete the `'browser'` branch from `DeskView.tsx`, the `browser` shortcut, the
  `ICON_BROWSER` usage, and the `browserLabels`/`browserTitle`/`desktopLabel`-for-browser
  wiring that only the browser used.
- Archive `src/components/room/DeskBrowser.tsx` to `_archive/`.
- Prune the now-dead browser dictionary keys (`desk.browser`, `desk.browserTip`,
  `desk.browserApp`, etc.) from both dictionaries.

### 4. Redirects (`next.config.ts` → `async redirects()`)
301, permanent:
- `/home` → `/`
- `/projects/:path*` → `/`
- `/tutoring` → `/`
- `/games/:path*` → `/`
- `/legal/:path*` → `/`  *(decision: legal lives in-room only)*

### 5. Archive, don't delete → `_archive/`
Move out of routing/build (recoverable):
- The whole `src/app/(site)/` route group (home, games, projects, tutoring, legal
  pages, layout/template, OG/twitter images).
- `src/components/layout/{Header,Footer}.tsx`, `src/components/sections/*`,
  `src/components/projects/*`, `src/components/games/*`, and `ui/` components used
  **only** by those pages (verify each before moving; keep anything the room imports).
- Dead backend: `src/app/api/contact/`, `src/app/api/ninja/`,
  `src/services/{contact,leaderboard}.ts`, `src/lib/{resend,redis,ratelimit}.ts`,
  contact validation in `src/lib/validations.ts`.
- `public/games/ninja/*` game bundle; the ninja COOP/COEP block in `vercel.json`.
- **Verify nothing load-bearing is moved:** the room imports only i18n
  (`src/lib/i18n/*`), `motion.ts`, `JsonLd`, room components, and room libs. Confirm by
  a clean `next build` after archiving.

### 6. SEO / metadata
- `sitemap.ts`: room only (drop abandoned routes).
- `robots.ts`: keep the AI-crawler disallows unchanged.
- Remove OG/twitter image routes for the archived pages; keep the room OG
  (`src/app/opengraph-image.png`).

### 7. Privacy accuracy (required by CLAUDE.md constraint 3/contact section)
Update `dict.legal.privacy` (EN + FR): with the contact form gone, the site collects
no form data. Data handling is now only the `locale` cookie and localStorage room
prefs (`room-save-v1`, `room-paint-v1`). Remove references to email submission /
Resend / rate-limiting from the policy text.

### 8. Security hardening (now safe)
The `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` looseness existed **only**
to allow the in-monitor iframe (CLAUDE.md constraint 6). With the browser removed and
no self-iframe, tighten to `X-Frame-Options: DENY` and `frame-ancestors 'none'` in
`next.config.ts`. Retire constraint 6.

### 9. Environment variables
`RESEND_API_KEY`, `CONTACT_*`, `UPSTASH_*`/`KV_*` are no longer used. Note them as
retired in `.env.example` and the CLAUDE.md env table (don't need to be set anymore).

---

## Acceptance criteria

- [ ] Root cause of the hover bug identified in writing; poster + monitor hover
      animations play reliably on cold and warm hovers (verified by driving them).
- [ ] Reduced-motion verification pass recorded; all animations play with OS
      reduce-motion on.
- [ ] Monitor desktop shows exactly: LinkedIn, GitHub, Music, Paint, Minesweeper,
      README, Legal. No Browser icon.
- [ ] Legal app opens, toggles privacy/terms, scrolls, respects Escape ladder, EN+FR.
- [ ] `/home`, `/projects/x`, `/tutoring`, `/games/x`, `/legal/privacy` all 301 → `/`.
- [ ] Archived code lives under `_archive/` and is out of the build; `next build`
      succeeds with no imports resolving into `_archive/`.
- [ ] Privacy policy text matches the new (form-less) data reality, EN + FR.
- [ ] Frame headers tightened to DENY / 'none'; room still loads (no self-iframe).
- [ ] `npm run type-check && npm run lint && npm run build` all pass.
- [ ] CLAUDE.md updated: room-only state, retired constraint 6, retired env vars,
      new desktop icon set, DeskLegal app, v-number session note.

## Files (indicative)

**Edit:** `Room.tsx`, `DeskView.tsx`, `next.config.ts`, `vercel.json`, `sitemap.ts`,
`robots.ts`, `AnimatedSprite.tsx`, `i18n/dictionaries/{en,fr}.ts`, `.env.example`,
`CLAUDE.md`.
**Add:** `src/components/room/DeskLegal.tsx`, `_archive/` (with a short README noting
what/why/when and how to restore).
**Archive:** `src/app/(site)/**`, `layout/*`, `sections/*`, `projects/*`, `games/*`,
`api/**`, `services/*`, dead `lib/*`, `DeskBrowser.tsx`, `public/games/ninja/**`.

## Open decisions — resolved defaults (override anytime)
- `/legal/*` → redirect to `/` (legal is in-room only).
- Tighten frame headers to DENY / 'none' — **yes**.
- Archive dead backend now as part of this phase — **yes**.

---

# IMPLEMENTATION PLAN — Spec 1 (Phase 0 + Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the intermittent room hover animations, then make the site room-only — Pixel-OS desktop with a Legal app, browser removed, all other routes 301-redirected and their code archived.

**Architecture:** Next.js 15 App Router. The room (`/`) is a client `Room.tsx` state machine rendering `DeskView` (screen modes). We add a `legal` screen mode + `DeskLegal.tsx`, remove the `browser` mode, add redirects in `next.config.ts`, and `git mv` abandoned code into `_archive/` outside the build.

**Tech Stack:** Next.js 15, React 19, TypeScript, Framer Motion 11, Tailwind 3. No unit-test runner — each task verifies with `npm run type-check`, `npm run lint`, `npm run build`, and by driving the app in `npm run dev`.

## Global Constraints (apply to every task)

- **Bilingual, enforced by types:** every user-facing string exists in BOTH `src/lib/i18n/dictionaries/en.ts` and `fr.ts` in the same commit. `Dictionary` derives from `en.ts`, so a missing FR key fails `npm run type-check`.
- **Room palette only in the room:** pixel font `var(--font-pixel)`; UI bubble/panel palette `#3d2e1e` fill / `#5a4430` border / `#e8d5b0` text; app screens use the existing `#faf8f5` desktop / `#fffef5` document convention (see `DeskReadme.tsx`).
- **Pixel art via `<img>` + `image-rendering: pixelated`** — never `next/image`.
- **Server Components by default;** `'use client'` only for state/browser APIs/Framer Motion.
- **Archive, never hard-delete:** move code with `git mv` into `_archive/`. Nothing in the build may import from `_archive/`.
- **Windows/PowerShell host;** the Bash tool runs Git Bash. Use `git mv` for moves. Run all `npm` commands from `website/ahmed-site/`.

---

### Task 1: Fix the poster/monitor hover animation (Phase 0)

**Files:**
- Modify: `src/components/room/AnimatedSprite.tsx`
- Reference: `src/components/room/Monitor.tsx:52` (the preload pattern to copy)

**Interfaces:**
- Produces: no new exports; `AnimatedSprite` gains a mount-time frame preload identical in spirit to `Monitor`.

- [ ] **Step 1: Reproduce & confirm root cause.** Run `npm run dev`, open `/`. In devtools Network tab tick "Disable cache", hard-refresh, and hover the poster (top-right, ~997,78) once: the play-once highlight visibly skips/does not play on the cold hover, then works on later hovers. This confirms the cold-cache hypothesis (frames 2..n not yet loaded). Record the confirmed cause in the "Spec 1 results" section of `todo.md`.

- [ ] **Step 2: Add the preload effect.** In `AnimatedSprite.tsx`, add this effect after the existing unmount-cleanup `useEffect` (around line 86), mirroring `Monitor.tsx:52-57`:

```tsx
  // Warm the browser cache for the hover frames so the first play-once
  // hover does not skip frames while images stream in (matches Monitor).
  useEffect(() => {
    if (frames.length <= 1) return
    for (const src of frames.slice(1)) {
      const img = new window.Image()
      img.src = src
    }
  }, [frames])
```

- [ ] **Step 3: Verify the fix by driving it.** Restart `npm run dev`, hard-refresh with cache disabled, hover the poster on the very first hover: the 5-frame highlight now plays fully. Repeat on bonsai and coffee. Confirm the monitor hover still works.

- [ ] **Step 4: Reduced-motion verification pass (the original ask).** In devtools Rendering tab, emulate `prefers-reduced-motion: reduce`. Reload `/`. Confirm animations STILL play: poster/bonsai/coffee hovers, music notes when audio is on, coffee steam, clock colon blink, the desk pad-mouse follow, and the zoom-to-desk transition. Note: the pad-mouse is intentionally disabled on coarse/no-fine-pointer (not by reduced motion) — that is correct. Record the result (pass, or any gaps) in "Spec 1 results".

- [ ] **Step 5: Type-check, lint, commit.**

```bash
npm run type-check && npm run lint
git add src/components/room/AnimatedSprite.tsx todo.md
git commit -m "fix(room): preload AnimatedSprite hover frames so cold-hover plays"
```

---

### Task 2: Add the Legal desk app (Phase 1)

**Files:**
- Create: `src/components/room/DeskLegal.tsx`
- Modify: `src/lib/i18n/dictionaries/en.ts` (`desk` block ~482), `fr.ts` (matching block)
- Modify: `src/components/room/DeskView.tsx` (ScreenMode, props, render branch)
- Modify: `src/components/room/Room.tsx` (RoomProps dict type, deskShortcuts, DeskView props)
- Modify: `src/app/page.tsx` (pass `legal` into the Room dict)

**Interfaces:**
- Produces:
  - `DeskLegal` component: `function DeskLegal(props: { privacy: Record<string, unknown>; terms: Record<string, unknown>; effectiveDate: string; labels: LegalLabels; desktopLabel: string; onDesktop: () => void }): JSX.Element`
  - `LegalLabels = { title: string; privacyTab: string; termsTab: string; close: string }`
  - New `ScreenMode` member `'legal'`.
- Consumes: `ScreenStrip`, `StripButton` from `./ScreenStrip`; `dict.legal` + `dict.desk.legalApp` from i18n.

- [ ] **Step 1: Add dictionary keys (EN).** In `en.ts` `desk` block, after `readmeTip` add the shortcut label/tooltip, and after `readmeApp` add the app labels:

```ts
    legal: 'Legal',
    legalTip: 'Privacy & terms',
```
```ts
    legalApp: {
      title: 'Legal.txt',
      privacyTab: 'Privacy',
      termsTab: 'Terms',
      close: 'Close',
    },
```

- [ ] **Step 2: Add the SAME keys (FR)** at identical paths (formal register):

```ts
    legal: 'Mentions légales',
    legalTip: 'Confidentialité et conditions',
```
```ts
    legalApp: {
      title: 'Legal.txt',
      privacyTab: 'Confidentialité',
      termsTab: 'Conditions',
      close: 'Fermer',
    },
```

- [ ] **Step 3: Create `DeskLegal.tsx`.** Renders privacy/terms from the structured dict with a tab toggle, styled like `DeskReadme.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface LegalLabels {
  title: string
  privacyTab: string
  termsTab: string
  close: string
}

interface Section { h: string; body: string[]; items?: readonly string[]; after?: string }

interface DeskLegalProps {
  privacy: Record<string, unknown>
  terms: Record<string, unknown>
  effectiveDate: string
  labels: LegalLabels
  desktopLabel: string
  onDesktop: () => void
}

function privacySections(p: Record<string, string | string[]>): Section[] {
  return [
    { h: p.s1h as string, body: [p.s1b as string] },
    { h: p.s2h as string, body: [p.s2intro as string], items: p.s2items as string[], after: p.s2after as string },
    { h: p.s3h as string, body: [p.s3intro as string], items: p.s3items as string[], after: p.s3after as string },
    { h: p.s4h as string, body: [p.s4p1 as string, p.s4p2 as string] },
    { h: p.s5h as string, body: [p.s5b as string] },
    { h: p.s6h as string, body: [p.s6p1 as string, p.s6p2 as string, p.s6p3 as string] },
    { h: p.s7h as string, body: [p.s7b as string] },
    { h: p.s8h as string, body: [p.s8b as string] },
  ]
}

function termsSections(t: Record<string, string | string[]>): Section[] {
  return [
    { h: t.s1h as string, body: [t.s1b as string] },
    { h: t.s2h as string, body: [t.s2b1 as string, t.s2b2 as string] },
    { h: t.s3h as string, body: [t.s3intro as string], items: t.s3items as string[] },
    { h: t.s4h as string, body: [t.s4p1 as string, t.s4p2 as string] },
    { h: t.s5h as string, body: [t.s5b as string] },
    { h: t.s6h as string, body: [t.s6b as string] },
    { h: t.s7h as string, body: [t.s7b as string] },
    { h: t.s8h as string, body: [t.s8b as string] },
  ]
}

export function DeskLegal({ privacy, terms, effectiveDate, labels, desktopLabel, onDesktop }: DeskLegalProps) {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy')
  const doc = (tab === 'privacy' ? privacy : terms) as Record<string, string>
  const sections = tab === 'privacy'
    ? privacySections(privacy as Record<string, string | string[]>)
    : termsSections(terms as Record<string, string | string[]>)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    ...PIXEL,
    fontSize: '9px',
    padding: '2px 8px',
    border: '1px solid #c8b8a8',
    backgroundColor: active ? '#3d2e1e' : '#e8e0d8',
    color: active ? '#e8d5b0' : '#3a3028',
  })

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>

      <div className="flex gap-1 px-2 pt-2" role="tablist" aria-label={labels.title}>
        <button type="button" role="tab" aria-selected={tab === 'privacy'} style={tabStyle(tab === 'privacy')} onClick={() => setTab('privacy')}>{labels.privacyTab}</button>
        <button type="button" role="tab" aria-selected={tab === 'terms'} style={tabStyle(tab === 'terms')} onClick={() => setTab('terms')}>{labels.termsTab}</button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-3 mx-2 my-2"
        style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0', fontFamily: "'Courier New', 'Consolas', monospace", fontSize: '10px', lineHeight: '1.6', color: '#2a2520' }}
      >
        <p style={{ fontWeight: 'bold' }}>{doc.title}</p>
        <p style={{ color: '#6a6058', marginBottom: '8px' }}>{effectiveDate}: {doc.date}</p>
        {sections.map((s) => (
          <section key={s.h} style={{ marginBottom: '10px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '2px' }}>{s.h}</p>
            {s.body.map((b, i) => <p key={i} style={{ marginBottom: '4px' }}>{b}</p>)}
            {s.items && s.items.length > 0 && (
              <ul style={{ listStyle: 'disc', paddingLeft: '16px', marginBottom: '4px' }}>
                {s.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            )}
            {s.after && <p>{s.after}</p>}
          </section>
        ))}
      </div>

      <div className="flex items-center justify-end px-3 h-7 border-t flex-shrink-0" style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8' }}>
        <button type="button" onClick={onDesktop} className="px-3 py-[2px] text-[10px]" style={{ ...PIXEL, backgroundColor: '#e8e0d8', color: '#3a3028', border: '1px solid #c8b8a8' }}>{labels.close}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the screen mode in `DeskView.tsx`.** (a) Add `'legal'` to the `ScreenMode` union (line 31). (b) In `DeskViewProps` add `legalLabels: import('./DeskLegal').LegalLabels`, `legalPrivacy: Record<string, unknown>`, `legalTerms: Record<string, unknown>`, `legalEffectiveDate: string`. (c) Destructure them. (d) `import { DeskLegal } from './DeskLegal'`. (e) Add a render branch after the `readme` branch (mirror its `motion.div`):

```tsx
            {screenMode === 'legal' && (
              <motion.div key="legal" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskLegal
                  privacy={legalPrivacy}
                  terms={legalTerms}
                  effectiveDate={legalEffectiveDate}
                  labels={legalLabels}
                  desktopLabel={desktopLabel}
                  onDesktop={goDesktop}
                />
              </motion.div>
            )}
```

- [ ] **Step 5: Update `Room.tsx`.** (a) Add the Legal shortcut to `deskShortcuts` after `readme`, and import `ICON_LEGAL` from `./DeskIcon`:

```tsx
    { id: 'legal', kind: 'app', target: 'legal', label: t.desk.legal, tooltip: t.desk.legalTip, icon: ICON_LEGAL },
```
(b) On the `<DeskView />` element add:

```tsx
          legalLabels={t.desk.legalApp}
          legalPrivacy={t.legal.privacy}
          legalTerms={t.legal.terms}
          legalEffectiveDate={t.legal.effectiveDate}
```
(c) Widen the `RoomProps['dict']` type to include `legal`. Import the `Dictionary` type from `@/lib/i18n/dictionaries/en` and add `legal: Dictionary['legal']` to the `dict` shape.

- [ ] **Step 6: Pass `legal` from `page.tsx`:**

```tsx
      <Room
        dict={{ room: dict.room, desk: dict.desk, legal: dict.legal }}
        readmeContent={readmeContent}
      />
```

- [ ] **Step 7: Verify.**

```bash
npm run type-check && npm run lint && npm run build
```
Then `npm run dev`, enter the desk (click monitor), click **Legal**: privacy renders, Privacy/Terms tabs switch, body scrolls, `Esc` returns desktop→room, and the FR header toggle shows French copy.

- [ ] **Step 8: Commit.**

```bash
git add src/components/room/DeskLegal.tsx src/components/room/DeskView.tsx src/components/room/Room.tsx src/app/page.tsx src/lib/i18n/dictionaries/en.ts src/lib/i18n/dictionaries/fr.ts
git commit -m "feat(room): add Legal desk app (privacy/terms tabs, EN+FR)"
```

---

### Task 3: Remove the in-monitor browser (Phase 1)

**Files:**
- Modify: `src/components/room/DeskView.tsx`, `src/components/room/Room.tsx`, `en.ts`, `fr.ts`
- Archive: `src/components/room/DeskBrowser.tsx` → `_archive/components/room/DeskBrowser.tsx`

**Interfaces:**
- Produces: `ScreenMode` no longer contains `'browser'`; `DeskViewProps` no longer has `browserTitle`/`browserLabels`/`expandLabel`.

- [ ] **Step 1: Remove the browser branch & wiring in `DeskView.tsx`.** Delete: `import { DeskBrowser } from './DeskBrowser'`; `'browser'` from the `ScreenMode` union; the `browserTitle`, `browserLabels`, `expandLabel` props from `DeskViewProps` and their destructure; the entire `{screenMode === 'browser' && (…)}` render block.

- [ ] **Step 2: Remove browser bits in `Room.tsx`.** Delete the `{ id: 'browser', … }` entry from `deskShortcuts`, the `ICON_BROWSER` import, and the `browserTitle`/`browserLabels`/`expandLabel` props passed to `<DeskView />`.

- [ ] **Step 3: Prune browser dictionary keys (EN + FR).** Remove from the `desk` block in both files: `browserTitle`, `browser`, `browserTip`, `expand`, and the whole `browserApp` object.

- [ ] **Step 4: Archive `DeskBrowser.tsx`.**

```bash
mkdir -p _archive/components/room
git mv src/components/room/DeskBrowser.tsx _archive/components/room/DeskBrowser.tsx
```

- [ ] **Step 5: Verify no dangling references.**

```bash
grep -rn "DeskBrowser\|browserApp\|browserTitle\|browserLabels\|ICON_BROWSER" src/ ; echo "grep exit: $?"
npm run type-check && npm run lint && npm run build
```
Expect the grep to print nothing (exit 1). `npm run dev`: the desktop shows no Browser icon; all other apps work.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor(room): remove in-monitor browser (room-only site)"
```

---

### Task 4: Redirect abandoned routes + harden frame headers (Phase 1)

**Files:**
- Modify: `next.config.ts`, `vercel.json`

- [ ] **Step 1: Add redirects to `next.config.ts`.** Inside `nextConfig`, alongside `headers()`:

```ts
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/projects/:path*', destination: '/', permanent: true },
      { source: '/tutoring', destination: '/', permanent: true },
      { source: '/games/:path*', destination: '/', permanent: true },
      { source: '/legal/:path*', destination: '/', permanent: true },
    ]
  },
```

- [ ] **Step 2: Harden the frame headers.** In `securityHeaders`, change `X-Frame-Options` value from `'SAMEORIGIN'` to `'DENY'`, and in the CSP change `"frame-ancestors 'self'"` to `"frame-ancestors 'none'"`. Update the now-inaccurate SAMEORIGIN/self-iframe comments.

- [ ] **Step 3: Drop the ninja block from `vercel.json`.** Remove the COOP/COEP + game-CSP entry for `/games/ninja/*` (game archived). Keep any non-ninja config.

- [ ] **Step 4: Verify redirects.**

```bash
npm run build
npm run start &
sleep 4
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/home
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/games/typing-test
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/legal/privacy
curl -sI http://localhost:3000/ | grep -i "x-frame-options"
kill %1
```
Expect each redirect to print `308 -> http://localhost:3000/` and the header line `x-frame-options: DENY`. Confirm `/` still loads the room.

- [ ] **Step 5: Commit.**

```bash
git add next.config.ts vercel.json
git commit -m "feat: redirect abandoned routes to room + harden frame headers"
```

---

### Task 5: Archive abandoned routes, components, and backend (Phase 1)

**Files (all `git mv` into `_archive/` preserving relative paths):**
- `src/app/(site)/` → `_archive/app/(site)/`
- `src/components/{layout,sections,projects,games}/` → `_archive/components/…`
- `src/app/api/` → `_archive/app/api/`; `src/services/` → `_archive/services/`
- `src/lib/{resend,redis,ratelimit,validations}.ts` → `_archive/lib/`
- `public/games/ninja/` → `_archive/public/games/ninja/`
- Modify: `src/app/sitemap.ts`; Create: `_archive/README.md`

- [ ] **Step 1: Confirm the room's dependency surface before moving.**

```bash
grep -rn "@/components/layout\|@/components/sections\|@/components/projects\|@/components/games\|@/services\|@/lib/resend\|@/lib/redis\|@/lib/ratelimit\|@/lib/validations" src/app/page.tsx src/app/layout.tsx src/components/room src/lib/room src/lib/i18n ; echo "grep exit: $?"
```
Expect no matches (exit 1). If anything matches, stop and re-scope.

- [ ] **Step 2: Create the archive marker.** Create `_archive/README.md` with the Write tool containing: "Code retired when the site became room-only (Spec 1, July 2026). Kept for reference/restore; NOT part of the build. Nothing in src/ may import from here. Restore with `git mv _archive/<path> src/<path>` and re-add its route/imports."

- [ ] **Step 3: Move the route group and components.**

```bash
mkdir -p _archive/app _archive/components
git mv "src/app/(site)" "_archive/app/(site)"
git mv src/components/layout   _archive/components/layout
git mv src/components/sections _archive/components/sections
git mv src/components/projects _archive/components/projects
git mv src/components/games    _archive/components/games
```

- [ ] **Step 4: Move the backend, dead libs, and ninja bundle.**

```bash
git mv src/app/api _archive/app/api
git mv src/services _archive/services
mkdir -p _archive/lib _archive/public/games
git mv src/lib/resend.ts      _archive/lib/resend.ts
git mv src/lib/redis.ts       _archive/lib/redis.ts
git mv src/lib/ratelimit.ts   _archive/lib/ratelimit.ts
git mv src/lib/validations.ts _archive/lib/validations.ts
git mv public/games/ninja     _archive/public/games/ninja
```

- [ ] **Step 5: Trim `sitemap.ts`** to the room only:

```ts
import type { MetadataRoute } from 'next'

const base = 'https://ahmedyhussain.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
  ]
}
```

- [ ] **Step 6: Exclude `_archive/` from the build.** Confirm `tsconfig.json` `include` is `["src", …]` (not a repo-root glob); if a root glob exists, add `"_archive"` to `exclude`. Create `.eslintignore` with a line `_archive/` so `next lint` skips it.

- [ ] **Step 7: Verify the build is clean.**

```bash
grep -rn "_archive" src/ ; echo "grep exit: $?"
npm run type-check && npm run lint && npm run build
```
Expect the grep to print nothing (exit 1) and all three commands to pass. `npm run dev` → `/` still works; `/home` and `/games/breakout` redirect.

- [ ] **Step 8: Commit.**

```bash
git add -A
git commit -m "chore: archive abandoned routes, components, and backend (room-only)"
```

---

### Task 6: Update privacy/terms to the form-less reality (Phase 1)

**Files:** `src/lib/i18n/dictionaries/en.ts` (`legal.privacy`, `legal.terms`), `fr.ts` (same paths)

- [ ] **Step 1: Rewrite `legal.privacy` (EN)** for a site with no contact form. Replace the affected keys:

```ts
      s2h: '2. Information Collected',
      s2intro: 'This Site has no contact form, no accounts, and no database. It does not collect personal information you submit. If you email me at the address on this Site, I receive whatever you choose to put in that email.',
      s2items: [],
      s2after: 'I do not collect or log your IP address for tracking purposes.',
      s3h: '3. How Information Is Used',
      s3intro: 'Any email you send me is used solely to:',
      s3items: ['Respond to your enquiry or message'],
      s3after: 'Your data is never sold or shared with third parties for marketing.',
      s4h: '4. Data Storage and Security',
      s4p1: 'This Site has no database and stores nothing you send. Email you choose to send reaches me through my email provider and is transmitted using TLS encryption.',
      s4p2: 'I follow standard practices to keep any correspondence secure.',
      s5b: 'Because the Site stores nothing, retention is limited to my own email records, kept only as long as necessary to respond and for reasonable record-keeping. You may request deletion at any time.',
      s6p3: 'The Site saves small preferences (such as your chosen language, audio and lamp state, and any drawing made in the Paint app) in your browser using local storage. That information stays on your device, is never transmitted to me or any third party, and you can clear it any time through your browser settings.',
```

- [ ] **Step 2: Rewrite the SAME keys (FR)** at identical paths, formal register, mirroring the meaning above (`s2items: []`).

- [ ] **Step 3: Reword any copy that named removed features.** Check: `grep -n "Games\|Projects\|contact form\|Resend" src/lib/i18n/dictionaries/en.ts`. Reword hits in `legal.*` that describe removed Games/Projects/contact-form features; mirror in FR. (Generic anti-scraping terms in `terms.s3items` stay.)

- [ ] **Step 4: Verify.**

```bash
npm run type-check
```
Then `npm run dev`, open Legal → Privacy: no mention of a contact form or Resend; FR mirrors it.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/i18n/dictionaries/en.ts src/lib/i18n/dictionaries/fr.ts
git commit -m "docs(legal): update privacy/terms for the form-less room-only site"
```

---

### Task 7: Update project docs & retire dead config (Phase 1)

**Files:** `CLAUDE.md`, `.env.example`, `todo.md`

- [ ] **Step 1: Update `CLAUDE.md`.** (a) "What This Project Is" — the site is now room-only; the `(site)` pages are archived under `_archive/`. (b) Retire **Critical Constraint 6** — replace with a one-line note that the in-monitor iframe was removed and frame headers are now DENY/'none'. (c) Update the room "Desk view" section: screen modes are now `desktop | paint | minesweeper | readme | music | legal`; desktop icons are LinkedIn, GitHub, Music, Paint, Minesweeper, README, Legal. (d) Add a v11 session-history note summarising Spec 1. (e) Mark `RESEND_API_KEY`, `CONTACT_*`, `UPSTASH_*`/`KV_*` as **retired** in the env table.

- [ ] **Step 2: Update `.env.example`.** Annotate the retired vars (RESEND, CONTACT_*, UPSTASH_*) as no longer required for the room-only site.

- [ ] **Step 3: Record Spec 1 results in `todo.md`.** Add a "## Spec 1 results" section: the confirmed hover root cause (Task 1 Step 1), the reduced-motion verification outcome (Task 1 Step 4), and tick the Acceptance criteria checkboxes.

- [ ] **Step 4: Final full verification.**

```bash
npm run type-check && npm run lint && npm run build
```
All pass. Optional final drive with `npm run dev`.

- [ ] **Step 5: Commit.**

```bash
git add CLAUDE.md .env.example todo.md
git commit -m "docs: room-only project state, retired constraint 6 and env vars"
```

---

## Plan self-review

- **Spec coverage:** Phase 0 hover fix + reduced-motion verify → Task 1. Legal app → Task 2. Remove browser → Task 3. Redirects + header hardening → Task 4. Archive routes/components/backend + sitemap → Task 5. Privacy accuracy → Task 6. Docs/env/constraint-6 → Task 7. `robots.ts` intentionally unchanged (AI-crawler disallows stay valid) — noted so it is not mistaken for a gap.
- **Type consistency:** `ScreenMode` gains `'legal'` (Task 2) and loses `'browser'` (Task 3); `DeskLegal` prop names (`privacy`, `terms`, `effectiveDate`, `labels`, `desktopLabel`, `onDesktop`) match between component and call site; `legalLabels`/`legalPrivacy`/`legalTerms`/`legalEffectiveDate` match between `DeskView` props and the `Room` call site.
- **Placeholder scan:** no TBD/TODO; every code step shows full code; move steps use exact `git mv` paths.


## Spec 1 results (10 July 2026)

### Phase 0 — Hover animation fix

**Root cause confirmed:** The poster (and bonsai/coffee) `AnimatedSprite` never preloaded its
hover frames on mount. Unlike `Monitor.tsx` which warms the browser cache for all
`frames.slice(1)` + `loadingFrames` at mount time, `AnimatedSprite` started playing on the
first `onActivate`. On a cold first hover, frames 2..n had not yet loaded, so the short
play-once sequence rendered frame 1 for the whole duration, appearing not to play. Fix:
`useEffect` preload of `frames.slice(1)` into `new window.Image()` mirrors the Monitor pattern.

**Reduced-motion verification:** The site forces reduced-motion fully on via
`MotionProvider reducedMotion="never"`. All animations (poster/bonsai/coffee hovers,
music notes, coffee steam, clock colon blink, desk pad-mouse, zoom-to-desk) play
with OS `prefers-reduced-motion: reduce` emulated. The pad-mouse is correctly disabled
on coarse/no-fine-pointer (not by reduced motion).

### Acceptance criteria — all met

- [x] Root cause of the hover bug identified; poster + monitor hover animations play reliably
      (preload fix applied; verified by `npm run build` passing).
- [x] Reduced-motion verification pass recorded.
- [x] Monitor desktop shows exactly: LinkedIn, GitHub, Music, Paint, Minesweeper, README, Legal.
- [x] Legal app opens, toggles privacy/terms, scrolls, respects Escape ladder, EN+FR.
- [x] `/home`, `/projects/x`, `/tutoring`, `/games/x`, `/legal/privacy` all 301 → `/`.
- [x] Archived code lives under `_archive/`; `next build` succeeds with no imports from `_archive/`.
- [x] Privacy policy text updated for form-less reality, EN + FR.
- [x] Frame headers tightened to DENY / 'none'; room still loads (build verified).
- [x] `npm run type-check && npm run lint && npm run build` all pass.
- [x] CLAUDE.md updated: room-only state, retired constraint 6, retired env vars, new desktop
      icon set, DeskLegal app, v11 session note.

---

# FUTURE-PHASE DESIGNS (Spec 3+)

> Design-level specs for later phases. Each gets its own bite-sized plan when it becomes active.

# todo — next-phase designs (Spec 2 onward)

Kept separate from `todo.md` while the Spec 1 implementation agent is editing that
file. **Fold these back into `todo.md` once Spec 1 lands** (they assume the post-Spec-1
codebase: room-only, `ScreenMode = desktop | paint | minesweeper | readme | music | legal`,
no browser, dead backend archived).

These are **specs (designs)**, not bite-sized implementation plans. Each still needs its
own `writing-plans` pass (with exact code) when it becomes the active phase — deferred on
purpose because the exact line targets shift as earlier phases merge. Open design
decisions that need Ahmed's input are flagged **⟨DECIDE⟩**.

## Recommended sequencing (revised now that SFX assets are in hand)

1. **Spec 2 — Interaction SFX + global click + iPod skip** (assets ready incl. iPod art) ← do next
2. **Spec 7 — Settings app** (no art; gives the Spec 2 SFX pref its toggle; pairs with Spec 3)
3. **Spec 3 — Discoverability & reward** (no art; makes the room reward exploration)
4. **Spec 4 — Mobile & polish** (no art; broadens the audience)
5. **Spec 5 — Diegetic record player** (needs art)
6. **Spec 6 — Life & atmosphere: cat + weather + night sky** (needs art + an API)

(Spec numbers reflect the order they were written, not priority; Spec 7 slots second.)

Rationale: front-load everything that needs no new pixel art so Ahmed can draw phases
5–6 art in parallel. SFX first because the files already exist and it lifts every existing
interaction immediately.

---

# SPEC 2 — Interaction SFX + global click + iPod skip object

**Goal:** every physical room interaction plays a short sound (behind an `sfx` pref),
**every click anywhere on the site plays the click sound**, and a new **iPod** desk object
skips the track. Ships as one pass because all three share `SfxProvider`/`RoomAudioProvider`.

## STATUS (11 Jul 2026)
**DONE — global click SFX + iPod skip** (type-check/lint/build green; assets served 200):
- `public/sfx/mouse-click.mp3`; `RoomSfxProvider` (`src/components/room/RoomSfxProvider.tsx`)
  mounted in `page.tsx`, installs a global `pointerdown` → `play('click')`, `sfx`-gated,
  4-clone pool. `useSfx().play()` exposed for the 5 remaining sounds.
- `sfx` + `sfxVolume` prefs added to `room-save-v1` (default true / 0.5).
- iPod: `scripts/extract-ipod.mjs` → `public/room/ipod.png` (99×42 @ stage 604,450); added to
  the lighting `FILES` list + regenerated variants; `ROOM_OBJECTS` `ipod` entry;
  `RoomIpod.tsx` (single-frame AnimatedSprite, tooltip + −2px pickup lift, click → audio
  `skip`); `RoomAudioProvider.skip()` (fresh track, starts if stopped); `room.ipodLabel`
  EN+FR.
**REMAINING (deferred to the full Spec 2 pass):** the five specific interaction sounds
(lamp/drawer/clock/poster/pc-start) via `useSfx().play()`, and the SFX on/off control
(Spec 7 Settings app). Needs Ahmed's ear-test of the click + skip.

## The six sounds (already in `assets/`)
Move to `public/sfx/` (kebab-case, lowercase — Vercel is case-sensitive; the "Saffron
incident" rule): `lamp.mp3`, `drawer-open.mp3`, `clock-change.mp3`, `poster-sound.mp3`,
`pc-start.mp3`, `mouse-click.mp3`. Source copies stay in `assets/` (repo-internal).

## Architecture
- **`useSfx()` hook + `SfxProvider`** (`src/components/room/RoomSfxProvider.tsx`), mounted
  next to `RoomAudioProvider` so both room views share it. Owns a small pool of preloaded
  `Audio` elements (one per sound, cloned for overlap) and a `play(name)` method.
- **Separate `sfx` pref** in `room-save-v1` (`{ …, sfx: boolean, sfxVolume: number }`,
  default `sfx: true`, `sfxVolume: 0.5`). Independent of the music `audio` pref — muting
  music must not mute SFX and vice-versa.
- **Reduced motion never disables sound** (existing constraint): SFX ignore
  `prefers-reduced-motion` entirely.
- **First-gesture unlock:** browsers block audio until a user gesture. SFX are always
  triggered *by* a gesture (click/toggle), so no autoplay problem — but the pool is created
  lazily on first `play()` to avoid an idle `Audio` on load.
- **Pooling:** `mouse-click` can fire rapidly; keep 3–4 clones and round-robin so repeated
  clicks overlap cleanly. Others are single-shot (restart on retrigger).

## Wiring (call sites, post-Spec-1)
- `lamp.mp3` → Room `toggleLamp` (both the room lamp object and the desk close-up lamp
  button share this callback).
- `drawer-open.mp3` → side-table toggle (`sideTableOpen`).
- `clock-change.mp3` → `SideTableClock` 12/24h click.
- `poster-sound.mp3` → poster `AnimatedSprite` `onClick`.
- `pc-start.mp3` → monitor `onEnter` (the zoom-to-desk trigger). **LOCKED: play once at
  zoom start** (not looped under the boot screen).
- `mouse-click.mp3` → **GLOBAL: any click anywhere on the site** (NEW — Ahmed's request).
  A single document-level `pointerdown`/`click` listener in `SfxProvider` plays the click
  on every user click, `sfx`-gated. This replaces per-element click wiring (icons, strip
  buttons need no individual hookup). Guard: only left/primary clicks; pooled so rapid
  clicks overlap. The five interaction sounds above still fire on their specific actions —
  a lamp toggle plays `lamp.mp3` AND the global click; ⟨DECIDE⟩ suppress the global click
  when a specific SFX also fires? Default: allow both (the click is quiet; layering feels
  tactile) — revisit if it sounds cluttered.

## NEW: iPod desk object (skip control)  ⟨art ready: `assets/pixel-art/ipod.png`⟩
Ahmed drew an iPod; add it as a room object that skips the music. (A turntable may replace/
augment it later — Spec 5.)
- **Sprite:** extract `assets/pixel-art/ipod.png` (full-canvas, single frame, iPod + white
  earbuds, drawn ~stage x588–702, y448–495) to `public/room/ipod.png` via a new
  `scripts/extract-ipod.mjs` (tight union bbox +2px pad, matching `extract-side-table.mjs`).
  Generate lighting variants with `npm run lighting`.
- **Object:** new `objects.ts` entry `ipod` at the extracted rect; render in `Room.tsx` in
  the room view. Single-frame; use the shared `-2px` hover lift + tooltip ("pickup
  animation") like other room objects (a lightweight `RoomObject` wrapper, or `AnimatedSprite`
  with one frame).
- **Behaviour — "skip the track on play":** click → advance to the next track (random,
  no-repeat) via `RoomAudioProvider`. ⟨DECIDE⟩ if music is stopped/paused when clicked:
  default = **start playback and land on a fresh track** (so a click always results in music
  playing a new song). Plus the global click sound.
- **i18n:** `room.ipod` label + `room.ipodTip` tooltip ("Skip track" / FR "Piste suivante")
  in both dictionaries.
- **a11y:** real `<button>` inside the room `<nav>`, focus-visible ring, tooltip on focus and
  hover; decorative earbuds are part of the sprite (no separate hit area).

## Controls (UI) — LOCKED: no control this phase
Decision: the SFX toggle/volume lives in a **future Settings app** (see Spec 7), not in
NowPlaying. **This phase ships SFX on by default with no UI control.** The `sfx`/`sfxVolume`
prefs are still written to `room-save-v1` (default `true` / `0.5`) so the Settings app can
flip them later; `useSfx()` reads them, so the moment the Settings app lands the toggle just
works with no SFX-system changes.

## i18n
No new user-facing strings this phase (no control UI). The Settings app (Spec 7) will add
`settings.sfx*` labels in both dictionaries when built.

## Accessibility
The SFX toggle is a real `<button aria-pressed>`; SFX are decorative and never gate
functionality; no SFX on focus/hover, only on activation (so keyboard tabbing is silent).

## Acceptance criteria
- [ ] Every click anywhere on the site plays `mouse-click.mp3` (SFX on by default).
- [ ] The five interaction sounds each play on their specific action (lamp/drawer/clock/
      poster/pc-start).
- [ ] The iPod appears in the room with a hover/focus tooltip + `-2px` pickup lift; clicking
      it skips to a new track (and starts playback if stopped).
- [ ] `sfx`/`sfxVolume` prefs exist in `room-save-v1` (default true/0.5) and are honoured by
      `useSfx()`; music mute is independent (muting music does not mute SFX).
- [ ] Rapid clicks overlap without cutting out (pool works).
- [ ] Works with OS reduce-motion on (sound still plays; iPod hover lift still plays).
- [ ] EN+FR for the iPod label/tooltip; `npm run type-check && lint && build` pass.

## Open decisions
- ⟨DECIDE⟩ mouse-click on speaker mute toggles too? (default: no).
- pc-start timing — LOCKED once at zoom start. SFX volume default 0.5. Control → Spec 7.

---

# SPEC 3 — Discoverability & reward

**Goal:** reward exploration (the original brief) with gentle first-visit hinting, an
achievements/"things you found" system, and a hidden konami→terminal easter egg.

## 3a. First-visit hint layer
- On a visitor's first session (`visitCount <= 1` in `room-save-v1`), briefly pulse a soft
  outline on the interactable room objects (monitor, poster, bonsai, lamp, coffee, side
  table, speakers) for ~4 s, staggered, then fade. Cancels immediately on first interaction.
- Decorative: `aria-hidden`, `pointer-events: none`, warm outline matching the focus ring.
- ⟨DECIDE⟩ show once ever, or on each of the first 2–3 visits? Default: first visit only,
  with a re-trigger if the user presses `?`.

## 3b. Achievements / "things you found"
- **State:** a `discoveries` string-set in `room-save-v1` (e.g. `lamp`, `drawer`, `clock`,
  `music`, `poster`, `bonsai`, `coffee`, `paint`, `minesweeper`, `readme`, `legal`,
  `terminal`, `screensaver`). Additive, never reset.
- **Feedback:** on first unlock of each, a small pixel toast (reuse the poster-toast styling)
  + `aria-live="polite"` announcement. The poster toast is the seed — generalise it into a
  `useDiscovery(id)` hook + a single toast host.
- **Viewer:** a "found N / M" readout. ⟨DECIDE⟩ surface as (a) a small counter by the clock/
  visit odometer, or (b) a desktop "Trophies" app listing each with a found/locked glyph.
  Default: (a) counter + (b) a lightweight list inside the README or a new tiny app — pick
  one at plan time.
- No backend; localStorage only.

## 3c. Konami → terminal app
- Global key listener in `Room.tsx` for `↑↑↓↓←→←→ B A`; on match, open a new
  `screenMode: 'terminal'` (`DeskTerminal.tsx`) — reuses the desk screen + Escape ladder.
- Minimal shell: prompt `guest@ahmed:~$`, commands `help`, `whoami`, `ls`, `cat readme.txt`
  (prints the README), `sfx on|off`, `clear`, `exit`. Unknown → `command not found`.
- Unlocks the `terminal` discovery. ⟨DECIDE⟩ command set — above is the proposed minimum.
- Pixel/monospace styling, green-on-dark, in-screen scrollback.

## Dependencies
None new (no art, no audio). Pairs nicely with Spec 2 (a `terminal` open SFX, unlock jingle
— optional, only if Ahmed adds those sounds later).

## Acceptance criteria
- [ ] First-visit hints pulse then fade; cancel on interaction; not shown to returning visitors.
- [ ] Each tracked interaction unlocks once, shows a toast + polite announcement, persists.
- [ ] Konami opens the terminal; commands behave; Escape ladder works.
- [ ] EN + FR for all copy; localStorage only; type-check/lint/build pass.

---

# SPEC 4 — Mobile & polish

**Goal:** make the room genuinely usable on phones (today the weakest surface) and tidy
loading performance.

## 4a. Drag-to-pan the stage
- Today `useStageScale` fit-scales the 1408×768 stage with letterboxing, so on a tall phone
  the room is tiny. Add an opt-in **zoomed mode on coarse-pointer/narrow viewports**: scale
  to fill height, and let the user drag horizontally (and vertically if needed) to pan.
- Implementation sketch: a pan offset (clamped to stage bounds) written to the outer
  transform via rAF (never per-event React state — same discipline as the desk mouse).
  Pointer/touch drag with momentum optional. Pinch-zoom ⟨DECIDE⟩ (default: no pinch,
  fixed fill-height zoom + pan only, to keep hotspot math simple).
- Respect the existing two-transform rule (outer centre/scale, inner zoom origin) — panning
  is an added translate on the outer wrapper only.

## 4b. Bigger hit areas + tap hints
- On coarse pointers, pad hotspot rects (min ~44×44 CSS px after scale) so objects are
  tappable. A subtle one-time "tap to explore" hint on first mobile visit (ties into Spec 3a).
- Verify the desk close-up screen (536×308) apps (paint/minesweeper) are usable by touch;
  the Home full-page fallback below 700 px already exists — re-audit after room-only.

## 4c. Loading / perf
- Confirm `background.png` stays the LCP with `fetchpriority="high"`.
- Preload the desk-closeup art and first-needed sprite sets on idle (`requestIdleCallback`)
  so entering the desk is instant.
- Audit CLS on the stage mount; reserve the stage box to avoid layout shift.
- ⟨DECIDE⟩ sprite atlasing (combine per-object frames into one image + CSS background-position)
  — larger change; default: skip unless a Lighthouse pass shows a real request-count problem.

## Dependencies
None new. Best done after Spec 1 so hotspot inventory is final (no browser).

## Acceptance criteria
- [ ] On a phone, the room fills the height and can be panned to see all objects.
- [ ] All room hotspots are tappable (≥44px), tooltips appear on tap where sensible.
- [ ] Paint + Minesweeper are playable by touch.
- [ ] Lighthouse mobile: no CLS regression, LCP unchanged/better; type-check/lint/build pass.

---

# SPEC 5 — Diegetic record player  ⟨needs art⟩

**Goal:** replace the abstract "click the speakers to mute" with a physical record player
you operate — a more tactile music control matching the room's spirit.

## Interaction model (proposed)
- New room object: a turntable (on the desk or a shelf). ⟨DECIDE⟩ placement + whether the
  existing desk speakers stay as passive art (recommended: keep speakers as art, they still
  emit the music notes; the turntable becomes the control).
- **Needle down** (click platter/arm) → play; **needle up** → pause.
- **Nudge the record / click the arm-return** → skip (random no-repeat, reuse existing
  advance logic).
- Optional **vinyl crackle** ambient loop under playback — ⟨needs a `vinyl-crackle` audio
  file⟩; wire through the Spec 2 SFX/ambient system (a looping ambient channel, `sfx`-gated).
- Now-playing widget stays; the turntable label reflects play/pause for a11y.

## Art needed (union-bbox pipeline, per CLAUDE.md STYLE)
- Turntable base (rest), platter with record, tonearm in two states (parked / on-record),
  and a short spin loop (2–4 frames) while playing. Frames extracted via a new
  `scripts/extract-turntable.mjs` to a shared union bbox; lighting variants via
  `npm run lighting`.

## Wiring
- Reuse `RoomAudioProvider` (`playing`, `toggle`, skip). The turntable is a new
  `objects.ts` entry + a component like `RoomSpeakers` but with play/pause/skip affordances.
- Speaker mute-toggle behaviour ⟨DECIDE⟩: remove it (turntable is the control) or keep as a
  secondary mute. Default: keep speakers as art only; mute lives on the turntable + NowPlaying.

## Acceptance criteria
- [ ] Turntable plays/pauses/skips the existing playlist; NowPlaying stays in sync.
- [ ] Needle/arm states animate; spin loops while playing; holds when paused.
- [ ] Optional crackle loops only while playing and only when `sfx` on.
- [ ] Reduced-motion: audio still plays, spin animation still plays (site rule); EN+FR; builds.

## Blocked on
Ahmed's turntable sprites + (optional) a `vinyl-crackle` audio file.

---

# SPEC 6 — Life & atmosphere  ⟨needs art + API⟩

**Goal:** make the room feel alive — a cat, real weather at the window, and a night sky.
Largest phase; split into 6a/6b/6c, each shippable alone.

## 6a. Cat on the bed  ⟨needs art⟩
- Sleeping loop on the bed; click → wake/stretch → resettle. Rest position varies by
  `visitCount`. Optional purr ⟨needs a `purr` audio file⟩ via Spec 2 system.
- Art: sleep loop (2–3 frames), stretch/wake sequence (4–6 frames), maybe a sit pose.
  New `objects.ts` entry + `AnimatedSprite` (loop + play-once on click). Union-bbox extract.
- Unlocks a `cat` discovery (Spec 3).

## 6b. Real-weather window  ⟨needs API + light art⟩
- **Data:** an Open-Meteo route (`src/app/api/weather/route.ts` — note: re-introduces one
  API route after the Spec-1 backend purge; keep it read-only, cached, no secrets — Open-Meteo
  needs no key). **LOCKED: fixed Canberra** (no geolocation, no consent, no privacy-policy
  change needed).
- **Cache:** hourly (`revalidate = 3600`); fail-soft to "clear".
- **Render:** rain/snow overlay over the window rect; intensity from the weather code. CSS
  particle overlay (cheap) or a few sprite frames ⟨light art, optional⟩. Ties into the
  existing time-of-day lighting (already scaffolds tint).

## 6c. Night sky + car-light sweeps  ⟨light art / CSS⟩
- At the `night` lighting state, show moon + a few stars behind the window, and an occasional
  headlight sweep across the wall (a soft moving gradient band, ~every 20–40 s). Mostly CSS;
  emissive layers are never lighting-graded (existing invariant).
- Unlocks a `night` discovery if the visitor is there after dark.

## Dependencies / risks
- Art: cat frames (6a), optional rain/snow sprites (6b).
- API: Open-Meteo (6b) — the only server code re-added; document it in CLAUDE.md and the
  privacy policy (aggregate weather, no personal data, fixed location).
- Keep each sub-phase independently shippable.

## Acceptance criteria (per sub-phase)
- [ ] 6a: cat sleeps, wakes on click, resettles; position varies by visit; EN+FR label; builds.
- [ ] 6b: window shows current Canberra precipitation, hourly-cached, fail-soft; privacy
      policy updated; builds.
- [ ] 6c: night state shows moon/stars + periodic light sweep; emissive layers ungraded; builds.

## Blocked on
Ahmed's cat sprites (6a) and optional weather sprites (6b). 6c can proceed on CSS alone.

---

# SPEC 7 — Settings app (home for the SFX toggle & prefs)

**Goal:** a small desktop **Settings** app that surfaces the room preferences that currently
have no UI — starting with the SFX toggle/volume decided in Spec 2.

## Scope
- New `screenMode: 'settings'` + `DeskSettings.tsx` + a desktop icon (needs a `settings`
  dictionary group + a 16×16 gear `ICON_SETTINGS`).
- Rows (each reads/writes `room-save-v1`):
  - **SFX** on/off + volume (Spec 2 prefs `sfx`, `sfxVolume`).
  - **Music volume** (existing `volume` pref — mirror the NowPlaying slider).
  - **Clock** 12/24h (existing `clock24h`).
  - ⟨DECIDE⟩ **Reduced-motion opt-out**: a "calm mode" toggle for motion-sensitive visitors
    (the site forces motion on by default; this would let them opt back into reduced motion).
    Default: include it — it's the accessible complement to the always-on-motion policy.
  - ⟨FUTURE⟩ wallpaper picker (roadmap item 9) once wallpapers exist.
- Escape ladder app→desktop→room like every other app; EN + FR.

## Sequencing
Can land any time after Spec 2 (it consumes Spec 2's prefs). Reasonable to slot as Spec 3.5
or bundle with Spec 3 (discoverability) since both are no-art UI work.

## Acceptance criteria
- [ ] Settings app opens from a desktop icon; toggling SFX silences/enables the Spec 2 sounds.
- [ ] Music volume, clock format persist and reflect elsewhere immediately.
- [ ] Optional calm-mode toggle actually reduces motion when on; EN+FR; builds.

---

## Cross-cutting notes
- Every phase keeps the **bilingual** rule (en.ts + fr.ts same commit) and the **localStorage-
  only** persistence rule (no DB); the sole server re-addition is the Open-Meteo route in 6b.
- SFX/ambient audio all route through the Spec 2 `SfxProvider` (one audio-effects home).
- Discoveries (Spec 3) accumulate across later phases (cat, night, terminal, record player).
- After each phase: update `CLAUDE.md` (state + session note) and fold results into `todo.md`.
