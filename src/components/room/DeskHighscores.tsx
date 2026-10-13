'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ARCADE, ArcadeButton, ArcadeFrame, PIXEL_FONT, useFullscreen, type ArcadeLabels } from './DeskArcade'
import { useStageScale } from '@/lib/room/useStageScale'
import { getBest, readJson, writeJson } from '@/lib/games/storage'
import { HISCORE_GAMES, type HiscoreEntry, type HiscoreGameId } from '@/lib/games/highscores'
import { dailyDate, parseDailyResult, type DailyResult } from '@/lib/games/daily'

export interface HighscoresLabels {
  title: string
  games: Record<HiscoreGameId, string>
  /** Score formats per game, `{n}` is the number. */
  units: Record<HiscoreGameId, string>
  yourBest: string
  noBest: string
  board: string
  empty: string
  offline: string
  loading: string
  namePh: string
  submit: string
  submitting: string
  ranked: string
  error: string
  play: string
  refresh: string
  daily: { tab: string; board: string; yours: string; none: string; lost: string; play: string }
}

interface DeskHighscoresProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: HighscoresLabels
  arcade: ArcadeLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
  onOpenApp?: (app: string) => void
}

const NAME_KEY = 'hiscore-name'
/** Minesweeper's record of today's daily attempt (DeskMinesweeper writes it). */
const DAILY_KEY = 'minesweeper-daily'
type Boards = Record<HiscoreGameId, HiscoreEntry[]>
/** A game's all-time board, or the daily challenge's board for today. */
type Tab = HiscoreGameId | 'daily'

/**
 * Every desk game's best on this browser beside its public top 10
 * (/api/highscores). The visitor posts their own best under a name kept in
 * games storage; the server keeps each name's best only.
 */
