'use client'

import { useState, useCallback } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

interface BrowserLabels {
  back: string
  forward: string
  home: string
  reload: string
  search: string
  urlPlaceholder: string
}

interface DeskBrowserProps {
  time: string
  desktopLabel: string
  labels: BrowserLabels
  onDesktop: () => void
}

/** Small Netscape Navigator-styled pixel compass icon. */
function CompassIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" shapeRendering="crispEdges" aria-hidden="true">
      {/* Ring */}
      <circle cx="8" cy="8" r="6" fill="none" stroke="#c8b8a0" strokeWidth="2" />
      {/* Cross */}
      <rect x="7" y="2" width="2" height="12" fill="#c8b8a0" />
      <rect x="2" y="7" width="12" height="2" fill="#c8b8a0" />
      {/* Centre dot */}
      <rect x="7" y="7" width="2" height="2" fill="#4a4a6a" />
    </svg>
  )
}

function isUrl(text: string): boolean {
  return /^(https?:\/\/|www\.|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/.test(text.trim())
}

function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}

export function DeskBrowser({ time, desktopLabel, labels, onDesktop }: DeskBrowserProps) {
  const [url, setUrl] = useState('')
  const [history, setHistory] = useState<string[]>(['https://www.google.com'])
  const [historyIdx, setHistoryIdx] = useState(0)

  const navigate = useCallback(
    (target: string) => {
      const trimmed = target.trim()
      if (!trimmed) return
      const resolved = isUrl(trimmed) ? (trimmed.startsWith('http') ? trimmed : `https://${trimmed}`) : googleSearchUrl(trimmed)
      // Open in new tab
      window.open(resolved, '_blank', 'noopener,noreferrer')
      // Update local history for display
      setHistory((prev) => {
        const next = prev.slice(0, historyIdx + 1)
        next.push(resolved)
        return next
      })
      setHistoryIdx((prev) => prev + 1)
      setUrl(resolved)
    },
    [historyIdx],
  )

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return
    const newIdx = historyIdx - 1
    setHistoryIdx(newIdx)
    setUrl(history[newIdx])
  }, [historyIdx, history])

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return
    const newIdx = historyIdx + 1
    setHistoryIdx(newIdx)
    setUrl(history[newIdx])
  }, [historyIdx, history])

  const goHome = useCallback(() => {
    setUrl('https://www.google.com')
    setHistory((prev) => {
      const next = prev.slice(0, historyIdx + 1)
      next.push('https://www.google.com')
      return next
    })
    setHistoryIdx((prev) => prev + 1)
  }, [historyIdx])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      navigate(url)
    },
    [url, navigate],
  )

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#c0c0c0' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>
          {desktopLabel}
        </StripButton>
      </ScreenStrip>

      {/* Netscape toolbar */}
      <div
        className="flex items-center gap-1 px-1 py-[2px] border-b"
        style={{ backgroundColor: '#c0c0c0', borderColor: '#808080', borderBottomStyle: 'solid' }}
      >
        {/* Navigation buttons */}
        <div className="flex items-center gap-[1px] mr-1">
          <ToolbarButton onClick={goBack} disabled={historyIdx <= 0} label={labels.back}>
            <BackIcon />
          </ToolbarButton>
          <ToolbarButton onClick={goForward} disabled={historyIdx >= history.length - 1} label={labels.forward}>
            <ForwardIcon />
          </ToolbarButton>
          <ToolbarButton onClick={goHome} disabled={false} label={labels.home}>
            <HomeIcon />
          </ToolbarButton>
          <ToolbarButton onClick={() => navigate(url)} disabled={!url.trim()} label={labels.reload}>
            <ReloadIcon />
          </ToolbarButton>
        </div>

        {/* Compass logo */}
        <div className="flex-shrink-0 mx-1">
          <CompassIcon />
        </div>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center min-w-0">
          <label className="sr-only" htmlFor="desk-browser-url">
            {labels.urlPlaceholder}
          </label>
          <span
            className="flex-shrink-0 text-[10px] px-1"
            style={{ ...PIXEL, color: '#404040' }}
          >
            http://
          </span>
          <input
            id="desk-browser-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={labels.urlPlaceholder}
            className="flex-1 min-w-0 px-1 py-[1px] text-[10px] outline-none border border-[#808080] border-l-[#404040] border-t-[#404040]"
            style={{ ...PIXEL, backgroundColor: '#ffffff', color: '#000000' }}
          />
        </form>

        {/* Search button */}
        <button
          type="submit"
          onClick={handleSubmit}
          className="flex-shrink-0 px-2 py-[2px] text-[10px]"
          style={{
            ...PIXEL,
            backgroundColor: '#c0c0c0',
            color: '#202020',
            border: '1px solid',
            borderColor: '#ffffff #808080 #808080 #ffffff',
          }}
        >
          {labels.search}
        </button>
      </div>

      {/* Content area — shows the Netscape landing page */}
      <div
        className="flex-1 flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Netscape logo area */}
        <div className="flex items-center gap-2 mb-3">
          <CompassIcon />
          <span
            style={{
              ...PIXEL,
              fontSize: '14px',
              color: '#000080',
              fontWeight: 'bold',
            }}
          >
            Netscape Navigator
          </span>
        </div>

        {/* Search prompt */}
        <p className="text-[10px] text-center px-6 mb-2" style={{ ...PIXEL, color: '#404040' }}>
          Type a web address or search query above and press Enter.
        </p>
        <p className="text-[9px] text-center px-6" style={{ ...PIXEL, color: '#808080' }}>
          Results open in a new tab.
        </p>

        {/* Quick links */}
        <div className="flex gap-3 mt-4">
          <QuickLink
            label="Google"
            onClick={() => {
              setUrl('https://www.google.com')
              window.open('https://www.google.com', '_blank', 'noopener,noreferrer')
            }}
          />
          <QuickLink
            label="GitHub"
            onClick={() => {
              setUrl('https://github.com')
              window.open('https://github.com', '_blank', 'noopener,noreferrer')
            }}
          />
          <QuickLink
            label="Wikipedia"
            onClick={() => {
              setUrl('https://en.wikipedia.org')
              window.open('https://en.wikipedia.org', '_blank', 'noopener,noreferrer')
            }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center px-2 h-5 border-t flex-shrink-0 text-[9px]"
        style={{ backgroundColor: '#c0c0c0', borderColor: '#808080', color: '#202020', ...PIXEL }}
      >
        {url || 'about:blank'}
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex items-center justify-center w-[22px] h-[22px] p-0"
      style={{
        backgroundColor: '#c0c0c0',
        border: '1px solid',
        borderColor: disabled ? '#c0c0c0' : '#ffffff #808080 #808080 #ffffff',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-[10px]"
      style={{
        ...PIXEL,
        backgroundColor: '#e0e0e0',
        color: '#000080',
        border: '1px solid #808080',
        textDecoration: 'underline',
      }}
    >
      {label}
    </button>
  )
}

// ---- Tiny pixel icons for toolbar buttons ----

function BackIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <polygon points="8,1 2,5 8,9" fill="#202020" />
    </svg>
  )
}

function ForwardIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <polygon points="2,1 8,5 2,9" fill="#202020" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="3" y="5" width="2" height="5" fill="#202020" />
      <rect x="6" y="5" width="2" height="5" fill="#202020" />
      <rect x="2" y="4" width="6" height="1" fill="#202020" />
      <polygon points="1,4 5,1 9,4" fill="#202020" />
    </svg>
  )
}

function ReloadIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <path
        d="M5,2 A3,3 0 0,0 2,5 M8,5 A3,3 0 0,1 5,8"
        stroke="#202020"
        strokeWidth="1.5"
        fill="none"
      />
      <polygon points="7,2 8,1 9,3" fill="#202020" />
    </svg>
  )
}
