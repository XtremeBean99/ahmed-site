# Games Tab + Site-Wide Motion — Design Spec

**Date:** 2026-06-16
**Author:** Ahmed Hussain (via AI agent)
**Status:** Approved for planning
**Repo:** `ahmed-site` (ahmedyhussain.com)

---

## 1. Summary

Add a new top-level **Games** section to the site with two distinct, self-contained
browser games, and apply a tight set of subtle, state-aware Framer Motion enhancements
across the existing site.

1. **Typing speed test** — live WPM + accuracy tracker over a curated set of
   on-theme (law / AI governance / cybersecurity / silicon-computing) phrases.
2. **Atari Breakout-style game** — canvas game: paddle, brick grid, lives, score,
   win/lose, pause, and falling **power-ups**.
3. **Site-wide Motion polish** — shared motion tokens, route transitions, an animated
   nav indicator, and refined card hover micro-interactions.

This work must respect every constraint in `CLAUDE.md`: strict monochrome palette,
no database (client `localStorage` only for scores), Server Components by default,
`prefers-reduced-motion` honoured everywhere.

### 1.1 Decisions locked during brainstorming

| Decision | Choice | Rationale |
|---|---|---|
| Animation library | **Framer Motion only — no GSAP** | User chose this in clarifying questions, overriding the initial "Motion + GSAP" ask. Keeps to one engine already in the repo (`framer-motion` v11), leaner bundle. |
| Score persistence | **`localStorage` only** | Fits the strict no-database constraint. |
| Typing content | **Law + AI governance + cybersecurity** (no silicon/computing), editable data file | On-brand; mirrors the curated litigation dataset pattern. |
| Game scope | **Focused & complete**, including Breakout power-ups | Polished but bounded. Exact feature list in sections 4 and 5. Power-ups are explicitly in scope. |

> If GSAP was selected off by mistake, this spec must be revised before planning — GSAP
> would change dependencies and the animation architecture in sections 6 and 9.

---

## 2. Goals & non-goals

### Goals
- Two production-quality, monochrome, accessible games reachable from a new `/games` hub.
- Live WPM/accuracy for the typing test; full Breakout loop (lives, score, win/lose, pause).
- Personal-best persistence via `localStorage`.
- A small, consistent, reduced-motion-safe Motion layer that improves spatial clarity
  site-wide without being distracting.
- Match the existing site's SEO/metadata rigor (metadata, sitemap, JsonLd, OG/Twitter images).

### Non-goals (YAGNI)
- No server-side scoreboards, accounts, or leaderboards.
- No database, no new API routes.
- No GSAP or any second animation engine.
- No sound effects, difficulty settings, or multiple/auto-advancing levels in Breakout
  beyond a single clearable board (see 5.6 for the win/restart behaviour). Power-ups
  ARE in scope (see 5.9).
- No new test framework as a hard requirement (repo has none today). Pure logic is
  isolated so tests *can* be added later; vitest is explicitly out of scope here.

---

## 3. Routes & file map

New routes follow the existing `/projects` hub-and-detail pattern exactly.

```
src/
├── app/
│   └── games/
│       ├── page.tsx                    # Hub (Server Component): 2 cards
│       ├── opengraph-image.tsx         # OG image for hub
│       ├── twitter-image.tsx           # Twitter image for hub
│       ├── typing-test/
│       │   ├── page.tsx                # Server shell: metadata + JsonLd + <TypingTest/>
│       │   ├── opengraph-image.tsx
│       │   └── twitter-image.tsx
│       └── breakout/
│           ├── page.tsx                # Server shell: metadata + JsonLd + <Breakout/>
│           ├── opengraph-image.tsx
│           └── twitter-image.tsx
│   └── template.tsx                    # NEW: route transition wrapper (client)
│
├── components/
│   └── games/
│       ├── TypingTest.tsx              # 'use client'
│       ├── Breakout.tsx                # 'use client'
│       ├── GameShell.tsx              # shared monochrome frame/heading/back-link
│       └── GameStat.tsx               # shared stat readout (label + tabular-nums value)
│
└── lib/
    ├── motion.ts                       # NEW: shared easings, durations, variants
    └── games/
        ├── types.ts                    # shared types
        ├── phrases.ts                  # curated themed phrase dataset
        ├── storage.ts                  # SSR-safe localStorage best-score helpers
        ├── wpm.ts                       # pure WPM/accuracy calculation
        └── breakout-engine.ts          # pure-ish game state + collision math
```

