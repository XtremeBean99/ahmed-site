# Task 02 — Project cards overhaul (4-card grid)

## Objective
Replace the homepage Projects section. Today `ProjectsPreview` shows two dashed
"In Development" placeholders. Rebuild it as a **four-card grid**:

1. **AI & Cyber Litigation Tracker** — the real, existing project → links to `/projects`.
2. **Code & open source** — GitHub work → links to `/projects/code` (task 03).
3. **Silicon — from atom to architecture** — 3D silicon atom + explainer → links to
   `/projects/silicon` (task 04).
4. **In progress** — one forward-looking placeholder card (keeps the "more coming" signal).

## Read first
- `CLAUDE.md`, `agent-tasks/README.md`
- `src/components/sections/ProjectsPreview.tsx` — the file you are rewriting
- `src/components/sections/Skills.tsx` — card/grid idiom to mirror
- `src/app/projects/page.tsx` — to pull live tracker stats for card 1 (optional, see below)
- `src/app/page.tsx` — confirms `<ProjectsPreview />` is already mounted (no change needed there)

## Dependencies
Cards 2 and 3 link to routes created in tasks 03 and 04. You may build this task first using
those hrefs as forward references (the routes will exist by merge time). Do not block on them,
but the final merged state must have all routes live.

## Steps

1. **Rewrite `src/components/sections/ProjectsPreview.tsx`** keeping it a **Server Component**
   (it currently is — no `'use client'`). Keep the section shell: `id="projects-preview"`,
   `aria-labelledby="projects-heading"`, `py-32 border-t border-border`, the `max-w-container`
   wrapper, the `SectionReveal` eyebrow + heading. Update the heading from "Work in progress."
   to something that reflects there are now real projects (e.g. "Selected work." or
   "Things I've built.").

2. **Define the cards as data** and map over them (mirror the `skillGroups`/`placeholderProjects`
   pattern). Distinguish *real* cards (with an `href`) from the *in-progress* card (no href):

   ```tsx
   type ProjectCard = {
     label: string
     title: string
     description: string
     href?: string          // present = clickable; absent = "in progress"
     external?: boolean
   }

   const projects: ProjectCard[] = [
     {
       label: 'Live tracker',
       title: 'AI & Cyber Litigation Tracker',
       description:
         'A curated, source-cited dataset of AI, copyright and data-protection disputes, each record verified against its primary court docket.',
       href: '/projects',
     },
     {
       label: 'Open source',
       title: 'Code & open source',
       description:
         'Public repositories pulled live from GitHub — the software side of my law-and-computing work.',
       href: '/projects/code',
     },
     {
       label: 'Interactive',
       title: 'Silicon — from atom to architecture',
       description:
         'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
       href: '/projects/silicon',
     },
     {
       label: 'Research',
       title: 'In development',
       description:
         'Empirical and doctrinal work on AI governance. I will publish it here as it develops.',
       // no href → renders the "coming soon" treatment
     },
   ]
   ```

   Use real, accurate copy — adjust wording to match the site's measured voice. Keep
   descriptions tight (one–two sentences).

3. **Render.** Grid: `grid sm:grid-cols-2 gap-6` (four cards = a tidy 2×2 on desktop; fine to
   use `lg:grid-cols-2` to keep them large, or `lg:grid-cols-3`+ if you prefer — pick what looks
   balanced and matches the spacing rhythm of `Skills`). For each card:
   - **Real cards (has `href`):** wrap the card in a `next/link` `<Link>` (internal) — make the
     whole card a clickable target. Solid border (`border-border`), `bg-surface`, hover state
     (`hover:border-...`/`hover:bg-surface-hover` + a subtle arrow that animates on hover, like
     the Hero's external-link arrow). Show `label` (`.label-text`), serif `h3` title, description,
     and a footer "View project →" affordance.
   - **In-progress card (no `href`):** keep the existing dashed-border treatment
     (`border-dashed border-border`) and the pulsing "Coming soon" dot from the current file —
     not clickable.
   - Keep `SectionReveal` stagger (`delay={0.08 * i}`).

4. **Accessibility:** if the whole card is a link, ensure there's a single clear accessible name
   (the title). Don't nest interactive elements. External links (none here currently, but if a
   card ever points off-site) get `target`/`rel` and `external` handling.

5. **Optional polish (only if quick):** card 1 can show a live count from the tracker, e.g.
   import `trackerStats` from `@/lib/litigation/data` and append "· N cases tracked" to the
   label. Skip if it complicates the Server Component or the build.

## Constraints
- Server Component (no client JS) — `SectionReveal` already handles the reveal animation.
- Monochrome; reuse existing tokens and the bordered-panel idiom. No new colours.
- Do not delete the "in progress" signal entirely — card 4 preserves it.

## Acceptance criteria
- Homepage Projects section shows exactly four cards in the order above.
- Cards 1–3 are clickable and route to `/projects`, `/projects/code`, `/projects/silicon`.
- Card 4 is a non-clickable "in progress" card.
- Visually consistent with `Skills`/existing cards; fully monochrome.
- `npm run type-check && npm run lint && npm run build` pass.
