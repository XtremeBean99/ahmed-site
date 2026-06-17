import type { Category, ClauseOption, Outcome, Scenario, Selections } from './contract-types'
import { SCENARIOS } from './contract-data'

/**
 * Pure scoring logic for the contract game. No React, no DOM. A round is won by
 * landing the net balance inside the "enforceable" zone around zero; the closer
 * to perfectly balanced, the higher the round score.
 */

export { SCENARIOS }

/** A net balance within ±this is considered balanced / enforceable. */
export const BALANCED_TOL = 2
/** Beyond ±this the deal is so one-sided the round fails. */
export const FAILED_TOL = 5

export function findOption(category: Category, optionId: string | undefined): ClauseOption | undefined {
  return category.options.find((o) => o.id === optionId)
}

/** Net balance of the current selections (favouring you when positive). */
export function netBalance(scenario: Scenario, selections: Selections): number {
  return scenario.categories.reduce((sum, cat) => {
    const opt = findOption(cat, selections[cat.id])
    return sum + (opt ? opt.balance : 0)
  }, 0)
}

/** The largest balance magnitude the scenario can reach (for meter scaling). */
export function maxAbsBalance(scenario: Scenario): number {
  return scenario.categories.reduce((sum, cat) => {
    return sum + Math.max(...cat.options.map((o) => Math.abs(o.balance)))
  }, 0)
}

export function allChosen(scenario: Scenario, selections: Selections): boolean {
  return scenario.categories.every((cat) => Boolean(selections[cat.id]))
}

export function chosenOptions(scenario: Scenario, selections: Selections): ClauseOption[] {
  return scenario.categories
    .map((cat) => findOption(cat, selections[cat.id]))
    .filter((o): o is ClauseOption => Boolean(o))
}

export function classify(net: number): Outcome {
  const a = Math.abs(net)
  if (a <= BALANCED_TOL) return 'balanced'
  if (a <= FAILED_TOL) return 'tilted'
  return 'failed'
}

/** 100 at perfect balance, sloping to 0 as the deal tilts. */
export function roundScore(net: number): number {
  return Math.max(0, Math.round(100 - Math.abs(net) * 12))
}

export const OUTCOME_COPY: Record<Outcome, { verdict: string; note: string }> = {
  balanced: {
    verdict: 'Deal signed',
    note: 'Even-handed and enforceable — both sides can live with it. This is the deal that gets done.',
  },
  tilted: {
    verdict: 'Pushed too hard',
    note: 'One side carries noticeably more risk. The other party would push back hard, and a court might too.',
  },
  failed: {
    verdict: 'No deal',
    note: 'So one-sided it falls over — the counterparty walks, or the term is unlikely to be enforceable.',
  },
}

export const TOTAL_ROUNDS = SCENARIOS.length
/** Best possible total: a perfect 100 in every scenario. */
export const MAX_TOTAL = TOTAL_ROUNDS * 100