**Edited existing files:**
- `src/components/layout/Header.tsx` — add Games nav link; add animated nav indicator.
- `src/app/sitemap.ts` — add three URLs.
- `src/app/projects/page.tsx` — adopt shared hover micro-interaction (optional, low-risk).

---

## 4. Typing speed test

### 4.1 Content — `src/lib/games/phrases.ts`
- Exports `phrases: string[]` (or `Phrase[]` with optional `source`/`topic` tags — see types).
- 25–40 curated phrases, each one sentence, on-theme across: legal technology,
  AI governance, and cybersecurity. **No silicon/computing-hardware phrases.**
  Professional tone, no em dashes (matches repo copy convention — see commit `dfd0c23`).
- A `pickRandomPhrase(exclude?: string)` helper avoids immediate repeats.
- Examples (final list curated during implementation):
  - "Good governance of artificial intelligence begins with clear accountability."
  - "Courts increasingly grapple with copyright claims over training data."
  - "Strong passwords and least privilege defend against most intrusions."

### 4.2 Pure logic — `src/lib/games/wpm.ts`
Pure functions, no React, unit-testable:
- `computeWpm(correctChars: number, elapsedMs: number): number`
  — `(correctChars / 5) / (elapsedMs / 60000)`, returns 0 when `elapsedMs <= 0`,
  rounds to integer.
- `computeAccuracy(correctChars: number, typedChars: number): number`
  — percentage 0–100, returns 100 when `typedChars === 0`.
- `diffChars(target: string, typed: string): CharState[]`
  — returns per-character state for rendering (see 4.3).

### 4.3 Component — `src/components/games/TypingTest.tsx` (`'use client'`)
**State machine:** `idle → running → finished` (then restart → `idle`).

- **Rendering:** the target phrase is shown as spans, one per character, each with a
  state: `untyped` (muted), `correct` (foreground/white), `incorrect`
  (muted + underline, OR inverted block — chosen during build, must read as "wrong"
  without colour), `current` (blinking caret box on the next char).
- **Input capture:** a visually-integrated text input (or a hidden input bound to a
  focused container). Clicking/tapping the phrase focuses it (raises mobile keyboard).
  Typing beyond the phrase length is ignored; Backspace corrects.
- **Timing:** timer starts on the first keystroke (`idle → running`). A light interval
  (~150–200ms) recomputes live WPM/accuracy while running; cleared on finish/unmount.
- **Completion:** when `typed.length === phrase.length`, transition to `finished`.
  Compute final WPM/accuracy/seconds. Read best from `localStorage`; if beaten, write
  new best and show a "New personal best" badge.
- **Controls:** Restart button (and `Enter`/`Tab`-safe) → new random phrase, reset state.
- **Metrics display:** uses `<GameStat>` for live WPM, accuracy, and best.
- **Accessibility:** input is a real focusable control; live region (`aria-live="polite"`)
  announces final result; all controls keyboard reachable. Caret blink is decorative and
  disabled under `prefers-reduced-motion`; metrics still update.

### 4.4 Acceptance criteria
- Live WPM updates visibly while typing and matches `computeWpm` for the elapsed time.
- Incorrect characters are visually distinguishable without any colour.
- Finishing a phrase shows final WPM/accuracy/time; a better score updates and badges
  the personal best; reloading the page preserves the best.
- Works with keyboard only; works on touch (keyboard raises on tap).
- Reduced motion: no blinking/animated decoration, full functionality retained.

---

## 5. Breakout

### 5.1 Rendering surface — `src/components/games/Breakout.tsx` (`'use client'`)
- Single `<canvas>`, **DPR-aware**, fixed logical resolution (e.g. 800×600 logical units)
  scaled to fit container width while preserving aspect ratio.
