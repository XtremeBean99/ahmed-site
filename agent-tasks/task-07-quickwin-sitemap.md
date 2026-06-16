# Task 07 — Sitemap update

## Objective
Add the new routes to the sitemap so they're discoverable. This task is trivial but **must run
last** (or be rebased after) tasks 03 and 04, because it references the routes they create.

## Read first
- `src/app/sitemap.ts` — the entire current sitemap
- `agent-tasks/README.md`

## Current state
`src/app/sitemap.ts` lists: `/`, `/projects`, `/tutoring`, `/legal/terms`, `/legal/privacy`.
Missing: `/projects/code` (task 03) and `/projects/silicon` (task 04).

## Steps
1. Add two entries:
   ```ts
   { url: `${base}/projects/code`, lastModified: new Date('2026-06-16'), changeFrequency: 'daily', priority: 0.8 },
   { url: `${base}/projects/silicon`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.7 },
   ```
   - `/projects/code` pulls live from GitHub → `changeFrequency: 'daily'` is appropriate.
   - `/projects/silicon` is static content → `'monthly'`.
   - Use the actual date the work lands for `lastModified` (today is fine).
2. Keep the existing entries and the `base` constant unchanged. Match the existing formatting.
3. If, by the time you run, either route does **not** yet exist in `src/app/`, do not add a
   sitemap entry for a 404 — coordinate with Pi so this runs after 03/04 merge.

## Acceptance criteria
- `sitemap.ts` includes all live routes and no dead ones.
- `npm run build` passes; `/sitemap.xml` lists the new URLs.
