'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import { EDGES, VERTICES } from '@/lib/games/catan/geometry'
import type { GameState, Terrain } from '@/lib/games/catan/types'
import { hoverTargetAt } from './board-hover'
import type { HoverTarget } from './board-hover'
import { BOARD_HEIGHT, BOARD_WIDTH, edgePoint, hexCenter, vertexPoint } from './board-layout'
import { clearBuffer, createBuffer, drawBoard, drawGhost, drawLastPlaced, drawTargets } from './pixel-art'
import type { GhostPiece, SpriteSet } from './pixel-art'
import { SPRITES, SPRITE_NAMES } from './sprites'
import { useTooltipsEnabled } from './Tooltip'

export type TargetKind = 'setupSettlement' | 'setupRoad' | 'settlement' | 'city' | 'road' | 'robber'

export interface BoardTargets {
  kind: TargetKind | null
  vertices: number[]
  edges: number[]
  hexes: number[]
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
}

const PULSE_CSS = `
  @keyframes catan-ring-pulse {
    0% { transform: scale(0.7); opacity: 0.9; }
    70%, 100% { transform: scale(1.9); opacity: 0; }
  }
  .catan-target:focus-visible {
    outline: 2px solid rgba(200, 184, 154, 0.7);
    outline-offset: 2px;
  }
  .catan-marker-ring {
    animation: catan-ring-pulse 1.1s ease-out infinite;
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

function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(value)
  return out
}

export function BoardCanvas(props: BoardCanvasProps): JSX.Element {
  const { state, targets, lastPlaced, labels, onVertex, onEdge, onHex, describeVertex, describeHover } = props
  const fillRef = useRef<HTMLDivElement>(null)
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const ghostCanvasRef = useRef<HTMLCanvasElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [scale, setScale] = useState(1)
  const [ghost, setGhost] = useState<GhostPiece | null>(null)
  const [liveLabel, setLiveLabel] = useState('')
  const [blinkOn, setBlinkOn] = useState(false)
  const [sprites, setSprites] = useState<SpriteSet>({})
  const [hoverTip, setHoverTip] = useState<{ left: number; top: number; transform: string; content: ReactNode } | null>(null)
  const reduceMotion = useReducedMotion()
  const tooltipsEnabled = useTooltipsEnabled()

  const sceneKey = useMemo(
    () =>
      JSON.stringify({
        tiles: state.tiles,
        ports: state.ports,
        buildings: state.buildings,
        roads: state.roads,
        robber: state.robber,
        colors: state.players.map((player) => player.color),
      }),
    [state],
  )
  const targetsKey = useMemo(
    () => JSON.stringify({ kind: targets.kind, vertices: targets.vertices, edges: targets.edges, hexes: targets.hexes }),
    [targets],
  )
  const lastPlacedKey = lastPlaced ? `${lastPlaced.kind}:${lastPlaced.id}` : ''
  const lastPlacedDrawKey = lastPlaced && blinkOn ? lastPlacedKey : ''
  const spritesKey = Object.keys(sprites).sort().join(',')
  const drawKey = `${sceneKey}|${targetsKey}|${lastPlacedDrawKey}|${spritesKey}`
  const drawKeyRef = useRef('')

  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      const next = Math.max(1, Math.floor(Math.min(rect.width / BOARD_WIDTH, rect.height / BOARD_HEIGHT)))
      setScale((prev) => (prev === next ? prev : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
    const canvas = mainCanvasRef.current
    if (!canvas) return
    if (drawKeyRef.current === drawKey) return
    drawKeyRef.current = drawKey
    const buffer = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
    drawBoard(buffer, state, sprites)
    drawTargets(buffer, { vertices: targets.vertices, edges: targets.edges, hexes: targets.hexes })
    if (lastPlaced && blinkOn) drawLastPlaced(buffer, state, lastPlaced)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(BOARD_WIDTH, BOARD_HEIGHT)
    image.data.set(buffer.data)
    ctx.putImageData(image, 0, 0)
  }, [drawKey, state, targets, lastPlaced, blinkOn, sprites])

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
    const canvas = ghostCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const buffer = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
    clearBuffer(buffer)
    if (ghost) drawGhost(buffer, ghost, sprites)
    const image = ctx.createImageData(BOARD_WIDTH, BOARD_HEIGHT)
    image.data.set(buffer.data)
    ctx.putImageData(image, 0, 0)
  }, [ghost, sprites])

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  useEffect(() => {
    if (!tooltipsEnabled) {
      clearTimeout(hoverTimer.current)
      setHoverTip(null)
    }
  }, [tooltipsEnabled])

  useEffect(() => {
    if (!hoverTip) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHoverTip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hoverTip])

  const hideHoverTip = () => {
    clearTimeout(hoverTimer.current)
    setHoverTip(null)
  }

  const handleHoverMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tooltipsEnabled || !describeHover) return
    const canvas = mainCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = Math.floor((event.clientX - rect.left) / scale)
    const y = Math.floor((event.clientY - rect.top) / scale)
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

  const cssW = BOARD_WIDTH * scale
  const cssH = BOARD_HEIGHT * scale

  const markers: JSX.Element[] = []
  if (targets.kind !== null) {
    const kind = targets.kind
    const ghostColor = state.players[state.current].color
    const targetLabel = (place: string) => fillTemplate(labels.targets[kind] ?? '', { place })

    const pushMarker = (
      key: string,
      x: number,
      y: number,
      label: string,
      piece: GhostPiece,
      activate: () => void,
      note?: string | null,
    ) => {
      const fullLabel = note ? `${label} ${note}` : label
      markers.push(
        <button
          key={key}
          type="button"
          className="catan-target"
          aria-label={fullLabel}
          onClick={activate}
          onMouseEnter={() => {
            setGhost(piece)
            setLiveLabel(fullLabel)
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
            left: x * scale,
            top: y * scale,
            width: Math.max(24, 12 * scale),
            height: Math.max(24, 12 * scale),
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {note ? (
            <span aria-hidden className="catan-vertex-note">
              {note}
            </span>
          ) : null}
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
          describeVertex?.(vertex),
        )
      }
    }
  }

  return (
    <div
      ref={fillRef}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: '#2a2220' }}
    >
      <style>{PULSE_CSS}</style>
      <div
        role="group"
        aria-label={labels.board}
        className="absolute left-1/2 top-1/2"
        style={{ width: cssW, height: cssH, transform: 'translate(-50%, -50%)' }}
        onPointerMove={handleHoverMove}
        onPointerLeave={hideHoverTip}
      >
        <canvas
          ref={mainCanvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: cssW,
            height: cssH,
            imageRendering: 'pixelated',
          }}
        />
        <canvas
          ref={ghostCanvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: cssW,
            height: cssH,
            imageRendering: 'pixelated',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', inset: 0 }}>{markers}</div>
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
      </div>
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
