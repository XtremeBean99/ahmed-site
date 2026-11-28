# The cookbook: design (draft, 26 November 2026)

Status: **design only, nothing built.** This replaces roadmap item 21 in `docs/history.md` ("Blog in the room:
notebook object opens an MDX-backed `/blog`") with a recipe book that is also the blog: each recipe carries the
story behind it.

## Goals

1. A recipe book you can **cook from**: scale servings, switch units, tick ingredients, run timers, keep the screen
   awake.
2. A blog people can **find**: real, crawlable pages with Recipe structured data, so search shows stars, time and
   a photo.
3. It belongs to **the room**: opened from a pixel cookbook on the shelf, drawn in the room palette, tied into the
   room's objects (clock, calendar, window, cat, terminal).

Non-goals for v1: accounts, comments, user-submitted recipes, nutrition data, a CMS.

## The core decision: two layers, one set of components

The room is a single page and the conventional pages 308 to `/`, but a recipe blog needs URLs a crawler can read
and a screen big enough to cook from (the monitor is 536x308). So:

| Layer | Where | What |
|---|---|---|
| Room overlay | `/` | The cookbook on the desk shelf opens a full-viewport book overlay, like `RoomReader`. |
| Real pages | `/recipes`, `/recipes/[slug]` | Server-rendered pages dressed as the same book (paper, brown chrome, pixel headings), with JSON-LD and a "Back to the room" link. |

Both render the same `src/components/recipes/*` components. While the overlay is open the address bar follows it
with `replaceState` to `/recipes/<slug>` (as `?app=` does for desk apps), so any shared link is a real page.
Opening a `/recipes/...` link lands on the page itself, not the room: fast, readable, indexable. The page's
"Back to the room" goes to `/?cookbook=<slug>`, which opens the room with the overlay on that recipe.

Not a desk app: the monitor is too small to cook from, and the cookbook is a physical object on the shelf, like
the books.

## Content format

Recipes are static assets (constraint 5 in CLAUDE.md): one file per recipe in `content/recipes/<slug>.mdx`,
compiled at build time. No service, no database.

```mdx
---
title: Mum's chicken biryani
slug: chicken-biryani
summary: Layered rice, slow-cooked chicken, fried onions. The Eid table centrepiece.
series: mums-recipes            # one of SERIES in src/lib/recipes/series.ts
tags: [rice, chicken, eid, one-pot]
diet: [halal]                   # halal | vegetarian | vegan | gluten-free | dairy-free
servings: 6
time: { prep: 30, cook: 75, rest: 10 }   # minutes
difficulty: 3                   # 1..5
cover: /recipes/chicken-biryani/cover.jpg
published: 2026-12-01
occasions: [eid-al-adha]        # optional, for the calendar tie-in
weather: [rain, snow]           # optional, for the window tie-in
ingredients:
  - group: Chicken marinade
    items:
      - { qty: 1, unit: kg, item: chicken thighs, note: bone-in }
      - { qty: 250, unit: g, item: plain yoghurt }
      - { qty: 1.5, unit: tsp, item: salt }
      - { item: salt and pepper, toTaste: true }
  - group: Rice
    items:
      - { qty: 3, unit: cup, item: basmati rice, note: soaked 30 min }
---

My mum made this every Eid... (the story, plain MDX)

## Method

1. Mix the marinade and coat the chicken. Rest {timer:30m "Marinate"}.
2. Parboil the rice until 70% done, about {timer:6m}.
3. Layer, seal, and cook on low {timer:45m "Dum"}.
```

Rules:
- Amounts are numbers, never strings, so they scale. `unit` comes from a fixed set (`g kg ml l tsp tbsp cup oz
  lb piece pinch clove`); unknown units fail the build.
- `{timer:Nm "label"}` / `{timer:1h30m}` in a step becomes a tap-to-start timer. Parsed by the engine, not regex in
  components.
- Step text may name an ingredient in `[[double brackets]]`; the page shows its scaled amount on hover/tap.
- The frontmatter is validated with Zod at build time (`src/lib/recipes/schema.ts`), so a typo breaks the build,
  not the page.
- Images live in `public/recipes/<slug>/`, served as plain `<img>` (photos can use `next/image`; pixel art never does).

Tooling: add `@next/mdx` (or `next-mdx-remote/rsc` if we want frontmatter without a loader; decide when building)
plus a tiny remark plugin for `{timer:...}` and `[[...]]`. Nothing runs client-side to parse content.

## The engine: `src/lib/recipes/` (pure, tested)

Like the game engines: no React, `node:test` suites, `npm run test:recipes`.

| Module | Does |
|---|---|
| `schema.ts` | Zod schema for frontmatter; the `Recipe` type. |
| `scale.ts` | Scale every amount by servings; round to sensible kitchen values (1/4, 1/3, 1/2 tsp; whole eggs and cloves). |
| `units.ts` | Metric/imperial conversion with per-ingredient density for cups to grams where we know it (flour, sugar, rice), else keep cups. |
| `format.ts` | `1.5 -> 1 1/2`, `0.333 -> 1/3`, plural units. |
| `timers.ts` | Parse `{timer:...}`; a timer state machine (idle, running, paused, done) driven by timestamps, not intervals, so it survives tab sleep. |
| `shopping.ts` | Merge lists across recipes: same item and compatible units add up; export as plain text. |
| `search.ts` | Filter by series, tag, diet, max time; "what's in my fridge" ranking by ingredient overlap. |
| `jsonld.ts` | Build the schema.org `Recipe` object (ISO 8601 durations, `recipeIngredient` strings, `recipeInstructions` HowToSteps). |

## Pages and routes

```
src/app/recipes/page.tsx            index: contents page, filters, series, random
src/app/recipes/[slug]/page.tsx     one recipe; generateStaticParams over content/
src/app/recipes/[slug]/opengraph-image.tsx   optional later: pixel-framed cover card
src/components/recipes/             Cookbook, RecipeSpread, IngredientList, Method, CookMode, Timer, ShoppingList
```

- Every page renders per request because the root layout calls `connection()` (the CSP nonce). That is fine for a
  handful of MDX files; if it ever matters, cache the compiled content in a module-level map.
- `sitemap.ts` gains `/recipes` and one entry per recipe (`lastModified` from `published`/`updated`).
- JSON-LD through the existing `JsonLd.tsx` (already escaped against `</script>`).
- `robots.ts` keeps blocking AI crawlers; normal search engines are unaffected.
- The middleware matcher already covers `/recipes/*` (no file extension), so pages get the nonce.

## UI

Palette and type follow the room (constraint 6) and the e-reader: chrome `#3d2e1e` / `#5a4430` / `#e8d5b0`, paper
`#faf8f5` / `#fffef5`, pixel font for headings, buttons and labels, Georgia for story and method text (long text
in the pixel font is tiring).

**Contents page (index).** A book's contents: series as chapters (e.g. Mum's recipes, The Eid table, Student
budget, Recreations), each recipe a dotted-leader line with its time. Filters as pixel tabs: time (under 30, under
60), diet, tag. A "Surprise me" button (random recipe). A search box with a fridge mode (type what you have).

