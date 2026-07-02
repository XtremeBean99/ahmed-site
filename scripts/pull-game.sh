#!/bin/bash
## Pull the latest Super Ninja Monk Fighter IV web build from the beam repo
## and place it into public/games/ninja/ so the embedded game on the site
## always matches the latest commit on main.
##
## Usage:  bash scripts/pull-game.sh
##
## The script fetches the two large binary files (index.pck + index.wasm) from
## GitHub Releases (or raw if releases aren't set up yet) and copies the small
## source files from the beam repo if available locally.
##
## Prerequisites:
##   - GitHub CLI (`gh`) installed and authenticated, OR
##   - A GITHUB_TOKEN env var set for API access

set -euo pipefail

DEST="public/games/ninja"
BEAM_REPO="XtremeBean99/beam"
BEAM_BRANCH="main"

echo "=== Pulling latest beam build ==="

# --- Fetch small files from raw GitHub (they're tracked in the repo) ---
SMALL_FILES=(
  "index.html"
  "index.js"
  "index.audio.worklet.js"
  "index.audio.position.worklet.js"
  "index.icon.png"
  "index.apple-touch-icon.png"
  "index.png"
)

for f in "${SMALL_FILES[@]}"; do
  echo "  → $f"
  curl -sSfL "https://raw.githubusercontent.com/${BEAM_REPO}/${BEAM_BRANCH}/build/web/${f}" -o "${DEST}/${f}"
done

# --- Fetch large binary files from GitHub Releases ---
# If a release exists, download from there. Otherwise fall back to a message.
LARGE_FILES=("index.pck" "index.wasm")

for f in "${LARGE_FILES[@]}"; do
  # Try GitHub Releases first (latest release)
  RELEASE_URL="https://github.com/${BEAM_REPO}/releases/latest/download/${f}"
  echo "  → $f (trying release)..."
  if curl -sSfL "${RELEASE_URL}" -o "${DEST}/${f}" 2>/dev/null; then
    echo "    ✓ downloaded from release"
  else
    echo "    ⚠ No release found. Download manually from the beam repo build/web/ directory."
    echo "      Copy beam/build/web/${f} → website/ahmed-site/public/games/ninja/${f}"
  fi
done

echo "=== Done ==="
echo "Game files in ${DEST}/ are ready for the next deploy."
