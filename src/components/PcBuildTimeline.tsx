"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";

interface TimelineEntry {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  date: Date | null;
  tags: string[];
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const displayDate = entry.date
    ? new Date(entry.date).toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="relative pl-8 md:pl-12 pb-12"
    >
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-accent z-10" />

      {/* Date label */}
      {displayDate && (
        <span className="text-xs text-accent font-medium uppercase tracking-widest mb-3 block">
          {displayDate}
        </span>
      )}

      {/* Card */}
      <Link
        href={`/blog/${entry.slug}`}
        className="group block bg-surface border border-surface-border rounded-lg overflow-hidden hover:bg-surface-hover transition-colors"
      >
        <div className="flex flex-col sm:flex-row">
          {/* Cover image */}
          {entry.coverImage && (
            <div className="sm:w-48 shrink-0 aspect-video sm:aspect-auto overflow-hidden">
              <img
                src={entry.coverImage}
                alt={entry.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          )}

          {/* Text */}
          <div className="p-5">
            <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors mb-2">
              {entry.title}
            </h3>
            <p className="text-sm text-foreground/60 line-clamp-2">
              {entry.excerpt}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PcBuildTimeline({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  return (
    <div className="relative max-w-2xl mx-auto">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-2 bottom-0 w-px bg-surface-border" />

      {entries.map((entry) => (
        <TimelineCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
