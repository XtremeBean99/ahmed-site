# Gurtle

A desk app (`/?app=gurtle`): a daily word ladder in the spirit of the word-a-day games. Start from a four-letter
word and turn it into **GURT** by changing one letter at a time, every step a real word. Gurtle the turtle is the
mascot and reacts to each move.

Added 28 November 2026 on `feat/gurtle`. Puzzle #1 is that day (FISH).

## Files

| File | What it is |
|---|---|
| `src/lib/games/gurtle.ts` | Pure engine: lexicon, distances, moves, hints, daily/practice starts, ratings, share grid, stats |
| `src/lib/games/gurtle-words.ts` | `COMMON_WORDS` (1624 everyday words) and `EXTRA_WORDS` (400 rarer but valid) |
| `src/lib/games/gurtle.test.ts` | 19 `node:test` cases (in `npm run test:games`) |
| `src/components/room/DeskGurtle.tsx` | The app: ladder, keyboard, mascot stage, result and stats panels, tutorial |
| `src/components/room/GurtleMascot.tsx` | The animated mascot (moods, blink, walk, hops) |
| `scripts/draw-gurtle.mjs` | Draws the mascot frames into `public/gurtle/` |
| `public/gurtle/*.png` | 7 frames at 44x30: idle, blink, happy, worried, hide, walk-1, walk-2 |

Wiring: `ICON_GURTLE` in `DeskIcon.tsx`, the shortcut after Mahjong in Room's `deskShortcuts`, the dynamic chunk +
`APP_CHUNKS` + `'gurtle'` screen mode in `DeskView.tsx`, `desk.gurtle*` copy in `en.ts`, discovery id `gurtle`,
`LINKABLE_APPS`, and `GURTLE_KEYS` in `src/lib/games/storage.ts`.

## Rules

- A move changes exactly one letter, in place (no adding, removing or reordering), and must be a word from
  either list. Words already on the ladder cannot repeat.
- Errors, checked in this order: `over` (game finished), `length`, `notOneLetter`, `notWord`, `repeat`.
- **Par** is the shortest route that uses only everyday words. Rarer words (`EXTRA_WORDS`) are allowed as moves,
  so a sharp player can finish under par.
- **Hint** fills in the next word of a best route (it counts, and shows on the share card). From an everyday
  word the hint stays on everyday words; otherwise it takes any word, preferring everyday ones. Ties go to the
  word with more letters already in place, then alphabetical.
- **Give up** (two taps) reveals a shortest route from the current word and ends a daily streak.
- **Undo** steps back one word while playing.

## Engine

- `buildLexicon` makes a BFS out from `gurt` over wildcard buckets (`g_rt`, `_urt`...), twice: `parDist`
  across everyday words only, `anyDist` across all of them. `neighbors(word)` reads the same bucket map.
  `lexicon()` builds it all once, on first use (a few milliseconds).
- 1519 of the everyday words can reach GURT at all. The target is in neither word list; the lexicon adds it.
- **Start pools** (`startPool`): everyday, non-plural words (a word ending in `s` counts as plural unless it
  ends in `ss`, `us` or `is`) whose par falls in a range. Daily: par 4 to 6 (873 words). Practice: Short 2-3
  (67), Medium 4-5 (552), Long 6-8 (576).
- **Daily** (`dailyStart`): one UTC date for the whole world. The daily pool is shuffled once with a fixed seed
  (`mulberry32(0x67757274)`, "gurt") and puzzle `n` takes word `n - 1`, so no start comes back for 873 days.
  `puzzleNumber` is days since `LAUNCH_DATE` (2026-11-28) plus one. Changing either word list or `DAILY_PAR`
  reshuffles every future daily, so do that only with care.
- `moveTrend` compares `anyDist` before and after a move: closer, same or further. The mascot and bubble react.
- `rateRun`: under par, par, bogey (+1), double (+2), slow (+3 or more).
- `shareGrid`: one row per word, 🟩 where a letter matches GURT's letter in that position, ⬜ otherwise; a
  give-up adds the revealed rows.
- `parseGame` validates a saved game by replaying every move, so a tampered save is dropped, not trusted.

## Saves and stats

`localStorage` under the games namespace (`ahmed-site:games:v1:`), keys in `GURTLE_KEYS`:
`gurtle-daily` (today's game; a save from another date is ignored), `gurtle-practice`, `gurtle-stats`,
`gurtle-tutorial-seen`.

Stats count dailies only: played, won, streak, max streak and a distribution over Par, +1, +2, +3, +4 or
more (an under-par win counts under Par). `recordDaily` ignores a second record for the same date. A win extends the
streak only if the last daily was yesterday. `liveStreak` shows 0 once a whole day has gone unplayed.
Nothing goes to the server yet.

## UI

- **Landscape (536x308):** ladder column on the left (rows of four tiles, the input row, a dimmed GOAL row).
  The right side has the mascot at 3x with its speech bubble, the action row and the on-screen keyboard.
- **Portrait phone:** the ladder column is narrower with a stacked header. The bubble sits above the mascot (2x),
  the keyboard is full width with 40 px keys (34 px when the screen is under 560 px tall), and wide keys use a
  smaller font so ENTER fits.
- **Tiles:** moss green where the letter is in GURT's position. An amber underline marks the letter changed on
  that step. The changed tile flips as a word lands, the final row hops on a win, and a give-up's revealed
  route flips in row by row.
- **Keys:** physical keyboard (letters, Backspace, Enter) and on-screen keys. Escape closes an open panel first
  (a capture-phase listener that stops the event), then follows the desk's Escape ladder.
- **Panels:** the result panel shows the rating, your route, hints, a mini grid, Share and the next-daily
  countdown. The stats panel shows the numbers, the distribution with today's bar highlighted, and Share.
  Share uses `navigator.share` on touch devices, otherwise the clipboard (with an `execCommand` fallback).
- **Tutorial:** four pages (goal with a CART, CURT, GURT example, moves, tiles, help); opens on the first visit,
  `?` reopens it.
- Sounds through `useSfx().tone`: chip for a move closer (and a share), blip for a sideways move, bloop for a
  move further away or an undo, powerup for a hint, invalid for a refused word, win and lose at the end.

## Mascot

`scripts/draw-gurtle.mjs` builds the turtle in code (as the cat and bonsai scripts do). It has a domed shell
with three scutes split by Voronoi seams, a two-row rim, a round head, four legs posed per frame, a tail and a
cream belly. All of it gets a dark ink outline. Art is 44x30 and scaled in CSS (`image-rendering: pixelated`).

```
node scripts/draw-gurtle.mjs            # writes public/gurtle/*.png
node scripts/draw-gurtle.mjs --preview  # also an 8x contact sheet in the OS temp folder
```

`GurtleMascot` takes `mood` (`idle | happy | worried | hide | walk`), `scale` and `beat` (bump it to replay the
reaction for the same mood). Idle blinks at random, walk swaps frames every 200 ms, happy hops, worried wobbles.
Reduced motion keeps the frames but drops the movement. The mascot is `aria-hidden`, and the bubble beside it is the
`aria-live` text.

The sprite is outside the room lighting grades: it only appears on the monitor, which is emissive.

## Ideas not built

- A public daily board (moves and hints per day), using `hiscores:daily:*` as daily Minesweeper does.
- A Gurtle room object (the turtle walking along the shelf or desk), which would need lit sprite sets.
- Hard mode (hints off), or a "par only" mode that accepts only everyday words.
- Word list tuning from play: watch for reasonable words players get refused.
