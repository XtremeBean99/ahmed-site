import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { getRepos, type Repo } from '@/lib/github/repos'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Code & open source',
  description:
    'Public software repositories by Ahmed Hussain, pulled live from GitHub. Open source projects spanning law, computing and tooling.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/code' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** A single repo card — monochrome, no language colour swatches. */
function RepoCard({ repo }: { repo: Repo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-border rounded-lg p-6 bg-surface hover:border-muted-foreground/50 hover:bg-surface-hover transition-colors h-full flex flex-col justify-between group"
    >
      <div>
        <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-muted-foreground transition-colors mb-2">
          {repo.name}
        </h3>
        {repo.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
            {repo.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {repo.language && (
          <span className="border border-border-subtle rounded-md px-2 py-0.5 bg-surface">
            {repo.language}
          </span>
        )}
        <span>{repo.stars} ★</span>
        <span className="ml-auto">{formatDate(repo.updatedAt)}</span>
      </div>
    </a>
  )
}

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Code & open source',
  description: 'Public software repositories by Ahmed Hussain, pulled live from GitHub.',
  url: 'https://ahmedyhussain.com/projects/code',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default async function CodeProjectsPage() {
  const repos = await getRepos()

  return (
    <div className="pt-32 pb-24">
      <JsonLd data={webpageSchema} />
      <div className="max-w-container mx-auto px-6">
        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">Projects · Code</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            Code &amp; open source
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-4">
            Public repositories pulled live from GitHub — the software side of my
            law-and-computing work. Tools, experiments, and projects that run where
            code meets legal reasoning.
          </p>
        </SectionReveal>

        {/* Repo grid or fallback */}
        <SectionReveal delay={0.08}>
          <div className="mt-12">
            {repos.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {repos.map((repo) => (
                  <RepoCard key={repo.name} repo={repo} />
                ))}
              </div>
            ) : (
              <div className="border border-border rounded-lg p-8 bg-surface text-center max-w-xl">
                <p className="text-muted-foreground text-lg mb-4">
                  Unable to load repositories right now.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  The GitHub API may be temporarily unavailable or rate-limited. You can
                  browse all repositories directly.
                </p>
                <a
                  href="https://github.com/XtremeBean99"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm text-foreground underline underline-offset-2 hover:no-underline transition-colors"
                >
                  github.com/XtremeBean99 →
                </a>
              </div>
            )}
          </div>
        </SectionReveal>

        {/* Methodology */}
        <SectionReveal delay={0.1}>
          <div className="mt-20 border-t border-border pt-8 max-w-2xl">
            <p className="label-text mb-3">Data source</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Repository data is pulled live from the public GitHub REST API and refreshed
              hourly. Only public, non-fork, non-archived repositories are shown.
            </p>
          </div>
        </SectionReveal>
      </div>
    </div>
  )
}
