"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HeroCanvas } from "./HeroCanvas";
import { ScrambleText } from "./ScrambleText";

const CYCLING_WORDS = [
  "Artificial intelligence.",
  "Regulation.",
  "Custom hardware.",
];

export function Hero() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % CYCLING_WORDS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Canvas background */}
      <HeroCanvas />

      {/* Content */}
      <div className="relative z-10 max-w-grid mx-auto px-6 text-center">
        <motion.h1
          className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-foreground tracking-tight mb-8"
          initial="hidden"
          animate="visible"
        >
          <motion.span
            className="block"
            variants={{
              hidden: { opacity: 0, y: 60, clipPath: "inset(0 0 100% 0)" },
              visible: {
                opacity: 1,
                y: 0,
                clipPath: "inset(0 0 0% 0)",
                transition: { duration: 0.8, ease: "easeOut", delay: 0.2 },
              },
            }}
          >
            Ahmed Hussain
          </motion.span>
          <motion.span
            className="block text-2xl md:text-3xl lg:text-4xl text-foreground/50 font-normal mt-4"
            variants={{
              hidden: { opacity: 0, y: 40 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: "easeOut", delay: 0.5 },
              },
            }}
          >
            Law. Computing.{" "}
            <span className="text-accent inline-block min-w-[3em] text-left">
              <ScrambleText
                text={CYCLING_WORDS[wordIndex]}
                key={wordIndex}
              />
            </span>
          </motion.span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          Bachelor of Laws / Bachelor of Computing student at the Australian
          National University, working at the intersection of artificial
          intelligence and the legal system. Currently a Pharmacy Assistant at
          Capital Chemist Garran, where regulation meets practice every day.
        </motion.p>

        <motion.div
          className="flex gap-4 justify-center flex-wrap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <Link
            href="/projects"
            className="px-6 py-3 rounded-lg bg-accent text-background font-medium text-sm hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-shadow"
          >
            View my work
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 rounded-lg border border-surface-border text-foreground font-medium text-sm hover:border-accent/50 hover:bg-surface-hover transition-all"
          >
            Get in touch
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 1.5, duration: 0.6 },
          y: { delay: 1.5, repeat: Infinity, duration: 1.5 },
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="text-foreground/30"
        >
          <path
            d="M12 5v14M5 12l7 7 7-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </section>
  );
}
