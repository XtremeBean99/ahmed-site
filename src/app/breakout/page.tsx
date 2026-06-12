import type { Metadata } from "next";
import { BreakoutGame } from "@/components/BreakoutGame";

export const metadata: Metadata = {
  title: "Breakout",
  description:
    "Xtreme Breakout: a PC-building Breakout clone. Break the bricks, build the rig.",
};

export default function BreakoutPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-grid mx-auto px-6">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
          Xtreme Breakout
        </h1>
        <p className="text-foreground/60 mb-10 max-w-prose">
          Every brick is a PC part. Build the rig by breaking it. Yes, that is
          backwards. It is more fun this way.
        </p>

        <BreakoutGame />
      </div>
    </div>
  );
}
