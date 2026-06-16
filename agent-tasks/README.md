# Agent Task Pack — ahmedyhussain.com

This folder is the work queue for the build agents (DeepSeek v4pro, managed by Pi).
Each `task-XX-*.md` file is **one self-contained unit of work**. Read this README first,
then read the single task file you are assigned. Do not start coding until you have read
both, plus the files each task tells you to read.

> Authoritative project context lives in `/CLAUDE.md` at the repo root. These task files
> assume it. If anything here conflicts with `CLAUDE.md`, `CLAUDE.md` wins — flag the conflict.

---

## What we are building this round

| # | Task | Output | Depends on |
|---|------|--------|-----------|
| 01 | Site logo | Logo in header + favicon/OG wiring | — |
| 02 | Project cards overhaul | `ProjectsPreview` becomes a 4-card grid | 03, 04 (for links) |
| 03 | GitHub project | `/projects/code` page + data | — |
| 04 | Silicon atom 3D project | `/projects/silicon` page (3D render + explainer) | — |
| 05 | Per-route OG images | `opengraph-image.tsx` for each route | 03, 04 (new routes) |
| 06 | JSON-LD structured data | `Person` / `Service` / `WebPage` schema | 03, 04 |
| 07 | Sitemap | All new routes added to `sitemap.ts` | 03, 04 |

**Recommended execution order:** 01 → 03 → 04 → 02 → 05 → 06 → 07.
Tasks 03 and 04 create the routes that 02, 05, 06, 07 reference. Task 02 can be done
earlier with placeholder hrefs (`/projects/code`, `/projects/silicon`) that the later
tasks make real, but it is cleaner to do 03/04 first.

Pi may parallelise 01, 03, 04 (no shared files). 02/05/06/07 should run after, or be
rebased once the new routes exist.

---

## Non-negotiable constraints (read `CLAUDE.md` for the why)

1. **Strictly monochrome.** Background `#09090b` (zinc-950), text `#fafafa`, borders `#27272a`.
   **No colour, no gradients** except the existing hero vignette. Anything you add — including
   the 3D silicon render and the logo — must be greyscale. If the logo is coloured, render it
   `grayscale`. Reference aesthetic: Vercel / Linear / Stripe.
2. **All user input is hostile.** Any new form or API route must use server-side Zod validation,
   a honeypot, and DB-based rate limiting — copy the pattern from `src/services/contact.ts`.
   None of this round's tasks add a form; if you think you need one, stop and ask Pi.
3. **No raw SQL.** All DB access through Prisma. (No task this round touches the DB.)
4. **Secrets via env vars only.** Never hardcode. If a task needs a new env var, add it to
   `.env.example` and document it; do not invent secret values.
5. **Default to Server Components.** Add `'use client'` only when you need browser APIs, React
   state, or Framer Motion / WebGL. The 3D render and any interactive piece are client; the
   GitHub fetch is a server component.
6. **Do not weaken security headers.** `next.config.ts` sets a strict CSP. If a task genuinely
   needs a CSP change, the task file says so explicitly. Otherwise leave it alone.
7. **Do not touch** the litigation tracker dataset (`src/lib/litigation/`), the contact system,
   or the AI-crawler blocking in `robots.ts`.

---

## Design system cheat-sheet (use these, do not reinvent)

Tailwind tokens are defined in `tailwind.config.ts`:

| Token | Hex | Use |
|-------|-----|-----|
| `background` | `#09090b` | page background |
| `foreground` | `#fafafa` | primary text |
| `border` | `#27272a` | default borders |
| `border-subtle` | `#18181b` | faint borders |
| `muted` | `#52525b` | dimmest text/dots |
| `muted-foreground` | `#a1a1aa` | secondary text |
| `surface` | `#111113` | raised panels |
| `surface-hover` | `#18181b` | hover state |

Utility classes (in `src/app/globals.css`):
- `.label-text` — uppercase eyebrow label (xs, tracked, `muted-foreground`).
- `.text-balance` — balanced wrapping for headings.
- `.hero-grid` — dot-grid background (hero only).
- `max-w-container` (72rem) — the standard page width wrapper. Pattern:
  `<div className="max-w-container mx-auto px-6">`.

Reusable building blocks:
- `src/components/ui/SectionReveal.tsx` — scroll-reveal wrapper (`<SectionReveal delay={0.1}>`).
- `src/components/ui/Button.tsx` — `variant="primary" | "secondary"`, `href`, `external`.
- Headings (`h1`–`h5`) are `font-serif` automatically; body is `font-sans`.

Look at `src/components/sections/Skills.tsx` and `src/components/sections/ProjectsPreview.tsx`
for the exact card/section idiom before writing new UI. **Match the surrounding code's
naming, comment density, and structure.**

---

## File map (where things live)

```
src/
├── app/
│   ├── projects/page.tsx          Litigation tracker (DO NOT restructure)
│   ├── projects/code/page.tsx     NEW (task 03)
│   ├── projects/silicon/page.tsx  NEW (task 04)
│   ├── opengraph-image.tsx        Homepage OG (template to copy — task 05)
│   ├── sitemap.ts                 task 07
│   └── layout.tsx                 root metadata + JSON-LD host (task 06)
├── components/
│   ├── layout/Header.tsx          logo lives here (task 01)
│   ├── sections/ProjectsPreview.tsx  4-card grid (task 02)
│   └── projects/                  tracker components; add new ones here
└── lib/
    └── github/ or lib/silicon/    NEW data/types if a task needs them
public/
└── site-logo.* , favicon.svg      assets (task 01)
```

---

## Definition of done (every task)

Before reporting a task complete, run from the repo root and paste the results to Pi:

```bash
npm run type-check   # tsc --noEmit — must pass clean
npm run lint         # ESLint — must pass (warnings noted)
npm run build        # full production build — must succeed
```

A task is **not** done if any of these fail. Also confirm:
- No colour introduced (visually monochrome).
- No new dependency added unless the task file authorises it (only task 04 does).
- Reduced-motion is respected (`prefers-reduced-motion`) for anything animated.
- New routes are reachable and added to the sitemap (coordinate with task 07).
- Accessibility: images have `alt`, interactive elements are keyboard-reachable and labelled.

When done, report: files changed, commands run + their results, and anything you had to
decide that wasn't in the spec.
