// src/components/room/mahjong/FourPlayer.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArcadeButton, ArcadeOverlay, ArcadePanel, ArcadeStrip, ARCADE, PIXEL_FONT } from '../DeskArcade'
import { PORTRAIT_STRIP_H, useDeskScreen } from '../ScreenStrip'
import { useSfx } from '../RoomSfxProvider'
import {
  advance,
  applyAction,
  legalActions,
  newMatch,
  pendingFor,
  pendingSeats,
  seatWind,
  startHand,
  waitingTiles,
  type Action,
  type ClaimOption,
  type GameState,
  type LastAction,
  type Meld,
} from '@/lib/games/mahjong-engine'
import { botAction, type BotLevel } from '@/lib/games/mahjong-bot'
import { compareTiles, tileName } from '@/lib/games/mahjong-tiles'
import type { MahjongChrome } from './chrome'
import { MUTED, TABLE_BG } from './chrome'
import type { MahjongLabels } from './labels'
import { TileView } from './tile-art'
import { AutoTable } from './AutoTable'
import { clearSave, loadStats, recordHand, recordMatch, writeSave, type Prefs, type Stats } from './mahjong-store'

interface Props {
  chrome: MahjongChrome
  labels: MahjongLabels
  prefs: Prefs
  initial: { game: GameState; level: BotLevel }
  onMenu: () => void
}

const randomSeed = () => Math.floor(Math.random() * 4294967295)
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Delays (ms) between bot steps. */
const DELAYS = {
  normal: { draw: 200, discard: 560, claim: 70 },
  fast: { draw: 70, discard: 240, claim: 40 },
} as const

interface HandItem { code: string; drawn: boolean }

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

/** A hand just dealt: nobody has discarded or melded yet. */
function freshHand(g: GameState): boolean {
  return g.phase !== 'handOver' && g.phase !== 'matchOver' && g.seats.every((s) => s.discards.length === 0 && s.melds.length === 0)
}

function sameLast(a: LastAction | null, b: LastAction | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/* ---------- Small pieces ---------- */

function MeldView({ meld, w, h, depth = 1 }: { meld: Meld; w: number; h: number; depth?: number }) {
  return (
    <div className="flex flex-shrink-0" style={{ gap: 1, marginRight: depth + 3 }} role="group" aria-label={`${meld.kind}: ${tileName(meld.tiles[0])}`}>
      {meld.tiles.map((t, i) => (
        <TileView key={i} code={t} w={w} h={h} depth={depth} />
      ))}
    </div>
  )
}

function Backs({ n, w, h, vertical, depth = 1 }: { n: number; w: number; h: number; vertical?: boolean; depth?: number }) {
  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} flex-shrink-0`} style={{ gap: depth + 1 }} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <TileView key={i} code={null} w={w} h={h} depth={depth} />
      ))}
    </div>
  )
}

function River({
  tiles,
  tw,
  th,
  cols,
  lastIdx,
  label,
}: {
  tiles: string[]
  tw: number
  th: number
  cols: number
  lastIdx: number
  label: string
}) {
  return (
    <div
      role="list"
      aria-label={label}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${tw}px)`, gap: 2, alignContent: 'start', width: cols * (tw + 2) }}
    >
      {tiles.map((t, i) => (
        <div role="listitem" key={i}>
          <TileView code={t} w={tw} h={th} depth={1} accent={i === lastIdx ? ARCADE.amber : undefined} />
        </div>
      ))}
    </div>
  )
}

