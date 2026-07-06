# SPEC v2: Digital Bedroom Homepage — Close-Up Desk, Pixel Font, Fixes, Cleanup

Executable specification for an agent manager. Supersedes SPEC v1 in full. Written 6 July 2026 after a code review of the implemented v1 (commits `b70857e`, `7745878`, `a109482`).

---

## Part A: Review findings from v1 (fix these first)

The v1 implementation is largely faithful: the `(site)` route-group restructure is correct, `/home` exists, the sitemap and internal links were updated, EN and FR dictionaries both carry the `room.*` keys, sprites are extracted cleanly, and the monitor composite reads naturally on the desk. A bonsai object was added beyond spec and works. The following defects were found and are Task 1.

**A1. Background music is silently broken.** `RoomAudio.tsx` plays `/audio/2pac do for love.mp3`, `/audio/3killsss.mp3`, `/audio/Saffron.mp3`, but `ahmed-site/public/audio/` does not exist; the files sit in `website/bgm/` and were never copied. Every `play()` rejects and is swallowed. Additionally the filenames contain spaces (must be renamed to kebab-case) and at least one track is a commercial recording (2Pac, "Do for Love"). Hosting that publicly on a personal domain is a copyright infringement risk; replace with licensed or royalty-free lo-fi unless the owner holds rights. Structure the code so it plays whatever is in `public/audio/manifest`.

**A2. Escape does not cancel navigation.** `Room.tsx` `handleEnter` returns a cleanup function from `useCallback`, which is discarded, so neither the 800 ms navigation timeout nor the 1.5 s safety timeout is ever cleared. Escape resets the visuals but `router.push('/home')` still fires, and fires twice. Store timeout ids in refs and clear them in the Escape handler and on unmount.

**A3. Zoom targets the wrong point.** The zoom `motion.div` sets `transformOrigin` in stage coordinates (e.g. `436px 336px`) but wraps the viewport-sized container, whose coordinate space differs from the stage whenever scale ≠ 1 or the stage is centred with offsets. On common viewports the zoom aims up-left of the screen. Fix: apply the zoom to the inner stage div (where stage coordinates are valid), compounding with the fit scale, or convert the origin to viewport space: `origin = stageOffset + stagePoint × scale`.

**A4. Keyboard focus is invisible.** `RoomObject` uses `outline-none` with no `focus-visible` replacement (the v1 hover highlight was removed by commit `a109482`, taking the focus ring with it). Add a `focus-visible` ring (2 px light outline, offset 2 px) that does not reappear on mouse hover.

**A5. Hover-only affordances exclude keyboard users.** Poster and bonsai frame animations and tooltips trigger only from `onMouseEnter` on a wrapper div; focusing them shows nothing because their `onActivate` is a no-op. Wire focus/blur to the same activate/deactivate path as mouse enter/leave.

**A6. The monitor is a `<button>` in the normal path.** Link semantics (`<a href="/home">`) exist only under reduced motion. Render an `<a>` always and intercept click to run the transition; native semantics, prefetch, and middle-click all keep working.

**A7. Duplicated logic.** `Poster.tsx` and `Bonsai.tsx` are ~90 % identical. Consolidate into one `AnimatedSprite.tsx` (props: frames, frame duration, loop | play-once-and-hold, label, rect, optional onClick). Poster = play-once-and-hold; bonsai = loop.

**A8. Tooltip font is a placeholder.** Tooltips hardcode Courier New. Superseded by the Minecraft font requirement (Task 2).

Also noted, no action needed: `RoomAudio`'s autoplay-then-retry-on-first-gesture pattern is technically compliant but aggressive; keep the toggle visible and default volume low (0.3 is fine). The per-frame `setInterval` + `setState` in sprites is acceptable at 5 frames but must not be copied for anything longer.

---

## Ground truth additions since v1

* `website/pixel-art/close_up_monitor.png`: 1408×768 close-up desk scene (monitor between two speakers, keyboard, mouse, lamp glow left, poster edge top). The screen is white with a baked-in "LOADING..." caption; usable screen area in image coordinates is approximately **x 436–972, y 152–460** (re-measure precisely at implementation; sampled at 4 px stride).
* `website/pixel-art/screen-keybaord-mouse-mousapd.png`: source of the extracted `public/room/monitor-desk.png` (393×343, placed at stage 240,261). Filename is misspelt; fix during cleanup.
* `website/Minecraft.ttf` (14 KB): pixel font supplied by the owner, to be used for all room text bubbles/HUD/on-screen UI. Confirm its licence permits web embedding (the common "Minecraft" fan fonts are free for personal use); keep a note of origin in `pixel-art/STYLE.md`.
* `website/bgm/`: three MP3s (see A1).
* `public/room/monitor-off.png` and `monitor-on.png` are no longer referenced by `objects.ts` (superseded by `monitor-desk.png`).
* The desk monitor's screen within `monitor-desk.png` sits roughly at sprite-local x 22–218, y 12–128 (stage ≈ 262–458, 273–389); the zoom should aim at its centre.

