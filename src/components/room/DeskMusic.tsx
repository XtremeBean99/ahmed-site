'use client'

import { useRoomAudio } from './RoomAudioProvider'
import { PLAYLIST } from '@/lib/room/playlist'
import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

interface MusicLabels {
  title: string
  nowPlaying: string
  select: string
}

interface DeskMusicProps {
  time: string
  desktopLabel: string
  labels: MusicLabels
  onDesktop: () => void
}

export function DeskMusic({ time, desktopLabel, labels, onDesktop }: DeskMusicProps) {
  const { playing, trackIndex, toggle, selectTrack } = useRoomAudio()

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#121212' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>
          {desktopLabel}
        </StripButton>
      </ScreenStrip>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#282828' }}>
        <MusicNoteIcon />
        <span className="text-[11px]" style={{ ...PIXEL, color: '#1db954' }}>
          {labels.title}
        </span>
        {playing && (
          <span className="ml-auto flex items-center gap-[2px]">
            <span className="inline-block w-[2px] h-[8px] animate-pulse" style={{ backgroundColor: '#1db954' }} />
            <span className="inline-block w-[2px] h-[6px] animate-pulse" style={{ backgroundColor: '#1db954', animationDelay: '0.15s' }} />
            <span className="inline-block w-[2px] h-[5px] animate-pulse" style={{ backgroundColor: '#1db954', animationDelay: '0.3s' }} />
          </span>
        )}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {PLAYLIST.map((track, i) => {
          const isActive = i === trackIndex
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => selectTrack(i)}
              className="flex items-center gap-2 px-3 py-[6px] w-full text-left border-b transition-colors"
              style={{
                backgroundColor: isActive ? '#282828' : 'transparent',
                borderColor: '#1e1e1e',
              }}
              aria-label={`${labels.select}: ${track.title}`}
            >
              {/* Track number / play icon */}
              <span
                className="flex-shrink-0 w-4 text-center text-[9px]"
                style={{ ...PIXEL, color: isActive && playing ? '#1db954' : '#808080' }}
              >
                {isActive && playing ? '♪' : i + 1}
              </span>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] leading-tight truncate"
                  style={{ ...PIXEL, color: isActive ? '#ffffff' : '#b3b3b3' }}
                >
                  {track.title}
                </div>
                {track.artist && (
                  <div
                    className="text-[8px] leading-tight truncate"
                    style={{ ...PIXEL, color: '#808080' }}
                  >
                    {track.artist}
                  </div>
                )}
              </div>

              {/* Duration placeholder + active dot */}
              <span className="flex-shrink-0 text-[9px]" style={{ ...PIXEL, color: '#808080' }}>
                {isActive && playing ? (
                  <span style={{ color: '#1db954' }}>●</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-4 py-2 border-t" style={{ borderColor: '#282828' }}>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 px-3 py-1"
          style={{ ...PIXEL, color: '#b3b3b3', fontSize: '10px' }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <span style={{ color: '#1db954', fontSize: '12px' }}>
            {playing ? '⏸' : '▶'}
          </span>
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  )
}

function MusicNoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="3" y="6" width="2" height="6" fill="#1db954" />
      <rect x="8" y="2" width="2" height="10" fill="#1db954" />
      <rect x="1" y="6" width="6" height="2" rx="1" fill="#1db954" />
      <rect x="6" y="2" width="6" height="2" rx="1" fill="#1db954" />
    </svg>
  )
}
