'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
}

export function Hero() {
  const reduce = useReducedMotion()

  return (
    <section
      aria-label="Introduction"
      className="relative min-h-screen flex flex-col justify-center hero-grid"
    >
      {/* Radial vignette over the grid */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#09090b_100%)] pointer-events-none"
      />

      <div className="relative max-w-container mx-auto px-6 pt-32 pb-24">
        <motion.div
          variants={container}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="max-w-2xl"
        >
          {/* Eyebrow */}
          <motion.p variants={item} className="label-text mb-8">
            Canberra, Australia
          </motion.p>

          {/* Name */}
          <motion.h1
            variants={item}
            className="font-serif text-6xl sm:text-7xl md:text-8xl font-bold text-foreground leading-[1.05] tracking-tight mb-8"
          >
            Ahmed
            <br />
            Hussain.
          </motion.h1>

          {/* Descriptor */}
          <motion.p
            variants={item}
            className="font-sans text-lg md:text-xl text-muted-foreground leading-relaxed mb-4 max-w-xl"
          >
            BCom&thinsp;/&thinsp;LLB(Hons) candidate at the Australian National University.
          </motion.p>
          <motion.p
            variants={item}
            className="font-sans text-lg md:text-xl text-muted-foreground leading-relaxed mb-12 max-w-xl"
          >
            I work where law meets computing, with a focus on how we govern artificial intelligence.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={item} className="flex flex-wrap gap-4">
            <Button
              href="https://www.linkedin.com/in/ahmed-hussain-0880ba25a/"
              variant="primary"
              external
            >
              Connect on LinkedIn
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <path d="M2 12L12 2M12 2H5M12 2v7" strokeLinecap="round" />
              </svg>
            </Button>
            <Button href="#contact" variant="secondary">
              Get in touch
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          className="flex flex-col items-center gap-2"
          animate={reduce ? {} : { y: [0, 5, 0] }}
          transition={reduce ? undefined : { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <span className="label-text">Scroll</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted-foreground"
            aria-hidden
          >
            <path d="M2 4.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}
