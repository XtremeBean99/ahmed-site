/**
 * iOS ignores HTMLMediaElement.volume (only the hardware buttons change it), so a
 * volume slider there does nothing. A probe that will not keep 0.5 means read-only.
 */
export function isMediaVolumeReadOnly(probe?: { volume: number }): boolean {
  const p = probe ?? (typeof Audio === 'undefined' ? null : new Audio())
  if (!p) return false
  try {
    p.volume = 0.5
    return p.volume !== 0.5
  } catch {
    return true
  }
}
