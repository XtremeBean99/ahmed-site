/**
 * Discreet cyber-sigil motifs placed in the four corners of the viewport.
 * Decorative only: inverted for the dark theme, very low opacity, behind all
 * content, and non-interactive. The slow drift animation is disabled
 * automatically for visitors who prefer reduced motion (handled in globals.css).
 */

const sigils = [
  { src: '/sigils/tl.svg', className: 'sigil sigil-tl' },
  { src: '/sigils/tr.svg', className: 'sigil sigil-tr' },
  { src: '/sigils/bl.svg', className: 'sigil sigil-bl' },
  { src: '/sigils/br.svg', className: 'sigil sigil-br' },
]

export function CyberSigils() {
  return (
    <div className="sigil-layer" aria-hidden="true">
      {sigils.map((s) => (
        // eslint-disable-next-line @next/next/no-img-element
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
    </div>
  )
}
