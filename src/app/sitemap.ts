import type { MetadataRoute } from 'next'

const base = 'https://ahmedyhussain.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date('2026-06-14'), changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/projects`, lastModified: new Date('2026-06-14'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tutoring`, lastModified: new Date('2026-06-14'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/lab`, lastModified: new Date('2026-06-16'), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/legal/terms`, lastModified: new Date('2026-06-14'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: new Date('2026-06-14'), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