export function DeskHighscores({ time, backLabel, desktopLabel, labels, onBack, onDesktop, onOpenApp }: DeskHighscoresProps) {
  const fs = useFullscreen()
  const { portrait } = useDeskScreen()
  const { mobile } = useStageScale()
  const touch = portrait || mobile
  const [game, setGame] = useState<Tab>('typing')
  const [bests, setBests] = useState<Record<string, number>>({})
  const [boards, setBoards] = useState<Boards | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [today] = useState(() => dailyDate())
  const [dailyBoard, setDailyBoard] = useState<HiscoreEntry[] | null | undefined>(undefined)
  const [dailyTry, setDailyTry] = useState<DailyResult | null>(null)

  const load = useCallback(() => {
    setBoards(undefined)
    setDailyBoard(undefined)
    fetch('/api/highscores').then((r) => r.json()).then((d) => setBoards(d.boards ?? null)).catch(() => setBoards(null))
    fetch(`/api/highscores/daily?game=minesweeper&date=${today}`).then((r) => r.json())
      .then((d) => setDailyBoard(d.board ?? null)).catch(() => setDailyBoard(null))
  }, [today])

  useEffect(() => {
    setBests(Object.fromEntries(HISCORE_GAMES.map((g) => [g.id, getBest(g.key)])))
    const saved = readJson(NAME_KEY)
    if (typeof saved === 'string') setName(saved)
    const daily = parseDailyResult(readJson(DAILY_KEY))
    setDailyTry(daily && daily.date === today ? daily : null)
    load()
  }, [load, today])

  const isDaily = game === 'daily'
  // The daily challenge is Minesweeper: same units, lower is better.
  const unitGame: HiscoreGameId = isDaily ? 'minesweeper' : game
  const fmt = (id: HiscoreGameId, n: number) => labels.units[id].replace('{n}', n.toLocaleString())
  const mine = isDaily ? (dailyTry?.won ? dailyTry.time : 0) : bests[game] ?? 0
  const shownBoards = isDaily ? (dailyBoard === undefined || dailyBoard === null ? dailyBoard : { daily: dailyBoard }) : boards
  const board = isDaily ? dailyBoard ?? [] : boards?.[game] ?? []
  const boardTitle = isDaily ? labels.daily.board.replace('{date}', today) : labels.board.replace('{game}', labels.games[game])

  const playDaily = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('daily', '1')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    onOpenApp?.('minesweeper')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !mine || !name.trim()) return
    setBusy(true); setMsg('')
    writeJson(NAME_KEY, name.trim())
    try {
      const r = await fetch(isDaily ? '/api/highscores/daily' : '/api/highscores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isDaily
          ? { game: 'minesweeper', date: dailyTry!.date, name: name.trim(), score: mine, website }
          : { game, name: name.trim(), score: mine, website }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) { setMsg(d.error || labels.error); return }
      setMsg(typeof d.rank === 'number' ? labels.ranked.replace('{n}', String(d.rank)) : '')
      load()
    } catch { setMsg(labels.error) } finally { setBusy(false) }
  }

  const font = (size: number): React.CSSProperties => ({ ...PIXEL_FONT, fontSize: size, color: ARCADE.ink })
  const small = portrait ? 12 : 9
  const body = portrait ? 13 : 10

  const gameList = (
    <div role="tablist" aria-label={labels.title}
      className={portrait ? 'flex gap-1.5 overflow-x-auto px-2 py-2 flex-shrink-0' : 'flex flex-col gap-0.5 p-2 overflow-y-auto flex-shrink-0'}
      style={portrait ? undefined : { width: 196, borderRight: `1px solid ${ARCADE.stripBorder}` }}>
      <button role="tab" aria-selected={isDaily} type="button" onClick={() => { setGame('daily'); setMsg('') }}
        className={`flex items-center justify-between gap-2 px-2 text-left flex-shrink-0 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a2820] ${portrait ? 'h-[38px]' : 'h-[24px]'}`}
        style={{ ...font(body), backgroundColor: isDaily ? ARCADE.panel : 'transparent', color: isDaily ? ARCADE.panelText : ARCADE.gold, border: `1px solid ${isDaily ? ARCADE.panelBorder : 'transparent'}` }}>
        <span>{'\u2605'} {labels.daily.tab}</span>
      </button>
      {HISCORE_GAMES.map((g) => {
        const on = g.id === game
        return (
          <button key={g.id} role="tab" aria-selected={on} type="button" onClick={() => { setGame(g.id); setMsg('') }}
            className={`flex items-center justify-between gap-2 px-2 text-left flex-shrink-0 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a2820] ${portrait ? 'h-[38px]' : 'h-[24px]'}`}
            style={{ ...font(body), backgroundColor: on ? ARCADE.panel : 'transparent', color: on ? ARCADE.panelText : ARCADE.ink, border: `1px solid ${on ? ARCADE.panelBorder : 'transparent'}` }}>
            <span>{labels.games[g.id]}</span>
            {!portrait && <span style={{ opacity: 0.75, fontSize: small }}>{bests[g.id] ? fmt(g.id, bests[g.id]) : '—'}</span>}
          </button>
        )
      })}
    </div>
  )

  const boardList = (
    <ol className="flex-1 min-h-0 overflow-y-auto px-3 py-1" aria-label={boardTitle} style={font(body)}>
      {shownBoards === undefined ? <li style={{ color: ARCADE.inkSoft }}>{labels.loading}</li>
        : shownBoards === null ? <li style={{ color: ARCADE.inkSoft }}>{labels.offline}</li>
        : board.length === 0 ? <li style={{ color: ARCADE.inkSoft }}>{labels.empty}</li>
        : board.map((en, i) => (
          <li key={en.name} className="flex items-center gap-2" style={{ height: portrait ? 26 : 19, borderBottom: `1px dotted ${ARCADE.stripBorder}` }}>
            <span style={{ width: portrait ? 28 : 22, color: i < 3 ? ARCADE.gold : ARCADE.inkSoft }}>{i + 1}.</span>
            <span className="flex-1 truncate">{en.name}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(unitGame, en.score)}</span>
          </li>
        ))}
    </ol>
  )

  const inputStyle: React.CSSProperties = {
    ...PIXEL_FONT, color: ARCADE.ink, backgroundColor: '#fffef5', border: `1px solid ${ARCADE.stripBorder}`,
    fontSize: touch ? 16 : 10, padding: portrait ? '6px' : '2px 4px', height: portrait ? 38 : touch ? 30 : 20, minWidth: 0,
  }

  const submitRow = (
    <form onSubmit={submit} className="flex flex-col gap-1 px-3 py-2 border-t flex-shrink-0" style={{ borderColor: ARCADE.stripBorder }}>
      <span style={font(small)}>
        {isDaily ? labels.daily.yours : labels.yourBest.replace('{game}', labels.games[game])}{' '}
        <b>{mine ? fmt(unitGame, mine) : isDaily ? (dailyTry ? labels.daily.lost : labels.daily.none) : labels.noBest}</b>
      </span>
      {mine ? (
        <div className="flex items-center gap-1.5">
          <input aria-label={labels.namePh} placeholder={labels.namePh} maxLength={16} value={name}
            onChange={(e) => setName(e.target.value)} className="flex-1" style={inputStyle} />
          <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
          <ArcadeButton type="submit" tone="dark" size={portrait ? 'xl' : 'sm'} disabled={busy || !name.trim()}>
            {busy ? labels.submitting : labels.submit}
          </ArcadeButton>
        </div>
      ) : isDaily ? (
        !dailyTry && onOpenApp ? <div><ArcadeButton size={portrait ? 'xl' : 'sm'} onClick={playDaily}>{labels.daily.play}</ArcadeButton></div> : null
      ) : onOpenApp ? (
        <div><ArcadeButton size={portrait ? 'xl' : 'sm'} onClick={() => onOpenApp(game)}>{labels.play.replace('{game}', labels.games[game])}</ArcadeButton></div>
      ) : null}
      {msg && <span aria-live="polite" style={{ ...font(small), color: msg === labels.error ? ARCADE.rust : ARCADE.ink }}>{msg}</span>}
    </form>
  )

  return (
    <ArcadeFrame fs={fs} portrait={portrait}>
      <ScreenStrip time={time} title={labels.title} fs={fs} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack}>
        <StripButton onClick={load}>{labels.refresh}</StripButton>
      </ScreenStrip>
      {portrait ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {gameList}
          {boardList}
          {submitRow}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {gameList}
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="px-3 pt-2" style={font(11)}>{boardTitle}</h3>
            {boardList}
            {submitRow}
          </div>
        </div>
      )}
    </ArcadeFrame>
  )
}
