'use client'

import { useRoomAudio } from './RoomAudioProvider'
import { PLAYLIST } from '@/lib/room/playlist'
import { useT } from '@/lib/i18n/client'
import { ScreenStrip, useDeskScreen } from './ScreenStrip'
import { ARCADE, ArcadeButton } from './pixel-ui'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

interface MusicLabels {
  title: string
  nowPlaying: string
  select: string
}

interface DeskMusicProps {
  time: string
  desktopLabel: string
  backLabel: string
  labels: MusicLabels
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
}

export function DeskMusic({ time, desktopLabel, backLabel, labels, onDesktop, onBack }: DeskMusicProps) {
  const { playing, trackIndex, toggle, selectTrack } = useRoomAudio()
  const audio = useT().room.audio
  const { portrait } = useDeskScreen()
  const cover = portrait ? 32 : 24

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: ARCADE.paper }}>
      <ScreenStrip time={time} title={labels.title} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 border-b ${portrait ? 'py-1.5' : 'py-2'}`} style={{ borderColor: ARCADE.stripBorder }}>
        <MusicNoteIcon />
        <span className={`truncate min-w-0 ${portrait ? 'text-[12px]' : 'text-[11px]'}`} style={{ ...PIXEL, color: ARCADE.ink }}>
          {labels.nowPlaying}: {PLAYLIST[trackIndex].title}
        </span>
        {playing && (
          <span className="ml-auto flex items-center gap-[2px]">
            <span className="inline-block w-[2px] h-[8px] animate-pulse" style={{ backgroundColor: ARCADE.olive }} />
            <span className="inline-block w-[2px] h-[6px] animate-pulse" style={{ backgroundColor: ARCADE.olive, animationDelay: '0.15s' }} />
            <span className="inline-block w-[2px] h-[5px] animate-pulse" style={{ backgroundColor: ARCADE.olive, animationDelay: '0.3s' }} />
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
              className={`flex items-center gap-2 px-3 w-full text-left border-b transition-colors ${portrait ? 'py-1' : 'py-[6px]'} ${isActive ? 'bg-[#3d2e1e]' : 'bg-transparent hover:bg-[#e8e0d8]'}`}
              style={{ borderColor: ARCADE.strip, minHeight: portrait ? 44 : undefined }}
              aria-label={`${labels.select}: ${track.title}`}
            >
              {/* Album cover or track number */}
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: cover, height: cover, backgroundColor: isActive && playing ? ARCADE.olive : ARCADE.strip }}
              >
                {track.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={track.cover}
                    alt=""
                    className="block"
                    style={{ width: cover, height: cover, objectFit: 'cover', imageRendering: 'auto' }}
                  />
                ) : (
                  <span className={portrait ? 'text-[10px]' : 'text-[9px]'} style={{ ...PIXEL, color: ARCADE.ink }}>
                    {isActive && playing ? '♪' : i + 1}
                  </span>
                )}
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div
                  className={`leading-tight truncate ${portrait ? 'text-[12px]' : 'text-[10px]'}`}
                  style={{ ...PIXEL, color: isActive ? ARCADE.panelText : ARCADE.ink }}
                >
                  {track.title}
                </div>
                {track.artist && (
                  <div
                    className={`leading-tight truncate ${portrait ? 'text-[10px]' : 'text-[8px]'}`}
                    style={{ ...PIXEL, color: isActive ? ARCADE.panelText : ARCADE.phosphorDim }}
                  >
                    {track.artist}
                  </div>
                )}
              </div>

              {/* Active indicator */}
              <span className="flex-shrink-0 text-[9px]" style={{ ...PIXEL, color: ARCADE.phosphorDim }}>
                {isActive && playing ? (
                  <span style={{ color: ARCADE.olive }}>●</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      {/* Playback controls */}
      <div className={`flex items-center justify-center border-t ${portrait ? 'gap-3 py-1.5' : 'gap-4 py-2'}`} style={{ borderColor: ARCADE.stripBorder }}>
        {portrait ? (
          <ArcadeButton tone="dark" size="xl" onClick={toggle} ariaLabel={playing ? audio.pause : audio.play} className="gap-1.5">
            <span aria-hidden style={{ color: ARCADE.olive }}>{playing ? '⏸' : '▶'}</span>
            {playing ? audio.pause : audio.play}
          </ArcadeButton>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-1 px-3 py-1"
            style={{ ...PIXEL, color: ARCADE.phosphorDim, fontSize: '10px' }}
          >
            <span aria-hidden style={{ color: ARCADE.olive, fontSize: '12px' }}>
              {playing ? '⏸' : '▶'}
            </span>
            {playing ? audio.pause : audio.play}
          </button>
        )}
      </div>
    </div>
  )
}

function MusicNoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="3" y="6" width="2" height="6" fill={ARCADE.olive} />
      <rect x="8" y="2" width="2" height="10" fill={ARCADE.olive} />
      <rect x="1" y="6" width="6" height="2" rx="1" fill={ARCADE.olive} />
      <rect x="6" y="2" width="6" height="2" rx="1" fill={ARCADE.olive} />
    </svg>
  )
}
