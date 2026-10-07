// src/components/room/mahjong/labels.ts
import type { LayoutId } from '@/lib/games/mahjong-solitaire'
import type { BotLevel } from '@/lib/games/mahjong-bot'

/** Every string the Mahjong desk app shows; the copy lives in en.ts `desk.mahjongApp`. */
export interface MahjongLabels {
  title: string
  // menu
  modeSolitaire: string
  modeFour: string
  resume: string
  resumeSolitaire: string
  resumeFour: string
  start: string
  layout: string
  layouts: Record<LayoutId, string>
  tilesCount: string
  dimBlocked: string
  best: string
  noBest: string
  bots: string
  levels: Record<BotLevel, string>
  minFaan: string
  minFaanValues: string[]
  rounds: string
  roundEast: string
  roundFull: string
  speed: string
  speedNormal: string
  speedFast: string
  autoPass: string
  record: string
  on: string
  off: string
  // solitaire
  board: string
  tiles: string
  time: string
  hint: string
  undo: string
  shuffle: string
  newGame: string
  noHint: string
  blocked: string
  free: string
  stuckTitle: string
  stuckBody: string
  clearedTitle: string
  clearedBody: string
  newBest: string
  playAgain: string
  menu: string
  close: string
  hintKeys: string
  tapHint: string
  // four player
  winds: string[]
  windRound: string
  handNo: string
  wall: string
  dealer: string
  you: string
  yourTurn: string
  waitingFor: string
  discard: string
  tsumo: string
  ron: string
  pung: string
  kong: string
  chow: string
  pass: string
  claimTitle: string
  kongAction: string
  claimKong: string
  ready: string
  log: Record<'discard' | 'chow' | 'pung' | 'kong' | 'concealedKong' | 'addKong' | 'bonus' | 'tsumo' | 'ron', string>
  melds: string
  flowers: string
  winTitle: string
  youWinTitle: string
  drawTitle: string
  drawBody: string
  selfDrawn: string
  offDiscard: string
  faan: string
  limit: string
  payments: string
  otherHands: string
  points: string
  nextHand: string
  seeTable: string
  matchOver: string
  placeLabels: string[]
  finalScores: string
  matchWinYou: string
  matchLose: string
  fourKeys: string
  fourTouch: string
  handAria: string
  riverAria: string
  seatAria: string
}
