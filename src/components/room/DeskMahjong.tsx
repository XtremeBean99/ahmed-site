// src/components/room/DeskMahjong.tsx
'use client'

import { useCallback, useState } from 'react'
import { ArcadeButton, ArcadeFrame, ArcadePanel, ArcadeStrip, ARCADE, PIXEL_FONT, useFullscreen, type DeskGameProps } from './DeskArcade'
import { useDeskScreen } from './ScreenStrip'
import { LAYOUT_IDS, LAYOUTS, newGame, tilesLeft, type LayoutId, type SolitaireState } from '@/lib/games/mahjong-solitaire'
import { newMatch, type GameState } from '@/lib/games/mahjong-engine'
import type { BotLevel } from '@/lib/games/mahjong-bot'
import type { MahjongChrome } from './mahjong/chrome'
import { MUTED, TABLE_BG } from './mahjong/chrome'
import type { MahjongLabels } from './mahjong/labels'
import { MahjongSolitaire } from './mahjong/Solitaire'
import { MahjongFourPlayer } from './mahjong/FourPlayer'
import { fmtTime, loadPrefs, loadSave, loadStats, savePrefs, type Prefs, type SavedGame, type Tab } from './mahjong/mahjong-store'

export type { MahjongLabels } from './mahjong/labels'

type Run =
  | { id: number; mode: 'solitaire'; game: SolitaireState; elapsed: number }
  | { id: number; mode: 'four'; game: GameState; level: BotLevel }

const randomSeed = () => Math.floor(Math.random() * 2147483647)

export function DeskMahjong({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<MahjongLabels>) {
  const fs = useFullscreen()
  const { portrait } = useDeskScreen()
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [saved, setSaved] = useState<SavedGame | null>(loadSave)
  const [stats, setStats] = useState(loadStats)
  const [run, setRun] = useState<Run | null>(null)
  const [runId, setRunId] = useState(0)

  const setPref = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const n = { ...p, ...patch }
      savePrefs(n)
      return n
    })
  }, [])

  const startSolitaire = () => {
    setPref({ tab: 'solitaire' })
    setRun({ id: runId + 1, mode: 'solitaire', game: newGame(prefs.layout, randomSeed()), elapsed: 0 })
    setRunId((n) => n + 1)
  }
  const startFour = () => {
    setPref({ tab: 'four' })
    setRun({ id: runId + 1, mode: 'four', game: newMatch({ seed: randomSeed() * 2, minFaan: prefs.minFaan, rounds: prefs.rounds }), level: prefs.level })
    setRunId((n) => n + 1)
  }
  const resume = () => {
    if (!saved) return
    setRunId((n) => n + 1)
    if (saved.mode === 'solitaire') setRun({ id: runId + 1, mode: 'solitaire', game: saved.game, elapsed: saved.elapsed })
    else setRun({ id: runId + 1, mode: 'four', game: saved.game, level: saved.level })
  }
  const toMenu = useCallback(() => {
    setSaved(loadSave())
    setStats(loadStats())
    setRun(null)
  }, [])

  const chrome: MahjongChrome = { time, backLabel, desktopLabel, arcade, fs, onBack, onDesktop }

  return (
    <ArcadeFrame fs={fs} background={TABLE_BG} portrait>
      {run === null ? (
        <MenuView
          chrome={chrome}
          labels={labels}
          portrait={portrait}
          prefs={prefs}
          setPref={setPref}
          saved={saved}
          stats={stats}
          onSolitaire={startSolitaire}
          onFour={startFour}
          onResume={resume}
        />
      ) : run.mode === 'solitaire' ? (
        <MahjongSolitaire key={run.id} chrome={chrome} labels={labels} prefs={prefs} initial={{ game: run.game, elapsed: run.elapsed }} onMenu={toMenu} />
      ) : (
        <MahjongFourPlayer key={run.id} chrome={chrome} labels={labels} prefs={prefs} initial={{ game: run.game, level: run.level }} onMenu={toMenu} />
      )}
    </ArcadeFrame>
  )
}

/* ---------- Mode picker ---------- */

