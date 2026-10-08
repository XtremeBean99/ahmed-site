// src/components/room/mahjong/Solitaire.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ArcadeButton, ArcadeOverlay, ArcadePanel, ArcadeStrip, ARCADE, PIXEL_FONT } from '../DeskArcade'
import { PORTRAIT_STRIP_H, useDeskScreen } from '../ScreenStrip'
import { useSfx } from '../RoomSfxProvider'
import {
  LAYOUTS,
  freeTiles,
  hint as findHint,
  isStuck,
  isWon,
  newGame,
  renderOrder,
  selectTile,
  shuffleRemaining,
  tilesLeft,
  undo as undoMove,
  type LayoutId,
  type SolitaireState,
} from '@/lib/games/mahjong-solitaire'
import { mulberry32, tileName } from '@/lib/games/mahjong-tiles'
import type { MahjongChrome } from './chrome'
import { MUTED, TABLE_BG } from './chrome'
import type { MahjongLabels } from './labels'
import { TileView } from './tile-art'
import { tileInfo } from './tile-info'
import { clearSave, fmtTime, loadStats, recordSolitaireWin, writeSave, type Prefs, type Stats } from './mahjong-store'

interface Props {
  chrome: MahjongChrome
  labels: MahjongLabels
  prefs: Prefs
  initial: { game: SolitaireState; elapsed: number }
  onMenu: () => void
}

const SIDE_W = 128
const HUD_H = 44

const randomSeed = () => Math.floor(Math.random() * 2147483647)

/** Layout extents in half-tile units. */
function extents(id: LayoutId) {
  let gw = 0
  let gh = 0
  let zmax = 0
  for (const p of LAYOUTS[id].positions) {
    gw = Math.max(gw, p.x + 2)
    gh = Math.max(gh, p.y + 2)
    zmax = Math.max(zmax, p.z)
  }
  return { gw, gh, zmax }
}

