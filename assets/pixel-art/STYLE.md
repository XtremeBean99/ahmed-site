# Pixel Art Style Guide

## Palette (warm dusk bedroom)
- Background wall: warm grey-brown (#4a3e3a area)
- Wood desk: #6b4d3a, #5a3d2a, #4a3020
- Floor: #3a2820, #2a1a10
- Lamp light: warm amber/gold cast on surfaces
- Window light: cool dusk blue from right side
- Bezel/screen dark: #2a2220, #181618

## Outline rules
- Clean 1-pixel outlines in darker shade of the fill
- No anti-aliasing (hard edges)
- Consistent light direction: lamp from left, window from right

## Sprite format
- RGBA PNG with transparency
- Target: public/room/ via extraction scripts in ahmed-site/scripts/
- Extraction: compute union bounding box across frames, pad 2px, crop identically
- Render with image-rendering: pixelated, never through next/image

## Font
- Minecraft.ttf (fan recreation, free for personal use)
- Source: downloaded from a Minecraft font resource
- Located in ahmed-site/src/fonts/
- Loaded via next/font/local with variable --font-pixel
- Fallback: "Courier New", monospace

## Extracted sprites
every sprite below is a trim of a source in sources/ at the listed stage rect.
- poster-1..5: kitagawa/kitagawa1..5.png → union box (997,78) 134×247
- monitor-desk: sources/monitor-keyboard-mouse.png → (240,261) 393×343
- bonsai-1..5: bonsai/tree1..5.png → union box (1241,291) 99×131
- desk-closeup: sources/desk-closeup.png → full 1408×768 (no crop)
- background-lamp-off: background_lamp_off.png → full 1408×768 (no crop)
- mouse: sources/mouse-only-closeup.png → trim (1007,608) 110×80
- speaker-left: desk-closeup crop → (190,265) 175×300
- speaker-right: desk-closeup crop → (1005,270) 215×300
- note-1: music-note1.png trim → 16×22
- note-2: music-note2.png trim → 21×22
- note-3: music-note3.png trim → 16×22
- coffee-1..6: sources/cofee-cup/coffecup-bedroom.png (rest) + coffecup-bedroom1..5.png
  (hover highlight) → union box (160,475) 83×83. Frame 1 is the rest state.
- coffee-steam: sources/cofee-cup/cofee-steam-bedroom.png trim → (187,460) 25×45.
  Animated as three staggered CSS wisps (steam-rise keyframes), not a sprite sheet.
- coffee-cup: superseded by coffee-1..6 (single-frame extraction, kept for reference)

## Speaker driver holes (stage coords, for the music-note emitter)
- Left speaker: tweeter (284,349) r34, woofer (284,478) r50
- Right speaker: tweeter (1118,352) r38, woofer (1115,472) r52
Notes spawn on random points around these rims at a constant rate (MusicNotes.tsx).
