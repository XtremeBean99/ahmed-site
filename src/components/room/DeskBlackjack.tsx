// src/components/room/DeskBlackjack.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ARCADE,
  ArcadeButton,
  ArcadeFrame,
  ArcadeOverlay,
  ArcadePanel,
  ArcadeStrip,
  FELT_STYLE,
  PIXEL_FONT,
  SCREEN_W,
  useFullscreen,
  type DeskGameProps,
} from './DeskArcade'
import { CARD_H, CARD_W, PlayingCard, cardUrl } from './PlayingCard'
import { cardName, type Card } from '@/lib/games/cards'
import {
  CHIP_VALUES,
  MIN_BET,
  addChip,
  canDouble,
  canSplit,
  clearBet,
  createTable,
  deal,
  dealerStep,
  double,
  handValue,
  hit,
  insure,
  isBlackjack,
  newBet,
  rebet,
  rebuy,
  split,
  stand,
  type BlackjackState,
  type Hand,
} from '@/lib/games/blackjack-engine'
import { BEST_KEYS, getBest, readJson, setBestIfHigher, writeJson } from '@/lib/games/storage'
import { useSfx } from './RoomSfxProvider'

const PLAY_W = SCREEN_W
const DEALER_Y = 10
const HAND_Y = 138
const HAND_Y_ACTIVE = 134
const STAKE_Y = 210
const CIRCLE = { x: 268, y: 222, r: 14 }
const SHOE_ORIGIN = { x: 493, y: 21 }

const STAGGER = 180
const FLY = 220
const FLIP = 200
const DEALER_STEP_MS = 450
const SETTLE_MS = 300
const SHUFFLE_BANNER_MS = 700

const CREAM = '#f4e8d0'

const CHIP_CIRCLE = [
  '..######..',
  '.########.',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '##########',
  '.########.',
  '..######..',
]
const CHIP_EDGE = new Set(['5,0', '6,0', '5,11', '6,11', '0,5', '0,6', '11,5', '11,6'])
const CHIP_RING = new Set(['5,3', '6,3', '3,5', '3,6', '5,8', '6,8', '8,5', '8,6', '4,4', '7,4', '4,7', '7,7'])

const chipBody = (value: number) =>
  value === 5 ? ARCADE.rust : value === 25 ? '#4a7a3a' : value === 100 ? '#2a2520' : '#6a3a6a'

function fewestChips(amount: number): number[] {
  const out: number[] = []
  let rest = Math.max(0, Math.floor(amount))
  for (const v of [500, 100, 25, 5]) {
    while (rest >= v) {
      out.push(v)
      rest -= v
    }
  }
  return out
}

function stackHeight(amount: number): number {
  const n = fewestChips(amount).length
  return n === 0 ? 0 : Math.min(n, 10) * 5 - 2
}

export interface BlackjackLabels {
  table: string
  bank: string
  best: string
  bet: string
  deal: string
  clear: string
  hit: string
  stand: string
  double: string
  split: string
  insurance: string
  yes: string
  no: string
  rebet: string
  newBet: string
  outOfChips: string
  rebuy: string
  shuffling: string
  blackjackPays: string
  dealerRule: string
  sixDecks: string
  soft: string
  chip: string
  hand: string
  handBlackjack: string
  handBust: string
  dealerShows: string
  dealerHand: string
  resultBlackjack: string
  resultWin: string
  resultPush: string
  resultBust: string
  resultLose: string
  resultDealerBust: string
  resultDealerBlackjack: string
  resultSplitWin: string
  resultSplitLoss: string
  resultSplitEven: string
}

const fmt = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function ChipSide({ value, top }: { value: number; top: number }) {
  return (
    <div className="absolute" style={{ left: 0, top, width: 12, height: 3, backgroundColor: chipBody(value) }}>
      <span className="absolute" style={{ left: 0, top: 0, width: 2, height: 2, backgroundColor: CREAM }} />
      <span className="absolute" style={{ right: 0, top: 0, width: 2, height: 2, backgroundColor: CREAM }} />
      <span className="absolute" style={{ left: 0, bottom: 0, width: 12, height: 1, backgroundColor: '#2a2520' }} />
    </div>
  )
}

