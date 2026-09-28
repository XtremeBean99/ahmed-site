// src/components/room/DeskPaint.tsx
'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { lineCells } from '@/lib/room/gestures'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ArcadeButton, ArcadeFrame, useFullscreen } from './DeskArcade'

const COLS = 107
const ROWS = 50
const CELL = 5
const KEY = 'room-paint-v1'
// Room-adjacent palette; index 1 (paper) is the blank colour. The custom
// colour-wheel slot is appended at CUSTOM_IDX, so the total slot count
// (PALETTE_SIZE) stays fixed even though its colour is picked at runtime.
const FIXED_PALETTE = ['#000000', '#ffffff', '#888888', '#8b5a2b', '#e63946', '#f4a340', '#f5d90a', '#2ecc71', '#3b82f6', '#8b5cf6']
const BLANK = 1
const CUSTOM_IDX = FIXED_PALETTE.length
const PALETTE_SIZE = FIXED_PALETTE.length + 1
const DEFAULT_CUSTOM_COLOR = '#ff69b4'

type Tool = 'pencil' | 'eraser' | 'fill'

export interface PaintLabels {
  pencil: string
  eraser: string
  fill: string
  clear: string
  clearConfirm: string
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
          cells[i] = typeof v === 'number' && v >= 0 && v < PALETTE_SIZE ? v : BLANK
        }
      }
    }
  } catch {
    /* fresh canvas */
  }
  return cells
}

