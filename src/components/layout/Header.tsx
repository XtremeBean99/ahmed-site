'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/games', label: 'Games' },
  { href: '/tutoring', label: 'Tutoring' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const menuRef = useRef<HTMLUListElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Move focus into/out of menu and trap Tab while open
  useEffect(() => {
    if (menuOpen) {
      const first = menuRef.current?.querySelector<HTMLElement>('a, button')
      first?.focus()
    } else {
      triggerRef.current?.focus()
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); return }
      if (e.key !== 'Tab') return
      const focusable = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/90 backdrop-blur-md border-b border-border'
          : 'bg-transparent',
      )}
    >
      <nav
        className="max-w-container mx-auto px-6 h-16 flex items-center justify-between"
        aria-label="Primary navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="Ahmed Hussain, home"
        >
          <Image
            src="/site-logo.jpg"
            alt=""
            width={36}
            height={36}
            priority
            className="h-8 w-auto grayscale brightness-0 invert"
          />
          <span className="font-serif text-lg font-semibold text-foreground group-hover:text-muted-foreground transition-colors">
            Ahmed Hussain
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8" role="list">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  className={cn(
                    'text-sm transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </Link>
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1.5 left-0 right-0 h-px bg-foreground"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </li>
            )
          })}
          <li>
            <Link
              href="/#contact"
              className="text-sm bg-foreground text-background px-4 py-2 rounded-md font-medium hover:bg-muted-foreground transition-colors"
            >
              Get in touch
            </Link>
          </li>
        </ul>

        {/* Mobile menu button */}
        <button
          ref={triggerRef}
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            {menuOpen ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden bg-background border-b border-border"
          >
            <ul ref={menuRef} className="flex flex-col px-6 py-4 gap-4" role="list">
              {navLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="block text-base text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/#contact"
                  className="inline-block text-sm bg-foreground text-background px-4 py-2 rounded-md font-medium mt-2"
                >
                  Get in touch
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
