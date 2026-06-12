import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { prisma } from "@/lib/prisma";
import { formatDate, calculateReadingTime } from "@/lib/utils";
import { BlogReadingProgress } from "@/components/BlogReadingProgress";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug, published: true },
    select: { title: true, excerpt: true },
  });

  if (!post) {
    return { title: "Not Found" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug, published: true },
  });

  if (!post) {
    notFound();
  }

  const readingTime = calculateReadingTime(post.contentMd);

  return (
    <div className="pt-24 pb-16">
      <BlogReadingProgress />

      <article className="max-w-prose mx-auto px-6">
        <header className="mb-12">
          <div className="flex items-center gap-4 text-sm text-foreground/40 mb-4">
            <time>{formatDate(post.createdAt)}</time>
            <span>&middot;</span>
            <span>{readingTime} min read</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground text-balance">
            {post.title}
          </h1>
        </header>

        <div className="prose-custom text-lg">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {post.contentMd}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
