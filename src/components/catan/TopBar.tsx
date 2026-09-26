'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import type { Player } from '@/lib/games/catan/types'
import { BoardKeyPanel } from './BoardKeyPanel'
import { Dice } from './Dice'
import { fill } from './event-text'
import { useModalBehavior } from './layout/use-modal-behavior'
import { PLAYER_HEX, PLAYER_TEXT } from './player-colors'
import { type CatanPrefs } from './prefs'
import { SettingsMenu } from './SettingsMenu'
import { Tooltip } from './Tooltip'
import { COLORS, FOCUS_CLASS, PIXEL_FONT, PixelButton } from './ui'

/**
 * Screen readers hear the status only when it asks you to act; the event announcer already
 * narrates the bots' turns, and announcing every bot phase change as well doubled the chatter.
 */
function StatusPrompt({ statusText, mustAct }: { statusText: string; mustAct: boolean }) {
  return (
    <span role="status" className="sr-only">
      {mustAct ? statusText : ''}
    </span>
  )
}

function StatusBanner({ statusText, statusPlayer, mustAct }: { statusText: string; statusPlayer: Player | null; mustAct: boolean }) {
  return (
    <div
      data-tutorial="status"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        backgroundColor: COLORS.bg,
        border: `2px solid ${mustAct ? COLORS.accent : COLORS.panelBorder}`,
        boxShadow: mustAct ? `0 0 0 1px ${COLORS.accent}` : undefined,
      }}
    >
      {statusPlayer ? (
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            backgroundColor: PLAYER_HEX[statusPlayer.color],
            border: `2px solid ${COLORS.panelDark}`,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      ) : null}
      {statusPlayer ? (
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: PLAYER_TEXT[statusPlayer.color], flexShrink: 0 }}>
          {statusPlayer.name}
        </span>
      ) : null}
      <span
        style={{
          ...PIXEL_FONT,
          fontSize: 10,
          color: COLORS.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {statusText}
      </span>
      <StatusPrompt statusText={statusText} mustAct={mustAct} />
    </div>
  )
}

