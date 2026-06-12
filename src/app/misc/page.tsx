import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SectionReveal } from "@/components/SectionReveal";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Misc",
  description: "Random things — a car, a poster, a video. The stuff that doesn't fit anywhere else.",
};

export const dynamic = "force-dynamic";

export default async function MiscPage() {
  const items = await prisma.post.findMany({
    where: { published: true, tags: { has: "misc" } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Misc
        </h1>
        <p className="text-lg text-foreground/60 mb-12 max-w-prose">
          Cars, posters, and things that don&apos;t fit neatly into a category.
        </p>

        {items.length === 0 ? (
          <p className="text-foreground/40">Nothing here yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/blog/${item.slug}`}
                className="group block bg-surface border border-surface-border rounded-lg overflow-hidden hover:bg-surface-hover transition-colors"
              >
                {item.coverImage && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-foreground/60 line-clamp-2">
                    {item.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionReveal>
    </div>
  );
}
