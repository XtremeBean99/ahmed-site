# Task 03 — GitHub project page (`/projects/code`)

## Objective
Create a second project: a page that shows Ahmed's public GitHub work, fetched live from the
GitHub REST API and rendered as monochrome repo cards. The homepage project card (task 02)
links here.

GitHub username: **`XtremeBean99`** (from the repo URL in `CLAUDE.md`).

## Read first
- `CLAUDE.md`, `agent-tasks/README.md`
- `src/app/projects/page.tsx` — the litigation tracker page; copy its page scaffold/idiom
  (heading block, `SectionReveal`, `max-w-container` wrapper, methodology footer tone)
- `src/components/projects/StatCounters.tsx` and `CaseList.tsx` — card/grid idiom
- `next.config.ts` — note the CSP. **Server-side `fetch` is NOT subject to the browser CSP**,
  so fetching GitHub from a Server Component is fine and needs no CSP change.

## Design decision: this is a Server Component
Fetch GitHub data on the server with Next's caching. Do **not** call GitHub from the client
(it would hit CSP `connect-src 'self'` and leak rate-limited unauthenticated calls per visitor).

## Steps

1. **Create a typed data layer** `src/lib/github/repos.ts`:

   ```ts
   export interface Repo {
     name: string
     description: string | null
     url: string
     language: string | null
     stars: number
     forks: number
     updatedAt: string   // ISO
     topics: string[]
   }

   const USERNAME = 'XtremeBean99'

   /**
    * Public, unauthenticated GitHub REST call. 60 req/hr/IP unauthenticated — fine
    * with Next's revalidate cache (one upstream call per revalidate window per region).
    * If GITHUB_TOKEN is set we send it to raise the limit; it is optional.
    */
   export async function getRepos(): Promise<Repo[]> {
     const token = process.env.GITHUB_TOKEN
     const res = await fetch(
       `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`,
       {
         headers: {
           Accept: 'application/vnd.github+json',
           'X-GitHub-Api-Version': '2022-11-28',
           ...(token ? { Authorization: `Bearer ${token}` } : {}),
         },
         next: { revalidate: 3600 }, // refresh hourly
       },
     )
     if (!res.ok) return [] // degrade gracefully — page still renders
     const data = (await res.json()) as any[]
     return data
       .filter((r) => !r.fork && !r.private && !r.archived)
       .map((r) => ({
         name: r.name,
         description: r.description,
         url: r.html_url,
         language: r.language,
         stars: r.stargazers_count,
         forks: r.forks_count,
         updatedAt: r.updated_at,
         topics: r.topics ?? [],
       }))
       .sort((a, b) => b.stars - a.stars || +new Date(b.updatedAt) - +new Date(a.updatedAt))
   }
   ```

   - `GITHUB_TOKEN` is **optional**. Add it to `.env.example` with a comment that it is
     optional and only raises the API rate limit (no secret value committed).

2. **Create the page** `src/app/projects/code/page.tsx` (Server Component):
   - `export const metadata` with `title: 'Code & open source'`, a description, and
     `alternates: { canonical: 'https://ahmedyhussain.com/projects/code' }`.
   - Reuse the page scaffold from `src/app/projects/page.tsx`: `label-text` eyebrow
     ("Projects · Code"), serif `h1`, an intro paragraph, then the repo grid.
   - `const repos = await getRepos()`.
   - Render a responsive grid of repo cards (`grid sm:grid-cols-2 lg:grid-cols-3 gap-6`),
     each card matching the bordered-panel idiom (`border border-border rounded-lg p-6 bg-surface
     hover:border-... transition-colors`). Per card: repo name (serif, link out to `repo.url`
     with `target="_blank" rel="noopener noreferrer"`), description, and a footer row of meta
     (language, ★ stars, updated date). Render language/stars as plain monochrome text or
     `border-subtle` chips — **no language colour dots** (GitHub uses colour; we do not).
   - **Empty/error state:** if `repos` is empty (API down or rate-limited), render a graceful
     fallback panel with a short message and a direct link to
     `https://github.com/XtremeBean99`. Do not crash.
   - Format `updatedAt` with `toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })`.

3. **Methodology/footer note** (match the tracker's tone): one line noting data is pulled live
   from the public GitHub API and refreshes hourly.

## Constraints
- Server Component only; no client JS needed.
- Monochrome — no language colour swatches, no GitHub green.
- Graceful degradation when the API fails (never throw to the user).
- External links: `target="_blank" rel="noopener noreferrer"`.

## Acceptance criteria
- `/projects/code` renders a monochrome grid of real repos for `XtremeBean99`.
- Works with no `GITHUB_TOKEN` set (just relies on the unauthenticated limit + cache).
- Renders a sensible fallback when the API returns non-200.
- `.env.example` documents the optional `GITHUB_TOKEN`.
- Coordinate with task 07 (sitemap) and task 05 (OG image) for this new route.
- `npm run type-check && npm run lint && npm run build` pass.
