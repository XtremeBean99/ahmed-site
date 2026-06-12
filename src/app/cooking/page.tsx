import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { FoodGrid } from "@/components/FoodGrid";

export const metadata: Metadata = {
  title: "Cooking",
  description:
    "A casual collection of things I've cooked and baked. No recipes, no measurements — just good food.",
};

export const dynamic = "force-dynamic";

export default async function CookingPage() {
  const foods = await prisma.post.findMany({
    where: { published: true, tags: { has: "cooking" } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Cooking
        </h1>
        <p className="text-lg text-foreground/60 mb-12 max-w-prose">
          I mostly cook to eat. No formal recipes, no precise measurements — just
          things I&apos;ve made along the way. An ongoing random hobby.
        </p>

        {foods.length === 0 ? (
          <p className="text-foreground/40">Nothing here yet.</p>
        ) : (
          <FoodGrid entries={foods} />
        )}
      </div>
    </div>
  );
}
