# SPEC v3: Living Desk — Mouse Follow, Speaker Mute, Now Playing, Lamp Art, Centring Fix

Executable specification for an agent manager. Supersedes SPEC v2 (this file replaces it; v2 content is retired). Written 6 July 2026 after review of the v2 implementation (commits `5643ee2` … `76d854d`).

---

## Part A: Review findings from v2 (fix in Task 1)

The v2 implementation is substantially complete and good: route/layout structure intact, `AnimatedSprite` consolidation done, Minecraft font wired through `--font-pixel`, desk view with six pixel icons works, storage module matches spec, EN and FR dictionaries both carry `room.*` and `desk.*` keys, `/home#contact` anchor verified to exist. Defects:

**A1. The room is off-centre (owner-reported, root cause found).** `RoomStage` applies the rest-state fit scale on the same element whose `transformOrigin` is permanently set to the monitor screen point (`zoomOriginX/Y` ≈ 360, 333). Scaling about a non-centre origin at rest shifts the whole stage down-right whenever fit scale ≠ 1, so the room sits off-centre on every viewport that isn't exactly 1408×768. Commit `76d854d` attempted a centring fix but the origin problem remains. Fix by separating the two transforms onto two nested elements: an outer wrapper that centres and fit-scales about `center center` (exactly as `DeskView` already does with `translate(-50%,-50%) scale(fit)`), and an inner zoom wrapper whose `transformOrigin` is the monitor point in stage coordinates and which animates only `zoomScale`. Stage coordinates remain valid on the inner element.

**A2. Deployed close-up art is stale.** The owner removed the mouse from `assets/pixel-art/sources/desk-closeup.png`, but `public/room/desk-closeup.png` still contains the baked-in mouse. Copy the updated source over the public file (confirm first: the source's mousepad right of the keyboard is empty; the current public file's is not).

**A3. Music toggle is dead when audio starts disabled.** In `RoomAudio`, the `Audio` element is created only inside the mount effect and only when `prefs.audio` is true. With a saved `audio: false`, `audioRef` stays null and the toggle button does nothing, permanently. Restructure: create the element lazily on first demand (mount-with-pref-true or first toggle-on), one code path.

**A4. Hardcoded English strings.** `RoomAudio` ships default prop labels ("Mute music", "Play music") and renders literal "MUSIC ON/OFF"; `Room.tsx` passes no labels. This violates the bilingual rule. Task 3 replaces this control with the now-playing widget; all its strings come from the dictionaries.

**A5. Transition timers leak into history.** In `handleEnter`, the 1.5 s safety timeout is not cleared when the 800 ms path succeeds, so both run: `pushState('#desk')` at 800 ms, then `location.hash = 'desk'` again at 1500 ms, and `navigatingRef` resets twice. Clear both timers in whichever path fires first (Escape already clears them). Unify on `pushState` for entering the desk; the reduced-motion path's `location.hash =` assignment creates an inconsistent extra history entry.

**A6. Desk click-outside-back is claimed but absent.** Commit `76d854d` mentions "desk click-outside", but `DeskView` has no such handler. Add: clicking the scene outside the monitor screen area returns to the room (pointer cursor on that region; the accessible path remains the "← Room" button and Escape).

Carried observations, no action: autoplay-after-first-gesture is retained by owner preference; keep it gated on the stored `audio` pref. The new `assets/` MP3s are commercial recordings/remixes; publishing them from `public/` carries copyright infringement risk, and the licensing call rests with the owner (general information, not legal advice). Record whatever ships in `docs/audio-licences.md`.

---

## Ground truth: new assets and measurements

All measurements in 1408×768 stage coordinates; re-verify programmatically at implementation (sampled at 2–4 px stride).

