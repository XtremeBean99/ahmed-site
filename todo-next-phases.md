# todo — next-phase designs (Spec 2 onward)

Kept separate from `todo.md` while the Spec 1 implementation agent is editing that
file. **Fold these back into `todo.md` once Spec 1 lands** (they assume the post-Spec-1
codebase: room-only, `ScreenMode = desktop | paint | minesweeper | readme | music | legal`,
no browser, dead backend archived).

These are **specs (designs)**, not bite-sized implementation plans. Each still needs its
own `writing-plans` pass (with exact code) when it becomes the active phase — deferred on
purpose because the exact line targets shift as earlier phases merge. Open design
decisions that need Ahmed's input are flagged **⟨DECIDE⟩**.

## Recommended sequencing (revised now that SFX assets are in hand)

1. **Spec 2 — Interaction SFX + global click + iPod skip** (assets ready incl. iPod art) ← do next
2. **Spec 7 — Settings app** (no art; gives the Spec 2 SFX pref its toggle; pairs with Spec 3)
3. **Spec 3 — Discoverability & reward** (no art; makes the room reward exploration)
4. **Spec 4 — Mobile & polish** (no art; broadens the audience)
5. **Spec 5 — Diegetic record player** (needs art)
6. **Spec 6 — Life & atmosphere: cat + weather + night sky** (needs art + an API)

(Spec numbers reflect the order they were written, not priority; Spec 7 slots second.)

Rationale: front-load everything that needs no new pixel art so Ahmed can draw phases
5–6 art in parallel. SFX first because the files already exist and it lifts every existing
interaction immediately.

---

# SPEC 2 — Interaction SFX + global click + iPod skip object

**Goal:** every physical room interaction plays a short sound (behind an `sfx` pref),
**every click anywhere on the site plays the click sound**, and a new **iPod** desk object
skips the track. Ships as one pass because all three share `SfxProvider`/`RoomAudioProvider`.

