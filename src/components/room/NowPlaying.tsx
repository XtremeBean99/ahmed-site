'use client'

import { useState, useEffect, useRef } from 'react'
import { useRoomAudio } from './RoomAudioProvider'
import { PLAYLIST } from '@/lib/room/playlist'
import { extractCoverFromMp3 } from '@/lib/room/id3'

interface NowPlayingProps {
  labels: {
    play: string
    pause: string
    skip: string
    nowPlaying: string
    volume: string
  }
}

export function NowPlaying({ labels }: NowPlayingProps) {
  const { playing, trackIndex, volume, toggle, nextTrack, setVolume } = useRoomAudio()
  const [coverError, setCoverError] = useState(false)
  const [embeddedCover, setEmbeddedCover] = useState<string | null>(null)
  const prevTrackRef = useRef('')
  const track = PLAYLIST[trackIndex]

  // When track changes and has no external cover, try extracting embedded art
  useEffect(() => {
    if (track.cover || prevTrackRef.current === track.src) return
    prevTrackRef.current = track.src
    setEmbeddedCover(null)

    extractCoverFromMp3(track.src).then((cover) => {
      if (cover) {
        const blob = new Blob([new Uint8Array(cover.data)], { type: cover.mime })
        setEmbeddedCover(URL.createObjectURL(blob))
      }
    }).catch(() => {})

    return () => {
      // Clean up old blob URL on next run
    }
  }, [track.src, track.cover])

  const coverSrc = track.cover || embeddedCover

  return (
    <div
      className="fixed bottom-4 left-4 z-30 flex items-center gap-2"
      role="region"
      aria-label={labels.nowPlaying}
      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }}
    >
      {/* Album cover or placeholder */}
      {coverSrc && !coverError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={coverSrc}
          alt=""
          className="w-9 h-9 border-2 flex-shrink-0"
          style={{
            borderColor: '#5a4430',
            imageRendering: 'pixelated',
            borderRadius: '1px',
          }}
          onError={() => setCoverError(true)}
        />
      ) : (
        <svg
          width="36" height="36" viewBox="0 0 16 16"
          shapeRendering="crispEdges" aria-hidden="true"
          className="flex-shrink-0 border-2"
          style={{ borderColor: '#5a4430', borderRadius: '1px' }}
        >
          <rect x="2" y="1" width="12" height="14" rx="1" fill="#3d2e1e" />
          <rect x="4" y="4" width="8" height="6" rx="1" fill="#1a1512" />
          <circle cx="6" cy="7" r="1.5" fill="#5a4430" />
          <circle cx="10" cy="7" r="1.5" fill="#5a4430" />
          <rect x="5" y="11" width="6" height="2" fill="#5a4430" />
        </svg>
      )}

      {/* Track info */}
      <div className="flex flex-col min-w-0 max-w-[200px]">
        <span className="text-[12px] text-[#e8d5b0] leading-tight truncate"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {track.title}
        </span>
        {track.artist && (
          <span className="text-[10px] text-[#a09080] leading-tight truncate"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            {track.artist}
          </span>
        )}
      </div>

      {/* Play/pause */}
      <button onClick={toggle} aria-label={playing ? labels.pause : labels.play}
        className="flex-shrink-0 p-0.5 text-[#c8b89a] hover:text-[#e0d0b0] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c8b89a]">
        <svg width="18" height="18" viewBox="0 0 16 16" shapeRendering="crispEdges">
          {playing ? (
            <><rect x="3" y="3" width="4" height="10" fill="currentColor" /><rect x="9" y="3" width="4" height="10" fill="currentColor" /></>
          ) : (
            <polygon points="4,2 14,8 4,14" fill="currentColor" />
          )}
        </svg>
      </button>

      {/* Skip */}
      <button onClick={nextTrack} aria-label={labels.skip}
        className="flex-shrink-0 p-0.5 text-[#c8b89a] hover:text-[#e0d0b0] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c8b89a]">
        <svg width="18" height="18" viewBox="0 0 16 16" shapeRendering="crispEdges">
          <polygon points="3,2 11,8 3,14" fill="currentColor" />
          <rect x="12" y="2" width="2" height="12" fill="currentColor" />
        </svg>
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label={labels.volume}
        className="flex-shrink-0 cursor-pointer outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c8b89a]"
        style={{ width: 56, height: 14, accentColor: '#c8b89a' }}
      />
    </div>
  )
}