function MenuView({
  chrome,
  labels,
  portrait,
  prefs,
  setPref,
  saved,
  stats,
  onSolitaire,
  onFour,
  onResume,
}: {
  chrome: MahjongChrome
  labels: MahjongLabels
  portrait: boolean
  prefs: Prefs
  setPref: (p: Partial<Prefs>) => void
  saved: SavedGame | null
  stats: ReturnType<typeof loadStats>
  onSolitaire: () => void
  onFour: () => void
  onResume: () => void
}) {
  const size = portrait ? 'xl' : 'md'
  const font = portrait ? 12 : 10

  const row = (label: string, children: React.ReactNode, stack = false) => (
    <div className={portrait || stack ? 'flex flex-col' : 'flex items-center'} style={{ gap: portrait ? 3 : 6 }}>
      <span className="flex-shrink-0" style={{ width: portrait || stack ? undefined : 62, fontSize: font, color: MUTED, lineHeight: 1.1, ...PIXEL_FONT }}>{label}</span>
      <div className="flex flex-wrap" style={{ gap: 4 }}>{children}</div>
    </div>
  )
  const opt = (text: string, pressed: boolean, onClick: () => void, key?: string) => (
    <ArcadeButton key={key ?? text} size={size} pressed={pressed} onClick={onClick}>{text}</ArcadeButton>
  )

  const rec = stats.solitaire[prefs.layout]
  const solPanel = (
    <>
      {row(labels.layout, LAYOUT_IDS.map((id: LayoutId) => opt(labels.layouts[id], prefs.layout === id, () => setPref({ layout: id }), id)), true)}
      <div style={{ fontSize: font, color: MUTED, lineHeight: 1.3, ...PIXEL_FONT }}>
        {labels.tilesCount.replace('{n}', String(LAYOUTS[prefs.layout].positions.length))} · {rec.best > 0 ? labels.best.replace('{layout}', labels.layouts[prefs.layout]).replace('{time}', fmtTime(rec.best)) : labels.noBest}
      </div>
      {row(labels.dimBlocked, [opt(labels.on, prefs.dim, () => setPref({ dim: true })), opt(labels.off, !prefs.dim, () => setPref({ dim: false }))])}
    </>
  )
  const fourPanel = (
    <>
      {row(labels.bots, (['easy', 'normal', 'hard'] as BotLevel[]).map((l) => opt(labels.levels[l], prefs.level === l, () => setPref({ level: l }), l)))}
      {row(labels.minFaan, ([0, 1, 3] as const).map((n, i) => opt(labels.minFaanValues[i], prefs.minFaan === n, () => setPref({ minFaan: n }), String(n))))}
      {row(labels.rounds, [opt(labels.roundEast, prefs.rounds === 'east', () => setPref({ rounds: 'east' })), opt(labels.roundFull, prefs.rounds === 'full', () => setPref({ rounds: 'full' }))])}
      {row(labels.speed, [opt(labels.speedNormal, prefs.speed === 'normal', () => setPref({ speed: 'normal' })), opt(labels.speedFast, prefs.speed === 'fast', () => setPref({ speed: 'fast' }))])}
      {row(labels.autoPass, [opt(labels.on, prefs.autoPassChow, () => setPref({ autoPassChow: true })), opt(labels.off, !prefs.autoPassChow, () => setPref({ autoPassChow: false }))])}
      <div style={{ fontSize: font, color: MUTED, lineHeight: 1.3, ...PIXEL_FONT }}>
        {labels.record.replace('{m}', String(stats.four.matchWins)).replace('{mp}', String(stats.four.matches)).replace('{h}', String(stats.four.handWins)).replace('{hp}', String(stats.four.hands))}
      </div>
    </>
  )

  const resumeText = saved
    ? saved.mode === 'solitaire'
      ? labels.resumeSolitaire.replace('{layout}', labels.layouts[saved.game.layoutId]).replace('{n}', String(tilesLeft(saved.game)))
      : labels.resumeFour.replace('{wind}', labels.winds[saved.game.prevailing - 1]).replace('{n}', String(saved.game.handNo))
    : ''
  const resumeBtn = saved && (
    <ArcadeButton size={size} onClick={onResume} ariaLabel={`${labels.resume}: ${resumeText}`}>
      {labels.resume}: {resumeText}
    </ArcadeButton>
  )

  const panelStyle = { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' } as const

  return (
    <>
      <ArcadeStrip time={chrome.time} title={labels.title} fs={chrome.fs} arcade={chrome.arcade} desktopLabel={chrome.desktopLabel} backLabel={chrome.backLabel} onDesktop={chrome.onDesktop} onBack={chrome.onBack} />
      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: ARCADE.panelDark }}>
        {portrait ? (
          <div className="absolute inset-0 flex flex-col" style={{ padding: 6, gap: 6 }}>
            {resumeBtn && <div className="flex-shrink-0 flex justify-center">{resumeBtn}</div>}
            <div className="flex flex-shrink-0" style={{ gap: 6 }}>
              {(['solitaire', 'four'] as Tab[]).map((t) => (
                <ArcadeButton key={t} size="xl" pressed={prefs.tab === t} className="flex-1" onClick={() => setPref({ tab: t })}>
                  {t === 'solitaire' ? labels.modeSolitaire : labels.modeFour}
                </ArcadeButton>
              ))}
            </div>
            <ArcadePanel className="flex-1 min-h-0 overflow-y-auto px-3 py-2" style={panelStyle}>
              {prefs.tab === 'solitaire' ? solPanel : fourPanel}
            </ArcadePanel>
            <div className="flex-shrink-0 flex justify-center">
              <ArcadeButton size="xl" onClick={prefs.tab === 'solitaire' ? onSolitaire : onFour}>{labels.start}</ArcadeButton>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col" style={{ padding: 8, gap: 6 }}>
            <div className="flex-shrink-0 flex justify-center" style={{ minHeight: 22 }}>{resumeBtn}</div>
            <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '1fr 1.15fr', gap: 8 }}>
              <ArcadePanel className="px-3 py-2 flex flex-col min-h-0" style={{ ...panelStyle, justifyContent: 'space-between' }}>
                <div style={panelStyle}>
                  <div style={{ fontSize: 12, color: ARCADE.amber }}>{labels.modeSolitaire}</div>
                  {solPanel}
                </div>
                <ArcadeButton size="md" onClick={onSolitaire}>{labels.start}</ArcadeButton>
              </ArcadePanel>
              <ArcadePanel className="px-3 py-2 flex flex-col min-h-0" style={{ ...panelStyle, justifyContent: 'space-between' }}>
                <div style={panelStyle}>
                  <div style={{ fontSize: 12, color: ARCADE.amber }}>{labels.modeFour}</div>
                  {fourPanel}
                </div>
                <ArcadeButton size="md" onClick={onFour}>{labels.start}</ArcadeButton>
              </ArcadePanel>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