## Global hard constraints (unchanged from v1, still binding)

1. No existing URL changes or breaks; `api/` untouched. 2. No new npm dependencies. 3. Single app, single repo. 4. Every user-facing string in both EN and FR dictionaries, same commit. 5. `npm run type-check && npm run lint && npm run build` green per task (run on the owner's machine; the review sandbox showed stale-mount artefacts, so do not trust sandbox-side build results). 6. Honour `prefers-reduced-motion`. 7. Sprites from `public/room/` as raw `<img>`, `image-rendering: pixelated`, never `next/image`. 8. Animate only `transform` and `opacity`.

## Global negative prompts

* Do NOT reintroduce CRT/BIOS/boot content. The close-up screen is a modern display showing a minimal pixel desktop.
* Do NOT add localStorage yet except where Task 5 explicitly says so.
* Do NOT touch contact/leaderboard/Redis/Resend/validation code.
* Do NOT edit `close_up_monitor.png` art beyond optional cropping; the "LOADING..." caption is used as-is (Task 3 covers it with an overlay after the loading beat).
* Do NOT create hotspots for objects without finished art; no placeholders.
* Do NOT bring colour or room styling into `(site)` pages.
* Do NOT use `next/font/google` for the pixel font; it is a local file.
* Do NOT commit the copyrighted MP3s to the public repo (they would also be publicly served from Vercel). See Task 6.
* Do NOT let any transition exceed 1.6 s or run without an Escape/skip path.
* Do NOT resolve lint/type errors with `any`, `@ts-ignore`, or `eslint-disable`.

---

## Task 1: Defect fixes (A1–A7)

Implement every fix in Part A. Acceptance: Escape during the zoom cancels cleanly (no navigation fires afterwards; verify by waiting 2 s); zoom visibly converges on the desk monitor's screen centre at 1440×900, 1920×1080, and a 390 px mobile viewport; tab focus shows a visible ring on monitor, poster, bonsai; focusing poster/bonsai shows their tooltip and animation; monitor middle-click opens `/home` in a new tab; `AnimatedSprite` replaces both old components with no visual change; music plays from `public/audio/` files after a user gesture, toggle works, and no 404s appear in the network panel.

Negative prompts: do not redesign the transition while fixing it (same glow + zoom + white fade choreography); do not change hotspot geometry; do not "fix" A5 by making tooltips permanent.

## Task 2: Minecraft pixel font everywhere in the room

1. Move `website/Minecraft.ttf` to `ahmed-site/src/fonts/Minecraft.ttf` (repo-internal; not `public/`, so it ships via `next/font` with proper hashing/preload).
2. Load with `next/font/local` in the root layout: `variable: '--font-pixel'`, `display: 'swap'`, `preload: false` (preload true only on `/`; simplest correct option: load it in `src/app/page.tsx`'s tree via a small wrapper, or accept the global variable with preload false).
3. Apply `var(--font-pixel)` to: tooltip speech bubbles, HUD enter link and hint, skip link when visible, audio toggle glyph replacement (use the word "MUSIC ON/OFF" or a note glyph in the pixel font), and all Task 3 on-screen desktop UI. Font size floor 12 px; the font has no lowercase differentiation issues but test the French accented characters (é, è, à, ï) render; if glyphs are missing, fall back stack `var(--font-pixel), "Courier New", monospace` and note it.
4. Tooltip restyle: keep the current speech-bubble geometry, swap the family, drop `letterSpacing` (pixel fonts self-space), keep `textShadow` only if it stays legible at 12 px.

Acceptance: no room text renders in Inter/Courier; FR locale shows correct accents or the documented fallback; `(site)` pages are completely unaffected (inspect `/home` and `/tutoring` computed styles).

Negative prompts: do not apply the pixel font to any `(site)` page, metadata, or the not-found page; do not self-host via `@font-face` in globals.css (use `next/font/local`); do not preload the font on every route.

## Task 3: Close-up desk view with on-screen shortcuts (the headline feature)

**Flow.** Room → click monitor → existing glow + zoom (fixed by Task 1) → crossfade into the close-up scene (`close_up_monitor.png` as a new full-viewport stage) → ~500 ms beat where the baked "LOADING..." caption shows → an opaque pixel desktop fades in over the screen area carrying shortcut icons → user clicks an icon → white bloom → `router.push(target)`.

**Steps.**
1. Copy `close_up_monitor.png` to `public/room/desk-closeup.png`.
2. New component `DeskView.tsx`: its own 1408×768 stage reusing the same fit-scale hook as `Room` (extract the hook to `src/lib/room/useStageScale.ts` rather than duplicating).
3. View state machine in `Room.tsx`: `'room' | 'zooming' | 'desk' | 'leaving'`. The monitor click now transitions `room → zooming → desk` (no route change). Replace the v1 direct push to `/home` with this. The HUD "Enter website →" link and skip link still go straight to `/home` unchanged.
4. History integration: entering the desk view calls `history.pushState({ view: 'desk' }, '', '#desk')`; `popstate` (browser back) and Escape both return to the room (`history.back()` from desk state). Deep-loading `/#desk` renders the desk view directly (check `location.hash` on mount). Reduced motion: all crossfades become instant cuts; the monitor remains a plain link to `/home`? No — reduced-motion users get the desk view too, just without animation; the monitor stays an `<a href="/#desk">` whose click is intercepted, so semantics hold in both modes.
5. Screen overlay: a DOM layer positioned at the measured screen rect (~436,152 to 972,460 stage units), `overflow: hidden`, background near-white matching the screen (#faf8f5 sampled from the art). After the loading beat it renders a minimal pixel desktop: a top strip with a live clock (HH:MM, visitor local) and shortcut icons in a grid.
6. Shortcuts (all dictionary-labelled, pixel font, keyboard focusable, arrow-key navigable as a grid with roving tabindex): Home → `/home`, Games → `/games`, Projects → `/projects`, Tutoring → `/tutoring`, Contact → `/home#contact` (the contact section anchor; verify the section id), Legal → `/legal/terms`. Icons are 16×16-styled pixel glyphs; build them as inline SVG with `shape-rendering: crispEdges` (house, game controller/gamepad, folder, graduation cap, envelope, scales). Hover/focus: 1 px lift + label bubble beneath the icon; click: 150 ms white bloom on the screen area, then navigate.
7. Back affordances from the desk: Escape, browser back, and a visible "← Room" pixel button bottom-left of the screen area. Also clicking anywhere on the scene outside the monitor screen returns to the room (with a pointer cursor and an `aria-hidden` presentation; the accessible path is the button).
8. `router.prefetch` all six targets when the desk view mounts.
9. i18n keys: `room.desk.home`, `.games`, `.projects`, `.tutoring`, `.contact`, `.legal`, `.back`, `.screenLabel` (aria-label for the screen nav), plus FR.

**Acceptance.** Full flow at 60 FPS with no layout thrash; back button from `/games` returns to `/#desk`, back again to the clean room; Escape works at both stages; keyboard-only run: tab to monitor, Enter, arrows between icons, Enter navigates; screen overlay tracks the screen rect exactly at all tested viewports (icons never bleed onto the bezel); reduced-motion path is instant but fully functional; deep-link `/#desk` works.

**Negative prompts.** Do not make the desk view a separate route or page component under `src/app` (it is a client view of `/`); do not use an `<iframe>` of the real site on the screen; do not render more than these six shortcuts; do not add window chrome, taskbars, draggable windows, or a fake OS beyond the strip + icons (scope creep magnet); do not animate the LOADING caption (it is static art; the overlay simply covers it when ready); do not attach wheel/scroll hijacking.

## Task 4: Website folder organisation

Reorganise `C:\Users\ahmed\Downloads\Projects\website` (everything outside `ahmed-site/` is workspace, not deployed). Target state:

```
website/
├── ahmed-site/          (repo — untouched by this task except public/audio in Task 6)
├── docs/
│   ├── taskt.txt        (original brief, keep)
│   ├── PLAN.md          (this file)
│   └── suggestions.txt  (keep if still wanted, else delete — ask owner)
├── pixel-art/
│   ├── STYLE.md         (new: palette hexes, outline rules, light direction, font origin note)
│   ├── sources/
│   │   ├── bedroom-gen-original.png      (renamed from Gemini_Generated_Image_bne3fobne3fobne3.png)
│   │   ├── desk-closeup.png              (renamed from close_up_monitor.png)
│   │   └── monitor-keyboard-mouse.png    (renamed from screen-keybaord-mouse-mousapd.png)
│   ├── background.png
│   ├── kitagawa/        (renamed from "kitagawa poster", spaces out of dir names)
│   ├── bonsai/
│   └── monitor/         (DELETE monitor-off.png / monitor-on.png only after confirming nothing references them — they are superseded)
└── (deleted: bgm/ after Task 6 resolves audio; Minecraft.ttf after Task 2 moves it)
```

Also delete from the repo: `ahmed-site/public/room/monitor-off.png` and `monitor-on.png` (unreferenced; grep first). Check `website/svgs/` contents: if its files are already duplicated inside `ahmed-site` (e.g. under `public/`), delete the folder; if unique, move under `pixel-art/sources/` or `docs/`.

Negative prompts: do not delete anything not explicitly listed without checking references (`grep -r` the repo for the filename); do not touch `.claude/`; do not rename files inside `ahmed-site/public/room/` that code references without updating the references in the same commit; do not delete the Gemini original (it is the only high-res source of the room).

## Task 5: Additional features (build in this order, each optional and small)

1. **Persisted preferences (first localStorage use).** `src/lib/room/storage.ts`, single key `room-save-v1`, try/catch wrapped: `{ audio: boolean, lampOn: boolean }`. Audio toggle and lamp state read/write it. No other data.
2. **Lamp toggle.** The desk lamp becomes an interactive object (hotspot on the existing background lamp, ~stage x 60–170, y 300–520): click toggles a warm-dark overlay (multiply-style dimming via a semi-transparent layer, `opacity` transition only), tooltip "Lamp", persisted. Reduced motion: instant.
3. **Window time-of-day.** Overlay tint on the window glass region driven by visitor local hour (day / dusk / night; the art is dusk-native, so day lightens and night darkens + brightens the city window lights with a soft glow layer). Pure CSS layers, no new art required; re-evaluate hourly with a `setTimeout` to the next hour boundary, not an interval.
4. **Desk clock.** Already in Task 3's top strip; additionally show it in the room as a tooltip on the window ("It's 9:42 pm in your world").
5. **OG image.** Replace `/` open-graph/twitter images with a 1200×630 crop of the room composite so shares show the room.
6. **Poster click extra.** Clicking (not hovering) the poster plays the 5 frames then shows a one-line pixel toast (dictionary key) — a taste of the future achievements system, no storage.

Negative prompts: no achievements system, no weather API, no seasons, no cat, no secret content in this round; storage stays two booleans; do not add a settings menu.

## Task 6: Audio legal + technical resolution

1. Rename tracks kebab-case and move to `ahmed-site/public/audio/` **only** those the owner has rights to publish. The 2Pac recording almost certainly cannot be published; recommend replacing all three with CC/royalty-free lo-fi (e.g. from the Free Music Archive or similar, licence recorded in `docs/audio-licences.md`). Present the owner the choice before shipping; do not ship unlicensed tracks by default.
2. `RoomAudio` reads a `TRACKS` array in one place; keep the random pick, add track crossfade only if trivial (else skip).
3. Add `public/audio/` note to CLAUDE.md asset section.

This advice is general information, not legal advice; the owner (a law student) can make the call on the licensing position.

## Task 7: Verification pass

1. Type-check, lint, build on the owner's machine (sandbox builds are unreliable this session; a stale `.git/index.lock` was also observed — delete it manually if `git status` complains).
2. Route sweep including `/#desk` deep link.
3. Keyboard-only and reduced-motion full walkthroughs of room → desk → site and back.
4. FR locale walkthrough (accents in pixel font, all new keys present; `type-check` guards missing keys).
5. Lighthouse on preview: `/` and `/home`, both ≥ 95 performance/accessibility; confirm background.png is still LCP and Minecraft.ttf is not render-blocking other routes.
6. Network panel: zero 404s (audio, fonts, sprites).
7. Diff review: nothing leaked into `api/`, no dictionary key hardcoded, deleted files are truly unreferenced.

## Execution order

Task 1 → Task 2 → Task 3 (depends on 1's zoom fix and 2's font) → Task 6 → Task 5 → Task 4 (cleanup last, after references settle) → Task 7. Commit per task. If the desk-view screen rect cannot be made to track the art across viewports within two attempts, stop and report with screenshots rather than shipping misaligned icons.
