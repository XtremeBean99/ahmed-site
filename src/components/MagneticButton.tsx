"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  disabled?: boolean;
}

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDist = 6;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);
      setPosition({
        x: Math.max(-maxDist, Math.min(maxDist, dx * maxDist)),
        y: Math.max(-maxDist, Math.min(maxDist, dy * maxDist)),
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  const baseClasses = cn(
    "inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 relative",
    variant === "primary" &&
      "bg-accent text-background hover:shadow-[0_0_20px_rgba(45,212,191,0.3)]",
    variant === "secondary" &&
      "border border-surface-border text-foreground hover:border-accent/50 hover:bg-surface-hover",
    disabled && "opacity-50 pointer-events-none"
  );

  const content = <span className="relative z-10">{children}</span>;

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={baseClasses}
      >
        {content}
      </button>
    </motion.div>
  );
}
