"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";

interface StatCounterProps {
  end: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}

export function StatCounter({
  end,
  decimals = 0,
  suffix = "",
  prefix = "",
}: StatCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const duration = 1500;
    const steps = 60;
    const increment = end / steps;
    let current = 0;
    const interval = duration / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setDisplayed(end);
        clearInterval(timer);
      } else {
        setDisplayed(current);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [inView, end]);

  return (
    <motion.span
      ref={ref}
      className="font-serif text-3xl md:text-4xl font-bold text-accent tabular-nums"
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
    >
      {prefix}
      {displayed.toFixed(decimals)}
      {suffix}
    </motion.span>
  );
}
