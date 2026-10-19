#!/usr/bin/env bash
# Encodes the room playlist for the web: assets/audio/<id>.mp3 (the 128 kbps
# masters, not deployed) -> public/audio/<id>.m4a, AAC-LC 96 kbps stereo, embedded
# cover art dropped (covers live in public/audio/covers/), moov atom at the front so
# playback can start before the whole file arrives. AAC in MP4 plays in every browser.
#
#   bash scripts/encode-audio.sh            # every track
#   bash scripts/encode-audio.sh some.mp3   # one track
set -euo pipefail
cd "$(dirname "$0")/.."
src=assets/audio
out=public/audio
# Read the list into a variable first: under pipefail, `grep -q` closing the pipe early
# would fail the check through ffmpeg's SIGPIPE.
encoders=$(ffmpeg -hide_banner -encoders 2>/dev/null)
if [[ $encoders == *libfdk_aac* ]]; then
  codec=(-c:a libfdk_aac -b:a 96k)
else
  codec=(-c:a aac -b:a 112k) # the native encoder needs a little more rate for the same quality
fi
files=("$@")
[ ${#files[@]} -eq 0 ] && files=("$src"/*.mp3)
for f in "${files[@]}"; do
  name=$(basename "$f" .mp3)
  ffmpeg -hide_banner -loglevel error -y -i "$src/$name.mp3" -map 0:a:0 -map_metadata -1 \
    "${codec[@]}" -movflags +faststart "$out/$name.m4a"
  echo "$name.m4a $(du -h "$out/$name.m4a" | cut -f1)"
done