- Game loop via `requestAnimationFrame` with fixed-timestep accumulator (deterministic
  physics independent of frame rate). Reuse the CircuitMesh self-contained pattern:
  pause loop when tab hidden (`document.hidden`) and when canvas scrolled off-screen
  (`IntersectionObserver`).

### 5.2 Pure-ish engine — `src/lib/games/breakout-engine.ts`
Holds collision/physics math and state transitions as plain functions/types so the
component stays a thin render+input shell and the math is testable:
- Types: `Vec2`, `Ball`, `Paddle`, `Brick`, `PowerUp`, `PowerUpKind`, `ActiveEffect`,
  `GameState`, `GameStatus` (`'ready' | 'playing' | 'paused' | 'won' | 'lost'`).
- `GameState` carries **`balls: Ball[]`** (not a single ball — multi-ball power-up needs
  an array), `powerUps: PowerUp[]` (currently falling), and
  `effects: ActiveEffect[]` (timed effects in force, e.g. expanded paddle / slow ball).
- `createInitialState(config)` — builds paddle, one ball, brick grid, empty power-ups/effects.
- `stepPhysics(state, dt)` — for every ball: advance, resolve wall/paddle/brick collisions,
  apply angle-on-paddle-hit (deflection from hit offset to paddle centre). On brick break,
  roll the power-up drop chance (5.9). Advance falling power-ups; on paddle catch, apply
  the effect; expire timed effects via `effects`. Remove balls that fall out; lose a life
  only when the **last** ball is lost. `won` when all bricks cleared; `lost` at 0 lives.
- Brick grid: e.g. 10 cols × 6 rows; each brick `alive: boolean` and a `row` used for
  monochrome alpha banding. Score increment per brick.

### 5.3 Input
- **Mouse:** paddle x follows pointer x (clamped).
- **Touch:** drag to move paddle (clamped); tap to launch.
- **Keyboard:** Left/Right arrows (or A/D) move paddle; Space launches / pauses;
  `P` toggles pause; `R` restarts.

### 5.4 HUD & overlays (monochrome, DOM over canvas or drawn)
- Top bar: Score, Lives, Best (from `localStorage`), and active timed power-up
  effects with remaining time (see 5.9).
- Start overlay (`status === 'ready'`): "Press Space or tap to launch."
- Pause overlay (`status === 'paused'`): "Paused."
- Win overlay (`status === 'won'`): "Cleared. Score N." + Play again.
- Lose overlay (`status === 'lost'`): "Game over. Score N." + Play again.

### 5.5 Monochrome treatment
- Background zinc-950; paddle/ball solid white; bricks white with per-row alpha
  (e.g. 0.55–0.95) so depth reads without colour. Thin zinc border on the playfield.
- No colour anywhere. Subtle ball trail allowed only if it stays grayscale and is
  disabled under reduced motion.

### 5.6 Win / restart behaviour
- Clearing all bricks → `won` overlay with final score and Play again (single board;
  no auto-advancing levels — that is a non-goal).
- High score persisted via `storage.ts` and shown as Best.

### 5.7 Reduced motion
- The game is inherently interactive motion driven by the player, so the core loop runs.
- Disable purely decorative motion (ball trail, overlay transitions). No autoplaying
  animation occurs before the player launches.

### 5.8 Acceptance criteria
- Ball bounces off walls/paddle/bricks correctly; paddle-hit angle varies by hit position.
- Losing the **last** ball costs a life; losing all lives ends the game; clearing all
  bricks wins; each shows the right overlay.
- Pause halts physics (and falling power-ups) and resumes cleanly; tab-hidden pauses then
  resumes.
- Score and Best display correctly; Best persists across reloads.
- Canvas is crisp on high-DPR screens and scales responsively without distortion.
- Playable with mouse, touch, and keyboard.
- Power-ups drop, fall, are caught by the paddle, apply their effect, and timed effects
  expire (see 5.9). Active effects are visible to the player.

