"use client";

import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  radius: number;
}

const PARTICLE_COUNT = 120;
const CONNECTION_DIST = 120;
const CURSOR_REPEL_DIST = 150;
const CURSOR_REPEL_FORCE = 0.5;
const ACCENT_COLORS = ["#2dd4bf", "#14b8a6", "#0d9488", "#f59e0b", "#fbbf24"];

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animFrameRef = useRef<number>(0);
  const isVisibleRef = useRef(true);

  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = [];
      const cols = Math.floor(Math.sqrt(PARTICLE_COUNT * (width / height)));
      const rows = Math.floor(PARTICLE_COUNT / cols);
      const cellW = width / cols;
      const cellH = height / rows;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = cellW * col + cellW * 0.3 + Math.random() * cellW * 0.4;
        const y = cellH * row + cellH * 0.3 + Math.random() * cellH * 0.4;
        particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          baseX: x,
          baseY: y,
          radius: 1 + Math.random() * 1.5,
        });
      }

      particlesRef.current = particles;
    },
    []
  );

  const animate = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, width, height);

      // Update particles
      for (const p of particles) {
        // Return to base position
        const dx = p.baseX - p.x;
        const dy = p.baseY - p.y;
        p.vx += dx * 0.001;
        p.vy += dy * 0.001;

        // Mouse repulsion
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

        if (mdist < CURSOR_REPEL_DIST) {
          const force = (CURSOR_REPEL_DIST - mdist) / CURSOR_REPEL_DIST;
          const fx = (mdx / mdist) * force * CURSOR_REPEL_FORCE;
          const fy = (mdy / mdist) * force * CURSOR_REPEL_FORCE;
          p.vx += fx;
          p.vy += fy;
        }

        // Damping
        p.vx *= 0.95;
        p.vy *= 0.95;

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Slight drift
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;
      }

      // Draw connections
      const mouseX = mouse.x;
      const mouseY = mouse.y;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            const opacity = (1 - dist / CONNECTION_DIST) * 0.15;

            // Brighten lines near cursor
            const midX = (particles[i].x + particles[j].x) / 2;
            const midY = (particles[i].y + particles[j].y) / 2;
            const cursorDist = Math.sqrt(
              (midX - mouseX) ** 2 + (midY - mouseY) ** 2
            );
            const cursorBoost =
              cursorDist < CURSOR_REPEL_DIST
                ? 1 + (1 - cursorDist / CURSOR_REPEL_DIST) * 2
                : 1;

            ctx.strokeStyle = `rgba(45, 212, 191, ${opacity * cursorBoost})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        const mdist = Math.sqrt(
          (p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2
        );
        const glow =
          mdist < CURSOR_REPEL_DIST
            ? 1 + (1 - mdist / CURSOR_REPEL_DIST) * 1.5
            : 0.4;

        ctx.fillStyle = ACCENT_COLORS[
          Math.floor(Math.random() * ACCENT_COLORS.length)
        ];
        ctx.globalAlpha = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      initParticles(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Visibility handling
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Intersection observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting && !document.hidden;
      },
      { threshold: 0.1 }
    );
    observer.observe(canvas);

    function loop() {
      if (isVisibleRef.current) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx!.save();
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        animate(ctx!, w, h);
        ctx!.restore();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
    };
  }, [initParticles, animate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