export function TopBar({
  turn,
  statusText,
  statusPlayer,
  statusMustAct,
  canUndo,
  hintVisible,
  layout,
  prefs,
  onPrefsChange,
  onUndo,
  onHint,
  onRules,
  onLog,
  keyOpen,
  onKeyToggle,
  onKeyClose,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onNewGame,
}: {
  turn: number
  statusText: string
  statusPlayer: Player | null
  statusMustAct: boolean
  canUndo: boolean
  hintVisible: boolean
  layout: 'wide' | 'medium'
  prefs: CatanPrefs
  onPrefsChange: (patch: Partial<CatanPrefs>) => void
  onUndo: () => void
  onHint?: () => void
  onRules: () => void
  onLog: () => void
  keyOpen: boolean
  onKeyToggle: () => void
  onKeyClose: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onNewGame: () => void
}) {
  const t = useT()
  const l = t.catan.layout
  const menuRef = useRef<HTMLDivElement | null>(null)
  useModalBehavior(menuRef, menuOpen ? onMenuClose : undefined, menuOpen)

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        minHeight: 40,
        backgroundColor: COLORS.panel,
        borderBottom: `2px solid ${COLORS.panelBorder}`,
        flexShrink: 0,
      }}
    >
      <h1 style={{ ...PIXEL_FONT, fontSize: 16, color: COLORS.accent, margin: 0, letterSpacing: 2 }}>{t.catan.title}</h1>
      <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, flexShrink: 0 }}>
        {fill(t.catan.turn, { turn })}
      </span>
      <StatusBanner statusText={statusText} statusPlayer={statusPlayer} mustAct={statusMustAct} />
      {canUndo ? (
        <Tooltip content={l.undo}>
          <PixelButton onClick={onUndo} style={{ flexShrink: 0 }}>
            {l.undo}
          </PixelButton>
        </Tooltip>
      ) : null}
      {onHint ? (
        <Tooltip content={hintVisible ? t.catan.actionBar.hintHide : t.catan.actionBar.hint}>
          <PixelButton aria-pressed={hintVisible} onClick={onHint} style={{ flexShrink: 0 }}>
            {hintVisible ? t.catan.actionBar.hintHide : t.catan.actionBar.hint}
          </PixelButton>
        </Tooltip>
      ) : null}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Tooltip content={t.catan.keyPanel.title}>
          <PixelButton data-tutorial="legend" aria-expanded={keyOpen} onClick={onKeyToggle}>
            {l.key}
          </PixelButton>
        </Tooltip>
        <BoardKeyPanel open={keyOpen} onClose={onKeyClose} />
      </div>
      {layout === 'medium' ? (
        <Tooltip content={l.sheetTitles.log}>
          <PixelButton data-tutorial="log" onClick={onLog} style={{ flexShrink: 0 }}>
            {l.sheetTitles.log}
          </PixelButton>
        </Tooltip>
      ) : null}
      <Tooltip content={t.catan.tooltips.rules}>
        <PixelButton onClick={onRules} style={{ flexShrink: 0 }}>
          {t.catan.rules}
        </PixelButton>
      </Tooltip>
      <SettingsMenu prefs={prefs} onChange={onPrefsChange} />
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Tooltip content={l.menu}>
          <PixelButton aria-expanded={menuOpen} onClick={onMenuToggle}>
            {l.menu}
          </PixelButton>
        </Tooltip>
        {menuOpen ? (
          <div
            ref={menuRef}
            role="dialog"
            aria-label={l.menu}
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 40,
              width: 200,
              backgroundColor: COLORS.panel,
              border: `2px solid ${COLORS.panelBorder}`,
              boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <PixelButton onClick={onNewGame} style={{ width: '100%' }}>
              {t.catan.newGame}
            </PixelButton>
            <Link
              href="/"
              className={FOCUS_CLASS}
              style={{
                ...PIXEL_FONT,
                fontSize: 10,
                padding: '6px 8px',
                backgroundColor: COLORS.panel,
                border: `2px solid ${COLORS.panelBorder}`,
                color: COLORS.text,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {t.catan.back}
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  )
}

export function StackTopBar({
  statusText,
  statusPlayer,
  statusMustAct,
  dice,
  canRoll,
  onRoll,
  canUndo,
  onUndo,
  onMenu,
}: {
  statusText: string
  statusPlayer: Player | null
  statusMustAct: boolean
  dice: [number, number] | null
  canRoll: boolean
  onRoll: () => void
  canUndo: boolean
  onUndo: () => void
  onMenu: () => void
}) {
  const t = useT()
  const l = t.catan.layout

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        backgroundColor: COLORS.panel,
        borderBottom: `2px solid ${COLORS.panelBorder}`,
        flexShrink: 0,
        minHeight: 44,
      }}
    >
      <PixelButton onClick={onMenu} aria-label={l.menu} style={{ flexShrink: 0 }}>
        {l.menu}
      </PixelButton>
      <div
        data-tutorial="status"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 6px',
          backgroundColor: COLORS.bg,
          border: `2px solid ${statusMustAct ? COLORS.accent : COLORS.panelBorder}`,
        }}
      >
        {statusPlayer ? (
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              backgroundColor: PLAYER_HEX[statusPlayer.color],
              border: `1px solid ${COLORS.panelDark}`,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        ) : null}
        <span
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            color: statusPlayer ? PLAYER_TEXT[statusPlayer.color] : COLORS.text,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.3,
          }}
        >
          {statusText}
        </span>
        <StatusPrompt statusText={statusText} mustAct={statusMustAct} />
      </div>
      {canUndo ? (
        <PixelButton onClick={onUndo} style={{ flexShrink: 0 }}>
          {l.undo}
        </PixelButton>
      ) : null}
      <span data-catan-anchor="bank" style={{ display: 'inline-flex', flexShrink: 0 }}>
        <button
          type="button"
          data-tutorial="dice"
          data-catan-anchor="dice"
          disabled={!canRoll}
          onClick={onRoll}
          // Rolling names the button; otherwise its name is the dice image's, which reads the values.
          aria-label={canRoll ? t.catan.actionBar.roll : undefined}
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: 2,
            backgroundColor: COLORS.panel,
            border: `2px solid ${COLORS.panelBorder}`,
            cursor: canRoll ? 'pointer' : 'default',
            opacity: canRoll ? 1 : 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Dice dice={dice} label={t.catan.diceViewer.title} scale={1} />
        </button>
      </span>
    </header>
  )
}
