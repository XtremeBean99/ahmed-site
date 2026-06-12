import type { Metadata } from "next";
import { SectionReveal } from "@/components/SectionReveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Double-degree student at ANU reading Law and Computing. Pharmacy Assistant at Capital Chemist Garran.",
};

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-prose mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-12 text-balance">
          About
        </h1>

        <div className="prose-custom text-lg">
          <p>
            I am a double-degree student at the Australian National University,
            reading a Bachelor of Laws alongside a Bachelor of Computing. The
            combination is deliberate. AI systems are reshaping how legal
            decisions are made, how evidence is handled, and how regulation is
            written, and I want to be fluent on both sides of that conversation:
            the code and the law that governs it.
          </p>

          <p>
            Since November 2022 I have worked at Capital Chemist Garran as a
            Pharmacy Assistant. Pharmacy is one of the most heavily regulated
            retail environments in Australia, and the role has given me
            practical experience in dispensing under regulatory standards,
            patient-centred consultations, inventory control in a regulated
            supply chain, and supervising frontline staff. It is compliance as a
            daily practice rather than a textbook topic, and it shapes how I
            think about regulation in my legal study.
          </p>

          <p>
            Before university I graduated from Canberra College with a 97.0
            ATAR, studying programming, networking and cybersecurity, specialist
            mathematics, and physics. I have also completed a corporate
            internship at Microsoft&apos;s Canberra office and delivered an
            end-to-end hardware consultancy project for Daydream Machine, a
            creative learning studio supporting neurodivergent young people.
          </p>
        </div>
      </SectionReveal>
    </div>
  );
}
