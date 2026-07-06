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
