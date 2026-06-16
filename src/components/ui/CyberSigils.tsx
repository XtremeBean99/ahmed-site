/**
 * Discreet cyber-sigil background, applied site-wide via the root layout.
 *
 * Two layers, all decorative (inverted for the dark theme, non-interactive,
 * behind content, aria-hidden):
 *   1. A large, very faint circuit pattern in the bottom-right, mirrored into
 *      the top-left, spanning roughly half the page.
 *   2. Brighter corner accents with a soft white glow: a corner piece
 *      (top-left), a downward spike with text (top-right), and a motif
 *      (bottom-left).
 *
 * The slow drift/pulse is disabled automatically for visitors who prefer
 * reduced motion (handled globally in globals.css).
 */

const accents = [
  { src: '/sigils/tl.svg', className: 'sigil sigil-tl' },
  { src: '/sigils/tr.svg', className: 'sigil sigil-tr' },
  { src: '/sigils/bl.svg', className: 'sigil sigil-bl' },
]

export function CyberSigils() {
  return (
    <div className="sigil-layer" aria-hidden="true">
      {/* Large faint circuit backdrop: bottom-right, plus a mirrored copy top-left */}
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

      {/* Brighter corner accents */}
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
