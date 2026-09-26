'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { BookData, ShelfBook } from '@/lib/room/books'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
const SERIF = { fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' } as const

const PAPER = '#f2e8d5'
const PAPER_EDGE = '#e2d4ba'
const INK = '#2a2018'
const BEZEL = '#3d2e1e'
const BEZEL_EDGE = '#5a4430'
const BRASS = '#c8a165'

const SIZES = [15, 17, 19, 21] as const
const STORAGE_KEY = 'room-reader-v1'

interface Saved {
  size?: number
  pages?: Record<string, number>
}

function loadSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

function saveSaved(next: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // private mode: bookmarks just do not persist
  }
}

export interface ReaderLabels {
  close: string
  loading: string
  failed: string
  prev: string
  next: string
  contents: string
  smaller: string
  larger: string
  page: string
  of: string
  publicDomain: string
}

interface RoomReaderProps {
  book: ShelfBook
  labels: ReaderLabels
  onClose: () => void
}

/**
 * The room's e-reader: a pixel-framed reading device that opens over the
 * stage. Text comes from /books/<id>.json, one JSON page per printed page, so
 * turning a page here turns the same page the book does. Wide viewports get a
 * two-page spread; narrow ones a single page.
 */
export function RoomReader({ book, labels, onClose }: RoomReaderProps) {
  const reduce = useReducedMotion()
  const [data, setData] = useState<BookData | null>(null)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState<number>(17)
  const [spread, setSpread] = useState(false)
  const [toc, setToc] = useState(false)
  const [direction, setDirection] = useState(1)
  const frameRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  // Two pages side by side once there is room for two comfortable measures.
  useEffect(() => {
    const mq = matchMedia('(min-width: 1100px)')
    const apply = () => setSpread(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Text, plus the reader's saved place in this book.
  useEffect(() => {
    let live = true
    setData(null)
    setFailed(false)
    fetch(`/books/${book.id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<BookData>
      })
      .then((d) => {
        if (!live) return
        const saved = loadSaved()
        setData(d)
        setSize(saved.size && SIZES.includes(saved.size as (typeof SIZES)[number]) ? saved.size : 17)
        setPage(Math.min(Math.max(saved.pages?.[book.id] ?? 0, 0), d.pages.length - 1))
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [book.id])

  const total = data?.pages.length ?? 0
  const step = spread ? 2 : 1

  const go = useCallback(
    (delta: number) => {
      setDirection(delta > 0 ? 1 : -1)
      setPage((p) => {
        const next = Math.min(Math.max(p + delta * step, 0), Math.max(total - 1, 0))
        return next
      })
    },
    [step, total],
  )

  const jump = useCallback((to: number) => {
    setDirection(1)
    setPage(to)
    setToc(false)
  }, [])

  // Remember the place (and the type size) as the reader moves.
  useEffect(() => {
    if (!data) return
    const saved = loadSaved()
    saveSaved({ ...saved, size, pages: { ...(saved.pages ?? {}), [book.id]: page } })
  }, [book.id, page, size, data])

  // Keyboard: arrows turn pages, Escape closes, +/- resize.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (toc) setToc(false)
        else onClose()
        return
      }
      // Space on a focused control activates it; only turn the page when the
      // frame or paper has focus.
      if (e.key === ' ' && (e.target as HTMLElement | null)?.closest('button, a, input, textarea, select')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
      if (e.key === 'Home') jump(0)
      if (e.key === 'End' && total) jump(total - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jump, onClose, toc, total])

  // Move focus into the reader so the keyboard shortcuts land somewhere sane.
  useEffect(() => {
    frameRef.current?.focus()
  }, [data])

  // A fresh page always starts at the top.
  useEffect(() => {
    paperRef.current?.scrollTo({ top: 0 })
  }, [page])

  const visible = useMemo(() => {
    if (!data) return []
    return data.pages.slice(page, page + step)
  }, [data, page, step])

  const progress = total > 1 ? (page / (total - 1)) * 100 : 0
  const sizeIndex = SIZES.indexOf(size as (typeof SIZES)[number])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(12, 8, 6, 0.82)', backdropFilter: 'blur(2px)' }}
      initial={reduce ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={book.title}
    >
      <motion.div
        ref={frameRef}
        tabIndex={-1}
        className="relative flex flex-col outline-none"
        initial={reduce ? undefined : { scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          width: 'min(96vw, 1180px)',
          height: 'min(92vh, 820px)',
          backgroundColor: BEZEL,
          border: `3px solid ${BEZEL_EDGE}`,
          borderRadius: 6,
          boxShadow: '0 18px 40px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(0,0,0,0.35)',
          padding: 10,
          imageRendering: 'pixelated',
        }}
      >
        {/* Device chrome: title, spine colour chip, controls */}
        <div className="flex items-center gap-3 px-1 pb-2" style={{ ...PIXEL, fontSize: 11, color: '#e8d5b0' }}>
          <span style={{ width: 10, height: 14, backgroundColor: book.spine, border: '1px solid rgba(0,0,0,0.5)' }} aria-hidden />
          <span className="truncate">
            {book.title}
            <span style={{ opacity: 0.6 }}> · {book.author}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ChromeButton onClick={() => setToc((v) => !v)} pressed={toc} label={labels.contents}>
              ☰ {labels.contents}
            </ChromeButton>
            <ChromeButton
              onClick={() => setSize(SIZES[Math.max(sizeIndex - 1, 0)])}
              label={labels.smaller}
              disabled={sizeIndex <= 0}
            >
              A-
            </ChromeButton>
            <ChromeButton
              onClick={() => setSize(SIZES[Math.min(sizeIndex + 1, SIZES.length - 1)])}
              label={labels.larger}
              disabled={sizeIndex >= SIZES.length - 1}
            >
              A+
            </ChromeButton>
            <ChromeButton onClick={onClose} label={labels.close}>✕</ChromeButton>
          </div>
        </div>

        {/* Paper */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            backgroundColor: PAPER,
            border: `2px solid ${PAPER_EDGE}`,
            borderRadius: 3,
            boxShadow: 'inset 0 0 24px rgba(120, 92, 52, 0.22)',
          }}
        >
          {!data && !failed && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ ...PIXEL, fontSize: 12, color: '#6a5843' }}>
              {labels.loading}
              <span className="ml-1 animate-pulse">_</span>
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center" style={{ ...PIXEL, fontSize: 12, color: '#8a3a2a' }}>
              {labels.failed}
            </div>
          )}

          {data && (
            <div ref={paperRef} className="absolute inset-0 overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={page}
                  initial={reduce ? undefined : { opacity: 0, x: direction * 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: direction * -14 }}
                  transition={{ duration: 0.16 }}
                  className={`grid gap-0 ${spread ? 'grid-cols-2' : 'grid-cols-1'}`}
                >
                  {visible.map((p, i) => (
                    <article
                      key={`${page}-${i}`}
                      className="px-8 py-7 sm:px-12"
                      style={{
                        ...SERIF,
                        fontSize: size,
                        lineHeight: 1.62,
                        color: INK,
                        borderRight: spread && i === 0 ? `1px solid ${PAPER_EDGE}` : undefined,
                        boxShadow: spread && i === 0 ? 'inset -18px 0 22px -18px rgba(90, 68, 40, 0.45)' : undefined,
                        minHeight: '100%',
                        hyphens: 'auto',
                      }}
                    >
                      {p.blocks.map((b, j) =>
                        b.t === 'h' ? (
                          <h2
                            key={j}
                            className="mb-5 mt-2"
                            style={{ ...PIXEL, fontSize: Math.max(11, size - 5), letterSpacing: '0.06em', color: '#6a4a24' }}
                          >
                            {b.s}
                          </h2>
                        ) : b.t === 'v' ? (
                          <p key={j} style={{ margin: 0, paddingLeft: 12, textIndent: -12 }}>
                            {b.s}
                          </p>
                        ) : (
                          // Justification only earns its keep on a wide measure;
                          // on a phone it opens rivers between the words.
                          <p key={j} style={{ margin: '0 0 0.85em', textAlign: spread ? 'justify' : 'left', textIndent: j === 0 ? 0 : '1.4em' }}>
                            {b.s}
                          </p>
                        ),
                      )}
                      <p className="mt-6" style={{ ...PIXEL, fontSize: 9, color: '#6a5843', textAlign: 'center' }}>
                        {p.label || page + i + 1}
                      </p>
                    </article>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Table of contents */}
          <AnimatePresence>
            {toc && data && (
              <motion.nav
                key="toc"
                initial={reduce ? undefined : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-6 py-5"
                style={{ backgroundColor: PAPER }}
                aria-label={labels.contents}
              >
                <h3 className="mb-4" style={{ ...PIXEL, fontSize: 12, color: '#6a4a24' }}>
                  {labels.contents}
                </h3>
                <ul className="space-y-1">
                  {data.chapters.map((c) => (
                    <li key={`${c.title}-${c.page}`}>
                      <button
                        type="button"
                        onClick={() => jump(c.page)}
                        className="w-full text-left py-1 hover:underline"
                        style={{ ...SERIF, fontSize: 15, color: INK }}
                      >
                        {c.title}
                        <span style={{ ...PIXEL, fontSize: 9, opacity: 0.55, float: 'right' }}>
                          {data.pages[c.page]?.label || c.page + 1}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>

        {/* Footer: page turn, progress, colophon */}
        <div className="flex items-center gap-3 px-1 pt-2" style={{ ...PIXEL, fontSize: 10, color: '#e8d5b0' }}>
          <ChromeButton onClick={() => go(-1)} label={labels.prev} disabled={page <= 0}>
            ◀
          </ChromeButton>
          <ChromeButton onClick={() => go(1)} label={labels.next} disabled={!total || page >= total - step}>
            ▶
          </ChromeButton>
          <span aria-live="polite" style={{ opacity: 0.85 }}>
            {labels.page} {total ? page + 1 : 0} {labels.of} {total}
          </span>
          <div className="flex-1 h-[6px]" style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,0,0,0.4)' }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: BRASS, transition: reduce ? 'none' : 'width 0.2s ease' }} />
          </div>
          {data && (
            <span className="truncate max-w-[38%]" style={{ opacity: 0.55, fontSize: 9 }}>
              {data.edition} · {labels.publicDomain}
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ChromeButton({
  onClick,
  children,
  label,
  pressed,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  label: string
  pressed?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className="px-2 py-1 transition-colors disabled:opacity-35 disabled:cursor-default outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8d5b0]"
      style={{
        ...PIXEL,
        fontSize: 10,
        color: '#e8d5b0',
        backgroundColor: pressed ? '#5a4430' : '#4a3726',
        border: '1px solid #6a5240',
        borderRadius: 2,
      }}
    >
      {children}
    </button>
  )
}
