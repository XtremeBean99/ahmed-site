import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CircuitBackdrop } from '@/components/ui/CyberSigils'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const baseUrl = 'https://ahmedyhussain.com'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Ahmed Hussain · Law, Computing & Technology',
    template: '%s | Ahmed Hussain',
  },
  description:
    'Personal website of Ahmed Hussain, a BCom / LLB(Hons) candidate at the Australian National University, working where law meets computing and the governance of artificial intelligence.',
  keywords: [
    'Ahmed Hussain',
    'Canberra tutor',
    'legal technology',
    'computing student',
    'law student',
    'ANU',
    'cybersecurity',
    'artificial intelligence',
  ],
  authors: [{ name: 'Ahmed Hussain', url: baseUrl }],
  creator: 'Ahmed Hussain',
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: baseUrl,
    siteName: 'Ahmed Hussain',
    title: 'Ahmed Hussain · Law, Computing & Technology',
    description:
      'BCom / LLB(Hons) candidate at ANU, working where law meets computing and the governance of AI.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ahmed Hussain · Law, Computing & Technology',
    description:
      'BCom / LLB(Hons) candidate at ANU, working where law meets computing and the governance of AI.',
  },
  alternates: { canonical: baseUrl },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-background focus:text-foreground focus:border focus:border-border focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <CircuitBackdrop />
        <Header />
        <main id="main-content" className="relative z-10">{children}</main>
        <Footer />
        <SpeedInsights />
      </body>
    </html>
  )
}
