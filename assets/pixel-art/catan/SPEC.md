# Catan board sprite contract

All files are PNG RGBA at 1x; one image pixel equals one logical board pixel. Alpha 0 means empty. The tile mask is the canonical hex pixel mask measured by the integer lattice (every island hex has the identical mask).

## Grid

- Canvas: 279 x 265 logical pixels
- Hex centre (axial q, r): x = 139 + 38q + 19r, y = 132 + 33r
- Centre spacing: 38 px horizontally, row step 33 px, row offset 19 px
- Corner offsets from a hex centre (corner order i0..i5): (19,-11), (19,11), (0,22), (-19,11), (-19,-11), (0,-22)
- Sea border: 44 px on all sides of the island vertex span
- Tile mask: 38 x 43, anchor (19, 21)

## Files

| File | Size | Anchor | Placed on | Recolor |
|---|---|---|---|---|
| sea.png | 279 x 265 | (0, 0) | board origin (0,0) | no |
| tile-brick.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-lumber.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-wool.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-grain.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-ore.png | 38 x 43 | (19, 21) | hex centre | no |
| tile-desert.png | 38 x 43 | (19, 21) | hex centre | no |
| token-2.png | 11 x 11 | (5, 5) | hex centre | no |
| token-3.png | 11 x 11 | (5, 5) | hex centre | no |
| token-4.png | 11 x 11 | (5, 5) | hex centre | no |
| token-5.png | 11 x 11 | (5, 5) | hex centre | no |
| token-6.png | 11 x 11 | (5, 5) | hex centre | no |
| token-8.png | 11 x 11 | (5, 5) | hex centre | no |
| token-9.png | 11 x 11 | (5, 5) | hex centre | no |
| token-10.png | 11 x 11 | (5, 5) | hex centre | no |
| token-11.png | 11 x 11 | (5, 5) | hex centre | no |
| token-12.png | 11 x 11 | (5, 5) | hex centre | no |
| robber.png | 7 x 10 | (3, 4) | hex centre | no |
| settlement.png | 9 x 9 | (4, 4) | vertex point | yes |
| city.png | 13 x 11 | (6, 5) | vertex point | yes |
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

## Player-colour key

Recolor sprites use exactly #FF00FF (base), #FF80FF (highlight) and #800080 (shade). The renderer replaces them with the player's base colour, mix(base, white, 0.4) and mix(base, black, 0.55). Every other colour is drawn as-is.

## Workflow

1. Edit the PNG in `assets/pixel-art/catan/` at exactly the listed size (do not change the canvas size or anchor).
2. Run `npm run catan-sprites` to validate and copy the art to `public/catan/`.
3. Rebuild. To regenerate the procedural templates, run `npm run catan-sprites:export -- --force`.