function BetStack({ amount, left, top, zIndex = 1 }: { amount: number; left: number; top: number; zIndex?: number }) {
  if (amount <= 0) return null
  const chips = fewestChips(amount)
  const shown = chips.slice(0, 10)
  return (
    <div className="absolute" style={{ left, top, width: 12, height: shown.length * 5 - 2, zIndex }} aria-hidden>
      {shown.map((v, i) => (
        <ChipSide key={i} value={v} top={i * 5} />
      ))}
      {chips.length > 10 && (
        <span className="absolute" style={{ left: 13, top: shown.length * 5 - 11, ...PIXEL_FONT, fontSize: 8, color: ARCADE.feltText }}>
          +
        </span>
      )}
    </div>
  )
}

function ChipSvg({ value }: { value: number }) {
  const body = chipBody(value)
  const outline = value === 100 ? '#6a5a48' : '#2a2520'
  return (
    <svg width={24} height={24} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      {CHIP_CIRCLE.map((row, y) =>
        row.split('').map((cell, x) => {
          if (cell === '.') return null
          let fill = body
          if (CHIP_EDGE.has(`${x},${y}`) || CHIP_RING.has(`${x},${y}`)) fill = CREAM
          else {
            const edge =
              y === 0 || y === 11 || x === 0 || x === 11 ||
              (y > 0 && CHIP_CIRCLE[y - 1][x] === '.') ||
              (y < 11 && CHIP_CIRCLE[y + 1][x] === '.') ||
              (x > 0 && CHIP_CIRCLE[y][x - 1] === '.') ||
              (x < 11 && CHIP_CIRCLE[y][x + 1] === '.')
            if (edge) fill = outline
          }
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
        }),
      )}
    </svg>
  )
}

function ChipButton({
  value,
  label,
  title,
  disabled,
  onClick,
}: {
  value: number
  label: string
  title: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="flex flex-col items-center outline-none enabled:hover:brightness-110 enabled:active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[#e8d5b0]"
    >
      <ChipSvg value={value} />
      <span style={{ ...PIXEL_FONT, fontSize: 8, color: ARCADE.feltText }}>{value}</span>
    </button>
  )
}

/** The dealer hole card flips in place when it is revealed. */
function FlipCard({ card, revealed }: { card: Card; revealed: boolean }) {
  const reduce = useReducedMotion()
  const half = reduce ? 0 : FLIP / 2000
  return (
    <div className="relative" style={{ width: CARD_W, height: CARD_H }} aria-hidden>
      <motion.img
        src={cardUrl('back')}
        alt=""
        width={CARD_W}
        height={CARD_H}
        draggable={false}
        className="absolute left-0 top-0"
        style={{ imageRendering: 'pixelated' }}
        initial={false}
        animate={{ scaleX: revealed ? 0 : 1 }}
        transition={{ duration: half, ease: 'easeIn' }}
      />
      <motion.img
        src={cardUrl(card)}
        alt=""
        width={CARD_W}
        height={CARD_H}
        draggable={false}
        className="absolute left-0 top-0"
        style={{ imageRendering: 'pixelated' }}
        initial={false}
        animate={{ scaleX: revealed ? 1 : 0 }}
        transition={{ duration: half, delay: half, ease: 'easeOut' }}
      />
    </div>
  )
}

/** A card that flies from the shoe to its slot on the felt. */
function FlyCard({ card, slotX, slotY, delay }: { card: Card; slotX: number; slotY: number; delay: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="absolute"
      style={{ left: slotX, top: slotY }}
      initial={{ x: SHOE_ORIGIN.x - slotX, y: SHOE_ORIGIN.y - slotY, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration: reduce ? 0 : FLY / 1000, delay: reduce ? 0 : delay / 1000, ease: 'easeOut' }}
    >
      <PlayingCard card={card} alt="" />
    </motion.div>
  )
}

function DiscardTray({ discards }: { discards: number }) {
  const strips = Math.min(10, Math.floor(discards / 26))
  return (
    <div
      className="absolute"
      style={{ left: 14, top: 10, width: 30, height: 12, backgroundColor: ARCADE.panelDark, border: `1px solid ${ARCADE.panelBorder}` }}
      aria-hidden
    >
      {Array.from({ length: strips }, (_, i) => (
        <div
          key={i}
          style={{ position: 'absolute', left: 2, top: 19 - i, width: 26, height: 2, backgroundColor: ARCADE.rust, border: '1px solid #2a2520' }}
        />
      ))}
    </div>
  )
}

