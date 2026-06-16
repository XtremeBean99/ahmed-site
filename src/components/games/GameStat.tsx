import { cn } from '@/lib/utils'

interface GameStatProps {
  label: string
  value: string | number
  className?: string
}

/** Monochrome stat readout: tabular value over a tracked label. */
export function GameStat({ label, value, className }: GameStatProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="font-serif text-2xl md:text-3xl font-bold text-foreground tabular-nums leading-none">
        {value}
      </span>
      <span className="label-text mt-2">{label}</span>
    </div>
  )
}
