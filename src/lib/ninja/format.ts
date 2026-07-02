/** Format centiseconds as M:SS.cc - mirrors the game's HUD clock format. */
export function formatTimeCs(timeCs: number): string {
  const m = Math.floor(timeCs / 6000)
  const s = Math.floor((timeCs % 6000) / 100)
  const cs = timeCs % 100
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