### 5.9 Power-ups
Monochrome, readable without colour. A destroyed brick has a drop chance
(`POWERUP_DROP_CHANCE`, ~0.18) to spawn one falling **capsule**: a white rounded pill
with a thin zinc border and a single white glyph/letter identifying the kind. Capsules
fall at constant speed; catching one with the paddle activates it; a missed capsule is
removed when it leaves the playfield. Power-ups do not fall while paused.

Set (kept small and positive-leaning so play stays non-frustrating):

| Kind | Glyph | Effect | Duration |
|---|---|---|---|
| `expand` | `E` | Paddle width × ~1.5 | Timed (~12s), refreshes if re-caught |
| `multi` | `M` | Split each active ball into 3 (spread angles) | Instant |
| `slow` | `S` | Ball speed × ~0.7 | Timed (~10s) |
| `life` | `+` | Extra life (capped at a max, e.g. 5) | Instant |

- Timed effects live in `state.effects` with a remaining timer decremented in
  `stepPhysics`; on expiry the paddle width / ball speed revert to base. Re-catching a
  timed power-up refreshes its timer rather than stacking.
- `multi` clones the current ball velocity at +/- a fixed angle; new balls share the
  same physics. Lives are only lost when the last ball is gone (already in 5.2).
- Implementation MUST treat the power-up set as data (`POWERUPS` table) so kinds can be
  tuned/added by editing one place.
- A compact HUD line or small icons show currently-active timed effects and remaining time.
- Reduced motion: capsules still fall (functional), but any decorative pulse/trail on them
  is disabled.

---

## 6. Site-wide Motion improvements

All via `framer-motion`. All gated on `useReducedMotion()` / the global reduced-motion
CSS already in `globals.css`. Deliberately tight to avoid churn.

### 6.1 Shared motion tokens — `src/lib/motion.ts`
- Export named easings (e.g. `EASE_OUT_EXPO = [0.16, 1, 0.3, 1]` — already used by
  `SectionReveal`), durations (`fast`, `base`, `slow`), and reusable `Variants`
  (`fadeInUp`, `fadeIn`). Single source of truth so motion is consistent, not ad-hoc.

### 6.2 Route transitions — `src/app/template.tsx` (NEW, `'use client'`)
- Wrap `children` in a `motion.div` that does a gentle cross-fade + small `y` on mount
  (Next.js remounts `template.tsx` per navigation). Short (~0.3s), `EASE_OUT_EXPO`.
- Reduced motion → no transform/opacity animation (render immediately).
- Must not break the existing fixed backgrounds (`CircuitMesh`, `CircuitBackdrop`) which
  live in `layout.tsx` (outside `template.tsx`), nor the skip-link / `#main-content`.

### 6.3 Animated nav indicator — `Header.tsx`
- Add a sliding underline/indicator under the active desktop nav item using a shared
  `layoutId` so it animates between Projects / Tutoring / Games as the route changes.
- Spatial wayfinding cue. Reduced motion → indicator still shows on the active item but
  without the slide animation.
- Must preserve existing Header behaviour: scroll state, mobile drawer, focus trap, a11y.

### 6.4 Card hover micro-interaction
- A shared, very subtle spring lift/scale for hub cards (`/games`, and optionally
  `/projects`). Tiny (e.g. translateY -2px, scale ~1.01), spring, reduced-motion safe.
- Keep the existing border/background color transitions; motion is additive.

### 6.5 Acceptance criteria
- Navigating between pages shows a brief, non-jarring transition; back/forward work.
- The nav indicator tracks the active route and animates between items.
- Card hover feels responsive but subtle; nothing shifts layout or causes jitter.
- Everything above is fully disabled/neutralised under `prefers-reduced-motion`.
- No regression to Header scroll/menu/focus behaviour or to the fixed backgrounds.

---

## 7. Persistence — `src/lib/games/storage.ts`

- SSR-safe: guard all access with `typeof window !== 'undefined'`; wrap in try/catch
  (private-mode / disabled storage must not crash the game).
