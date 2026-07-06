# SPEC v5: Polish Pass — Notes From the Drivers, Steam, Embed Fix, Saffron

Written 6 July 2026. Supersedes SPEC v4 (retired). Unlike earlier specs, v5 was **implemented directly during the review session**; this document records the assessment of v4's implementation, what was changed and why, and what remains for the owner to do. Sections marked ⚠ OWNER ACTION cannot be completed from the sandbox.

---

## Part A: Assessment of the v4 implementation (commits `aa9db95` … `ca70b5b`)

Verified working and faithful to spec: reduced-motion crash fixed (provider always provides context), track-index ref fix, dictionary keys wired for speakers/now-playing/desk strip, in-monitor browsing implemented with `screenMode` state, `location.replace()` navigation, Desktop/Expand strip buttons, recursion guard, 700 px fallback, Escape ladder; music notes pooled and CSS-driven; speaker press-dip and muted glyph present; mouse follower disciplined. Two owner-initiated bonus commits (`5b38d48` coffee mug + steam, `ca70b5b` clock tooltip, lamp flicker, dust motes, mouse jitter, idle screensaver) are reasonable additions with one i18n slip (fixed below).

Defects found, all **fixed this session**:

**A1. In-monitor browsing was dead on arrival (owner-reported "embed fails").** `next.config.ts` sent `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` on every route, so Firefox/Chrome refused to render any page inside the monitor iframe. This was not a browser quirk but the site's own security headers. **Fixed:** `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` in `next.config.ts`, and `frame-ancestors 'none'` → `'self'` for the ninja static files in `vercel.json`. Third-party embedding remains blocked. CLAUDE.md now warns future agents not to "harden" this back.

**A2. Saffron track cannot play in production (owner-reported).** Git tracks `public/audio/Saffron.mp3` (capital S) while `playlist.ts` requests `/audio/saffron.mp3`. Windows' case-insensitive filesystem hides the mismatch in dev; Vercel's Linux serving 404s it. The MP3 itself is valid (checked frame sync). ⚠ OWNER ACTION — run in the repo root:
```
git mv public/audio/Saffron.mp3 public/audio/saffron-tmp.mp3
git mv public/audio/saffron-tmp.mp3 public/audio/saffron.mp3
git commit -m "fix: lowercase saffron.mp3 (case-sensitive serving on Vercel)"
```
(The two-step `git mv` is required on a case-insensitive filesystem.) CLAUDE.md now documents the class of bug.

**A3. Bonsai tooltip overflowed the viewport (owner-reported).** The tooltip bubble is centred over its object; the bonsai sits at stage x 1241–1340 near the right edge, so the bubble's right half rendered off-stage/off-screen. **Fixed:** `RoomObject` gained `tooltipAlign?: 'center' | 'right'` (bubble and arrow reposition; arrow stays over the object); `AnimatedSprite` forwards it; the bonsai uses `tooltipAlign="right"`.

**A4. Hardcoded English, fourth recurrence.** The clock tooltip rendered literal "It's {time}". **Fixed:** `room.clockTip` added to both dictionaries (EN `It's {time}`, FR `Il est {time}`), interface updated, component uses `.replace('{time}', …)`.

Also noted: concurrent edits landed in the working tree during this session (clock tooltip restyled into a bubble at (860,100), a placeholder adaptation of the new MusicNotes API). These were folded in rather than overwritten.

---

## Part B: Changes implemented this session

### B1. Music notes: constant rate, emitted from the actual driver holes
Owner request: notes should emit at a constant rate and emanate from random points around the speaker holes rather than one fixed point above each cabinet.

* `MusicNotes.tsx` rewritten. New API: `holes: SpeakerHole[]` (`{cx, cy, r}` per driver) + `startDelay`. Emission is now a **constant** 1100 ms interval with a **constant** 2000 ms float duration; only position and sprite are random.
* Spawn: random driver (tweeter or woofer), random angle, distance 0.7–1.0 × r — i.e. on or just inside the rim. Drift continues outward along the spawn angle (`cos(angle) × 14` ± jitter) then up 46–62 px, fading out.
* Driver holes measured from the art (dark-pixel centroid for the left cabinet; front-face estimate for the right, whose dark side panel skews centroids): left tweeter (284,349) r34, left woofer (284,478) r50; right tweeter (1118,352) r38, right woofer (1115,472) r52. Constants live at module level in `DeskView.tsx` (referential stability for the effect dependency).
* Pool grown to 4; `.note-float` CSS no longer references the removed `--delay` var. The two speakers stagger by 550 ms.

