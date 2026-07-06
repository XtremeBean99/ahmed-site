'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { ROOM_OBJECTS } from '@/lib/room/objects'
import { useStageScale } from '@/lib/room/useStageScale'
import { loadPrefs, savePrefs } from '@/lib/room/storage'
import { RoomStage } from './RoomStage'
import { RoomHud } from './RoomHud'
import { RoomAudioProvider } from './RoomAudioProvider'
import { NowPlaying } from './NowPlaying'
import { Monitor } from './Monitor'
import { AnimatedSprite } from './AnimatedSprite'
import { DeskView } from './DeskView'
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
      bonsaiLabel: string
      lampLabel: string
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
  const [toast, setToast] = useState<string | null>(null)
  const [windowHour, setWindowHour] = useState(new Date().getHours())

  // Load lamp pref on mount
  useEffect(() => { const p = loadPrefs(); setLampOn(p.lampOn) }, [])

  // Window time-of-day — update on hour change
  useEffect(() => {
    const update = () => setWindowHour(new Date().getHours())
    const msToNextHour = (60 - new Date().getMinutes()) * 60000 - new Date().getSeconds() * 1000
    const id = setTimeout(() => { update(); setInterval(update, 3600000) }, msToNextHour)
    return () => clearTimeout(id)
  }, [])

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

  const monitorObj = ROOM_OBJECTS.find((o) => o.id === 'monitor')!
  const posterObj = ROOM_OBJECTS.find((o) => o.id === 'poster')!
  const bonsaiObj = ROOM_OBJECTS.find((o) => o.id === 'bonsai')!

  const screenCenterX = monitorObj.x + 22 + 98
  const screenCenterY = monitorObj.y + 12 + 58

  const STAGE_W = 1408
  const STAGE_H = 768
  const glowX = ((monitorObj.x + 22 + 98) / STAGE_W) * 100
  const glowY = ((monitorObj.y + 12 + 58) / STAGE_H) * 100

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
          onBack={handleDeskBack}
          speakersLabel={t.room.audio.speakersLabel}
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
            className="absolute inset-0 w-full h-full"
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
            href={monitorObj.href!}
            onEnter={handleEnter}
          />

          <AnimatedSprite
            label={t.room.posterLabel}
            x={posterObj.x}
            y={posterObj.y}
            w={posterObj.w}
            h={posterObj.h}
            frames={posterObj.frames}
            frameDuration={200}
            mode="play-once-hold"
            onClick={() => {
              setToast(t.room.posterClickHint)
              setTimeout(() => setToast(null), 2000)
            }}
          />

          <AnimatedSprite
            label={t.room.bonsaiLabel}
            x={bonsaiObj.x}
            y={bonsaiObj.y}
            w={bonsaiObj.w}
            h={bonsaiObj.h}
            frames={bonsaiObj.frames}
            frameDuration={250}
            mode="loop"
          />

          {/* Window time-of-day tint overlay */}
          {!reduce && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: 1140,
                top: 20,
                width: 240,
                height: 260,
                opacity: windowHour >= 20 || windowHour < 5 ? 0.4 : windowHour < 8 ? 0.18 : 0.05,
                background:
                  windowHour >= 20 || windowHour < 5
                    ? 'rgba(10,10,30,0.7)'
                    : windowHour < 8
                      ? 'rgba(40,35,50,0.3)'
                      : 'rgba(255,240,220,0.1)',
                transition: 'opacity 2s ease, background 2s ease',
              }}
            />
          )}

          {/* Lamp toggle hotspot */}
          <button
            onClick={() => { setLampOn((v) => { const n = !v; savePrefs({ lampOn: n }); return n }) }}
            aria-label={t.room.lampLabel}
            className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2"
            style={{ left: 60, top: 300, width: 110, height: 220 }}
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
    </div>
    </RoomAudioProvider>
  )
}