function Shoe({ label }: { label: string }) {
  return (
    <div className="absolute" style={{ left: 470, top: 8, width: 46, height: 34 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 3 + i,
            top: -4 + i,
            width: 40,
            height: 15,
            border: '1px solid #2a2520',
            backgroundImage: `url("${cardUrl('back')}")`,
            backgroundSize: '40px 56px',
            backgroundPosition: 'top',
            imageRendering: 'pixelated',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          width: 46,
          height: 16,
          backgroundColor: '#4a3222',
          border: '1px solid #2a1c12',
          borderTop: '1px solid #6a4a32',
        }}
      />
      <div className="absolute text-center" style={{ left: 0, top: 30, width: 46, ...PIXEL_FONT, fontSize: 8, color: ARCADE.feltText }}>
        {label}
      </div>
    </div>
  )
}

function ActivePointer({ centerX }: { centerX: number }) {
  return (
    <svg
      className="absolute"
      style={{ left: Math.round(centerX) - 3, top: HAND_Y_ACTIVE + CARD_H + 4 }}
      width={7}
      height={4}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x={3} y={0} width={1} height={1} fill={ARCADE.amber} />
      <rect x={2} y={1} width={3} height={1} fill={ARCADE.amber} />
      <rect x={1} y={2} width={5} height={1} fill={ARCADE.amber} />
      <rect x={0} y={3} width={7} height={1} fill={ARCADE.amber} />
    </svg>
  )
}

interface SaveShape {
  bankroll?: unknown
  handsPlayed?: unknown
  rebuys?: unknown
}

function loadSave(): { bankroll: number; handsPlayed: number; rebuys: number } | null {
  const raw = readJson('blackjack-save')
  if (!raw || typeof raw !== 'object') return null
  const save = raw as SaveShape
  const bankroll =
    typeof save.bankroll === 'number' && Number.isFinite(save.bankroll) && save.bankroll >= 0 && save.bankroll <= 10_000_000
      ? save.bankroll
      : null
  if (bankroll === null) return null
  const handsPlayed =
    typeof save.handsPlayed === 'number' && Number.isFinite(save.handsPlayed) && save.handsPlayed >= 0
      ? Math.floor(save.handsPlayed)
      : 0
  const rebuys =
    typeof save.rebuys === 'number' && Number.isFinite(save.rebuys) && save.rebuys >= 0 ? Math.floor(save.rebuys) : 0
  return { bankroll, handsPlayed, rebuys }
}

