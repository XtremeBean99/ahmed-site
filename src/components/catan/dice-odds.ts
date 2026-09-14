const COMBINATIONS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]

export interface DiceOdds {
  combinations: number
  percent: number
}

/** Number of dice combinations (out of 36) and rounded percentage for a 2d6 total. */
export function diceOdds(total: number): DiceOdds {
  const combinations = total >= 2 && total <= 12 ? COMBINATIONS[total] : 0
  return { combinations, percent: Math.round((combinations / 36) * 100) }
}

/** Tooltip text such as "8: 5/36, about 14%". */
export function diceOddsText(total: number): string {
  const odds = diceOdds(total)
  return `${total}: ${odds.combinations}/36, about ${odds.percent}%`
}
