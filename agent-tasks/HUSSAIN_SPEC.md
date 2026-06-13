# HUSSAIN_SPEC.md - "Hussain" page (/hussain)

A personal page where Ahmed explains his surname: its origin in Imam Hussain
ibn Ali, the history of Karbala, what it means in Shia Islam, the ethic of
standing against oppression, and how that ethic informs his support for the
Palestinian people. This page gets its OWN visual theme: deep greens and white,
with Arabic calligraphy. It should feel like a different room of the same
house: intricate, reverent, beautiful.

## Tone and accuracy rules (read twice, these are hard constraints)

- Written in first person where personal ("My surname comes from..."), factual
  and reverent when historical. Dignified throughout.
- Historically accurate: Imam Hussain ibn Ali, grandson of Prophet Muhammad,
  refused allegiance to Yazid ibn Muawiya; was killed with family and ~72
  companions at Karbala on Ashura, 10 Muharram 61 AH (680 CE); commemorated in
  Muharram mourning and the Arbaeen pilgrimage, among the largest annual
  gatherings on earth.
- Quotes must be attributed honestly, e.g. "attributed to Imam Hussain". Use
  the famous line "Death with dignity is better than a life of humiliation"
  (attributed) and "Every day is Ashura and every land is Karbala" (a Shia
  maxim) with that framing.
- The Palestine section expresses solidarity grounded in anti-oppression and
  human dignity: support for Palestinian people, mourning of suffering, calls
  for justice. NO violent rhetoric, NO hatred of any people or faith, NO
  sectarian polemics against Sunni Islam or anyone else. The page honours a
  moral tradition; it does not attack.
- Australian English spelling. NEVER use an em dash anywhere on this page.

## Theme (scoped to this route only)

- Palette: deep green (#0c3b2e, #14532d), emerald (#10b981), ivory/white
  (#fdfdf8), restrained gold (#d4af37) for rules/ornament. Light page on dark
  green panels, unlike the rest of the site. The global teal grid background
  must be covered by this page's own full-height background.
- Typography: Arabic calligraphy via next/font Google fonts "Amiri" (body
  Arabic) and "Aref Ruqaa" (display Arabic). English text stays in the site's
  serif (Fraunces) for headings, Inter for body.
- Centrepiece: the name "حسين" rendered very large in Aref Ruqaa, white on
  green, with a fine gold rule beneath; subtitle "Hussain. It is not just a
  surname."
- Ornament: a subtle eight-pointed star / girih-style geometric pattern as a
  CSS/SVG background layer at low opacity; thin gold dividers between
  sections; generous whitespace. Intricate but never busy.
- All Arabic text wrapped in <span lang="ar" dir="rtl"> with English
  translation adjacent.

## Sections (in order)

1. The name: "حسين" centrepiece, then a short personal passage on carrying
   the name Hussain and where it comes from.
2. Who Imam Hussain was: lineage, the refusal to give allegiance to a corrupt
   ruler, the journey to Karbala.
3. Karbala and Ashura: the siege, thirst, the day itself, the survivors led by
   Zaynab bint Ali carrying the story onward. Factual, restrained, moving.
4. What it means in Shia Islam: Muharram, majalis, Arbaeen; remembrance as
   moral training, not just grief. "Every day is Ashura and every land is
   Karbala" explained: oppression must be opposed wherever and whenever.
5. The ethic: standing with the oppressed, dignity over humiliation, truth to
   power. Short, strong paragraphs.
6. Palestine: how this tradition shapes my solidarity with the Palestinian
   people; their dignity, steadfastness (sumud), and right to justice; mourning
   civilian suffering; hope for liberation and peace with dignity for all.
   First person, principled, humane.
7. Closing: a single centred line, Arabic then English, e.g. the dignity quote
   (attributed), gold rule, end.

## Build notes

- Route `src/app/hussain/page.tsx` (+ local components in the same folder if
  needed). Server component where possible; this page is mostly static prose.
- Add "Hussain" to NAV_ITEMS in Nav.tsx (after Blog, before Cooking).
- Respect prefers-reduced-motion for any reveal animations; keep them gentle
  (fades only on this page).
- `npm run build` must pass with zero errors. Update TESTING.md.
