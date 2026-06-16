# Games Tab + Site-Wide Motion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/games` section with a live-WPM typing test and a Breakout game (with power-ups), plus a small, consistent, reduced-motion-safe Framer Motion layer across the site.

**Architecture:** Follow the existing `/projects` hub-and-detail pattern. Server Components render metadata/JsonLd shells; interactivity lives in `'use client'` components. Pure game logic (WPM math, Breakout physics, score storage) is isolated into side-effect-free modules in `src/lib/games/` so the React components are thin render+input shells. All animation is Framer Motion, gated on `prefers-reduced-motion`. No database — best scores use `localStorage`. Strict monochrome throughout.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind (custom monochrome tokens), `framer-motion` v11, HTML Canvas 2D + `requestAnimationFrame`.

---

## Conventions for every task

- **Monochrome only:** background `#09090b` (`bg-background`), text `#fafafa` (`text-foreground`), borders `#27272a` (`border-border`), muted `#a1a1aa`/`#52525b`. No colour, ever.
- **No em dashes** in any user-facing copy or comments (repo convention, commit `dfd0c23`).
- **Reduced motion:** every animation must check `useReducedMotion()` (Framer) or `window.matchMedia('(prefers-reduced-motion: reduce)')` (canvas/raw) and degrade gracefully.
- **Path alias:** `@/` maps to `src/`.
- **Verification commands** (repo has no unit-test runner): after each file, run `npm run type-check`; at the end of each workstream run `npm run lint` and `npm run build`. Pure-logic tasks include an inline `npx tsx -e` assertion as a smoke test (ephemeral, not committed).
- **Branch:** all work lands on the existing `games-and-motion` branch.
- **Commits:** small and frequent. End every commit message with:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

## Dependency graph (for parallel dispatch)

```
A (Foundation)  ──┬──►  B (Typing test)
                  ├──►  C (Breakout)
                  └──►  D (Site-wide Motion)   ─┐
                                                ├──►  E (SEO/OG/JsonLd)  ──►  F (Integration)
A ────────────────────────────────────────────┘
```

- **A must complete first** (it produces compiling stubs + shared libs).
- **B, C, D run in parallel** after A. D and A both touch `Header.tsx`; A adds the nav link, D adds the indicator. To avoid conflicts, **A owns the nav-link edit; D owns the indicator edit** and rebases on A.
- **E runs after the three routes exist** (needs the pages from A + content from B/C).
- **F (integration/verification)** runs last.

---

# Workstream A — Foundation

Produces shared libraries, route shells, nav link, sitemap, and compiling stubs so B/C/D can proceed in isolation.

### Task A1: Shared motion tokens

**Files:**
- Create: `src/lib/motion.ts`

- [ ] **Step 1: Create the file**

```ts
import type { Variants, Transition } from 'framer-motion'

/** Easing already used by SectionReveal; keep site motion consistent. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

export const DURATION = {
  fast: 0.2,
  base: 0.35,
  slow: 0.75,
} as const

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/** Subtle card lift used on hover. Pair with whileHover="hover". */
export const cardHover: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01 },
}

export const springSubtle: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}
```

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/motion.ts
git commit -m "feat(motion): shared motion tokens and variants"
```

---

### Task A2: Game types

**Files:**
- Create: `src/lib/games/types.ts`

- [ ] **Step 1: Create the file**

```ts
// --- Breakout ---
export interface Vec2 {
  x: number
  y: number
}

export interface Ball {
  pos: Vec2
  vel: Vec2
  radius: number
}

export interface Paddle {
  x: number // center x (logical units)
  y: number // center y
  width: number
  baseWidth: number
  height: number
}

export interface Brick {
  x: number // top-left
  y: number
  width: number
  height: number
  row: number
  alive: boolean
}

export type PowerUpKind = 'expand' | 'multi' | 'slow' | 'life'

export interface PowerUp {
  kind: PowerUpKind
  pos: Vec2 // center
  width: number
  height: number
  vy: number
}

/** Only timed power-ups appear here; 'multi' and 'life' are instant. */
export interface ActiveEffect {
  kind: Extract<PowerUpKind, 'expand' | 'slow'>
  remainingMs: number
}

export type GameStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost'

export interface GameState {
  status: GameStatus
  paddle: Paddle
  balls: Ball[]
  bricks: Brick[]
  powerUps: PowerUp[]
  effects: ActiveEffect[]
  score: number
  lives: number
  width: number // logical playfield width
  height: number // logical playfield height
}

export interface BreakoutConfig {
  width: number
  height: number
  cols: number
  rows: number
  lives: number
}

// --- Typing test ---
export type CharStatus = 'untyped' | 'correct' | 'incorrect' | 'current'

export interface CharState {
  char: string
  status: CharStatus
}
```

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/games/types.ts
git commit -m "feat(games): shared game types"
```

---

### Task A3: Score storage (localStorage)

**Files:**
- Create: `src/lib/games/storage.ts`

- [ ] **Step 1: Create the file**

```ts
const NS = 'ahmed-site:games'

export const BEST_KEYS = {
  typing: 'typing-best',
  breakout: 'breakout-best',
} as const

/** Read a numeric best score. SSR-safe; returns 0 on any failure. */
export function getBest(key: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(`${NS}:${key}`)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** Write value only if it beats the stored best. Returns true if it was a new best. */
export function setBestIfHigher(key: string, value: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (value > getBest(key)) {
      window.localStorage.setItem(`${NS}:${key}`, String(value))
      return true
    }
    return false
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/games/storage.ts
git commit -m "feat(games): SSR-safe localStorage best-score helpers"
```

---

### Task A4: Shared game UI primitives

**Files:**
- Create: `src/components/games/GameStat.tsx`
- Create: `src/components/games/GameShell.tsx`

- [ ] **Step 1: Create `GameStat.tsx`** (Server Component — pure presentational)

```tsx
import { cn } from '@/lib/utils'

interface GameStatProps {
  label: string
  value: string | number
  className?: string
}

/** Monochrome stat readout: tabular value over a tracked label. */
export function GameStat({ label, value, className }: GameStatProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="font-serif text-2xl md:text-3xl font-bold text-foreground tabular-nums leading-none">
        {value}
      </span>
      <span className="label-text mt-2">{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create `GameShell.tsx`** (Server Component — header + back link + slot)

```tsx
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import type { ReactNode } from 'react'

