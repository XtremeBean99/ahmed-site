import type { Metadata } from 'next'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { SiliconCanvas } from '@/components/projects/SiliconCanvas'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Silicon — from atom to architecture',
  description:
    'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
  alternates: { canonical: 'https://ahmedyhussain.com/projects/silicon' },
}

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Silicon — from atom to architecture',
  description:
    'An interactive 3D model of a silicon atom, with an explainer on how its four valence electrons end up running every computer.',
  url: 'https://ahmedyhussain.com/projects/silicon',
  isPartOf: { '@type': 'WebSite', name: 'Ahmed Hussain', url: 'https://ahmedyhussain.com' },
  author: { '@type': 'Person', name: 'Ahmed Hussain' },
}

export default function SiliconPage() {
  return (
    <div className="pt-32 pb-24">
      <JsonLd data={webpageSchema} />
      <div className="max-w-container mx-auto px-6">
        {/* Header */}
        <SectionReveal>
          <p className="label-text mb-6">Projects · Silicon</p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6 text-balance max-w-3xl">
            Silicon — from atom to architecture
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-4">
            An interactive 3D Bohr model of a silicon atom — atomic number 14, with
            2 electrons in its first shell, 8 in the second, and 4 in the third. Drag
            to rotate, scroll to zoom. It is those four valence electrons that make
            silicon more than just the 14th element: they are the reason every modern
            processor exists.
          </p>
        </SectionReveal>

        {/* 3D Render */}
        <SectionReveal delay={0.08}>
          <div className="mt-12">
            <SiliconCanvas />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Drag to rotate · Scroll to zoom · Reduced-motion users see a static render
            </p>
          </div>
        </SectionReveal>

        {/* Explainer */}
        <div className="mt-20 max-w-2xl space-y-16">
          {/* 1. Why Silicon */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Why silicon
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Silicon sits in group 14 of the periodic table, right below carbon. It has
              four electrons in its outermost shell — exactly the number needed to form
              four covalent bonds and lock into a stable, repeating crystal lattice. Unlike
              a metal (which conducts electricity freely) or an insulator (which blocks it
              entirely), pure silicon is a <strong className="text-foreground font-medium">semiconductor</strong>:
              it conducts electricity only when given a nudge.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              That in-between behaviour is what makes it controllable. Apply a voltage, and
              it switches from off to on. Remove the voltage, and it switches back. That
              switch — the binary state — is the physical basis for every logical 1 and 0
              in digital computing.
            </p>
          </SectionReveal>

          {/* 2. Doping */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Doping: tuning the conductivity
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Pure silicon is not very conductive on its own. The trick is{' '}
              <strong className="text-foreground font-medium">doping</strong>: introducing
              a tiny number of impurity atoms into the crystal.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Add phosphorus (five valence electrons) and you get{' '}
              <strong className="text-foreground font-medium">n-type</strong> silicon, which
              has spare electrons ready to move. Add boron (three valence electrons) and you
              get <strong className="text-foreground font-medium">p-type</strong> silicon,
              which has &ldquo;holes&rdquo; — gaps where an electron is missing — that
              behave like positive charge carriers.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Place a piece of n-type silicon next to a piece of p-type silicon and you have
              a <strong className="text-foreground font-medium">p–n junction</strong>, the
              building block of the diode. Current flows in one direction and is blocked in
              the other. Stack three layers — p–n–p or n–p–n — and you have the basis of the
              transistor.
            </p>
          </SectionReveal>

          {/* 3. The Transistor */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              The transistor
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              The modern transistor — the{' '}
              <strong className="text-foreground font-medium">MOSFET</strong>{' '}
              (Metal-Oxide-Semiconductor Field-Effect Transistor) — is a voltage-controlled
              switch. A small voltage applied to the &ldquo;gate&rdquo; terminal creates an
              electric field that opens or closes a conductive channel between the
              &ldquo;source&rdquo; and &ldquo;drain.&rdquo; No mechanical parts, no moving
              pieces — just a field and a semiconductor channel.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              A single modern CPU contains billions of these switches, fabricated at a scale
              measured in nanometres. Each one flips on and off billions of times per second.
              Those on/off states — aggregated across billions of transistors — are the 1s
              and 0s of digital logic. Every line of code you write eventually resolves to
              voltages across MOSFET gates.
            </p>
          </SectionReveal>

          {/* 4. From Sand to CPU */}
          <SectionReveal delay={0.1}>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-4">
              From sand to CPU
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Silicon does not come out of the ground ready for a logic gate. The journey
              from raw material to integrated circuit is one of the most precise
              manufacturing processes ever devised.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed text-sm">
              <li>
                <strong className="text-foreground font-medium">Refinement.</strong>{' '}
                Quartz (silicon dioxide, SiO₂) is reduced with carbon in an arc furnace to
                produce metallurgical-grade silicon, then further purified to electronic-grade
                — 99.9999999% pure.
              </li>
              <li>
                <strong className="text-foreground font-medium">Crystal growth.</strong>{' '}
                The{' '}
                <strong className="text-foreground font-medium">Czochralski process</strong>{' '}
                draws a single-crystal ingot from a melt — a flawless cylinder of silicon
                atoms in a perfect lattice, up to 300 mm across and a metre long.
              </li>
              <li>
                <strong className="text-foreground font-medium">Wafers.</strong> The ingot
                is sliced into wafers thinner than a human hair, polished to a mirror finish.
              </li>
              <li>
                <strong className="text-foreground font-medium">Photolithography.</strong>{' '}
                A light-sensitive resist is applied, exposed through a mask that carries the
                circuit pattern, and developed. Unprotected silicon is etched away. The
                process is repeated dozens of times, layer upon layer, to build up the
                transistors, interconnects, and isolation structures.
              </li>
              <li>
                <strong className="text-foreground font-medium">Packaging.</strong> The
                finished die is cut from the wafer, bonded to a substrate, and sealed in a
                package with electrical contacts — the black rectangle we recognise as a
                chip.
              </li>
            </ul>
          </SectionReveal>

          {/* 5. Tie-back */}
          <SectionReveal delay={0.1}>
            <div className="border-t border-border pt-8">
              <p className="label-text mb-3">Why this matters here</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every question of AI governance, every cybersecurity regulation, every
                dispute over data sovereignty — they all ultimately run on this physical
                substrate. A silicon atom, doped and patterned, switches on and off a
                few billion times a second. Understanding that layer, however briefly, is
                part of understanding the law that will govern it.
              </p>
            </div>
          </SectionReveal>
        </div>
      </div>
    </div>
  )
}
