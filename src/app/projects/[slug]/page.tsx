import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { prisma } from "@/lib/prisma";
import { SectionReveal } from "@/components/SectionReveal";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug, published: true },
    select: { title: true, summary: true },
  });

  if (!project) {
    return { title: "Not Found" };
  }

  return {
    title: project.title,
    description: project.summary,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug, published: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-prose mx-auto px-6">
        <header className="mb-12">
          <span className="text-xs text-foreground/30 uppercase tracking-wider">
            {project.year}
          </span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mt-2 mb-4 text-balance">
            {project.title}
          </h1>
          <p className="text-lg text-foreground/60">{project.summary}</p>
          <div className="flex flex-wrap gap-2 mt-6">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent/80"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div className="prose-custom text-lg">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {project.descriptionMd}
          </ReactMarkdown>
        </div>
      </SectionReveal>
    </div>
  );
}
