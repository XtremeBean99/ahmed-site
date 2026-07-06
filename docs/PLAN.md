# SPEC v4: Site in the Monitor, Music Notes, Full Playlist, Fixes

Executable specification for an agent manager. Supersedes SPEC v3 (retired by this write). Written 6 July 2026 after review of the v3 implementation (commits `0127b8d` … `f23d0e4`).

Owner directions incorporated: copyrighted tracks are accepted for now (site treated as not publicly released; owner's call, recorded in Task 4); all six tracks stay in the playlist; the real site should render inside the monitor frame if possible (it is — Task 2); three pixel music-note sprites were supplied for the speaker animation (Task 3).

---

## Part A: Review findings from v3 (fix in Task 1)

Implemented and verified good: centring fix (two-element transform, room now centres), stale close-up art replaced (mouse removed from `public/room/desk-closeup.png`), audio provider + full six-track playlist manifest with covers, now-playing widget with cassette placeholder and play/pause/skip, mouse follower (correct rAF + lerp + ref discipline, `pointer: fine` guard, travel box respected), lamp-off art wired, speaker hotspots present, desk click-outside-back present. Defects:

**A1. CRASH: reduced-motion users get an error page on `/`.** `RoomAudioProvider` renders `{children}` **without** the context provider when `useReducedMotion()` is true, but `DeskView` and `NowPlaying` call `useRoomAudio()` unconditionally, which throws. Any visitor with `prefers-reduced-motion` crashes the room. Fix: always provide the context; reduced motion must not disable audio at all (it is a motion preference, not a sound preference). Remove the `if (reduce) return <>{children}</>` and the `reduce` guards from the provider's effects; keep reduce-guards only on animations.

**A2. NowPlaying hidden under reduced motion.** `if (reduce) return null` removes the whole widget. It must render and function; only decorative animation is dropped.

**A3. Track-end always jumps to track 1.** The `ended` handler locates the current track via `PLAYLIST.findIndex(t => t.src === audio.src)`, but `audio.src` is an absolute URL and `t.src` is a relative path, so `findIndex` returns −1 and `next` is always 0. Fix: keep the current index in a ref and increment it; do not string-match URLs.

**A4. Hardcoded English strings, third recurrence.** `NowPlaying`: "Now playing", "Pause", "Play", "Skip". `DeskView` speaker buttons: "Toggle speakers". The dictionary keys specified in v3 (`room.audio.*`) were never wired. Add EN + FR keys and pass them through. Add a lint-stage guard this time: a comment in CLAUDE.md is not working; add a simple unit-style check script or at minimum a grep step in Task 5.

**A5. Speaker feedback incomplete.** v3's tooltip, press-dip, and muted cue were not implemented (hotspots only). Superseded/absorbed by Task 3 (music notes + muted cue); the press dip remains required.

**A6. `window` `pointerleave` rarely fires.** The mouse-return-to-rest listener is attached to `window`; use `document.documentElement` `mouseleave` (or `pointerout` with `relatedTarget === null`) so the mouse actually eases back when the cursor leaves the page.

---

## Ground truth

* Playlist (all six ship, per owner): lo-fi-beat, saffron, cant-look-in-my-eyes, big-poppa-habaytak-remix, remember-summer-days, sky-restaurant; covers exist for three (`public/audio/covers/`). Manifest: `src/lib/room/playlist.ts`.
* Note sprites: `assets/pixel-art/music-note1.png`, `music-note2.png`, `music-note3.png` (plus `.ase` source, keep in assets). Small single-note glyphs. Trim and copy to `public/room/note-1.png` … `note-3.png`.
* Desk view constants (already in `DeskView.tsx`): screen rect (436, 152, 536×308); speakers left (190, 265, 175×300), right (1005, 270, 215×300); top strip height 28 px (`h-7`).
* Speaker note spawn points (top-centre of each cabinet): left ≈ (277, 258), right ≈ (1112, 262).
* The site is same-origin, so an `<iframe>` of any route is scriptable and navigable from the parent page. Existing icon hrefs: `/home`, `/games`, `/projects`, `/tutoring`, `/home#contact`, `/legal/terms`.

## Global constraints and negative prompts

Carried, binding: no URL breaks; no new dependencies; EN + FR per string, same commit; type-check/lint/build on the owner's machine; sprites raw `<img>` pixelated, never `next/image`; animate `transform`/`opacity` only; no transition over 1.6 s; reduced motion honoured for motion only (see A1 — never for function).

Amended this version: the previous "no iframe of the real site" prohibition is **lifted for Task 2 only** — it existed to keep v2 scoped, and the owner has now explicitly requested in-monitor rendering. The audio-copyright gate is **resolved by owner decision** (Task 4 records it); tracks ship.

Still prohibited: fake-OS windowing beyond what Task 2 specifies; weather, achievements, cat, secrets (see Further improvements); AnalyserNode/beat detection; `@ts-ignore`/`any`/`eslint-disable`; touching `api/` or `(site)` page internals except where Task 2 names them.

---

## Task 1: Defect fixes (A1–A6)

Acceptance: with OS-level reduced motion enabled, `/` renders, desk view works, widget visible and functional, no console errors; every track advances to the *next* track on end (test with `audio.currentTime = duration − 1`); grep of `src/components/room` finds no quoted user-facing English; mouse eases to rest when the cursor leaves the page.

Negative prompts: do not silence the A1 crash by wrapping `useRoomAudio` in try/catch or making the hook return nulls — provide real context always; do not disable autoplay-gesture logic under reduced motion.

## Task 2: The site renders inside the monitor (headline)

Clicking a desk icon now opens that page *inside the monitor screen* instead of leaving the room. The desk becomes a tiny working computer.

1. **State.** `DeskView` gains `screenMode: 'desktop' | 'browser'` and `browserPath: string`. Icon click (unmodified left-click only) → `screenMode='browser'`, `browserPath=href`. Modifier/middle clicks keep native behaviour (real new tab).
2. **Iframe.** In browser mode, render `<iframe>` filling the screen area below the top strip (536 × 280 stage px), `title` from a new dictionary key (`desk.browserTitle`), background `#faf8f5`. The site renders at 536 CSS px width → its existing responsive mobile layout, which is the correct fit for a small monitor. A pixel "LOADING…"-style indicator (DOM text in the pixel font, not the baked art) shows until the iframe `load` event.
3. **History hygiene.** Set the iframe's initial `src` when entering browser mode. For subsequent in-desk opens (user clicks a different icon after going back to the desktop), navigate the existing iframe via `iframe.contentWindow.location.replace(href)` — `replace` avoids polluting the joint browser history. Do not unmount/remount the iframe per navigation. Parent history gains nothing; browser-back still means "leave desk / leave room" exactly as today.
4. **Top strip additions** (right of the clock, left of "← Room"): a "Desktop" button (returns `screenMode='desktop'`, shown only in browser mode) and an "Expand" button that `router.push`es the iframe's *current* path so the user can jump to the real full-size page. Track the current path by polling `iframe.contentWindow.location.pathname + hash` every 500 ms while in browser mode (same-origin; App Router client navigation does not refire `load`). Dictionary keys: `desk.desktop`, `desk.expand`.
5. **Recursion guard.** In the room's client root: if `window.self !== window.top`, immediately `location.replace('/home')`. The room never renders inside its own monitor.
6. **Keyboard and focus.** On entering browser mode, move focus to the iframe. Escape ladder: browser mode → desktop mode → room (extend the existing Escape handling; document the order in code). On returning to desktop mode, restore focus to the icon that was activated.
7. **Small viewports.** Below 700 px viewport width, icon clicks keep the current full-page navigation (bloom + `router.push`); a monitor-in-monitor on a phone is unusable. The cutoff constant lives beside the other stage constants.
8. **Audio continuity.** The provider lives in the parent page, so music continues while browsing in-monitor — verify, this is half the charm.
9. **Scrollbars.** Leave native scrolling inside the iframe. Do not inject CSS into the iframe document.

Acceptance: from the desk, open Games in-monitor, click through to a game page inside the monitor, music still playing, Expand lands on the same path full-page; back button conduct: after browsing three pages in-monitor, one browser-back leaves the desk (no phantom iframe history steps); Escape ladder works; reduced motion functional; < 700 px falls back to navigation; `/#desk` deep link still works; no recursion when someone opens `/` inside the monitor manually (types it in a game's link etc.).

Negative prompts: do not build tabs, address bar, bookmarks, or window chrome; do not scale the iframe with transforms (native 536 px mobile layout is the design); do not intercept or rewrite links inside the iframe; do not use `srcdoc` or proxying; do not let the iframe capture Escape (listen in the parent; if focus is inside the iframe, the parent cannot see keys — acceptable, the strip buttons and click-outside remain).

## Task 3: Music-note speaker animation (uses the owner's three sprites)

1. Trim `music-note1/2/3.png` and copy to `public/room/note-1.png` … `note-3.png`. Record trimmed sizes in STYLE.md.
2. `MusicNotes` component in `DeskView`, one per speaker, `aria-hidden`, `pointer-events: none`, rendered inside the stage so scaling is inherited.
3. Behaviour while `playing` is true: each speaker emits a note every 900–1300 ms (randomised; the two speakers offset so they do not sync). A note: random sprite of the three, spawns at the speaker's spawn point ± 10 px x-jitter, floats up 40–60 stage px with a gentle horizontal sway, fades out over 1.8–2.4 s.
4. Implementation: a fixed pool (3 slots per speaker) of `<img>` elements recycled on `animationend`; motion via CSS keyframes animating `transform` and `opacity`, per-note variation through CSS custom properties (`--dx`, `--dur`, `--delay`) set at spawn. No per-frame React state; spawning may use one `setTimeout` chain per speaker.
5. Notes stop spawning (in-flight notes finish) when paused/muted; everything off under reduced motion; pool torn down when leaving the desk view.
6. Complete the v3 leftovers: press-dip on speaker click (`scale(0.98)`, 120 ms) and the crossed-note muted glyph at each speaker's top-right while muted (fade 150 ms).

Acceptance: notes visibly float from both speakers while music plays, stop on mute, resume on unmute; no React re-renders during steady-state animation (DevTools profiler); no notes under reduced motion; sprites crisp at all stage scales.

Negative prompts: no unbounded DOM node creation (pool only); no Framer Motion for the notes (CSS keyframes are sufficient and cheaper); notes must not overlap the screen area's interactive content (spawn points and travel keep them over the wall/speakers).

## Task 4: Documentation updates

1. `docs/audio-licences.md`: record the owner's direction of 6 July 2026 — the deployment is treated as private/testing, commercial recordings ship at the owner's informed risk, decision to be revisited before any public promotion of the site. List all six tracks with status (three commercial/remix, three to be confirmed). Note plainly that the domain itself is publicly reachable. (General information, not legal advice.)
2. CLAUDE.md room section: in-monitor browsing architecture (iframe, `replace()` navigation, recursion guard, 700 px fallback), music-note pool pattern, and a bold line that `RoomAudioProvider` must always provide context (A1's class of bug).
3. `assets/pixel-art/STYLE.md`: note sprites entry (sources, trimmed sizes, palette).
4. This file replaces SPEC v3 (done by this write). `docs/` should contain: `PLAN.md`, `taskt.txt`, `audio-licences.md`, and `suggestions.txt` only if the owner still wants it.

## Task 5: Verification pass

1. Type-check, lint, build on the owner's machine.
2. Reduced-motion sweep FIRST (it crashed in v3): `/`, desk, widget, in-monitor browsing, all functional.
3. In-monitor browsing matrix: each of the six icons; internal link-following; Expand from a deep path; back-button conduct; audio continuity; `/#desk`; recursion guard (`/` typed inside the iframe context redirects to `/home`).
4. Audio: end-of-track advances sequentially through all six (A3), skip cycles, prefs persist.
5. Notes animation: play/pause/mute transitions; profiler shows no re-render churn; 60 FPS with notes + mouse follower simultaneously active.
6. FR sweep of every new key (`desk.browserTitle`, `desk.desktop`, `desk.expand`, `room.audio.*`); grep for hardcoded strings (A4 has now recurred three times — treat any hit as a blocker).
7. Lighthouse `/` and `/home` ≥ 95 performance/accessibility; the iframe must not load until browser mode is entered (network panel on desk entry shows no page fetch).
8. Diff review: `api/` and `(site)` untouched except any recursion-guard placement.

## Execution order

Task 1 → Task 2 and Task 3 in parallel → Task 4 → Task 5. Commit per task. Stop-and-report triggers: iframe focus/Escape interaction proves unworkable (report options rather than hacking key listeners into the iframe), or history pollution cannot be fully avoided with `location.replace`.

---

## Further improvements (owner-requested suggestions, not commissioned work)

Ranked roughly by value for effort, all compatible with the current architecture:

1. **Persist the desk session.** Remember `screenMode`/`browserPath` in `sessionStorage` so returning from Expand (or a refresh) restores the page open in the monitor. Small, high polish.
2. **Idle screensaver.** After ~90 s idle in desk view, a pixel starfield or bouncing-logo screensaver on the monitor; any input wakes it. Pure CSS/canvas on the screen rect, very in-theme.
3. **Wallpaper unlocks.** Alternative desktop backgrounds for the monitor (variants of the site palette), selectable from a tiny settings icon; stored in the existing prefs object. First step towards the achievements idea without the full system.
4. **Window weather.** The original brief's window reacting to real weather (Open-Meteo, no key, one API route with an hour of caching). The time-of-day tint already exists; rain/snow overlays on the window art would complete it.
5. **Cat.** The brief's sleeping cat on the bed, with wake/stretch frames and an occasional position change between visits (uses the existing visit-counter idea in prefs). Needs new art in the established pipeline.
6. **Interaction sounds.** Soft click for icons, page-flip for the poster, purr for the future cat, gated behind the existing audio pref and a separate `sfx` boolean. The provider architecture already supports a second, non-music element.
7. **Konami code → fake terminal.** The deferred v1 idea; the desk monitor is now the natural home for it (a `terminal` screenMode beside `desktop`/`browser`).
8. **Room OG image.** `/`'s open-graph image is still the old text card; a 1200×630 crop of the room art would make shares land the aesthetic.
9. **Bonsai growth.** Bonsai frame index advances with visit count (5 stages already drawn) — the room quietly ages with the visitor.
10. **A `/room` alias.** A tiny redirect route so the owner can send people directly to the experience even if `/` ever changes role.
