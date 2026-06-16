/**
 * Cyber-sigil background motifs (decorative, inverted for the dark theme,
 * non-interactive, behind content, aria-hidden). Drift/pulse is disabled
 * automatically under prefers-reduced-motion (handled in globals.css).
 *
 * Split into two pieces:
 *   - CircuitBackdrop: the large faint circuit, used site-wide (root layout).
 *   - CornerSigils:    the brighter corner accents, used only on /lab.
 */

/* Large, faint circuit pattern in the bottom-right, mirrored into the top-left. */
export function CircuitBackdrop() {
  return (
    <div className="sigil-layer" aria-hidden="true">
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src="/sigils/circuit.svg"
        alt=""
        className="sigil-circuit sigil-circuit-br"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <img
        src="/sigils/circuit.svg"
        alt=""
        className="sigil-circuit sigil-circuit-tl"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  )
}

const accents = [
  { src: '/sigils/tl.svg', className: 'sigil sigil-tl' },
  { src: '/sigils/tr.svg', className: 'sigil sigil-tr' },
  { src: '/sigils/bl.svg', className: 'sigil sigil-bl' },
]

/* Brighter corner accents with a soft white glow. Used only on the /lab page. */
export function CornerSigils() {
  return (
    <div className="sigil-layer" aria-hidden="true">
      {/* eslint-disable @next/next/no-img-element */}
      {accents.map((s) => (
        <img
          key={s.src}
          src={s.src}
          alt=""
          className={s.className}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ))}
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  )
}