interface GameShellProps {
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
}

/** Page chrome for a game: back-to-games link, header, then the game slot. */
export function GameShell({ eyebrow, title, intro, children }: GameShellProps) {
  return (
    <div className="pt-32 pb-24">
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <Link
            href="/games"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 label-text"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All games
          </Link>
          <p className="label-text mb-6">{eyebrow}</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            {title}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">{intro}</p>
        </SectionReveal>
        <div className="mt-12">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/GameStat.tsx src/components/games/GameShell.tsx
git commit -m "feat(games): GameStat and GameShell UI primitives"
```

---

### Task A5: Placeholder game components (stubs so pages compile)

**Files:**
- Create: `src/components/games/TypingTest.tsx`
- Create: `src/components/games/Breakout.tsx`

> These are temporary stubs. Workstreams B and C replace their bodies. They exist so the route shells (A6/A7) compile and B/C/D can run independently.

- [ ] **Step 1: Create `TypingTest.tsx` stub**

```tsx
'use client'

export function TypingTest() {
  return <div className="text-muted-foreground">Typing test loading…</div>
}
```

- [ ] **Step 2: Create `Breakout.tsx` stub**

```tsx
'use client'

export function Breakout() {
  return <div className="text-muted-foreground">Breakout loading…</div>
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run type-check` (Expected: PASS)

```bash
git add src/components/games/TypingTest.tsx src/components/games/Breakout.tsx
git commit -m "chore(games): stub game components"
```

---

### Task A6: Games hub page

**Files:**
- Create: `src/app/games/page.tsx`

- [ ] **Step 1: Create the file** (Server Component, mirrors `src/app/projects/page.tsx`)

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Games',
  description:
    'Two small browser games by Ahmed Hussain: a live WPM typing speed test on law and technology phrases, and a monochrome Breakout with power-ups.',
  alternates: { canonical: 'https://ahmedyhussain.com/games' },
}

type GameCard = {
  label: string
  title: string
  description: string
  href: string
}

const games: GameCard[] = [
  {
    label: 'Live WPM',
    title: 'Typing speed test',
    description:
      'Type curated phrases on law, AI governance and cybersecurity while a live tracker measures your words per minute and accuracy.',
    href: '/games/typing-test',
  },
  {
    label: 'Arcade',
    title: 'Breakout',
    description:
      'A monochrome take on the Atari classic: clear the wall, catch falling power-ups, and chase a personal best.',
    href: '/games/breakout',
  },
]

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Games | Ahmed Hussain',
  description:
    'Two small browser games: a live WPM typing speed test and a monochrome Breakout with power-ups.',
  url: 'https://ahmedyhussain.com/games',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default function GamesPage() {
  return (
    <div className="pt-32 pb-24">
      <JsonLd data={collectionSchema} />
      <div className="max-w-container mx-auto px-6">
        <SectionReveal>
          <p className="label-text mb-6">Games</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            A break from the brief.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            Two small things built for fun and to keep the canvas and animation muscles warm.
            Both run entirely in your browser and keep your best score on your device.
          </p>
        </SectionReveal>

        <div className="mt-16 grid sm:grid-cols-2 gap-6">
          {games.map((game, i) => (
            <SectionReveal key={game.href} delay={0.08 * i}>
              <Link
                href={game.href}
                className="group block border border-border rounded-lg p-8 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <p className="label-text mb-4">{game.label}</p>
                  <h2 className="font-serif text-xl font-semibold text-foreground group-hover:text-muted-foreground transition-colors mb-3">
                    {game.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{game.description}</p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  Play
                  <svg
                    className="transition-transform group-hover:translate-x-0.5"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <path d="M2 10L10 2M4 2h6v6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </SectionReveal>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run type-check` (Expected: PASS)

```bash
git add src/app/games/page.tsx
git commit -m "feat(games): games hub page"
```

---

### Task A7: Game detail page shells

**Files:**
- Create: `src/app/games/typing-test/page.tsx`
- Create: `src/app/games/breakout/page.tsx`

- [ ] **Step 1: Create `typing-test/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { GameShell } from '@/components/games/GameShell'
import { TypingTest } from '@/components/games/TypingTest'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Typing speed test',
  description:
    'A live WPM typing speed test on curated law, AI governance and cybersecurity phrases. Tracks words per minute and accuracy in real time.',
  alternates: { canonical: 'https://ahmedyhussain.com/games/typing-test' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Typing speed test',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description:
    'A live WPM typing speed test on curated law, AI governance and cybersecurity phrases.',
  url: 'https://ahmedyhussain.com/games/typing-test',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default function TypingTestPage() {
  return (
    <>
      <JsonLd data={schema} />
      <GameShell
        eyebrow="Live WPM"
        title="Typing speed test"
        intro="Type the phrase as accurately and quickly as you can. The tracker starts on your first keystroke and your best score stays on this device."
      >
        <TypingTest />
      </GameShell>
    </>
  )
}
```

- [ ] **Step 2: Create `breakout/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { GameShell } from '@/components/games/GameShell'
import { Breakout } from '@/components/games/Breakout'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Breakout',
  description:
    'A monochrome Breakout game with falling power-ups. Clear the wall, catch power-ups, and chase a personal best, all in your browser.',
  alternates: { canonical: 'https://ahmedyhussain.com/games/breakout' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Breakout',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description: 'A monochrome Breakout game with falling power-ups.',
  url: 'https://ahmedyhussain.com/games/breakout',
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
}

export default function BreakoutPage() {
  return (
    <>
      <JsonLd data={schema} />
      <GameShell
        eyebrow="Arcade"
        title="Breakout"
        intro="Move the paddle to keep the ball alive and clear every brick. Some bricks drop power-ups. Use mouse, touch, or the arrow keys, and press space to launch."
      >
        <Breakout />
      </GameShell>
    </>
  )
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run type-check` (Expected: PASS)

```bash
git add src/app/games/typing-test/page.tsx src/app/games/breakout/page.tsx
git commit -m "feat(games): typing test and breakout page shells"
```

---

### Task A8: Add Games to nav + sitemap

**Files:**
- Modify: `src/components/layout/Header.tsx` (the `navLinks` array near the top)
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Add the nav link.** In `Header.tsx`, change the `navLinks` array:

```tsx
const navLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/games', label: 'Games' },
  { href: '/tutoring', label: 'Tutoring' },
]
```

- [ ] **Step 2: Add sitemap entries.** In `src/app/sitemap.ts`, add these three objects to the returned array (after the projects entries):

```ts
    { url: `${base}/games`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/games/typing-test`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/games/breakout`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.6 },
```

- [ ] **Step 3: Verify the build end-to-end for workstream A**

Run: `npm run type-check && npm run lint && npm run build`
Expected: all PASS; build output lists `/games`, `/games/typing-test`, `/games/breakout` as routes.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx src/app/sitemap.ts
git commit -m "feat(games): add Games to nav and sitemap"
```

**Workstream A complete.** B, C, and D can now run in parallel.

---

# Workstream B — Typing test

Depends on A (types, storage, GameShell/GameStat, page shell).

### Task B1: Themed phrase dataset

**Files:**
- Create: `src/lib/games/phrases.ts`

- [ ] **Step 1: Create the file.** Phrases cover law, AI governance, and cybersecurity only (no silicon/computing-hardware). No em dashes.

```ts
/**
 * Curated typing-test phrases on the site's themes: law, AI governance,
 * and cybersecurity. One sentence each, no em dashes. Edit freely.
 */
export const phrases: string[] = [
  'Good governance of artificial intelligence begins with clear accountability.',
  'Courts increasingly grapple with copyright claims over training data.',
  'Strong passwords and least privilege defend against most intrusions.',
  'A contract is only as strong as the remedies that enforce it.',
  'Privacy law asks who may know what about whom, and on what terms.',
  'Transparency without enforcement is a promise that rarely keeps itself.',
  'Encryption protects the message even when the network cannot be trusted.',
  'Regulators are learning to audit algorithms they did not design.',
  'The burden of proof shapes every dispute long before trial.',
  'A data breach is discovered far more often than it is prevented.',
  'Liability for automated decisions remains a moving target in most courts.',
  'Due process means notice, a hearing, and a decision you can challenge.',
  'Security is a process, not a product you can buy once and forget.',
  'Open justice depends on records the public can actually read.',
  'A well drafted clause anticipates the argument it is meant to avoid.',
  'Machine learning models can memorise the very secrets they should protect.',
  'Jurisdiction decides whose rules apply when the harm crosses borders.',
  'Consent is meaningful only when refusal carries no hidden penalty.',
  'Threat models improve when you assume the attacker already has a foothold.',
  'Precedent binds the future to the reasoning of the past.',
  'Data minimisation is the cheapest security control most teams ignore.',
  'An injunction can stop the harm that damages can only measure.',
  'Governance frameworks fail quietly when no one owns the outcome.',
  'Phishing succeeds because it targets people, not the firewall.',
  'Statutory interpretation begins with the words and ends with their purpose.',
  'Zero trust assumes the breach and verifies every request anyway.',
  'A regulator without resources is a deterrent only on paper.',
  'The right to be forgotten collides with the duty to keep records.',
  'Incident response is judged by the hours, not the apology that follows.',
  'Fair process matters most when the stakes are highest.',
]

/** Pick a random phrase, avoiding an exact immediate repeat where possible. */
export function pickRandomPhrase(exclude?: string): string {
  const pool = exclude && phrases.length > 1 ? phrases.filter((p) => p !== exclude) : phrases
  return pool[Math.floor(Math.random() * pool.length)]
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run type-check` (Expected: PASS)

```bash
git add src/lib/games/phrases.ts
git commit -m "feat(games): themed typing phrases"
```

---

### Task B2: WPM / accuracy pure logic

**Files:**
- Create: `src/lib/games/wpm.ts`

- [ ] **Step 1: Create the file**

```ts
import type { CharState } from './types'

/** Standard WPM: (correct chars / 5) per minute. Returns 0 before any time elapses. */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60000
  return Math.round(correctChars / 5 / minutes)
}

/** Accuracy as a 0-100 integer. 100 when nothing has been typed yet. */
export function computeAccuracy(correctChars: number, typedChars: number): number {
  if (typedChars <= 0) return 100
  return Math.round((correctChars / typedChars) * 100)
}

/** Count characters typed so far that match the target at the same index. */
export function countCorrect(target: string, typed: string): number {
  let n = 0
  const len = Math.min(typed.length, target.length)
  for (let i = 0; i < len; i++) {
    if (typed[i] === target[i]) n++
  }
  return n
}

/** Per-character render state for the target phrase given current input. */
export function diffChars(target: string, typed: string): CharState[] {
  return target.split('').map((char, i) => {
    let status: CharState['status']
    if (i < typed.length) status = typed[i] === char ? 'correct' : 'incorrect'
    else if (i === typed.length) status = 'current'
    else status = 'untyped'
    return { char, status }
  })
}
```

- [ ] **Step 2: Smoke-test the math** (ephemeral, not committed)

Run:
```bash
npx tsx -e "import {computeWpm,computeAccuracy,countCorrect} from './src/lib/games/wpm.ts'; console.assert(computeWpm(0,0)===0,'wpm0'); console.assert(computeWpm(50,60000)===10,'wpm10'); console.assert(computeAccuracy(0,0)===100,'acc100'); console.assert(computeAccuracy(8,10)===80,'acc80'); console.assert(countCorrect('abc','axc')===2,'cc2'); console.log('wpm ok')"
```
Expected: prints `wpm ok` with no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/games/wpm.ts
git commit -m "feat(games): WPM and accuracy pure logic"
```

---

### Task B3: TypingTest component

**Files:**
- Modify (replace stub): `src/components/games/TypingTest.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { GameStat } from './GameStat'
import { Button } from '@/components/ui/Button'
import { diffChars, computeWpm, computeAccuracy, countCorrect } from '@/lib/games/wpm'
import { pickRandomPhrase } from '@/lib/games/phrases'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'running' | 'finished'

export function TypingTest() {
  const reduce = useReducedMotion()
  const [phrase, setPhrase] = useState('')
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(0)
  const [best, setBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pick the first phrase on mount (client-only avoids hydration mismatch).
  useEffect(() => {
    setPhrase(pickRandomPhrase())
    setBest(getBest(BEST_KEYS.typing))
  }, [])

  // Live ticker while running, to refresh WPM/accuracy ~6x/sec.
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => setNowTick((t) => t + 1), 160)
    return () => window.clearInterval(id)
  }, [status])

  const elapsedMs = startedAt ? Date.now() - startedAt : 0
  // nowTick is read so the interval forces recompute.
  void nowTick

  const correct = useMemo(() => countCorrect(phrase, typed), [phrase, typed])
  const wpm = computeWpm(correct, elapsedMs)
  const accuracy = computeAccuracy(correct, typed.length)
  const chars = useMemo(() => diffChars(phrase, typed), [phrase, typed])

  const finish = useCallback(
    (finalElapsed: number) => {
      const finalCorrect = countCorrect(phrase, phrase)
      const finalWpm = computeWpm(finalCorrect, finalElapsed)
      const beat = setBestIfHigher(BEST_KEYS.typing, finalWpm)
      if (beat) setBest(finalWpm)
      setIsNewBest(beat)
      setStatus('finished')
    },
    [phrase],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (status === 'finished') return
      const next = e.target.value.slice(0, phrase.length)
      let begin = startedAt
      if (status === 'idle') {
        begin = Date.now()
        setStartedAt(begin)
        setStatus('running')
      }
      setTyped(next)
      if (next.length === phrase.length) {
        finish(Date.now() - (begin ?? Date.now()))
      }
    },
    [status, phrase.length, startedAt, finish],
  )

  const restart = useCallback(() => {
    setPhrase((prev) => pickRandomPhrase(prev))
    setTyped('')
    setStatus('idle')
    setStartedAt(null)
    setIsNewBest(false)
    inputRef.current?.focus()
  }, [])

  const finalSeconds = startedAt && status === 'finished' ? Math.max(elapsedMs / 1000, 0) : 0

  return (
    <div className="max-w-3xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 border-y border-border py-6">
        <GameStat label="WPM" value={wpm} />
        <GameStat label="Accuracy" value={`${accuracy}%`} />
        <GameStat label="Best WPM" value={best} />
      </div>

      {/* Phrase */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="mt-10 w-full text-left rounded-lg border border-border bg-surface p-8 cursor-text focus:outline-none"
        aria-label="Focus typing area"
      >
        <p className="font-serif text-2xl md:text-3xl leading-relaxed tracking-wide">
          {chars.map((c, i) => (
            <span
              key={i}
              className={cn(
                'transition-colors',
                c.status === 'untyped' && 'text-muted',
                c.status === 'correct' && 'text-foreground',
                c.status === 'incorrect' && 'text-muted-foreground underline decoration-2 underline-offset-4',
                c.status === 'current' &&
                  cn('text-muted relative', !reduce && 'border-l-2 border-foreground animate-pulse'),
              )}
            >
              {c.char === ' ' ? ' ' : c.char}
            </span>
          ))}
        </p>
      </button>

      {/* Hidden input drives capture; kept off-screen but focusable. */}
      <input
        ref={inputRef}
        value={typed}
        onChange={onChange}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type the phrase above"
        className="sr-only"
      />

      {/* Result + controls */}
      <div className="mt-8 flex items-center gap-4" aria-live="polite">
        {status === 'finished' && (
          <p className="text-sm text-muted-foreground">
            {wpm} WPM at {accuracy}% accuracy in {finalSeconds.toFixed(1)}s.
            {isNewBest ? ' New personal best.' : ''}
          </p>
        )}
        <Button onClick={restart} className="ml-auto">
          {status === 'finished' ? 'Try another' : 'Restart'}
        </Button>
      </div>

      {status === 'idle' && (
        <p className="mt-4 text-xs text-muted">Start typing to begin. Backspace to correct.</p>
      )}
    </div>
  )
}
```

> **Note on `Button`:** confirm the import path/props by reading `src/components/ui/Button.tsx` first. If `Button` does not accept `onClick`/`className` as shown, substitute a plain `<button>` with classes `text-sm bg-foreground text-background px-4 py-2 rounded-md font-medium hover:bg-muted-foreground transition-colors`.

- [ ] **Step 2: Verify**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open `/games/typing-test`. Confirm: typing starts the timer; WPM/accuracy update live; wrong characters show underlined (no colour); finishing shows the result line and updates Best; reload preserves Best; tab focuses input; with reduced motion on (devtools rendering emulation), the caret does not blink but typing still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/TypingTest.tsx
git commit -m "feat(games): live WPM typing speed test"
```

**Workstream B complete.**

---

# Workstream C — Breakout

Depends on A (types, storage, GameShell/GameStat, page shell).

### Task C1: Breakout engine (pure logic)

**Files:**
- Create: `src/lib/games/breakout-engine.ts`

- [ ] **Step 1: Create the file**

```ts
import type {
  Ball,
  Brick,
  BreakoutConfig,
  GameState,
  PowerUp,
  PowerUpKind,
} from './types'

export const BALL_SPEED = 360 // logical units / sec
export const POWERUP_DROP_CHANCE = 0.18
export const SLOW_FACTOR = 0.7
export const EXPAND_FACTOR = 1.5
export const MAX_LIVES = 5
export const EFFECT_MS: Record<'expand' | 'slow', number> = { expand: 12000, slow: 10000 }

export const POWERUP_META: Record<PowerUpKind, { glyph: string; label: string }> = {
  expand: { glyph: 'E', label: 'Wider paddle' },
  multi: { glyph: 'M', label: 'Multi ball' },
  slow: { glyph: 'S', label: 'Slow ball' },
  life: { glyph: '+', label: 'Extra life' },
}

const POWERUP_KINDS: PowerUpKind[] = ['expand', 'multi', 'slow', 'life']

function makeBall(width: number, height: number): Ball {
  return { pos: { x: width / 2, y: height - 60 }, vel: { x: 0, y: 0 }, radius: 8 }
}

function buildBricks(width: number, cols: number, rows: number): Brick[] {
  const top = 60
  const gap = 6
  const side = 30
  const brickW = (width - side * 2 - gap * (cols - 1)) / cols
  const brickH = 22
  const bricks: Brick[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: side + c * (brickW + gap),
        y: top + r * (brickH + gap),
        width: brickW,
        height: brickH,
        row: r,
        alive: true,
      })
    }
  }
  return bricks
}

