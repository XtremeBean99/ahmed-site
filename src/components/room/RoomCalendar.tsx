'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RoomObject } from './RoomObject'
import { useLighting } from '@/lib/room/lighting'
import { CALENDAR_RECT, calendarDate, msUntilMidnight, type CalendarDate } from '@/lib/room/calendar'
import { drawCalendar } from '@/lib/room/calendar-art'

interface RoomCalendarProps {
  /** Accessible name before the date is known (SSR and the first render). */
  label: string
  /** Accessible name and tooltip once the visitor's date is known. */
  labelFor: (today: CalendarDate) => string
  onClick: (today: CalendarDate) => void
}

const sameDay = (a: CalendarDate | null, b: CalendarDate) =>
  !!a && a.year === b.year && a.month === b.month && a.day === b.day

/**
 * The wall calendar left of the Saitama poster: the visitor's own month with
 * today circled, drawn by calendar-art.ts one canvas pixel per stage pixel and
 * graded for the room's lighting. It turns the page at local midnight.
 */
export function RoomCalendar({ label, labelFor, onClick }: RoomCalendarProps) {
  const light = useLighting()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState(false)
  const [highlight, setHighlight] = useState<0 | 1 | 2>(0)
  // Unknown until the effect runs, so SSR and hydration agree (as SideTableClock).
  const [today, setToday] = useState<CalendarDate | null>(null)

  useEffect(() => {
    let midnight: ReturnType<typeof setTimeout>
    const refresh = () => {
      const now = new Date()
      const d = calendarDate(now)
      setToday((prev) => (sameDay(prev, d) ? prev : d))
      clearTimeout(midnight)
      midnight = setTimeout(refresh, msUntilMidnight(now) + 1000)
    }
    refresh()
    // Timers stall in background tabs and sleeping laptops; catch up on return.
    const onVis = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(midnight); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // The hover outline grows 1 px, then 2, like the sprites' highlight frames.
  useEffect(() => {
    if (!hovered) { setHighlight(0); return }
    setHighlight(1)
    const id = setTimeout(() => setHighlight(2), 70)
    return () => clearTimeout(id)
  }, [hovered])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !today) return
    const data = drawCalendar(today, { highlight, light })
    ctx.putImageData(new ImageData(data, CALENDAR_RECT.w, CALENDAR_RECT.h), 0, 0)
  }, [today, highlight, light])

  const activate = useCallback(() => setHovered(true), [])
  const deactivate = useCallback(() => setHovered(false), [])

  return (
    <RoomObject
      label={today ? labelFor(today) : label}
      showTooltip={hovered}
      onActivate={activate}
      onDeactivate={deactivate}
      onClick={() => { if (today) onClick(today) }}
      tabIndex={0}
      style={{ position: 'absolute', left: CALENDAR_RECT.x, top: CALENDAR_RECT.y, width: CALENDAR_RECT.w, height: CALENDAR_RECT.h }}
    >
      <canvas
        ref={canvasRef}
        width={CALENDAR_RECT.w}
        height={CALENDAR_RECT.h}
        aria-hidden
        className="block"
        style={{ width: CALENDAR_RECT.w, height: CALENDAR_RECT.h, imageRendering: 'pixelated' }}
      />
    </RoomObject>
  )
}
