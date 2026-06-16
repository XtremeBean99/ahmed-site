# Task 05 — Per-route Open Graph images

## Objective
Every shareable route should have its own social-share (OG/Twitter) image. Today only the
homepage does — `/projects`, `/tutoring`, and the new `/projects/code` and `/projects/silicon`
inherit the generic homepage image. Generate route-specific ones.

## Read first
- `CLAUDE.md`, `agent-tasks/README.md`
- `src/app/opengraph-image.tsx` — the existing homepage generator (copy this exactly as your
  template; it uses `next/og` `ImageResponse`)
- `src/app/twitter-image.tsx` — Twitter variant (mirror the same pattern)
- `src/app/layout.tsx` — root metadata (don't duplicate OG that the file-based images cover)

## How Next.js file-based OG works
A file named `opengraph-image.tsx` (and/or `twitter-image.tsx`) placed in a route segment
folder is automatically used as that route's `og:image` / `twitter:image`. Export `alt`,
`size = { width: 1200, height: 630 }`, `contentType = 'image/png'`, and a default function
returning `new ImageResponse(<JSX/>, { ...size })`. No metadata wiring needed.

## Steps
For each route below, add an `opengraph-image.tsx` (and a matching `twitter-image.tsx` — it can
re-export the same component) in the route's folder. **Match the existing visual template**:
`#09090b` background, `80px` padding, tracked uppercase eyebrow in `#a1a1aa`, large serif-ish
title in `#fafafa`, a subtitle in `#a1a1aa`, and the bottom rule (`1px solid #27272a`) with
"ahmedyhussain.com". Only the **text content** changes per route. Strictly monochrome.

| Folder | Eyebrow | Title | Subtitle |
|--------|---------|-------|----------|
| `src/app/projects/` | `Live tracker` | `AI & Cyber Litigation Tracker` | `A source-cited dataset of AI, copyright and data-protection disputes.` |
| `src/app/projects/code/` | `Open source` | `Code & open source` | `Public software, pulled live from GitHub.` |
| `src/app/projects/silicon/` | `Interactive` | `Silicon — from atom to architecture` | `How four valence electrons end up running every computer.` |
| `src/app/tutoring/` | `Canberra · Years 7–12` | `Private tutoring` | `Physics, Maths, English & Legal Studies. Online & in person.` |

Notes:
- `next/og` `ImageResponse` uses inline styles only and supports a **subset** of CSS. Every
  element with children needs `display: flex` (the existing file already follows this — keep to
  its patterns and you'll be fine). Reuse its exact style objects; just swap strings.
- Keep `twitter-image.tsx` minimal — it can simply re-export:
  `export { default, alt, size, contentType } from './opengraph-image'`
  (verify Next picks this up; if not, duplicate the file). Confirm whichever you choose builds.
- To reduce duplication you *may* extract a shared `renderOgImage({ eyebrow, title, subtitle })`
  helper in e.g. `src/lib/og.tsx` and have each route's file call it. Optional — only if it
  stays clean and builds. If unsure, copy-paste per route (the existing homepage file is the
  reference) — clarity over DRY here.

## Constraints
- Monochrome; reuse the existing palette exactly (`#09090b`, `#fafafa`, `#a1a1aa`, `#52525b`,
  `#27272a`).
- `size` must stay `1200×630`.
- Do not break the existing homepage OG image.

## Acceptance criteria
- Each of the four routes above produces its own OG image (verify in the build output /
  `view-source` `og:image` URL, or by hitting `/<route>/opengraph-image`).
- Twitter image resolves for each route too.
- `npm run build` passes (OG images are generated at build/request — build must not error).