export function DeskPaint({ time, backLabel, desktopLabel, labels, onBack, onDesktop }: DeskPaintProps) {
  const fs = useFullscreen()
  const { portrait, w } = useDeskScreen()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellsRef = useRef<Uint8Array | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [armed, setArmed] = useState(false)
  const [tool, setTool] = useState<Tool>('pencil')
  const [colorIdx, setColorIdx] = useState(0)
  const [customColor, setCustomColor] = useState(DEFAULT_CUSTOM_COLOR)
  // Palette indices are stored per-cell, but the custom slot's colour is picked
  // at runtime - a ref keeps repaint/setCell/flood reading the live colour
  // without having to rebuild those callbacks on every colour change.
  const paletteRef = useRef<string[]>([...FIXED_PALETTE, DEFAULT_CUSTOM_COLOR])

  // Portrait: the 107x50 canvas fills the width with 6px margins (about 308x144).
  const canvasW = portrait ? w - 12 : 0
  const canvasH = portrait ? Math.round((canvasW * ROWS) / COLS) : 0

  const repaint = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const cells = cellsRef.current
    if (!ctx || !cells) return
    const palette = paletteRef.current
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = palette[cells[y * COLS + x]]
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
  }, [])

  useEffect(() => {
    cellsRef.current = loadCells()
    repaint()
    return () => {
      clearTimeout(saveTimer.current)
      clearTimeout(armTimer.current)
    }
  }, [repaint])

  // The canvas element is recreated when the orientation branch swaps; repaint
  // the new backing store from the cells so a rotation never blanks the drawing.
  useLayoutEffect(() => {
    repaint()
  }, [portrait, repaint])

  // The custom slot's colour can change after cells already used it - repaint
  // so those cells pick up the new colour immediately.
  useEffect(() => {
    paletteRef.current = [...FIXED_PALETTE, customColor]
    repaint()
  }, [customColor, repaint])

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
      ctx.fillStyle = paletteRef.current[idx]
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

  // The stage and full-screen transforms scale the canvas; map pointer coords via its box.
  const cellFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS)
    return { x, y }
  }

  // A stroke joins each pointer sample to the last one, so fast moves (a finger) leave no gaps.
  const lastCell = useRef<{ x: number; y: number } | null>(null)
  const applyAt = (e: React.PointerEvent<HTMLCanvasElement>, fresh = false) => {
    const { x, y } = cellFromEvent(e)
    if (tool === 'fill') { flood(x, y, colorIdx); return }
    const from = fresh || !lastCell.current ? { x, y } : lastCell.current
    for (const p of lineCells(from.x, from.y, x, y)) setCell(p.x, p.y, tool === 'eraser' ? BLANK : colorIdx)
    lastCell.current = { x, y }
  }

  const clearAll = () => {
    cellsRef.current?.fill(BLANK)
    repaint()
    persist()
  }

  const clearClick = () => {
    if (!armed) {
      setArmed(true)
      clearTimeout(armTimer.current)
      armTimer.current = setTimeout(() => setArmed(false), 3000)
      return
    }
    clearTimeout(armTimer.current)
    setArmed(false)
    clearAll()
  }

  const selectColor = (i: number) => {
    setColorIdx(i)
    if (tool === 'eraser') setTool('pencil')
  }

  const selectCustom = (value: string) => {
    setCustomColor(value)
    setColorIdx(CUSTOM_IDX)
    if (tool === 'eraser') setTool('pencil')
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
    <ArcadeFrame fs={fs} portrait={portrait}>
      <ScreenStrip time={time} fs={fs} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />

      {portrait ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">
          <canvas
            ref={canvasRef}
            width={COLS * CELL}
            height={ROWS * CELL}
            role="img"
            aria-label={labels.canvas}
            style={{ width: canvasW, height: canvasH, imageRendering: 'pixelated', touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              applyAt(e, true)
            }}
            onPointerMove={(e) => {
              if (e.buttons & 1 && tool !== 'fill') applyAt(e)
            }}
          />

          {/* Tools */}
          <div className="flex items-center gap-2">
            <ArcadeButton size="xl" pressed={tool === 'pencil'} onClick={() => setTool('pencil')}>{labels.pencil}</ArcadeButton>
            <ArcadeButton size="xl" pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>{labels.eraser}</ArcadeButton>
            <ArcadeButton size="xl" pressed={tool === 'fill'} onClick={() => setTool('fill')}>{labels.fill}</ArcadeButton>
          </div>

          {/* Palette: the 10 fixed colours in a 5x2 grid plus the custom swatch */}
          <div className="flex items-center justify-center gap-3">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 36px)', gap: 4 }}>
              {FIXED_PALETTE.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => selectColor(i)}
                  aria-label={labels.color.replace('{n}', String(i + 1))}
                  aria-pressed={colorIdx === i}
                  className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: hex,
                    border: colorIdx === i ? '2px solid #3a3028' : '1px solid #c8b8a8',
                  }}
                />
              ))}
            </div>
            {/* Custom colour wheel: the whole swatch opens the native picker. */}
            <label
              className="relative outline-none focus-within:outline focus-within:outline-1 focus-within:outline-[#3a3028]"
              style={{ width: 36, height: 36, cursor: 'pointer' }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: customColor,
                  border: colorIdx === CUSTOM_IDX ? '2px solid #3a3028' : '1px solid #c8b8a8',
                }}
              />
              <input
                type="color"
                value={customColor}
                onChange={(e) => selectCustom(e.target.value)}
                aria-label={labels.color.replace('{n}', 'wheel')}
                style={{ position: 'absolute', inset: 0, width: 36, height: 36, padding: 0, border: 'none', background: 'none', opacity: 0, cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* Clear and Download */}
          <div className="flex items-center gap-2">
            <ArcadeButton size="xl" pressed={armed || undefined} onClick={clearClick}>
              {armed ? labels.clearConfirm : labels.clear}
            </ArcadeButton>
            <ArcadeButton size="xl" onClick={download}>{labels.download}</ArcadeButton>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div
            className="flex items-center gap-1.5 px-[5px] border-b flex-shrink-0"
            style={{ height: 24, backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px', color: '#3a3028' }}
          >
            <StripButton pressed={tool === 'pencil'} onClick={() => setTool('pencil')}>{labels.pencil}</StripButton>
            <StripButton pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>{labels.eraser}</StripButton>
            <StripButton pressed={tool === 'fill'} onClick={() => setTool('fill')}>{labels.fill}</StripButton>
            <span className="flex items-center gap-1 ml-2">
              {FIXED_PALETTE.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => selectColor(i)}
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
              {/* Custom colour wheel: native picker sits over a swatch showing the current pick. */}
              <span className="relative" style={{ width: 12, height: 12 }}>
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    backgroundColor: customColor,
                    border: colorIdx === CUSTOM_IDX ? '2px solid #3a3028' : '1px solid #c8b8a8',
                  }}
                />
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => selectCustom(e.target.value)}
                  aria-label={labels.color.replace('{n}', 'wheel')}
                  className="absolute inset-0 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028] cursor-pointer"
                  style={{ width: 12, height: 12, padding: 0, border: 'none', background: 'none' }}
                />
              </span>
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <StripButton pressed={armed || undefined} onClick={clearClick}>
                {armed ? labels.clearConfirm : labels.clear}
              </StripButton>
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
                applyAt(e, true)
              }}
              onPointerMove={(e) => {
                if (e.buttons & 1 && tool !== 'fill') applyAt(e)
              }}
            />
          </div>
        </>
      )}
    </ArcadeFrame>
  )
}
