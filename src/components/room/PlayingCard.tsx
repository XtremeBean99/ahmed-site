// src/components/room/PlayingCard.tsx
'use client'

import { memo } from 'react'
import { cardId, type Card } from '@/lib/games/cards'
import { paintCard, CARD_W, CARD_H, type CardFace } from './card-art'

export { CARD_W, CARD_H }

const canvases = new Map<string, HTMLCanvasElement>()
const urls = new Map<string, string>()
const key = (face: CardFace) => (face === 'back' ? 'back' : cardId(face))

/** The card painted once into a canvas, e.g. for drawImage in a canvas effect. Browser only. */
export function cardCanvas(face: CardFace): HTMLCanvasElement {
  const k = key(face)
  let cv = canvases.get(k)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = CARD_W
    cv.height = CARD_H
    cv.getContext('2d')!.putImageData(new ImageData(paintCard(face), CARD_W, CARD_H), 0, 0)
    canvases.set(k, cv)
  }
  return cv
}

/** Cached PNG data URL of the card art. Browser only. */
export function cardUrl(face: CardFace): string {
  const k = key(face)
  let url = urls.get(k)
  if (!url) {
    url = cardCanvas(face).toDataURL('image/png')
    urls.set(k, url)
  }
  return url
}

interface PlayingCardProps {
  /** Omit, or pass faceUp={false}, for the card back. */
  card?: Card
  faceUp?: boolean
  /** Whole-number multiple of the 45x63 art. */
  scale?: number
  /** Accessible name; empty marks the card decorative (the game labels its own controls). */
  alt?: string
  /** 1px hard drop shadow, on by default. */
  shadow?: boolean
  className?: string
  style?: React.CSSProperties
}

/** A pixel-art playing card at an exact integer scale. */
export const PlayingCard = memo(function PlayingCard({ card, faceUp = true, scale = 1, alt = '', shadow = true, className, style }: PlayingCardProps) {
  const face: CardFace = card && faceUp ? card : 'back'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cardUrl(face)}
      alt={alt}
      width={CARD_W * scale}
      height={CARD_H * scale}
      draggable={false}
      className={className}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        filter: shadow ? `drop-shadow(${scale}px ${scale}px 0 rgba(20,14,10,0.35))` : undefined,
        ...style,
      }}
    />
  )
})
