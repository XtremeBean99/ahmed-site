# Catan board sprite contract

All files are PNG RGBA at 1x; one image pixel equals one logical board pixel. Alpha 0 means empty. The tile mask is the canonical hex pixel mask measured by the integer lattice (every island hex has the identical mask).

## Grid

- Canvas: 279 x 265 logical pixels
- Hex centre (axial q, r): x = 139 + 38q + 19r, y = 132 + 33r
- Centre spacing: 38 px horizontally, row step 33 px, row offset 19 px
- Corner offsets from a hex centre (corner order i0..i5): (19,-11), (19,11), (0,22), (-19,11), (-19,-11), (0,-22)
- Sea border: 44 px on all sides of the island vertex span
- Tile mask: 38 x 43, anchor (19, 21)

## Sea and shoreline

The canvases are transparent outside the island. The sea is not composited into the board; the viewport fills with `sea.png` as a CSS background tiled from the board origin at the camera scale. A procedural shoreline is drawn on the static layer around the island's outer edge: 1 px #1a1410 just outside the land, then 1 px #cfe3ea foam outside that.

## Files

| File | Size | Anchor | Placed on | Recolor |
|---|---|---|---|---|
| sea.png | 32 x 32 | (0, 0) | CSS sea tile from board origin, tiled (not composited) | no |
| tile-brick.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-lumber.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-wool.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-grain.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-ore.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-desert.png | 38 x 43 | (19, 21) | hex centre | no |
| token-2.png | 13 x 13 | (6, 6) | hex centre | no |
| token-3.png | 13 x 13 | (6, 6) | hex centre | no |
| token-4.png | 13 x 13 | (6, 6) | hex centre | no |
| token-5.png | 13 x 13 | (6, 6) | hex centre | no |
| token-6.png | 13 x 13 | (6, 6) | hex centre | no |
| token-8.png | 13 x 13 | (6, 6) | hex centre | no |
| token-9.png | 13 x 13 | (6, 6) | hex centre | no |
| token-10.png | 13 x 13 | (6, 6) | hex centre | no |
| token-11.png | 13 x 13 | (6, 6) | hex centre | no |
| token-12.png | 13 x 13 | (6, 6) | hex centre | no |
| robber.png | 9 x 13 | (4, 6) | hex centre | no |
| settlement.png | 11 x 11 | (5, 5) | vertex point | yes |
| city.png | 15 x 13 | (7, 6) | vertex point | yes |
| road-vertical.png | 5 x 21 | (2, 10) | edge midpoint rounded down | yes |
| road-rising.png | 18 x 12 | (8, 5) | edge midpoint rounded down | yes |
| road-falling.png | 18 x 12 | (8, 5) | edge midpoint rounded down | yes |
| harbor-any.png | 15 x 11 | (0, 0) | harbor plate rect origin | no |
| harbor-brick.png | 22 x 11 | (0, 0) | harbor plate rect origin | no |
| harbor-lumber.png | 22 x 11 | (0, 0) | harbor plate rect origin | no |
| harbor-wool.png | 22 x 11 | (0, 0) | harbor plate rect origin | no |
| harbor-grain.png | 22 x 11 | (0, 0) | harbor plate rect origin | no |
| harbor-ore.png | 22 x 11 | (0, 0) | harbor plate rect origin | no |
| pier-vertical.png | 3 x 25 | (1, 12) | seaward-offset edge midpoint | no |
| pier-rising.png | 22 x 14 | (10, 6) | seaward-offset edge midpoint | no |
| pier-falling.png | 22 x 14 | (10, 6) | seaward-offset edge midpoint | no |
| tile-mask.png | 38 x 43 | (19, 21) | guide only, not rendered | no |

## Changed in v3

