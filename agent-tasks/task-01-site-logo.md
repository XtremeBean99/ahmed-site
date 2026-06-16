# Task 01 — Site logo

## Objective
Wire the new logo into the site. Today the header brand is plain text ("Ahmed Hussain").
Replace it with the logo image (kept monochrome), and reuse the logo for the favicon and
social images where sensible.

## Read first
- `CLAUDE.md` (monochrome constraint)
- `agent-tasks/README.md`
- `src/components/layout/Header.tsx` — the brand link is lines ~74–81
- `src/app/layout.tsx` — root metadata + `<html>`/`<body>`
- `public/favicon.svg` — current favicon

## Current state
- The logo file has been added to the **repo root** as `site-logo.jpg` (~173 KB).
  It is NOT yet in `public/` and is NOT referenced anywhere.
- `Header.tsx` brand is a text `<Link href="/">Ahmed Hussain</Link>`.

## Steps

1. **Move the asset into `public/`.** Move `site-logo.jpg` → `public/site-logo.jpg`.
   (Do not leave the copy at the repo root.) If the image is large or not square, also
   produce a sensibly sized version — a header logo only needs to render ~32–40px tall, so
   a width of ~320–480px is plenty. Keep the original aspect ratio. If you optimise/resize,
   keep the filename `site-logo.jpg` (or `.webp`/`.png` if that compresses better) and update
   all references.

2. **Check the logo is monochrome.** Open/inspect it. If it has any colour, it must render
   greyscale to respect the design system. Apply Tailwind `grayscale` (and, if it reads better
   on the dark background, `brightness-0 invert` for a pure-white treatment — pick whichever
   keeps it legible on `#09090b`). State which treatment you chose in your report.

3. **Use it in the header.** In `Header.tsx`, replace the text brand with a logo + (optional)
   wordmark. Keep it a `Link href="/"` with `aria-label="Ahmed Hussain, home"`. Use
   `next/image` for optimisation. Constrain height to fit the 16-tall (`h-16`) nav bar.
   Example shape (adapt to the real aspect ratio):

   ```tsx
   import Image from 'next/image'
   // ...
   <Link
     href="/"
     className="flex items-center gap-2.5 group"
     aria-label="Ahmed Hussain, home"
   >
     <Image
       src="/site-logo.jpg"
       alt=""                 /* decorative; the link is labelled */
       width={36}
       height={36}
       priority
       className="h-8 w-auto grayscale"
     />
     {/* keep the wordmark for clarity unless the logo already contains the name */}
     <span className="font-serif text-lg font-semibold text-foreground group-hover:text-muted-foreground transition-colors">
       Ahmed Hussain
     </span>
   </Link>
   ```

   - If the logo already contains the full name, drop the `<span>` wordmark to avoid duplication.
   - Preserve all existing header behaviour (scroll state, mobile drawer, focus trap). Only the
     brand element changes.

4. **Favicon (optional but recommended).** Current favicon is `public/favicon.svg`. If the
   logo works as a small mark, you may add it as an additional icon. Next.js picks up
   `src/app/icon.(png|svg)` and `src/app/apple-icon.png` automatically. If you add these, keep
   them monochrome. Do **not** delete `favicon.svg` unless you replace it with an equivalent.
   If the logo is too detailed to read at 32px, leave the favicon as-is and say so.

5. **Do not** change OG image generation here — that is task 05. (If task 05 wants the logo in
   the OG image it will read `public/site-logo.*`.)

## Constraints
- Monochrome only.
- `next/image` requires explicit `width`/`height` (or `fill`). Provide the real intrinsic
  dimensions or it will warn/error.
- Decorative image inside a labelled link → `alt=""`. If the logo stands alone with no
  wordmark and no `aria-label`, give it a real `alt="Ahmed Hussain"`.

## Acceptance criteria
- `site-logo.jpg` no longer sits at the repo root; it lives in `public/`.
- Header shows the logo, monochrome, correctly sized, on both desktop and mobile.
- Logo links home and is keyboard-focusable with an accessible name.
- `npm run type-check && npm run lint && npm run build` all pass.
- No colour introduced; no layout regression in the header.
