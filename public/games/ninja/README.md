# Super Ninja Monk Fighter IV — Web Build

The game files in this directory are the live web build of Super Ninja Monk
Fighter IV. To update them to the latest version from the beam repository:

```bash
bash scripts/pull-game.sh
```

## Manual update

After exporting from Godot (Project → Export → HTML5), copy all files from
`beam/build/web/` into this directory. Due to GitHub's file size limits, the
large `index.pck` file (which contains the game assets and music) must be
downloaded separately from the GitHub Releases page or copied manually.

## Files

| File | Purpose |
|---|---|
| index.html | Entry point |
| index.js | Godot engine + game logic |
| index.wasm | WebAssembly runtime |
| index.pck | Game assets and resources (large — downloaded from releases) |
| index.audio.worklet.js | Audio thread |
| index.icon.png | Favicon |
| index.apple-touch-icon.png | iOS home screen icon |

## Bug reports

Found a bug? Use the in-site bug report form on the game page
(`/games/ninja` or `/projects/ninja`), or email
ahmedyhussain07@gmail.com with:
- What happened
- Which level you were on
- What you were doing when it happened
