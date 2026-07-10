const KEY = 'room-discoveries-v1'

export const DISCOVERY_IDS = [
  'lamp',
  'drawer',
  'clock',
  'music',
  'poster',
  'saitama',
  'bonsai',
  'coffee',
  'ipod',
  'paint',
  'minesweeper',
  'readme',
  'legal',
  'settings',
  'terminal',
  'screensaver',
] as const

export type DiscoveryId = (typeof DISCOVERY_IDS)[number]

export function getDiscoveries(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function addDiscovery(id: string): boolean {
  const set = getDiscoveries()
  if (set.has(id)) return false
  set.add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch {
    // silently ignore
  }
  return true
}
