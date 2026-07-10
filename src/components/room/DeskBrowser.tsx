'use client'

import { useState, useCallback, useRef } from 'react'
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

function isUrl(text: string): boolean {
  return /^(https?:\/\/|www\.|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/.test(text.trim())
}

function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}

function resolveUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (isUrl(trimmed)) return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  return googleSearchUrl(trimmed)
}

export function DeskBrowser({ time, desktopLabel, labels, onDesktop }: DeskBrowserProps) {
  const [url, setUrl] = useState('')
  const [displayUrl, setDisplayUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const navigate = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      const resolved = resolveUrl(trimmed)
      // Google and search queries open in new tab (iframe blocked)
      if (resolved.includes('google.com/search')) {
        window.open(resolved, '_blank', 'noopener,noreferrer')
        setUrl('')
        return
      }
      setUrl(resolved)
      setDisplayUrl(resolved)
      setLoading(true)
    },
    [],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      navigate(url)
    },
    [url, navigate],
  )

  const reload = useCallback(() => {
    if (iframeRef.current) {
      setLoading(true)
      iframeRef.current.src = iframeRef.current.src
    }
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#c0c0c0' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>
          {desktopLabel}
        </StripButton>
      </ScreenStrip>

      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-1 py-[2px] border-b"
        style={{ backgroundColor: '#c0c0c0', borderColor: '#808080' }}
      >
        <div className="flex items-center gap-[1px] mr-1">
          <ToolbarButton onClick={reload} disabled={!displayUrl} label={labels.reload}>
            <ReloadIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => navigate('https://www.google.com')}
            disabled={false}
            label={labels.home}
          >
            <HomeIcon />
          </ToolbarButton>
        </div>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center min-w-0">
          <label className="sr-only" htmlFor="desk-browser-url">
            {labels.urlPlaceholder}
          </label>
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

        <button
          type="submit"
          onClick={handleSubmit}
          className="flex-shrink-0 px-2 py-[2px] text-[10px] active:border-[#808080]"
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

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
        {displayUrl ? (
          <>
            {loading && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10"
                style={{ backgroundColor: '#ffffff' }}
              >
                <span className="text-[10px]" style={{ ...PIXEL, color: '#808080' }}>
                  LOADING…
                </span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={displayUrl}
              title="Browser"
              className="absolute inset-0 w-full h-full border-0"
              onLoad={() => setLoading(false)}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </>
        ) : (
          /* Welcome / start page */
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-[10px] text-center px-6 mb-1" style={{ ...PIXEL, color: '#404040' }}>
              Type a URL or search query above and press Enter.
            </p>
            <p className="text-[9px] text-center px-6 mb-3" style={{ ...PIXEL, color: '#808080' }}>
              Searches open in a new tab. URLs load here.
            </p>
            <div className="flex gap-3">
              <QuickLink label="Google" onClick={() => navigate('https://www.google.com')} />
              <QuickLink label="GitHub" onClick={() => navigate('https://github.com')} />
              <QuickLink label="Wikipedia" onClick={() => navigate('https://en.wikipedia.org')} />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center px-2 h-5 border-t flex-shrink-0 text-[9px]"
        style={{ backgroundColor: '#c0c0c0', borderColor: '#808080', color: '#202020', ...PIXEL }}
      >
        {displayUrl || 'about:blank'}
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

// ---- Tiny pixel icons ----

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
      <path d="M5,2 A3,3 0 0,0 2,5 M8,5 A3,3 0 0,1 5,8" stroke="#202020" strokeWidth="1.5" fill="none" />
      <polygon points="7,2 8,1 9,3" fill="#202020" />
    </svg>
  )
}
