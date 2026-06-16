export interface Repo {
  name: string
  description: string | null
  url: string
  language: string | null
  stars: number
  forks: number
  updatedAt: string // ISO
  topics: string[]
}

const USERNAME = 'XtremeBean99'

/**
 * Public, unauthenticated GitHub REST call. 60 req/hr/IP unauthenticated, fine
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
  if (!res.ok) return [] // degrade gracefully; page still renders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GitHub REST response shape is loosely typed
  const data = (await res.json()) as Record<string, unknown>[]
  return data
    .filter((r) => !r.fork && !r.private && !r.archived)
    .map((r) => ({
      name: r.name as string,
      description: r.description as string | null,
      url: r.html_url as string,
      language: r.language as string | null,
      stars: r.stargazers_count as number,
      forks: r.forks_count as number,
      updatedAt: r.updated_at as string,
      topics: (r.topics as string[]) ?? [],
    }))
    .sort((a, b) => b.stars - a.stars || +new Date(b.updatedAt) - +new Date(a.updatedAt))
}
