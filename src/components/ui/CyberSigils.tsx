/**
 * CircuitBackdrop: static circuit-pattern SVGs rendered behind page content.
 * Used site-wide in the root layout alongside the animated CircuitMesh.
 * Size and opacity are reduced by 30% from the original values.
 */

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
