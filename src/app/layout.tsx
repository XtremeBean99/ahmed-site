import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
    default: "Ahmed Hussain | Law, Computing, AI",
    template: "%s | Ahmed Hussain",
  },
  description:
    "Law and computing student at ANU thinking about AI and the rules that have to govern it. Pharmacy assistant, builder of 110+ custom PCs.",
  metadataBase: new URL("https://ahmedyhussain.com"),
  openGraph: {
    title: "Ahmed Hussain | Law, Computing, AI",
    description:
      "Law and computing student at ANU thinking about AI and the rules that have to govern it. Pharmacy assistant, builder of 110+ custom PCs.",
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
        <Analytics />
      </body>
    </html>
  );
}