export function createInitialState(config: BreakoutConfig): GameState {
  const { width, height, cols, rows, lives } = config
  const paddleWidth = width * 0.16
  return {
    status: 'ready',
    paddle: { x: width / 2, y: height - 40, width: paddleWidth, baseWidth: paddleWidth, height: 14 },
    balls: [makeBall(width, height)],
    bricks: buildBricks(width, cols, rows),
    powerUps: [],
    effects: [],
    score: 0,
    lives,
    width,
    height,
  }
}

export function setPaddleX(state: GameState, x: number): void {
  const half = state.paddle.width / 2
  state.paddle.x = Math.max(half, Math.min(state.width - half, x))
}

export function launchBalls(state: GameState): void {
  const slowed = state.effects.some((e) => e.kind === 'slow')
  const speed = BALL_SPEED * (slowed ? SLOW_FACTOR : 1)
  for (const ball of state.balls) {
    if (ball.vel.x === 0 && ball.vel.y === 0) {
      const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3)
      ball.vel.x = Math.cos(angle) * speed
      ball.vel.y = Math.sin(angle) * speed
    }
  }
}

export function startGame(state: GameState): void {
  if (state.status === 'ready') {
    state.status = 'playing'
    launchBalls(state)
  }
}

export function togglePause(state: GameState): void {
  if (state.status === 'playing') state.status = 'paused'
  else if (state.status === 'paused') state.status = 'playing'
}