- Keys namespaced, e.g. `ahmed-site:games:typing-best`, `ahmed-site:games:breakout-best`.
- API: `getBest(key): number`, `setBestIfHigher(key, value): boolean` (returns whether
  it became a new best). Values are plain numbers.
- No personal data stored; nothing leaves the browser (consistent with privacy posture).

---

## 8. SEO / metadata / structured data

For each new route, match existing rigor:
- `export const metadata` with title, description, canonical (`alternates.canonical`).
- Add all three URLs to `src/app/sitemap.ts` with sensible `priority`/`changeFrequency`.
- `JsonLd` on each game page using schema.org `SoftwareApplication` (or `Game` /
  `VideoGame` where apt) and a `CollectionPage` on the hub, mirroring
  `projects/page.tsx`.
- `opengraph-image.tsx` + `twitter-image.tsx` for hub + both games, monochrome, matching
  the visual style of existing OG routes (read one existing OG route first to copy the
  approach, fonts, and dimensions).
- Confirm `robots.ts` still disallows AI crawlers (no change expected; do not weaken).

---

## 9. Constraints checklist (from CLAUDE.md)

- [ ] Strict monochrome — zinc-950 bg, white text, zinc borders. No colour, no gradients
      (except the existing hero vignette). Games included.
- [ ] No database. Scores in `localStorage` only. No new API routes.
- [ ] Server Components by default; `'use client'` only where interactivity is required
      (TypingTest, Breakout, template, Header already client).
- [ ] `prefers-reduced-motion` respected for every new animation.
- [ ] Secrets/env unchanged. No new env vars.
- [ ] Security headers/CSP unchanged. (Canvas + inline handlers fine under existing CSP.)
- [ ] No em dashes in site copy/comments (commit `dfd0c23` convention).
- [ ] Add new pages to `sitemap.ts`; add nav link in `Header.tsx`.

---

## 10. Verification

Repo has no test framework today; verification is:
- `npm run type-check` — passes (no TS errors).
- `npm run lint` — passes (no ESLint errors).
- `npm run build` — full production build succeeds.
- Manual play of both games (keyboard, mouse, touch via devtools), reduced-motion check
  (emulate in devtools), and a navigation pass to confirm transitions + nav indicator.

Pure logic in `wpm.ts` and `breakout-engine.ts` is written as side-effect-free functions
so unit tests can be added later without refactoring.

---

## 11. Implementation workstreams (for parallel subagent execution)

Designed so an agent manager can fan out work. Dependencies noted.

- **A — Foundation (do first).** Routes/shells for `/games`, `/games/typing-test`,
  `/games/breakout`; `Header.tsx` nav link; `sitemap.ts`; `lib/motion.ts`;
  `lib/games/{types,storage,phrases,wpm,breakout-engine}.ts` (signatures + data, logic
  can be filled by B/C); `components/games/{GameShell,GameStat}.tsx`. Produces compiling
  stubs so B/C/D can proceed in isolation.
- **B — Typing test** (after A). `components/games/TypingTest.tsx` + wire into its page;
  finalise `phrases.ts` and `wpm.ts`.
- **C — Breakout** (after A). `components/games/Breakout.tsx` + wire into its page;
  finalise `breakout-engine.ts` including multi-ball and the power-up system (5.9).
- **D — Site-wide Motion** (parallel with B/C; touches `Header.tsx`, `template.tsx`,
  card hover, `lib/motion.ts`). Coordinate Header edits with A to avoid conflicts.
- **E — SEO/OG/JsonLd** (after routes exist). OG/Twitter images + JsonLd + metadata for
  all three routes.

Integration/verification pass (section 10) runs after B–E land.

---

## 12. Open risks

- **Header.tsx is touched by both A (nav link) and D (indicator).** Sequence A before D,
  or have one agent own all Header edits, to avoid merge conflicts.
- **`template.tsx` interacting with fixed backgrounds.** Backgrounds live in `layout.tsx`
  and must remain outside the transition wrapper; verify no z-index/stacking regressions.
- **Reduced-motion correctness** is easy to forget on canvas/decorative bits — it is an
  explicit acceptance criterion for every workstream.
