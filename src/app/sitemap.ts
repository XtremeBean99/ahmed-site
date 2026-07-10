import type { MetadataRoute } from 'next'

const base = 'https://ahmedyhussain.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
  ]
}
