'use client'

import { useEffect, useRef, useState } from 'react'

export interface Stat {
  label: string
  value: number
  /** optional prefix/suffix, e.g. "USD ", "B" */
  prefix?: string
  suffix?: string
  /** optional sub-note under the number */
  note?: string
}

function useCountUp(target: number, run: boolean, duration = 1100) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setN(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, duration])
  return n
}

function Counter({ stat, run }: { stat: Stat; run: boolean }) {
  const n = useCountUp(stat.value, run)
  return (
    <div className="px-1">
      <p className="font-serif text-4xl md:text-5xl font-bold text-foreground tabular-nums leading-none">
        {stat.prefix}
        {n.toLocaleString('en-AU')}
        {stat.suffix}
      </p>
      <p className="label-text mt-3">{stat.label}</p>
      {stat.note ? (
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{stat.note}</p>
      ) : null}
    </div>
  )
}

export function StatCounters({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRun(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 border-y border-border py-10"
    >
      {stats.map((s) => (
        <Counter key={s.label} stat={s} run={run} />
      ))}
    </div>
  )
}