function collideWalls(ball: Ball, state: GameState): void {
  if (ball.pos.x - ball.radius < 0) {
    ball.pos.x = ball.radius
    ball.vel.x = Math.abs(ball.vel.x)
  } else if (ball.pos.x + ball.radius > state.width) {
    ball.pos.x = state.width - ball.radius
    ball.vel.x = -Math.abs(ball.vel.x)
  }
  if (ball.pos.y - ball.radius < 0) {
    ball.pos.y = ball.radius
    ball.vel.y = Math.abs(ball.vel.y)
  }
}

function collidePaddle(ball: Ball, state: GameState): void {
  const p = state.paddle
  const left = p.x - p.width / 2
  const right = p.x + p.width / 2
  const top = p.y - p.height / 2
  if (
    ball.vel.y > 0 &&
    ball.pos.y + ball.radius >= top &&
    ball.pos.y - ball.radius <= p.y + p.height / 2 &&
    ball.pos.x >= left &&
    ball.pos.x <= right
  ) {
    const offset = (ball.pos.x - p.x) / (p.width / 2) // -1..1
    const maxAngle = Math.PI / 3 // 60 degrees
    const angle = -Math.PI / 2 + offset * maxAngle
    const speed = Math.hypot(ball.vel.x, ball.vel.y) || BALL_SPEED
    ball.vel.x = Math.cos(angle) * speed
    ball.vel.y = Math.sin(angle) * speed
    ball.pos.y = top - ball.radius
  }
}

