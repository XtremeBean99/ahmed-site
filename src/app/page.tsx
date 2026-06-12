import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Hero } from "@/components/Hero";
import { SectionReveal } from "@/components/SectionReveal";
import { StatCounter } from "@/components/StatCounter";
import { ProjectCard } from "@/components/ProjectCard";
import { MagneticButton } from "@/components/MagneticButton";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [projects, posts] = await Promise.all([
    prisma.project.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 3,
    }),
    prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  return (
    <>
      <Hero />

      {/* Stats strip */}
      <SectionReveal className="max-w-grid mx-auto px-6 py-16 grid grid-cols-3 gap-8 text-center border-b border-surface-border">
        <div>
          <StatCounter end={97.0} decimals={1} suffix=" ATAR" />
          <p className="text-sm text-foreground/50 mt-2">Canberra College</p>
        </div>
        <div>
          <StatCounter end={4} suffix="+ years" />
          <p className="text-sm text-foreground/50 mt-2">At the pharmacy</p>
        </div>
        <div>
          <StatCounter end={3} suffix="+ projects" />
          <p className="text-sm text-foreground/50 mt-2">Shipped</p>
        </div>
      </SectionReveal>

      {/* About teaser */}
      <SectionReveal className="max-w-prose mx-auto px-6 py-24">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-8 text-balance">
          Law. Computing. Artificial intelligence.
        </h2>
        <p className="text-lg text-foreground/75 leading-relaxed mb-8">
          Bachelor of Laws / Bachelor of Computing student at the Australian
          National University, working at the intersection of artificial
          intelligence and the legal system. Currently a Pharmacy Assistant at
          Capital Chemist Garran, where regulation meets practice every day.
        </p>
        <div className="flex gap-4 flex-wrap">
          <MagneticButton href="/projects" variant="primary">
            View my work
          </MagneticButton>
          <MagneticButton href="/contact" variant="secondary">
            Get in touch
          </MagneticButton>
        </div>
      </SectionReveal>

      {/* Latest projects */}
      {projects.length > 0 && (
        <SectionReveal className="max-w-grid mx-auto px-6 py-24 border-t border-surface-border">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-12">
            Recent projects
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <MagneticButton href="/projects" variant="secondary">
              View all projects
            </MagneticButton>
          </div>
        </SectionReveal>
      )}

      {/* Latest PC builds */}
      <SectionReveal className="max-w-grid mx-auto px-6 py-24 border-t border-surface-border">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
          PC Builds
        </h2>
        <p className="text-foreground/60 mb-12 max-w-prose">
          From a first ever build to over 110 custom rigs. The Xtreme Builds story.
        </p>
        <MagneticButton href="/timeline" variant="primary">
          See the build timeline
        </MagneticButton>
      </SectionReveal>

      {/* Latest posts */}
      {posts.length > 0 && (
        <SectionReveal className="max-w-grid mx-auto px-6 py-24 border-t border-surface-border">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-12">
            Latest writing
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
              >
                <time className="text-xs text-foreground/40 uppercase tracking-wider">
                  {formatDate(post.createdAt)}
                </time>
                <h3 className="font-serif text-xl font-bold text-foreground mt-2 mb-2 group-hover:text-accent transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-foreground/60 line-clamp-3">
                  {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <MagneticButton href="/blog" variant="secondary">
              Read the blog
            </MagneticButton>
          </div>
        </SectionReveal>
      )}

      {/* Contact CTA */}
      <SectionReveal className="max-w-prose mx-auto px-6 py-24 text-center border-t border-surface-border">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-6">
          Let&apos;s talk
        </h2>
        <p className="text-lg text-foreground/70 mb-8">
          Want to talk about AI and law, or just need a PC built properly? Get
          in touch.
        </p>
        <MagneticButton href="/contact" variant="primary">
          Contact me
        </MagneticButton>
      </SectionReveal>
    </>
  );
}
