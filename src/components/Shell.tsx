"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { ScrollProgress } from "./ScrollProgress";
import { LenisProvider } from "./LenisProvider";
import { TechBackground } from "./TechBackground";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <LenisProvider>
      <TechBackground />
      <ScrollProgress />
      <Nav />
      <main>{children}</main>
      <Footer />
    </LenisProvider>
  );
}
