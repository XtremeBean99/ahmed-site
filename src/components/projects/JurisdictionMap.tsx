import type { Jurisdiction } from '@/lib/litigation/types'

/**
 * Abstract, monochrome jurisdiction map. Nodes are placed in roughly
 * geographic positions and sized by case count; this is a schematic, not a
 * survey-accurate projection. Server-renderable (no hooks).
 */

interface Node {
  code: Jurisdiction
  label: string
  x: number
  y: number
}

// viewBox 800 x 360
const NODES: Node[] = [
  { code: 'US', label: 'United States', x: 165, y: 165 },
  { code: 'UK', label: 'United Kingdom', x: 425, y: 120 },
  { code: 'EU', label: 'European Union', x: 470, y: 158 },
  { code: 'AU', label: 'Australia', x: 660, y: 268 },
]

// faint connective lines (schematic links between active regions)
const LINKS: [Jurisdiction, Jurisdiction][] = [
  ['US', 'UK'],
  ['UK', 'EU'],
  ['EU', 'AU'],
  ['US', 'AU'],
]

function radius(count: number, max: number) {
  if (count <= 0) return 9
  const t = max <= 0 ? 0 : count / max
  return 16 + Math.sqrt(t) * 26
}

export function JurisdictionMap({ counts }: { counts: Record<Jurisdiction, number> }) {
  const max = Math.max(1, ...NODES.map((n) => counts[n.code] ?? 0))
  const pos = Object.fromEntries(NODES.map((n) => [n.code, n])) as Record<Jurisdiction, Node>

  return (
    <figure className="border border-border rounded-lg bg-surface/40 overflow-hidden">
      <svg
        viewBox="0 0 800 360"
        role="img"
        aria-label="Cases by jurisdiction"
        className="w-full h-auto block"
      >
        <defs>
          <pattern id="jm-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="rgba(255,255,255,0.06)" />
          </pattern>
        </defs>

        {/* dotted field */}
        <rect x="0" y="0" width="800" height="360" fill="url(#jm-dots)" />

        {/* schematic links */}
        {LINKS.map(([a, b]) => {
          const na = pos[a]
          const nb = pos[b]
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
              strokeDasharray="2 5"
            />
          )
        })}

        {/* nodes */}
        {NODES.map((n) => {
          const count = counts[n.code] ?? 0
          const r = radius(count, max)
          const active = count > 0
          const stroke = active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'
          const fill = active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'
          return (
            <g key={n.code}>
              <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth="1.25" />
              <text
                x={n.x}
                y={n.y - 1}
                textAnchor="middle"
                fontSize={active ? 26 : 18}
                fontWeight="700"
                fill={active ? '#fafafa' : 'rgba(255,255,255,0.4)'}
                fontFamily="Georgia, serif"
              >
                {count}
              </text>
              <text
                x={n.x}
                y={n.y + r + 16}
                textAnchor="middle"
                fontSize="12"
                letterSpacing="2"
                fill="rgba(255,255,255,0.6)"
                fontFamily="var(--font-sans), sans-serif"
              >
                {n.code}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="sr-only">
        Tracked cases by jurisdiction. Node size reflects the number of cases.
      </figcaption>
    </figure>
  )
}
