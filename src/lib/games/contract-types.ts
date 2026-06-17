/** Types for the contract clause game. */

export interface ClauseOption {
  id: string
  /** The clause as it reads in the deal. */
  text: string
  /** Negative favours the counterparty, 0 is balanced, positive favours you. */
  balance: number
  /** Why this clause shifts the balance — shown after the round. */
  explainer: string
}

export interface Category {
  id: string
  title: string
  prompt: string
  options: ClauseOption[]
}

export interface Scenario {
  id: string
  title: string
  /** Who your client is, e.g. "the developer". */
  you: string
  /** The other side, e.g. "the client". */
  counterparty: string
  brief: string
  categories: Category[]
}

export type Outcome = 'balanced' | 'tilted' | 'failed'

/** A selection map for one scenario: categoryId → optionId. */
export type Selections = Record<string, string>
