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
                I am a double-degree student at the Australian National University pursuing a Bachelor
                of Computing alongside a Bachelor of Laws (Honours). My academic interest sits in
                the legal and ethical dimensions of artificial intelligence.
              </p>
            </SectionReveal>

            <SectionReveal delay={0.2}>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                I am interested in how legal systems adapt to fast technological change. I am
                actively working on technical and professional skills within this industry.
                Cybersecurity, privacy, and digital governance are areas I follow closely.
              </p>
            </SectionReveal>

            <SectionReveal delay={0.25}>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Outside of study I tutor senior secondary students in mathematics, physics, English,
                and legal studies. They are subjects that reward a patient, structured approach, which is the way I like to teach.
              </p>
            </SectionReveal>
          </div>

          {/* Image */}
          <SectionReveal delay={0.15} className="hidden md:block">
            <ParallaxImage
              src="/lawyer.jpg"
              alt="Legal documents and a desk, representing legal study and practice"
              className="h-[520px] rounded-lg"
            />
          </SectionReveal>

        </div>
      </div>
    </section>
  )
}
