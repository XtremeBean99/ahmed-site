'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import { EDGES, VERTICES } from '@/lib/games/catan/geometry'
import type { GameState, Terrain } from '@/lib/games/catan/types'
import { hoverTargetAt } from './board-hover'
import type { HoverTarget } from './board-hover'
import { BOARD_HEIGHT, BOARD_WIDTH, edgePoint, hexCenter, vertexPoint } from './board-layout'
import {
  clearBuffer,
  createBuffer,
  drawOverlayLayer,
  drawPiecesLayer,
  drawStaticLayer,
  piecesLayerKey,
  staticLayerKey,
} from './pixel-art'
import type { GhostPiece, PixelBuffer, SpriteSet, TouchSelection } from './pixel-art'
import { SPRITES, SPRITE_NAMES } from './sprites'
import { useTooltipsEnabled } from './Tooltip'
import { clampPan, fitScale, kRange, zoomAtPoint } from './board/camera'
import { nearestTargetAt, targetPoint } from './board/targets'
import type { NearestTarget, TargetKind, TargetShapes } from './board/targets'
import { hitSize, useCatanLayout } from './layout'
import { COLORS, FOCUS_CLASS, PixelButton } from './ui'

export type { TargetKind }
export type BoardTargets = TargetShapes

export interface BoardView {
  /** Maps logical board pixels (board-layout.ts coordinates) to viewport client coordinates. */
  toClient(p: { x: number; y: number }): { x: number; y: number }
  /** CSS px per logical board px. */
  scale: number
  zoomIn(): void
  zoomOut(): void
  fit(): void
}

export interface BoardLabels {
  board: string
  vertex: string
  vertexCoast: string
  edge: string
  edgeCoast: string
  hex: string
  sea: string
  targets: Record<TargetKind, string>
  terrain: Record<Terrain, string>
  zoomIn: string
  zoomOut: string
  fit: string
  fitShort: string
  place: string
  build: string
  moveRobber: string
  cancel: string
}

export interface BoardCanvasProps {
  state: GameState
  targets: BoardTargets
  /** Highlight the most recent placement (vertex or edge id) briefly; null for none. */
  lastPlaced: { kind: 'vertex' | 'edge'; id: number } | null
  labels: BoardLabels
  onVertex: (vertex: number) => void
  onEdge: (edge: number) => void
  onHex: (hex: number) => void
  /** Extra text appended to a vertex target's accessible name and tooltip. */
  describeVertex?: (vertex: number) => string | null
  /** Rich hover description for a board feature, shown in a floating tooltip. */
  describeHover?: (target: HoverTarget) => ReactNode
  /** Live camera handle for the layout builder's shortcuts and effects. */
  viewRef?: React.MutableRefObject<BoardView | null>
  /** Hexes drawn with a pulsing amber outline (the rolled number). */
  highlightHexes?: number[]
  /** Where to draw the robber (undefined = state.robber; null = hidden). */
  robberHex?: number | null
  /** Pieces not drawn yet, so a placement animation can pop them in. */
  hiddenPieces?: { vertices: number[]; edges: number[] }
  /** Decorative motion (sea drift, pulses). OS reduced motion also turns it off. */
  animate?: boolean
}

const PULSE_CSS = `
  @keyframes catan-ring-pulse {
    0% { transform: scale(0.85); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0.45; }
  }
  .catan-target:focus-visible {
    outline: 2px solid rgba(200, 184, 154, 0.7);
    outline-offset: 2px;
  }
  .catan-marker-ring {
    animation: catan-ring-pulse 0.7s ease-in-out infinite alternate;
  }
  .catan-target .catan-vertex-note {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background-color: #3d2e1e;
    border: 2px solid #5a4430;
    color: #e8d5b0;
    font-size: 10px;
    line-height: 1;
    padding: 3px 5px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 3;
  }
  .catan-target:hover .catan-vertex-note,
  .catan-target:focus-visible .catan-vertex-note {
    display: block;
  }
  @media (prefers-reduced-motion: reduce) {
    .catan-marker-ring { animation: none; }
  }
`

