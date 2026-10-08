// src/components/room/mahjong/tile-tip.tsx
'use client'

/**
 * Hover tooltips for Mahjong tiles: what the Chinese on a tile says, how to say
 * it and what the tile does, for visitors who do not read Chinese. Every TileView
 * inside the layer reports its hovers through TileTipContext (mouse only; touch
 * players get the same text from the tile guide in How to play and, in Solitaire,
 * the preview beside the board).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ARCADE, PIXEL_FONT } from '../DeskArcade'
import { MUTED } from './chrome'
import { CJK } from './tile-art'
import { tileInfo, type TileInfo, type TileInfoLabels } from './tile-info'
import { TileTipContext, type TileTipApi } from './tip-context'

/** Hover time before the first tooltip; Solitaire waits longer, since scanning the board crosses many tiles. */
const SHOW_MS = { four: 220, solitaire: 450 }
const TIP_W = 184
const GAP = 4

interface Tip {
  info: TileInfo
  x: number
  /** Above the tile: distance from the layer's bottom edge. Below: distance from its top. */
  bottom?: number
  top?: number
}

/** The tooltip's text: glyph, name and reading, then what it means and how it plays. */
export function TileInfoCard({ info, mode, labels, compact = false }: { info: TileInfo; mode: 'four' | 'solitaire'; labels: TileInfoLabels; compact?: boolean }) {
  const font = compact ? 9 : 10
  return (
    <div className="flex flex-col" style={{ gap: 3, ...PIXEL_FONT, fontSize: font, lineHeight: 1.3 }}>
      <div className="flex items-start" style={{ gap: 6 }}>
        {info.glyph && (
          <span lang="zh-Hant" style={{ fontFamily: CJK, fontSize: compact ? 15 : 18, lineHeight: 1, fontWeight: 700, color: ARCADE.panelText, textShadow: 'none' }}>
            {info.glyph}
          </span>
        )}
        <span className="flex flex-col min-w-0 flex-1">
          <span style={{ color: ARCADE.gold }}>{info.name}</span>
          {info.pinyin && <span style={{ color: MUTED }}>{info.pinyin}</span>}
        </span>
        <span className="flex-shrink-0" style={{ fontSize: 8, padding: '1px 3px', border: `1px solid ${ARCADE.panelBorder}`, color: MUTED }}>
          {labels.kinds[info.kind]}
        </span>
      </div>
      {info.meaning && <span>{info.meaning}</span>}
      <span style={{ color: MUTED }}>{mode === 'four' ? info.play : info.match}</span>
    </div>
  )
}

export function TileTipLayer({ labels, mode, children }: { labels: TileInfoLabels; mode: 'four' | 'solitaire'; children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef(0)
  const shownRef = useRef(false)
  const [tip, setTip] = useState<Tip | null>(null)
  const labelsRef = useRef(labels)
  const modeRef = useRef(mode)
  useEffect(() => {
    labelsRef.current = labels
    modeRef.current = mode
  }, [labels, mode])

  const measure = useCallback((code: string, el: HTMLElement) => {
    const layer = layerRef.current
    const info = tileInfo(code, labelsRef.current)
    if (!layer || !info || !el.isConnected) return
    const lr = layer.getBoundingClientRect()
    // The stage and full screen scale the app with a transform; work in the app's own pixels.
    const k = layer.offsetWidth > 0 ? lr.width / layer.offsetWidth : 1
    const er = el.getBoundingClientRect()
    const cx = (er.left + er.width / 2 - lr.left) / k
    const top = (er.top - lr.top) / k
    const bottom = (er.bottom - lr.top) / k
    const lw = layer.offsetWidth
    const lh = layer.offsetHeight
    const x = Math.max(GAP, Math.min(lw - TIP_W - GAP, Math.round(cx - TIP_W / 2)))
    // Above the tile when there is room for a typical tooltip, else below it.
    const above = top > 96 || bottom > lh - 96
    shownRef.current = true
    setTip(above ? { info, x, bottom: Math.round(lh - top + GAP) } : { info, x, top: Math.round(bottom + GAP) })
  }, [])

  const api = useMemo<TileTipApi>(
    () => ({
      enter(code, el) {
        window.clearTimeout(timerRef.current)
        currentRef.current = el
        // Moving from tile to tile keeps the tooltip up and swaps it at once.
        if (shownRef.current) measure(code, el)
        else timerRef.current = window.setTimeout(() => measure(code, el), SHOW_MS[modeRef.current])
      },
      leave(el) {
        if (currentRef.current !== el) return
        currentRef.current = null
        window.clearTimeout(timerRef.current)
        // A short grace period lets the pointer cross the gap between two tiles without a flicker.
        timerRef.current = window.setTimeout(() => {
          shownRef.current = false
          setTip(null)
        }, 60)
      },
    }),
    [measure],
  )

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  return (
    <TileTipContext.Provider value={api}>
      {children}
      <div ref={layerRef} aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 }}>
        {tip && (
          <div
            className="absolute border-2"
            style={{
              left: tip.x,
              top: tip.top,
              bottom: tip.bottom,
              width: TIP_W,
              padding: '5px 6px',
              backgroundColor: ARCADE.panel,
              borderColor: ARCADE.panelBorder,
              borderRadius: 3,
              color: ARCADE.panelText,
              textShadow: `1px 1px 0 ${ARCADE.panelShadow}`,
              boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
            }}
          >
            <TileInfoCard info={tip.info} mode={mode} labels={labels} />
          </div>
        )}
      </div>
    </TileTipContext.Provider>
  )
}