export function MahjongSolitaire({ chrome, labels, prefs, initial, onMenu }: Props) {
  const { tone } = useSfx()
  const reduceMotion = useReducedMotion() === true
  const { w: screenW, h: screenH, portrait } = useDeskScreen()

  const [game, setGame] = useState<SolitaireState>(initial.game)
  const [elapsed, setElapsed] = useState(initial.elapsed)
  const [hintPair, setHintPair] = useState<[number, number] | null>(null)
  const [flash, setFlash] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const [stuckOpen, setStuckOpen] = useState(false)
  const [overShown, setOverShown] = useState(false)
  const [stats, setStats] = useState<Stats>(loadStats)
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [shake, setShake] = useState<number | null>(null)

  const gameRef = useRef(game)
  const wonRef = useRef(isWon(initial.game))
  const seedRef = useRef(initial.game.seed)

  const won = isWon(game)
  const stuck = !won && isStuck(game)
  const left = tilesLeft(game)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  /* ---------- Free tiles and geometry ---------- */
  const free = useMemo(() => new Set(freeTiles(game).map((t) => t.id)), [game])
  const order = useMemo(() => renderOrder(game), [game])
  const ext = useMemo(() => extents(game.layoutId), [game.layoutId])

  const bodyH = portrait ? screenH - 2 * PORTRAIT_STRIP_H : 280
  const areaW = portrait ? screenW - 8 : 536 - SIDE_W - 6
  const areaH = portrait ? bodyH - HUD_H - 6 : bodyH - 8
  const geo = useMemo(() => {
    const dz = areaW / ext.gw > 17 ? 3 : 2
    const pad = dz + 2
    let u = Math.floor((areaW - ext.zmax * dz - pad) / ext.gw)
    let v = Math.floor((areaH - ext.zmax * dz - pad) / ext.gh)
    v = Math.min(v, Math.floor(u * (portrait ? 1.6 : 1.4)))
    u = Math.max(4, Math.min(u, Math.floor(v / 1.15)))
    v = Math.max(5, v)
    return {
      u,
      v,
      dz,
      w: ext.gw * u + ext.zmax * dz + pad,
      h: ext.gh * v + ext.zmax * dz + pad,
      tw: 2 * u,
      th: 2 * v,
    }
  }, [areaW, areaH, ext, portrait])

  /* ---------- Timer and save ---------- */
  // The clock stops while How to play is open.
  const helpOpen = chrome.helpOpen
  useEffect(() => {
    if (won || helpOpen) return
    const id = window.setInterval(() => {
      if (!document.hidden) setElapsed((e) => e + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [won, helpOpen])

  const saveBucket = Math.floor(elapsed / 5)
  useEffect(() => {
    if (!isWon(game)) writeSave({ mode: 'solitaire', game, elapsed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, saveBucket])

  // Cleared: record the time once, drop the save.
  useEffect(() => {
    if (!won || wonRef.current) return
    wonRef.current = true
    clearSave()
    const r = recordSolitaireWin(game.layoutId, elapsed)
    setStats(r.stats)
    setNewBest(r.isBest)
    setOverShown(true)
    setStuckOpen(false)
    tone('win')
    setAnnounce(labels.clearedBody.replace('{time}', fmtTime(elapsed)).replace('{layout}', labels.layouts[game.layoutId]))
  }, [won, game.layoutId, elapsed, labels, tone])

  useEffect(() => {
    if (stuck) setStuckOpen(true)
    else setStuckOpen(false)
  }, [stuck, game])

  /* ---------- Hint flash ---------- */
  useEffect(() => {
    if (!hintPair) return
    setFlash(true)
    const stop = window.setTimeout(() => setHintPair(null), 2200)
    const blink = reduceMotion ? 0 : window.setInterval(() => setFlash((f) => !f), 260)
    return () => {
      window.clearTimeout(stop)
      if (blink) window.clearInterval(blink)
    }
  }, [hintPair, reduceMotion])

  useEffect(() => {
    if (shake === null) return
    const id = window.setTimeout(() => setShake(null), 220)
    return () => window.clearTimeout(id)
  }, [shake])

  /* ---------- Actions ---------- */
  const commit = useCallback((next: SolitaireState) => {
    gameRef.current = next
    setGame(next)
    setHintPair(null)
  }, [])

  const tapTile = useCallback(
    (id: number) => {
      const g = gameRef.current
      if (isWon(g)) return
      if (!free.has(id)) {
        tone('invalid')
        setShake(id)
        return
      }
      const next = selectTile(g, id)
      if (next === g) return
      const removed = tilesLeft(next) < tilesLeft(g)
      tone(removed ? 'brick' : 'select')
      if (removed) setAnnounce(`${tileName(g.tiles[id].code)} ${tilesLeft(next)}`)
      commit(next)
    },
    [free, tone, commit],
  )

  const doHint = useCallback(() => {
    const g = gameRef.current
    if (isWon(g)) return
    const m = findHint(g)
    if (!m) {
      setAnnounce(labels.noHint)
      tone('invalid')
      return
    }
    setHintPair(m)
    setAnnounce(`${labels.hint}: ${tileName(g.tiles[m[0]].code)}`)
    tone('blip')
  }, [labels, tone])

  const doUndo = useCallback(() => {
    const g = gameRef.current
    if (g.history.length === 0) return
    tone('select')
    commit(undoMove(g))
  }, [tone, commit])

  const doShuffle = useCallback(() => {
    const g = gameRef.current
    if (isWon(g)) return
    tone('shuffle')
    commit(shuffleRemaining(g, mulberry32(randomSeed())))
  }, [tone, commit])

  const playAgain = useCallback(() => {
    const seed = randomSeed()
    seedRef.current = seed
    const g = newGame(gameRef.current.layoutId, seed)
    wonRef.current = false
    gameRef.current = g
    setGame(g)
    setElapsed(0)
    setHintPair(null)
    setOverShown(false)
    setNewBest(false)
    setStuckOpen(false)
    tone('deal')
  }, [tone])

  /* ---------- Keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && e.ctrlKey) {
        e.preventDefault()
        doUndo()
      } else if (e.ctrlKey) {
        return
      } else if (k === 'h') doHint()
      else if (k === 'u') doUndo()
      else if (k === 'n') onMenu()
      else if (k === 's') doShuffle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doHint, doUndo, doShuffle, onMenu])

  // Escape closes the innermost layer first (a panel, then the selection) before DeskView's ladder sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement || helpOpen) return
      if (overShown) setOverShown(false)
      else if (stuckOpen) setStuckOpen(false)
      else if (gameRef.current.selected !== null) commit({ ...gameRef.current, selected: null })
      else return
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [overShown, stuckOpen, commit, helpOpen])

  /* ---------- Rendering ---------- */
  const blurClick = (fn: () => void) => (e: React.MouseEvent) => {
    fn()
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur()
  }
  const btnSize = portrait ? 'xl' : 'sm'
  const toolbar = (
    <>
      <ArcadeButton size={btnSize} tone="dark" onClick={blurClick(doHint)} disabled={won}>{labels.hint}</ArcadeButton>
      <ArcadeButton size={btnSize} tone="dark" onClick={blurClick(doUndo)} disabled={game.history.length === 0}>{labels.undo}</ArcadeButton>
      <ArcadeButton size={btnSize} tone="dark" onClick={blurClick(doShuffle)} disabled={won}>{labels.shuffle}</ArcadeButton>
      <ArcadeButton size={btnSize} tone="dark" onClick={onMenu}>{labels.newGame}</ArcadeButton>
      {chrome.help}
    </>
  )

  const previewId = hover ?? game.selected
  const previewTile = previewId !== null && !game.tiles[previewId].removed ? game.tiles[previewId] : null

  const board = (
    <div
      role="group"
      aria-label={labels.board}
      className="relative flex-shrink-0"
      style={{ width: geo.w, height: geo.h, touchAction: 'manipulation' }}
    >
      {order.map((t) => {
        const isFree = free.has(t.id)
        const sel = game.selected === t.id
        const hinted = hintPair !== null && (hintPair[0] === t.id || hintPair[1] === t.id)
        const lift = sel ? 2 : 0
        const dx = shake === t.id ? 2 : 0
        return (
          <button
            key={t.id}
            type="button"
            tabIndex={-1}
            aria-label={`${tileName(t.code)}, ${isFree ? labels.free : labels.blocked}${sel ? ', selected' : ''}`}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return
              e.preventDefault()
              tapTile(t.id)
            }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(t.id) }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover((h) => (h === t.id ? null : h)) }}
            className="absolute p-0 border-0 bg-transparent outline-none"
            style={{
              left: t.x * geo.u - t.z * geo.dz + ext.zmax * geo.dz + dx,
              top: t.y * geo.v - t.z * geo.dz + ext.zmax * geo.dz - lift,
              width: geo.tw,
              height: geo.th,
              cursor: isFree ? 'pointer' : 'default',
              touchAction: 'manipulation',
            }}
          >
            <TileView
              code={t.code}
              w={geo.tw}
              h={geo.th}
              depth={geo.dz}
              selected={sel}
              highlight={hinted && flash}
              dim={prefs.dim && !isFree}
              accent={sel ? ARCADE.amber : hinted ? ARCADE.teal : undefined}
            />
          </button>
        )
      })}
    </div>
  )

  // The name, plus the Chinese and how to say it, so a tap on a phone tells as much as a hover.
  const previewText = (code: string) => {
    const info = tileInfo(code, labels.tileInfo)
    if (!info) return tileName(code)
    return info.pinyin ? `${info.name} · ${info.glyph} ${info.pinyin}` : info.name
  }
  const previewW = portrait ? 24 : 44
  const preview = (
    <div className="flex items-center gap-2 min-w-0" style={{ minHeight: previewW * 1.4 + 4 }}>
      <div style={{ width: previewW + 4, height: previewW * 1.4 + 4, flexShrink: 0 }}>
        {previewTile && <TileView code={previewTile.code} w={previewW} h={Math.round(previewW * 1.4)} depth={2} style={{ margin: 1 }} />}
      </div>
      <span className="min-w-0" style={{ fontSize: portrait ? 12 : 10, lineHeight: 1.25, color: ARCADE.panelText, ...PIXEL_FONT }}>
        {previewTile ? previewText(previewTile.code) : portrait ? labels.tapHint : ''}
      </span>
    </div>
  )

  const counters = (
    <div style={{ fontSize: portrait ? 12 : 10, lineHeight: 1.45, color: ARCADE.panelText, ...PIXEL_FONT }}>
      <div>{labels.tiles} {left}</div>
      <div>{labels.time} {fmtTime(elapsed)}</div>
    </div>
  )

  const rec = stats.solitaire[game.layoutId]
  const bestText = rec.best > 0 ? labels.best.replace('{layout}', labels.layouts[game.layoutId]).replace('{time}', fmtTime(rec.best)) : labels.noBest

  return (
    <>
      <ArcadeStrip time={chrome.time} fs={chrome.fs} arcade={chrome.arcade} desktopLabel={chrome.desktopLabel} backLabel={chrome.backLabel} onDesktop={chrome.onDesktop} onBack={chrome.onBack}>
        {toolbar}
      </ArcadeStrip>

      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: TABLE_BG }}>
        {portrait ? (
          <div className="absolute inset-0 flex flex-col items-center">
            <div className="flex items-center justify-between w-full flex-shrink-0 px-2" style={{ height: HUD_H }}>
              {counters}
              {preview}
            </div>
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">{board}</div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center">
            <div className="flex items-center justify-center" style={{ width: 536 - SIDE_W, height: '100%' }}>{board}</div>
            <div className="flex flex-col justify-between self-stretch" style={{ width: SIDE_W, padding: '8px 8px 6px 0' }}>
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: 10, color: ARCADE.amber, ...PIXEL_FONT }}>{labels.layouts[game.layoutId]}</div>
                {counters}
                <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.3, ...PIXEL_FONT }}>{bestText}</div>
              </div>
              <div className="flex flex-col gap-1">
                {preview}
                <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.3, ...PIXEL_FONT }}>{labels.hintKeys}</div>
              </div>
            </div>
          </div>
        )}

        {stuckOpen && !overShown && (
          <ArcadeOverlay tint="rgba(12,8,6,0.45)">
            <ArcadePanel className="px-5 py-3 text-center" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', maxWidth: 280 }}>
              <p style={{ margin: 0, fontSize: portrait ? 15 : 13 }}>{labels.stuckTitle}</p>
              <p style={{ margin: 0, fontSize: portrait ? 12 : 10, color: MUTED }}>{labels.stuckBody}</p>
              <div className="flex gap-1.5 mt-1">
                <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={doShuffle}>{labels.shuffle}</ArcadeButton>
                <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={doUndo} disabled={game.history.length === 0}>{labels.undo}</ArcadeButton>
                <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={() => setStuckOpen(false)}>{labels.close}</ArcadeButton>
              </div>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        {won && overShown && (
          <ArcadeOverlay>
            <ArcadePanel className="px-6 py-4 text-center" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: portrait ? 16 : 14 }}>{labels.clearedTitle}</p>
              <p style={{ margin: 0, fontSize: portrait ? 12 : 10 }}>
                {labels.clearedBody.replace('{time}', fmtTime(elapsed)).replace('{layout}', labels.layouts[game.layoutId])}
              </p>
              <p style={{ margin: 0, fontSize: portrait ? 12 : 10, color: newBest ? ARCADE.amber : MUTED }}>
                {newBest ? labels.newBest : bestText}
              </p>
              <div className="flex gap-1.5 mt-1">
                <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={playAgain}>{labels.playAgain}</ArcadeButton>
                <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={onMenu}>{labels.menu}</ArcadeButton>
              </div>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        <div aria-live="polite" className="sr-only">{announce}</div>
      </div>
    </>
  )
}
