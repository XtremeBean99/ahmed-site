'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import {
  ROOM_OBJECTS,
  MONITOR_LOADING_FRAMES,
  MONITOR_LOADING_RECT,
  SIDE_TABLE_RECT,
  CLOCK_FACE_RECT,
  CLOCK_FACE_SKEW_DEG,
} from '@/lib/room/objects'
import { useStageScale } from '@/lib/room/useStageScale'
import { loadPrefs, savePrefs } from '@/lib/room/storage'
import { RoomStage } from './RoomStage'
import { RoomHud } from './RoomHud'
import { RoomAudioProvider } from './RoomAudioProvider'
import { NowPlaying } from './NowPlaying'
import { Monitor } from './Monitor'
import { RoomSpeakers } from './RoomSpeakers'
import { AnimatedSprite } from './AnimatedSprite'
import { DeskView } from './DeskView'
import { SideTableClock } from './SideTableClock'
import { RoomObject } from './RoomObject'
import {
  ICON_HOME,
  ICON_GAMES,
  ICON_PROJECTS,
  ICON_TUTORING,
  ICON_CONTACT,
  ICON_LEGAL,
} from './DeskIcon'

type View = 'room' | 'zooming' | 'desk' | 'leaving'

interface RoomProps {
  dict: {
    room: {
      navLabel: string
      monitorLabel: string
      posterLabel: string
      saitamaLabel: string
      bonsaiLabel: string
      lampLabel: string
      coffeeLabel: string
      sideTableClockLabel: string
      posterClickHint: string
      enterSite: string
      hint: string
      skip: string
      audio: {
        play: string
        pause: string
        skip: string
        nowPlaying: string
        speakersLabel: string
        volume: string
      }
    }
    desk: {
      home: string
      games: string
      projects: string
      tutoring: string
      contact: string
      legal: string
      back: string
      desktop: string
      expand: string
      browserTitle: string
      screenLabel: string
    }
  }
}

