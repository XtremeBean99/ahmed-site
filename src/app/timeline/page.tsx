import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PcBuildTimeline } from "@/components/PcBuildTimeline";

export const metadata: Metadata = {
  title: "PC Builds",
  description:
    "From a torn-apart family PC to 110+ custom rigs: the Xtreme Builds story, one build at a time.",
};

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const builds = await prisma.post.findMany({
    where: { published: true, tags: { has: "pc-build" } },
    orderBy: { date: "asc" },
  });

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          PC Builds
        </h1>
        <p className="text-lg text-foreground/60 mb-12 max-w-prose">
          From a torn-apart family PC in 2022 to over 110 custom builds. This is
          the story of Xtreme Builds, one rig at a time.
        </p>

        {builds.length === 0 ? (
          <p className="text-foreground/40">No builds recorded yet.</p>
        ) : (
          <PcBuildTimeline entries={builds} />
        )}
      </div>
    </div>
  );
}
