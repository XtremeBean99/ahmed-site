import { SectionReveal } from '@/components/ui/SectionReveal'
import { ParallaxImage } from '@/components/ui/ParallaxImage'

export function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="py-32 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">

          {/* Text */}
          <div>
            <SectionReveal>
              <p className="label-text mb-6">About</p>
              <h2
                id="about-heading"
                className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight mb-8 text-balance"
              >
                Law. Computing.
                <br />
                Technology.
              </h2>
            </SectionReveal>

            <SectionReveal delay={0.1}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                I am a dual-degree student at the Australian National University pursuing a Bachelor
                of Computing alongside a Bachelor of Laws (Honours). My academic work is oriented
                toward the governance of emerging technologies — particularly the legal and ethical
                dimensions of artificial intelligence.
              </p>
            </SectionReveal>

            <SectionReveal delay={0.2}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                I am interested in how legal systems adapt to rapid technological change, and in
                building technical skills that allow me to engage with these questions from first
                principles rather than abstraction. Cybersecurity, privacy, and digital governance
                are areas I follow closely.
              </p>
            </SectionReveal>

            <SectionReveal delay={0.25}>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Outside of study, I tutor senior secondary students in mathematics, physics, English,
                and legal studies — subjects I find reward a disciplined, structured approach.
              </p>
            </SectionReveal>
          </div>

          {/* Image */}
          <SectionReveal delay={0.15} className="hidden md:block">
            <ParallaxImage
              src="/lawyer.jpg"
              alt="A lawyer reviewing documents — representing the legal practice context"
              className="h-[520px] rounded-lg"
            />
          </SectionReveal>

        </div>
      </div>
    </section>
  )
}
