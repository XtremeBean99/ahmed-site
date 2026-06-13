/**
 * TechBackground: a site-wide, pure-CSS "engineering blueprint" layer.
 * Drifting coordinate grid, fine sub-grid, a slow scanline sweep and a
 * vignette. Zero JavaScript, zero layout cost, disabled automatically by
 * the global prefers-reduced-motion rules.
 */
export function TechBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      <div className="absolute inset-0 tech-grid" />
      <div className="absolute inset-0 tech-grid-fine" />
      <div className="tech-scanline absolute left-0 right-0 top-0" />
      <div className="absolute inset-0 tech-vignette" />
    </div>
  );
}
