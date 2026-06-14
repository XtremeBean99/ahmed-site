import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://ahmedyhussain.com'

  return {
    rules: [
      // General crawlers: allow the site, disallow API
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      // AI training crawlers - disallow entirely
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'ChatGPT-User', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'Claude-SearchBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'PerplexityBot', disallow: '/' },
      { userAgent: 'Bytespider', disallow: '/' },
      { userAgent: 'Amazonbot', disallow: '/' },
      { userAgent: 'FacebookBot', disallow: '/' },
      { userAgent: 'Applebot-Extended', disallow: '/' },
      { userAgent: 'cohere-ai', disallow: '/' },
      { userAgent: 'omgili', disallow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
