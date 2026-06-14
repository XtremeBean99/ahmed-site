'use client'

import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import Image from 'next/image'
import { useRef } from 'react'

interface ParallaxImageProps {
  src: string
  alt: string
  className?: string
}

export function ParallaxImage({ src, alt, className }: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const rawY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])
  const y = useSpring(rawY, { stiffness: 80, damping: 25 })

  return (
    <div ref={ref} className={`relative overflow-hidden ${className ?? ''}`}>
      <motion.div
        style={{ y }}
        className="absolute inset-0 w-full h-[116%] -top-[8%]"
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover grayscale"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={false}
        />
      </motion.div>
    </div>
  )
}
