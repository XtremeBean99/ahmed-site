"use client";

import { useState, useEffect, useRef } from "react";

const CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

interface ScrambleTextProps {
  text: string;
  duration?: number;
}

export function ScrambleText({ text, duration = 800 }: ScrambleTextProps) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const chars = text.split("");
    setDisplayed(chars.map(() => getRandomChar()));

    startTimeRef.current = performance.now();

    function animate(now: number) {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const newDisplay = chars.map((target, i) => {
        // Each character resolves at a different time (stagger)
        const charStart = i * 0.05;
        const charEnd = charStart + 0.4;
        const charProgress = Math.max(
          0,
          Math.min(1, (eased - charStart) / (charEnd - charStart))
        );

        if (charProgress >= 1) return target;
        if (Math.random() < 0.3) return getRandomChar();
        return getRandomChar();
      });

      setDisplayed(newDisplay);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayed(chars);
      }
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [text, duration]);

  return <span aria-label={text}>{displayed.join("")}</span>;
}

function getRandomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}
