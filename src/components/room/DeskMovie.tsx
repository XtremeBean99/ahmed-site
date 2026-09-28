'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScreenStrip, useDeskScreen } from './ScreenStrip'
import { ArcadeButton } from './pixel-ui'
import { useRoomAudio } from './RoomAudioProvider'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

// Portrait seek bar with a 28px thumb; the desk keeps the native accent-colour slider.
const SEEK_CSS = `
.room-seek{-webkit-appearance:none;appearance:none;height:28px;background:transparent;outline:none;cursor:pointer}
.room-seek:focus-visible{outline:2px solid #5a4430;outline-offset:2px}
.room-seek::-webkit-slider-runnable-track{height:8px;background:#c8b8a8;border:1px solid #b8a88f}
.room-seek::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;margin-top:-9px;background:#8a6a3a;border:2px solid #3a3028;border-radius:0}
.room-seek::-moz-range-track{height:8px;background:#c8b8a8;border:1px solid #b8a88f}
.room-seek::-moz-range-thumb{width:28px;height:28px;background:#8a6a3a;border:2px solid #3a3028;border-radius:0}
`

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
  backLabel: string
  labels: MovieLabels
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
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
 * do not talk over each other. On a portrait phone the picture is 320x180 at
 * the top and the transport sits in its own row underneath.
 */
export function DeskMovie({ time, desktopLabel, backLabel, labels, onDesktop, onBack }: DeskMovieProps) {
  const { portrait } = useDeskScreen()
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

  const seekProps = {
    type: 'range' as const,
    min: 0,
    max: duration || 0,
    step: 1,
    value: current,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => seek(Number(e.target.value)),
    'aria-label': labels.seek,
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#1b1b1b' }}>
      {portrait && <style>{SEEK_CSS}</style>}
      <ScreenStrip time={time} title={labels.title} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />

      {/* Letterboxed picture: fixed 16:9 at the top in portrait, flex-1 on the desk */}
      <div
        className={`relative ${portrait ? 'w-full flex-shrink-0' : 'flex-1'}`}
        style={{ backgroundColor: '#000', height: portrait ? 180 : undefined }}
      >
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
                border: '2px solid #c8b8a8',
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
        className={`flex items-center gap-2 px-3 flex-shrink-0 border-t ${portrait ? 'py-1' : 'h-9'}`}
        style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', ...PIXEL, fontSize: portrait ? 12 : 10, color: '#3a3028' }}
      >
        <ArcadeButton tone="dark" size={portrait ? 'xl' : 'sm'} onClick={togglePlay} ariaLabel={playing ? labels.pause : labels.play}>
          {playing ? '❚❚' : '▶'}
        </ArcadeButton>
        <span style={{ minWidth: portrait ? 44 : 34 }}>{clock(current)}</span>
        {portrait ? (
          <input {...seekProps} className="room-seek flex-1" style={{ touchAction: 'none' }} />
        ) : (
          <input
            {...seekProps}
            className="flex-1 h-[6px] appearance-none"
            style={{ accentColor: '#8a6a3a', backgroundColor: '#c8b8a8' }}
          />
        )}
        <span style={{ minWidth: portrait ? 44 : 34 }}>{clock(duration)}</span>
        {!portrait && (
          <ArcadeButton
            tone="dark"
            size="sm"
            onClick={() => {
              const el = videoRef.current
              if (!el) return
              el.muted = !el.muted
              setMuted(el.muted)
            }}
            ariaLabel={muted ? labels.unmute : labels.mute}
          >
            {muted ? '✕♪' : '♪'}
          </ArcadeButton>
        )}
        <ArcadeButton tone="dark" size={portrait ? 'xl' : 'sm'} onClick={fullscreen} ariaLabel={labels.fullscreen}>
          ⛶
        </ArcadeButton>
      </div>

      {/* The rest of the portrait screen stays black like the desk letterbox */}
      {portrait && <div className="flex-1 min-h-0" style={{ backgroundColor: '#000' }} />}
    </div>
  )
}
