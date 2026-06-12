# Testing checklist — ahmedyhussain.com

## Prerequisites

1. A running PostgreSQL database (local or Neon)
2. `.env` configured with all required variables
3. Node.js 20+ and `npm install` completed

## Automated checks

### Build check

```bash
npm run build
```

Must complete with zero errors.

### Prisma checks

```bash
npx prisma generate    # Must succeed
npx prisma migrate dev --name init  # Must create schema
npx prisma db seed     # Must insert 3 projects and 1 blog post
```

### TypeScript check

`npm run build` includes TypeScript checking. Must pass with strict mode.

## Manual checks

### Public pages (run `npm run dev` first)

| Page              | URL                    | Checks                                                                 |
| ----------------- | ---------------------- | ---------------------------------------------------------------------- |
| Home              | http://localhost:3000/ | Hero animation, stats counters, latest projects, latest posts, CTA     |
| About             | /about                 | Verbatim copy from WEBSITE_COPY.md, prose styling                      |
| Experience        | /experience            | Timeline animation, all 5 entries, education and work sections         |
| Projects          | /projects              | Grid of 3 project cards, 3D tilt on hover, tags display                |
| Blog              | /blog                  | List with launch post, reading time, date                              |
| Blog post         | /blog/why-i-study-law-and-computing | Rendered Markdown, reading progress bar, metadata     |
| Project detail    | /projects/*            | Rendered Markdown, tags, year, back navigation                         |
| Contact           | /contact               | Form with floating labels, LinkedIn link, no email address in source   |

### Contact form

1. Submit empty form → validation errors shown
2. Fill honeypot field → 200 OK, nothing stored (check DB)
3. Valid submission → 200 OK, message stored in DB, email sent (check Resend logs)
4. Rapid repeated submissions → 429 rate limit

### Admin auth

1. Visit `/admin` → redirected to `/admin/login`
2. Wrong password → "Incorrect password" error
3. Correct password → redirected to `/admin`
4. Visit `/admin` again → loads dashboard (session active)
5. Sign out → redirected to login

### Admin CRUD

1. **Posts** — Create, edit, publish/unpublish, delete a post. Verify on public blog.
2. **Projects** — Create, edit, publish/unpublish, delete a project. Verify on public projects page.
3. **Messages** — Mark as read/unread, delete. Verify DB updates.

### Animation checks

| Effect                       | How to test                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| Hero canvas particles        | Move cursor over hero — particles repel, lines brighten            |
| Hero scramble text           | Watch third line cycle — characters scramble then resolve          |
| Stagger hero text            | Reload page — headline words animate in with mask rise             |
| Lenis smooth scrolling       | Scroll page — smooth momentum-based scrolling                      |
| Scroll progress bar          | Thin teal line at top tracks scroll position                       |
| Section scroll reveals       | Scroll down — each section fades/rises into view                   |
| Stat counters                | Scroll to stats strip — numbers animate from 0                     |
| 3D project cards             | Hover over project card — tilts toward cursor with glare highlight |
| Magnetic buttons             | Move cursor near button — button translates toward cursor          |
| Page transitions             | Navigate between pages — crossfade + slide 16px                    |
| Sticky nav hide/show         | Scroll down → nav hides. Scroll up → nav reveals                   |
| Blog reading progress        | Open blog post, scroll — progress bar fills                        |
| Timeline pathLength          | Scroll experience page — line draws itself                         |
| Contact form submit button   | Submit form — button morphs to spinner → tick                      |
| Footer marquee               | Footer has scrolling tags                                          |
| `prefers-reduced-motion`     | Enable in OS settings — all animations collapse to simple fades    |

### Responsive design

| Width  | Device     | Check                                                              |
| ------ | ---------- | ------------------------------------------------------------------ |
| 375px  | Mobile     | Nav collapses to hamburger, single-column layouts, readable text   |
| 768px  | Tablet     | Two-column grids, nav still visible, timeline layout               |
| 1440px | Desktop    | Full multi-column grids, timeline alternates left/right            |

### Accessibility

- All form fields have visible labels
- Focus states are visible on all interactive elements
- Navigation uses semantic `<nav>` with aria-label
- Mobile menu has `aria-expanded` on toggle
- Honeypot field has `aria-hidden="true"` and `tabIndex={-1}`
- Canvas background has `aria-hidden="true"`

### SEO

- Every page has a `<title>` (check browser tab)
- Open Graph tags set (check page source for `og:` meta tags)
- `/sitemap.xml` returns valid XML
- `/robots.txt` returns disallow for `/admin/` and `/api/`
- View page source: no email address present

## Post-build production check

```bash
npm run build && npm run start
```

Repeat the manual checks above against the production build.
