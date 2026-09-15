'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import type { PlayerColor } from '@/lib/games/catan/types'
import { PLAYER_COLORS } from './pixel-art'
import { SPRITES, type SpriteName } from './sprites'
import { UI_SPRITES, type UiSpriteName } from './ui-sprites'

export type AnySpriteName = SpriteName | UiSpriteName

export function spriteSize(name: AnySpriteName): { width: number; height: number } {
  const meta = name in SPRITES ? SPRITES[name as SpriteName] : UI_SPRITES[name as UiSpriteName]
  return { width: meta.width, height: meta.height }
}

const KEY_BASE = [255, 0, 255]
const KEY_HIGHLIGHT = [255, 128, 255]
const KEY_SHADE = [128, 0, 128]

function mix(a: readonly number[], b: readonly number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

/**
 * Any manifest sprite (board or UI) from /catan/, drawn at an integer scale with no smoothing.
 * Player-colour board sprites (settlement, city, roads) are tinted when `color` is given.
 */
export function PixelSprite({
  name,
  scale = 1,
  alt = '',
  color,
  style,
}: {
  name: AnySpriteName
  scale?: number
  alt?: string
  color?: PlayerColor
  style?: CSSProperties
}) {
  const isBoard = name in SPRITES
  const meta = isBoard ? SPRITES[name as SpriteName] : UI_SPRITES[name as UiSpriteName]
  const src = `/catan/${meta.file}`
  const tint = isBoard && SPRITES[name as SpriteName].recolor && color ? color : null
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!tint) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (cancelled || !canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const base = PLAYER_COLORS[tint]
      const swaps: [number[], number[]][] = [
        [KEY_BASE, [...base]],
        [KEY_HIGHLIGHT, mix(base, [255, 255, 255], 0.4)],
        [KEY_SHADE, mix(base, [0, 0, 0], 0.55)],
      ]
      const d = pixels.data
      for (let i = 0; i < d.length; i += 4) {
        const swap = swaps.find(([key]) => d[i] === key[0] && d[i + 1] === key[1] && d[i + 2] === key[2])
        if (swap) [d[i], d[i + 1], d[i + 2]] = swap[1]
      }
      ctx.putImageData(pixels, 0, 0)
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [tint, src])

  const box: CSSProperties = {
    width: meta.width * scale,
    height: meta.height * scale,
    imageRendering: 'pixelated',
    display: 'inline-block',
    flexShrink: 0,
    ...style,
  }
  const a11y = alt ? { role: 'img' as const, 'aria-label': alt } : { 'aria-hidden': true }

  if (tint) {
    return <canvas ref={canvasRef} width={meta.width} height={meta.height} style={box} {...a11y} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={meta.width * scale} height={meta.height * scale} draggable={false} style={box} aria-hidden={alt ? undefined : true} />
}
