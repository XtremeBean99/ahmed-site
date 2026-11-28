/**
 * Sprite frames held in memory, so animating an <img> never touches the network after first load.
 *
 * Frames swap by changing one <img>'s src, and public/ is served with max-age=0. Pointed at the file, a swap
 * can revalidate over the network; a frame shorter than that round trip is cancelled before it arrives and
 * asked for again on every loop. Preloading with Image() does not prevent it: the browser's reuse rules do
 * not cover every swap. A blob: URL cannot reach the network at all.
 *
 * Each page load fetches (and so revalidates) every frame once: redrawn sprites, whose filenames are not
 * hashed, still reach visitors.
 *
 * Use both for any <img> that animates: loadSprites() every frame in an effect, and render spriteSrc(path).
 * Every frame swap is a re-render, so no subscription is needed to pick up the copies as they arrive.
 */
const copies = new Map<string, string>()
const asked = new Set<string>()

export function loadSprites(paths: readonly string[]): void {
  for (const path of paths) {
    if (asked.has(path)) continue
    asked.add(path)
    // Low priority: the room's backgrounds come first.
    fetch(path, { priority: 'low' })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`${res.status} ${path}`))))
      .then((blob) => { copies.set(path, URL.createObjectURL(blob)) })
      .catch(() => { asked.delete(path) })
  }
}

/** What an animating <img> should show for `path`: the copy in memory, or the file until that arrives. */
export const spriteSrc = (path: string): string => copies.get(path) ?? path
