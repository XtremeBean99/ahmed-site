"use client";

import { useRef } from "react";
import { motion } from "motion";
import { cn } from "@/lib/utils";

interface SectionRevealProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function SectionReveal({
  children,
  className,
  staggerDelay = 0,
}: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ staggerChildren: 0.08, delayChildren: staggerDelay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export const fadeUpItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const maskRiseItem = {
  hidden: {
    opacity: 0,
    y: 40,
    clipPath: "inset(0 0 100% 0)",
  },
  visible: {
    opacity: 1,
    y: 0,
    clipPath: "inset(0 0 0% 0)",
    transition: { duration: 0.8, ease: "easeOut" },
  },
};
