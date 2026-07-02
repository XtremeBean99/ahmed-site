import type { MetadataRoute } from 'next'

const base = 'https://ahmedyhussain.com'
const now = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/projects`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/projects/code`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/projects/silicon`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/projects/aglc4`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/projects/base-converter`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/projects/ninja`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/games`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/games/ninja`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/games/typing-test`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/games/breakout`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/games/contract`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/tutoring`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
