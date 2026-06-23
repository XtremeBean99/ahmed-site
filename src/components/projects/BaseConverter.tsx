'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/client'
import {
  deriveAll,
  parseToBigInt,
  textToBigInt,
  formatBigInt,
  type Field,
} from '@/lib/convert/bases'
import { applyBitwise, BIT_OPS, type BitOp } from '@/lib/convert/bitwise'

const inputBase =
  'w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus:outline-none focus:border-muted-foreground font-mono'

const EMPTY: Record<Field, string> = { dec: '', bin: '', oct: '', hex: '', text: '' }

function Converter() {
  const t = useT().baseConverter
  const ROWS: { field: Field; label: string; hint: string }[] = [
    { field: 'dec', label: t.decimal, hint: t.base10 },
    { field: 'bin', label: t.binary, hint: t.base2 },
    { field: 'oct', label: t.octal, hint: t.base8 },
    { field: 'hex', label: t.hexadecimal, hint: t.base16 },
    { field: 'text', label: t.text, hint: t.utf8 },
  ]
  const [fields, setFields] = useState<Record<Field, string>>(() => deriveAll(42n))
  const [error, setError] = useState<Field | null>(null)

  function update(field: Field, raw: string) {
    if (raw.trim() === '') {
      setFields(EMPTY)
      setError(null)
      return
    }
    const value = field === 'text' ? textToBigInt(raw) : parseToBigInt(raw, field)
    if (value === null) {
      setFields((f) => ({ ...f, [field]: raw }))
      setError(field)
      return
    }
    setFields({ ...deriveAll(value), [field]: raw })
    setError(null)
  }

  return (
    <div className="space-y-3">
      {ROWS.map(({ field, label, hint }) => (
        <div key={field} className="grid grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr] gap-3 items-start">
          <div className="pt-2.5">
            <label htmlFor={`conv-${field}`} className="block text-sm text-foreground">
              {label}
            </label>
            <span className="text-xs text-muted">{hint}</span>
          </div>
          <div>
            <input
              id={`conv-${field}`}
              type="text"
              inputMode={field === 'dec' ? 'numeric' : 'text'}
              autoComplete="off"
              spellCheck={false}
              placeholder={field === 'text' ? t.typeText : '0'}
              value={fields[field]}
              onChange={(e) => update(field, e.target.value)}
              className={cn(inputBase, error === field && 'border-red-800')}
              aria-invalid={error === field}
            />
            {error === field && (
              <p role="alert" className="mt-1 text-xs text-red-500">
                {t.invalidBefore}{label.toLowerCase()}{t.invalidAfter}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Bitwise() {
  const t = useT().baseConverter
  const [a, setA] = useState('60')
  const [b, setB] = useState('13')
  const [op, setOp] = useState<BitOp>('and')

  const meta = BIT_OPS.find((o) => o.op === op)!
  const av = parseToBigInt(a, 'dec')
  const bv = parseToBigInt(b, 'dec')
  const aBad = a.trim() !== '' && av === null
  const bBad = !meta.unary && b.trim() !== '' && bv === null

  const ready = av !== null && (meta.unary || bv !== null)
  const result = ready ? applyBitwise(op, av!, bv ?? 0n) : null

  return (
    <div className="border border-border rounded-lg bg-surface p-5 sm:p-6">
      <p className="label-text mb-4">{t.bitwiseTitle}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grow min-w-[7rem]">
          <label htmlFor="bit-a" className="block text-xs text-muted-foreground mb-1.5 label-text">
            {t.aDecimal}
          </label>
          <input
            id="bit-a"
            type="text"
            inputMode="numeric"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className={cn(inputBase, aBad && 'border-red-800')}
            aria-invalid={aBad}
          />
        </div>

        <div>
          <label htmlFor="bit-op" className="block text-xs text-muted-foreground mb-1.5 label-text">
            {t.operation}
          </label>
          <select
            id="bit-op"
            value={op}
            onChange={(e) => setOp(e.target.value as BitOp)}
            className={cn(inputBase, 'appearance-none cursor-pointer pr-8')}
          >
            {BIT_OPS.map((o) => (
              <option key={o.op} value={o.op} className="bg-background">
                {o.symbol}  {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={cn('grow min-w-[7rem]', meta.unary && 'opacity-40 pointer-events-none')}>
          <label htmlFor="bit-b" className="block text-xs text-muted-foreground mb-1.5 label-text">
            {op === 'shl' || op === 'shr' ? t.shiftBy : t.bDecimal}
          </label>
          <input
            id="bit-b"
            type="text"
            inputMode="numeric"
            value={b}
            disabled={meta.unary}
            onChange={(e) => setB(e.target.value)}
            className={cn(inputBase, bBad && 'border-red-800')}
            aria-invalid={bBad}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="label-text mb-3">{t.result}</p>
        {result === null ? (
          <p className="text-sm text-muted">{t.enterOperands}</p>
        ) : (
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm font-mono">
            <dt className="text-muted">DEC</dt>
            <dd className="text-foreground break-all">{formatBigInt(result, 'dec')}</dd>
            <dt className="text-muted">HEX</dt>
            <dd className="text-foreground break-all">0x{formatBigInt(result, 'hex')}</dd>
            <dt className="text-muted">BIN</dt>
            <dd className="text-foreground break-all">{formatBigInt(result, 'bin')}</dd>
          </dl>
        )}
      </div>
    </div>
  )
}

export function BaseConverter() {
  const t = useT().baseConverter
  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
      <div>
        <p className="label-text mb-4">{t.basesTitle}</p>
        <Converter />
        <p className="mt-4 text-xs text-muted leading-relaxed">
          {t.helper}
        </p>
      </div>
      <Bitwise />
    </div>
  )
}