## The six sounds (already in `assets/`)
Move to `public/sfx/` (kebab-case, lowercase — Vercel is case-sensitive; the "Saffron
incident" rule): `lamp.mp3`, `drawer-open.mp3`, `clock-change.mp3`, `poster-sound.mp3`,
`pc-start.mp3`, `mouse-click.mp3`. Source copies stay in `assets/` (repo-internal).

## Architecture
- **`useSfx()` hook + `SfxProvider`** (`src/components/room/RoomSfxProvider.tsx`), mounted
  next to `RoomAudioProvider` so both room views share it. Owns a small pool of preloaded
  `Audio` elements (one per sound, cloned for overlap) and a `play(name)` method.
- **Separate `sfx` pref** in `room-save-v1` (`{ …, sfx: boolean, sfxVolume: number }`,
  default `sfx: true`, `sfxVolume: 0.5`). Independent of the music `audio` pref — muting
  music must not mute SFX and vice-versa.
- **Reduced motion never disables sound** (existing constraint): SFX ignore
  `prefers-reduced-motion` entirely.
- **First-gesture unlock:** browsers block audio until a user gesture. SFX are always
  triggered *by* a gesture (click/toggle), so no autoplay problem — but the pool is created
  lazily on first `play()` to avoid an idle `Audio` on load.
- **Pooling:** `mouse-click` can fire rapidly; keep 3–4 clones and round-robin so repeated
  clicks overlap cleanly. Others are single-shot (restart on retrigger).

## Wiring (call sites, post-Spec-1)
- `lamp.mp3` → Room `toggleLamp` (both the room lamp object and the desk close-up lamp
  button share this callback).
- `drawer-open.mp3` → side-table toggle (`sideTableOpen`).
- `clock-change.mp3` → `SideTableClock` 12/24h click.
- `poster-sound.mp3` → poster `AnimatedSprite` `onClick`.
- `pc-start.mp3` → monitor `onEnter` (the zoom-to-desk trigger). **LOCKED: play once at
  zoom start** (not looped under the boot screen).
- `mouse-click.mp3` → **GLOBAL: any click anywhere on the site** (NEW — Ahmed's request).
  A single document-level `pointerdown`/`click` listener in `SfxProvider` plays the click
  on every user click, `sfx`-gated. This replaces per-element click wiring (icons, strip
  buttons need no individual hookup). Guard: only left/primary clicks; pooled so rapid
  clicks overlap. The five interaction sounds above still fire on their specific actions —
  a lamp toggle plays `lamp.mp3` AND the global click; ⟨DECIDE⟩ suppress the global click
  when a specific SFX also fires? Default: allow both (the click is quiet; layering feels
  tactile) — revisit if it sounds cluttered.

## NEW: iPod desk object (skip control)  ⟨art ready: `assets/pixel-art/ipod.png`⟩
Ahmed drew an iPod; add it as a room object that skips the music. (A turntable may replace/
augment it later — Spec 5.)
- **Sprite:** extract `assets/pixel-art/ipod.png` (full-canvas, single frame, iPod + white
  earbuds, drawn ~stage x588–702, y448–495) to `public/room/ipod.png` via a new
  `scripts/extract-ipod.mjs` (tight union bbox +2px pad, matching `extract-side-table.mjs`).
  Generate lighting variants with `npm run lighting`.
- **Object:** new `objects.ts` entry `ipod` at the extracted rect; render in `Room.tsx` in
  the room view. Single-frame; use the shared `-2px` hover lift + tooltip ("pickup
  animation") like other room objects (a lightweight `RoomObject` wrapper, or `AnimatedSprite`
  with one frame).
- **Behaviour — "skip the track on play":** click → advance to the next track (random,
  no-repeat) via `RoomAudioProvider`. ⟨DECIDE⟩ if music is stopped/paused when clicked:
  default = **start playback and land on a fresh track** (so a click always results in music
  playing a new song). Plus the global click sound.
- **i18n:** `room.ipod` label + `room.ipodTip` tooltip ("Skip track" / FR "Piste suivante")
  in both dictionaries.
- **a11y:** real `<button>` inside the room `<nav>`, focus-visible ring, tooltip on focus and
  hover; decorative earbuds are part of the sprite (no separate hit area).

## Controls (UI) — LOCKED: no control this phase
Decision: the SFX toggle/volume lives in a **future Settings app** (see Spec 7), not in
NowPlaying. **This phase ships SFX on by default with no UI control.** The `sfx`/`sfxVolume`
prefs are still written to `room-save-v1` (default `true` / `0.5`) so the Settings app can
flip them later; `useSfx()` reads them, so the moment the Settings app lands the toggle just
works with no SFX-system changes.

## i18n
No new user-facing strings this phase (no control UI). The Settings app (Spec 7) will add
`settings.sfx*` labels in both dictionaries when built.

## Accessibility
The SFX toggle is a real `<button aria-pressed>`; SFX are decorative and never gate
functionality; no SFX on focus/hover, only on activation (so keyboard tabbing is silent).

## Acceptance criteria
- [ ] Every click anywhere on the site plays `mouse-click.mp3` (SFX on by default).
- [ ] The five interaction sounds each play on their specific action (lamp/drawer/clock/
      poster/pc-start).
- [ ] The iPod appears in the room with a hover/focus tooltip + `-2px` pickup lift; clicking
      it skips to a new track (and starts playback if stopped).
- [ ] `sfx`/`sfxVolume` prefs exist in `room-save-v1` (default true/0.5) and are honoured by
      `useSfx()`; music mute is independent (muting music does not mute SFX).
- [ ] Rapid clicks overlap without cutting out (pool works).
- [ ] Works with OS reduce-motion on (sound still plays; iPod hover lift still plays).
- [ ] EN+FR for the iPod label/tooltip; `npm run type-check && lint && build` pass.

## Open decisions
- ⟨DECIDE⟩ mouse-click on speaker mute toggles too? (default: no).
- pc-start timing — LOCKED once at zoom start. SFX volume default 0.5. Control → Spec 7.

---

# SPEC 3 — Discoverability & reward

**Goal:** reward exploration (the original brief) with gentle first-visit hinting, an
achievements/"things you found" system, and a hidden konami→terminal easter egg.

## 3a. First-visit hint layer
- On a visitor's first session (`visitCount <= 1` in `room-save-v1`), briefly pulse a soft
  outline on the interactable room objects (monitor, poster, bonsai, lamp, coffee, side
  table, speakers) for ~4 s, staggered, then fade. Cancels immediately on first interaction.
- Decorative: `aria-hidden`, `pointer-events: none`, warm outline matching the focus ring.
- ⟨DECIDE⟩ show once ever, or on each of the first 2–3 visits? Default: first visit only,
  with a re-trigger if the user presses `?`.

## 3b. Achievements / "things you found"
- **State:** a `discoveries` string-set in `room-save-v1` (e.g. `lamp`, `drawer`, `clock`,
  `music`, `poster`, `bonsai`, `coffee`, `paint`, `minesweeper`, `readme`, `legal`,
  `terminal`, `screensaver`). Additive, never reset.
- **Feedback:** on first unlock of each, a small pixel toast (reuse the poster-toast styling)
  + `aria-live="polite"` announcement. The poster toast is the seed — generalise it into a
  `useDiscovery(id)` hook + a single toast host.
- **Viewer:** a "found N / M" readout. ⟨DECIDE⟩ surface as (a) a small counter by the clock/
  visit odometer, or (b) a desktop "Trophies" app listing each with a found/locked glyph.
  Default: (a) counter + (b) a lightweight list inside the README or a new tiny app — pick
  one at plan time.
- No backend; localStorage only.

## 3c. Konami → terminal app
- Global key listener in `Room.tsx` for `↑↑↓↓←→←→ B A`; on match, open a new
  `screenMode: 'terminal'` (`DeskTerminal.tsx`) — reuses the desk screen + Escape ladder.
- Minimal shell: prompt `guest@ahmed:~$`, commands `help`, `whoami`, `ls`, `cat readme.txt`
  (prints the README), `sfx on|off`, `clear`, `exit`. Unknown → `command not found`.
- Unlocks the `terminal` discovery. ⟨DECIDE⟩ command set — above is the proposed minimum.
- Pixel/monospace styling, green-on-dark, in-screen scrollback.

## Dependencies
None new (no art, no audio). Pairs nicely with Spec 2 (a `terminal` open SFX, unlock jingle
— optional, only if Ahmed adds those sounds later).

## Acceptance criteria
- [ ] First-visit hints pulse then fade; cancel on interaction; not shown to returning visitors.
- [ ] Each tracked interaction unlocks once, shows a toast + polite announcement, persists.
- [ ] Konami opens the terminal; commands behave; Escape ladder works.
- [ ] EN + FR for all copy; localStorage only; type-check/lint/build pass.

---

# SPEC 4 — Mobile & polish

**Goal:** make the room genuinely usable on phones (today the weakest surface) and tidy
loading performance.

## 4a. Drag-to-pan the stage
- Today `useStageScale` fit-scales the 1408×768 stage with letterboxing, so on a tall phone
  the room is tiny. Add an opt-in **zoomed mode on coarse-pointer/narrow viewports**: scale
  to fill height, and let the user drag horizontally (and vertically if needed) to pan.
- Implementation sketch: a pan offset (clamped to stage bounds) written to the outer
  transform via rAF (never per-event React state — same discipline as the desk mouse).
  Pointer/touch drag with momentum optional. Pinch-zoom ⟨DECIDE⟩ (default: no pinch,
  fixed fill-height zoom + pan only, to keep hotspot math simple).
- Respect the existing two-transform rule (outer centre/scale, inner zoom origin) — panning
  is an added translate on the outer wrapper only.

## 4b. Bigger hit areas + tap hints
- On coarse pointers, pad hotspot rects (min ~44×44 CSS px after scale) so objects are
  tappable. A subtle one-time "tap to explore" hint on first mobile visit (ties into Spec 3a).
- Verify the desk close-up screen (536×308) apps (paint/minesweeper) are usable by touch;
  the Home full-page fallback below 700 px already exists — re-audit after room-only.

## 4c. Loading / perf
- Confirm `background.png` stays the LCP with `fetchpriority="high"`.
- Preload the desk-closeup art and first-needed sprite sets on idle (`requestIdleCallback`)
  so entering the desk is instant.
- Audit CLS on the stage mount; reserve the stage box to avoid layout shift.
- ⟨DECIDE⟩ sprite atlasing (combine per-object frames into one image + CSS background-position)
  — larger change; default: skip unless a Lighthouse pass shows a real request-count problem.

## Dependencies
None new. Best done after Spec 1 so hotspot inventory is final (no browser).

## Acceptance criteria
- [ ] On a phone, the room fills the height and can be panned to see all objects.
- [ ] All room hotspots are tappable (≥44px), tooltips appear on tap where sensible.
- [ ] Paint + Minesweeper are playable by touch.
- [ ] Lighthouse mobile: no CLS regression, LCP unchanged/better; type-check/lint/build pass.

---

# SPEC 5 — Diegetic record player  ⟨needs art⟩

**Goal:** replace the abstract "click the speakers to mute" with a physical record player
you operate — a more tactile music control matching the room's spirit.

## Interaction model (proposed)
- New room object: a turntable (on the desk or a shelf). ⟨DECIDE⟩ placement + whether the
  existing desk speakers stay as passive art (recommended: keep speakers as art, they still
  emit the music notes; the turntable becomes the control).
- **Needle down** (click platter/arm) → play; **needle up** → pause.
- **Nudge the record / click the arm-return** → skip (random no-repeat, reuse existing
  advance logic).
- Optional **vinyl crackle** ambient loop under playback — ⟨needs a `vinyl-crackle` audio
  file⟩; wire through the Spec 2 SFX/ambient system (a looping ambient channel, `sfx`-gated).
- Now-playing widget stays; the turntable label reflects play/pause for a11y.

## Art needed (union-bbox pipeline, per CLAUDE.md STYLE)
- Turntable base (rest), platter with record, tonearm in two states (parked / on-record),
  and a short spin loop (2–4 frames) while playing. Frames extracted via a new
  `scripts/extract-turntable.mjs` to a shared union bbox; lighting variants via
  `npm run lighting`.

## Wiring
- Reuse `RoomAudioProvider` (`playing`, `toggle`, skip). The turntable is a new
  `objects.ts` entry + a component like `RoomSpeakers` but with play/pause/skip affordances.
- Speaker mute-toggle behaviour ⟨DECIDE⟩: remove it (turntable is the control) or keep as a
  secondary mute. Default: keep speakers as art only; mute lives on the turntable + NowPlaying.

## Acceptance criteria
- [ ] Turntable plays/pauses/skips the existing playlist; NowPlaying stays in sync.
- [ ] Needle/arm states animate; spin loops while playing; holds when paused.
- [ ] Optional crackle loops only while playing and only when `sfx` on.
- [ ] Reduced-motion: audio still plays, spin animation still plays (site rule); EN+FR; builds.

## Blocked on
Ahmed's turntable sprites + (optional) a `vinyl-crackle` audio file.

---

# SPEC 6 — Life & atmosphere  ⟨needs art + API⟩

**Goal:** make the room feel alive — a cat, real weather at the window, and a night sky.
Largest phase; split into 6a/6b/6c, each shippable alone.

## 6a. Cat on the bed  ⟨needs art⟩
- Sleeping loop on the bed; click → wake/stretch → resettle. Rest position varies by
  `visitCount`. Optional purr ⟨needs a `purr` audio file⟩ via Spec 2 system.
- Art: sleep loop (2–3 frames), stretch/wake sequence (4–6 frames), maybe a sit pose.
  New `objects.ts` entry + `AnimatedSprite` (loop + play-once on click). Union-bbox extract.
- Unlocks a `cat` discovery (Spec 3).

## 6b. Real-weather window  ⟨needs API + light art⟩
- **Data:** an Open-Meteo route (`src/app/api/weather/route.ts` — note: re-introduces one
  API route after the Spec-1 backend purge; keep it read-only, cached, no secrets — Open-Meteo
  needs no key). **LOCKED: fixed Canberra** (no geolocation, no consent, no privacy-policy
  change needed).
- **Cache:** hourly (`revalidate = 3600`); fail-soft to "clear".
- **Render:** rain/snow overlay over the window rect; intensity from the weather code. CSS
  particle overlay (cheap) or a few sprite frames ⟨light art, optional⟩. Ties into the
  existing time-of-day lighting (already scaffolds tint).

## 6c. Night sky + car-light sweeps  ⟨light art / CSS⟩
- At the `night` lighting state, show moon + a few stars behind the window, and an occasional
  headlight sweep across the wall (a soft moving gradient band, ~every 20–40 s). Mostly CSS;
  emissive layers are never lighting-graded (existing invariant).
- Unlocks a `night` discovery if the visitor is there after dark.

## Dependencies / risks
- Art: cat frames (6a), optional rain/snow sprites (6b).
- API: Open-Meteo (6b) — the only server code re-added; document it in CLAUDE.md and the
  privacy policy (aggregate weather, no personal data, fixed location).
- Keep each sub-phase independently shippable.

## Acceptance criteria (per sub-phase)
- [ ] 6a: cat sleeps, wakes on click, resettles; position varies by visit; EN+FR label; builds.
- [ ] 6b: window shows current Canberra precipitation, hourly-cached, fail-soft; privacy
      policy updated; builds.
- [ ] 6c: night state shows moon/stars + periodic light sweep; emissive layers ungraded; builds.

## Blocked on
Ahmed's cat sprites (6a) and optional weather sprites (6b). 6c can proceed on CSS alone.

---

# SPEC 7 — Settings app (home for the SFX toggle & prefs)

**Goal:** a small desktop **Settings** app that surfaces the room preferences that currently
have no UI — starting with the SFX toggle/volume decided in Spec 2.

## Scope
- New `screenMode: 'settings'` + `DeskSettings.tsx` + a desktop icon (needs a `settings`
  dictionary group + a 16×16 gear `ICON_SETTINGS`).
- Rows (each reads/writes `room-save-v1`):
  - **SFX** on/off + volume (Spec 2 prefs `sfx`, `sfxVolume`).
  - **Music volume** (existing `volume` pref — mirror the NowPlaying slider).
  - **Clock** 12/24h (existing `clock24h`).
  - ⟨DECIDE⟩ **Reduced-motion opt-out**: a "calm mode" toggle for motion-sensitive visitors
    (the site forces motion on by default; this would let them opt back into reduced motion).
    Default: include it — it's the accessible complement to the always-on-motion policy.
  - ⟨FUTURE⟩ wallpaper picker (roadmap item 9) once wallpapers exist.
- Escape ladder app→desktop→room like every other app; EN + FR.

## Sequencing
Can land any time after Spec 2 (it consumes Spec 2's prefs). Reasonable to slot as Spec 3.5
or bundle with Spec 3 (discoverability) since both are no-art UI work.

## Acceptance criteria
- [ ] Settings app opens from a desktop icon; toggling SFX silences/enables the Spec 2 sounds.
- [ ] Music volume, clock format persist and reflect elsewhere immediately.
- [ ] Optional calm-mode toggle actually reduces motion when on; EN+FR; builds.

---

## Cross-cutting notes
- Every phase keeps the **bilingual** rule (en.ts + fr.ts same commit) and the **localStorage-
  only** persistence rule (no DB); the sole server re-addition is the Open-Meteo route in 6b.
- SFX/ambient audio all route through the Spec 2 `SfxProvider` (one audio-effects home).
- Discoveries (Spec 3) accumulate across later phases (cat, night, terminal, record player).
- After each phase: update `CLAUDE.md` (state + session note) and fold results into `todo.md`.
