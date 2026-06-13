# BREAKOUT_SPEC.md - "Xtreme Breakout" page (/breakout)

Build a complete Atari Breakout clone from scratch on a new page, with a PC-building
twist that fits this site's owner (Ahmed: 110+ custom PC builds as Xtreme Builds).
Pure TypeScript + canvas 2D in a client component. No game libraries.

## Page

- Route `src/app/breakout/page.tsx`, title "Breakout", plus `BreakoutGame.tsx`
  client component. Add "Breakout" to NAV_ITEMS in Nav.tsx (before Contact).
- Match the site's dark theme (bg #0a0a0f, teal #2dd4bf, amber #f59e0b accents).
- Intro line above the canvas: "Every brick is a PC part. Build the rig by
  breaking it. Yes, that is backwards. It is more fun this way."

## Core game (classic rules first, get these right)

- Canvas 800x600 logical, responsive scale to container, devicePixelRatio aware
- Paddle: mouse, touch drag, and arrow keys; ball launches from paddle on
  click/space; 3 lives; score; pause (P or blur); restart
- Ball physics: angle depends on paddle hit position; speed increases 4% per
  10 bricks; reliable AABB collision (no tunnelling: substep when fast)
- Brick grid styled as a motherboard: rows are labelled component types
  (VRM, RAM, PCIe, SATA, I/O), 8 columns x 5 rows, 1-3 hit points by row,
  drawn as PCB-like rectangles with pin details, not flat blocks

## The twist: build-a-PC progression + component drops

1. Destroyed bricks sometimes (18% chance) drop a falling component the paddle
   can catch:
   - Thermal Paste (white blob): ball sticks to paddle on next catch; re-aim and
     relaunch
   - RGB Kit (cycling colours): multiball, splits ball into 3; visuals go RGB
   - Overclock (amber lightning): ball speed +40% for 10s, score x2 while active
   - Water-Cooling Leak (blue droplet, BAD: 12% of drops): catching it floods
     the paddle for 4s, paddle width halves and controls feel slippery
     (momentum); dodging it is the point
2. Boss brick: centre of the top row is "i7 2600K", 6 hit points, flashes on
   hit. When it dies, show "POST OK" and the level is won even if bricks remain.
3. Every 45 seconds a "OneDrive sync" event fires for 5 seconds: controls
   invert, a small toast says "OneDrive is syncing your paddle...". A
   self-deprecating joke the owner will appreciate. Telegraph it with a 2s
   countdown so it is fair.
4. Side panel (right of canvas on desktop, below on mobile) shows "BUILD
   PROGRESS": a parts list (PSU, RAM, GPU, CPU...) that ticks off as each brick
   row is cleared. Clearing the level = "PC BOOTED."

## Polish

- High score in localStorage (key `xtreme-breakout-hiscore`)
- Sound optional and OFF by default (WebAudio bleeps, a visible mute toggle)
- prefers-reduced-motion: no screen shake, no particle bursts; game still works
- Pause when tab hidden; never trap keyboard focus; ESC releases
- 60fps target; all state in refs, React renders only HUD

## Done when

- `npm run build` passes with zero errors and the page plays correctly with
  mouse, keyboard and touch
- Update TESTING.md with a Breakout section listing the checks you performed
