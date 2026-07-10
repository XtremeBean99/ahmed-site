// src/components/room/DeskPaint.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'

const COLS = 107
const ROWS = 50
const CELL = 5
const KEY = 'room-paint-v1'
// Room-adjacent palette; index 1 (paper) is the blank colour.
const PALETTE = ['#1a1210', '#faf8f5', '#6b4d3a', '#3d2e1e', '#e8d5b0', '#c8a064', '#8a4a3a', '#4a6a8a', '#5a8a4a', '#35e65c']
const BLANK = 1

type Tool = 'pencil' | 'eraser' | 'fill'

export interface PaintLabels {
  pencil: string
  eraser: string
  fill: string
  clear: string
  download: string
  color: string
  canvas: string
}

interface DeskPaintProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: PaintLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
}

function loadCells(): Uint8Array {
  const cells = new Uint8Array(COLS * ROWS).fill(BLANK)
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length === COLS * ROWS) {
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i]
          cells[i] = typeof v === 'number' && v >= 0 && v < PALETTE.length ? v : BLANK
        }
      }
    }
  } catch {
    /* fresh canvas */
  }
  return cells
}

export function DeskPaint({ time, backLabel, desktopLabel, labels, onBack, onDesktop }: DeskPaintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellsRef = useRef<Uint8Array | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [tool, setTool] = useState<Tool>('pencil')
  const [colorIdx, setColorIdx] = useState(0)

  const repaint = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const cells = cellsRef.current
    if (!ctx || !cells) return
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = PALETTE[cells[y * COLS + x]]
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
  }, [])

  useEffect(() => {
    cellsRef.current = loadCells()
    repaint()
    return () => clearTimeout(saveTimer.current)
  }, [repaint])

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(Array.from(cellsRef.current ?? [])))
      } catch {
        /* storage full, drawing stays in memory */
      }
    }, 400)
  }, [])

  const setCell = useCallback(
    (x: number, y: number, idx: number) => {
      const cells = cellsRef.current
      const ctx = canvasRef.current?.getContext('2d')
      if (!cells || !ctx || x < 0 || x >= COLS || y < 0 || y >= ROWS) return
      if (cells[y * COLS + x] === idx) return
      cells[y * COLS + x] = idx
      ctx.fillStyle = PALETTE[idx]
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      persist()
    },
    [persist],
  )

  const flood = useCallback(
    (x: number, y: number, idx: number) => {
      const cells = cellsRef.current
      if (!cells || x < 0 || x >= COLS || y < 0 || y >= ROWS) return
      const from = cells[y * COLS + x]
      if (from === idx) return
      const stack = [y * COLS + x]
      while (stack.length) {
        const i = stack.pop()!
        if (cells[i] !== from) continue
        cells[i] = idx
        const cx = i % COLS
        const cy = Math.floor(i / COLS)
        if (cx > 0) stack.push(i - 1)
        if (cx < COLS - 1) stack.push(i + 1)
        if (cy > 0) stack.push(i - COLS)
        if (cy < ROWS - 1) stack.push(i + COLS)
      }
      repaint()
      persist()
    },
    [repaint, persist],
  )

  // The stage transform scales the canvas; map pointer coords via the box.
  const cellFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS)
    return { x, y }
  }

  const applyAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = cellFromEvent(e)
    if (tool === 'fill') flood(x, y, colorIdx)
    else setCell(x, y, tool === 'eraser' ? BLANK : colorIdx)
  }

  const clearAll = () => {
    cellsRef.current?.fill(BLANK)
    repaint()
    persist()
  }

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'room-painting.png'
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={() => onDesktop()}>{desktopLabel}</StripButton>
        <StripButton onClick={onBack} ariaLabel={backLabel}>← {backLabel}</StripButton>
      </ScreenStrip>

      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-2 border-b flex-shrink-0"
        style={{ height: 24, backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px' }}
      >
        <StripButton pressed={tool === 'pencil'} onClick={() => setTool('pencil')}>{labels.pencil}</StripButton>
        <StripButton pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>{labels.eraser}</StripButton>
        <StripButton pressed={tool === 'fill'} onClick={() => setTool('fill')}>{labels.fill}</StripButton>
        <span className="flex items-center gap-1 ml-2">
          {PALETTE.map((hex, i) => (
            <button
              key={hex}
              type="button"
              onClick={() => {
                setColorIdx(i)
                if (tool === 'eraser') setTool('pencil')
              }}
              aria-label={labels.color.replace('{n}', String(i + 1))}
              aria-pressed={colorIdx === i}
              className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
              style={{
                width: 12,
                height: 12,
                backgroundColor: hex,
                border: colorIdx === i ? '2px solid #3a3028' : '1px solid #c8b8a8',
              }}
            />
          ))}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <StripButton onClick={clearAll}>{labels.clear}</StripButton>
          <StripButton onClick={download}>{labels.download}</StripButton>
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          role="img"
          aria-label={labels.canvas}
          style={{ imageRendering: 'pixelated', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            applyAt(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1 && tool !== 'fill') applyAt(e)
          }}
        />
      </div>
    </div>
  )
}
