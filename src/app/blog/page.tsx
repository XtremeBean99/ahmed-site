import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionReveal } from "@/components/SectionReveal";
import { formatDate, calculateReadingTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Writing on AI regulation, law and computing, case notes, and build logs.",
};

export const dynamic = "force-dynamic";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  // Default: show posts that aren't in the categorized sections (pc-build, cooking, misc)
  // If a tag filter is active, filter to just that tag
  const where: Record<string, unknown> = { published: true };
  if (tag) {
    where.tags = { has: tag };
  } else {
    where.NOT = { tags: { hasSome: ["pc-build", "cooking", "misc"] } };
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Get available tags from pc-build, cooking, misc only
  const availableTags = ["pc-build", "cooking", "misc"];

  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Blog
        </h1>
        <p className="text-lg text-foreground/60 mb-8">
          Case notes, AI regulation developments, build logs, and everything
          else.
        </p>

        {/* Tag filter pills */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            <Link
              href="/blog"
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                !tag
                  ? "bg-accent text-background"
                  : "bg-surface text-foreground/60 hover:text-foreground border border-surface-border"
              }`}
            >
              Writing
            </Link>
            {availableTags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  tag === t
                    ? "bg-accent text-background"
                    : "bg-surface text-foreground/60 hover:text-foreground border border-surface-border"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-foreground/40">
            {tag ? `No posts tagged "${tag}".` : "No posts yet."}
          </p>
        ) : (
          <div className="grid gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col sm:flex-row rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors overflow-hidden"
              >
                {post.coverImage && (
                  <div className="sm:w-48 shrink-0 aspect-video sm:aspect-auto overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-3 text-xs text-foreground/40 uppercase tracking-wider mb-2">
                    {post.date ? (
                      <time>
                        {new Date(post.date).toLocaleDateString("en-AU", {
                          year: "numeric",
                          month: "long",
                        })}
                      </time>
                    ) : (
                      <time>{formatDate(post.createdAt)}</time>
                    )}
                    <span>&middot;</span>
                    <span>
                      {calculateReadingTime(post.contentMd)} min read
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-foreground group-hover:text-accent transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-foreground/60">{post.excerpt}</p>
                  {post.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-3">
                      {post.tags.map((t: string) => (
                        <span
                          key={t}
                          className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent/80"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionReveal>
    </div>
  );
}