export function MahjongFourPlayer({ chrome, labels, prefs, initial, onMenu }: Props) {
  const { tone } = useSfx()
  const { w: screenW, h: screenH, portrait } = useDeskScreen()

  const [game, setGame] = useState<GameState>(initial.game)
  const [level] = useState<BotLevel>(initial.level)
  const [sel, setSel] = useState<number | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [overShown, setOverShown] = useState(true)
  const [stats, setStats] = useState<Stats>(loadStats)
  const [announce, setAnnounce] = useState('')
  // The automatic table runs before a fresh hand; bots and the clock wait for it and for How to play.
  const [dealing, setDealing] = useState(() => prefs.tableAnim && freshHand(initial.game))
  const helpOpen = chrome.helpOpen
  const hold = dealing || helpOpen

  const gameRef = useRef(game)
  const gameIdRef = useRef(0)
  const lastLoggedRef = useRef<LastAction | null>(initial.game.lastAction)
  const recordedHandRef = useRef(initial.game.phase === 'handOver' ? `${initial.game.handNo}` : '')
  const recordedMatchRef = useRef(false)
  const speed = DELAYS[prefs.speed]

  const me = game.seats[0]
  const names = game.names
  const nameOf = useCallback((s: number) => (s === 0 ? labels.you : names[s]), [names, labels.you])
  const phase = game.phase
  const handOver = phase === 'handOver'
  const matchOver = phase === 'matchOver'
  const pending = pendingFor(game, 0)
  const inDiscard = phase === 'discard' && game.turn === 0 && pending
  const inClaim = phase === 'claim' && pending && game.claim !== null
  const legal = useMemo(() => legalActions(game, 0), [game])

  useEffect(() => {
    gameRef.current = game
  }, [game])
  useEffect(() => () => { gameIdRef.current++ }, [])

  /* ---------- Hand display ---------- */
  const items: HandItem[] = useMemo(() => {
    const rest = [...me.hand]
    if (inDiscard && game.drawn !== null) {
      const i = rest.indexOf(game.drawn)
      if (i >= 0) {
        rest.splice(i, 1)
        return [...rest.map((code) => ({ code, drawn: false })), { code: game.drawn, drawn: true }]
      }
    }
    return rest.map((code) => ({ code, drawn: false }))
  }, [me.hand, game.drawn, inDiscard])

  /* ---------- Log ---------- */
  const describe = useCallback(
    (a: LastAction): string | null => {
      if (a.type === 'draw') return null
      const name = nameOf(a.seat)
      const tmpl = labels.log[a.type]
      if (!tmpl) return null
      return fmt(tmpl, { name, tile: a.tile ? tileName(a.tile) : '' })
    },
    [labels.log, nameOf],
  )

  const commit = useCallback(
    (next: GameState) => {
      const prev = gameRef.current
      gameRef.current = next
      setGame(next)
      setSel(null)
      if (!sameLast(next.lastAction, lastLoggedRef.current)) {
        lastLoggedRef.current = next.lastAction
        const a = next.lastAction
        if (a) {
          const line = describe(a)
          if (line) {
            setLog((l) => [...l.slice(-39), line])
            setAnnounce(line)
          }
          if (a.type === 'discard') tone('place', a.seat === 0 ? 1 : 0.9)
          else if (a.type === 'chow' || a.type === 'pung' || a.type === 'kong' || a.type === 'concealedKong' || a.type === 'addKong') tone('chip')
          else if (a.type === 'bonus') tone('flip')
        }
      }
      if (next.phase === 'handOver' && prev.phase !== 'handOver') {
        setOverShown(true)
        const r = next.result
        if (r?.kind === 'win') tone(r.winner === 0 ? 'win' : 'lose')
        else tone('score')
      }
    },
    [describe, tone],
  )

  /* ---------- Bots, one visible step at a time ---------- */
  const botSeatPending = pendingSeats(game).some((s) => s !== 0)
  const stepKind: 'draw' | 'discard' | 'claim' | null =
    phase === 'draw' ? 'draw' : phase === 'discard' && game.turn !== 0 ? 'discard' : phase === 'claim' && botSeatPending ? 'claim' : null

  useEffect(() => {
    if (stepKind === null || hold) return
    const id = gameIdRef.current
    const delay = stepKind === 'draw' ? (game.turn === 0 ? 160 : speed.draw) : stepKind === 'discard' ? speed.discard : speed.claim
    const timer = window.setTimeout(() => {
      if (id !== gameIdRef.current) return
      const s = gameRef.current
      let next: GameState = s
      if (s.phase === 'draw') {
        next = advance(s)
      } else {
        const bot = pendingSeats(s).find((x) => x !== 0)
        if (bot === undefined) return
        const act = botAction(s, bot, level) ?? legalActions(s, bot)[0]
        next = applyAction(s, bot, act)
        if (next === s) {
          const alts = legalActions(s, bot)
          const pass = alts.find((a) => a.type === 'pass') ?? alts[alts.length - 1]
          if (pass) next = applyAction(s, bot, pass)
        }
      }
      if (next !== s) commit(next)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [game, stepKind, speed, level, commit, hold])

  /* ---------- The human's actions ---------- */
  const act = useCallback(
    (a: Action) => {
      const s = gameRef.current
      const next = applyAction(s, 0, a)
      if (next === s) {
        tone('invalid')
        return false
      }
      commit(next)
      return true
    },
    [commit, tone],
  )

  // Optional: pass chow-only offers without asking.
  const chowOnly = inClaim && game.claim!.options[0].length > 0 && game.claim!.options[0].every((o) => o.type === 'chow')
  useEffect(() => {
    if (!chowOnly || !prefs.autoPassChow || botSeatPending || hold) return
    const id = gameIdRef.current
    const timer = window.setTimeout(() => {
      if (id !== gameIdRef.current) return
      act({ type: 'pass' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [chowOnly, prefs.autoPassChow, botSeatPending, game, act, hold])

  const discardIndex = useCallback(
    (i: number) => {
      const item = items[i]
      if (!item || !inDiscard) return
      act({ type: 'discard', tile: item.code })
    },
    [items, inDiscard, act],
  )

  const tapTile = (i: number) => {
    if (!inDiscard) return
    if (sel === i) discardIndex(i)
    else {
      setSel(i)
      tone('select')
    }
  }

  const nextHand = useCallback(() => {
    const s = gameRef.current
    if (s.phase !== 'handOver') return
    const next = startHand(s)
    if (next === s) return
    lastLoggedRef.current = next.lastAction
    setLog([])
    setOverShown(true)
    if (prefs.tableAnim && freshHand(next)) setDealing(true)
    else tone('deal')
    commit(next)
  }, [commit, tone, prefs.tableAnim])

  const newMatchSame = useCallback(() => {
    const s = gameRef.current
    gameIdRef.current++
    const m = newMatch({ seed: randomSeed(), minFaan: s.opts.minFaan, rounds: s.opts.rounds })
    gameRef.current = m
    lastLoggedRef.current = m.lastAction
    recordedHandRef.current = ''
    recordedMatchRef.current = false
    setLog([])
    setSel(null)
    setOverShown(true)
    setGame(m)
    if (prefs.tableAnim) setDealing(true)
    else tone('deal')
  }, [tone, prefs.tableAnim])

  /* ---------- Save and records ---------- */
  useEffect(() => {
    if (game.phase === 'matchOver') clearSave()
    else writeSave({ mode: 'four', game, level })
  }, [game, level])

  useEffect(() => {
    if (game.phase === 'handOver' && game.result) {
      const key = `${game.handNo}`
      if (recordedHandRef.current === key) return
      recordedHandRef.current = key
      const r = game.result
      setStats(recordHand(r.kind === 'win' && r.winner === 0, r.kind === 'win' && r.winner === 0 ? r.score.faan : 0))
    }
    if (game.phase === 'matchOver' && !recordedMatchRef.current) {
      recordedMatchRef.current = true
      const top = Math.max(...game.seats.map((x) => x.score))
      setStats(recordMatch(game.seats[0].score === top))
      tone(game.seats[0].score === top ? 'win' : 'lose')
    }
  }, [game, tone])

  /* ---------- Ready indicator ---------- */
  const waits = useMemo(() => {
    try {
      let tiles: string[] | null = null
      if (inDiscard) {
        if (sel !== null && items[sel]) {
          tiles = [...me.hand]
          const i = tiles.indexOf(items[sel].code)
          if (i >= 0) tiles.splice(i, 1)
        }
      } else if (!handOver && !matchOver) tiles = me.hand
      if (!tiles || tiles.length % 3 !== 1) return []
      return waitingTiles(tiles, me.melds)
    } catch {
      return []
    }
  }, [inDiscard, sel, items, me.hand, me.melds, handOver, matchOver])

  /* ---------- Keyboard ---------- */
  const claimOptions: ClaimOption[] = useMemo(() => (inClaim ? game.claim!.options[0] : []), [inClaim, game.claim])
  const chows = claimOptions.filter((o): o is Extract<ClaimOption, { type: 'chow' }> => o.type === 'chow')
  const kongActions = legal.filter((a) => a.type === 'concealedKong' || a.type === 'addKong')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const onButton = t?.tagName === 'BUTTON'
      const k = e.key
      if (handOver && overShown) {
        if ((k === 'Enter' || k === ' ') && !onButton) {
          e.preventDefault()
          nextHand()
        }
        return
      }
      if (inClaim) {
        const lk = k.toLowerCase()
        if (lk === 'p' && claimOptions.some((o) => o.type === 'pung')) act({ type: 'pung' })
        else if (lk === 'k' && claimOptions.some((o) => o.type === 'kong')) act({ type: 'kong' })
        else if ((lk === 'w' || lk === 'r') && claimOptions.some((o) => o.type === 'ron')) act({ type: 'ron' })
        else if (lk === 'c' && chows.length > 0) act({ type: 'chow', tiles: chows[0].tiles })
        else if (k >= '1' && k <= '3' && chows[Number(k) - 1]) act({ type: 'chow', tiles: chows[Number(k) - 1].tiles })
        else if ((k === ' ' && !onButton) || lk === 'x') {
          e.preventDefault()
          act({ type: 'pass' })
        } else return
        e.preventDefault()
        return
      }
      if (handOver && !overShown && (k === 'Enter') && !onButton) {
        e.preventDefault()
        nextHand()
        return
      }
      if (!inDiscard) return
      const n = items.length
      const lk = k.toLowerCase()
      if (k === 'ArrowLeft' || k === 'ArrowUp') {
        e.preventDefault()
        setSel((s) => (s === null ? n - 1 : Math.max(0, s - (k === 'ArrowUp' && portrait ? 7 : 1))))
      } else if (k === 'ArrowRight' || k === 'ArrowDown') {
        e.preventDefault()
        setSel((s) => (s === null ? n - 1 : Math.min(n - 1, s + (k === 'ArrowDown' && portrait ? 7 : 1))))
      } else if ((k === 'Enter' || k === ' ') && !onButton) {
        e.preventDefault()
        if (sel !== null) discardIndex(sel)
        else setSel(n - 1)
      } else if (lk === 'w' && legal.some((a) => a.type === 'tsumo')) act({ type: 'tsumo' })
      else if (lk === 'k' && kongActions.length === 1) act(kongActions[0])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handOver, overShown, inClaim, inDiscard, claimOptions, chows, kongActions, legal, items.length, sel, portrait, act, discardIndex, nextHand])

  // Escape: a claim is passed, then the hand-over panel closes, then the selection clears; only then DeskView's ladder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement || hold) return
      if (handOver && overShown) setOverShown(false)
      else if (inClaim) act({ type: 'pass' })
      else if (sel !== null) setSel(null)
      else return
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handOver, overShown, inClaim, sel, act, hold])

  /* ---------- Geometry ---------- */
  const bodyH = portrait ? screenH - 2 * PORTRAIT_STRIP_H : 280
  const font = portrait ? 12 : 10

  // landscape
  const HW = 26
  const HH = 36
  // portrait
  const PW = Math.min(44, Math.floor((screenW - 14 - 6 * 3) / 7))
  const spare = bodyH - 252
  const PH = Math.max(42, Math.min(58, Math.floor(spare / 2) - 3))

  const blurClick = (fn: () => void) => (e: React.MouseEvent) => {
    fn()
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur()
  }

  /* ---------- Parts ---------- */
  const windBadge = (seat: number) => {
    const w = seatWind(game, seat)
    const dealer = seat === game.dealer
    return (
      <span
        title={dealer ? `${labels.winds[w - 1]} (${labels.dealer})` : labels.winds[w - 1]}
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: portrait ? 16 : 14,
          height: portrait ? 16 : 14,
          fontSize: portrait ? 12 : 10,
          lineHeight: 1,
          color: '#faf3dc',
          backgroundColor: dealer ? ARCADE.rust : '#4a3826',
          border: `1px solid ${dealer ? '#f0a090' : ARCADE.panelBorder}`,
          ...PIXEL_FONT,
        }}
      >
        {labels.winds[w - 1][0]}
      </span>
    )
  }

  const turnSeat = phase === 'claim' && game.claim ? -1 : game.turn
  const turnRing = (seat: number) => !handOver && !matchOver && (turnSeat === seat || (phase === 'claim' && game.claim?.decisions[seat] === null))

  const plate = (seat: number, opts: { melds?: boolean; backs?: 'row' | 'col' | 'none'; wide?: boolean } = {}) => {
    const s = game.seats[seat]
    const bw = portrait ? 5 : 10
    const bh = portrait ? 9 : 14
    return (
      <div
        role="group"
        aria-label={fmt(labels.seatAria, { name: nameOf(seat), n: s.hand.length, score: s.score })}
        className="flex flex-col min-w-0"
        style={{
          gap: 2,
          padding: portrait ? '2px 3px' : '2px 3px',
          border: `1px solid ${turnRing(seat) ? ARCADE.amber : 'transparent'}`,
          backgroundColor: turnRing(seat) ? 'rgba(232,168,58,0.14)' : 'rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {windBadge(seat)}
          <span className="truncate" style={{ fontSize: font, color: ARCADE.panelText, ...PIXEL_FONT }}>{names[seat]}</span>
          <span className="flex-shrink-0" style={{ fontSize: font, color: s.score < 0 ? '#e8a090' : ARCADE.amber, ...PIXEL_FONT }}>{s.score}</span>
        </div>
        {opts.backs === 'row' && (
          handOver && game.result?.kind === 'win' && game.result.winner === seat
            ? null
            : <Backs n={s.hand.length} w={bw} h={bh} depth={1} />
        )}
        {opts.melds && (s.melds.length > 0 || s.bonus.length > 0) && (
          <div className="flex flex-wrap items-center" style={{ rowGap: 2 }}>
            {s.melds.map((m, i) => <MeldView key={i} meld={m} w={portrait ? 7 : 9} h={portrait ? 10 : 13} />)}
            {s.bonus.length > 0 && (
              <span className="flex items-center gap-0.5" aria-label={fmt(labels.flowers, { n: s.bonus.length })}>
                <TileView code={s.bonus[s.bonus.length - 1]} w={portrait ? 7 : 9} h={portrait ? 10 : 13} depth={1} />
                <span style={{ fontSize: portrait ? 12 : 10, color: MUTED, ...PIXEL_FONT }}>×{s.bonus.length}</span>
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const lastFrom = game.lastDiscard ? game.lastDiscard.from : -1
  const riverFor = (seat: number, tw: number, th: number, cols: number) => {
    const d = game.seats[seat].discards
    const hl = lastFrom === seat && d.length > 0 && d[d.length - 1] === game.lastDiscard!.tile && !handOver ? d.length - 1 : -1
    return <River tiles={d} tw={tw} th={th} cols={cols} lastIdx={hl} label={fmt(labels.riverAria, { name: nameOf(seat) })} />
  }

  const lastLines = log.slice(-(portrait ? 1 : 3))

  const waitRow = waits.length > 0 && (
    <div className="flex items-center flex-wrap" style={{ gap: 3 }} aria-label={`${labels.ready} ${waits.map((w) => tileName(w)).join(', ')}`}>
      <span style={{ fontSize: font, color: ARCADE.olive, ...PIXEL_FONT }}>{labels.ready}</span>
      {waits.slice(0, 7).map((w) => (
        <TileView key={w} code={w} w={portrait ? 12 : 11} h={portrait ? 16 : 15} depth={1} />
      ))}
      {waits.length > 7 && <span style={{ fontSize: font, color: MUTED, ...PIXEL_FONT }}>+{waits.length - 7}</span>}
    </div>
  )

  const statusText = matchOver
    ? labels.matchOver
    : handOver
      ? labels.handNo.replace('{n}', String(game.handNo))
      : inDiscard
        ? labels.yourTurn
        : inClaim
          ? labels.claimTitle.replace('{name}', nameOf(game.claim!.from)).replace('{tile}', tileName(game.claim!.tile))
          : fmt(labels.waitingFor, { name: nameOf(phase === 'claim' ? game.claim?.from ?? game.turn : game.turn) })

  const info = (
    <div className="flex flex-col items-center text-center" style={{ gap: 3, minWidth: 0 }}>
      <div style={{ fontSize: font, color: ARCADE.amber, lineHeight: 1.2, ...PIXEL_FONT }}>
        {fmt(labels.windRound, { wind: labels.winds[game.prevailing - 1] })} · {fmt(labels.handNo, { n: game.handNo })} · {fmt(labels.wall, { n: game.wall.length })}
      </div>
      <div style={{ fontSize: font, color: ARCADE.panelText, lineHeight: 1.25, ...PIXEL_FONT }}>{statusText}</div>
      {!portrait && lastLines.length > 0 && (
        <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.3, ...PIXEL_FONT }}>
          {lastLines.map((l, i) => <div key={i} style={{ opacity: i === lastLines.length - 1 ? 1 : 0.6 }}>{l}</div>)}
        </div>
      )}
      {!portrait && waitRow}
    </div>
  )

  /* ---------- Your side ---------- */
  const mw = portrait ? 14 : 18
  const mh = portrait ? 19 : 24
  const yourMelds = (
    <div className="flex items-center overflow-hidden" style={{ height: mh + 4, gap: 0 }} aria-label={labels.melds}>
      <span className="flex items-center flex-shrink-0 gap-1" style={{ marginRight: 8, paddingRight: 6, borderRight: `1px solid ${ARCADE.panelBorder}` }}>
        {windBadge(0)}
        <span style={{ fontSize: font, color: me.score < 0 ? '#e8a090' : ARCADE.amber, ...PIXEL_FONT }}>{labels.you} {me.score}</span>
      </span>
      {me.melds.map((m, i) => <MeldView key={i} meld={m} w={mw} h={mh} depth={1} />)}
      {me.bonus.length > 0 && (
        <div className="flex" style={{ gap: 1, marginLeft: me.melds.length ? 4 : 0 }} aria-label={fmt(labels.flowers, { n: me.bonus.length })}>
          {me.bonus.map((b, i) => <TileView key={i} code={b} w={mw} h={mh} depth={1} />)}
        </div>
      )}
    </div>
  )

  const tw = portrait ? PW : HW
  const th = portrait ? PH : HH
  const handTile = (it: HandItem, i: number) => {
    const selected = sel === i && inDiscard
    return (
      <button
        key={`${i}-${it.code}`}
        type="button"
        tabIndex={-1}
        aria-label={`${tileName(it.code)}${it.drawn ? ', drawn' : ''}${selected ? ', selected' : ''}`}
        aria-pressed={selected}
        disabled={!inDiscard}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          e.preventDefault()
          tapTile(i)
        }}
        className="p-0 border-0 bg-transparent outline-none flex-shrink-0"
        style={{ width: tw, height: th, marginLeft: it.drawn && !portrait ? 8 : 0, cursor: inDiscard ? 'pointer' : 'default', touchAction: 'manipulation', transform: selected ? 'translateY(-6px)' : undefined }}
      >
        <TileView code={it.code} w={tw} h={th} depth={portrait ? 3 : 2} selected={selected} accent={selected ? ARCADE.amber : it.drawn && inDiscard ? ARCADE.teal : undefined} />
      </button>
    )
  }

  const canTsumo = legal.some((a) => a.type === 'tsumo')
  const bsz = portrait ? 'xl' : 'sm'
  const miniTile = (code: string) => <TileView code={code} w={portrait ? 14 : 11} h={portrait ? 19 : 15} depth={1} />

  const actionButtons = (
    <>
      {inDiscard && (
        <ArcadeButton size={bsz} tone="cream" disabled={sel === null} onClick={blurClick(() => sel !== null && discardIndex(sel))}>
          {labels.discard}
        </ArcadeButton>
      )}
      {inDiscard && canTsumo && (
        <ArcadeButton size={bsz} tone="cream" onClick={blurClick(() => act({ type: 'tsumo' }))}>{labels.tsumo}</ArcadeButton>
      )}
      {inDiscard && kongActions.map((a, i) => (
        <ArcadeButton key={i} size={bsz} tone="dark" onClick={blurClick(() => act(a))}>
          {labels.kongAction}
          {'tile' in a && <span className="ml-1.5 inline-flex">{miniTile(a.tile)}</span>}
        </ArcadeButton>
      ))}
      {handOver && !overShown && (
        <ArcadeButton size={bsz} tone="cream" onClick={blurClick(nextHand)}>{labels.nextHand}</ArcadeButton>
      )}
    </>
  )

  /* ---------- Claim prompt ---------- */
  const claimPanel = inClaim && game.claim && (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <ArcadePanel className="px-3 py-2 pointer-events-auto" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', maxWidth: portrait ? 300 : 380 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: font, ...PIXEL_FONT }}>
            {fmt(game.claim.kind === 'robKong' ? labels.claimKong : labels.claimTitle, { name: nameOf(game.claim.from), tile: tileName(game.claim.tile) })}
          </span>
          <TileView code={game.claim.tile} w={portrait ? 22 : 18} h={portrait ? 30 : 25} depth={2} accent={ARCADE.amber} />
        </div>
        <div className="flex flex-wrap items-center justify-center" style={{ gap: 6 }}>
          {claimOptions.map((o, i) => {
            if (o.type === 'ron') return <ArcadeButton key={i} size={bsz} tone="cream" onClick={blurClick(() => act({ type: 'ron' }))}>{labels.ron}</ArcadeButton>
            if (o.type === 'pung') return <ArcadeButton key={i} size={bsz} tone="cream" onClick={blurClick(() => act({ type: 'pung' }))}>{labels.pung}</ArcadeButton>
            if (o.type === 'kong') return <ArcadeButton key={i} size={bsz} tone="cream" onClick={blurClick(() => act({ type: 'kong' }))}>{labels.kong}</ArcadeButton>
            const trio = [...o.tiles, game.claim!.tile].sort(compareTiles)
            return (
              <ArcadeButton key={i} size={bsz} tone="cream" ariaLabel={`${labels.chow}: ${trio.map((t) => tileName(t)).join(', ')}`} onClick={blurClick(() => act({ type: 'chow', tiles: o.tiles }))}>
                <span className="inline-flex items-center" style={{ gap: 1 }}>
                  <span className="mr-1">{labels.chow}</span>
                  {trio.map((t, j) => <span key={j} className="inline-flex">{miniTile(t)}</span>)}
                </span>
              </ArcadeButton>
            )
          })}
          <ArcadeButton size={bsz} tone="dark" onClick={blurClick(() => act({ type: 'pass' }))}>{labels.pass}</ArcadeButton>
        </div>
      </ArcadePanel>
    </div>
  )

  /* ---------- Hand over / match over ---------- */
  const result = game.result
  const resultPanel = handOver && overShown && result && (
    <ArcadeOverlay tint="rgba(12,8,6,0.62)">
      <div className="overflow-y-auto" style={{ maxHeight: '100%', maxWidth: portrait ? 312 : 440 }}>
        <ArcadePanel className="px-3 py-2" style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
          {result.kind === 'win' ? (
            (() => {
              const w = game.seats[result.winner]
              const concealed = [...w.hand]
              if (result.selfDrawn) {
                const i = concealed.indexOf(result.winTile)
                if (i >= 0) concealed.splice(i, 1)
              }
              const tw2 = portrait ? 15 : 17
              const th2 = portrait ? 20 : 23
              return (
                <>
                  <p style={{ margin: 0, fontSize: portrait ? 15 : 13, color: result.winner === 0 ? ARCADE.amber : ARCADE.panelText }}>
                    {result.winner === 0 ? labels.youWinTitle : fmt(labels.winTitle, { name: nameOf(result.winner) })}
                  </p>
                  <p style={{ margin: 0, fontSize: font, color: MUTED }}>
                    {result.selfDrawn ? labels.selfDrawn : fmt(labels.offDiscard, { name: nameOf(result.from ?? 0) })}
                  </p>
                  <div className="flex flex-wrap justify-center items-end" style={{ gap: 2, rowGap: 4 }}>
                    {w.melds.map((m, i) => <MeldView key={i} meld={m} w={tw2} h={th2} depth={1} />)}
                    {concealed.map((t, i) => <TileView key={i} code={t} w={tw2} h={th2} depth={1} />)}
                    <span style={{ marginLeft: 4 }}><TileView code={result.winTile} w={tw2} h={th2} depth={1} accent={ARCADE.amber} /></span>
                    {w.bonus.map((b, i) => <TileView key={`b${i}`} code={b} w={tw2 - 4} h={th2 - 5} depth={1} style={{ marginLeft: i === 0 ? 6 : 0 }} />)}
                  </div>
                  <div className="w-full" style={{ fontSize: font, ...PIXEL_FONT }}>
                    {result.score.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between" style={{ gap: 12 }}>
                        <span>{b.name}</span>
                        <span style={{ color: ARCADE.amber }}>{b.faan > 0 ? `${b.faan}` : '-'}</span>
                      </div>
                    ))}
                    <div className="flex justify-between" style={{ gap: 12, borderTop: `1px solid ${ARCADE.panelBorder}`, marginTop: 2, paddingTop: 2 }}>
                      <span>{fmt(labels.faan, { n: result.score.faan })}{result.score.limit ? ` (${labels.limit})` : ''}</span>
                      <span style={{ color: ARCADE.amber }}>{fmt(labels.points, { n: result.score.points })}</span>
                    </div>
                  </div>
                </>
              )
            })()
          ) : (
            <>
              <p style={{ margin: 0, fontSize: portrait ? 15 : 13 }}>{labels.drawTitle}</p>
              <p style={{ margin: 0, fontSize: font, color: MUTED }}>{labels.drawBody}</p>
            </>
          )}
          <div className="flex flex-col w-full" style={{ gap: 3 }} aria-label={labels.otherHands}>
            {[1, 2, 3]
              .filter((i) => !(result.kind === 'win' && result.winner === i))
              .map((i) => {
                const o = game.seats[i]
                return (
                  <div key={i} className="flex items-center" style={{ gap: 4 }}>
                    <span className="flex-shrink-0 truncate" style={{ width: 28, fontSize: font, color: MUTED, ...PIXEL_FONT }}>{names[i]}</span>
                    <div className="flex flex-wrap items-center" style={{ gap: 1, rowGap: 2 }}>
                      {o.melds.map((m, k) => <MeldView key={k} meld={m} w={portrait ? 9 : 11} h={portrait ? 12 : 15} depth={1} />)}
                      {o.hand.map((t, k) => <TileView key={k} code={t} w={portrait ? 9 : 11} h={portrait ? 12 : 15} depth={1} />)}
                    </div>
                  </div>
                )
              })}
          </div>
          <div className="grid w-full" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: font, ...PIXEL_FONT }} aria-label={labels.payments}>
            {game.seats.map((s, i) => (
              <div key={i} className="flex flex-col items-center" style={{ minWidth: 0 }}>
                <span className="truncate max-w-full" style={{ color: MUTED }}>{names[i]}</span>
                <span style={{ color: result.payments[i] > 0 ? ARCADE.olive : result.payments[i] < 0 ? '#e8a090' : ARCADE.panelText }}>{signed(result.payments[i])}</span>
                <span>{s.score}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1">
            <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={nextHand}>{labels.nextHand}</ArcadeButton>
            <ArcadeButton size={portrait ? 'xl' : 'md'} tone="dark" onClick={() => setOverShown(false)}>{labels.seeTable}</ArcadeButton>
          </div>
        </ArcadePanel>
      </div>
    </ArcadeOverlay>
  )

  const ranking = matchOver ? game.seats.map((s, i) => ({ i, score: s.score })).sort((a, b) => b.score - a.score || a.i - b.i) : []
  const matchPanel = matchOver && (
    <ArcadeOverlay tint="rgba(12,8,6,0.7)">
      <ArcadePanel className="px-4 py-3" style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', minWidth: portrait ? 260 : 300 }}>
        <p style={{ margin: 0, fontSize: portrait ? 16 : 14 }}>{labels.matchOver}</p>
        <p style={{ margin: 0, fontSize: font, color: ranking[0].i === 0 ? ARCADE.amber : MUTED }}>{ranking[0].i === 0 ? labels.matchWinYou : labels.matchLose}</p>
        <div className="w-full" style={{ fontSize: font + 1, ...PIXEL_FONT }} aria-label={labels.finalScores}>
          {ranking.map((r, n) => (
            <div key={r.i} className="flex justify-between" style={{ gap: 12, color: r.i === 0 ? ARCADE.amber : ARCADE.panelText }}>
              <span>{labels.placeLabels[n]} {nameOf(r.i)}</span>
              <span>{r.score}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: font, color: MUTED }}>
          {fmt(labels.record, { m: stats.four.matchWins, mp: stats.four.matches, h: stats.four.handWins, hp: stats.four.hands })}
        </p>
        <div className="flex gap-1.5 mt-1">
          <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={newMatchSame}>{labels.playAgain}</ArcadeButton>
          <ArcadeButton size={portrait ? 'xl' : 'md'} tone="dark" onClick={onMenu}>{labels.menu}</ArcadeButton>
        </div>
      </ArcadePanel>
    </ArcadeOverlay>
  )

  /* ---------- Layouts ---------- */
  let table: React.ReactNode
  if (portrait) {
    const cellW = Math.floor((screenW - 8) / 2)
    const rcols = 10
    const rtw = Math.floor((cellW - 4) / rcols) - 2
    const rth = Math.round(rtw * 1.35)
    const handRows = [items.slice(0, 7), items.slice(7)]
    table = (
      <div className="absolute inset-0 flex flex-col" style={{ padding: '2px 4px 0' }}>
        <div className="grid flex-shrink-0" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, minHeight: 60 }}>
          {plate(3, { backs: 'row', melds: true })}
          {plate(2, { backs: 'row', melds: true })}
          {plate(1, { backs: 'row', melds: true })}
        </div>
        <div className="relative flex-1 min-h-0">
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '4px 6px', paddingTop: 4 }}>
            {[3, 2, 1, 0].map((s) => (
              <div key={s} className="flex flex-col items-start" style={{ gap: 1 }}>
                <span style={{ fontSize: 10, color: MUTED, lineHeight: 1, ...PIXEL_FONT }}>{labels.winds[seatWind(game, s) - 1][0]} {nameOf(s)}</span>
                {riverFor(s, rtw, rth, rcols)}
              </div>
            ))}
          </div>
          {claimPanel}
          {waits.length > 0 && <div className="absolute left-0 right-0 bottom-0 flex justify-center">{waitRow}</div>}
        </div>
        <div className="flex-shrink-0 text-center" style={{ fontSize: 12, color: ARCADE.panelText, minHeight: 16, lineHeight: 1.25, ...PIXEL_FONT }}>
          <span style={{ color: ARCADE.amber }}>{fmt(labels.windRound, { wind: labels.winds[game.prevailing - 1] })}</span>{' '}
          {fmt(labels.wall, { n: game.wall.length })} · {lastLines[0] ?? statusText}
        </div>
        <div className="flex-shrink-0">{yourMelds}</div>
        <div className="flex-shrink-0" style={{ paddingTop: 6 }} role="group" aria-label={labels.handAria}>
          {handRows.map((row, r) => (
            <div key={r} className="flex" style={{ gap: 3, minHeight: PH + 7, alignItems: 'flex-end', paddingBottom: 4 }}>{row.map((it, j) => handTile(it, r * 7 + j))}</div>
          ))}
        </div>
        <div className="flex-shrink-0 flex items-center justify-center gap-1.5" style={{ height: 38 }}>{actionButtons}</div>
      </div>
    )
  } else {
    const SIDE = 60
    table = (
      <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: `${SIDE}px 1fr ${SIDE}px`, gridTemplateRows: '40px 1fr 68px', padding: '2px 3px' }}>
        <div style={{ gridColumn: 2, gridRow: 1 }} className="flex justify-center">{plate(2, { backs: 'row', melds: true })}</div>
        <div style={{ gridColumn: 1, gridRow: 2 }} className="flex flex-col" >
          {plate(3, { backs: 'none', melds: true })}
          <div className="flex-1 min-h-0 flex items-start" style={{ paddingTop: 2 }}>
            <Backs n={game.seats[3].hand.length} w={16} h={8} vertical depth={1} />
          </div>
        </div>
        <div style={{ gridColumn: 3, gridRow: 2 }} className="flex flex-col">
          {plate(1, { backs: 'none', melds: true })}
          <div className="flex-1 min-h-0 flex items-start justify-end" style={{ paddingTop: 2 }}>
            <Backs n={game.seats[1].hand.length} w={16} h={8} vertical depth={1} />
          </div>
        </div>
        <div style={{ gridColumn: 2, gridRow: 2 }} className="relative">
          <div className="absolute left-1/2 top-0" style={{ transform: 'translateX(-50%)' }}>{riverFor(2, 13, 18, 8)}</div>
          <div className="absolute left-1/2 bottom-0" style={{ transform: 'translateX(-50%)' }}>{riverFor(0, 13, 18, 8)}</div>
          <div className="absolute left-0 top-1/2" style={{ transform: 'translateY(-50%)' }}>{riverFor(3, 13, 18, 8)}</div>
          <div className="absolute right-0 top-1/2" style={{ transform: 'translateY(-50%)' }}>{riverFor(1, 13, 18, 8)}</div>
          <div className="absolute flex items-center justify-center" style={{ left: 120, right: 120, top: 62, bottom: 62 }}>{info}</div>
          {claimPanel}
        </div>
        <div style={{ gridColumn: '1 / 4', gridRow: 3 }} className="flex flex-col justify-end">
          <div className="flex items-end justify-between" style={{ gap: 6 }}>
            {yourMelds}
            <div className="flex items-center justify-end gap-1" style={{ minHeight: 22 }}>{actionButtons}</div>
          </div>
          <div className="flex items-end" style={{ paddingTop: 8, paddingBottom: 4 }} role="group" aria-label={labels.handAria}>
            {items.map((it, i) => handTile(it, i))}
            <span className="flex-1 min-w-0 self-center" style={{ fontSize: 9, color: MUTED, lineHeight: 1.3, paddingLeft: 8, ...PIXEL_FONT }}>{labels.fourKeys}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <ArcadeStrip time={chrome.time} fs={chrome.fs} arcade={chrome.arcade} desktopLabel={chrome.desktopLabel} backLabel={chrome.backLabel} onDesktop={chrome.onDesktop} onBack={chrome.onBack}>
        <ArcadeButton size={portrait ? 'xl' : 'sm'} tone="dark" onClick={onMenu}>{labels.menu}</ArcadeButton>
        {chrome.help}
      </ArcadeStrip>
      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: TABLE_BG }}>
        {table}
        {resultPanel}
        {matchPanel}
        {dealing && !helpOpen && (
          <AutoTable
            key={`${game.opts.seed}-${game.handNo}`}
            seed={(game.opts.seed + game.handNo * 7919) >>> 0}
            dealer={game.dealer}
            hand={game.seats[0].hand}
            speed={prefs.speed}
            w={screenW}
            h={bodyH}
            portrait={portrait}
            labels={labels.autoTable}
            onDone={() => setDealing(false)}
          />
        )}
        <div aria-live="polite" className="sr-only">{announce}</div>
      </div>
    </>
  )
}