export function DeskBlackjack({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<BlackjackLabels>) {
  const fs = useFullscreen()
  const { tone } = useSfx()
  const reduce = useReducedMotion()
  const [table, setTable] = useState<BlackjackState>(() => {
    const save = loadSave()
    const fresh = createTable(Math.random, save?.bankroll ?? 1000)
    return { ...fresh, handsPlayed: save?.handsPlayed ?? 0, rebuys: save?.rebuys ?? 0 }
  })
  const [best, setBest] = useState(0)
  const [banner, setBanner] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [busy, setBusy] = useState(false)
  const [dealOrder, setDealOrder] = useState<Record<string, number>>({})
  const [dealSeq, setDealSeq] = useState(0)

  const tableRef = useRef(table)
  const busyRef = useRef(busy)
  const reduceRef = useRef(reduce)
  const bankrollBeforeRef = useRef(1000)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    tableRef.current = table
  }, [table])
  useEffect(() => {
    busyRef.current = busy
  }, [busy])
  useEffect(() => {
    reduceRef.current = reduce
  }, [reduce])

  useEffect(() => {
    setBest(getBest(BEST_KEYS.blackjack))
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const id of timers) window.clearTimeout(id)
    }
  }, [])

  const showResult = useCallback(
    (s: BlackjackState) => {
      const net = s.bankroll - bankrollBeforeRef.current
      const hands = s.hands
      let text: string
      if (hands.length === 1) {
        const hand = hands[0]
        const outcome = hand.outcome ?? 'lose'
        if (outcome === 'blackjack') text = labels.resultBlackjack.replace('{n}', fmt(hand.payout ?? 0))
        else if (outcome === 'win') {
          const dealerBust = handValue(s.dealer).total > 21
          text = (dealerBust ? labels.resultDealerBust : labels.resultWin).replace('{n}', fmt(hand.payout ?? 0))
        } else if (outcome === 'push') text = labels.resultPush
        else if (outcome === 'bust') text = labels.resultBust
        else if (s.dealer.length === 2 && handValue(s.dealer).total === 21) text = labels.resultDealerBlackjack
        else text = labels.resultLose
      } else {
        const won = hands.filter((h) => h.outcome === 'win' || h.outcome === 'blackjack').length
        const total = hands.length
        const tpl = net > 0 ? labels.resultSplitWin : net < 0 ? labels.resultSplitLoss : labels.resultSplitEven
        text = tpl.replace('{won}', String(won)).replace('{total}', String(total)).replace('{n}', fmt(Math.abs(net)))
      }
      setBanner(text)
      setAnnounce(text)
      if (net > 0) tone('win')
      else if (net < 0) tone('lose')
      else tone('select')
      setBestIfHigher(BEST_KEYS.blackjack, s.bankroll)
      setBest(getBest(BEST_KEYS.blackjack))
      writeJson('blackjack-save', { bankroll: s.bankroll, handsPlayed: s.handsPlayed, rebuys: s.rebuys })
    },
    [labels, tone],
  )

  const playDeal = useCallback(
    (resolved: BlackjackState) => {
      // A dealer blackjack resolved at deal time still shows the hole face down
      // until the four-card deal has landed, then flips it.
      const hideHole = resolved.phase === 'settled' && resolved.holeRevealed
      setDealOrder({ 'p0-0': 0, 'd-0': 1, 'p0-1': 2, 'd-1': 3 })
      setDealSeq((seq) => seq + 1)
      setTable(hideHole ? { ...resolved, holeRevealed: false } : resolved)
      const land = reduceRef.current ? 0 : STAGGER * 3 + FLY
      if (hideHole) {
        later(() => {
          tone('flip')
          setTable(resolved)
        }, land)
        later(() => {
          showResult(resolved)
          setBusy(false)
        }, land + (reduceRef.current ? 0 : FLIP) + (reduceRef.current ? 0 : SETTLE_MS))
      } else if (resolved.phase === 'settled') {
        later(() => {
          showResult(resolved)
          setBusy(false)
        }, land + (reduceRef.current ? 0 : SETTLE_MS))
      } else {
        later(() => setBusy(false), land)
      }
    },
    [later, showResult, tone],
  )

  const beginRound = useCallback(
    (resolved: BlackjackState) => {
      setBusy(true)
      setBanner(null)
      setAnnounce('')
      if (resolved.shuffled) {
        setBanner(labels.shuffling)
        tone('shuffle')
        later(() => {
          setBanner(null)
          playDeal(resolved)
        }, reduceRef.current ? 0 : SHUFFLE_BANNER_MS)
      } else {
        playDeal(resolved)
      }
    },
    [labels.shuffling, later, playDeal, tone],
  )

  const startDeal = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const resolved = deal(current, Math.random)
    if (resolved === current) return
    bankrollBeforeRef.current = current.bankroll
    beginRound(resolved)
  }, [beginRound])

  const doRebet = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const resolved = rebet(current, Math.random)
    if (resolved === current) return
    bankrollBeforeRef.current = current.bankroll
    beginRound(resolved)
  }, [beginRound])

  const doNewBet = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const next = newBet(current)
    if (next === current) return
    setBanner(null)
    setAnnounce('')
    tone('select')
    setTable(next)
  }, [tone])

  const doHit = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const next = hit(current, Math.random)
    if (next === current) return
    setBusy(true)
    tone('deal')
    setTable(next)
    later(() => setBusy(false), reduceRef.current ? 0 : FLY)
  }, [later, tone])

  const doStand = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const next = stand(current)
    if (next === current) return
    tone('select')
    setTable(next)
  }, [tone])

  const doDouble = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const next = double(current, Math.random)
    if (next === current) return
    setBusy(true)
    tone('deal')
    setTable(next)
    later(() => setBusy(false), reduceRef.current ? 0 : FLY)
  }, [later, tone])

  const doSplit = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const next = split(current, Math.random)
    if (next === current) return
    setBusy(true)
    tone('deal')
    setTable(next)
    later(() => setBusy(false), reduceRef.current ? 0 : FLY + 120)
  }, [later, tone])

  const doInsure = useCallback(
    (take: boolean) => {
      if (busyRef.current) return
      const current = tableRef.current
      const next = insure(current, take)
      if (next === current) return
      setBusy(true)
      tone(take ? 'chip' : 'select')
      setTable(next)
      if (next.phase === 'settled') {
        const wait =
          (next.holeRevealed && !current.holeRevealed ? (reduceRef.current ? 0 : FLIP) : 0) + (reduceRef.current ? 0 : SETTLE_MS)
        if (next.holeRevealed && !current.holeRevealed) tone('flip')
        later(() => {
          showResult(next)
          setBusy(false)
        }, wait)
      } else {
        later(() => setBusy(false), reduceRef.current ? 0 : 200)
      }
    },
    [later, showResult, tone],
  )

  const onChip = useCallback(
    (value: number) => {
      if (busyRef.current) return
      const current = tableRef.current
      const next = addChip(current, value)
      if (next === current) return
      tone('chip')
      setTable(next)
    },
    [tone],
  )

  const onClear = useCallback(() => {
    if (busyRef.current) return
    const current = tableRef.current
    const next = clearBet(current)
    if (next === current) return
    tone('select')
    setTable(next)
  }, [tone])

  const doRebuy = useCallback(() => {
    const current = tableRef.current
    const next = rebuy(current)
    if (next === current) return
    tone('score')
    setBanner(null)
    setAnnounce('')
    setTable(next)
    writeJson('blackjack-save', { bankroll: next.bankroll, handsPlayed: next.handsPlayed, rebuys: next.rebuys })
  }, [tone])

  // The dealer advances one visible change per tick so the UI can pace it.
  useEffect(() => {
    if (table.phase !== 'dealer' || busy) return
    const id = window.setTimeout(() => {
      const current = tableRef.current
      const next = dealerStep(current, Math.random)
      if (next === current) return
      if (next.holeRevealed !== current.holeRevealed) tone('flip')
      else if (next.dealer.length > current.dealer.length) tone('deal')
      setTable(next)
      if (next.phase === 'settled') {
        setBusy(true)
        later(() => {
          showResult(next)
          setBusy(false)
        }, reduceRef.current ? 0 : SETTLE_MS)
      }
    }, DEALER_STEP_MS)
    return () => window.clearTimeout(id)
  }, [table, busy, later, showResult, tone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (busyRef.current) return
      const s = tableRef.current
      const k = e.key.toLowerCase()
      if (k >= '1' && k <= '4') {
        if (s.phase !== 'betting') return
        e.preventDefault()
        onChip(CHIP_VALUES[Number(k) - 1])
      } else if (k === 'backspace') {
        if (s.phase !== 'betting') return
        e.preventDefault()
        onClear()
      } else if (k === ' ' || k === 'enter') {
        if (s.phase === 'betting') {
          e.preventDefault()
          startDeal()
        } else if (s.phase === 'settled') {
          e.preventDefault()
          doRebet()
        }
      } else if (k === 'i' || k === 'y') {
        if (s.phase !== 'insurance') return
        e.preventDefault()
        doInsure(true)
      } else if (k === 'n') {
        if (s.phase !== 'insurance') return
        e.preventDefault()
        doInsure(false)
      } else if (k === 'h') {
        if (s.phase !== 'player') return
        e.preventDefault()
        doHit()
      } else if (k === 's') {
        if (s.phase !== 'player') return
        e.preventDefault()
        doStand()
      } else if (k === 'd') {
        if (s.phase !== 'player') return
        e.preventDefault()
        doDouble()
      } else if (k === 'p') {
        if (s.phase !== 'player') return
        e.preventDefault()
        doSplit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChip, onClear, startDeal, doRebet, doInsure, doHit, doStand, doDouble, doSplit])

  const dealerWidth = table.dealer.length > 0 ? CARD_W + 14 * (table.dealer.length - 1) : 0
  const dealerLeft = Math.round((PLAY_W - dealerWidth) / 2)

  const handsLayout = useMemo(() => {
    if (table.hands.length === 0) return []
    const widths = table.hands.map((h) => CARD_W + 14 * (h.cards.length - 1))
    const totalW = widths.reduce((a, b) => a + b, 0) + 24 * (table.hands.length - 1)
    let left = Math.round((PLAY_W - totalW) / 2)
    const active = table.phase === 'player' ? table.active : -1
    return table.hands.map((hand, i) => {
      const layout = {
        hand,
        index: i,
        left,
        width: widths[i],
        top: i === active ? HAND_Y_ACTIVE : HAND_Y,
        centerX: Math.round(left + widths[i] / 2),
      }
      left += widths[i] + 24
      return layout
    })
  }, [table.hands, table.active, table.phase])

  const dealDelay = useCallback(
    (slot: string) => (reduce ? 0 : (dealOrder[slot] ?? 0) * STAGGER),
    [dealOrder, reduce],
  )

  const activeHand = table.hands[table.active]
  const canHit = table.phase === 'player' && Boolean(activeHand && !activeHand.done && !activeHand.splitAces)
  const canStand = table.phase === 'player' && Boolean(activeHand && !activeHand.done)
  const outOfChips = table.phase === 'betting' && table.bankroll < MIN_BET && table.bet === 0

  const dealerBadge = (() => {
    if (table.dealer.length === 0) return ''
    if (!table.holeRevealed) return String(handValue([table.dealer[0]]).total)
    const v = handValue(table.dealer)
    return v.soft ? labels.soft.replace('{n}', String(v.total)) : String(v.total)
  })()

  const dealerAria = (() => {
    if (table.dealer.length === 0) return ''
    if (!table.holeRevealed) return labels.dealerShows.replace('{card}', cardName(table.dealer[0], arcade.cards))
    const v = handValue(table.dealer)
    const total = v.soft ? labels.soft.replace('{n}', String(v.total)) : String(v.total)
    return labels.dealerHand
      .replace('{cards}', table.dealer.map((c) => cardName(c, arcade.cards)).join(', '))
      .replace('{total}', total)
  })()

  const handLabel = (hand: Hand): string => {
    const names = hand.cards.map((c) => cardName(c, arcade.cards)).join(', ')
    if (hand.outcome === 'bust') return labels.handBust.replace('{cards}', names)
    const v = handValue(hand.cards)
    const total = v.soft ? labels.soft.replace('{n}', String(v.total)) : String(v.total)
    if (isBlackjack(hand)) return labels.handBlackjack.replace('{cards}', names).replace('{total}', total)
    return labels.hand.replace('{cards}', names).replace('{total}', total)
  }

  const renderControls = () => {
    if (table.phase === 'betting') {
      return (
        <>
          <div className="flex flex-1 items-center justify-center gap-2">
            {CHIP_VALUES.map((value, i) => (
              <ChipButton
                key={value}
                value={value}
                label={labels.chip.replace('{n}', String(value))}
                title={`${labels.chip.replace('{n}', String(value))} (${i + 1})`}
                disabled={busy}
                onClick={() => onChip(value)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: ARCADE.panelText }}>{labels.bet.replace('{n}', fmt(table.bet))}</span>
            <ArcadeButton tone="dark" size="sm" onClick={onClear} disabled={busy || table.bet === 0} title={`${labels.clear} (Backspace)`}>
              {labels.clear}
            </ArcadeButton>
            <ArcadeButton size="sm" onClick={startDeal} disabled={busy || table.bet < MIN_BET} title={`${labels.deal} (Space)`}>
              {labels.deal}
            </ArcadeButton>
          </div>
        </>
      )
    }
    if (table.phase === 'insurance') {
      return (
        <div className="flex flex-1 items-center justify-end gap-3">
          <span style={{ ...PIXEL_FONT, fontSize: 10, color: ARCADE.panelText }}>{labels.insurance}</span>
          <ArcadeButton size="sm" onClick={() => doInsure(true)} disabled={busy} title={`${labels.yes} (I)`}>
            {labels.yes}
          </ArcadeButton>
          <ArcadeButton tone="dark" size="sm" onClick={() => doInsure(false)} disabled={busy} title={`${labels.no} (N)`}>
            {labels.no}
          </ArcadeButton>
        </div>
      )
    }
    if (table.phase === 'settled') {
      return (
        <div className="flex flex-1 items-center justify-end gap-2">
          <ArcadeButton
            size="sm"
            onClick={doRebet}
            disabled={busy || table.bet < MIN_BET || table.bankroll < table.bet}
            title={`${labels.rebet} (Space)`}
          >
            {labels.rebet}
          </ArcadeButton>
          <ArcadeButton tone="dark" size="sm" onClick={doNewBet} disabled={busy} title={labels.newBet}>
            {labels.newBet}
          </ArcadeButton>
        </div>
      )
    }
    const dealerTurn = table.phase === 'dealer'
    return (
      <div className="flex flex-1 items-center justify-end gap-2">
        <ArcadeButton size="sm" onClick={doHit} disabled={busy || !canHit} title={`${labels.hit} (H)`}>
          {labels.hit}
        </ArcadeButton>
        <ArcadeButton size="sm" onClick={doStand} disabled={busy || dealerTurn || !canStand} title={`${labels.stand} (S)`}>
          {labels.stand}
        </ArcadeButton>
        <ArcadeButton size="sm" onClick={doDouble} disabled={busy || dealerTurn || !canDouble(table)} title={`${labels.double} (D)`}>
          {labels.double}
        </ArcadeButton>
        <ArcadeButton size="sm" onClick={doSplit} disabled={busy || dealerTurn || !canSplit(table)} title={`${labels.split} (P)`}>
          {labels.split}
        </ArcadeButton>
      </div>
    )
  }

  return (
    <ArcadeFrame fs={fs} background={ARCADE.felt}>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack} />

      <div role="group" aria-label={labels.table} className="relative flex-1 overflow-hidden" style={FELT_STYLE}>
        {/* Felt printing */}
        <div aria-hidden className="absolute" style={{ left: 0, right: 0, top: 86, height: 28 }}>
          <div className="absolute" style={{ left: 90, right: 90, top: 0, height: 1, backgroundColor: ARCADE.feltLine }} />
          <div className="absolute" style={{ left: 90, right: 90, top: 27, height: 1, backgroundColor: ARCADE.feltLine }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: ARCADE.feltText, opacity: 0.75, letterSpacing: 1 }}>{labels.blackjackPays}</span>
            <span style={{ ...PIXEL_FONT, fontSize: 8, color: ARCADE.feltText, opacity: 0.55 }}>{labels.dealerRule}</span>
          </div>
        </div>

        {/* Dealer zone */}
        {table.dealer.length > 0 && (
          <div className="absolute" style={{ left: 0, top: DEALER_Y, width: PLAY_W, height: CARD_H }} role="group" aria-label={dealerAria}>
            <div
              className="absolute"
              style={{ left: dealerLeft - 8, top: 22, transform: 'translateX(-100%)' }}
              aria-hidden
            >
              <ArcadePanel style={{ fontSize: 9, padding: '1px 5px' }}>{dealerBadge}</ArcadePanel>
            </div>
            {table.dealer.map((card, i) => {
              const slotX = dealerLeft + i * 14
              if (i === 1) {
                return (
                  <motion.div
                    key={`${dealSeq}-d-1`}
                    className="absolute"
                    style={{ left: slotX, top: 0 }}
                    initial={{ x: SHOE_ORIGIN.x - slotX, y: SHOE_ORIGIN.y - DEALER_Y, opacity: 0 }}
                    animate={{ x: 0, y: 0, opacity: 1 }}
                    transition={{ duration: reduce ? 0 : FLY / 1000, delay: reduce ? 0 : dealDelay('d-1') / 1000, ease: 'easeOut' }}
                  >
                    <FlipCard card={card} revealed={table.holeRevealed} />
                  </motion.div>
                )
              }
              return <FlyCard key={`${dealSeq}-d-${i}`} card={card} slotX={slotX} slotY={DEALER_Y} delay={dealDelay(`d-${i}`)} />
            })}
          </div>
        )}

        <Shoe label={labels.sixDecks} />
        <DiscardTray discards={table.discards} />

        {/* Betting circle with the pending stack */}
        {table.phase === 'betting' && (
          <>
            <svg className="absolute" style={{ left: CIRCLE.x - CIRCLE.r, top: CIRCLE.y - CIRCLE.r }} width={CIRCLE.r * 2} height={CIRCLE.r * 2} aria-hidden>
              <circle cx={CIRCLE.r} cy={CIRCLE.r} r={CIRCLE.r - 0.5} fill="none" stroke={ARCADE.feltLine} strokeWidth={1} strokeOpacity={0.6} />
            </svg>
            {table.bet > 0 && <BetStack amount={table.bet} left={CIRCLE.x - 6} top={CIRCLE.y - stackHeight(table.bet) / 2} />}
          </>
        )}

        {/* Player hands */}
        {handsLayout.map(({ hand, index, left, width, top, centerX }) => {
          const v = handValue(hand.cards)
          const badgeText = hand.outcome === 'bust' ? labels.resultBust : v.soft ? labels.soft.replace('{n}', String(v.total)) : String(v.total)
          const loses = table.phase === 'settled' && (hand.outcome === 'lose' || hand.outcome === 'bust')
          const wins = table.phase === 'settled' && (hand.outcome === 'win' || hand.outcome === 'blackjack')
          return (
            <div key={index} className="absolute" style={{ left, top: 0, width, height: CARD_H + 46 }} role="group" aria-label={handLabel(hand)}>
              <div className="absolute" style={{ left: 0, top: top - 16 }} aria-hidden>
                <ArcadePanel style={{ fontSize: 9, padding: '1px 5px' }}>{badgeText}</ArcadePanel>
              </div>
              {hand.cards.map((card, ci) => (
                <FlyCard key={`${dealSeq}-p${index}-${ci}`} card={card} slotX={left + ci * 14} slotY={top} delay={dealDelay(`p${index}-${ci}`)} />
              ))}
              {table.phase === 'player' && index === table.active && <ActivePointer centerX={centerX} />}

              {loses ? (
                <motion.div
                  className="absolute"
                  style={{ left: 0, top: 0 }}
                  initial={false}
                  animate={{ y: -118, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.15, ease: 'easeIn' }}
                  aria-hidden
                >
                  <BetStack amount={hand.bet} left={centerX - 6} top={STAKE_Y} />
                </motion.div>
              ) : (
                <div className="absolute" style={{ left: 0, top: 0 }} aria-hidden>
                  <BetStack amount={hand.bet} left={centerX - 6} top={STAKE_Y} />
                </div>
              )}
              {wins && (
                <motion.div
                  className="absolute"
                  style={{ left: 0, top: 0 }}
                  initial={{ y: -110, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.1, ease: 'easeOut' }}
                  aria-hidden
                >
                  <BetStack amount={Math.floor((hand.payout ?? 0) / 5) * 5} left={centerX - 6} top={STAKE_Y} />
                </motion.div>
              )}
            </div>
          )
        })}

        {/* Result banner */}
        {banner && (
          <motion.div
            className="absolute left-0 right-0 flex justify-center"
            style={{ top: 88, zIndex: 15 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
          >
            <ArcadePanel style={{ fontSize: 10, padding: '5px 12px' }}>{banner}</ArcadePanel>
          </motion.div>
        )}

        {/* Bottom bar */}
        <div
          className="absolute flex items-center gap-3 px-3"
          style={{ left: 0, right: 0, bottom: 0, height: 40, backgroundColor: ARCADE.feltDark, borderTop: `1px solid ${ARCADE.feltLine}`, zIndex: 10 }}
        >
          <div style={{ backgroundColor: ARCADE.panelDark, border: `1px solid ${ARCADE.panelBorder}`, padding: '3px 7px', lineHeight: 1.25 }}>
            <div style={{ ...PIXEL_FONT, fontSize: 10, color: ARCADE.panelText }}>{labels.bank.replace('{n}', fmt(table.bankroll))}</div>
            <div style={{ ...PIXEL_FONT, fontSize: 8, color: ARCADE.feltText }}>{labels.best.replace('{n}', fmt(best))}</div>
          </div>
          {renderControls()}
        </div>

        {outOfChips && (
          <ArcadeOverlay>
            <ArcadePanel style={{ padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, marginBottom: 10 }}>{labels.outOfChips}</div>
              <ArcadeButton size="md" onClick={doRebuy} title={labels.rebuy}>
                {labels.rebuy}
              </ArcadeButton>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        <div className="sr-only" aria-live="polite">
          {announce}
        </div>
      </div>
    </ArcadeFrame>
  )
}