### B2. Coffee: highlight frames wired, steam rebuilt
* The five owner-supplied highlight frames (`coffecup-bedroom1–5.png`) plus the rest frame were extracted to `public/room/coffee-1.png … coffee-6.png` with a shared union bbox **(160, 475) 83×83** (2 px pad) so playback cannot jitter. `objects.ts` coffee entry updated (new rect + 6 frames).
* The mug is now an `AnimatedSprite` (hover/focus plays the highlight once and holds, reverts on leave, 90 ms/frame) with tooltip and focus ring, replacing the static `<img>`.
* Steam rebuilt: the single pulsing sprite became **three staggered wisps** of `coffee-steam.png` on new `steam-rise` keyframes — each rises ~46 px, sways via a per-wisp `--sway` custom property, expands 0.8→1.2 and fades, on desynchronised durations (2.8/3.6/3.1 s, negative delays so all are mid-cycle at load). Rendered *before* the mug so steam emerges from behind the rim. Old `coffee-steam` keyframes removed. Reduced motion: no steam (unchanged behaviour).

### B3. Embed headers (A1), bonsai tooltip (A3), clock i18n (A4) — as described in Part A.

### Files touched this session
`next.config.ts`, `vercel.json`, `src/lib/room/objects.ts`, `src/components/room/{MusicNotes,RoomObject,AnimatedSprite,Room,DeskView}.tsx`, `src/app/globals.css`, `src/lib/i18n/dictionaries/{en,fr}.ts`, `CLAUDE.md`, `assets/pixel-art/STYLE.md`, `docs/PLAN.md`, plus new `public/room/coffee-1..6.png`. `public/room/coffee-cup.png` is now unreferenced and may be deleted after verification.

---

## Part C: ⚠ OWNER ACTIONS and verification

The sandbox's view of the repo went stale repeatedly (phantom deletions, unremovable `.git/index.lock`), so nothing was built or committed from here. On your machine:

1. The saffron rename (commands in A2).
2. `npm run type-check && npm run lint && npm run build` — expected clean; the riskiest edits type-wise are the CSS custom properties cast in `Room.tsx` (`as React.CSSProperties`) and the new `MusicNotes` props.
3. Deploy preview, then verify:
   * In-monitor browsing now renders pages (the A1 header fix requires a deploy to test properly; locally `next dev` does not send the production headers, so test on the preview URL, in both Firefox and Chrome).
   * Saffron plays after skip-cycling to it on the deployed site.
   * Speaker notes: constant rhythm, spawning around both drivers of both cabinets, stopping on mute.
   * Coffee: hover plays the highlight and holds; steam shows three desynchronised wisps behind the rim; tooltip reads "Coffee mug"/"Tasse de café".
   * Bonsai tooltip fully on-screen at 1280×720 and 1920×1080.
   * Clock bubble shows the translated string in FR.
   * Reduced-motion sweep: no notes, no steam, everything functional.
4. Optional cleanup once verified: `git rm public/room/coffee-cup.png` and delete `docs/suggestions.txt` if no longer wanted.

---

## Part D: Suggested next improvements (carried and updated from v4)

1. **Desk session persistence** — restore the in-monitor page after Expand/refresh via `sessionStorage`.
2. **Wallpapers for the monitor desktop** — small settings icon on the desk screen, stored in prefs; pairs well with the idle screensaver that now exists.
3. **Window weather** — Open-Meteo API route with hourly caching; rain/snow overlays composited over the window; the time-of-day tint already provides the scaffolding.
4. **Cat on the bed** — the last big item from the original brief's object list; needs art in the established pipeline (union-bbox frames, objects.ts entry, AnimatedSprite).
5. **Interaction SFX** — separate `sfx` pref beside music; icon clicks, poster flip, lamp switch. The provider pattern extends naturally.
6. **Konami code → terminal screenMode** — the desk screen state machine (`desktop`/`browser`) makes a `terminal` mode a clean addition.
7. **Room OG image** — replace the text-card `opengraph-image.tsx` on `/` with a 1200×630 room crop.
8. **Bonsai growth by visit count** — 5 stages already drawn; a `visits` counter in prefs picks the resting frame.
9. **Playlist shuffle-avoid-repeat** — trivial: track history of last 2 indices in `nextTrack` so skip never repeats immediately.
10. **Analytics-free visit odometer** — a tiny pixel counter on the desk (localStorage only), pure nostalgia.
