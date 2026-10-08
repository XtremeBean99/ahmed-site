// src/components/room/mahjong/tile-info.ts
import { parseTile } from '@/lib/games/mahjong-tiles'

/** Copy for the tile tooltips and the tile guide; lives in en.ts `desk.mahjongApp.tileInfo`. */
export interface TileInfoLabels {
  dots: { name: string; note: string }
  bamboo: { name: string; note: string; bird: string }
  characters: { name: string; note: string }
  /** Pinyin for 1 to 9, read off the character tiles. */
  numerals: string[]
  winds: { name: string; pinyin: string }[]
  windNote: string
  dragons: { name: string; pinyin: string; meaning: string }[]
  dragonNote: string
  flowers: string[]
  flowerName: string
  seasons: { name: string; pinyin: string }[]
  seasonName: string
  bonusNote: string
  suitNote: string
  /** What the tile does in Solitaire: plain tiles, then flowers and seasons. */
  matchSame: string
  matchBonus: string
  /** Kind tags shown in the tooltip's corner. */
  kinds: { suit: string; honour: string; bonus: string }
}

export interface TileInfo {
  /** The characters printed on the tile, if any. */
  glyph: string
  pinyin: string
  name: string
  /** What the picture means. */
  meaning: string
  kind: 'suit' | 'honour' | 'bonus'
  /** How it plays in 4-player and in Solitaire. */
  play: string
  match: string
}

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const WIND_CHARS = ['', '東', '南', '西', '北']
const DRAGON_CHARS = ['', '中', '發', '白']
const SEASON_CHARS = ['', '春', '夏', '秋', '冬']

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

/** Everything a visitor who does not read Chinese needs to know about one tile. */
export function tileInfo(code: string, l: TileInfoLabels): TileInfo | null {
  const k = parseTile(code)
  if (!k) return null
  const n = k.rank
  switch (k.suit) {
    case 'dots':
      return { glyph: '', pinyin: '', name: fill(l.dots.name, { n }), meaning: l.dots.note, kind: 'suit', play: l.suitNote, match: l.matchSame }
    case 'bamboo':
      return { glyph: '', pinyin: '', name: fill(l.bamboo.name, { n }), meaning: n === 1 ? l.bamboo.bird : l.bamboo.note, kind: 'suit', play: l.suitNote, match: l.matchSame }
    case 'characters':
      return {
        glyph: `${NUMERALS[n]}萬`,
        pinyin: `${l.numerals[n - 1]} wàn`,
        name: fill(l.characters.name, { n }),
        meaning: fill(l.characters.note, { glyph: NUMERALS[n], pinyin: l.numerals[n - 1], n }),
        kind: 'suit',
        play: l.suitNote,
        match: l.matchSame,
      }
    case 'winds': {
      const w = l.winds[n - 1]
      return { glyph: WIND_CHARS[n], pinyin: w.pinyin, name: w.name, meaning: '', kind: 'honour', play: l.windNote, match: l.matchSame }
    }
    case 'dragons': {
      const d = l.dragons[n - 1]
      return { glyph: DRAGON_CHARS[n], pinyin: d.pinyin, name: d.name, meaning: d.meaning, kind: 'honour', play: l.dragonNote, match: l.matchSame }
    }
    case 'flowers':
      return { glyph: '', pinyin: '', name: fill(l.flowerName, { name: l.flowers[n - 1], n }), meaning: '', kind: 'bonus', play: l.bonusNote, match: l.matchBonus }
    case 'seasons': {
      const s = l.seasons[n - 1]
      return { glyph: SEASON_CHARS[n], pinyin: s.pinyin, name: fill(l.seasonName, { name: s.name, n }), meaning: '', kind: 'bonus', play: l.bonusNote, match: l.matchBonus }
    }
  }
}
