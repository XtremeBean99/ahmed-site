"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUpItem } from "@/components/SectionReveal";

interface FoodEntry {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
}

function FoodCard({ entry, index }: { entry: FoodEntry; index: number }) {
  return (
    <motion.div
      variants={fadeUpItem}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      custom={index}
    >
      <Link
        href={`/blog/${entry.slug}`}
        className="group relative block aspect-[4/3] rounded-lg overflow-hidden bg-surface"
      >
        {entry.coverImage ? (
          <img
            src={entry.coverImage}
            alt={entry.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground/20">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Text */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="font-serif text-xl font-bold text-white mb-1">
            {entry.title}
          </h3>
          <p className="text-sm text-white/70 line-clamp-2">{entry.excerpt}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export function FoodGrid({ entries }: { entries: FoodEntry[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {entries.map((entry, i) => (
        <FoodCard key={entry.id} entry={entry} index={i} />
      ))}
    </div>
  );
}
