/**
 * Types for the AGLC4 (Australian Guide to Legal Citation, 4th ed) generator.
 * The model is deliberately UI-agnostic and string-in / segments-out so the
 * formatting rules can be reasoned about and verified on their own.
 */

export type SourceType =
  | 'reported-case'
  | 'unreported-case'
  | 'legislation'
  | 'delegated-legislation'
  | 'journal-article'
  | 'book'
  | 'book-chapter'
  | 'web'
  | 'hansard'

/** A run of citation text. `italic` runs are rendered as <em> and copied flat. */
export interface Segment {
  text: string
  italic?: boolean
}

export type Citation = Segment[]

/** User-entered values for a source, keyed by field key. */
export type Values = Record<string, string>

export interface FieldConfig {
  key: string
  label: string
  placeholder?: string
  /** Shown beneath the input as a faint hint. */
  hint?: string
}

export interface SourceConfig {
  /** Human label for the source-type selector. */
  label: string
  /** Short worked example shown under the heading. */
  example: string
  fields: FieldConfig[]
}
