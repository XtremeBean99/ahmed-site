'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/tutoring', label: 'Tutoring' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

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
          className="font-serif text-lg font-semibold text-foreground hover:text-muted-foreground transition-colors"
          aria-label="Ahmed Hussain — home"
        >
          Ahmed Hussain
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8" role="list">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'text-sm transition-colors',
                  pathname === href
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </Link>
            </li>
          ))}
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
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
        >
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden bg-background border-b border-border"
          >
            <ul className="flex flex-col px-6 py-4 gap-4" role="list">
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
