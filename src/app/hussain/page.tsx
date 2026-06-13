import type { Metadata } from "next";
import { Amiri, Aref_Ruqaa } from "next/font/google";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-aref-ruqaa",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hussain",
  description:
    "The meaning behind the surname Hussain: a story of Karbala, standing against oppression, and why it still matters.",
};

export default function HussainPage() {
  return (
    <>
      {/* Scoped styles for this page only */}
      <style>{`
        .hussain-page {
          --hussain-green-deep: #0c3b2e;
          --hussain-green: #14532d;
          --hussain-emerald: #10b981;
          --hussain-ivory: #fdfdf8;
          --hussain-gold: #d4af37;
          --hussain-gold-dim: rgba(212, 175, 55, 0.25);
        }

        .hussain-page {
          background-color: var(--hussain-ivory);
          color: #1a1a1a;
          min-height: 100vh;
          position: relative;
          isolation: isolate;
          font-family: var(--font-inter), system-ui, sans-serif;
        }

        /* Girih-inspired background pattern */
        .hussain-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image:
            radial-gradient(circle at 50% 50%, transparent 0.5px, var(--hussain-gold-dim) 0.5px, var(--hussain-gold-dim) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, transparent 0.5px, rgba(20, 83, 45, 0.12) 0.5px, rgba(20, 83, 45, 0.12) 1px, transparent 1px);
          background-size: 48px 48px, 72px 72px;
          background-position: 0 0, 24px 24px;
          opacity: 0.55;
        }

        .hussain-page > * {
          position: relative;
          z-index: 1;
        }

        .hussain-hero {
          background: linear-gradient(175deg, var(--hussain-green-deep) 0%, #0a2f24 100%);
          color: var(--hussain-ivory);
        }

        .hussain-section-green {
          background-color: var(--hussain-green-deep);
          color: var(--hussain-ivory);
        }

        .hussain-section-ivory {
          background-color: var(--hussain-ivory);
          color: #1a1a1a;
        }

        .hussain-section-dark {
          background-color: #0a2f24;
          color: var(--hussain-ivory);
        }

        .hussain-gold-rule {
          width: 120px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--hussain-gold), transparent);
          border: none;
          margin: 0 auto;
        }

        .hussain-gold-rule-left {
          width: 120px;
          height: 2px;
          background: linear-gradient(90deg, var(--hussain-gold), transparent);
          border: none;
          margin: 0;
        }

        .hussain-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--hussain-gold-dim), transparent);
          border: none;
          width: 60%;
          margin: 0 auto;
        }

        .hussain-ar-display {
          font-family: var(--font-aref-ruqaa), serif;
          line-height: 1.4;
        }

        .hussain-ar-body {
          font-family: var(--font-amiri), serif;
          line-height: 1.7;
        }

        .hussain-en-heading {
          font-family: var(--font-fraunces), Georgia, serif;
        }

        .hussain-prose {
          font-family: var(--font-inter), system-ui, sans-serif;
          line-height: 1.8;
          font-size: 1.075rem;
        }

        .hussain-prose a {
          color: var(--hussain-emerald);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .hussain-prose a:hover {
          color: #059669;
        }

        .hussain-blockquote {
          border-left: 3px solid var(--hussain-gold);
          padding-left: 1.5rem;
          font-style: italic;
          color: #555;
        }
      `}</style>

      <div className={`hussain-page ${amiri.variable} ${arefRuqaa.variable}`}>
        {/* Section 1: The Name */}
        <section className="hussain-hero pt-32 pb-24 px-6 text-center">
          <div className="max-w-prose mx-auto">
            <h1 className="mb-6">
              <span
                lang="ar"
                dir="rtl"
                className="hussain-ar-display block text-7xl md:text-8xl lg:text-9xl text-[var(--hussain-ivory)]"
              >
                حسين
              </span>
            </h1>
            <hr className="hussain-gold-rule mb-6" />
            <p className="hussain-en-heading text-2xl md:text-3xl text-[var(--hussain-ivory)]/90 mb-10 text-balance">
              Hussain. It is not just a surname.
            </p>

            <div className="hussain-prose text-[var(--hussain-ivory)]/80 max-w-lg mx-auto space-y-5">
              <p>
                My surname comes from a name that has been carried across fourteen
                centuries: Hussain, the grandson of the Prophet Muhammad. Growing up,
                I understood it as a family name. As I got older, I learned the story
                behind it and understood that it is also a responsibility.
              </p>
              <p>
                This page is about where the name comes from, what happened at
                Karbala, and why that event still shapes the moral imagination of
                millions of people, including mine.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Who Imam Hussain Was */}
        <section className="hussain-section-ivory pt-24 pb-20 px-6">
          <div className="max-w-prose mx-auto">
            <h2 className="hussain-en-heading text-3xl md:text-4xl font-bold mb-8 text-balance">
              Who Imam Hussain was
            </h2>
            <hr className="hussain-gold-rule-left mb-10" />

            <div className="hussain-prose space-y-5">
              <p>
                Imam Hussain ibn Ali was the grandson of the Prophet Muhammad, the
                son of Ali ibn Abi Talib and Fatima al-Zahra. He was born in Medina
                in 4 AH (626 CE) and grew up in the household that Muslims regard as
                the closest to the Prophet.
              </p>
              <p>
                When the Umayyad caliph Yazid ibn Muawiya came to power in 680 CE,
                he demanded Hussain&apos;s oath of allegiance. Yazid represented a
                turn away from the principles of justice and consultation that had
                defined the early Islamic community. Hussain refused. He said, in
                words attributed to him: &quot;A man like me will never give
                allegiance to a man like him.&quot;
              </p>
              <p>
                That refusal set everything in motion. Hussain left Medina for Mecca,
                and from Mecca he set out toward Kufa, where supporters had written
                to him promising backing. He travelled with his family and a small
                band of companions; tradition remembers the seventy-two who stood
                and fell with him. They never reached Kufa.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Karbala and Ashura */}
        <section className="hussain-section-green pt-24 pb-20 px-6">
          <div className="max-w-prose mx-auto">
            <h2 className="hussain-en-heading text-3xl md:text-4xl font-bold text-[var(--hussain-ivory)] mb-8 text-balance">
              Karbala and Ashura
            </h2>
            <hr className="hussain-gold-rule-left mb-10" />

            <div className="hussain-prose text-[var(--hussain-ivory)]/85 space-y-5">
              <p>
                Yazid&apos;s army intercepted the caravan on the plains of Karbala,
                in present-day Iraq, on the second of Muharram, 61 AH. They cut off
                access to the Euphrates. For days, Hussain&apos;s camp, including
                women and children, suffered thirst under the desert sun.
              </p>
              <p>
                On the tenth of Muharram, Ashura, the standoff ended. The army gave
                Hussain a final ultimatum: swear allegiance or face battle. He chose
                to stand by his principles. One by one, his companions fought and
                fell. By the afternoon, Hussain himself was killed. The tents were
                burned. The women and children, including his sister Zaynab bint Ali
                and his surviving son Ali Zayn al-Abidin, were taken captive to
                Damascus.
              </p>
              <p>
                Zaynab&apos;s courage in the aftermath is part of the story that is
                often overlooked. In Yazid&apos;s own court, she spoke truth to power.
                She delivered a sermon that shamed the caliph and ensured the
                martyrdom at Karbala would not be buried. She carried the story
                onward. The Arbaeen pilgrimage, one of the largest annual gatherings
                on earth, traces its origin to the survivors&apos; return to Karbala
                forty days after Ashura.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: What It Means in Shia Islam */}
        <section className="hussain-section-ivory pt-24 pb-20 px-6">
          <div className="max-w-prose mx-auto">
            <h2 className="hussain-en-heading text-3xl md:text-4xl font-bold mb-8 text-balance">
              What it means in Shia Islam
            </h2>
            <hr className="hussain-gold-rule-left mb-10" />

            <div className="hussain-prose space-y-5">
              <p>
                For Shia Muslims, Karbala is not only a tragedy. It is a moral
                training ground. The mourning of Muharram, the majalis (gatherings),
                the retelling of the story, the tears, is understood as a way of
                internalising Hussain&apos;s stand: to feel it, not just know it.
              </p>
              <p>
                The Arbaeen pilgrimage draws millions each year to Karbala, making it
                one of the largest annual gatherings on earth. Walkers travel from
                Najaf to Karbala, about eighty kilometres, many on foot, in an act
                of remembrance and solidarity that cuts across class, ethnicity, and
                language.
              </p>
              <p>
                There is a maxim in Shia tradition: &quot;Every day is Ashura and
                every land is Karbala.&quot; It does not mean that every place is
                literally a battlefield. It means that the moral choice Hussain faced,
                to stand with the oppressed or to stay silent, to accept injustice or
                to resist it, is a choice every person faces, in every era, on
                whatever scale their life allows.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: The Ethic */}
        <section className="hussain-section-dark pt-24 pb-20 px-6">
          <div className="max-w-prose mx-auto">
            <h2 className="hussain-en-heading text-3xl md:text-4xl font-bold text-[var(--hussain-ivory)] mb-8 text-balance">
              The ethic
            </h2>
            <hr className="hussain-gold-rule-left mb-10" />

            <div className="hussain-prose text-[var(--hussain-ivory)]/85 space-y-5">
              <p>
                A line attributed to Imam Hussain captures the ethic in one sentence:
                &quot;Death with dignity is better than a life of humiliation.&quot;
                It is not a call for death. It is a call for dignity. It says that
                some things are worse than losing, and that surrendering your
                principles to power is one of them.
              </p>
              <p>
                Karbala is remembered because it was a defeat that became a victory.
                Hussain lost his life, his companions, his family. But the stand he
                took outlasted the dynasty that killed him. Yazid is a footnote.
                Hussain is remembered by millions, fourteen centuries later, because
                people recognise the shape of that choice: power on one side, truth
                on the other.
              </p>
              <p>
                The ethic is simple to state and hard to live: stand with the
                oppressed. Speak the truth even when it costs you. Do not give your
                allegiance to corruption. These are not sectarian values. They are
                human ones.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: Palestine */}
        <section className="hussain-section-ivory pt-24 pb-20 px-6">
          <div className="max-w-prose mx-auto">
            <h2 className="hussain-en-heading text-3xl md:text-4xl font-bold mb-8 text-balance">
              Palestine
            </h2>
            <hr className="hussain-gold-rule-left mb-10" />

            <div className="hussain-prose space-y-5">
              <p>
                The tradition I have described, standing with the oppressed, valuing
                dignity over power, mourning suffering and refusing to look away, is
                why I stand in solidarity with the Palestinian people.
              </p>
              <p>
                What I see in Palestine is a people who have endured dispossession,
                occupation, and siege for generations, and who have not surrendered
                their dignity. The Palestinian concept of <em>sumud</em>,
                steadfastness, is the refusal to disappear, the insistence on
                remaining rooted in your land and your identity despite every
                pressure to leave. That kind of resilience is not abstract to someone
                raised on the story of Karbala.
              </p>
              <p>
                I mourn the civilians killed: every child, every family, every life
                cut short. The scale of suffering in Gaza is a moral emergency. I
                believe the Palestinian people have a right to justice, to
                self-determination, and to live in peace and dignity on their own
                land. That belief is not against anyone. It is for a people.
              </p>
              <p>
                This is not about picking sides in a geopolitical contest. It is
                about recognising that when a people are oppressed, the moral
                question is not complicated. The question is whether you stand with
                them or you look away. Karbala answered that question for me.
              </p>
              <p>
                I hope for a future where Palestinians and Israelis both live in
                peace, security, and dignity. That future requires justice first.
                There is no peace without it.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Closing */}
        <section className="hussain-hero pt-24 pb-32 px-6 text-center">
          <div className="max-w-prose mx-auto">
            <p className="mb-6">
              <span
                lang="ar"
                dir="rtl"
                className="hussain-ar-display block text-4xl md:text-5xl text-[var(--hussain-ivory)]"
              >
                موت في عز خير من حياة في ذل
              </span>
            </p>
            <p className="hussain-en-heading text-xl md:text-2xl text-[var(--hussain-ivory)]/80 italic mb-8">
              &quot;Death with dignity is better than a life of humiliation.&quot;
            </p>
            <p className="text-sm text-[var(--hussain-ivory)]/50 mb-8">
              Attributed to Imam Hussain ibn Ali
            </p>
            <hr className="hussain-gold-rule" />
          </div>
        </section>
      </div>
    </>
  );
}
