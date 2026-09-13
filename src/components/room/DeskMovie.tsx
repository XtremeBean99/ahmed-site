'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'
import { useRoomAudio } from './RoomAudioProvider'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface MovieLabels {
  title: string
  play: string
  pause: string
  fullscreen: string
  seek: string
  mute: string
  unmute: string
  tape: string
}

interface DeskMovieProps {
  time: string
  desktopLabel: string
  labels: MovieLabels
  onDesktop: () => void
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * The VHS player: plays /video/shrek.mp4 on the desk monitor inside a black
 * letterbox, with pixel transport controls and a fullscreen handoff to the
 * browser's own player. Starting the film pauses the room's music so the two
 * do not talk over each other.
 */
export function DeskMovie({ time, desktopLabel, labels, onDesktop }: DeskMovieProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [started, setStarted] = useState(false)
  const { playing: musicPlaying, toggle: toggleMusic } = useRoomAudio()

  const play = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (musicPlaying) toggleMusic()
    setStarted(true)
    void el.play()
  }, [musicPlaying, toggleMusic])

  const togglePlay = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) play()
    else el.pause()
  }, [play])

  const fullscreen = useCallback(() => {
    const el = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!el) return
    if (el.requestFullscreen) void el.requestFullscreen()
    else el.webkitEnterFullscreen?.()
  }, [])

  // Leaving the app stops the film rather than letting it play on unseen.
  useEffect(() => {
    const el = videoRef.current
    return () => {
      el?.pause()
    }
  }, [])

  const seek = useCallback((value: number) => {
    const el = videoRef.current
    if (el) el.currentTime = value
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#1b1b1b' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>

      {/* Letterboxed picture */}
      <div className="relative flex-1" style={{ backgroundColor: '#000' }}>
        <video
          ref={videoRef}
          src="/video/shrek.mp4"
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'contain', backgroundColor: '#000' }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
          onClick={togglePlay}
        />

        {/* Big pixel play button until the tape rolls */}
        {!started && (
          <button
            type="button"
            onClick={play}
            aria-label={labels.play}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8b89a]"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: 46,
                height: 34,
                backgroundColor: '#e8e0d8',
                border: '2px solid #8a8078',
                color: '#2a2520',
                fontSize: 16,
                ...PIXEL,
              }}
            >
              ▶
            </span>
            <span style={{ ...PIXEL, fontSize: 10, color: '#e8e0d8', letterSpacing: '0.1em' }}>
              {labels.tape}
            </span>
          </button>
        )}
      </div>

      {/* Transport */}
      <div
        className="flex items-center gap-2 px-3 h-9 flex-shrink-0 border-t"
        style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', ...PIXEL, fontSize: 10, color: '#3a3028' }}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? labels.pause : labels.play}
          className="px-2 py-[2px] border outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
          style={{ borderColor: '#c8b8a8', backgroundColor: '#faf8f5' }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span style={{ minWidth: 34 }}>{clock(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={labels.seek}
          className="flex-1 h-[6px] appearance-none"
          style={{ accentColor: '#8a6a3a', backgroundColor: '#c8b8a8' }}
        />
        <span style={{ minWidth: 34 }}>{clock(duration)}</span>
        <button
          type="button"
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            el.muted = !el.muted
            setMuted(el.muted)
          }}
          aria-label={muted ? labels.unmute : labels.mute}
          className="px-2 py-[2px] border outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
          style={{ borderColor: '#c8b8a8', backgroundColor: '#faf8f5' }}
        >
          {muted ? '✕♪' : '♪'}
        </button>
        <button
          type="button"
          onClick={fullscreen}
          aria-label={labels.fullscreen}
          className="px-2 py-[2px] border outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
          style={{ borderColor: '#c8b8a8', backgroundColor: '#faf8f5' }}
        >
          ⛶
        </button>
      </div>
    </div>
  )
}
