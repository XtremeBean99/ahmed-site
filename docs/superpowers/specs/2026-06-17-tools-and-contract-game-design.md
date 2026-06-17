# Design — AGLC4 generator, base converter, contract game

Date: 2026-06-17
Status: Approved

## Goal

Add three interactive features to ahmedyhussain.com that reinforce the
law-and-computing theme:

1. An **AGLC4 citation generator** (Australian Guide to Legal Citation, 4th ed).
2. A **binary/hex base converter** with text and bitwise extras.
3. A **contract clause game** scored on how balanced the negotiated deal is.

## Constraints (inherited from the project)

- Strictly monochrome (zinc-950 / white / zinc-800). No colour, no gradients.
- Server Components by default; thin `'use client'` shells only where needed.
- No database. Tool output is computed client-side; game best score uses
  `localStorage` via the existing `src/lib/games/storage.ts` helpers.
- All hard logic lives in pure, isolated `src/lib/*` modules so it can be
  reasoned about and verified independently of the UI.
- Every motion addition respects `useReducedMotion()`.
- No test framework is installed; verification is `type-check` + `lint` +
  `build`, matching the rest of the repo.

## Placement

- Both tools are cards on the existing **`/projects`** hub (no new nav item).
- The game is a card on the existing **`/games`** hub.

---

## 1. AGLC4 Citation Generator — `/projects/aglc4`

Produces both the **footnote** form and the **bibliography** form for a chosen
source type, with a copy button for each. Italics are represented in the model
as lightweight markers and rendered as `<em>` (and copied as plain text).

### Files

- `src/app/projects/aglc4/page.tsx` — server: `metadata`, `SoftwareApplication`
  JsonLd, page chrome, renders the client generator.
- `src/components/projects/Aglc4Generator.tsx` — `'use client'`: source-type
  selector, dynamic fields, live footnote + bibliography output, copy buttons.
- `src/lib/aglc4/types.ts` — `SourceType`, field + citation types.
- `src/lib/aglc4/fields.ts` — declarative field config per source type
  (label, key, placeholder, required, hint).
- `src/lib/aglc4/format.ts` — pure formatters: `formatFootnote(type, values)`
  and `formatBibliography(type, values)` returning a `Segment[]`
  (`{ text, italic }`) so the UI can render italics and copy plain text.

### Source types (9)

reported case · medium-neutral (unreported) case · legislation (statute) ·
delegated legislation · journal article · book · book chapter ·
web/online material · explanatory memorandum / hansard.

### Notable AGLC4 rules captured

- Case names italicised; reported pinpoint after the starting page.
- Reported: `Party v Party (Year) Volume Reporter Page, pinpoint.`
- Medium-neutral: `Party v Party [Year] Court Number, [pinpoint].`
- Legislation: `Title Year (Jurisdiction) pinpoint` — title+year italicised.
- Journal article: author, 'title' (year) volume *Journal* startpage, pinpoint.
- Bibliography reverses the first author's name and drops pinpoints.

---

## 2. Base Converter — `/projects/base-converter`

### Files

- `src/app/projects/base-converter/page.tsx` — server: metadata, JsonLd, chrome.
- `src/components/projects/BaseConverter.tsx` — `'use client'`: live two-way
  fields for decimal, binary, hex, octal, and ASCII/text; plus a bitwise
  playground.
- `src/lib/convert/bases.ts` — pure: parse a value from any base, format to all
  bases, text↔bytes. Robust to invalid input (returns an error rather than
  throwing). Uses `BigInt` for arbitrary-size integers.
- `src/lib/convert/bitwise.ts` — pure: AND, OR, XOR, NOT, left/right shift over
  two `BigInt` operands; returns the binary/dec/hex result.

### Behaviour

- Editing any field re-derives the others live; invalid input is flagged on the
  edited field without clobbering the rest.
- Text mode maps each character to its byte; non-ASCII is handled via UTF-8.
- Bitwise NOT is masked to the operand width to stay meaningful for display.

---

## 3. Contract Clause Game — `/games/contract`

Balance-meter rounds. Each round is a scenario (e.g. a freelance services
agreement). For each clause **category** you choose one of several options;
each option carries a `balance` weight (negative = favours the counterparty,
positive = favours you). The round's net balance must land inside a
"balanced / enforceable" zone to win; too greedy or too one-sided loses.

### Files

- `src/app/games/contract/page.tsx` — server, reuses `GameShell`.
- `src/components/games/ContractGame.tsx` — `'use client'`: scenario intro,
  category-by-category clause cards, live balance meter, round result with a
  short "why this clause matters" note, running score + best score.
- `src/lib/games/contract-engine.ts` — pure: `GameState`, reducer-style helpers
  to select clauses, compute net balance, evaluate win/lose, advance rounds,
  score. No React, no DOM.
- `src/lib/games/contract-data.ts` — scenarios + categories + clause options
  (each with `balance` weight and an `explainer`).

### Scoring

- Net balance `b` per round; `|b|` small = balanced. Win zone `|b| <= TOL`.
- Round score rewards being close to perfectly balanced (centred at 0).
- Game runs a fixed sequence of scenarios; total score persisted as best via
  a new `BEST_KEYS.contract` entry in `src/lib/games/storage.ts`.

### Reduced motion

Meter animates with a spring normally; static when reduced motion is set.
The game remains fully playable either way.

---

## Wiring

- `src/app/projects/page.tsx` — add AGLC4 + base-converter cards.
- `src/app/games/page.tsx` — add contract game card.
- `src/app/sitemap.ts` — add the three new routes.
- `src/lib/games/storage.ts` — add `contract` best key.

## Verification

`npm run type-check && npm run lint && npm run build` must all pass before
commit. Then commit and push to `master`.

## Out of scope (YAGNI)

- Rare AGLC4 source types (treaties, theses, news, international materials).
- Saving/exporting citation lists.
- Multiplayer / AI-opponent contract negotiation.
- Persisting converter history.
