// src/components/room/mahjong/Tutorial.tsx
'use client'

/** How to play for both Mahjong modes: the tiles and the tile guide first, then that mode's rules. */
import { useState } from 'react'
import { ARCADE } from '../DeskArcade'
import { useDeskScreen } from '../ScreenStrip'
import { GameTutorial, KeyRows, TermRows, type TutorialPage } from '../GameTutorial'
import { ALL_KINDS, BONUS_KINDS, tileCode } from '@/lib/games/mahjong-tiles'
import { MUTED } from './chrome'
import type { MahjongLabels } from './labels'
import { TileView } from './tile-art'
import { tileInfo } from './tile-info'
import { TileInfoCard } from './tile-tip'

type Mode = 'solitaire' | 'four'

/** Tiles in a row with a caption under them. */
function Group({ codes, caption, w, h, accent, dim }: { codes: string[]; caption?: string; w: number; h: number; accent?: string; dim?: boolean }) {
  const { portrait } = useDeskScreen()
  return (
    <figure className="m-0 flex flex-col items-center" style={{ gap: 3 }}>
      <div className="flex" style={{ gap: 1 }}>
        {codes.map((c, i) => (
          <TileView key={i} code={c} w={w} h={h} depth={1} accent={accent} dim={dim} />
        ))}
      </div>
      {caption && <figcaption style={{ fontSize: portrait ? 10 : 9, lineHeight: 1, color: MUTED }}>{caption}</figcaption>}
    </figure>
  )
}

function Strip({ children }: { children: React.ReactNode }) {
  const { portrait } = useDeskScreen()
  return (
    <div
      className="flex flex-wrap items-end justify-center"
      style={{ gap: portrait ? 8 : 12, rowGap: 6, marginTop: 10, padding: '6px 8px', backgroundColor: '#27402c', border: `1px solid ${ARCADE.feltLine}`, borderRadius: 3 }}
    >
      {children}
    </div>
  )
}

const GUIDE_ROWS: string[][] = [
  ALL_KINDS.slice(0, 9).map(tileCode),
  ALL_KINDS.slice(9, 18).map(tileCode),
  ALL_KINDS.slice(18, 27).map(tileCode),
  ALL_KINDS.slice(27).map(tileCode),
  BONUS_KINDS.map(tileCode),
]

/** Every kind of tile; hover or tap one to read its note. */
function TileGuide({ labels, mode }: { labels: MahjongLabels; mode: Mode }) {
  const { portrait } = useDeskScreen()
  const [code, setCode] = useState('c5')
  const info = tileInfo(code, labels.tileInfo)
  const tw = portrait ? 22 : 14
  const th = portrait ? 29 : 18
  return (
    <div className={portrait ? 'flex flex-col' : 'flex items-start'} style={{ gap: portrait ? 6 : 10, marginTop: 8 }}>
      <div className="flex flex-col flex-shrink-0" style={{ gap: 2 }} role="group" aria-label={labels.tutorial.guide.pick}>
        {GUIDE_ROWS.map((row, r) => (
          <div key={r} className="flex" style={{ gap: 2 }}>
            {row.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={tileInfo(c, labels.tileInfo)?.name}
                aria-pressed={c === code}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setCode(c) }}
                onClick={() => setCode(c)}
                className="p-0 border-0 bg-transparent outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8d5b0]"
                style={{ width: tw + 2, height: th + 2, cursor: 'pointer' }}
              >
                <TileView code={c} w={tw} h={th} depth={1} tip={false} selected={c === code} />
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0" style={{ padding: '5px 6px', border: `1px solid ${ARCADE.panelBorder}`, backgroundColor: ARCADE.panelDark, minHeight: portrait ? 84 : undefined }}>
        {info && <TileInfoCard info={info} mode={mode} labels={labels.tileInfo} compact={!portrait} />}
      </div>
    </div>
  )
}

/** A row of four with one tile on top, the free ones ringed. */
function FreeDiagram({ free, blocked }: { free: string; blocked: string }) {
  const { portrait } = useDeskScreen()
  const w = portrait ? 26 : 26
  const h = portrait ? 35 : 35
  const tiles = [
    { x: 0, z: 0, code: 'b3', free: true },
    { x: 1, z: 0, code: 'd7', free: false },
    { x: 2, z: 0, code: 'w2', free: false },
    { x: 3, z: 0, code: 'c4', free: true },
    { x: 1.5, z: 1, code: 'r2', free: true },
  ]
  return (
    <div className="flex items-center justify-center" style={{ gap: portrait ? 14 : 24, marginTop: 10 }}>
      <div className="relative" style={{ width: 4 * w + 8, height: h + 8 }}>
        {tiles.map((t, i) => (
          <TileView
            key={i}
            code={t.code}
            w={w}
            h={h}
            depth={2}
            dim={!t.free}
            accent={t.free ? ARCADE.amber : undefined}
            style={{ position: 'absolute', left: t.x * w + 4 - t.z * 3, top: 4 - t.z * 3, zIndex: t.z + 1 }}
          />
        ))}
      </div>
      <div className="flex flex-col" style={{ gap: 4, fontSize: portrait ? 11 : 10 }}>
        <span className="flex items-center" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, border: `2px solid ${ARCADE.amber}` }} />
          {free}
        </span>
        <span className="flex items-center" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, backgroundColor: 'rgba(36,26,12,0.5)', border: `1px solid ${ARCADE.panelBorder}` }} />
          {blocked}
        </span>
      </div>
    </div>
  )
}