function maybeDropPowerUp(state: GameState, brick: Brick): void {
  if (Math.random() > POWERUP_DROP_CHANCE) return
  const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)]
  state.powerUps.push({
    kind,
    pos: { x: brick.x + brick.width / 2, y: brick.y + brick.height / 2 },
    width: 28,
    height: 16,
    vy: 150,
  })
}

function collideBricks(ball: Ball, state: GameState): void {
  for (const brick of state.bricks) {
    if (!brick.alive) continue
    if (
      ball.pos.x + ball.radius > brick.x &&
      ball.pos.x - ball.radius < brick.x + brick.width &&
      ball.pos.y + ball.radius > brick.y &&
      ball.pos.y - ball.radius < brick.y + brick.height
    ) {
      brick.alive = false
      state.score += 10
      const overlapX = Math.min(
        ball.pos.x + ball.radius - brick.x,
        brick.x + brick.width - (ball.pos.x - ball.radius),
      )
      const overlapY = Math.min(
        ball.pos.y + ball.radius - brick.y,
        brick.y + brick.height - (ball.pos.y - ball.radius),
      )
      if (overlapX < overlapY) ball.vel.x = -ball.vel.x
      else ball.vel.y = -ball.vel.y
      maybeDropPowerUp(state, brick)
      break // at most one brick per ball per step
    }
  }
}

function addMultiBalls(state: GameState): void {
  const source = [...state.balls]
  for (const ball of source) {
    const speed = Math.hypot(ball.vel.x, ball.vel.y) || BALL_SPEED
    const base = Math.atan2(ball.vel.y, ball.vel.x)
    for (const da of [-0.4, 0.4]) {
      state.balls.push({
        pos: { x: ball.pos.x, y: ball.pos.y },
        vel: { x: Math.cos(base + da) * speed, y: Math.sin(base + da) * speed },
        radius: ball.radius,
      })
    }
  }
}

function applyPowerUp(state: GameState, kind: PowerUpKind): void {
  switch (kind) {
    case 'life':
      state.lives = Math.min(state.lives + 1, MAX_LIVES)
      break
    case 'multi':
      addMultiBalls(state)
      break
    case 'expand': {
      const existing = state.effects.find((e) => e.kind === 'expand')
      if (existing) existing.remainingMs = EFFECT_MS.expand
      else {
        state.paddle.width = state.paddle.baseWidth * EXPAND_FACTOR
        state.effects.push({ kind: 'expand', remainingMs: EFFECT_MS.expand })
      }
      break
    }
    case 'slow': {
      const existing = state.effects.find((e) => e.kind === 'slow')
      if (existing) existing.remainingMs = EFFECT_MS.slow
      else {
        for (const ball of state.balls) {
          ball.vel.x *= SLOW_FACTOR
          ball.vel.y *= SLOW_FACTOR
        }
        state.effects.push({ kind: 'slow', remainingMs: EFFECT_MS.slow })
      }
      break
    }
  }
}

function catchPowerUps(state: GameState): void {
  const p = state.paddle
  const left = p.x - p.width / 2
  const right = p.x + p.width / 2
  const top = p.y - p.height / 2
  const bottom = p.y + p.height / 2
  const remaining: PowerUp[] = []
  for (const pu of state.powerUps) {
    const hit =
      pu.pos.x + pu.width / 2 >= left &&
      pu.pos.x - pu.width / 2 <= right &&
      pu.pos.y + pu.height / 2 >= top &&
      pu.pos.y - pu.height / 2 <= bottom
    if (hit) applyPowerUp(state, pu.kind)
    else remaining.push(pu)
  }
  state.powerUps = remaining
}

