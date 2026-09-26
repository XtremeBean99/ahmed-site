'use client'

import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, JSX, MutableRefObject } from 'react'
import { useT } from '@/lib/i18n/client'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { RESOURCES } from '@/lib/games/catan/constants'
import { totalCards } from '@/lib/games/catan/helpers'
import type { DevCardType, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { edgePoint, hexCenter, vertexPoint } from '../board-layout'
import type { BoardView } from '../BoardCanvas'
import { fill, playerObject, playerSubject } from '../event-text'
import { PLAYER_HEX } from '../player-colors'
import { getCatanPrefsStorage, readPrefs } from '../prefs'
import type { CatanSound } from '../sound'
import { COLORS, PIXEL_FONT } from '../ui'
import { UI_SPRITES } from '../ui-sprites'
import type { UiSpriteName } from '../ui-sprites'
import { effectsFor } from './effects'
import type { BuildEffect, Effect } from './effects'

export type { BoardView }

export interface BoardOverrides {
  highlightHexes: number[]
  robberHex?: number | null
  hiddenPieces: { vertices: number[]; edges: number[] }
}

export interface EffectsLayerProps {
  game: GameState
  human: PlayerId
  boardViewRef: MutableRefObject<BoardView | null>
  animations: boolean
  sound: CatanSound
  onBoardOverrides: (o: BoardOverrides) => void
}

const Z_INDEX = 40

const DICE_TUMBLE_MS = 700
const DICE_HOLD_MS = 300
const DICE_FACE_MS = 70
const DICE_SLIDE_MS = 250
const PRODUCE_HIGHLIGHT_MS = 1600
const FLY_MS = 550
const FLY_STAGGER_MS = 60
const MAX_FLYERS = 16
const ROBBER_HOP_MS = 450
const STEAL_FLY_MS = 500
const BUILD_HIDE_MS = 120
const BUILD_PUFF_MS = 300
const BANNER_TURN_MS = 1200
const BANNER_PLAYED_MS = 1400
const BANNER_AWARD_MS = 1600
const BANNER_STEAL_MS = 1600
const BANNER_SUMMARY_MS = 1500
const BANNER_MAX_QUEUE = 3

const DEV_CARD_SPRITES: Record<Exclude<DevCardType, 'victoryPoint'>, UiSpriteName> = {
  knight: 'card-knight',
  roadBuilding: 'card-road-building',
  yearOfPlenty: 'card-year-of-plenty',
  monopoly: 'card-monopoly',
}

interface Point {
  x: number
  y: number
}

interface BannerSpec {
  text: string
  sprite?: UiSpriteName
  spriteScale?: number
  durationMs: number
}

interface RunnerState {
  root: HTMLElement | null
  game: GameState
  human: PlayerId
  boardViewRef: MutableRefObject<BoardView | null>
  animations: boolean
  sound: CatanSound
  t: Dictionary
  onBoardOverrides: (o: BoardOverrides) => void
  timers: Set<ReturnType<typeof setTimeout>>
  running: Set<Animation>
  elements: Set<HTMLElement>
  banners: BannerSpec[]
  bannerShowing: boolean
  motion: boolean
  highlights: boolean
  timeScale: number
  overrides: BoardOverrides
}

function setOverrides(s: RunnerState, patch: Partial<BoardOverrides>): void {
  const next: BoardOverrides = {
    highlightHexes: patch.highlightHexes ?? s.overrides.highlightHexes,
    robberHex: Object.prototype.hasOwnProperty.call(patch, 'robberHex') ? patch.robberHex : s.overrides.robberHex,
    hiddenPieces: patch.hiddenPieces ?? s.overrides.hiddenPieces,
  }
  s.overrides = next
  s.onBoardOverrides(next)
}

function resetFx(s: RunnerState | null, notifyBoard: boolean): void {
  if (!s) return
  for (const animation of s.running) {
    try {
      animation.cancel()
    } catch {
      // already cancelled
    }
  }
  s.running.clear()
  for (const el of s.elements) el.remove()
  s.elements.clear()
  for (const id of s.timers) clearTimeout(id)
  s.timers.clear()
  s.banners.length = 0
  s.bannerShowing = false
  if (notifyBoard) {
    setOverrides(s, { highlightHexes: [], robberHex: undefined, hiddenPieces: { vertices: [], edges: [] } })
  }
}

function after(s: RunnerState, ms: number, fn: () => void): void {
  const id = setTimeout(() => {
    s.timers.delete(id)
    fn()
  }, ms)
  s.timers.add(id)
}

function removeEl(s: RunnerState, el: HTMLElement): void {
  el.remove()
  s.elements.delete(el)
}

const UNITLESS_KEYS = new Set(['opacity', 'zIndex', 'lineHeight'])

function applyStyle(el: HTMLElement, style: CSSProperties): void {
  const target = el.style as unknown as Record<string, string>
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue
    target[key] = typeof value === 'number' && !UNITLESS_KEYS.has(key) ? `${value}px` : String(value)
  }
}

