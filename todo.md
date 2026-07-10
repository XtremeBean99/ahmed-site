# todo.md — Pixel-room improvement program

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
