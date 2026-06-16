'use client'

/**
 * SiliconAtom — a monochrome, interactive 3D Bohr model of a silicon atom
 * (Z = 14, electron configuration 2/8/4) rendered with Three.js via
 * @react-three/fiber.
 *
 * Constraints (CLAUDE.md):
 *   - Strictly monochrome: white/zinc greys on the zinc-950 background.
 *   - Respects prefers-reduced-motion: no looping animation, static render.
 *   - No WebGL / error boundary fallback: renders a static SVG Bohr diagram.
 */

import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'

/* ------------------------------------------------------------------ */
/*  Electron shell data: radii, counts, speeds                          */
/* ------------------------------------------------------------------ */
const SHELLS = [
  { radius: 1.2, count: 2, speed: 0.35, pointSize: 0.06 },
  { radius: 2.0, count: 8, speed: 0.2, pointSize: 0.06 },
  // Valence shell: slightly larger points + labelled in the explainer
  { radius: 2.8, count: 4, speed: 0.12, pointSize: 0.07 },
] as const

/* ---------- Orbital ring (faint circle) ---------- */
function OrbitalRing({
  radius,
  color = '#3f3f46',
}: {
  radius: number
  color?: string
}) {
  const points = Array.from({ length: 128 }, (_, i) => {
    const angle = (i / 128) * Math.PI * 2
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
  })
  return <Line points={points} color={color} lineWidth={0.5} />
}

/* ---------- Nucleus — cluster of small spheres ---------- */
function Nucleus() {
  const groupRef = useRef<THREE.Group>(null)

  // 14 protons + ~14 neutrons = 28 particles in a tight, clumped cluster.
  // Gaussian-ish placement (average of two randoms) biases particles toward the
  // centre so the nucleus reads as a dense ball rather than a loose scatter.
  const spread = 0.16
  const rand = () => ((Math.random() + Math.random()) / 2 - 0.5) * spread
  const particles = Array.from({ length: 28 }, () => ({
    pos: new THREE.Vector3(rand(), rand(), rand()),
    size: 0.03 + Math.random() * 0.035,
  }))

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <sphereGeometry args={[p.size, 12, 12]} />
          <meshStandardMaterial
            color="#e4e4e7"
            emissive="#a1a1aa"
            emissiveIntensity={0.5}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- Electrons on a shell ---------- */
function Electrons({
  radius,
  count,
  speed,
  size,
  isReducedMotion,
}: {
  radius: number
  count: number
  speed: number
  size: number
  isReducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current || isReducedMotion) return
    groupRef.current.rotation.z += delta * speed
  })

  const isValence = count === 4

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        return (
          <mesh key={i} position={[x, y, 0]}>
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial
              color={isValence ? '#fafafa' : '#a1a1aa'}
              emissive={isValence ? '#fafafa' : '#52525b'}
              emissiveIntensity={isValence ? 0.8 : 0.3}
              roughness={0.2}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/* ---------- Atom contents ---------- */
function AtomContents({ isReducedMotion }: { isReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)

  // Gentle auto-rotate of the whole atom (unless reduced motion)
  useFrame((_, delta) => {
    if (!groupRef.current || isReducedMotion) return
    groupRef.current.rotation.y += delta * 0.12
    groupRef.current.rotation.x += delta * 0.04
  })

  // Tilt the atom so rings aren't edge-on
  const tilt = [0.5, 0.3, 0.15] as const

  return (
    <group ref={groupRef} rotation={tilt}>
      {/* Nucleus */}
      <Nucleus />

      {/* Orbital rings */}
      {SHELLS.map((s, i) => (
        <OrbitalRing key={`ring-${i}`} radius={s.radius} />
      ))}

      {/* Electrons per shell */}
      {SHELLS.map((s, i) => (
        <Electrons
          key={`e-${i}`}
          radius={s.radius}
          count={s.count}
          speed={s.speed}
          size={s.pointSize}
          isReducedMotion={isReducedMotion}
        />
      ))}
    </group>
  )
}

/* ---------- SVG fallback when WebGL is unavailable ---------- */
function SvgFallback() {
  const cx = 150
  const cy = 150
  const shellRadii = [40, 70, 100]
  const shellCounts = [2, 8, 4]

  return (
    <div className="flex items-center justify-center h-full w-full bg-surface rounded-lg">
      <svg
        viewBox="0 0 300 300"
        className="w-full max-w-[300px] h-auto"
        aria-label="Silicon atom Bohr diagram: nucleus with 14 protons, three electron shells with 2, 8 and 4 electrons."
        role="img"
      >
        {/* Shell rings */}
        {shellRadii.map((r, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={i === 2 ? '#a1a1aa' : '#52525b'}
            strokeWidth="1"
            opacity={0.6}
          />
        ))}
        {/* Nucleus */}
        <circle cx={cx} cy={cy} r="10" fill="#e4e4e7" opacity="0.9" />
        {/* Electrons */}
        {shellRadii.map((r, si) =>
          Array.from({ length: shellCounts[si] }, (_, ei) => {
            const angle = (ei / shellCounts[si]) * Math.PI * 2 - Math.PI / 2
            const ex = cx + Math.cos(angle) * r
            const ey = cy + Math.sin(angle) * r
            const isValence = si === 2
            return (
              <circle
                key={`${si}-${ei}`}
                cx={ex}
                cy={ey}
                r={isValence ? 5 : 3.5}
                fill={isValence ? '#fafafa' : '#a1a1aa'}
              />
            )
          }),
        )}
        {/* Labels */}
        <text x={cx} y={cy - 20} textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="sans-serif">
          Si · Z=14
        </text>
        {[2, 8, 4].map((n, i) => (
          <text
            key={i}
            x={cx + shellRadii[i] + 10}
            y={cy - shellRadii[i] - 6}
            fill="#52525b"
            fontSize="9"
            fontFamily="sans-serif"
          >
            {n}
          </text>
        ))}
      </svg>
    </div>
  )
}

/* ---------- Main exported component ---------- */
export function SiliconAtom() {
  const [webglSupported, setWebglSupported] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    // Check WebGL support
    try {
      const c = document.createElement('canvas')
      const gl =
        c.getContext('webgl2') ||
        c.getContext('webgl') ||
        c.getContext('experimental-webgl')
      if (!gl) setWebglSupported(false)
    } catch {
      setWebglSupported(false)
    }

    // Check reduced motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!webglSupported) {
    return <SvgFallback />
  }

  return (
    <div className="h-[420px] md:h-[520px] border border-border rounded-lg bg-surface overflow-hidden">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1, 7], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#111113' }}
      >
        <ambientLight intensity={0.6} color="#a1a1aa" />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#fafafa" />
        <directionalLight position={[-2, -1, -3]} intensity={0.3} color="#52525b" />
        <AtomContents isReducedMotion={reducedMotion} />
        <OrbitControls
          enablePan={false}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.4}
          minDistance={3.5}
          maxDistance={12}
          enableZoom
        />
      </Canvas>
    </div>
  )
}
