import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-6xl font-bold text-foreground mb-4">
          404
        </h1>
        <p className="text-lg text-foreground/60 mb-8">
          Page not found.
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-lg bg-accent text-background font-medium text-sm hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-shadow"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
