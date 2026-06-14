import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  href?: string
  external?: boolean
}

const base =
  'inline-flex items-center gap-2 rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-foreground text-background px-5 py-2.5 hover:bg-muted-foreground',
  secondary:
    'border border-border text-foreground px-5 py-2.5 hover:bg-surface-hover',
  ghost: 'text-muted-foreground px-2 py-1 hover:text-foreground',
}

export function Button({
  variant = 'primary',
  href,
  external,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], className)

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
        >
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
