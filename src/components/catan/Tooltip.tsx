'use client'

import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const TooltipsEnabled = createContext(true)

/** Mount once around the game; `enabled` comes from the `tooltips` pref. */
export function TooltipsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <TooltipsEnabled.Provider value={enabled}>{children}</TooltipsEnabled.Provider>
}

export function useTooltipsEnabled(): boolean {
  return useContext(TooltipsEnabled)
}

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface Position {
  left: number
  top: number
  transform: string
}

const GAP = 6
const MAX_WIDTH = 240

function place(rect: DOMRect, side: TooltipSide): Position {
  const half = MAX_WIDTH / 2
  const clampX = (x: number) => Math.min(Math.max(x, half + 8), window.innerWidth - half - 8)
  switch (side) {
    case 'bottom':
      return { left: clampX(rect.left + rect.width / 2), top: rect.bottom + GAP, transform: 'translateX(-50%)' }
    case 'left':
      return { left: rect.left - GAP, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' }
    case 'right':
      return { left: rect.right + GAP, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' }
    default:
      return { left: clampX(rect.left + rect.width / 2), top: rect.top - GAP, transform: 'translate(-50%, -100%)' }
  }
}

/**
 * Hover/focus tooltip for a single element child. When tooltips are disabled it renders the child
 * untouched, so accessible names never depend on it: put essential text in the control itself.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 350,
}: {
  content: ReactNode
  children: ReactElement<Record<string, unknown>>
  side?: TooltipSide
  delay?: number
}) {
  const enabled = useContext(TooltipsEnabled)
  const id = useId()
  const wrapper = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!enabled) setPosition(null)
  }, [enabled])

  useEffect(() => {
    if (!position) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosition(null)
    }
    const onScroll = () => setPosition(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [position])

  if (!enabled || content === null || content === undefined || content === false || content === '') return children

  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      // The wrapper is display: contents (no box of its own), so measure the wrapped element.
      const target = wrapper.current?.firstElementChild
      if (target) setPosition(place(target.getBoundingClientRect(), side))
    }, delay)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setPosition(null)
  }

  return (
    <span
      ref={wrapper}
      style={{ display: 'contents' }}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': position ? id : undefined })}
      {position && typeof document !== 'undefined'
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              style={{
                position: 'fixed',
                left: position.left,
                top: position.top,
                transform: position.transform,
                maxWidth: MAX_WIDTH,
                width: 'max-content',
                padding: '4px 6px',
                backgroundColor: '#3d2e1e',
                border: '2px solid #5a4430',
                boxShadow: '2px 2px 0 #1a0e04',
                color: '#e8d5b0',
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                fontSize: 10,
                lineHeight: 1.4,
                pointerEvents: 'none',
                zIndex: 1000,
                whiteSpace: 'normal',
              }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
