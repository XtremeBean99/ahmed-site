// src/components/room/GameTutorial.tsx
'use client'

/**
 * The paged How to play dialog every desk game shares, its strip button and the
 * small pieces the pages are built from (key caps, key rows). The dialog's chrome
 * copy lives in en.ts `desk.tutorial`; each game passes its own pages.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { readJson, writeJson } from '@/lib/games/storage'
import { ARCADE, ArcadeButton, ArcadeOverlay, ArcadePanel, PIXEL_FONT } from './DeskArcade'
import { useDeskScreen } from './ScreenStrip'

export interface TutorialPage {
  title: string
  body: string
  extra?: ReactNode
}

export function KeyCap({ children, portrait = false }: { children: ReactNode; portrait?: boolean }) {
  return (
    <kbd
      style={{
        ...PIXEL_FONT,
        display: 'inline-block',
        minWidth: portrait ? 17 : 15,
        padding: '2px 4px 1px',
        fontSize: portrait ? 10 : 9,
        lineHeight: 1,
        textAlign: 'center',
        color: ARCADE.panelText,
        backgroundColor: ARCADE.panelDark,
        border: `1px solid ${ARCADE.panelBorder}`,
        borderBottomWidth: 2,
        borderRadius: 2,
      }}
    >
      {children}
    </kbd>
  )
}

/** Key caps, a gold name and a plain description, one row each. */
export function KeyRows({ rows, top = 10, portrait = false }: { rows: { keys: string[]; name?: string; text: string }[]; top?: number; portrait?: boolean }) {
  const named = rows.some((row) => row.name)
  return (
    <div className="grid items-center" style={{ gridTemplateColumns: named ? 'auto auto 1fr' : 'auto 1fr', columnGap: 8, rowGap: portrait ? 8 : 6, marginTop: top }}>
      {rows.map((row, i) => (
        <div key={i} className="contents">
          <span className="flex gap-1">
            {row.keys.map((k) => (
              <KeyCap key={k} portrait={portrait}>{k}</KeyCap>
            ))}
          </span>
          {named && <span style={{ color: ARCADE.gold }}>{row.name}</span>}
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  )
}

/** A gold term beside a plain line, for scoring tables and glossaries. */
export function TermRows({ rows, top = 8 }: { rows: { term: string; text: string }[]; top?: number }) {
  const { portrait } = useDeskScreen()
  return (
    <div className="grid" style={{ gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: portrait ? 6 : 4, marginTop: top }}>
      {rows.map((row) => (
        <div key={row.term} className="contents">
          <span style={{ color: ARCADE.gold }}>{row.term}</span>
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  )
}

export interface Tutorial {
  open: boolean
  show: (e?: React.MouseEvent) => void
  close: () => void
  /** Wraps the strip button so a keyboard-opened dialog can hand focus back to it. */
  buttonRef: React.RefObject<HTMLSpanElement | null>
}

/**
 * Open state for one game's tutorial. It opens by itself the first time a visitor
 * ever opens the game (`seenKey` in localStorage), unless `autoOpen` is false.
 */
export function useTutorial(seenKey: string, autoOpen = true): Tutorial {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLSpanElement>(null)
  // Only a keyboard-opened tutorial hands focus back to its button; otherwise Space would reopen it.
  const byKeyRef = useRef(false)

  useEffect(() => {
    if (!autoOpen || readJson(seenKey) === true) return
    writeJson(seenKey, true)
    setOpen(true)
  }, [seenKey, autoOpen])

  const show = useCallback((e?: React.MouseEvent) => {
    byKeyRef.current = e !== undefined && e.detail === 0
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    if (byKeyRef.current) buttonRef.current?.querySelector('button')?.focus()
    else (document.activeElement as HTMLElement | null)?.blur()
  }, [])

  return { open, show, close, buttonRef }
}

/** The strip button. Compact shows a "?" (named for screen readers); otherwise the full label. */
export function TutorialButton({ tutorial, compact = true }: { tutorial: Tutorial; compact?: boolean }) {
  const t = useT().desk.tutorial
  const { portrait } = useDeskScreen()
  return (
    <span ref={tutorial.buttonRef} className="contents">
      <ArcadeButton
        tone="dark"
        size={portrait ? 'xl' : 'sm'}
        ariaLabel={compact ? t.button : undefined}
        title={t.button}
        onClick={(e) => tutorial.show(e)}
      >
        {compact ? '?' : t.button}
      </ArcadeButton>
    </span>
  )
}

/**
 * The paged dialog. Every key is caught on the window's capture phase while it is
 * open, so the game underneath never moves, and Escape closes only this dialog
 * instead of reaching DeskView's leave-the-app handler.
 */
export function GameTutorial({
  pages,
  onClose,
  bodyH,
  width,
}: {
  pages: TutorialPage[]
  onClose: () => void
  /** Body height in landscape and portrait; the dialog never changes size between pages. */
  bodyH?: { landscape: number; portrait: number }
  width?: { landscape: number; portrait: number }
}) {
  const t = useT().desk.tutorial
  const { portrait } = useDeskScreen()
  const [page, setPage] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLSpanElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const last = pages.length - 1
  const current = pages[Math.min(page, last)]

  const go = useCallback((delta: number) => setPage((p) => Math.min(last, Math.max(0, p + delta))), [last])

  // Focus lands on Next when the dialog opens, and again if the focused Back button disables itself on page 1.
  useEffect(() => {
    const active = document.activeElement
    const lost = !dialogRef.current?.contains(active) || (active instanceof HTMLButtonElement && active.disabled)
    if (lost) nextRef.current?.querySelector('button')?.focus()
  }, [page])

  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    const onKey = (e: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (e.key === 'Escape') {
        stop(e)
        onClose()
      } else if (e.key === 'Tab') {
        // Keep Tab inside the dialog, wrapping at both ends.
        const els = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        if (els.length === 0) return
        const i = els.indexOf(document.activeElement as HTMLButtonElement)
        const to = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : i === -1 || i === els.length - 1 ? 0 : i + 1
        stop(e)
        els[to].focus()
      } else if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      } else if (e.key === 'ArrowRight') {
        stop(e)
        go(1)
      } else if (e.key === 'ArrowLeft') {
        stop(e)
        go(-1)
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        // Enter on a focused button clicks it; anywhere else it turns the page.
        stop(e)
        if (page === last) onClose()
        else go(1)
      } else {
        // The game's own keys stay quiet underneath; a focused button still clicks.
        e.stopPropagation()
        e.stopImmediatePropagation()
        if (!(e.target instanceof HTMLButtonElement) || (e.key !== ' ' && e.key !== 'Enter')) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, last, onClose, page])

  const h = bodyH ? (portrait ? bodyH.portrait : bodyH.landscape) : portrait ? 196 : 144
  const w = width ? (portrait ? width.portrait : width.landscape) : portrait ? 308 : 448

  return (
    <ArcadeOverlay tint="rgba(12,8,6,0.7)">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="outline-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ArcadePanel style={{ width: w, padding: portrait ? '10px' : '10px 12px' }}>
          <div className="flex items-center justify-between" style={{ height: portrait ? 38 : 18 }}>
            <h2 id={titleId} style={{ fontSize: portrait ? 10 : 9, lineHeight: 1, letterSpacing: 1, textTransform: 'uppercase', color: ARCADE.gold }}>
              {t.title}
            </h2>
            <ArcadeButton tone="dark" size={portrait ? 'xl' : 'sm'} onClick={onClose} title={`${t.close} (Esc)`}>
              {t.close}
            </ArcadeButton>
          </div>
          <h3 style={{ fontSize: 12, lineHeight: portrait ? '16px' : '14px', margin: portrait ? '6px 0 6px' : '4px 0 6px' }}>{current.title}</h3>
          <div id={bodyId} aria-live="polite" className="overflow-y-auto" style={{ height: h, fontSize: portrait ? 12 : 10, lineHeight: portrait ? '16px' : '14px' }}>
            <p style={{ margin: 0 }}>{current.body}</p>
            {current.extra}
          </div>
          <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', marginTop: 8 }}>
            <div className="justify-self-start">
              <ArcadeButton tone="dark" size={portrait ? 'xl' : undefined} onClick={() => go(-1)} disabled={page === 0} title={`${t.back} (Left)`}>
                {t.back}
              </ArcadeButton>
            </div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className="flex" style={{ gap: 3 }} aria-hidden>
                {pages.map((_, i) => (
                  <span key={i} style={{ width: 4, height: 4, backgroundColor: i === page ? ARCADE.amber : ARCADE.panelBorder }} />
                ))}
              </span>
              <span style={{ fontSize: portrait ? 10 : 9, lineHeight: 1 }}>{t.page.replace('{n}', String(page + 1)).replace('{total}', String(pages.length))}</span>
            </div>
            <span ref={nextRef} className="justify-self-end">
              <ArcadeButton size={portrait ? 'xl' : undefined} onClick={() => (page === last ? onClose() : go(1))} title={page === last ? t.start : `${t.next} (Right)`}>
                {page === last ? t.start : t.next}
              </ArcadeButton>
            </span>
          </div>
        </ArcadePanel>
      </div>
    </ArcadeOverlay>
  )
}
