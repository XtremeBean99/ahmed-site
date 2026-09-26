export type ShortcutIntent =
  | 'roll'
  | 'endTurn'
  | 'buildRoad'
  | 'buildSettlement'
  | 'buildCity'
  | 'buyDev'
  | 'trade'
  | 'playCard'
  | 'undo'
  | 'hint'
  | 'log'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'
  | 'cancel'
  | 'help'

export interface ShortcutKeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const SHIFTED_KEYS = new Set(['+', '=', '_', '?'])

/** Maps a raw key event to a game intent, ignoring any combination except Ctrl+Z and Shift for + and ?. */
export function intentForKey(event: ShortcutKeyLike): ShortcutIntent | null {
  const key = event.key.toLowerCase()
  const ctrl = event.ctrlKey
  const meta = event.metaKey
  const alt = event.altKey
  if (ctrl && !meta && !alt && !event.shiftKey && key === 'z') return 'undo'
  if (ctrl || meta || alt) return null
  if (event.shiftKey && !SHIFTED_KEYS.has(key)) return null
  switch (key) {
    case 'r':
      return 'roll'
    case 'e':
      return 'endTurn'
    case '1':
      return 'buildRoad'
    case '2':
      return 'buildSettlement'
    case '3':
      return 'buildCity'
    case '4':
      return 'buyDev'
    case 't':
      return 'trade'
    case 'p':
      return 'playCard'
    case 'u':
      return 'undo'
    case 'h':
      return 'hint'
    case 'l':
      return 'log'
    case 'escape':
      return 'cancel'
    case '+':
    case '=':
      return 'zoomIn'
    case '-':
    case '_':
      return 'zoomOut'
    case '0':
      return 'zoomFit'
    case '?':
      return 'help'
    default:
      return null
  }
}
