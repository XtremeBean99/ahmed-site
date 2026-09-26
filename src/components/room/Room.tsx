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
  SPRITE_FRAME_MS,
  LIGHTING_FADE_MS,
  POSTER_ALT_FRAME,
  WINDOW_GLASS,
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
import { ShelfBooks } from './ShelfBooks'
import { RoomReader, type ReaderLabels } from './RoomReader'
import type { MovieLabels } from './DeskMovie'
import type { SnakeLabels } from './DeskSnake'
import type { BlackjackLabels } from './DeskBlackjack'
import type { SolitaireLabels } from './DeskSolitaire'
import type { PongLabels } from './DeskPong'
import type { BreakoutLabels } from './DeskBreakout'
import type { ArcadeLabels } from './DeskArcade'
import { SHELF_BOOKS } from '@/lib/room/books'
import { DeskView } from './DeskView'
import { SideTableClock } from './SideTableClock'
import { RoomObject } from './RoomObject'
import { RoomIpod } from './RoomIpod'
import { RoomWeather } from './RoomWeather'
import { RoomNightSky } from './RoomNightSky'
import { useSfx } from './RoomSfxProvider'
import { addDiscovery, DISCOVERY_IDS } from '@/lib/room/discoveries'
import { DiscoveriesBadge } from './DiscoveriesBadge'
import {
  ICON_LINKEDIN,
  ICON_GITHUB,
  ICON_PAINT,
  ICON_MINESWEEPER,
  ICON_SNAKE,
  ICON_BLACKJACK,
  ICON_SOLITAIRE,
  ICON_PONG,
  ICON_BREAKOUT,
  ICON_README,
  ICON_MUSIC,
  ICON_LEGAL,
  ICON_SETTINGS,
  ICON_MOVIE,
} from './DeskIcon'
import type { DesktopShortcut } from './DeskDesktop'
import { DURATION } from '@/lib/motion'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { useLightingClock, LightingProvider, lightingSrc, LIGHTING_STATES, type LightingState } from '@/lib/room/lighting'

type View = 'room' | 'zooming' | 'desk' | 'leaving'

interface RoomProps {
  dict: {
    room: {
      navLabel: string
      monitorLabel: string
      posterLabel: string
      saitamaLabel: string
      bonsaiLabel: string
      catanLabel: string
      booksLabel: string
      vhsLabel: string
      bookLabels: Record<string, string>
      reader: ReaderLabels
      lampLabel: string
      coffeeLabel: string
      ipodLabel: string
      sideTableClockLabel: string
      sideTableDrawerLabel: string
      windowLabel: string
      posterClickHint: string
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
      discoveryTitle: string
      discoveryFound: string
      discoveryLocked: string
      discoveryLabels: Record<string, string>
    }
    desk: {
      back: string
      clickAgain: string
      desktop: string
      screenLabel: string
      linkedin: string
      github: string
      readme: string
      readmeTip: string
      linkedinTip: string
      githubTip: string
      legal: string
      legalTip: string
      settings: string
      settingsTip: string
      paint: string
      minesweeper: string
      snake: string
      paintTip: string
      minesweeperTip: string
      snakeTip: string
      blackjack: string
      blackjackTip: string
      solitaire: string
      solitaireTip: string
      pong: string
      pongTip: string
      breakout: string
      breakoutTip: string
      arcade: ArcadeLabels
      blackjackApp: BlackjackLabels
      solitaireApp: SolitaireLabels
      pongApp: PongLabels
      breakoutApp: BreakoutLabels
      music: string
      settingsApp: { title: string; sfx: string; sfxVolume: string; musicVolume: string; clock: string; clock12: string; clock24: string; on: string; off: string; close: string }
      paintApp: { pencil: string; eraser: string; fill: string; clear: string; clearConfirm: string; download: string; color: string; canvas: string }
      mines: { board: string; cell: string; minesLeft: string; time: string; best: string; reset: string; won: string; lost: string }
      snakeApp: SnakeLabels
      musicTip: string
      musicApp: { title: string; nowPlaying: string; select: string }
      readmeApp: { title: string; close: string }
      legalApp: { title: string; privacyTab: string; termsTab: string; close: string }
      guestbook: string
      guestbookTip: string
      guestbookApp: { title: string; close: string; namePh: string; messagePh: string; sign: string; empty: string; posting: string; error: string }
      movie: string
      movieTip: string
      movieApp: MovieLabels
    }
    legal: Dictionary['legal']
  }
  readmeContent: string
}

