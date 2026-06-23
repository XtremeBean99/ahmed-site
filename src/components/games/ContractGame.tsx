'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/client'
import { GameStat } from '@/components/games/GameStat'
import { BEST_KEYS, getBest, setBestIfHigher } from '@/lib/games/storage'
import {
  SCENARIOS,
  TOTAL_ROUNDS,
  BALANCED_TOL,
  netBalance,
  maxAbsBalance,
  allChosen,
  classify,
  roundScore,
  OUTCOME_COPY,
} from '@/lib/games/contract-engine'
import type { Outcome, Selections } from '@/lib/games/contract-types'

type Phase = 'playing' | 'result' | 'finished'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const outcomeTone: Record<Outcome, string> = {
  balanced: 'text-foreground',
  tilted: 'text-muted-foreground',
  failed: 'text-muted-foreground',
}

/** Horizontal balance meter: centre is a fair deal; zone shows the win range. */
function BalanceMeter({ net, max }: { net: number; max: number }) {
  const t = useT().contractGame
  const reduce = useReducedMotion()
  const pos = clamp(50 + (net / max) * 50, 0, 100)
  const zone = (BALANCED_TOL / max) * 50

  return (
    <div className="select-none">
      <div className="flex justify-between text-xs text-muted mb-2 label-text">
        <span>{t.favoursCounterparty}</span>
        <span>{t.favoursClient}</span>
      </div>
      <div className="relative h-2 rounded-full bg-border">
        {/* balanced (enforceable) zone */}
        <div
          className="absolute inset-y-0 rounded-full bg-foreground/15 border-x border-foreground/30"
          style={{ left: `${50 - zone}%`, right: `${50 - zone}%` }}
          aria-hidden
        />
        {/* centre line */}
        <div className="absolute inset-y-[-3px] w-px bg-muted-foreground/50 left-1/2" aria-hidden />
        {/* marker */}
        <motion.div
          className="absolute top-1/2 h-4 w-4 rounded-full bg-foreground ring-2 ring-background"
          style={{ marginLeft: '-0.5rem', marginTop: '-0.5rem' }}
          animate={{ left: `${pos}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 28 }}
          aria-hidden
        />
      </div>
    </div>
  )
}

export function ContractGame() {
  const t = useT().contractGame
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [selections, setSelections] = useState<Selections>({})
  const [phase, setPhase] = useState<Phase>('playing')
  const [total, setTotal] = useState(0)
  const [best, setBest] = useState(0)
  const [lastScore, setLastScore] = useState(0)

  useEffect(() => {
    setBest(getBest(BEST_KEYS.contract))
  }, [])

  const scenario = SCENARIOS[index]
  const max = useMemo(() => maxAbsBalance(scenario), [scenario])
  const net = netBalance(scenario, selections)
  const ready = allChosen(scenario, selections)
  const outcome = classify(net)
  const isLast = index === TOTAL_ROUNDS - 1

  function pick(categoryId: string, optionId: string) {
    if (phase !== 'playing') return
    setSelections((s) => ({ ...s, [categoryId]: optionId }))
  }

  function lockIn() {
    if (!ready || phase !== 'playing') return
    const score = roundScore(net)
    setLastScore(score)
    setTotal((t) => t + score)
    setPhase('result')
  }

  function next() {
    if (isLast) {
      const isBest = setBestIfHigher(BEST_KEYS.contract, total)
      if (isBest) setBest(total)
      setPhase('finished')
      return
    }
    setIndex((i) => i + 1)
    setSelections({})
    setPhase('playing')
  }

  function restart() {
    setIndex(0)
    setSelections({})
    setTotal(0)
    setLastScore(0)
    setPhase('playing')
  }

  if (phase === 'finished') {
    const verdict =
      total >= 270 ? t.verdictMaster : total >= 180 ? t.verdictSound : t.verdictBack
    return (
      <div className="max-w-2xl">
        <div className="border border-border rounded-lg bg-surface p-8 text-center">
          <p className="label-text mb-3">{t.finalResult}</p>
          <p className="font-serif text-5xl font-bold text-foreground tabular-nums">{total}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t.outOf} {TOTAL_ROUNDS * 100}</p>
          <p className="font-serif text-xl text-foreground mt-6">{verdict}</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {t.closedBefore}{TOTAL_ROUNDS}{t.closedAfter}
          </p>
          <div className="mt-6 flex items-center justify-center gap-8">
            <GameStat label={t.thisRun} value={String(total)} />
            <GameStat label={t.best} value={String(best)} />
          </div>
          <button
            type="button"
            onClick={restart}
            className="mt-8 bg-foreground text-background px-7 py-3 rounded-md text-sm font-medium hover:bg-muted-foreground transition-colors"
          >
            {t.playAgain}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_20rem] gap-8 lg:gap-12 items-start">
      {/* Main column */}
      <div>
        {/* Scenario brief */}
        <div className="border border-border rounded-lg bg-surface p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <p className="label-text">
              {t.roundBefore}{index + 1}{t.roundMid}{TOTAL_ROUNDS}
            </p>
            <p className="text-xs text-muted">
              {t.actFor}<span className="text-muted-foreground">{scenario.you}</span>{t.versus}
              {scenario.counterparty}
            </p>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">{scenario.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{scenario.brief}</p>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {scenario.categories.map((cat) => {
            const chosenId = selections[cat.id]
            return (
              <fieldset key={cat.id}>
                <legend className="mb-1">
                  <span className="font-serif text-lg font-semibold text-foreground">{cat.title}</span>
                </legend>
                <p className="text-sm text-muted mb-3">{cat.prompt}</p>
                <div className="space-y-2.5">
                  {cat.options.map((opt) => {
                    const selected = chosenId === opt.id
                    const revealed = phase === 'result'
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => pick(cat.id, opt.id)}
                        aria-pressed={selected}
                        disabled={phase !== 'playing'}
                        className={cn(
                          'w-full text-left border rounded-lg px-4 py-3 transition-colors',
                          selected
                            ? 'border-foreground bg-surface-hover'
                            : 'border-border bg-surface hover:border-muted-foreground/50',
                          phase !== 'playing' && !selected && 'opacity-50',
                          phase === 'playing' && 'cursor-pointer',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'mt-0.5 shrink-0 h-4 w-4 rounded-full border flex items-center justify-center',
                              selected ? 'border-foreground' : 'border-muted-foreground/50',
                            )}
                            aria-hidden
                          >
                            {selected && <span className="h-2 w-2 rounded-full bg-foreground" />}
                          </span>
                          <span className="text-sm text-foreground leading-relaxed">{opt.text}</span>
                        </div>
                        {revealed && selected && (
                          <p className="mt-2 ml-7 text-xs text-muted-foreground leading-relaxed border-l border-border pl-3">
                            {opt.explainer}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
        </div>
      </div>

      {/* Sidebar: meter + verdict + action */}
      <aside className="lg:sticky lg:top-28 space-y-6">
        <div className="border border-border rounded-lg bg-surface p-5">
          <p className="label-text mb-4">{t.balanceTitle}</p>
          <BalanceMeter net={net} max={max} />
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            {ready ? (phase === 'result' ? null : t.landHint) : t.chooseHint}
          </p>

          {phase === 'result' && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 border-t border-border pt-4"
            >
              <p className={cn('font-serif text-xl font-semibold', outcomeTone[outcome])}>
                {OUTCOME_COPY[outcome].verdict}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {OUTCOME_COPY[outcome].note}
              </p>
              <p className="mt-3 text-sm text-foreground">
                {t.roundScoreBefore}<span className="font-semibold tabular-nums">{lastScore}</span>{t.roundScoreAfter}
              </p>
            </motion.div>
          )}

          <div className="mt-5">
            {phase === 'playing' ? (
              <button
                type="button"
                onClick={lockIn}
                disabled={!ready}
                className="w-full bg-foreground text-background px-5 py-3 rounded-md text-sm font-medium hover:bg-muted-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.lockIn}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="w-full bg-foreground text-background px-5 py-3 rounded-md text-sm font-medium hover:bg-muted-foreground transition-colors"
              >
                {isLast ? t.seeFinal : t.nextNegotiation}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-around border border-border rounded-lg bg-surface p-4">
          <GameStat label={t.score} value={String(total)} />
          <GameStat label={t.best} value={String(best)} />
        </div>
      </aside>
    </div>
  )
}
