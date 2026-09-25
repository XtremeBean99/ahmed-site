'use client'

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import type { Editor, Run } from '@/lib/terminal/types'

export const TERM_FONT = 'ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", "Courier New", monospace'
export const TERM_FONT_SIZE = 11
export const TERM_LINE_H = 14
const FG = '#35e65c'
const BG = '#0a0a0a'

const RUN_STYLE: Record<NonNullable<Run['s']>, React.CSSProperties> = {
  inv: { background: FG, color: BG },
  sel: { background: '#2a6fdb', color: '#fff' },
  dim: { color: '#3f8a52' },
  bold: { fontWeight: 700, color: '#8dffa8' },
  err: { color: '#ff7b7b', fontWeight: 700 },
  hl: { background: '#d6b400', color: '#000' },
}

/** Measured size of one monospace cell, in layout px (immune to the desk's CSS scale transform). */
export function useCell(probe: React.RefObject<HTMLElement | null>, box: React.RefObject<HTMLElement | null>) {
  return useCallback(() => {
    const p = probe.current
    const b = box.current
    if (!p || !b) return null
    const scale = b.offsetWidth ? b.getBoundingClientRect().width / b.offsetWidth : 1
    const w = p.getBoundingClientRect().width / 40 / (scale || 1)
    return { w, cols: Math.max(20, Math.floor(b.clientWidth / w)), rows: Math.max(6, Math.floor(b.clientHeight / TERM_LINE_H)) }
  }, [probe, box])
}

interface Props {
  /** Build the editor once the grid size is known. */
  make: (rows: number, cols: number) => Editor
  onDone: () => void
}

export function TermEditor({ make, onDone }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLSpanElement>(null)
  const sink = useRef<HTMLTextAreaElement>(null)
  const ed = useRef<Editor | null>(null)
  const cell = useRef({ w: 6.6, cols: 80, rows: 20 })
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const measure = useCell(probe, box)

  const after = useCallback(() => {
    if (ed.current?.done) onDone()
    else tick()
  }, [onDone])

  useLayoutEffect(() => {
    const m = measure()
    if (m) cell.current = m
    ed.current = make(cell.current.rows, cell.current.cols)
    tick()
    sink.current?.focus()
    const ro = new ResizeObserver(() => {
      const n = measure()
      if (!n || !ed.current) return
      if (n.cols !== cell.current.cols || n.rows !== cell.current.rows || n.w !== cell.current.w) {
        cell.current = n
        ed.current.resize(n.rows, n.cols)
        tick()
      }
    })
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
    // make is created per open; the editor must not be rebuilt on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { sink.current?.focus() }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const e0 = e.nativeEvent
    // Unidentified/Process = phone keyboards and IMEs: the text arrives through onInput instead
    if (e.key === 'F12' || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Process', 'AltGraph', 'Unidentified'].includes(e.key)) return
    if (e.metaKey) return
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') return // real paste
    e.preventDefault()
    e.stopPropagation() // Esc is vim's, it must not reach the desk's app-to-desktop ladder
    e0.stopImmediatePropagation?.()
    const altGr = e.ctrlKey && e.altKey && e.key.length === 1 // AltGr chars arrive as ctrl+alt
    ed.current?.key({ key: e.key, ctrl: altGr ? false : e.ctrlKey, alt: altGr ? false : e.altKey, shift: e.shiftKey })
    after()
  }
  // Text that arrives without a keydown (mobile keyboards, IME commits, dictation) is replayed as keystrokes
  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget.value
    e.currentTarget.value = ''
    if (!t) return
    for (const ch of t) ed.current?.key({ key: ch === '\n' ? 'Enter' : ch, ctrl: false, alt: false, shift: false })
    after()
  }
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const t = e.clipboardData.getData('text')
    if (t) { ed.current?.paste(t); after() }
  }

  const screen = ed.current?.render()
  const { w, rows } = cell.current

  return (
    <div
      ref={box}
      role="application"
      aria-label="Text editor"
      onClick={() => sink.current?.focus()}
      className="relative flex-1 min-h-0 overflow-hidden outline-none"
      style={{ background: BG, color: FG, fontFamily: TERM_FONT, fontSize: TERM_FONT_SIZE, lineHeight: TERM_LINE_H + 'px', cursor: 'text' }}
    >
      <style>{'@keyframes term-blink{0%,49%{opacity:.75}50%,100%{opacity:.15}}'}</style>
      <textarea
        ref={sink}
        aria-label="Editor keyboard input"
        onKeyDown={onKeyDown}
        onInput={onInput}
        onPaste={onPaste}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, padding: 0, border: 0, resize: 'none' }}
      />
      <span ref={probe} aria-hidden style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' }}>{'M'.repeat(40)}</span>
      {screen && screen.lines.slice(0, rows).map((runs, i) => (
        <div key={i} style={{ height: TERM_LINE_H, whiteSpace: 'pre', overflow: 'hidden' }}>
          {runs.map((r, j) => <span key={j} style={r.s ? RUN_STYLE[r.s] : undefined}>{r.t}</span>)}
          {runs.length === 0 && ' '}
        </div>
      ))}
      {screen?.cursor && (
        <div
          aria-hidden
          style={{
            position: 'absolute', left: screen.cursor.col * w, top: screen.cursor.row * TERM_LINE_H,
            width: w, height: TERM_LINE_H, background: FG, mixBlendMode: 'difference', animation: 'term-blink 1.1s steps(1) infinite',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
