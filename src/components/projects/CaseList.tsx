'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CASE_STATUSES,
  CLAIM_TYPES,
  type CaseStatus,
  type ClaimType,
  type Litigation,
} from '@/lib/litigation/types'

const RESOLVED: CaseStatus[] = ['Settled', 'Dismissed', 'Judgment']

function formatFiled(iso: string) {
  const [y, m] = iso.split('-')
  if (!m) return y
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-AU', { month: 'short' })
  return `${month} ${y}`
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-muted'
      )}
    >
      {children}
    </button>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function CaseList({ cases }: { cases: Litigation[] }) {
  const [claims, setClaims] = useState<ClaimType[]>([])
  const [statuses, setStatuses] = useState<CaseStatus[]>([])

  // only show option chips that actually appear in the data
  const present = useMemo(
    () => ({
      claims: CLAIM_TYPES.filter((t) => cases.some((c) => c.claimTypes.includes(t))),
      statuses: CASE_STATUSES.filter((s) => cases.some((c) => c.status === s)),
    }),
    [cases]
  )

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        if (claims.length && !claims.some((t) => c.claimTypes.includes(t))) return false
        if (statuses.length && !statuses.includes(c.status)) return false
        return true
      }),
    [cases, claims, statuses]
  )

  const anyFilter = claims.length || statuses.length
  const clearAll = () => {
    setClaims([])
    setStatuses([])
  }

  return (
    <div>
      {/* Filters */}
      <div className="space-y-4 mb-8">
        <FilterRow label="Claim">
          {present.claims.map((t) => (
            <Chip key={t} active={claims.includes(t)} onClick={() => setClaims((p) => toggle(p, t))}>
              {t}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Status">
          {present.statuses.map((s) => (
            <Chip
              key={s}
              active={statuses.includes(s)}
              onClick={() => setStatuses((p) => toggle(p, s))}
            >
              {s}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
        <p className="label-text">
          {filtered.length} {filtered.length === 1 ? 'case' : 'cases'}
        </p>
        {anyFilter ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground hover:no-underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Rows */}
      <ul role="list" className="divide-y divide-border">
        {filtered.map((c) => (
          <li key={c.id} className="py-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-serif text-lg font-semibold text-foreground leading-snug">
                  {c.caseName}
                </h3>
                <StatusBadge status={c.status} />
              </div>

              <p className="text-xs text-muted-foreground">
                {c.court} · {c.jurisdiction}
                {c.docket ? ` · ${c.docket}` : ''} · Filed {formatFiled(c.filed)}
              </p>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{c.summary}</p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {c.claimTypes.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-border-subtle bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
                {c.relief?.awarded ? (
                  <span className="text-[11px] text-foreground">
                    {c.relief.awarded}
                    <span className="text-muted-foreground"> awarded/agreed</span>
                  </span>
                ) : c.relief?.claimed ? (
                  <span className="text-[11px] text-muted-foreground">{c.relief.claimed} sought</span>
                ) : null}
              </div>

              <a
                href={c.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground hover:no-underline w-fit"
              >
                Source: {c.source.label} ↗
              </a>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No cases match these filters.
        </p>
      ) : null}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-text w-24 shrink-0">{label}</span>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const resolved = RESOLVED.includes(status)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
      <span
        className={cn(
          'inline-block w-1.5 h-1.5 rounded-full',
          resolved ? 'bg-muted' : 'bg-foreground'
        )}
      />
      {status}
    </span>
  )
}