function makeEl(s: RunnerState, style: CSSProperties): HTMLElement {
  const el = document.createElement('div')
  applyStyle(el, style)
  s.root?.appendChild(el)
  s.elements.add(el)
  return el
}

function animate(
  s: RunnerState,
  el: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  onDone?: () => void,
): void {
  if (!el.animate) {
    after(s, Number(options.duration ?? 0), () => {
      removeEl(s, el)
      onDone?.()
    })
    return
  }
  const animation = el.animate(keyframes, options)
  s.running.add(animation)
  const finish = () => {
    s.running.delete(animation)
    removeEl(s, el)
    onDone?.()
  }
  const cancel = () => {
    s.running.delete(animation)
    removeEl(s, el)
  }
  animation.finished.then(finish, cancel)
}

function anchorCenter(name: string): Point | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`[data-catan-anchor="${name}"]`)
  if (!(el instanceof HTMLElement)) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
}

function boardRect(): DOMRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('[data-tutorial="board"]')
  if (!(el instanceof HTMLElement)) return null
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : null
}

function boardCenter(): Point | null {
  const rect = boardRect()
  if (!rect) return null
  return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
}

function boardPoint(s: RunnerState, p: Point): Point | null {
  const view = s.boardViewRef.current
  if (view) {
    const client = view.toClient(p)
    if (Number.isFinite(client.x) && Number.isFinite(client.y)) {
      return { x: Math.round(client.x), y: Math.round(client.y) }
    }
  }
  return boardCenter()
}

function playerAnchor(s: RunnerState, player: PlayerId): Point | null {
  return anchorCenter(`player-${player}`)
}

function receiverAnchor(s: RunnerState, player: PlayerId, resource: Resource): Point | null {
  if (player === s.human) {
    return anchorCenter(`hand-${resource}`) ?? anchorCenter('hand') ?? playerAnchor(s, player)
  }
  return playerAnchor(s, player)
}