const SEA_TILE = 32

function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(value)
  return out
}

function putImage(canvas: HTMLCanvasElement, buffer: PixelBuffer): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const image = ctx.createImageData(buffer.width, buffer.height)
  image.data.set(buffer.data)
  ctx.putImageData(image, 0, 0)
}

interface UserCam {
  k: number
  offsetX: number
  offsetY: number
}

const DRAG_THRESHOLD = 6
const LONG_PRESS_MS = 450
const TOUCH_TOOLTIP_MS = 2500

export function BoardCanvas(props: BoardCanvasProps): JSX.Element {
  const {
    state,
    targets,
    lastPlaced,
    labels,
    onVertex,
    onEdge,
    onHex,
    describeVertex,
    describeHover,
    viewRef,
    highlightHexes = [],
    robberHex,
    hiddenPieces,
    animate = true,
  } = props

  const fillRef = useRef<HTMLDivElement>(null)
  const staticCanvasRef = useRef<HTMLCanvasElement>(null)
  const piecesCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tooltipHideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const staticKeyRef = useRef('')
  const piecesKeyRef = useRef('')
  const overlayKeyRef = useRef('')
  const suppressClickRef = useRef(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{ id: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null)
  const pinchRef = useRef<{ startK: number; startDistance: number } | null>(null)
  const pinchedRef = useRef(false)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)

  const [area, setArea] = useState({ w: 0, h: 0 })
  const [dpr, setDpr] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  const [userCam, setUserCam] = useState<UserCam | null>(null)
  const [sprites, setSprites] = useState<SpriteSet>({})
  const [ghost, setGhost] = useState<GhostPiece | null>(null)
  const [touchSelection, setTouchSelection] = useState<TouchSelection | null>(null)
  const [liveLabel, setLiveLabel] = useState('')
  const [blinkOn, setBlinkOn] = useState(false)
  const [pulseBright, setPulseBright] = useState(true)
  const [drift, setDrift] = useState({ x: 0, y: 0 })
  const [hoverTip, setHoverTip] = useState<{ left: number; top: number; transform: string; content: ReactNode } | null>(null)

  const reduceMotion = useReducedMotion()
  const tooltipsEnabled = useTooltipsEnabled()
  const { coarse } = useCatanLayout()

  const cameraRef = useRef({ k: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const areaRef = useRef(area)
  areaRef.current = area
  const dprRef = useRef(dpr)
  dprRef.current = dpr
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const coarseRef = useRef(coarse)
  coarseRef.current = coarse
  const userCamRef = useRef(userCam)
  userCamRef.current = userCam

  const fit = useMemo(
    () => (area.w > 0 && area.h > 0 ? fitScale(area.w, area.h, dpr) : { k: 1, scale: 1, offsetX: 0, offsetY: 0 }),
    [area.w, area.h, dpr],
  )
  const camera = useMemo(() => {
    if (area.w <= 0 || area.h <= 0) return fit
    if (!userCam) return fit
    return clampPan(userCam.k, userCam.offsetX, userCam.offsetY, area.w, area.h, dpr)
  }, [userCam, fit, area.w, area.h, dpr])
  cameraRef.current = camera

  const s = camera.scale
  const hit = hitSize(coarse)

  const spritesKey = useMemo(() => Object.keys(sprites).sort().join(','), [sprites])
  const targetsKey = useMemo(
    () => JSON.stringify({ kind: targets.kind, vertices: targets.vertices, edges: targets.edges, hexes: targets.hexes }),
    [targets],
  )
  const highlightKey = highlightHexes.join(',')

  const staticKey = useMemo(() => staticLayerKey(state, sprites), [state, sprites])
  const piecesKey = useMemo(() => piecesLayerKey(state, { robberHex, hiddenPieces }), [state, robberHex, hiddenPieces])
  const piecesDrawKey = `${piecesKey}|${spritesKey}`

  const touchGhost = useMemo<GhostPiece | null>(() => {
    if (!touchSelection) return null
    const color = state.players[state.current].color
    if (touchSelection.kind === 'vertex') {
      return { kind: targets.kind === 'city' ? 'city' : 'settlement', vertex: touchSelection.id, color }
    }
    if (touchSelection.kind === 'edge') return { kind: 'road', edge: touchSelection.id, color }
    return { kind: 'robber', hex: touchSelection.id, color }
  }, [touchSelection, targets.kind, state])

  const overlayGhost = touchGhost ?? ghost

  const overlayDrawKey = useMemo(
    () =>
      JSON.stringify({
        targets: { kind: targets.kind, vertices: targets.vertices, edges: targets.edges, hexes: targets.hexes },
        ghost: overlayGhost,
        highlightHexes,
        highlightBright: pulseBright,
        lastPlaced: lastPlaced && blinkOn ? lastPlaced : null,
        touchSelection,
        sprites: spritesKey,
      }),
    [targets, overlayGhost, highlightHexes, pulseBright, lastPlaced, blinkOn, touchSelection, spritesKey],
  )

  const hideHoverTip = useCallback(() => {
    clearTimeout(hoverTimer.current)
    clearTimeout(tooltipHideTimer.current)
    setHoverTip(null)
  }, [])

  const clearLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  const zoomToK = useCallback((newK: number, viewX: number, viewY: number) => {
    const a = areaRef.current
    const d = dprRef.current
    if (a.w <= 0 || a.h <= 0) return
    const { k0, maxK } = kRange(a.w, a.h, d)
    const clamped = Math.min(Math.max(newK, k0), maxK)
    if (clamped <= k0) {
      setUserCam(null)
      return
    }
    const cam = cameraRef.current
    const next = zoomAtPoint(cam.k, cam.offsetX, cam.offsetY, a.w, a.h, d, viewX, viewY, clamped)
    // Update the ref now, so a second zoom before the next render builds on this one.
    cameraRef.current = clampPan(next.k, next.offsetX, next.offsetY, a.w, a.h, d)
    setUserCam({ k: next.k, offsetX: next.offsetX, offsetY: next.offsetY })
  }, [])

  const zoomBy = useCallback(
    (delta: number) => {
      const a = areaRef.current
      const cam = cameraRef.current
      zoomToK(cam.k + delta, a.w / 2, a.h / 2)
    },
    [zoomToK],
  )

  const zoomByAt = useCallback(
    (delta: number, viewX: number, viewY: number) => {
      const cam = cameraRef.current
      zoomToK(cam.k + delta, viewX, viewY)
    },
    [zoomToK],
  )

  const fitNow = useCallback(() => setUserCam(null), [])

  useEffect(() => {
    if (!viewRef) return
    viewRef.current = {
      scale: camera.scale,
      toClient: (p) => {
        const rect = fillRef.current?.getBoundingClientRect()
        const cam = cameraRef.current
        return {
          x: (rect?.left ?? 0) + cam.offsetX + p.x * cam.scale,
          y: (rect?.top ?? 0) + cam.offsetY + p.y * cam.scale,
        }
      },
      zoomIn: () => zoomBy(1),
      zoomOut: () => zoomBy(-1),
      fit: fitNow,
    }
  }, [viewRef, camera.scale, zoomBy, fitNow])

  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setArea((prev) => (prev.w === rect.width && prev.h === rect.height ? prev : { w: rect.width, h: rect.height }))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const onChange = () => {
      setDpr(window.devicePixelRatio || 1)
      media.removeEventListener('change', onChange)
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      media.addEventListener('change', onChange)
    }
    const onResize = () => setDpr(window.devicePixelRatio || 1)
    media.addEventListener('change', onChange)
    window.addEventListener('resize', onResize)
    return () => {
      media.removeEventListener('change', onChange)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // On resize, re-fit when the user has not zoomed; otherwise keep k and re-clamp pan.
  useEffect(() => {
    if (area.w <= 0 || area.h <= 0) return
    const user = userCamRef.current
    if (!user) return
    const fitNow = fitScale(area.w, area.h, dpr)
    const maxK = 3 * fitNow.k
    const k = Math.min(Math.max(user.k, fitNow.k), maxK)
    if (k <= fitNow.k) {
      setUserCam(null)
      return
    }
    const cam = clampPan(k, user.offsetX, user.offsetY, area.w, area.h, dpr)
    setUserCam({ k: cam.k, offsetX: cam.offsetX, offsetY: cam.offsetY })
  }, [area.w, area.h, dpr])

  useEffect(() => {
    let cancelled = false
    const loaded: SpriteSet = {}
    let pending = SPRITE_NAMES.length
    for (const name of SPRITE_NAMES) {
      const meta = SPRITES[name]
      const image = new Image()
      image.onload = () => {
        if (cancelled) return
        try {
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('2d context unavailable')
          ctx.drawImage(image, 0, 0)
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
          if (data.width !== meta.width || data.height !== meta.height) {
            console.warn(
              `Catan sprite /catan/${meta.file} is ${data.width}x${data.height}, expected ${meta.width}x${meta.height}; using procedural art`,
            )
          } else {
            loaded[name] = { width: data.width, height: data.height, data: new Uint8ClampedArray(data.data) }
          }
        } catch {
          // fall back to procedural art for this sprite
        }
        pending -= 1
        if (pending === 0 && !cancelled) setSprites({ ...loaded })
      }
      image.onerror = () => {
        if (cancelled) return
        pending -= 1
        if (pending === 0 && !cancelled) setSprites({ ...loaded })
      }
      image.src = `/catan/${meta.file}`
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = staticCanvasRef.current
    if (!canvas) return
    if (staticKeyRef.current === staticKey) return
    staticKeyRef.current = staticKey
    const buffer = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
    drawStaticLayer(buffer, state, sprites)
    putImage(canvas, buffer)
  }, [staticKey, state, sprites])

  useEffect(() => {
    const canvas = piecesCanvasRef.current
    if (!canvas) return
    if (piecesKeyRef.current === piecesDrawKey) return
    piecesKeyRef.current = piecesDrawKey
    const buffer = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
    clearBuffer(buffer)
    drawPiecesLayer(buffer, state, { robberHex, hiddenPieces }, sprites)
    putImage(canvas, buffer)
  }, [piecesDrawKey, state, robberHex, hiddenPieces, sprites])

  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    if (overlayKeyRef.current === overlayDrawKey) return
    overlayKeyRef.current = overlayDrawKey
    const buffer = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
    clearBuffer(buffer)
    drawOverlayLayer(
      buffer,
      {
        targets: { vertices: targets.vertices, edges: targets.edges, hexes: targets.hexes },
        ghost: overlayGhost,
        highlightHexes,
        highlightBright: pulseBright,
        lastPlaced: lastPlaced && blinkOn ? lastPlaced : null,
        touchSelection,
      },
      sprites,
    )
    putImage(canvas, buffer)
  }, [overlayDrawKey, targets, overlayGhost, highlightHexes, pulseBright, lastPlaced, blinkOn, touchSelection, sprites])

  useEffect(() => {
    if (!lastPlaced) {
      setBlinkOn(false)
      return
    }
    setBlinkOn(true)
    if (reduceMotion) return
    const timer = setTimeout(() => setBlinkOn(false), 1500)
    return () => clearTimeout(timer)
  }, [lastPlaced, reduceMotion])

  useEffect(() => {
    if (highlightHexes.length === 0) {
      setPulseBright(true)
      return
    }
    if (!animate || reduceMotion) {
      setPulseBright(true)
      return
    }
    setPulseBright(true)
    const timer = setInterval(() => setPulseBright((value) => !value), 250)
    return () => clearInterval(timer)
  }, [highlightKey, highlightHexes.length, animate, reduceMotion])

  useEffect(() => {
    if (!animate || reduceMotion) return
    const xTimer = setInterval(() => setDrift((d) => ({ x: (d.x + 1) % SEA_TILE, y: d.y })), 400)
    const yTimer = setInterval(() => setDrift((d) => ({ x: d.x, y: (d.y + 1) % SEA_TILE })), 800)
    return () => {
      clearInterval(xTimer)
      clearInterval(yTimer)
    }
  }, [animate, reduceMotion])

  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  useEffect(() => () => clearTimeout(longPressTimer.current), [])
  useEffect(() => () => clearTimeout(tooltipHideTimer.current), [])

  useEffect(() => {
    if (!tooltipsEnabled) {
      hideHoverTip()
    }
  }, [tooltipsEnabled, hideHoverTip])

  useEffect(() => {
    hideHoverTip()
    setTouchSelection(null)
  }, [targetsKey, hideHoverTip])

  useEffect(() => {
    if (!hoverTip) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHoverTip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hoverTip])

  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const viewX = event.clientX - rect.left
      const viewY = event.clientY - rect.top
      const delta = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0
      if (delta !== 0) zoomByAt(delta, viewX, viewY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomByAt])

  const handleHoverMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tooltipsEnabled || !describeHover) return
    const rect = fillRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return
    const cam = cameraRef.current
    const x = Math.floor((event.clientX - rect.left - cam.offsetX) / cam.scale)
    const y = Math.floor((event.clientY - rect.top - cam.offsetY) / cam.scale)
    const target = hoverTargetAt(state, x, y)
    const content = target ? describeHover(target) : null
    if (!content) {
      hideHoverTip()
      return
    }
    clearTimeout(hoverTimer.current)
    const below = event.clientY < window.innerHeight - 160
    const left = Math.min(Math.max(event.clientX, 128), window.innerWidth - 128)
    const top = below ? event.clientY + 12 : event.clientY - 12
    const transform = below ? 'translateX(-50%)' : 'translate(-50%, -100%)'
    hoverTimer.current = setTimeout(() => setHoverTip({ left, top, transform, content }), 300)
  }

  const startLongPress = (event: ReactPointerEvent<HTMLDivElement>) => {
    clearLongPress()
    if (!describeHover) return
    const clientX = event.clientX
    const clientY = event.clientY
    longPressTimer.current = setTimeout(() => {
      const rect = fillRef.current?.getBoundingClientRect()
      if (!rect) return
      const cam = cameraRef.current
      const x = Math.floor((clientX - rect.left - cam.offsetX) / cam.scale)
      const y = Math.floor((clientY - rect.top - cam.offsetY) / cam.scale)
      const target = hoverTargetAt(state, x, y)
      if (!target) return
      const content = describeHover(target)
      if (!content) return
      const below = clientY < window.innerHeight - 160
      const left = Math.min(Math.max(clientX, 128), window.innerWidth - 128)
      const top = below ? clientY + 12 : clientY - 12
      const transform = below ? 'translateX(-50%)' : 'translate(-50%, -100%)'
      setHoverTip({ left, top, transform, content })
      clearTimeout(tooltipHideTimer.current)
      tooltipHideTimer.current = setTimeout(() => setHoverTip(null), TOUCH_TOOLTIP_MS)
    }, LONG_PRESS_MS)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    hideHoverTip()
    if (event.pointerType === 'mouse' && event.button !== 0) return
    clearLongPress()
    const el = event.currentTarget
    const isButton = event.target instanceof Element && event.target.closest('button') !== null
    if (!isButton) el.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: cameraRef.current.offsetX,
        offsetY: cameraRef.current.offsetY,
        moved: false,
      }
      if (coarseRef.current) startLongPress(event)
    } else if (pointersRef.current.size === 2) {
      dragRef.current = null
      pinchedRef.current = true
      clearLongPress()
      const points = [...pointersRef.current.values()]
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      pinchRef.current = { startK: cameraRef.current.k, startDistance: Math.max(distance, 1) }
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (event.pointerType === 'mouse' && !coarseRef.current) handleHoverMove(event)

    const drag = dragRef.current
    if (drag && drag.id === event.pointerId && pointersRef.current.size === 1) {
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        drag.moved = true
        clearLongPress()
        if (userCamRef.current) {
          const cam = cameraRef.current
          setUserCam({ k: cam.k, offsetX: drag.offsetX + dx, offsetY: drag.offsetY + dy })
        }
      }
      return
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      clearLongPress()
      const points = [...pointersRef.current.values()]
      const distance = Math.max(Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), 1)
      const midX = (points[0].x + points[1].x) / 2
      const midY = (points[0].y + points[1].y) / 2
      const a = areaRef.current
      const d = dprRef.current
      const { k0, maxK } = kRange(a.w, a.h, d)
      const newK = Math.min(Math.max(Math.round((pinchRef.current.startK * distance) / pinchRef.current.startDistance), k0), maxK)
      zoomToK(newK, midX, midY)
    }
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hadPointer = pointersRef.current.has(event.pointerId)
    pointersRef.current.delete(event.pointerId)
    clearLongPress()

    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.entries()][0]
      dragRef.current = {
        id: remaining[0],
        startX: remaining[1].x,
        startY: remaining[1].y,
        offsetX: cameraRef.current.offsetX,
        offsetY: cameraRef.current.offsetY,
        moved: false,
      }
      return
    }

    if (pointersRef.current.size === 0) {
      const drag = dragRef.current
      if (drag?.moved) {
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
      dragRef.current = null
      pinchRef.current = null
      const wasPinch = pinchedRef.current
      pinchedRef.current = false

      if (hadPointer && coarseRef.current) {
        const isButton = event.target instanceof Element && event.target.closest('button') !== null
        if (!isButton && !drag?.moved && !wasPinch) handleTouchTap(event)
      }
    }
  }

  const doubleTapZoom = (clientX: number, clientY: number) => {
    const rect = fillRef.current?.getBoundingClientRect()
    if (!rect) return
    const viewX = clientX - rect.left
    const viewY = clientY - rect.top
    const a = areaRef.current
    const d = dprRef.current
    const cam = cameraRef.current
    const { maxK } = kRange(a.w, a.h, d)
    if (cam.k >= maxK) {
      setUserCam(null)
      return
    }
    zoomToK(Math.min(cam.k + 2, maxK), viewX, viewY)
  }

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button') !== null) return
    doubleTapZoom(event.clientX, event.clientY)
  }

  const handleTouchTap = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = fillRef.current?.getBoundingClientRect()
    if (!rect) return
    const now = performance.now()
    const last = lastTapRef.current
    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY }
    if (last && now - last.time < 350 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 40) {
      lastTapRef.current = null
      setTouchSelection(null)
      doubleTapZoom(event.clientX, event.clientY)
      return
    }
    const cam = cameraRef.current
    const x = (event.clientX - rect.left - cam.offsetX) / cam.scale
    const y = (event.clientY - rect.top - cam.offsetY) / cam.scale
    const nearest = nearestTargetAt({ x, y }, targetsRef.current)
    setTouchSelection(nearest)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(1)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomBy(-1)
    } else if (event.key === '0') {
      event.preventDefault()
      fitNow()
    } else if (event.key === 'Escape') {
      setTouchSelection(null)
      hideHoverTip()
    }
  }

  const describeHex = (hex: number): string => {
    const tile = state.tiles[hex]
    if (!tile) return labels.sea
    const terrain = labels.terrain[tile.terrain]
    if (tile.number === null) return terrain
    return fillTemplate(labels.hex, { terrain, number: String(tile.number) })
  }

  const joinNatural = (items: string[]): string => {
    if (items.length <= 1) return items[0] ?? ''
    if (items.length === 2) return `${items[0]} and ${items[1]}`
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
  }

  const describeVertexPlace = (vertex: number): string => {
    const hexes = VERTICES[vertex].hexes.map(describeHex)
    const template = VERTICES[vertex].hexes.length < 3 ? labels.vertexCoast : labels.vertex
    return fillTemplate(template, { hexes: joinNatural(hexes) })
  }

  const describeEdgePlace = (edge: number): string => {
    const hexes = EDGES[edge].hexes.map(describeHex)
    const template = hexes.length === 1 ? labels.edgeCoast : labels.edge
    return fillTemplate(template, { hexes: joinNatural(hexes) })
  }

  const primaryLabel = (kind: TargetKind): string => {
    if (kind === 'robber') return labels.moveRobber
    if (kind === 'setupSettlement' || kind === 'settlement') return labels.place
    return labels.build
  }

  const markers: JSX.Element[] = []
  if (targets.kind !== null) {
    const kind = targets.kind
    const ghostColor = state.players[state.current].color
    const targetLabel = (place: string) => fillTemplate(labels.targets[kind] ?? '', { place })

    const selectTouch = (nearest: NearestTarget) => {
      setTouchSelection(nearest)
      setLiveLabel(targetLabel(nearest.kind === 'vertex' ? describeVertexPlace(nearest.id) : nearest.kind === 'edge' ? describeEdgePlace(nearest.id) : describeHex(nearest.id)))
    }

    const pushMarker = (
      key: string,
      x: number,
      y: number,
      label: string,
      piece: GhostPiece,
      activate: () => void,
      nearest: NearestTarget,
      note?: string | null,
    ) => {
      const fullLabel = note ? `${label} ${note}` : label
      markers.push(
        <button
          key={key}
          type="button"
          className={`catan-target ${FOCUS_CLASS}`}
          aria-label={fullLabel}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            if (coarseRef.current) {
              selectTouch(nearest)
            } else {
              activate()
            }
          }}
          onMouseEnter={() => {
            if (!coarseRef.current) {
              setGhost(piece)
              setLiveLabel(fullLabel)
            }
          }}
          onMouseLeave={() => {
            setGhost(null)
            setLiveLabel('')
          }}
          onFocus={() => {
            setGhost(piece)
            setLiveLabel(fullLabel)
          }}
          onBlur={() => {
            setGhost(null)
            setLiveLabel('')
          }}
          style={{
            position: 'absolute',
            left: camera.offsetX + x * s,
            top: camera.offsetY + y * s,
            width: Math.max(hit, 12 * s),
            height: Math.max(hit, 12 * s),
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4,
          }}
        >
          {note ? (
            <span aria-hidden className="catan-vertex-note">
              {note}
            </span>
          ) : null}
          {kind === 'robber' ? null : (
            <span
              aria-hidden
              className="catan-marker-ring"
              style={{
                width: 12,
                height: 12,
                border: '2px solid #e0a040',
                boxShadow: '0 0 0 1px #1a1410',
                backgroundColor: 'rgba(224, 160, 64, 0.35)',
                display: 'block',
                animation: reduceMotion ? 'none' : undefined,
              }}
            />
          )}
        </button>,
      )
    }

    if (kind === 'robber') {
      for (const hex of targets.hexes) {
        const p = hexCenter(hex)
        pushMarker(
          `hex:${hex}`,
          p.x,
          p.y,
          targetLabel(describeHex(hex)),
          { kind: 'robber', hex, color: ghostColor },
          () => onHex(hex),
          { kind: 'hex', id: hex },
        )
      }
    } else if (kind === 'setupRoad' || kind === 'road') {
      for (const edge of targets.edges) {
        const p = edgePoint(edge)
        pushMarker(
          `edge:${edge}`,
          p.x,
          p.y,
          targetLabel(describeEdgePlace(edge)),
          { kind: 'road', edge, color: ghostColor },
          () => onEdge(edge),
          { kind: 'edge', id: edge },
        )
      }
    } else {
      for (const vertex of targets.vertices) {
        const p = vertexPoint(vertex)
        pushMarker(
          `vertex:${vertex}`,
          p.x,
          p.y,
          targetLabel(describeVertexPlace(vertex)),
          { kind: kind === 'city' ? 'city' : 'settlement', vertex, color: ghostColor },
          () => onVertex(vertex),
          { kind: 'vertex', id: vertex },
          describeVertex?.(vertex),
        )
      }
    }
  }

  const { maxK } = kRange(area.w, area.h, dpr)
  const zoomInDisabled = camera.k >= maxK
  const zoomOutDisabled = userCam === null

  const canvasStyle: CSSProperties = {
    position: 'absolute',
    left: camera.offsetX,
    top: camera.offsetY,
    width: BOARD_WIDTH * s,
    height: BOARD_HEIGHT * s,
    imageRendering: 'pixelated',
    pointerEvents: 'none',
  }

  const touchButtons: JSX.Element | null = touchSelection
    ? (() => {
        const point = targetPoint(touchSelection)
        const left = camera.offsetX + point.x * s
        const top = camera.offsetY + point.y * s
        const below = top < 80
        const primary = () => {
          if (touchSelection.kind === 'vertex') onVertex(touchSelection.id)
          else if (touchSelection.kind === 'edge') onEdge(touchSelection.id)
          else onHex(touchSelection.id)
          setTouchSelection(null)
        }
        return (
          <div
            style={{
              position: 'absolute',
              left,
              top,
              transform: below ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))',
              display: 'flex',
              gap: 4,
              zIndex: 6,
            }}
          >
            <PixelButton variant="primary" size="sm" aria-label={primaryLabel(targets.kind ?? 'settlement')} onClick={primary}>
              {primaryLabel(targets.kind ?? 'settlement')}
            </PixelButton>
            <PixelButton size="sm" aria-label={labels.cancel} onClick={() => setTouchSelection(null)}>
              {labels.cancel}
            </PixelButton>
          </div>
        )
      })()
    : null

  return (
    <div
      ref={fillRef}
      role="group"
      aria-label={labels.board}
      className="relative h-full w-full overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onPointerLeave={hideHoverTip}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onScroll={(event) => {
        // The camera owns positioning; focus must never scroll the viewport (browsers without overflow: clip).
        event.currentTarget.scrollTop = 0
        event.currentTarget.scrollLeft = 0
      }}
      style={{
        overflow: 'clip',
        backgroundColor: COLORS.sea,
        backgroundImage: 'url(/catan/sea.png)',
        backgroundSize: `${SEA_TILE * s}px ${SEA_TILE * s}px`,
        backgroundPosition: `${camera.offsetX + drift.x * s}px ${camera.offsetY + drift.y * s}px`,
        backgroundRepeat: 'repeat',
        imageRendering: 'pixelated',
        touchAction: 'none',
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      <style>{PULSE_CSS}</style>
      <canvas ref={staticCanvasRef} width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-hidden style={{ ...canvasStyle, zIndex: 1 }} />
      <canvas ref={piecesCanvasRef} width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-hidden style={{ ...canvasStyle, zIndex: 2 }} />
      <canvas ref={overlayCanvasRef} width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-hidden style={{ ...canvasStyle, zIndex: 3 }} />
      {markers}
      {touchButtons}
      <div
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          display: 'flex',
          gap: 4,
          zIndex: 7,
        }}
      >
        <PixelButton
          size="sm"
          aria-label={labels.zoomOut}
          disabled={zoomOutDisabled}
          onClick={() => zoomBy(-1)}
          style={{ width: hit, height: hit, padding: 0 }}
        >
          -
        </PixelButton>
        <PixelButton
          size="sm"
          aria-label={labels.zoomIn}
          disabled={zoomInDisabled}
          onClick={() => zoomBy(1)}
          style={{ width: hit, height: hit, padding: 0 }}
        >
          +
        </PixelButton>
        <PixelButton size="sm" aria-label={labels.fit} onClick={fitNow} style={{ width: hit, height: hit, padding: 0 }}>
          {labels.fitShort}
        </PixelButton>
      </div>
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {liveLabel}
      </span>
      {hoverTip && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: 'fixed',
                left: hoverTip.left,
                top: hoverTip.top,
                transform: hoverTip.transform,
                maxWidth: 240,
                width: 'max-content',
                padding: '4px 6px',
                backgroundColor: '#3d2e1e',
                border: '2px solid #5a4430',
                boxShadow: '2px 2px 0 #1a0e04',
                color: '#e8d5b0',
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                fontSize: 10,
                lineHeight: 1.4,
                pointerEvents: 'none',
                zIndex: 1000,
                whiteSpace: 'normal',
              }}
            >
              {hoverTip.content}
            </span>,
            document.body,
          )
        : null}
    </div>
  )
}