export function Room({ dict, readmeContent }: RoomProps) {
  const t = dict
  const reduce = useReducedMotion()
  const { scale, mobile } = useStageScale()
  const [view, setView] = useState<View>('desk')
  const [lampOn, setLampOn] = useState(true)
  const [lampFlicker, setLampFlicker] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [clock24h, setClock24h] = useState(true)
  const [sideTableOpen, setSideTableOpen] = useState(false)
  const [sideTableHovered, setSideTableHovered] = useState(false)
  const [windowHovered, setWindowHovered] = useState(false)
  const [lampHovered, setLampHovered] = useState(false)
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const [sfxVolume, setSfxVolumeState] = useState(0.5)
  const [konamiOpen, setKonamiOpen] = useState(false)
  // App the desk view should open on arrival (set by the shelf VHS).
  const [pendingApp, setPendingApp] = useState<string | null>(null)
  const [discoveryToast, setDiscoveryToast] = useState<string | null>(null)
  const [hintPulses, setHintPulses] = useState(false)

  const discover = useCallback((id: string, label: string) => {
    if (addDiscovery(id)) {
      setDiscoveryToast(label)
      setTimeout(() => setDiscoveryToast(null), 2000)
      window.dispatchEvent(new Event('room:discovery'))
    }
  }, [])

  const sfx = useSfx()

  // Mobile drag-to-pan: the fill-height scale makes the stage wider than the
  // viewport, so a drag slides the view across the room. Pan lives in React
  // state (the old version wrote straight to the DOM and lost the offset on
  // the next re-render).
  const STAGE_W = 1408
  const STAGE_H = 768
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panXRef = useRef(0)
  const dragStartRef = useRef<{ x: number; y: number; px: number } | null>(null)
  const panRafRef = useRef(0)

  const clampPanX = useCallback((px: number) => {
    const stageWidth = STAGE_W * (window.innerHeight / STAGE_H)
    const maxX = Math.max(0, (stageWidth - window.innerWidth) / 2)
    return Math.max(-maxX, Math.min(maxX, px))
  }, [])

  useEffect(() => {
    if (!mobile) return
    const onDown = (e: PointerEvent) => {
      if (view !== 'room') return
      const el = e.target as HTMLElement
      if (el.closest('a,button,[tabindex],[role="button"],input,textarea,select')) return
      if (el.closest('#room-stage-outer') === null) return
      dragStartRef.current = { x: e.clientX, y: e.clientY, px: panXRef.current }
    }
    const onMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return
      const next = clampPanX(dragStartRef.current.px + (e.clientX - dragStartRef.current.x))
      panXRef.current = next
      cancelAnimationFrame(panRafRef.current)
      panRafRef.current = requestAnimationFrame(() => setPan({ x: next, y: 0 }))
    }
    const onUp = () => { dragStartRef.current = null }
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cancelAnimationFrame(panRafRef.current)
    }
  }, [mobile, view, clampPanX])

  // Keep the panned offset valid across rotations and window resizes.
  useEffect(() => {
    if (!mobile) return
    const onResize = () => setPan({ x: clampPanX(panXRef.current), y: 0 })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mobile, clampPanX])

  // Preload desk close-up art on idle so entering the desk is instant
  useEffect(() => {
    const preload = () => {
      for (const src of MONITOR_LOADING_FRAMES) {
        const img = new window.Image()
        img.src = src
      }
      const deskArts = ['/room/desk-closeup.png', '/room/desk-closeup-lamp-off.png']
      for (const src of deskArts) {
        const img = new window.Image()
        img.src = src
      }
    }
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(preload)
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(preload, 1000)
    return () => clearTimeout(id)
  }, [])


  // Lighting: target normally follows the visitor's local clock, but clicking
  // the window overrides it for the rest of the visit (manualLight). `light`
  // is what is rendered; `prevLight` keeps the outgoing background pair
  // mounted during the 1.5s crossfade. The swap waits for the target
  // backgrounds to load.
  const clockLight = useLightingClock()
  const [manualLight, setManualLight] = useState<LightingState | null>(null)
  const targetLight = manualLight ?? clockLight
  const [light, setLight] = useState<LightingState>('dusk')
  const [prevLight, setPrevLight] = useState<LightingState | null>(null)
  useEffect(() => {
    if (targetLight === light) return
    if (reduce) { setLight(targetLight); return }
    let cancelled = false
    const srcs = [
      lightingSrc('/room/background.png', targetLight),
      lightingSrc('/room/background-lamp-off.png', targetLight),
    ]
    Promise.all(srcs.map((s) => new Promise<void>((res) => {
      const img = new window.Image()
      img.onload = () => res(); img.onerror = () => res(); img.src = s
    }))).then(() => {
      if (cancelled) return
      setLight(targetLight)
      setTimeout(() => setPrevLight(null), LIGHTING_FADE_MS)
    })
    return () => { cancelled = true }
  }, [targetLight, light, reduce])

  const cycleLight = useCallback(() => {
    setManualLight(LIGHTING_STATES[(LIGHTING_STATES.indexOf(light) + 1) % LIGHTING_STATES.length])
  }, [light])

  useEffect(() => { const p = loadPrefs(); setLampOn(p.lampOn); setClock24h(p.clock24h); setSideTableOpen(p.sideTableOpen); setSfxEnabled(p.sfx); setSfxVolumeState(p.sfxVolume); setHintPulses(p.visitCount <= 1); savePrefs({ visitCount: p.visitCount + 1 }) }, [])

  // Timeout refs
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigatingRef = useRef(false)
  const keyBufRef = useRef<string[]>([])

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

  // Shared helper: enter desk view, clearing both timers + pan state
  const enterDesk = useCallback(() => {
    clearTimeouts()
    panXRef.current = 0
    setPan({ x: 0, y: 0 })
    setView('desk')
    window.history.pushState({ view: 'desk' }, '', '#desk')
    navigatingRef.current = false
  }, [clearTimeouts])

  useEffect(() => {
    return () => clearTimeouts()
  }, [clearTimeouts])
  const handleEnter = useCallback(() => {
    sfx.play('pcStart')
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
  }, [reduce, enterDesk, sfx])

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
  // Konami code (ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a)
  // opens the terminal easter egg.
  useEffect(() => {
    const KONAMI = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
      "b", "a",
    ]
    const onKey = (e: KeyboardEvent) => {
      const buf = keyBufRef.current
      buf.push(e.key)
      if (buf.length > 10) buf.shift()
      if (buf.length === 10 && KONAMI.every((k, i) => k === buf[i])) {
        setKonamiOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Desk app discovery: listen for DeskView shortcut opens
  useEffect(() => {
    const handler = (e: Event) => {
      const appId = (e as CustomEvent<string>).detail
      if (appId && (DISCOVERY_IDS as readonly string[]).includes(appId)) {
        discover(appId, t.room.discoveryLabels[appId] ?? appId)
      }
    }
    window.addEventListener('room:app-open', handler)
    return () => window.removeEventListener('room:app-open', handler)
  }, [discover, t.room.discoveryLabels])

  // Night sky is a discovery once the visitor is in the room after dark.
  useEffect(() => {
    if (light === 'night') discover('night', t.room.discoveryLabels.night)
  }, [light, discover, t.room.discoveryLabels])

  // '?' key re-triggers first-visit hint pulses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      setHintPulses(true)
      setTimeout(() => setHintPulses(false), 5000)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Cancel hint pulses on first user interaction
  useEffect(() => {
    if (!hintPulses) return
    const cancel = () => setHintPulses(false)
    window.addEventListener('pointerdown', cancel, { once: true })
    window.addEventListener('keydown', cancel, { once: true })
    return () => {
      window.removeEventListener('pointerdown', cancel)
      window.removeEventListener('keydown', cancel)
    }
  }, [hintPulses])


  const toggleLamp = useCallback(() => {
    discover('lamp', t.room.discoveryLabels.lamp)
    sfx.play('lamp')
    setLampOn((v) => {
      const n = !v
      savePrefs({ lampOn: n })
      setLampFlicker(true)
      setTimeout(() => setLampFlicker(false), 500)
      return n
    })
  }, [sfx, discover, t.room.discoveryLabels])
  const toggleClockFormat = useCallback(() => {
    discover('clock', t.room.discoveryLabels.clock)
    sfx.play('clock')
    setClock24h((v) => {
      const n = !v
      savePrefs({ clock24h: n })
      return n
    })
  }, [sfx, discover, t.room.discoveryLabels])

  const toggleSideTable = useCallback(() => {
    discover('drawer', t.room.discoveryLabels.drawer)
    sfx.play('drawer')
    setSideTableOpen((v) => {
      const n = !v
      savePrefs({ sideTableOpen: n })
      return n
    })
  }, [sfx, discover, t.room.discoveryLabels])

  // Settings app callbacks
  const handleSfxToggle = useCallback((v: boolean) => {
    setSfxEnabled(v)
    sfx.setEnabled(v)
  }, [sfx])
  const handleSfxVolume = useCallback((v: number) => {
    setSfxVolumeState(v)
    sfx.setVolume(v)
  }, [sfx])
  const handleMusicVolume = useCallback((v: number) => {
    savePrefs({ volume: v })
    const audio = document.querySelector('audio')
    if (audio) audio.volume = v
  }, [])
  const handleClockToggle = useCallback(() => {
    toggleClockFormat()
  }, [toggleClockFormat])


  // Poster swap: a click flips the kitagawa art to the alternate poster and a
  // second click flips it back. Hover animation is unaffected.
  const [posterAlt, setPosterAlt] = useState(false)

  // Shelf books: the id of the book open in the reader, or null.
  const [readerBook, setReaderBook] = useState<string | null>(null)

  const openBook = useCallback((id: string) => {
    sfx.play('poster')
    setReaderBook(id)
    discover('books', t.room.discoveryLabels.books)
  }, [sfx, discover, t.room.discoveryLabels.books])

  // Shelf VHS: zoom to the desk and land straight in the player.
  const playTape = useCallback(() => {
    discover('movie', t.room.discoveryLabels.movie)
    setPendingApp('movie')
    handleEnter()
  }, [discover, handleEnter, t.room.discoveryLabels.movie])

  const monitorObj = ROOM_OBJECTS.find((o) => o.id === 'monitor')!
  const posterObj = ROOM_OBJECTS.find((o) => o.id === 'poster')!
  const saitamaObj = ROOM_OBJECTS.find((o) => o.id === 'saitama')!
  const bonsaiObj = ROOM_OBJECTS.find((o) => o.id === 'bonsai')!
  const catanObj = ROOM_OBJECTS.find((o) => o.id === 'catan')!
  const booksObj = ROOM_OBJECTS.find((o) => o.id === 'books')!
  const vhsObj = ROOM_OBJECTS.find((o) => o.id === 'vhs')!
  const coffeeObj = ROOM_OBJECTS.find((o) => o.id === 'coffee')!
  const clockObj = ROOM_OBJECTS.find((o) => o.id === 'clock')!
  const ipodObj = ROOM_OBJECTS.find((o) => o.id === 'ipod')!

  // Stage point the zoom converges on: the centre of the monitor glass,
  // (360, 331) in stage coords. Offsets are relative to the monitor rect
  // (235, 257), re-derive if the sprite crop ever changes.
  const screenCenterX = monitorObj.x + 125
  const screenCenterY = monitorObj.y + 74

  const glowX = (screenCenterX / STAGE_W) * 100
  const glowY = (screenCenterY / STAGE_H) * 100
  // A 5x3 grid: about the site, then tools and media, then a full row of games.
  const deskShortcuts: DesktopShortcut[] = [
    { id: 'readme', kind: 'app', target: 'readme', label: t.desk.readme, tooltip: t.desk.readmeTip, icon: ICON_README },
    { id: 'linkedin', kind: 'external', target: 'https://www.linkedin.com/in/ahmed-hussain-0880ba25a/', label: t.desk.linkedin, tooltip: t.desk.linkedinTip, icon: ICON_LINKEDIN, iconSize: 24 },
    { id: 'github', kind: 'external', target: 'https://github.com/XtremeBean99', label: t.desk.github, tooltip: t.desk.githubTip, icon: ICON_GITHUB, iconSize: 48 },
    { id: 'guestbook', kind: 'app', target: 'guestbook', label: t.desk.guestbook, tooltip: t.desk.guestbookTip, icon: ICON_README },
    { id: 'legal', kind: 'app', target: 'legal', label: t.desk.legal, tooltip: t.desk.legalTip, icon: ICON_LEGAL },
    { id: 'settings', kind: 'app', target: 'settings', label: t.desk.settings, tooltip: t.desk.settingsTip, icon: ICON_SETTINGS },
    { id: 'music', kind: 'app', target: 'music', label: t.desk.music, tooltip: t.desk.musicTip, icon: ICON_MUSIC, iconSize: 48 },
    { id: 'movie', kind: 'app', target: 'movie', label: t.desk.movie, tooltip: t.desk.movieTip, icon: ICON_MOVIE },
    { id: 'paint', kind: 'app', target: 'paint', label: t.desk.paint, tooltip: t.desk.paintTip, icon: ICON_PAINT },
    { id: 'minesweeper', kind: 'app', target: 'minesweeper', label: t.desk.minesweeper, tooltip: t.desk.minesweeperTip, icon: ICON_MINESWEEPER, iconSize: 38 },
    { id: 'snake', kind: 'app', target: 'snake', label: t.desk.snake, tooltip: t.desk.snakeTip, icon: ICON_SNAKE },
    { id: 'blackjack', kind: 'app', target: 'blackjack', label: t.desk.blackjack, tooltip: t.desk.blackjackTip, icon: ICON_BLACKJACK },
    { id: 'solitaire', kind: 'app', target: 'solitaire', label: t.desk.solitaire, tooltip: t.desk.solitaireTip, icon: ICON_SOLITAIRE },
    { id: 'pong', kind: 'app', target: 'pong', label: t.desk.pong, tooltip: t.desk.pongTip, icon: ICON_PONG },
    { id: 'breakout', kind: 'app', target: 'breakout', label: t.desk.breakout, tooltip: t.desk.breakoutTip, icon: ICON_BREAKOUT },
  ]

  // Desk view
  if (view === 'desk') {
    return (
      <RoomAudioProvider>
        <DeskView
          shortcuts={deskShortcuts}
          backLabel={t.desk.back}
          clickAgainLabel={t.desk.clickAgain}
          screenLabel={t.desk.screenLabel}
          desktopLabel={t.desk.desktop}
          speakersLabel={t.room.audio.speakersLabel}
          lampOn={lampOn}
          lampFlicker={lampFlicker}
          lampLabel={t.room.lampLabel}
          paintLabels={t.desk.paintApp}
          minesLabels={t.desk.mines}
          snakeLabels={t.desk.snakeApp}
          blackjackLabels={t.desk.blackjackApp}
          solitaireLabels={t.desk.solitaireApp}
          pongLabels={t.desk.pongApp}
          breakoutLabels={t.desk.breakoutApp}
          arcadeLabels={t.desk.arcade}
          musicLabels={t.desk.musicApp}
          legalLabels={t.desk.legalApp}
          legalPrivacy={t.legal.privacy}
          legalTerms={t.legal.terms}
          legalEffectiveDate={t.legal.effectiveDate}
          readmeLabels={t.desk.readmeApp}
          readmeContent={readmeContent}
          onToggleLamp={toggleLamp}
          onBack={handleDeskBack}
          settingsLabels={t.desk.settingsApp}
          sfxOn={sfxEnabled}
          onSfx={handleSfxToggle}
          sfxVolume={sfxVolume}
          onSfxVolume={handleSfxVolume}
          musicVolume={0.3}
          onMusicVolume={handleMusicVolume}
          is24h={clock24h}
          onClock={handleClockToggle}
          terminalLabels={{ title: "Terminal" }}
          guestbookLabels={t.desk.guestbookApp}
          movieLabels={t.desk.movieApp}
          initialApp={pendingApp}
          onInitialAppHandled={() => setPendingApp(null)}
          konamiOpen={konamiOpen}
          onKonamiHandled={() => setKonamiOpen(false)}
        />
        <NowPlaying labels={t.room.audio} />
      </RoomAudioProvider>
    )
  }

  return (
    <RoomAudioProvider>
    <div className="relative w-full h-dvh overflow-hidden bg-[#1a1210] room-cursor">
      <RoomHud
        hintLabel={t.room.hint}
        skipLabel={t.room.skip}
      />

      <NowPlaying labels={t.room.audio} />

      <nav aria-label={t.room.navLabel}>
        <LightingProvider state={light}>
        <RoomStage
          scale={scale}
          zoomScale={view === 'zooming' && !reduce ? 3.2 : 1}
          zoomOriginX={screenCenterX}
          zoomOriginY={screenCenterY}
          panX={pan.x}
          panY={pan.y}
          touchNone={mobile}
        >
          {/* Lamp-off background (always present, behind lamp-on) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightingSrc('/room/background-lamp-off.png', light)}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Lamp-on background (LCP, fades out when lamp off) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightingSrc('/room/background.png', light)}
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

          {/* Outgoing lighting state, fading out over the new one */}
          {prevLight && (
            <div className="absolute inset-0 lighting-fade pointer-events-none" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightingSrc('/room/background-lamp-off.png', prevLight)} alt="" draggable={false}
                className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightingSrc('/room/background.png', prevLight)} alt="" draggable={false}
                className="absolute inset-0 w-full h-full"
                style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0 }} />
            </div>
          )}

          {/* Window atmosphere: night sky (moon+stars) + weather, clipped to the
              glass and rendered behind the bonsai on the sill. */}
          <RoomNightSky light={light} />
          <RoomWeather />

          {/* Window is clickable: cycles dawn -> day -> dusk -> night, overriding
              the visitor-local clock for the rest of the visit. */}
          <RoomObject
            label={t.room.windowLabel}
            showTooltip={windowHovered}
            onActivate={() => setWindowHovered(true)}
            onDeactivate={() => setWindowHovered(false)}
            onClick={cycleLight}
            style={{ position: 'absolute', left: WINDOW_GLASS.x, top: WINDOW_GLASS.y, width: WINDOW_GLASS.w, height: WINDOW_GLASS.h }}
          >
            <div style={{ width: WINDOW_GLASS.w, height: WINDOW_GLASS.h }} />
          </RoomObject>

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

          {/* Desktop speakers, rendered AFTER Monitor so the cabinet buttons
              win clicks over the monitor's big anchor rect. Coffee mug (later
              still) wins its own overlap with the left cabinet. */}
          <RoomSpeakers
            lampOn={lampOn}
            lampFlicker={lampFlicker}
            speakersLabel={t.room.audio.speakersLabel}
          />

          {/* Side table, clickable: toggles the drawer open or closed. Dims with the lamp. */}
          <div
            style={{ position: 'absolute', left: SIDE_TABLE_RECT.x, top: SIDE_TABLE_RECT.y, width: SIDE_TABLE_RECT.w, height: SIDE_TABLE_RECT.h }}
            onMouseEnter={() => setSideTableHovered(true)}
            onMouseLeave={() => setSideTableHovered(false)}
            onFocus={() => setSideTableHovered(true)}
            onBlur={() => setSideTableHovered(false)}
          >
            <RoomObject
              label={t.room.sideTableDrawerLabel}
              showTooltip={sideTableHovered}
              onActivate={() => setSideTableHovered(true)}
              onDeactivate={() => setSideTableHovered(false)}
              onClick={toggleSideTable}
              tabIndex={0}
            >
              <motion.img
                src={lightingSrc('/room/side-table-1.png', light)}
                alt=""
                draggable={false}
                className="absolute inset-0"
                style={{
                  width: SIDE_TABLE_RECT.w,
                  height: SIDE_TABLE_RECT.h,
                  imageRendering: 'pixelated',
                  filter: lampOn ? 'none' : 'brightness(0.72)',
                  transition: reduce ? 'none' : 'filter 0.4s ease',
                  opacity: sideTableOpen ? 0 : 1,
                }}
              />
              <motion.img
                src={lightingSrc('/room/side-table-2.png', light)}
                alt=""
                draggable={false}
                className="absolute inset-0"
                style={{
                  width: SIDE_TABLE_RECT.w,
                  height: SIDE_TABLE_RECT.h,
                  imageRendering: 'pixelated',
                  filter: lampOn ? 'none' : 'brightness(0.72)',
                  transition: reduce ? 'none' : 'filter 0.4s ease',
                  opacity: sideTableOpen ? 1 : 0,
                }}
                transition={{ duration: DURATION.fast }}
              />
            </RoomObject>
          </div>

          {/* Digital clock on the side table, click toggles 12 or 24 h. No hover lift. */}
          <SideTableClock
            label={t.room.sideTableClockLabel}
            x={clockObj.x}
            y={clockObj.y}
            w={clockObj.w}
            h={clockObj.h}
            frame={lightingSrc(clockObj.frames[0], light)}
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
            frameDuration={SPRITE_FRAME_MS.poster}
            mode="play-once-hold"
            altFrame={POSTER_ALT_FRAME}
            altActive={posterAlt}
            onClick={() => {
              setPosterAlt((v) => !v)
              sfx.play('poster')
              discover('poster', t.room.discoveryLabels.poster)
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
            frameDuration={SPRITE_FRAME_MS.saitama}
            mode="play-all-loop-last-two"
            onClick={() => { sfx.play('poster'); discover('saitama', t.room.discoveryLabels.saitama) }}
          />

          <AnimatedSprite
            label={t.room.bonsaiLabel}
            x={bonsaiObj.x}
            y={bonsaiObj.y}
            w={bonsaiObj.w}
            h={bonsaiObj.h}
            frames={bonsaiObj.frames}
            frameDuration={SPRITE_FRAME_MS.bonsai}
            mode="loop"
            tooltipAlign="right"
            onClick={() => { discover('bonsai', t.room.discoveryLabels.bonsai) }}
          />

          <AnimatedSprite
            label={t.room.catanLabel}
            x={catanObj.x}
            y={catanObj.y}
            w={catanObj.w}
            h={catanObj.h}
            frames={catanObj.frames}
            frameDuration={SPRITE_FRAME_MS.catan}
            mode="play-once-hold"
            onClick={() => { discover('catan', t.room.discoveryLabels.catan); window.open('/catan', '_blank', 'noopener,noreferrer') }}
          />

          {/* Shelf books: one sprite, a hotspot per spine, each opens the reader */}
          <ShelfBooks
            x={booksObj.x}
            y={booksObj.y}
            w={booksObj.w}
            h={booksObj.h}
            frames={booksObj.frames}
            frameDuration={SPRITE_FRAME_MS.books}
            books={SHELF_BOOKS}
            labels={t.room.bookLabels}
            onOpen={openBook}
          />

          {/* Shelf VHS: plays the film on the desk monitor */}
          <AnimatedSprite
            label={t.room.vhsLabel}
            x={vhsObj.x}
            y={vhsObj.y}
            w={vhsObj.w}
            h={vhsObj.h}
            frames={vhsObj.frames}
            frameDuration={SPRITE_FRAME_MS.vhs}
            mode="play-once-hold"
            onClick={playTape}
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
                  src={lightingSrc('/room/coffee-steam.png', light)}
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
            frameDuration={SPRITE_FRAME_MS.coffee}
            mode="play-once-hold"
            onClick={() => { discover('coffee', t.room.discoveryLabels.coffee) }}
          />
          {/* iPod on the desk, click skips to a fresh track (starts music if stopped) */}
          <RoomIpod label={t.room.ipodLabel} obj={ipodObj} onActivate={() => discover('ipod', t.room.discoveryLabels.ipod)} />

          {/* First-visit hint pulses: inside the stage so the outlines track the
              stage scale, zoom and letterboxing with the objects they mark. */}
          {hintPulses && view === 'room' && (
            <div aria-hidden className="absolute inset-0 z-10 pointer-events-none">
              {ROOM_OBJECTS.filter(o => o.id !== 'clock').map((obj, i) => (
                <div
                  key={obj.id}
                  className="absolute animate-[hint-pulse_2s_ease-in-out_infinite]"
                  style={{
                    left: obj.x,
                    top: obj.y,
                    width: obj.w,
                    height: obj.h,
                    outline: '2px solid rgba(200,184,154,0.5)',
                    outlineOffset: '4px',
                    borderRadius: '2px',
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>
          )}

        </RoomStage>

        </LightingProvider>
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
      {/* Discoveries badge */}
      {view === 'room' && (
        <DiscoveriesBadge
          title={t.room.discoveryTitle}
          discoveryLabels={t.room.discoveryLabels}
        />
      )}

      {/* Discovery toast */}
      <AnimatePresence>
        {discoveryToast && (
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
            {'\u2726'} {discoveryToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* E-reader, opened from a book on the shelf */}
      <AnimatePresence>
        {readerBook && (
          <RoomReader
            key={readerBook}
            book={SHELF_BOOKS.find((b) => b.id === readerBook)!}
            labels={t.room.reader}
            onClose={() => setReaderBook(null)}
          />
        )}
      </AnimatePresence>

      {/* Screen-reader announcements */}
      <div aria-live="polite" className="sr-only">
        {discoveryToast ? `Discovered: ${discoveryToast}` : ''}
      </div>


    </div>
    </RoomAudioProvider>
  )
}
