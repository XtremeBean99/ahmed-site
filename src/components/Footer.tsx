"use client";

import Link from "next/link";

const SKILLS_TAGS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "AI/ML",
  "LegalTech",
  "Regulation",
  "Compliance",
  "Pharmacy",
  "Hardware",
  "PC Building",
  "Godot",
  "Linux",
  "Networking",
  "Cybersecurity",
];

export function Footer() {
  return (
    <footer className="border-t border-surface-border mt-32">
      {/* Infinite marquee */}
      <div className="overflow-hidden py-6 border-b border-surface-border">
        <div className="flex animate-marquee gap-8 whitespace-nowrap">
          {[...SKILLS_TAGS, ...SKILLS_TAGS].map((tag, i) => (
            <span
              key={i}
              className="text-xs text-foreground/30 uppercase tracking-widest font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-grid mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-foreground/40">
          &copy; {new Date().getFullYear()} Ahmed Hussain &middot; Canberra,
          Australia &middot; Built from a spec by AI agents{" "}
          <a
            href="/images/funny-random-video.mp4"
            target="_blank"
            className="text-foreground/10 hover:text-amber transition-colors cursor-default"
            title="?"
          >
            &middot;
          </a>
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="https://www.linkedin.com/in/ahmed-hussain-0880ba25a/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground/40 hover:text-accent transition-colors"
          >
            LinkedIn
          </Link>
          <Link
            href="/contact"
            className="text-sm text-foreground/40 hover:text-accent transition-colors"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
