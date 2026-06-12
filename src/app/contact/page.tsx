import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { SectionReveal } from "@/components/SectionReveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Ahmed Hussain — AI and law, PC builds, or collaboration.",
};

export default function ContactPage() {
  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-prose mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Contact
        </h1>
        <p className="text-lg text-foreground/70 mb-12">
          Want to talk about AI and law, or just need a PC built properly? Use
          the form below or reach me on LinkedIn.
        </p>

        <div className="mb-12 flex flex-col gap-2 text-sm text-foreground/50">
          <p>
            <span className="text-foreground/30">LinkedIn:</span>{" "}
            <a
              href="https://linkedin.com/in/ahmedyhussain"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              linkedin.com/in/ahmedyhussain
            </a>
          </p>
          <p>
            <span className="text-foreground/30">Location:</span> Canberra, ACT
          </p>
        </div>

        <ContactForm />
      </SectionReveal>
    </div>
  );
}
