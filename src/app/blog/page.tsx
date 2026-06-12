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

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Blog
        </h1>
        <p className="text-lg text-foreground/60 mb-12">
          Case notes, AI regulation developments, and build logs.
        </p>

        {posts.length === 0 ? (
          <p className="text-foreground/40">No posts yet.</p>
        ) : (
          <div className="grid gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-4 text-xs text-foreground/40 uppercase tracking-wider mb-2">
                  <time>{formatDate(post.createdAt)}</time>
                  <span>&middot;</span>
                  <span>{calculateReadingTime(post.contentMd)} min read</span>
                </div>
                <h2 className="font-serif text-2xl font-bold text-foreground group-hover:text-accent transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-foreground/60">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        )}
      </SectionReveal>
    </div>
  );
}
