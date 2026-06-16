'use client'

/**
 * CircuitMesh — a monochrome, 3D-projected node/circuit mesh rendered on a
 * single <canvas>. Decorative only: non-interactive, aria-hidden, sits behind
 * page content. Scoped to the /projects page (imported there, not in the
 * root layout).
 *
 * Design constraints (see CLAUDE.md):
 *   - Strictly monochrome: white strokes/dots at low alpha over the zinc-950
 *     page background. No colour, no glow.
 *   - Self-contained: no external dependencies, no global CSS. Safe to add
 *     while the site-wide sigil styles are mid-refactor.
 *   - Respects prefers-reduced-motion: renders ONE static frame, no RAF loop.
 *   - Pauses when the tab is hidden or the page is scrolled out of view.
 *   - Device-pixel-ratio aware; cleans up listeners and animation frames.
 */

import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  z: number
  /** larger nodes read as circuit "junctions" */
  hub: boolean
}

const NODE_COUNT = 60
/** half-extent of the cube the nodes live in (world units) */
const SPREAD = 1
/** connect two nodes when their 3D distance is below this */
const LINK_DIST = 0.62
/** camera distance for the perspective projection */
const CAMERA_Z = 3.2

export function CircuitMesh({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Stable node cloud (seeded once per mount).
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
      x: (Math.random() * 2 - 1) * SPREAD,
      y: (Math.random() * 2 - 1) * SPREAD,
      z: (Math.random() * 2 - 1) * SPREAD,
      hub: i % 7 === 0,
    }))

    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    /** rotate (x,y,z) around Y then X, project to screen space */
    const project = (n: Node, ax: number, ay: number) => {
      const cosY = Math.cos(ay)
      const sinY = Math.sin(ay)
      const cosX = Math.cos(ax)
      const sinX = Math.sin(ax)

      // rotate around Y
      const x = n.x * cosY - n.z * sinY
      let z = n.x * sinY + n.z * cosY
      // rotate around X
      const y = n.y * cosX - z * sinX
      z = n.y * sinX + z * cosX

      const perspective = CAMERA_Z / (CAMERA_Z + z)
      const scale = Math.min(width, height) * 0.42
      return {
        sx: width / 2 + x * scale * perspective,
        sy: height / 2 + y * scale * perspective,
        depth: perspective, // ~0.7 (far) .. ~1.3 (near)
      }
    }

    const draw = (t: number) => {
      const ay = t * 0.00006
      const ax = Math.sin(t * 0.00004) * 0.35

      ctx.clearRect(0, 0, width, height)

      const projected = nodes.map((n) => project(n, ax, ay))

      // Links (drawn first, behind the nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dz = nodes[i].z - nodes[j].z
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist > LINK_DIST) continue

          const a = projected[i]
          const b = projected[j]
          const fade = 1 - dist / LINK_DIST
          const depth = (a.depth + b.depth) / 2
          // closer + shorter links are slightly brighter, capped low
          const alpha = fade * 0.16 * depth
          ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
          ctx.lineWidth = 0.6 * depth
          ctx.beginPath()
          ctx.moveTo(a.sx, a.sy)
          ctx.lineTo(b.sx, b.sy)
          ctx.stroke()
        }
      }

      // Nodes
      for (let i = 0; i < nodes.length; i++) {
        const p = projected[i]
        const r = (nodes[i].hub ? 2.1 : 1.1) * p.depth
        const alpha = (nodes[i].hub ? 0.5 : 0.32) * p.depth
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    let rafId = 0
    let running = false

    const loop = (t: number) => {
      draw(t)
      rafId = requestAnimationFrame(loop)
    }

    const start = () => {
      if (running || prefersReduced) return
      running = true
      rafId = requestAnimationFrame(loop)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(rafId)
    }

    resize()

    if (prefersReduced) {
      // single static frame, no animation
      draw(8000)
    } else {
      start()
    }

    // Pause when scrolled out of view (perf) ...
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden) start()
        else stop()
      },
      { threshold: 0 }
    )
    io.observe(canvas)

    // ... and when the tab is backgrounded.
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onResize = () => {
      resize()
      if (prefersReduced) draw(8000)
    }
    window.addEventListener('resize', onResize)

    return () => {
      stop()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 ${className ?? ''}`}
      style={{
        // fade the mesh toward the edges so it never competes with content
        maskImage:
          'radial-gradient(ellipse 80% 70% at 50% 42%, #000 35%, transparent 100%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 80% 70% at 50% 42%, #000 35%, transparent 100%)',
        opacity: 0.7,
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
