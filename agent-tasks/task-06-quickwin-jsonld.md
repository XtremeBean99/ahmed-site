# Task 06 — JSON-LD structured data

## Objective
Add Schema.org JSON-LD to improve how search engines understand the site. Three schemas:
`Person` (homepage), `Service` (tutoring), and a light `WebPage`/`CollectionPage` for the
project pages. This is pure SEO/markup — no visual change.

## Read first
- `CLAUDE.md`, `agent-tasks/README.md`
- `src/app/layout.tsx` — where site-wide metadata lives
- `src/app/page.tsx`, `src/app/tutoring/page.tsx`, `src/app/projects/page.tsx`
- `next.config.ts` — CSP. JSON-LD is injected via `<script type="application/ld+json">` with
  `dangerouslySetInnerHTML`. CSP `script-src 'self' 'unsafe-inline'` **already allows inline
  scripts**, so no CSP change is needed.

## Implementation pattern
Create a tiny reusable component `src/components/seo/JsonLd.tsx` (Server Component):

```tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // data is author-controlled (no user input), so this is safe.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
```

Then render `<JsonLd data={...} />` inside the relevant page (it can sit anywhere in the
returned JSX). Use absolute URLs (`https://ahmedyhussain.com/...`).

## Steps

1. **Homepage `Person` (in `src/app/page.tsx`)**:
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Person",
     "name": "Ahmed Hussain",
     "url": "https://ahmedyhussain.com",
     "jobTitle": "BCom / LLB(Hons) candidate",
     "description": "Working where law meets computing and the governance of artificial intelligence.",
     "alumniOf": { "@type": "CollegeOrUniversity", "name": "Australian National University" },
     "address": { "@type": "PostalAddress", "addressLocality": "Canberra", "addressRegion": "ACT", "addressCountry": "AU" },
     "knowsAbout": ["Law", "Artificial intelligence governance", "Software engineering", "Cybersecurity"],
     "sameAs": ["https://www.linkedin.com/in/ahmed-hussain-0880ba25a/", "https://github.com/XtremeBean99"]
   }
   ```
   Pull the exact descriptor wording from the Hero / existing metadata so it stays consistent.

2. **Tutoring `Service` (in `src/app/tutoring/page.tsx`)** — reflect the real offering. Pricing
   is **online $50/hr, in-person $60/hr** (confirm against the current page copy before
   committing — read the file, don't trust this number blindly):
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Service",
     "serviceType": "Private tutoring",
     "provider": { "@type": "Person", "name": "Ahmed Hussain" },
     "areaServed": { "@type": "City", "name": "Canberra" },
     "description": "Private tutoring for Years 7–12: Physics, Mathematics, English and Legal Studies, online or in person.",
     "offers": [
       { "@type": "Offer", "name": "Online session", "price": "50", "priceCurrency": "AUD", "unitText": "hour" },
       { "@type": "Offer", "name": "In-person session", "price": "60", "priceCurrency": "AUD", "unitText": "hour" }
     ]
   }
   ```
   Also consider an `FAQPage` schema built from the existing FAQ array on that page — optional
   but high-value for SEO. If you add it, derive it from the real `faqs` data already in the
   file (don't hand-duplicate the text).

3. **Project pages** — add a light `WebPage` (or `CollectionPage` for `/projects`) schema with
   `name`, `description`, `url`, `isPartOf` pointing at the site, and `author` → the Person.
   Keep it minimal; the goal is just typed identity for these routes.

## Constraints
- Author-controlled data only into `dangerouslySetInnerHTML` — never user input. (None here is.)
- URLs absolute and correct. Keep facts consistent with on-page copy and `layout.tsx` metadata.
- No visual/layout change.
- Do not duplicate Open Graph data here — that's metadata (task 05 / `layout.tsx`), separate
  from JSON-LD.

## Acceptance criteria
- Valid JSON-LD present on homepage (`Person`), tutoring (`Service`, optionally `FAQPage`), and
  the project pages (`WebPage`/`CollectionPage`).
- JSON validates (paste into Google's Rich Results Test or `schema.org` validator; report result).
- `npm run type-check && npm run lint && npm run build` pass; no console errors.