**Recipe spread.** Desktop: two pages. Left: cover photo, title, story. Right: the card (servings stepper, units
toggle, times, difficulty pips), ingredients with checkboxes, the method. "Jump to recipe" at the top on phones,
where the spread stacks into one column with the card first.

**Cook mode.** A button on the card. Full viewport, one step per screen, large serif text (24 px+), the step's
ingredients with scaled amounts under it, its timers as big buttons. Swipe, arrow keys or tap halves to move.
Screen Wake Lock while open (allowed: our `Permissions-Policy` only blocks camera, microphone and geolocation; fail
silently where unsupported). Escape or the close button leaves. Running timers keep going outside cook mode and
show in a small dock.

**Phones.** Same contract as the desk apps where it applies: pointer events only, 38 px tap targets, text at least
12 px, inputs 16 px on coarse pointers, hover only for `pointerType === 'mouse'`.

**Accessibility.** Ingredient checkboxes are real checkboxes; timers announce "done" through an `aria-live`
region as well as sound; reduced motion (via `@/lib/use-reduced-motion`) turns off page turns and steam, never
timers or wake lock.

## Persistence (browser only)

One key, `room-recipes-v1`, added to the list in CLAUDE.md constraint 2:

```ts
{
  favourites: string[]                       // slugs
  notes: Record<string, string>              // slug -> personal note, max 1000 chars
  checked: Record<string, string[]>          // slug -> ticked ingredient ids (cleared after 12 h)
  servings: Record<string, number>           // last servings per recipe
  units: 'metric' | 'imperial'
  shopping: { slug: string; servings: number }[]
  timers: { id: string; label: string; endsAt: number; pausedLeft?: number }[]
}
```

