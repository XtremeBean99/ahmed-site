import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionReveal } from "@/components/SectionReveal";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Projects by Ahmed Hussain: hardware consultancy, custom PC builds, and full-stack development.",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="pt-24 pb-16">
      <SectionReveal className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Projects
        </h1>
        <p className="text-lg text-foreground/60 mb-12">
          Things I&apos;ve built and shipped.
        </p>

        {projects.length === 0 ? (
          <p className="text-foreground/40">No projects yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}
      </SectionReveal>
    </div>
  );
}