function flySprite(
  s: RunnerState,
  name: UiSpriteName,
  from: Point,
  to: Point,
  delayMs: number,
  durationMs: number,
  scale = 1,
  arc = 14,
): void {
  after(s, delayMs, () => {
    if (!s.motion) return
    const meta = UI_SPRITES[name]
    const width = meta.width * scale
    const height = meta.height * scale
    const el = makeEl(s, {
      position: 'fixed',
      left: from.x,
      top: from.y,
      width,
      height,
      backgroundImage: `url(/catan/${meta.file})`,
      backgroundSize: `${width}px ${height}px`,
      imageRendering: 'pixelated',
      transform: 'translate(-50%, -50%)',
    })
    const dx = to.x - from.x
    const dy = to.y - from.y
    animate(
      s,
      el,
      [
        { transform: 'translate(-50%, -50%) translate(0px, 0px)' },
        { transform: `translate(-50%, -50%) translate(${Math.round(dx / 2)}px, ${Math.round(dy / 2) - arc}px)`, offset: 0.5 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)` },
      ],
      { duration: durationMs, easing: 'ease-in-out' },
    )
  })
}

function flyCounts(s: RunnerState, from: Point, to: Point, counts: ResourceCounts, startDelayMs: number): void {
  const resources: Resource[] = []
  for (const r of RESOURCES) {
    for (let i = 0; i < counts[r]; i++) resources.push(r)
  }
  resources.slice(0, MAX_FLYERS).forEach((resource, i) => {
    flySprite(s, `card-${resource}` as UiSpriteName, from, to, startDelayMs + i * FLY_STAGGER_MS, FLY_MS, 1, 12)
  })
}

function popCount(s: RunnerState, at: Point, text: string, delayMs: number): void {
  after(s, delayMs, () => {
    if (!s.motion) return
    const el = makeEl(s, {
      ...PIXEL_FONT,
      position: 'fixed',
      left: at.x + 12,
      top: at.y - 12,
      fontSize: 12,
      color: COLORS.text,
      backgroundColor: COLORS.panelDark,
      border: `2px solid ${COLORS.panelBorder}`,
      padding: '1px 4px',
      lineHeight: 1.2,
    })
    el.textContent = text
    animate(
      s,
      el,
      [
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-10px)', opacity: 0 },
      ],
      { duration: 500, easing: 'ease-out', fill: 'forwards' },
    )
  })
}

function enqueueBanner(s: RunnerState, banner: BannerSpec): void {
  s.banners.push(banner)
  while (s.banners.length > BANNER_MAX_QUEUE) s.banners.shift()
  pumpBanners(s)
}

function pumpBanners(s: RunnerState): void {
  if (s.bannerShowing) return
  const next = s.banners.shift()
  if (!next) return
  s.bannerShowing = true
  showOneBanner(s, next)
}

function showOneBanner(s: RunnerState, banner: BannerSpec): void {
  const rect = boardRect()
  const left = rect ? Math.round(rect.left + rect.width / 2) : Math.round(window.innerWidth / 2)
  const top = rect ? Math.round(rect.top + 8) : 8
  const el = makeEl(s, {
    position: 'fixed',
    left,
    top,
    transform: 'translate(-50%, 0)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    backgroundColor: COLORS.panel,
    border: `2px solid ${COLORS.panelBorder}`,
    boxShadow: '2px 2px 0 #1a0e04',
    color: COLORS.text,
    ...PIXEL_FONT,
    fontSize: 12,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    maxWidth: 'min(90vw, 520px)',
    zIndex: Z_INDEX,
  })
  if (banner.sprite) {
    const meta = UI_SPRITES[banner.sprite]
    const scale = banner.spriteScale ?? 2
    const img = document.createElement('img')
    img.src = `/catan/${meta.file}`
    img.width = meta.width * scale
    img.height = meta.height * scale
    img.style.imageRendering = 'pixelated'
    img.alt = ''
    el.appendChild(img)
  }
  const text = document.createElement('span')
  text.textContent = banner.text
  el.appendChild(text)

  const finish = () => {
    removeEl(s, el)
    s.bannerShowing = false
    pumpBanners(s)
  }
  if (s.motion) {
    el.animate(
      [{ transform: 'translate(-50%, -8px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }],
      { duration: 160, easing: 'ease-out', fill: 'forwards' },
    )
    after(s, 160 + banner.durationMs, () => {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
      after(s, 160, finish)
    })
    return
  }
  after(s, banner.durationMs, finish)
}

function playDice(s: RunnerState, effect: Extract<Effect, { kind: 'dice' }>): void {
  s.sound.play('dice')
  if (!s.motion) {
    after(s, 120, () => s.sound.play('land'))
    return
  }
  const start = boardCenter() ?? anchorCenter('dice')
  const target = anchorCenter('dice') ?? start
  if (!start || !target) return
  const container = makeEl(s, {
    position: 'fixed',
    left: start.x,
    top: start.y,
    display: 'flex',
    gap: 8,
    transform: 'translate(-50%, -50%)',
  })
  const dieA = document.createElement('img')
  const dieB = document.createElement('img')
  for (const img of [dieA, dieB]) {
    img.width = 48
    img.height = 48
    img.style.imageRendering = 'pixelated'
    img.alt = ''
    container.appendChild(img)
  }
  const setFaces = (faces: [number, number]) => {
    dieA.src = `/catan/die-${faces[0]}.png`
    dieB.src = `/catan/die-${faces[1]}.png`
  }
  const changeFaces = (remaining: number) => {
    if (remaining <= 0) return
    setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
    const jx = Math.round((Math.random() - 0.5) * 6)
    const jy = Math.round((Math.random() - 0.5) * 6)
    container.style.transform = `translate(-50%, -50%) translate(${jx}px, ${jy}px)`
    after(s, DICE_FACE_MS, () => changeFaces(remaining - 1))
  }
  changeFaces(Math.floor(DICE_TUMBLE_MS / DICE_FACE_MS))
  after(s, DICE_TUMBLE_MS, () => {
    setFaces(effect.dice)
    s.sound.play('land')
    const squash = container.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)' },
        { transform: 'translate(-50%, -50%) scale(1.12, 0.72)' },
        { transform: 'translate(-50%, -50%) scale(1)' },
      ],
      { duration: 90, easing: 'steps(2, end)' },
    )
    s.running.add(squash)
    const done = () => s.running.delete(squash)
    squash.finished.then(done, done)
  })
  after(s, DICE_TUMBLE_MS + DICE_HOLD_MS, () => {
    const dx = target.x - start.x
    const dy = target.y - start.y
    animate(
      s,
      container,
      [
        { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)' },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.34)` },
      ],
      { duration: DICE_SLIDE_MS, easing: 'ease-in' },
    )
  })
}

