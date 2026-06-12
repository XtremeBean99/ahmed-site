"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "motion";
import Link from "next/link";

interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  year: number;
  tags: string[];
}

interface ProjectCardProps {
  project: Project;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDeg = 6;
    const rotY = ((e.clientX - centerX) / (rect.width / 2)) * maxDeg;
    const rotX = -((e.clientY - centerY) / (rect.height / 2)) * maxDeg;
    setRotate({ x: rotX, y: rotY });
    setGlare({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotate({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50 });
    setHovered(false);
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="perspective-[800px]"
    >
      <Link href={`/projects/${project.slug}`}>
        <motion.div
          animate={{
            rotateX: rotate.x,
            rotateY: rotate.y,
            boxShadow: hovered
              ? "0 0 30px rgba(45, 212, 191, 0.15), 0 0 0 1px rgba(45, 212, 191, 0.2)"
              : "0 0 0 1px rgba(255,255,255,0.06)",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative p-6 rounded-lg bg-surface overflow-hidden cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Specular glare */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-200 rounded-lg"
            style={{
              opacity: hovered ? 0.08 : 0,
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, #2dd4bf 0%, transparent 60%)`,
            }}
          />

          <div className="relative z-10">
            <span className="text-xs text-foreground/30 uppercase tracking-wider">
              {project.year}
            </span>
            <h3 className="font-serif text-xl font-bold text-foreground mt-1 mb-2">
              {project.title}
            </h3>
            <p className="text-sm text-foreground/60 line-clamp-3 mb-4">
              {project.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