- sea.png: 279 x 265 full-canvas sprite became a 32 x 32 seamless tile, anchor (0, 0), used only as a tiled CSS background.
- token-*.png: 11 x 11 became 13 x 13, anchor (5, 5) became (6, 6).
- settlement.png: 9 x 9 became 11 x 11, anchor (4, 4) became (5, 5).
- city.png: 13 x 11 became 15 x 13, anchor (6, 5) became (7, 6).
- robber.png: 7 x 10 became 9 x 13, anchor (3, 4) became (4, 6).
- Harbour plates moved 6 px closer to the coast (label offset 28 to 22); roads, piers and harbour plate sizes are unchanged.

## Player-colour key

Recolor sprites use exactly #FF00FF (base), #FF80FF (highlight) and #800080 (shade). The renderer replaces them with the player's base colour, mix(base, white, 0.4) and mix(base, black, 0.55). Every other colour is drawn as-is.

## UI sprites

UI sprites are PNG RGBA at 1x with a 1 px dark outline (#1a1410) and the same warm room palette. They are never tinted by the renderer; red/blue player colours shown in the UI are baked into the art where needed.

| File | Size | Where it appears | UI integer scales |
|---|---|---|---|
| card-brick.png | 24 x 34 | player hand card | 1x, 2x |
| card-lumber.png | 24 x 34 | player hand card | 1x, 2x |
| card-wool.png | 24 x 34 | player hand card | 1x, 2x |
| card-grain.png | 24 x 34 | player hand card | 1x, 2x |
| card-ore.png | 24 x 34 | player hand card | 1x, 2x |
| card-knight.png | 24 x 34 | player hand card | 1x, 2x |
| card-road-building.png | 24 x 34 | player hand card | 1x, 2x |
| card-year-of-plenty.png | 24 x 34 | player hand card | 1x, 2x |
| card-monopoly.png | 24 x 34 | player hand card | 1x, 2x |
| card-victory-point.png | 24 x 34 | player hand card | 1x, 2x |
| card-longest-road.png | 24 x 34 | Longest Road award (victory display) | 1x, 2x |
| card-largest-army.png | 24 x 34 | Largest Army award (victory display) | 1x, 2x |
| card-back-resource.png | 24 x 34 | resource deck back | 1x, 2x |
| card-back-development.png | 24 x 34 | development deck back | 1x, 2x |
| die-1.png | 16 x 16 | dice (roll and dice history) | 1x, 2x |
| die-2.png | 16 x 16 | dice (roll and dice history) | 1x, 2x |
| die-3.png | 16 x 16 | dice (roll and dice history) | 1x, 2x |
| die-4.png | 16 x 16 | dice (roll and dice history) | 1x, 2x |
| die-5.png | 16 x 16 | dice (roll and dice history) | 1x, 2x |
| die-6.png | 16 x 16 | dice (roll and dice history) | 1x, 2x |
| icon-brick.png | 8 x 8 | resource icons (costs, rates, bank) | 1x, 2x |
| icon-lumber.png | 8 x 8 | resource icons (costs, rates, bank) | 1x, 2x |
| icon-wool.png | 8 x 8 | resource icons (costs, rates, bank) | 1x, 2x |
| icon-grain.png | 8 x 8 | resource icons (costs, rates, bank) | 1x, 2x |
| icon-ore.png | 8 x 8 | resource icons (costs, rates, bank) | 1x, 2x |
| icon-vp.png | 8 x 8 | victory point totals | 1x, 2x |
| icon-knight.png | 8 x 8 | knight and army counts | 1x, 2x |
| icon-road.png | 8 x 8 | road costs and counts | 1x, 2x |
| icon-cards.png | 8 x 8 | development card deck | 1x, 2x |
| icon-dev.png | 8 x 8 | development card counts | 1x, 2x |

## Workflow

1. Edit the PNG in `assets/pixel-art/catan/` at exactly the listed size (do not change the canvas size or anchor).
2. Run `npm run catan-sprites` to validate and copy the art to `public/catan/`.
3. Rebuild. To regenerate the procedural templates, run `npm run catan-sprites:export` (add `--force` to overwrite art that already exists).
