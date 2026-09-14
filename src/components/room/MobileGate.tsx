'use client'

import { useState } from 'react'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
const SITE_NAME = "Ahmed's website"

/** Shown instead of the room on mobile: the pixel-art desk experience needs a mouse
 *  and a real viewport, not a touchscreen. Offers a way to pick the site back up
 *  on a computer instead of just leaving the visitor stuck. */
export function MobileGate() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'unsupported'>('idle')

  const share = async () => {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: SITE_NAME, url })
      } catch {
        // user cancelled the share sheet — not an error
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('unsupported')
    }
  }

  const mailHref = `mailto:?subject=${encodeURIComponent(SITE_NAME)}&body=${encodeURIComponent(
    `Open this on a computer: ${typeof window !== 'undefined' ? window.location.href : ''}`,
  )}`

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center"
      style={{ backgroundColor: '#2a2220', color: '#e8d5b0' }}
    >
      <p style={{ ...PIXEL, fontSize: 14 }}>Sorry, this site only works on desktop.</p>
      <p style={{ fontSize: 13, opacity: 0.8, maxWidth: 320 }}>
        {SITE_NAME} is a mouse-and-keyboard experience. Send yourself the link and open it on a
        Mac or PC instead.
      </p>
      <div className="flex flex-col gap-3" style={{ width: 260 }}>
        <button
          onClick={share}
          style={{
            ...PIXEL,
            fontSize: 11,
            backgroundColor: '#3d2e1e',
            border: '1px solid #5a4430',
            color: '#e8d5b0',
            padding: '10px 12px',
          }}
        >
          {status === 'copied' ? 'Link copied!' : status === 'unsupported' ? "Couldn't copy — copy from the address bar" : 'Share to another device'}
        </button>
        <a
          href={mailHref}
          style={{
            ...PIXEL,
            fontSize: 11,
            backgroundColor: '#3d2e1e',
            border: '1px solid #5a4430',
            color: '#e8d5b0',
            padding: '10px 12px',
            textDecoration: 'none',
          }}
        >
          Email me the link
        </a>
      </div>
    </div>
  )
}