function flashBlocked(s: RunnerState, hex: number): void {
  const p = boardPoint(s, hexCenter(hex))
  if (!p) return
  const size = 16
  const el = makeEl(s, { position: 'fixed', left: p.x, top: p.y, width: size, height: size, transform: 'translate(-50%, -50%)' })
  const bar = (vertical: boolean) => {
    const child = document.createElement('div')
    applyStyle(child, vertical ? { position: 'absolute', left: 7, top: 0, width: 2, height: 16 } : { position: 'absolute', left: 0, top: 7, width: 16, height: 2 })
    child.style.backgroundColor = COLORS.dangerText
    el.appendChild(child)
  }
  bar(false)
  bar(true)
  animate(
    s,
    el,
    [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
    { duration: 600, easing: 'ease-in-out' },
  )
}

function playProduce(s: RunnerState, effect: Extract<Effect, { kind: 'produce' }>): void {
  if (s.highlights && (effect.hexes.length > 0 || effect.blockedHex !== null)) {
    setOverrides(s, { highlightHexes: effect.hexes })
    after(s, PRODUCE_HIGHLIGHT_MS, () => setOverrides(s, { highlightHexes: [] }))
  }
  if (s.motion && effect.blockedHex !== null) flashBlocked(s, effect.blockedHex)

  const entries: { player: PlayerId; resource: Resource; count: number }[] = []
  const receiverTotals = new Map<PlayerId, number>()
  effect.gains.forEach((gains, player) => {
    const total = totalCards(gains)
    if (total > 0) receiverTotals.set(player, total)
    for (const r of RESOURCES) {
      if (gains[r] > 0) entries.push({ player, resource: r, count: gains[r] })
    }
  })

  const flyers = entries.flatMap((entry) => Array.from({ length: entry.count }, () => entry)).slice(0, MAX_FLYERS)
  const firstFlyer = new Map<PlayerId, number>()
  flyers.forEach((flyer, i) => {
    if (!firstFlyer.has(flyer.player)) firstFlyer.set(flyer.player, i)
    const hex = effect.hexes.length > 0 ? effect.hexes[i % effect.hexes.length] : null
    if (hex === null) return
    const from = boardPoint(s, hexCenter(hex))
    const to = receiverAnchor(s, flyer.player, flyer.resource)
    if (!from || !to) return
    flySprite(s, `icon-${flyer.resource}` as UiSpriteName, from, to, i * FLY_STAGGER_MS, FLY_MS, 2)
  })

  for (const [player, total] of receiverTotals) {
    const resource = entries.find((entry) => entry.player === player)?.resource ?? 'grain'
    const arrival = (firstFlyer.get(player) ?? 0) * FLY_STAGGER_MS + FLY_MS
    after(s, arrival, () => s.sound.play('gain'))
    const to = receiverAnchor(s, player, resource)
    if (to) popCount(s, to, `+${total}`, arrival)
  }
}

function playRobber(s: RunnerState, effect: Extract<Effect, { kind: 'robber' }>): void {
  s.sound.play('robber')
  if (!s.motion) return
  const view = s.boardViewRef.current
  const scale = Math.max(1, Math.round(view?.scale ?? 2))
  const fromPoint = boardPoint(s, { x: hexCenter(effect.from).x - 4, y: hexCenter(effect.from).y - 6 })
  const toPoint = boardPoint(s, { x: hexCenter(effect.to).x - 4, y: hexCenter(effect.to).y - 6 })
  if (!fromPoint || !toPoint) return
  setOverrides(s, { robberHex: null })
  const width = 9 * scale
  const height = 13 * scale
  const el = makeEl(s, {
    position: 'fixed',
    left: fromPoint.x,
    top: fromPoint.y,
    width,
    height,
    backgroundImage: 'url(/catan/robber.png)',
    backgroundSize: `${width}px ${height}px`,
    imageRendering: 'pixelated',
  })
  const dx = toPoint.x - fromPoint.x
  const dy = toPoint.y - fromPoint.y
  const arc = Math.round(16 * scale)
  animate(
    s,
    el,
    [
      { transform: 'translate(0px, 0px)' },
      { transform: `translate(${Math.round(dx / 2)}px, ${Math.round(dy / 2) - arc}px)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px)` },
    ],
    { duration: Math.round(ROBBER_HOP_MS * s.timeScale), easing: 'ease-in-out' },
    () => setOverrides(s, { robberHex: undefined }),
  )
}

function playSteal(s: RunnerState, effect: Extract<Effect, { kind: 'steal' }>): void {
  s.sound.play('steal')
  if (effect.resource !== null && (effect.thief === s.human || effect.victim === s.human)) {
    const text = fill(s.t.catan.effects.stoleResource, {
      subject: playerSubject(s.game, effect.thief),
      object: playerObject(s.game, effect.victim),
      resource: s.t.catan.resources[effect.resource],
    })
    enqueueBanner(s, { text, durationMs: BANNER_STEAL_MS })
  }
  if (!s.motion || effect.resource === null) return
  const from = playerAnchor(s, effect.victim)
  const to = playerAnchor(s, effect.thief)
  if (!from || !to) return
  flySprite(s, 'card-back-resource', from, to, 0, Math.round(STEAL_FLY_MS * s.timeScale), 1, 12)
}

function puff(s: RunnerState, at: Point): void {
  const size = 8
  const el = makeEl(s, {
    position: 'fixed',
    left: at.x,
    top: at.y,
    width: size,
    height: size,
    transform: 'translate(-50%, -50%)',
    border: `2px solid ${COLORS.text}`,
    boxSizing: 'border-box',
    opacity: 0.9,
  })
  animate(
    s,
    el,
    [
      { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0.9 },
      { transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 },
    ],
    { duration: BUILD_PUFF_MS, easing: 'ease-out' },
  )
}

function playBuild(s: RunnerState, effect: BuildEffect): void {
  const soundName = effect.buildKind === 'road' ? 'road' : effect.buildKind === 'settlement' ? 'place' : 'city'
  s.sound.play(soundName)
  if (!s.motion) return
  const hidden = { vertices: [...s.overrides.hiddenPieces.vertices], edges: [...s.overrides.hiddenPieces.edges] }
  if (effect.buildKind === 'road') hidden.edges.push(effect.at)
  else hidden.vertices.push(effect.at)
  setOverrides(s, { hiddenPieces: hidden })
  after(s, BUILD_HIDE_MS, () => {
    setOverrides(s, {
      hiddenPieces: {
        vertices: s.overrides.hiddenPieces.vertices.filter((v) => v !== effect.at),
        edges: s.overrides.hiddenPieces.edges.filter((edge) => edge !== effect.at),
      },
    })
    const point = boardPoint(s, effect.buildKind === 'road' ? edgePoint(effect.at) : vertexPoint(effect.at))
    if (point) puff(s, point)
  })
}

function playDevBought(s: RunnerState, effect: Extract<Effect, { kind: 'devBought' }>): void {
  s.sound.play('card')
  if (!s.motion) return
  const from = anchorCenter('dev-deck') ?? boardCenter()
  const to = playerAnchor(s, effect.player)
  if (!from || !to) return
  flySprite(s, 'card-back-development', from, to, 0, FLY_MS, 1, 12)
}

function playDevPlayed(s: RunnerState, effect: Extract<Effect, { kind: 'devPlayed' }>): void {
  s.sound.play(effect.card === 'knight' ? 'knight' : 'card')
  const cardName = s.t.catan.playCard.cards[effect.card].name
  const text = fill(s.t.catan.effects.playedCard, { player: playerSubject(s.game, effect.player), card: cardName })
  enqueueBanner(s, { text, sprite: DEV_CARD_SPRITES[effect.card], spriteScale: 2, durationMs: BANNER_PLAYED_MS })
}

function playAward(s: RunnerState, effect: Extract<Effect, { kind: 'award' }>): void {
  s.sound.play('award')
  const award = effect.award === 'longestRoad' ? s.t.catan.longestRoad : s.t.catan.largestArmy
  const sprite: UiSpriteName = effect.award === 'longestRoad' ? 'card-longest-road' : 'card-largest-army'
  let text: string
  if (effect.holder === null) text = fill(s.t.catan.effects.awardLost, { award })
  else if (effect.holder === s.human) text = fill(s.t.catan.effects.awardTakeYou, { award })
  else text = fill(s.t.catan.effects.awardTake, { player: playerSubject(s.game, effect.holder), award })
  enqueueBanner(s, { text, sprite, spriteScale: 2, durationMs: BANNER_AWARD_MS })
}

function playTrade(s: RunnerState, effect: Extract<Effect, { kind: 'trade' }>): void {
  if (effect.reply === 'accepted') {
    s.sound.play('accept')
    return
  }
  if (effect.reply === 'declined') {
    if (effect.from === s.human) s.sound.play('decline')
    return
  }
  if (effect.to === null) {
    s.sound.play('card')
    if (!s.motion) return
    const player = playerAnchor(s, effect.from)
    const bank = anchorCenter('bank') ?? boardCenter()
    if (!player || !bank) return
    flyCounts(s, player, bank, effect.give, 0)
    flyCounts(s, bank, player, effect.get, FLY_STAGGER_MS * Math.min(totalCards(effect.give), MAX_FLYERS) + FLY_MS)
    return
  }
  s.sound.play('accept')
  if (!s.motion) return
  const from = playerAnchor(s, effect.from)
  const to = playerAnchor(s, effect.to)
  if (!from || !to) return
  flyCounts(s, from, to, effect.give, 0)
  flyCounts(s, to, from, effect.get, FLY_STAGGER_MS * Math.min(totalCards(effect.give), MAX_FLYERS) + FLY_MS)
}

function playDiscard(s: RunnerState, effect: Extract<Effect, { kind: 'discard' }>): void {
  s.sound.play('card')
  if (!s.motion) return
  const from = playerAnchor(s, effect.player)
  const to = anchorCenter('bank') ?? boardCenter()
  if (!from || !to) return
  for (let i = 0; i < Math.min(effect.count, 12); i++) {
    flySprite(s, 'card-back-resource', from, to, i * FLY_STAGGER_MS, FLY_MS, 1, 10)
  }
}

function playTurn(s: RunnerState, effect: Extract<Effect, { kind: 'turn' }>): void {
  if (!effect.human) return
  s.sound.play('turn')
  enqueueBanner(s, { text: s.t.catan.effects.yourTurn, durationMs: BANNER_TURN_MS })
}

function playGameOver(s: RunnerState, effect: Extract<Effect, { kind: 'gameOver' }>): void {
  s.sound.play(effect.humanWon ? 'win' : 'lose')
  if (!s.motion) return
  const rect = boardRect()
  if (!rect) return
  const colors = s.game.players.map((p) => PLAYER_HEX[p.color])
  const count = 40
  for (let i = 0; i < count; i++) {
    const size = 6 + (i % 3) * 2
    const x = rect.left + Math.round(Math.random() * (rect.width - size))
    const startY = rect.top - size - Math.round(Math.random() * 40)
    const el = makeEl(s, {
      position: 'fixed',
      left: x,
      top: startY,
      width: size,
      height: size,
      backgroundColor: colors[i % colors.length],
    })
    const fall = rect.height + 60
    const drift = Math.round((Math.random() - 0.5) * 60)
    animate(
      s,
      el,
      [
        { transform: 'translate(0px, 0px)', opacity: 1 },
        { transform: `translate(${drift}px, ${Math.round(fall * 0.7)}px)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${drift}px, ${fall}px)`, opacity: 0 },
      ],
      { duration: Math.round(900 + Math.random() * 700), easing: 'linear' },
    )
  }
}

function effectPlayer(effect: Effect): PlayerId | null {
  switch (effect.kind) {
    case 'dice':
      return effect.roller
    case 'steal':
      return effect.thief
    case 'build':
    case 'devBought':
    case 'devPlayed':
    case 'discard':
      return effect.player
    case 'award':
      return effect.holder
    case 'trade':
    case 'offer':
      return effect.from
    case 'turn':
      return effect.player
    case 'gameOver':
      return effect.winner
    default:
      return null
  }
}

function batchActor(prev: GameState | null, next: GameState, effects: Effect[]): PlayerId | null {
  for (const effect of effects) {
    const player = effectPlayer(effect)
    if (player !== null) return player
  }
  return prev?.current ?? next.current
}

function runEffects(s: RunnerState, effects: Effect[], prev: GameState | null, next: GameState): void {
  const botSpeed = readPrefs(getCatanPrefsStorage()).botSpeed
  const actor = batchActor(prev, next, effects)
  const botTurn = actor !== null && next.players[actor]?.isBot === true
  const instantBot = s.animations && botTurn && botSpeed === 0
  s.motion = s.animations && !instantBot
  s.highlights = !instantBot
  s.timeScale = botTurn && botSpeed > 0 ? Math.min(Math.max(botSpeed / 450, 0.5), 1.5) : 1

  for (const effect of effects) {
    switch (effect.kind) {
      case 'dice':
        playDice(s, effect)
        break
      case 'produce':
        playProduce(s, effect)
        break
      case 'robber':
        playRobber(s, effect)
        break
      case 'steal':
        playSteal(s, effect)
        break
      case 'build':
        playBuild(s, effect)
        break
      case 'devBought':
        playDevBought(s, effect)
        break
      case 'devPlayed':
        playDevPlayed(s, effect)
        break
      case 'award':
        playAward(s, effect)
        break
      case 'trade':
        playTrade(s, effect)
        break
      case 'discard':
        playDiscard(s, effect)
        break
      case 'turn':
        playTurn(s, effect)
        break
      case 'offer':
        s.sound.play('offer')
        break
      case 'gameOver':
        playGameOver(s, effect)
        break
      case 'summary':
        enqueueBanner(s, { text: effect.text, durationMs: BANNER_SUMMARY_MS })
        break
    }
  }
}

export function EffectsLayer(props: EffectsLayerProps): JSX.Element | null {
  const { game, human, boardViewRef, animations, sound, onBoardOverrides } = props
  const t = useT()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const prevRef = useRef<GameState | null>(null)
  const stateRef = useRef<RunnerState | null>(null)

  if (stateRef.current === null) {
    stateRef.current = {
      root: null,
      game,
      human,
      boardViewRef,
      animations,
      sound,
      t,
      onBoardOverrides,
      timers: new Set(),
      running: new Set(),
      elements: new Set(),
      banners: [],
      bannerShowing: false,
      motion: true,
      highlights: true,
      timeScale: 1,
      overrides: { highlightHexes: [], robberHex: undefined, hiddenPieces: { vertices: [], edges: [] } },
    }
  }
  const s = stateRef.current
  s.root = rootRef.current
  s.game = game
  s.human = human
  s.boardViewRef = boardViewRef
  s.animations = animations
  s.sound = sound
  s.t = t
  s.onBoardOverrides = onBoardOverrides

  useLayoutEffect(() => {
    s.root = rootRef.current
    const prev = prevRef.current
    if (prev === game) return
    const effects = effectsFor(prev, game, human)
    prevRef.current = game
    if (prev && game.eventSeq < prev.eventSeq) {
      // Undo or a new game: stop what the undone events started (banners, pop-ins, board overrides).
      resetFx(s, true)
      return
    }
    if (effects.length === 0) return
    resetFx(s, true)
    runEffects(s, effects, prev, game)
  }, [game, human, s])

  useLayoutEffect(() => () => resetFx(stateRef.current, false), [])

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: Z_INDEX,
        overflow: 'hidden',
      }}
    />
  )
}
