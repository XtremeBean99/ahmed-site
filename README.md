# ahmedyhussain.com

Personal website of **Ahmed Hussain**, BComp/LLB(Hons) candidate at the Australian National University, working at
the intersection of law, computing and AI governance.

**[ahmedyhussain.com](https://ahmedyhussain.com)**

---

The site is one interactive pixel-art bedroom. Clickable objects in the room lead to a desk close-up whose monitor
runs a small pixel OS. [Pixel Catan](https://ahmedyhussain.com/catan) is the one other page.

## In the room

- A monitor, posters, lamp, speakers, bookshelf, calendar, window (a pixel city showing Canberra's weather), cat,
  bonsai, side table and a turtle on the rug.
- An e-reader with three public-domain books, a film on the VHS tape and a 21-track music player.
- Desk apps: README, Guestbook, Request, Music, Movie, Paint, Settings, Legal, Scores, Typing, Minesweeper (with a
  daily board), Snake, Blackjack, Solitaire, Pong, Breakout, Chess, Mahjong and Gurtle (a daily word ladder).
- A hidden Linux-style terminal.
- Day, dusk and night lighting that follows the visitor's clock, phone layouts, and discoveries to collect.

Reduced motion turns off decorative animation, never function.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3, Framer Motion 11 |
| Storage | `localStorage` first; Upstash Redis for the guestbook, score boards, feature requests and rate limits |
| Email | Resend (feature requests) |
| Validation | Zod 4 |
| Hosting | Vercel, with Web Analytics and Speed Insights |

## Getting started

```bash
npm install
cp .env.example .env.local   # optional: everything server-side fails soft without it
npm run dev
```

## Environment variables

All optional for local work.

| Variable | Used for |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Guestbook, score boards, feature requests, rate limits. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are accepted too. |
| `GUESTBOOK_ADMIN_KEY` | Admin deletes and listing |
| `RESEND_API_KEY`, `FEATURE_REQUEST_TO_EMAIL` | Emailing feature requests |
| `FEATURE_REQUEST_FROM_EMAIL` | Sender address (optional) |

## Layout

```
src/
  app/          pages (/ and /catan), API routes, robots and sitemap
  components/   room/ (stage, desk, apps), catan/, providers/, seo/
  lib/          room/, games/ (pure engines and tests), terminal/, i18n/, and server helpers
  services/     all Redis access
scripts/        sprite drawing and extraction, lighting grades, icons, covers, audio encoding
assets/         source art and audio masters (not deployed)
public/         what the site serves
```

## Checks

```bash
npm run type-check
npm run lint
npm run build
npm run test:room && npm run test:games && npm run test:terminal && npm run test:catan
```

## Deployment

Pushing to `master` builds a preview on Vercel, not production. To release, open that deployment in the Vercel
dashboard and choose Promote to Production. `vercel.json` is needed: the Vercel project has no framework
preset of its own.

## Documentation

| File | What is in it |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Rules and architecture map |
| [docs/room.md](docs/room.md) | The room and desk apps in depth, sprite pipeline, audio |
| [docs/catan.md](docs/catan.md) | Pixel Catan |
| [docs/gurtle.md](docs/gurtle.md) | Gurtle |
| [docs/history.md](docs/history.md) | What each version added |
| [SECURITY-REVIEW.md](SECURITY-REVIEW.md) | Security status |

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free to use, modify, and share for **noncommercial** purposes. **Commercial use** and **use as AI/ML training data** require prior written permission -- contact Ahmed Hussain (Ahmedyhussain07@gmail.com).