export function Room({ dict }: RoomProps) {
  const t = dict
  const reduce = useReducedMotion()
  const scale = useStageScale()
  const [view, setView] = useState<View>('room')
  const [lampOn, setLampOn] = useState(true)
  const [lampFlicker, setLampFlicker] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [visitCount, setVisitCount] = useState(0)
  const [clock24h, setClock24h] = useState(true)
  const [lampHovered, setLampHovered] = useState(false)

  // Load lamp pref on mount
  useEffect(() => { const p = loadPrefs(); setLampOn(p.lampOn); setClock24h(p.clock24h); setVisitCount(p.visitCount + 1); savePrefs({ visitCount: p.visitCount + 1 }) }, [])

  // Timeout refs
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigatingRef = useRef(false)

  // Deep-link: check for #desk on mount
  useEffect(() => {
    if (window.location.hash === '#desk') {
      setView('desk')
    }
  }, [])

  // History: popstate → back to room
  useEffect(() => {
    const onPop = () => {
      if (view === 'desk') {
        setView('room')
        // If we pushed state, pop it; otherwise just update hash
        if (window.location.hash === '#desk') {
          window.location.hash = ''
        }
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [view])

  // Clear timeouts helper
  const clearTimeouts = useCallback(() => {
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null }
    if (navRef.current) { clearTimeout(navRef.current); navRef.current = null }
  }, [])

  // Shared helper: enter desk view, clearing both timers
  const enterDesk = useCallback(() => {
    clearTimeouts()
    setView('desk')
    window.history.pushState({ view: 'desk' }, '', '#desk')
    navigatingRef.current = false
  }, [clearTimeouts])

  useEffect(() => {
    return () => clearTimeouts()
  }, [clearTimeouts])

  // Monitor click → zoom into desk
  const handleEnter = useCallback(() => {
    if (reduce || navigatingRef.current) {
      enterDesk()
      return
    }
    navigatingRef.current = true
    setView('zooming')

    // Safety timeout: force entry after 1.5s
    safetyRef.current = setTimeout(enterDesk, 1500)

    // After zoom completes (~800 ms)
    navRef.current = setTimeout(enterDesk, 800)
  }, [reduce, enterDesk])

  // Escape cancels zoom
  const cancelTransition = useCallback(() => {
    setView('room')
    navigatingRef.current = false
    clearTimeouts()
  }, [clearTimeouts])

  useEffect(() => {
    if (view !== 'zooming') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTransition()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, cancelTransition])

  // Desk → back to room
  const handleDeskBack = useCallback(() => {
    // popstate handler will catch this
    if (window.location.hash === '#desk') {
      window.history.back()
    } else {
      setView('room')
    }
  }, [])

  // One lamp toggle for both views: persists the pref and fires the flicker.
  const toggleLamp = useCallback(() => {
    setLampOn((v) => {
      const n = !v
      savePrefs({ lampOn: n })
      setLampFlicker(true)
      setTimeout(() => setLampFlicker(false), 500)
      return n
    })
  }, [])

  // Digital clock: click toggles 12/24-hour display, persisted.
  const toggleClockFormat = useCallback(() => {
    setClock24h((v) => {
      const n = !v
      savePrefs({ clock24h: n })
      return n
    })
  }, [])

  const monitorObj = ROOM_OBJECTS.find((o) => o.id === 'monitor')!
  const posterObj = ROOM_OBJECTS.find((o) => o.id === 'poster')!
  const saitamaObj = ROOM_OBJECTS.find((o) => o.id === 'saitama')!
  const bonsaiObj = ROOM_OBJECTS.find((o) => o.id === 'bonsai')!
  const coffeeObj = ROOM_OBJECTS.find((o) => o.id === 'coffee')!
  const clockObj = ROOM_OBJECTS.find((o) => o.id === 'clock')!

  // Stage point the zoom converges on: the centre of the monitor glass,
  // (360, 331) in stage coords. Offsets are relative to the monitor rect
  // (235, 257) — re-derive if the sprite crop ever changes.
  const screenCenterX = monitorObj.x + 125
  const screenCenterY = monitorObj.y + 74

  const STAGE_W = 1408
  const STAGE_H = 768
  const glowX = (screenCenterX / STAGE_W) * 100
  const glowY = (screenCenterY / STAGE_H) * 100

  const deskShortcuts = [
    { id: 'home', label: t.desk.home, href: '/home', icon: ICON_HOME },
    { id: 'games', label: t.desk.games, href: '/games', icon: ICON_GAMES },
    { id: 'projects', label: t.desk.projects, href: '/projects', icon: ICON_PROJECTS },
    { id: 'tutoring', label: t.desk.tutoring, href: '/tutoring', icon: ICON_TUTORING },
    { id: 'contact', label: t.desk.contact, href: '/home#contact', icon: ICON_CONTACT },
    { id: 'legal', label: t.desk.legal, href: '/legal/terms', icon: ICON_LEGAL },
  ]

  // Desk view
  if (view === 'desk') {
    return (
      <RoomAudioProvider>
        <DeskView
          shortcuts={deskShortcuts}
          backLabel={t.desk.back}
          screenLabel={t.desk.screenLabel}
          desktopLabel={t.desk.desktop}
          expandLabel={t.desk.expand}
          browserTitle={t.desk.browserTitle}
          speakersLabel={t.room.audio.speakersLabel}
          lampOn={lampOn}
          lampFlicker={lampFlicker}
          lampLabel={t.room.lampLabel}
          onToggleLamp={toggleLamp}
          onBack={handleDeskBack}
        />
        <NowPlaying labels={t.room.audio} />
      </RoomAudioProvider>
    )
  }

  return (
    <RoomAudioProvider>
    <div className="relative w-full h-screen overflow-hidden bg-[#1a1210]">
      <RoomHud
        enterLabel={t.room.enterSite}
        hintLabel={t.room.hint}
        skipLabel={t.room.skip}
      />

      <NowPlaying labels={t.room.audio} />

      <nav aria-label={t.room.navLabel}>
        <RoomStage
          scale={scale}
          zoomScale={view === 'zooming' && !reduce ? 3.2 : 1}
          zoomOriginX={screenCenterX}
          zoomOriginY={screenCenterY}
        >
          {/* Lamp-off background (always present, behind lamp-on) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/room/background-lamp-off.png"
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Lamp-on background (LCP, fades out when lamp off) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/room/background.png"
            alt=""
            fetchPriority="high"
            draggable={false}
            className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
            style={{
              imageRendering: 'pixelated',
              opacity: lampOn ? 1 : 0,
              transition: reduce ? 'none' : 'opacity 0.4s ease',
            }}
          />

          <Monitor
            label={t.room.monitorLabel}
            x={monitorObj.x}
            y={monitorObj.y}
            w={monitorObj.w}
            h={monitorObj.h}
            frames={monitorObj.frames}
            loadingFrames={MONITOR_LOADING_FRAMES}
            loadingRect={MONITOR_LOADING_RECT}
            href={monitorObj.href!}
            onEnter={handleEnter}
          />

          {/* Desktop speakers — rendered AFTER Monitor so the cabinet buttons
              win clicks over the monitor's big anchor rect. Coffee mug (later
              still) wins its own overlap with the left cabinet. */}
          <RoomSpeakers
            lampOn={lampOn}
            lampFlicker={lampFlicker}
            speakersLabel={t.room.audio.speakersLabel}
          />

          {/* Side table — decorative, no hotspot, no hover lift. Dims with the lamp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/room/side-table.png"
            alt=""
            draggable={false}
            className="absolute"
            style={{
              left: SIDE_TABLE_RECT.x,
              top: SIDE_TABLE_RECT.y,
              width: SIDE_TABLE_RECT.w,
              height: SIDE_TABLE_RECT.h,
              imageRendering: 'pixelated',
              filter: lampOn ? 'none' : 'brightness(0.72)',
              transition: reduce ? 'none' : 'filter 0.4s ease',
            }}
          />

          {/* Digital clock on the side table — click toggles 12/24 h. No hover lift. */}
          <SideTableClock
            label={t.room.sideTableClockLabel}
            x={clockObj.x}
            y={clockObj.y}
            w={clockObj.w}
            h={clockObj.h}
            frame={clockObj.frames[0]}
            faceRect={CLOCK_FACE_RECT}
            faceSkewDeg={CLOCK_FACE_SKEW_DEG}
            is24h={clock24h}
            lampOn={lampOn}
            onToggle={toggleClockFormat}
          />

          <AnimatedSprite
            label={t.room.posterLabel}
            x={posterObj.x}
            y={posterObj.y}
            w={posterObj.w}
            h={posterObj.h}
            frames={posterObj.frames}
            frameDuration={130}
            mode="play-once-hold"
            onClick={() => {
              setToast(t.room.posterClickHint)
              setTimeout(() => setToast(null), 2000)
            }}
          />

          <AnimatedSprite
            label={t.room.saitamaLabel}
            x={saitamaObj.x}
            y={saitamaObj.y}
            w={saitamaObj.w}
            h={saitamaObj.h}
            frames={saitamaObj.frames}
            frameDuration={100}
            mode="play-all-loop-last-two"
          />

          <AnimatedSprite
            label={t.room.bonsaiLabel}
            x={bonsaiObj.x}
            y={bonsaiObj.y}
            w={bonsaiObj.w}
            h={bonsaiObj.h}
            frames={bonsaiObj.frames}
            frameDuration={165}
            mode="loop"
            tooltipAlign="right"
          />

          {/* Lamp toggle hotspot */}
          <div
            style={{ position: 'absolute', left: 60, top: 300, width: 110, height: 220 }}
            onMouseEnter={() => setLampHovered(true)}
            onMouseLeave={() => setLampHovered(false)}
            onFocus={() => setLampHovered(true)}
            onBlur={() => setLampHovered(false)}
          >
            <RoomObject
              label={t.room.lampLabel}
              showTooltip={lampHovered}
              onActivate={() => setLampHovered(true)}
              onDeactivate={() => setLampHovered(false)}
              onClick={toggleLamp}
              tabIndex={0}
            >
              {/* Invisible hit target that forces the button to fill the area */}
              <div style={{ width: 110, height: 220 }} />
            </RoomObject>
          </div>

          {/* Coffee steam: three staggered wisps rising from the cup rim.
              Rendered before the mug so steam appears from behind it. */}
          {!reduce && (
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{ left: 175, top: 415, width: 48, height: 96 }}
            >
              {[
                { left: 6, sway: '6px', dur: '2.8s', delay: '0s' },
                { left: 0, sway: '-5px', dur: '3.6s', delay: '-1.2s' },
                { left: 13, sway: '4px', dur: '3.1s', delay: '-2.4s' },
              ].map((wisp, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src="/room/coffee-steam.png"
                  alt=""
                  draggable={false}
                  className="steam-wisp absolute"
                  style={
                    {
                      left: wisp.left,
                      bottom: 0,
                      imageRendering: 'pixelated',
                      animationDelay: wisp.delay,
                      '--sway': wisp.sway,
                      '--dur': wisp.dur,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}

          {/* Coffee mug: hover plays the highlight frames */}
          <AnimatedSprite
            label={t.room.coffeeLabel}
            x={coffeeObj.x}
            y={coffeeObj.y}
            w={coffeeObj.w}
            h={coffeeObj.h}
            frames={coffeeObj.frames}
            frameDuration={90}
            mode="play-once-hold"
          />

        </RoomStage>
      </nav>

      {/* Glow bloom */}
      <AnimatePresence>
        {view === 'zooming' && !reduce && (
          <motion.div
            className="fixed inset-0 z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              background: `radial-gradient(ellipse 300px 200px at ${glowX}% ${glowY}%, rgba(100,120,180,0.35) 0%, rgba(60,80,140,0.15) 40%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* White overlay */}
      <AnimatePresence>
        {view === 'zooming' && !reduce && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, delay: 0.35, ease: 'easeOut' }}
            style={{ background: '#faf8f5' }}
          />
        )}
      </AnimatePresence>

      {/* Poster click toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-3 py-1.5 border-2"
            style={{
              backgroundColor: '#3d2e1e',
              borderColor: '#5a4430',
              borderRadius: '3px',
              fontFamily: 'var(--font-pixel), "Courier New", monospace',
              fontSize: '12px',
              color: '#e8d5b0',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lamp glow */}
      {!reduce && view === 'room' && (
        <div
          className="fixed pointer-events-none z-0"
          style={{
            left: '8.5%',
            top: '12%',
            width: '15%',
            height: '15%',
            background: 'radial-gradient(ellipse, rgba(200,160,100,0.12) 0%, transparent 70%)',
            animation: 'lamp-glow 6s ease-in-out infinite',
          }}
        />
      )}

      {/* Ambient dust motes */}
      {!reduce && view === 'room' && (
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${8 + Math.random() * 18}%`,
                top: `${10 + Math.random() * 20}%`,
                width: '2px',
                height: '2px',
                backgroundColor: '#c8a064',
                '--dx': `${(Math.random() - 0.5) * 40}px`,
                '--dy': `${-20 - Math.random() * 40}px`,
                '--dust-opacity': 0.3 + Math.random() * 0.3,
                '--ds': 0.5 + Math.random(),
                animation: `dust-float ${4 + Math.random() * 6}s ease-in-out ${Math.random() * 5}s infinite`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
    </RoomAudioProvider>
  )
}
