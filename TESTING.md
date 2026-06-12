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
| Hussain           | /hussain               | 7 sections, Arabic calligraphy, green/gold theme, no em dashes         |
| Breakout          | /breakout              | Canvas game loads, paddle moves with mouse/keyboard/touch, build panel |

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

## Hussain page (/hussain)

| Check                                  | How to test                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Page loads                             | Visit /hussain, page renders with green/ivory theme                      |
| No teal grid visible                   | Scroll full page, TechBackground is covered by ivory background          |
| Arabic calligraphy renders             | "حسين" displayed large in Aref Ruqaa font, white on green                |
| Gold rule ornaments                    | Thin gold lines between sections and under the title                     |
| Girih pattern                          | Subtle geometric dot pattern visible on ivory sections                   |
| All 7 sections present                 | Name, Who, Karbala, Shia Islam, Ethic, Palestine, Closing                |
| No em dashes                           | Search page source for U+2014, must be zero                              |
| Arabic text RTL                        | Arabic spans have lang="ar" dir="rtl" attributes                         |
| Quote attributions                     | "Death with dignity" attributed to Imam Hussain, maxim attributed to tradition |
| Palestine section tone                 | Principled, humane, no violent rhetoric, no sectarianism                 |
| Nav link                               | "Hussain" appears in nav after Blog, before Cooking                      |
| Responsive                             | Text readable at 375px, 768px, 1440px                                    |
| prefers-reduced-motion                 | Page still renders correctly, no broken animations                       |

## Breakout page (/breakout)

| Check                                  | How to test                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Page loads                             | Visit /breakout, canvas renders with dark background                     |
| Game starts                            | Click/Space launches ball from paddle, "waiting" prompt disappears       |
| Mouse control                          | Move mouse, paddle follows horizontally                                  |
| Keyboard control                       | Arrow keys move paddle left and right                                    |
| Touch control                          | On mobile/tablet, touch drag moves paddle                                |
| Ball physics                           | Ball bounces off walls at correct angles, paddle hit position changes angle |
| Brick collision                        | Ball destroys bricks on hit, PCB-style pins visible                      |
| Row labels                             | VRM, RAM, PCIe, SATA, I/O labels visible left of grid                    |
| HP system                              | Top row bricks take 3 hits, second row 2, bottom rows 1                  |
| Boss brick                             | "i7 2600K" at top centre, 6 HP, orange colour, flashes on hit            |
| Win condition                          | Destroy boss brick, "POST OK" overlay appears                            |
| Lives system                           | 3 lives shown as hearts, ball death loses a life, 0 lives = game over    |
| Score display                          | Score increments on brick hits, shown in side panel                      |
| High score                             | High score persists across page reloads (localStorage)                   |
| Build progress sidebar                 | Parts list ticks off as rows are cleared                                 |
| Thermal Paste drop                     | White blob falls, catching it sticks ball to paddle                      |
| RGB Kit drop                           | Cycling-colour square, catching it splits ball into 3                    |
| Overclock drop                         | Amber lightning, catching it speeds ball +40%, x2 score for 10s          |
| Water Leak drop (bad)                  | Blue droplet, catching it halves paddle width for 4s, blue paddle colour |
| OneDrive sync event                    | Countdown appears ~43s in, at 45s controls invert with amber toast       |
| Pause                                   | Press P, game pauses with overlay. Press P again to resume              |
| Tab hidden pause                       | Switch browser tab away, game auto-pauses                                |
| Sound toggle                           | SOUND OFF by default, button toggles to SOUND ON, beeps play when on     |
| Restart after game over                | Click/Space after game over restarts game                                |
| Restart after win                      | Click/Space after win restarts game                                      |
| ESC key                                | Pressing Escape releases keyboard focus from canvas                      |
| Responsive layout                      | Side panel moves below canvas on mobile, side by side on desktop         |
| Nav link                               | "Breakout" appears in nav after Cooking, before Contact                  |
| Reduced motion                         | Game still plays, no screen shake or particle effects                    |