function expireEffects(state: GameState, dtMs: number): void {
  for (const e of state.effects) e.remainingMs -= dtMs
  for (const e of state.effects) {
    if (e.remainingMs > 0) continue
    if (e.kind === 'expand') {
      state.paddle.width = state.paddle.baseWidth
    } else if (e.kind === 'slow') {
      for (const ball of state.balls) {
        ball.vel.x /= SLOW_FACTOR
        ball.vel.y /= SLOW_FACTOR
      }
    }
  }
  state.effects = state.effects.filter((e) => e.remainingMs > 0)
}

function loseBall(state: GameState): void {
  state.lives -= 1
  if (state.lives <= 0) {
    state.status = 'lost'
    return
  }
  // Reset board state for the next ball.
  state.effects = []
  state.paddle.width = state.paddle.baseWidth
  state.powerUps = []
  state.balls = [makeBall(state.width, state.height)]
  state.status = 'ready'
}

/** Advance the simulation by dt seconds. No-op unless status is 'playing'. */
export function stepPhysics(state: GameState, dt: number): void {
  if (state.status !== 'playing') return
  const dtMs = dt * 1000

  for (const ball of state.balls) {
    ball.pos.x += ball.vel.x * dt
    ball.pos.y += ball.vel.y * dt
    collideWalls(ball, state)
    collidePaddle(ball, state)
    collideBricks(ball, state)
  }

  state.balls = state.balls.filter((b) => b.pos.y - b.radius <= state.height)
  if (state.balls.length === 0) {
    loseBall(state)
    return
  }

  for (const pu of state.powerUps) pu.pos.y += pu.vy * dt
  catchPowerUps(state)
  state.powerUps = state.powerUps.filter((pu) => pu.pos.y - pu.height / 2 <= state.height)

  expireEffects(state, dtMs)

  if (state.bricks.every((b) => !b.alive)) state.status = 'won'
}
```

- [ ] **Step 2: Smoke-test the engine** (ephemeral, not committed)

Run:
```bash
npx tsx -e "import {createInitialState,startGame,stepPhysics} from './src/lib/games/breakout-engine.ts'; const s=createInitialState({width:800,height:600,cols:10,rows:6,lives:3}); console.assert(s.bricks.length===60,'bricks'); console.assert(s.status==='ready','ready'); startGame(s); console.assert(s.status==='playing','playing'); const v=Math.hypot(s.balls[0].vel.x,s.balls[0].vel.y); console.assert(v>0,'launched'); for(let i=0;i<600;i++) stepPhysics(s,1/60); console.assert(['playing','won','lost','ready'].includes(s.status),'status'); console.log('engine ok', s.status, 'score', s.score)"
```
Expected: prints `engine ok ...` with no assertion failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/games/breakout-engine.ts
git commit -m "feat(games): breakout physics engine with power-ups"
```

---

### Task C2: Breakout component (canvas + input + HUD)

**Files:**
- Modify (replace stub): `src/components/games/Breakout.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameStat } from './GameStat'
import {
  createInitialState,
  setPaddleX,
  startGame,
  stepPhysics,
  togglePause,
  POWERUP_META,
} from '@/lib/games/breakout-engine'
import type { GameState } from '@/lib/games/types'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'

const LOGICAL_W = 800
const LOGICAL_H = 600
const CONFIG = { width: LOGICAL_W, height: LOGICAL_H, cols: 10, rows: 6, lives: 3 } as const

export function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createInitialState(CONFIG))
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)
  const reduceRef = useRef(false)

  // HUD mirror (read from state each frame, throttled by React batching).
  const [hud, setHud] = useState({ score: 0, lives: CONFIG.lives, status: 'ready' as GameState['status'] })
  const [best, setBest] = useState(0)

  const resetGame = useCallback(() => {
    stateRef.current = createInitialState(CONFIG)
    setHud({ score: 0, lives: CONFIG.lives, status: 'ready' })
  }, [])

  // Draw a single frame.
  const draw = useCallback((ctx: CanvasRenderingContext2D, s: GameState) => {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H)
    // Playfield border
    ctx.strokeStyle = '#27272a'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, LOGICAL_W - 2, LOGICAL_H - 2)
    // Bricks (alpha banded by row for monochrome depth)
    for (const b of s.bricks) {
      if (!b.alive) continue
      const alpha = 0.55 + (b.row / Math.max(CONFIG.rows - 1, 1)) * 0.4
      ctx.fillStyle = `rgba(250,250,250,${alpha})`
      ctx.fillRect(b.x, b.y, b.width, b.height)
    }
    // Paddle
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(s.paddle.x - s.paddle.width / 2, s.paddle.y - s.paddle.height / 2, s.paddle.width, s.paddle.height)
    // Balls
    for (const ball of s.balls) {
      ctx.beginPath()
      ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()
    }
    // Power-up capsules (white pill, zinc border, glyph)
    for (const pu of s.powerUps) {
      const x = pu.pos.x - pu.width / 2
      const y = pu.pos.y - pu.height / 2
      ctx.fillStyle = '#fafafa'
      ctx.strokeStyle = '#27272a'
      ctx.lineWidth = 1
      ctx.beginPath()
      const r = pu.height / 2
      ctx.roundRect(x, y, pu.width, pu.height, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#09090b'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(POWERUP_META[pu.kind].glyph, pu.pos.x, pu.pos.y + 0.5)
    }
  }, [])

  // Game loop.
  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setBest(getBest(BEST_KEYS.breakout))

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // DPR-aware sizing against the logical resolution.
    const setupSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = LOGICAL_W * dpr
      canvas.height = LOGICAL_H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    setupSize()

    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.1 })
    io.observe(canvas)

    const tick = (t: number) => {
      const s = stateRef.current
      const last = lastRef.current || t
      let dt = (t - last) / 1000
      lastRef.current = t
      if (dt > 0.05) dt = 0.05 // clamp after tab switch
      const active = visible && !document.hidden
      if (active && s.status === 'playing') stepPhysics(s, dt)
      draw(ctx, s)
      setHud((h) =>
        h.score === s.score && h.lives === s.lives && h.status === s.status
          ? h
          : { score: s.score, lives: s.lives, status: s.status },
      )
      if (s.status === 'won' || s.status === 'lost') {
        if (setBestIfHigher(BEST_KEYS.breakout, s.score)) setBest(s.score)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      io.disconnect()
    }
  }, [draw])

  // Pointer -> paddle.
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W
    setPaddleX(stateRef.current, x)
  }, [])

  const launchOrPause = useCallback(() => {
    const s = stateRef.current
    if (s.status === 'ready') startGame(s)
    else if (s.status === 'won' || s.status === 'lost') resetGame()
    else togglePause(s)
  }, [resetGame])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current
      const step = 40
      if (e.key === 'ArrowLeft' || e.key === 'a') setPaddleX(s, s.paddle.x - step)
      else if (e.key === 'ArrowRight' || e.key === 'd') setPaddleX(s, s.paddle.x + step)
      else if (e.key === ' ') {
        e.preventDefault()
        launchOrPause()
      } else if (e.key === 'p') togglePause(s)
      else if (e.key === 'r') resetGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launchOrPause, resetGame])

  const overlayText =
    hud.status === 'ready'
      ? 'Press space or tap to launch'
      : hud.status === 'paused'
        ? 'Paused'
        : hud.status === 'won'
          ? `Cleared. Score ${hud.score}.`
          : hud.status === 'lost'
            ? `Game over. Score ${hud.score}.`
            : ''

  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-3 gap-6 border-y border-border py-6">
        <GameStat label="Score" value={hud.score} />
        <GameStat label="Lives" value={hud.lives} />
        <GameStat label="Best" value={best} />
      </div>

      <div className="relative mt-10 select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerDown={launchOrPause}
          role="img"
          aria-label="Breakout game playfield"
          className="w-full rounded-lg border border-border bg-background touch-none"
          style={{ aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}` }}
        />
        {overlayText && (
          <button
            type="button"
            onClick={launchOrPause}
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg text-foreground font-serif text-2xl"
          >
            {overlayText}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Mouse or touch to move. Arrow keys or A and D also work. Space launches and pauses,
        P pauses, R restarts. E widens the paddle, M splits the ball, S slows it down, plus adds a life.
      </p>
    </div>
  )
}
```

> **Note on `roundRect`:** `CanvasRenderingContext2D.roundRect` is supported in current browsers and TypeScript lib DOM. If `npm run type-check` flags it, replace the capsule fill with a plain `ctx.fillRect(x, y, pu.width, pu.height)` plus border, keeping the glyph.

- [ ] **Step 2: Verify**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual check**

`npm run dev`, open `/games/breakout`. Confirm: space/tap launches; ball bounces off walls, paddle (angle varies by hit point), and bricks; bricks clear and score rises; some bricks drop labelled capsules that the paddle catches and that visibly take effect (wider paddle, extra balls, slower ball, extra life); losing the last ball costs a life; clearing the wall shows "Cleared"; losing all lives shows "Game over"; Best persists across reloads; switching tabs pauses then resumes; canvas is crisp on a high-DPR display and scales with the window.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/Breakout.tsx
git commit -m "feat(games): breakout canvas game with power-ups"
```

