'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { KEY_CAPS, capBox, capClipPath } from '@/lib/room/keyboard-keys'

// Cap geometry never changes, so it is worked out once per page load.
const CAPS = KEY_CAPS.map((cap) => ({ box: capBox(cap), clip: `path('${capClipPath(cap)}')` }))
const CAP_OF = new Map(KEY_CAPS.flatMap((cap, i) => cap.codes.map((code) => [code, i] as const)))
const NONE: ReadonlySet<string> = new Set()

type Cap = (typeof CAPS)[number]

/** One pressed cap: its own art shifted 2px down inside its outline, darkened. */
const SunkCap = memo(function SunkCap({ cap, art }: { cap: Cap; art: string }) {
  const { x, y, w, h } = cap.box
  return (
    // The black outer layer is the switch hole. The art layer sits 2px lower with the same clip,
    // so a 2px dark line opens along the cap's top edge as it drops (1px vanished at desk scale).
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, clipPath: cap.clip, background: '#000' }}>
      <div style={{
        position: 'absolute', left: 0, top: 2, width: w, height: h, clipPath: cap.clip,
        backgroundImage: `url(${art})`, backgroundSize: '1408px 768px', backgroundPosition: `${-x}px ${-y}px`,
        imageRendering: 'pixelated', filter: 'brightness(0.72)',
      }} />
    </div>
  )
})

/** Sinks the desk keyboard's caps under the visitor's real key presses. Purely decorative. */
export const DeskKeyboard = memo(function DeskKeyboard({ lampOn }: { lampOn: boolean }) {
  const [down, setDown] = useState(NONE)

  useEffect(() => {
    const clear = () => setDown((s) => (s.size ? NONE : s))
    // Capture phase and never preventDefault: the terminal, editors and games stop keys
    // propagating, and the keyboard must still see them.
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || !CAP_OF.has(e.code)) return
      setDown((s) => (s.has(e.code) ? s : new Set(s).add(e.code)))
    }
    const onUp = (e: KeyboardEvent) => {
      // macOS never sends keyup for keys pressed while Cmd is held, so releasing Cmd releases all.
      if (e.key === 'Meta') return clear()
      setDown((s) => {
        if (!s.has(e.code)) return s
        const next = new Set(s)
        next.delete(e.code)
        return next
      })
    }
    const onVisibility = () => { if (document.hidden) clear() }
    window.addEventListener('keydown', onDown, true)
    window.addEventListener('keyup', onUp, true)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onDown, true)
      window.removeEventListener('keyup', onUp, true)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Several codes can share a cap (Enter, NumpadEnter, Backslash), so dedupe by cap.
  const pressed = useMemo(() => [...new Set([...down].map((code) => CAP_OF.get(code)!))], [down])
  if (!pressed.length) return null

  const art = lampOn ? '/room/desk-closeup.png' : '/room/desk-closeup-lamp-off.png'
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {pressed.map((i) => <SunkCap key={i} cap={CAPS[i]} art={art} />)}
    </div>
  )
})