Validated on read (bad data resets to defaults, like the game saves). No server state in v1.

## Room tie-ins

| Tie-in | How |
|---|---|
| Cookbook on the desk shelf | New `DESK_SHELF_SPRITES` entry, `kind: 'cookbook'`, drawn by `scripts/draw-desk-shelf-items.mjs` with rest + two highlight frames. Click opens the overlay on the contents page and looks down. Needs a free gap on the shelf (right of `breakout`, or swap with a book). |
| Room view | Optional: the same book visible on the room's shelf sprite, so the tour can point at it. Needs a lighting regrade (`npm run lighting`). |
| Kitchen timer on the side table | While any timer runs, a small pixel timer sits on the side table counting down; it rings with a synthesized tone when done. Emissive, never graded (like the LED clock). |
| Shopping list in the terminal | "Send to desktop" writes `~/Desktop/shopping-list.txt` into the terminal VFS (`room-terminal-fs-v1`, see `src/lib/terminal/seed.ts`), so it appears as an icon on the pixel desktop and `download` saves it. Needs a small exported helper for writing a file outside the shell. |
| Calendar | Occasion dots link to a recipe with a matching `occasions` id. Eid and Ramadan move each year (lunar), but `OCCASIONS` are fixed-date, so this needs a small table of dates for the coming years, or start with fixed-date occasions only. |
| Window weather | On rain or snow (`/api/weather`), a click on the window can add "Rainy day? Try ..." from recipes tagged with that `weather`. |
| The cat | Wakes and watches while a recipe tagged `fish` or `chicken` is open. |
| Discoveries | `cookbook` (first open), `cooked` (finish a cook mode). `DISCOVERY_IDS` goes to 36. |
| Tour | One step pointing at the shelf. |
| Music | Optional: a "Cooking" playlist the cook mode can start. |
| Changelog | Entry in `src/lib/room/changelog.ts`. |

## Copy

All chrome strings in `en.ts` under a new `recipes` section (contents headings, buttons, timer labels, empty
states). No em dashes in visitor-facing copy. Recipe text itself lives in the MDX files, not the dictionary.

## Later (needs a server route)

"I made this" counts and star ratings would be the first new input route since feature requests: it copies the
pattern exactly (CSRF, rate limit, honeypot, Zod, stripping and profanity checks), stores in Redis behind
`src/services/recipes.ts` (`recipes:made:<slug>` counters; ratings as counts per star, no names or IPs), and
fails soft without Upstash. Aggregate ratings then feed `aggregateRating` in the JSON-LD.

## Phases

1. **Core.** Content format and schema, the engine with tests, `/recipes` and `/recipes/[slug]` with the scaler,
   units, checkboxes, JSON-LD and sitemap. Three sample recipes for the owner to rewrite.
2. **Room.** Cookbook shelf sprite, the overlay, address-bar sync, `?cookbook=`, `cookbook` discovery.
3. **Cooking.** Cook mode with timers and wake lock, favourites, notes, shopping list (including the terminal file).
4. **Tie-ins.** Side-table timer, calendar, window, cat, tour step, `cooked` discovery.
5. **Social.** "I made this" and ratings (server route).

## Open questions for the owner

- The series list and what to call each one.
- The first real recipes to write (three for launch).
- Where the cookbook sits on the shelf, and whether it also shows in the room view.
- Photos for every recipe, pixel-art covers, or both (a pixel cover could be generated from the photo).
- Whether cook mode should start music.