**Workstream C complete.**

---

# Workstream D — Site-wide Motion

Depends on A (for `lib/motion.ts` and the Header nav link). D edits `Header.tsx` after A's nav-link change has landed.

### Task D1: Route transition wrapper

**Files:**
- Create: `src/app/template.tsx`

- [ ] **Step 1: Create the file.** `template.tsx` remounts on every navigation, giving a per-route entrance. Backgrounds live in `layout.tsx` and stay outside this wrapper.

```tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { EASE_OUT_EXPO, DURATION } from '@/lib/motion'
import type { ReactNode } from 'react'

export default function Template({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Manual check**

`npm run dev`. Navigate between Home, Projects, Games, Tutoring. Confirm a brief fade/rise on each route, that back/forward work, and that the fixed `CircuitMesh`/`CircuitBackdrop` backgrounds and the skip link still behave. Toggle reduced motion and confirm transitions are gone but pages still render.

- [ ] **Step 4: Commit**

```bash
git add src/app/template.tsx
git commit -m "feat(motion): subtle route transitions"
```

---

### Task D2: Animated nav indicator in Header

**Files:**
- Modify: `src/components/layout/Header.tsx` (desktop nav `<ul>` block only)

> Prerequisite: A8 has already added the Games nav link. `motion`/`AnimatePresence` are already imported in this file.

- [ ] **Step 1: Add a sliding indicator under the active desktop link.** Replace the desktop nav list items (the `navLinks.map(...)` inside `<ul className="hidden md:flex ...">`) so each active link renders a shared-layout underline. The new markup for each `<li>`:

```tsx
          {navLinks.map(({ href, label }) => {
            const active = pathname === href
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  className={cn(
                    'text-sm transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </Link>
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1.5 left-0 right-0 h-px bg-foreground"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </li>
            )
          })}
```

- [ ] **Step 2: Reduced-motion safety.** Framer's `layoutId` animation is disabled automatically when the user prefers reduced motion if you wrap the app, but to be explicit, the indicator still renders on the active item (it just snaps). No extra code needed; verify in Step 4.

- [ ] **Step 3: Verify**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual check**

`npm run dev`. Confirm the underline sits under the active nav item and slides between Projects / Games / Tutoring as you navigate. Confirm the mobile drawer, scroll background state, and focus trap still work. With reduced motion on, the underline appears on the active item without sliding.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(motion): animated active nav indicator"
```

---

### Task D3: Subtle card hover micro-interaction

**Files:**
- Create: `src/components/ui/MotionCard.tsx`
- Modify: `src/app/games/page.tsx` (wrap each card)
- Modify: `src/app/projects/page.tsx` (wrap clickable cards) — optional, low risk

- [ ] **Step 1: Create a reusable hover wrapper**

```tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cardHover, springSubtle } from '@/lib/motion'
import type { ReactNode } from 'react'

/** Wraps a card in a very subtle lift on hover. Reduced-motion safe. */
export function MotionCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      transition={springSubtle}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Wrap the games cards.** In `src/app/games/page.tsx`, wrap the `<Link>` inside each `SectionReveal` with `<MotionCard>`:

```tsx
            <SectionReveal key={game.href} delay={0.08 * i}>
              <MotionCard>
                <Link
                  href={game.href}
                  className="group block border border-border rounded-lg p-8 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between min-h-[220px]"
                >
                  {/* ...unchanged card body... */}
                </Link>
              </MotionCard>
            </SectionReveal>
```

Add the import at the top: `import { MotionCard } from '@/components/ui/MotionCard'`.

- [ ] **Step 3 (optional): Wrap the projects cards the same way** in `src/app/projects/page.tsx` for the clickable `<Link>` cards only (leave the dashed "coming soon" card untouched). Same import + `<MotionCard>` wrapper.

- [ ] **Step 4: Verify**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual check**

`npm run dev`, hover the cards on `/games` (and `/projects` if wrapped). Confirm a small lift that does not cause layout shift or jitter, and that it is absent under reduced motion.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/MotionCard.tsx src/app/games/page.tsx src/app/projects/page.tsx
git commit -m "feat(motion): subtle card hover lift"
```

**Workstream D complete.**

---

# Workstream E — SEO / OG images / structured data

Depends on the three routes existing (A6/A7). JsonLd is already in the page shells (A6/A7), so E covers OG/Twitter images.

### Task E1: OG + Twitter images for the games routes

**Files:**
- Create: `src/app/games/opengraph-image.tsx`
- Create: `src/app/games/twitter-image.tsx`
- Create: `src/app/games/typing-test/opengraph-image.tsx`
- Create: `src/app/games/typing-test/twitter-image.tsx`
- Create: `src/app/games/breakout/opengraph-image.tsx`
- Create: `src/app/games/breakout/twitter-image.tsx`

> Uses the shared `renderOgImage` helper in `src/lib/og.tsx`. Each `twitter-image.tsx` just re-exports its sibling `opengraph-image.tsx`, matching `src/app/projects/twitter-image.tsx`.

- [ ] **Step 1: Hub OG** — `src/app/games/opengraph-image.tsx`

```tsx
import { renderOgImage } from '@/lib/og'

export const alt = 'Games | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Games',
    title: 'A break from the brief',
    subtitle: 'A live WPM typing speed test and a monochrome Breakout with power-ups.',
  })
}
```

- [ ] **Step 2: Hub Twitter** — `src/app/games/twitter-image.tsx`

```tsx
export { default, alt, size, contentType } from './opengraph-image'
```

- [ ] **Step 3: Typing OG** — `src/app/games/typing-test/opengraph-image.tsx`

```tsx
import { renderOgImage } from '@/lib/og'

export const alt = 'Typing speed test | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Live WPM',
    title: 'Typing speed test',
    subtitle: 'Curated law, AI governance and cybersecurity phrases, measured in real time.',
  })
}
```

- [ ] **Step 4: Typing Twitter** — `src/app/games/typing-test/twitter-image.tsx`

```tsx
export { default, alt, size, contentType } from './opengraph-image'
```

- [ ] **Step 5: Breakout OG** — `src/app/games/breakout/opengraph-image.tsx`

```tsx
import { renderOgImage } from '@/lib/og'

export const alt = 'Breakout | Ahmed Hussain'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Arcade',
    title: 'Breakout',
    subtitle: 'Clear the wall, catch falling power-ups, and chase a personal best.',
  })
}
```

- [ ] **Step 6: Breakout Twitter** — `src/app/games/breakout/twitter-image.tsx`

```tsx
export { default, alt, size, contentType } from './opengraph-image'
```

- [ ] **Step 7: Verify + commit**

Run: `npm run type-check && npm run build`
Expected: PASS; build lists the new `opengraph-image`/`twitter-image` routes under `/games/*`.

```bash
git add src/app/games/opengraph-image.tsx src/app/games/twitter-image.tsx src/app/games/typing-test/opengraph-image.tsx src/app/games/typing-test/twitter-image.tsx src/app/games/breakout/opengraph-image.tsx src/app/games/breakout/twitter-image.tsx
git commit -m "feat(games): OG and Twitter images for games routes"
```

**Workstream E complete.**

---

# Workstream F — Integration & verification

Run after B, C, D, E land.

### Task F1: Full verification pass

- [ ] **Step 1: Static checks**

Run: `npm run type-check && npm run lint && npm run build`
Expected: all PASS, no warnings introduced. Build route list includes `/games`, `/games/typing-test`, `/games/breakout` and their image routes.

- [ ] **Step 2: Manual acceptance (per spec sections 4.4, 5.8, 5.9, 6.5)**

`npm run dev` and verify:
- Nav shows Games; the animated indicator tracks the active route; route transitions are subtle; card hover lifts subtly.
- Typing test: live WPM/accuracy, monochrome incorrect-char styling, finish result, Best persists, keyboard + touch, reduced-motion safe.
- Breakout: launch/pause/restart, correct collisions and paddle-angle, lives/score/win/lose overlays, power-ups drop/fall/catch/apply/expire and active effects visible, Best persists, tab-hidden pause, crisp DPR scaling, mouse/touch/keyboard.
- Reduced motion (devtools emulation): no decorative animation anywhere; both games still fully playable.

- [ ] **Step 3: Confirm constraints (spec section 9)**

- No colour anywhere in the new UI. No new env vars. No new API routes. `robots.ts` unchanged. No em dashes in new copy.

- [ ] **Step 4: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore(games): integration fixups and verification"
```

- [ ] **Step 5: Branch handoff**

Per `superpowers:finishing-a-development-branch`, present merge/PR options to Ahmed. Do not merge or open a PR without his go-ahead.

---

## Self-review notes (author)

- **Spec coverage:** routes/nav/sitemap (A6-A8), typing test incl. live WPM + best + monochrome states + reduced motion (B1-B3), Breakout incl. canvas/DPR/pause/lives/score/win-lose (C1-C2), power-ups incl. multi-ball/timed effects/data table/HUD (C1-C2 + spec 5.9), motion tokens/route transition/nav indicator/card hover (A1, D1-D3), storage (A3), SEO metadata+JsonLd (A6-A7) and OG images (E1). All spec sections map to a task.
- **Type consistency:** `GameState.balls` is an array everywhere; `setPaddleX`, `startGame`, `togglePause`, `stepPhysics`, `createInitialState`, `POWERUP_META` names match between `breakout-engine.ts` (C1) and `Breakout.tsx` (C2). `BEST_KEYS`, `getBest`, `setBestIfHigher` match between A3 and B3/C2. `EASE_OUT_EXPO`, `DURATION`, `cardHover`, `springSubtle` match between A1 and D1/D3.
- **Known verification caveats flagged inline:** `Button` props (B3) and `roundRect` support (C2) each carry a fallback note.