* `assets/pixel-art/sources/mouse-only-closeup.png`: mouse sprite on transparent canvas, non-transparent bbox **(1007, 608) → (1117, 688)**, i.e. 110×80. Extract trimmed to `public/room/mouse.png`.
* `assets/pixel-art/sources/desk-closeup.png` (updated): mouse removed. Mousepad is a perspective trapezoid: top edge y ≈ 565 spanning x ≈ 195–1212; bottom edge y ≈ 724 spanning x ≈ 180–1260. Keyboard occupies roughly x 435–965, y 585–705.
* Mouse travel box (top-left of the 110×80 sprite; keeps it on the pad, right of the keyboard, clear of the pad's right edge): start with **x ∈ [975, 1140], y ∈ [572, 635]**, tune visually. Natural at-rest position: (1007, 608).
* Speakers in the close-up: left ≈ **(190, 265)–(365, 565)**; right ≈ **(1005, 270)–(1220, 570)**.
* `assets/pixel-art/background_lamp_off.png`: 1408×768 room background variant with the lamp off. Not yet deployed or referenced.
* New tracks in `assets/`: `02 Can't Look In My Eyes.mp3` and `Biggie X Fairuz - Big Poppa X حبيتك بالصيف (Abuzeid Remix).mp3`, plus `AlbumArtSmall.jpg` and `Folder.jpg` (album art). `public/audio/` currently holds `lo-fi-beat.mp3` and `saffron.mp3`, matching the current `TRACKS`.
* `docs/` lives in the repo: `PLAN.md` (this file), `taskt.txt`, `suggestions.txt`.

## Global constraints and negative prompts (carried from v2, all still binding)

Hard rules: no URL breaks; no new dependencies; both dictionaries per user-facing string, same commit; type-check/lint/build green per task on the owner's machine (sandbox mounts went stale twice this project; do not trust sandbox builds or sandbox `git status`); reduced motion honoured; sprites as raw `<img>` + `image-rendering: pixelated`, never `next/image`; animate `transform`/`opacity` only.

Negative prompts: no CRT/boot content; no new hotspots without finished art; no colour into `(site)` pages; no `@ts-ignore`/`any`/`eslint-disable` fixes; no scope creep into fake-OS windows, weather, achievements, cat, or secrets; do not touch contact/leaderboard/api code; no transition over 1.6 s; do not move `assets/` MP3s into `public/` without the owner's explicit licensing decision recorded in `docs/audio-licences.md`.

---

## Task 1: Defect fixes (A1–A6)

Acceptance: room visually centred at 1920×1080, 1440×900, 1280×720, and 390×844 (screenshot each; letterbox bars symmetric — this is the owner's headline complaint); desk close-up shows no baked-in mouse; with saved `audio:false` the music control starts playback on first press; no double history entries after the zoom; Escape during zoom still cancels; clicking the desk scene outside the screen returns to the room; no English literals remain in room components (grep for `'MUSIC`, `'Mute`, `'Play`).

Negative prompts: do not fix A1 by removing the zoom origin (the zoom must still converge on the monitor screen); do not introduce a second scale hook; do not regress `DeskView`'s already-correct centring.

## Task 2: Audio architecture — provider + playlist manifest

Three consumers now need shared audio state (now-playing widget, desk speakers, autoplay). Refactor before building them:

1. `src/lib/room/playlist.ts`, single source of truth:
```ts
export interface Track { id: string; title: string; artist?: string; src: string; cover?: string }
export const PLAYLIST: Track[] = [ /* lo-fi-beat, saffron, plus newly shipped tracks */ ]
```
2. Move owner-approved tracks from `assets/` to `public/audio/` with kebab-case ASCII filenames (e.g. `cant-look-in-my-eyes.mp3`, `big-poppa-habaytak-remix.mp3`); covers to `public/audio/covers/` (`AlbumArtSmall.jpg` → the matching track's cover, renamed; delete `Folder.jpg` if it duplicates it). Titles/artists live in the manifest, not filenames. Arabic display text in `title` is fine; filenames stay ASCII.
3. `RoomAudioProvider` (client context) mounted once in `Room.tsx` above both views: owns the single `Audio` element; exposes `{ playing, track, toggle, next }`; persists the `audio` pref on change; keeps autoplay-with-gesture-fallback gated on the pref; volume 0.3; on `ended` advances to the next track (drop `loop` — loop the playlist, not the track); random start index kept.
4. `next` reuses the element safely: set `src`, `load()`, then `play()` only if currently playing.

Acceptance: audio state survives room ↔ desk view switches without restarting the track; `ended` advances; toggle works from both views; prefs persist across reloads.

Negative prompts: no Web Audio graph, crossfades, volume slider, or shuffle UI; no second `<audio>` element; no runtime ID3 parsing (metadata is in the manifest).

## Task 3: Now-playing corner widget (replaces the MUSIC ON/OFF button)

Bottom-left corner, present in both views, pixel font, tooltip palette (#3d2e1e / #5a4430 / #e8d5b0):

1. Layout: album cover 28×28 (`image-rendering: pixelated`, 2 px border) | track title (artist beneath, smaller, if present) | two buttons: play/pause (single toggling button) and skip-next. Title truncates with ellipsis at ~160 px; no marquee.
2. Cover fallback: if `track.cover` is missing or errors (`onError`), render an inline pixel-art cassette SVG placeholder (16×16 grid, `shape-rendering: crispEdges`, `DeskIcon` palette). Never a broken-image glyph.
3. Controls are pixel SVG icons in the `DeskIcon` style: play (right triangle), pause (two bars), skip (triangle + bar). Dictionary aria-labels; focus-visible rings consistent with the room.
4. When paused, the widget stays visible (cover + queued title + play icon) so the feature is discoverable.
5. Below 500 px viewport width, collapse to cover + play/pause only.
6. i18n keys (EN + FR): `room.audio.play`, `.pause`, `.skip`, `.nowPlaying` (region aria-label). Reduced motion: fully functional, decorative animation off.

Acceptance: correct metadata for every track; placeholder shows for cover-less tracks (test by removing a cover path temporarily); skip advances and preserves playing state; keyboard operable; FR labels render; widget never overlaps the HUD enter link (bottom-right) at any viewport.

Negative prompts: no progress bar, seek, track-list dropdown, or equaliser bars; no network cover fetching.

## Task 4: Interactive speakers — mute/unmute (desk view)

1. Two hotspots in `DeskView` at the measured speaker rects, both `<button>`s inside the desk nav, dictionary labels (`room.audio.speakersLabel`, EN "Speakers — mute music" style, FR equivalent), both calling `toggle`.
2. Tooltip on hover/focus: the speech-bubble component currently lives room-side; extract it for reuse in `DeskView`.
3. Animation (subtle): crop the two speaker regions from the updated `desk-closeup.png` into `public/room/speaker-left.png` / `speaker-right.png` and overlay each hotspot with its own crop, so animation moves art rather than an empty box. While music plays: a heartbeat pulse, `scale(1 → 1.015)` every ~1.6 s, `transform` only. On toggle: one-shot press dip (`scale(0.98)`, 120 ms). All off under reduced motion.
4. Muted cue: a small crossed-note pixel SVG at each speaker's top-right corner, fading in/out 150 ms while muted.

Acceptance: either speaker mutes/unmutes; the pulse runs only while audio is audibly playing; overlay crops align pixel-perfectly (at rest the seam must be invisible — screenshot diff against the plain background at two scales); keyboard focus reaches both speakers in a documented, sensible order.

Negative prompts: no AnalyserNode or beat detection (fixed rhythm only); speakers never navigate anywhere; do not repaint or regenerate the speaker art itself.

## Task 5: Pointer-following mouse on the mousepad (desk view)

1. Extract the mouse sprite trimmed (110×80) to `public/room/mouse.png`; render in `DeskView` as an `aria-hidden` decorative `<img>` positioned via `transform: translate(x, y)` inside the stage (inherits stage scaling automatically).
2. Mapping (proportional, as requested): normalise the pointer over the viewport (`nx = clientX / innerWidth`, `ny = clientY / innerHeight`), map linearly into the travel box: `x = X_MIN + nx × (X_MAX − X_MIN)`, likewise y. Whole viewport drives the whole pad.
3. Discipline: `pointermove` listener on `window` writes to a ref; a single `requestAnimationFrame` loop applies it with lerp smoothing (`current += (target − current) × 0.15`) directly to the DOM node. No React state per move, zero re-renders. Cancel loop and listener on unmount and whenever the desk view is not active.
4. Idle: starts at the natural spot (1007, 608); follows on first pointer move; eases back to natural spot when the pointer leaves the viewport.
5. Touch devices (`matchMedia('(pointer: fine)')` false) and reduced motion: static at the natural spot.
6. `pointer-events: none` — the sprite never intercepts input.

Acceptance: tracks smoothly at 60 FPS (Performance panel clean; React DevTools shows no re-renders during movement); never exits the pad or overlaps the keyboard at any viewport; returns to rest on pointer leave; static on touch/reduced motion; icon and speaker clicks unaffected.

Negative prompts: do not hide or restyle the real OS cursor; no React state or Framer Motion springs per pointer event; the pad mouse is not clickable or focusable; no follow behaviour in the room view.

## Task 6: Lamp-off background art (room view)

1. Copy `assets/pixel-art/background_lamp_off.png` → `public/room/background-lamp-off.png`. Confirm 1408×768 and pixel alignment with `background.png` by programmatic overlay diff; if the diff extends beyond the lamp and its light cone (owner may have regenerated the whole scene), stop and report before wiring.
2. Replace the CSS radial-gradient dim hack: stack both background `<img>`s (lamp-on above lamp-off), toggle the top one's `opacity` 0/1 over 400 ms (instant under reduced motion). Lamp-off image inserted after first paint or `fetchpriority="low"` so LCP stays the lamp-on background.
3. Lamp hotspot, stored pref, and focus ring stay as-is. The ambient lamp-glow pulse renders only while the lamp is on.

Acceptance: toggle crossfades real art; pref persists; LCP unchanged (Lighthouse before/after); no flash of unloaded image on first toggle.

Negative prompts: do not swap `src` on a single `<img>` (decode flicker); do not leave the old gradient overlay stacked on the new art.

## Task 7: Housekeeping and documentation

1. `docs/`: this file replaces the v2 plan (done by this write). Delete `docs/suggestions.txt` if the owner confirms it is stale (it predates the room project); otherwise leave.
2. `docs/audio-licences.md`: every file in `public/audio/` with source and licensing status as stated by the owner; plainly flag commercial recordings.
3. `assets/`: after Task 2, `assets/` should hold only `pixel-art/` and `svgs/`; delete loose files that were moved. Update `assets/pixel-art/STYLE.md` with the mouse sprite, speaker crops, and lamp-off background.
4. CLAUDE.md: update the room section — audio provider architecture, playlist manifest location, the two-element transform structure from Task 1 (so future agents do not reintroduce the origin bug).
5. Confirm `.gitignore` does not exclude `public/audio/covers/`.

Negative prompts: do not delete `taskt.txt` or anything under `assets/pixel-art/sources/`; do not rewrite unrelated CLAUDE.md sections; do not rename previously shipped files under `public/room/`.

## Task 8: Verification pass

1. `npm run type-check && npm run lint && npm run build` on the owner's machine. If `git` misbehaves, check for a stale `.git/index.lock`.
2. Centring screenshots at the four Task 1 viewports; bars symmetric, room centred.
3. Full flows, mouse and keyboard-only: room → zoom → desk → icon → site page → back → `/#desk` → back → room; Escape at every stage.
4. Audio matrix: fresh profile (autoplay attempt); saved `audio:false` (widget starts music); speaker mute/unmute; widget skip; track `ended` advance; state across view switches.
5. Reduced-motion sweep: static pad mouse, no pulses, instant fades, everything operable.
6. FR locale sweep of all new strings; `type-check` confirms dictionary parity.
7. Lighthouse `/` and `/home` ≥ 95 performance/accessibility; LCP still `background.png`; zero 404s (fonts, sprites, audio, covers).
8. Diff review: nothing under `api/` or `(site)` pages beyond intended; grep room components for hardcoded user-facing strings.

## Execution order

Task 1 → Task 2 → Tasks 3, 4, 5 in any order (all depend on 2; 4 and 5 also on 1's A2 art copy) → Task 6 → Task 7 → Task 8. Commit per task. Stop-and-report triggers: lamp-off art misaligned (Task 6.1), speaker crops that cannot be made seam-invisible (Task 4), or any filesystem inconsistency resembling this session's stale-mount episodes.
