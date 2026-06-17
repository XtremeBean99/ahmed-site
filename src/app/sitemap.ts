import type { MetadataRoute } from 'next'

const base = 'https://ahmedyhussain.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date('2026-06-14'), changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/projects`, lastModified: new Date('2026-06-16'), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/projects/litigation-tracker`, lastModified: new Date('2026-06-16'), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/projects/code`, lastModified: new Date('2026-06-16'), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/projects/silicon`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/projects/aglc4`, lastModified: new Date('2026-06-17'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/projects/base-converter`, lastModified: new Date('2026-06-17'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/games`, lastModified: new Date('2026-06-17'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/games/typing-test`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/games/breakout`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/games/contract`, lastModified: new Date('2026-06-17'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/tutoring`, lastModified: new Date('2026-06-14'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/legal/terms`, lastModified: new Date('2026-06-14'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: new Date('2026-06-14'), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
