'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { SOURCES, SOURCE_TYPES } from '@/lib/aglc4/fields'
import {
  formatFootnote,
  formatBibliography,
  segmentsToText,
  hasContent,
} from '@/lib/aglc4/format'
import type { Segment, SourceType, Values } from '@/lib/aglc4/types'

const inputBase =
  'w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus:outline-none focus:border-muted-foreground'

/** Render a citation, preserving italics, as inline text. */
function Citation({ segments }: { segments: Segment[] }) {
  return (
    <span>
      {segments.map((s, i) =>
        s.italic ? <em key={i}>{s.text}</em> : <span key={i}>{s.text}</span>,
      )}
    </span>
  )
}

function CopyButton({ text, disabled }: { text: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed label-text"
      aria-label="Copy citation"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M2 6.5L4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
            <path d="M2 8V2.5A.5.5 0 012.5 2H8" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

function OutputBlock({ label, segments }: { label: string; segments: Segment[] }) {
  const filled = hasContent(segments)
  return (
    <div className="border border-border rounded-lg bg-surface p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="label-text">{label}</p>
        <CopyButton text={segmentsToText(segments)} disabled={!filled} />
      </div>
      <p className="text-sm leading-relaxed text-foreground min-h-[1.5rem] break-words">
        {filled ? (
          <Citation segments={segments} />
        ) : (
          <span className="text-muted">Fill in the fields to build a citation.</span>
        )}
      </p>
    </div>
  )
}

export function Aglc4Generator() {
  const [type, setType] = useState<SourceType>('reported-case')
  // Values are kept per source type so switching back restores earlier input.
  const [byType, setByType] = useState<Record<string, Values>>({})

  const values = useMemo(() => byType[type] ?? {}, [byType, type])
  const config = SOURCES[type]

  const footnote = useMemo(() => formatFootnote(type, values), [type, values])
  const bibliography = useMemo(
    () => formatBibliography(type, values),
    [type, values],
  )

  function setField(key: string, value: string) {
    setByType((prev) => ({
      ...prev,
      [type]: { ...(prev[type] ?? {}), [key]: value },
    }))
  }

  function clearType() {
    setByType((prev) => ({ ...prev, [type]: {} }))
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Inputs */}
      <div>
        <label htmlFor="aglc-type" className="block text-xs text-muted-foreground mb-1.5 label-text">
          Source type
        </label>
        <select
          id="aglc-type"
          value={type}
          onChange={(e) => setType(e.target.value as SourceType)}
          className={cn(inputBase, 'appearance-none cursor-pointer')}
        >
          {SOURCE_TYPES.map((t) => (
            <option key={t} value={t} className="bg-background">
              {SOURCES[t].label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Example: <span className="text-muted-foreground">{config.example}</span>
        </p>

        <div className="mt-6 space-y-4">
          {config.fields.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`aglc-${f.key}`}
                className="block text-xs text-muted-foreground mb-1.5 label-text"
              >
                {f.label}
              </label>
              <input
                id={`aglc-${f.key}`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                className={inputBase}
              />
              {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={clearType}
          className="mt-6 text-xs text-muted underline hover:text-muted-foreground transition-colors"
        >
          Clear fields
        </button>
      </div>

      {/* Output */}
      <div className="space-y-4 lg:sticky lg:top-28 self-start">
        <OutputBlock label="Footnote" segments={footnote} />
        <OutputBlock label="Bibliography" segments={bibliography} />
        <p className="text-xs text-muted leading-relaxed">
          A study aid based on AGLC4. It covers common cases, and you should
          always check the output against the guide before relying on it.
          Italics are shown as you would type them in a document.
        </p>
      </div>
    </div>
  )
}
