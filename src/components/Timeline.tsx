"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface TimelineEntry {
  title: string;
  subtitle: string;
  date: string;
  items: string[];
  type: "work" | "education";
}

const ENTRIES: TimelineEntry[] = [
  {
    title: "Pharmacy Assistant",
    subtitle: "Capital Chemist, Garran",
    date: "November 2022 – present",
    type: "work",
    items: [
      "Dispensary work: preparing and checking scripts alongside the pharmacists, to the letter of the regulations",
      "Helping patients at the counter, from over-the-counter advice to conversations that need real care",
      "Training and supervising newer frontline staff",
      "Stock control for scheduled medicines in a tightly regulated supply chain",
      "Billing, records and the day-to-day running of a busy suburban pharmacy",
    ],
  },
  {
    title: "PC Builder & Founder",
    subtitle: "Xtreme Builds, Canberra",
    date: "2022 – 2025",
    type: "work",
    items: [
      "Founded and operated a custom PC building business, completing over 110 builds across gaming, creative workstation, and general-purpose systems",
      "Sourced, refurbished and tested secondhand components, keeping client costs down without sacrificing reliability",
      "Designed and executed themed custom builds (Monster Energy, Hello Kitty, stock-market aesthetic) and water-cooled systems",
      "3D-printed custom accessories using Creality Ender E3 V3 and Bambu Labs P1S with AMS",
      "Managed end-to-end client relationships: consultation, specification, procurement, assembly, testing, and handover",
    ],
  },
  {
    title: "Consultant",
    subtitle: "Daydream Machine, Fyshwick",
    date: "Early 2025, invoiced July 2025",
    type: "work",
    items: [
      "End-to-end hardware consultancy for a Canberra creative learning studio supporting neurodivergent young people",
      "Architected a bespoke custom computer hardware solution and managed the full project lifecycle, from component specification and procurement through to build, deployment and handover",
    ],
  },
  {
    title: "Corporate Intern",
    subtitle: "Microsoft, Canberra",
    date: "December 2022",
    type: "work",
    items: [
      "A December placement at Microsoft's Canberra office: a short, sharp look at how a global technology company actually runs day to day",
    ],
  },
  {
    title: "Australian National University",
    subtitle: "Bachelor of Laws / Bachelor of Computing (double degree)",
    date: "February 2025 – present",
    type: "education",
    items: [
      "Integrating legal theory with computing, with a focus on artificial intelligence and its regulation.",
    ],
  },
  {
    title: "Canberra College, Phillip",
    subtitle: "Year 12, 97.0 ATAR",
    date: "",
    type: "education",
    items: [
      "English, Networking and Cybersecurity, Programming, Specialist Methods Mathematics, Physics.",
    ],
  },
];

function TimelineItem({
  entry,
  index,
  progress,
}: {
  entry: TimelineEntry;
  index: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isLeft = index % 2 === 0;

  // Animate the dot on the timeline
  const dotOpacity = useTransform(progress, [0, 0.05, 0.1], [0.3, 1, 1]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`relative flex items-start mb-16 md:mb-20 ${
        isLeft ? "md:flex-row" : "md:flex-row-reverse"
      }`}
    >
      {/* Content */}
      <div className="flex-1 md:w-1/2">
        <div
          className={`bg-surface border border-surface-border rounded-lg p-6 ${
            isLeft ? "md:mr-8" : "md:ml-8"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                entry.type === "work"
                  ? "bg-accent/10 text-accent"
                  : "bg-amber/10 text-amber"
              }`}
            >
              {entry.type === "work" ? "Work" : "Education"}
            </span>
            {entry.date && (
              <span className="text-xs text-foreground/40">{entry.date}</span>
            )}
          </div>
          <h3 className="font-serif text-xl font-bold text-foreground">
            {entry.title}
          </h3>
          <p className="text-sm text-foreground/60 mb-3">{entry.subtitle}</p>
          <ul className="space-y-2">
            {entry.items.map((item, i) => (
              <li
                key={i}
                className="text-sm text-foreground/70 flex gap-2"
              >
                <span className="text-accent mt-1 shrink-0">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Timeline dot */}
      <div className="hidden md:flex absolute left-1/2 top-8 -translate-x-1/2 items-center justify-center z-10">
        <motion.div
          className="w-3 h-3 rounded-full bg-accent"
          style={{ opacity: dotOpacity }}
        />
      </div>

      {/* Spacer for opposite side */}
      <div className="hidden md:block flex-1 md:w-1/2" />
    </motion.div>
  );
}

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Draw the line pathLength
  const pathLength = useTransform(scrollYProgress, [0, 0.8], [0, 0.95]);

  return (
    <div ref={containerRef} className="relative">
      {/* Vertical line — desktop only */}
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1 100"
          preserveAspectRatio="none"
        >
          <motion.line
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="100"
            stroke="#2dd4bf"
            strokeWidth="0.5"
            style={{ pathLength }}
          />
        </svg>
      </div>

      {/* Mobile line */}
      <div className="md:hidden absolute left-4 top-0 bottom-0 w-px">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1 100"
          preserveAspectRatio="none"
        >
          <motion.line
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="100"
            stroke="#2dd4bf"
            strokeWidth="0.5"
            style={{ pathLength }}
          />
        </svg>
      </div>

      {/* Entries */}
      <div className="md:pl-0 pl-10">
        {ENTRIES.map((entry, i) => (
          <TimelineItem
            key={i}
            entry={entry}
            index={i}
            progress={scrollYProgress}
          />
        ))}
      </div>
    </div>
  );
}
