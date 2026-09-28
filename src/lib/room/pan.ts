export interface PanSample {
  t: number
  x: number
}

/**
 * Release velocity in px per ms, fitted over the samples inside the last
 * `windowMs`. A least-squares slope keeps a single jittery move from
 * launching a strong glide.
 */
export function releaseVelocity(samples: PanSample[], now: number, windowMs = 100): number {
  const recent = samples.filter((s) => s.t >= now - windowMs && s.t <= now)
  if (recent.length < 2) return 0

  let meanT = 0
  let meanX = 0
  for (const s of recent) {
    meanT += s.t
    meanX += s.x
  }
  meanT /= recent.length
  meanX /= recent.length

  let num = 0
  let den = 0
  for (const s of recent) {
    num += (s.t - meanT) * (s.x - meanX)
    den += (s.t - meanT) * (s.t - meanT)
  }
  if (den === 0) return 0
  return num / den
}

export interface MomentumStep {
  x: number
  v: number
  done: boolean
}

/**
 * One momentum step: decay the velocity, move by it, clamp to the room's
 * pan bounds, and stop dead at an edge. Done once the speed is negligible.
 */
export function stepMomentum(
  x: number,
  v: number,
  dt: number,
  min: number,
  max: number,
  friction = 0.004,
): MomentumStep {
  const decayed = v * Math.exp(-friction * dt)
  const nextX = x + decayed * dt

  if (nextX <= min) return { x: min, v: 0, done: true }
  if (nextX >= max) return { x: max, v: 0, done: true }

  return { x: nextX, v: decayed, done: Math.abs(decayed) < 0.02 }
}
