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
            I am in my second year of a Bachelor of Laws and a Bachelor of
            Computing at the Australian National University. People ask which
            one is the backup. Neither. The questions I find most interesting
            only exist where the two meet: who is liable when a model gives bad
            advice, what &quot;reasons for a decision&quot; means when the
            decision came out of a neural network, and how you regulate
            software that surprises its own developers.
          </p>

          <p>
            Since November 2022 I have worked behind the counter at Capital
            Chemist Garran. Pharmacy is regulation made physical. Scheduling,
            storage, recording, counselling: every script that crosses the
            counter follows rules someone wrote down, and the system works
            because a human can inspect every step. That job has taught me more
            about how regulation actually functions than most textbooks.
          </p>

          <p>
            Before uni, computers were the job. What started with pulling apart
            the family PC in 2022 became Xtreme Builds: more than 110 custom
            machines in three years, from refurbished Marketplace flips to
            themed builds nobody asked for but everyone photographed. The full
            story, including the Hello Kitty PC and the CPU that took a bath in
            banana bread batter, is on the{" "}
            <a href="/timeline">builds timeline</a>.
          </p>

          <p>
            Along the way: a 97.0 ATAR at Canberra College, a December 2022
            internship at Microsoft&apos;s Canberra office, and a hardware
            consultancy project for Daydream Machine, a creative learning
            studio in Fyshwick for neurodivergent young people. That build
            mattered more to me than most.
          </p>

          <p>
            Off the clock I cook (the blog has a whole cooking section, it is
            not just PCs) and write about AI regulation in Australia. If any of
            this overlaps with what you do, <a href="/contact">get in touch</a>.
          </p>
        </div>
      </SectionReveal>
    </div>
  );
}