export function MahjongTutorial({ mode, labels, onClose }: { mode: Mode; labels: MahjongLabels; onClose: () => void }) {
  const { portrait } = useDeskScreen()
  const t = labels.tutorial
  const sw = portrait ? 18 : 19
  const sh = portrait ? 24 : 26

  const shared: TutorialPage[] = [
    {
      ...t.tiles,
      extra: (
        <Strip>
          {['d5', 'b5', 'c5', 'w1', 'r1', 'f1'].map((c, i) => (
            <Group key={c} codes={[c]} caption={t.tiles.captions[i]} w={portrait ? 22 : 20} h={portrait ? 30 : 27} />
          ))}
        </Strip>
      ),
    },
    { ...t.guide, extra: <TileGuide labels={labels} mode={mode} /> },
  ]

  const s = t.solitaire
  const solitaire: TutorialPage[] = [
    {
      ...s.goal,
      extra: (
        <Strip>
          <Group codes={['c3', 'c3']} caption={s.goal.match} w={sw} h={sh} accent={ARCADE.olive} />
          <Group codes={['f1', 'f3']} caption={s.goal.match} w={sw} h={sh} accent={ARCADE.olive} />
          <Group codes={['s2', 's4']} caption={s.goal.match} w={sw} h={sh} accent={ARCADE.olive} />
          <Group codes={['b2', 'b3']} caption={s.goal.noMatch} w={sw} h={sh} accent={ARCADE.rust} />
        </Strip>
      ),
    },
    { ...s.free, extra: <FreeDiagram free={s.free.free} blocked={s.free.blocked} /> },
    {
      ...s.play,
      extra: (
        <KeyRows
          portrait={portrait}
          rows={[
            { keys: ['H'], name: labels.hint, text: s.play.hint },
            { keys: ['U'], name: labels.undo, text: s.play.undo },
            { keys: ['S'], name: labels.shuffle, text: s.play.shuffle },
            { keys: ['N'], name: labels.newGame, text: s.play.menu },
          ]}
        />
      ),
    },
    s.saved,
  ]

  const f = t.four
  const winning = [['d1', 'd2', 'd3'], ['b5', 'b5', 'b5'], ['c7', 'c8', 'c9'], ['r1', 'r1', 'r1'], ['w1', 'w1']]
  const four: TutorialPage[] = [
    {
      ...f.goal,
      extra: (
        <Strip>
          {winning.map((g, i) => (
            <Group key={i} codes={g} caption={f.goal.captions[i]} w={portrait ? 13 : 14} h={portrait ? 18 : 19} />
          ))}
        </Strip>
      ),
    },
    {
      ...f.sets,
      extra: (
        <div className="grid items-center" style={{ gridTemplateColumns: 'auto auto 1fr', columnGap: 10, rowGap: portrait ? 8 : 4, marginTop: 8 }}>
          {[['b3', 'b4', 'b5'], ['w3', 'w3', 'w3'], ['d9', 'd9', 'd9', 'd9'], ['r3', 'r3']].map((g, i) => (
            <div key={i} className="contents">
              <span className="flex" style={{ gap: 1 }}>
                {g.map((c, j) => <TileView key={j} code={c} w={portrait ? 14 : 12} h={portrait ? 19 : 16} depth={1} />)}
              </span>
              <span style={{ color: ARCADE.gold }}>{f.sets.rows[i].term}</span>
              <span>{f.sets.rows[i].text}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      ...f.turn,
      extra: (
        <KeyRows
          portrait={portrait}
          rows={[
            { keys: ['←', '→'], text: f.turn.pick },
            { keys: ['Enter'], name: labels.discard, text: f.turn.discard },
            { keys: ['W'], name: labels.tsumo, text: f.turn.win },
            { keys: ['K'], name: labels.kongAction, text: f.turn.kong },
          ]}
        />
      ),
    },
    {
      ...f.claim,
      extra: (
        <KeyRows
          top={6}
          portrait={portrait}
          rows={[
            { keys: ['P'], name: labels.pung, text: f.claim.pung },
            { keys: ['C'], name: labels.chow, text: f.claim.chow },
            { keys: ['K'], name: labels.kong, text: f.claim.kong },
            { keys: ['W'], name: labels.ron, text: f.claim.win },
            { keys: ['Space'], name: labels.pass, text: f.claim.pass },
          ]}
        />
      ),
    },
    {
      ...f.winds,
      extra: (
        <Strip>
          {[1, 2, 3, 4].map((n) => (
            <Group key={n} codes={[`w${n}`]} caption={labels.winds[n - 1]} w={sw} h={sh} />
          ))}
          <Group codes={['f1', 's1']} caption={labels.tileInfo.kinds.bonus} w={sw} h={sh} />
        </Strip>
      ),
    },
    { ...f.scoring, extra: <TermRows rows={f.scoring.rows} /> },
    { ...f.table, extra: <KeyRows portrait={portrait} rows={[{ keys: ['Enter', 'Space', 'Esc'], name: labels.autoTable.skip, text: f.table.skipKeys }]} /> },
  ]

  return (
    <GameTutorial
      pages={[...shared, ...(mode === 'solitaire' ? solitaire : four)]}
      onClose={onClose}
      bodyH={{ landscape: 164, portrait: 340 }}
      width={{ landscape: 468, portrait: 320 }}
    />
  )
}
