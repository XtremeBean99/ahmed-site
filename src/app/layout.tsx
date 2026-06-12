import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ahmed Hussain — Law, Computing & AI",
    template: "%s — Ahmed Hussain",
  },
  description:
    "Law and computing student at ANU, working at the intersection of artificial intelligence and the legal system.",
  metadataBase: new URL("https://ahmedyhussain.com"),
  openGraph: {
    title: "Ahmed Hussain — Law, Computing & AI",
    description:
      "Law and computing student at ANU, working at the intersection of artificial intelligence and the legal system.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
