# Task 04 — Silicon atom 3D render + explainer (`/projects/silicon`)

## Objective
Build a standalone project page featuring an **interactive, advanced 3D render of a silicon
atom**, alongside a clear explanation of silicon's role in computer hardware. This is the
flagship "law + computing" cross-over showpiece, so it must look genuinely good and stay
strictly monochrome.

## Read first
- `CLAUDE.md`, `agent-tasks/README.md`
- `src/app/projects/page.tsx` — page scaffold idiom to match
- `src/components/ui/CircuitMesh.tsx` — existing dependency-free canvas backdrop; same spirit
- `next.config.ts` — CSP. See "CSP notes" below.

## This task is authorised to add dependencies
This is the **only** task allowed to add npm packages. Add:

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

Versions must be compatible with **React 19** and **Next 15** (App Router). Use the current
`@react-three/fiber` v9+ line (v9 supports React 19). If a peer-dependency conflict appears,
resolve it properly (correct versions) — do **not** paper over it with `--force` /
`--legacy-peer-deps` without telling Pi.

## The science (get this right)
Silicon: atomic number **Z = 14**. Bohr-model electron configuration by shell:
- Shell 1 (K): **2** electrons
- Shell 2 (L): **8** electrons
- Shell 3 (M): **4** electrons  ← the 4 valence electrons that make silicon a semiconductor

Total 14 electrons. The nucleus has 14 protons (+ ~14 neutrons for the common ²⁸Si isotope).
The "4 valence electrons" point is the bridge to the hardware explanation — make it visually
prominent (e.g. the outer shell's 4 electrons rendered slightly larger / brighter, or labelled).

## Steps

1. **Create the 3D component** `src/components/projects/SiliconAtom.tsx` — a Client Component
   (`'use client'`). Build a Bohr-style atom:
   - **Nucleus:** a cluster of small spheres (protons + neutrons) or a single emissive sphere
     at the origin. Monochrome — white/zinc with a soft emissive glow.
   - **Three electron shells:** three orbital rings at increasing radii. Render the ring paths
     as faint circles (`drei` `<Line>` or a thin torus) in `~#3f3f46`/`#52525b`.
   - **Electrons:** 2 / 8 / 4 small spheres distributed evenly around shells 1/2/3. Animate them
     orbiting (each shell at a different speed) using `useFrame`. Outer-shell (valence) electrons
     subtly emphasised.
   - **Interactivity:** `OrbitControls` from `@react-three/drei` so the user can rotate/zoom.
     Disable pan; clamp zoom to sane bounds; enable gentle auto-rotate.
   - **Lighting:** a key light + ambient, tuned so everything reads as white/grey on the dark
     background. No coloured lights.
   - Tilt the whole atom group slightly so the rings aren't edge-on.

2. **Mount it without breaking SSR.** WebGL cannot run during SSR. In the page, import the
   Canvas wrapper with `next/dynamic` and `ssr: false`, and give it a fixed-height container:

   ```tsx
   // in the page (server component) OR a thin client wrapper
   const SiliconAtom = dynamic(() => import('@/components/projects/SiliconAtom').then(m => m.SiliconAtom), {
     ssr: false,
     loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-surface" />,
   })
   ```
   Note: `ssr: false` in a dynamic import must be called from a Client Component in Next 15.
   Either make a small `'use client'` wrapper `SiliconCanvas.tsx` that does the dynamic import,
   or put the `<Canvas>` directly in `SiliconAtom.tsx` (client) and dynamic-import that.
   The `<Canvas>` lives at a height like `h-[420px] md:h-[520px]` inside a
   `border border-border rounded-lg bg-surface overflow-hidden` panel.

3. **Reduced motion + no-WebGL fallback (required).**
   - If `window.matchMedia('(prefers-reduced-motion: reduce)')` matches, **do not auto-rotate
     or orbit electrons** — render the atom static (still interactive via drag is fine, but no
     looping animation).
   - Provide a graceful fallback when WebGL is unavailable: a static monochrome SVG/CSS Bohr
     diagram (nucleus + three rings + correctly-counted electron dots) so the page is never
     blank. A simple WebGL capability check, or an error boundary around the Canvas, is fine.

4. **Create the page** `src/app/projects/silicon/page.tsx` (Server Component):
   - `metadata`: `title: 'Silicon — from atom to architecture'`, a description mentioning the
     interactive 3D model and silicon's role in computing, and the canonical URL.
   - Page scaffold matching `src/app/projects/page.tsx`: `label-text` eyebrow
     ("Projects · Silicon"), serif `h1`, intro paragraph.
   - The 3D panel (the dynamic Canvas wrapper).
   - **Explainer content** below/beside the render — well-written, accurate prose in the
     site's voice. Cover, in clear sections (use `SectionReveal`, serif `h2`/`h3`, body
     `text-muted-foreground`):
     1. **Why silicon** — 4 valence electrons → forms a stable crystal lattice; a semiconductor
        (conducts between a conductor and insulator), unlike a metal or a pure insulator.
     2. **Doping** — adding tiny amounts of e.g. phosphorus (n-type, extra electrons) or boron
        (p-type, "holes") tunes conductivity; the p–n junction is the basis of the diode.
     3. **The transistor** — the MOSFET as a voltage-controlled switch; billions on a chip;
        "on/off" = the 1s and 0s of digital logic.
     4. **From sand to CPU** — silicon is refined from quartz (silicon dioxide) to ~99.9999999%
        purity, grown into a single-crystal ingot (Czochralski process), sliced into wafers,
        and patterned with photolithography into integrated circuits.
     5. A one-line tie-back to the site's theme: this physical substrate is what the law and
        governance questions ultimately run on.
   - Keep claims accurate and non-sensational; this is a credibility piece. No citations
     required, but nothing should be wrong.

5. **Performance:** keep geometry light (low-poly spheres, segment counts modest), cap the
   device pixel ratio (`<Canvas dpr={[1, 2]}>`), and ensure the render loop pauses when
   off-screen if practical (drei `<Canvas frameloop="demand">` is overkill with animation, so
   leave the default loop but keep the scene cheap). Confirm it doesn't tank the Lighthouse
   score or spike CPU.

## CSP notes (`next.config.ts`)
- `script-src 'self' 'unsafe-inline'` (no `eval`): three.js core and R3F do **not** require
  `unsafe-eval`. Do not add it.
- `img-src 'self' data: blob:`: already allows canvas/texture blobs.
- We are **not** using DRACO/Meshopt loaders or web-worker-based loaders, so no `worker-src`
  change is needed. If you somehow introduce a blob worker, stop and flag it — do not silently
  loosen the CSP.

## Constraints
- **Strictly monochrome.** White / zinc greys on `#09090b`. No coloured electrons, no blue
  glow, no green. Glow/emissive must be white. This is the easiest place to accidentally break
  the design system — don't.
- Electron counts must be exactly 2 / 8 / 4.
- Must not break SSR or the production build (`ssr: false` dynamic import).
- Reduced-motion and no-WebGL paths must both render something sensible.

## Acceptance criteria
- `/projects/silicon` renders an interactive, rotatable, monochrome 3D silicon atom with the
  correct 2/8/4 shell structure, plus an accurate written explainer.
- Page builds and type-checks; new deps installed and committed in `package.json`/lockfile.
- Reduced-motion users get a static (non-looping) render; no-WebGL users get the SVG fallback.
- Coordinate with task 07 (sitemap) and task 05 (OG image) for this route.
- `npm run type-check && npm run lint && npm run build` pass.
