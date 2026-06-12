import type { Metadata } from "next";
import { Timeline } from "@/components/Timeline";

export const metadata: Metadata = {
  title: "Experience",
  description:
    "Where I have worked and studied: Capital Chemist Garran, Xtreme Builds, Microsoft Canberra, Daydream Machine, and the ANU.",
};

export default function ExperiencePage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-16 text-balance">
          Experience &amp; Education
        </h1>
        <Timeline />
      </div>
    </div>
  );
}
