import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
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
    default: 'Ahmed Hussain — Law, Computing & Technology',
    template: '%s | Ahmed Hussain',
  },
  description:
    'Personal website of Ahmed Hussain — BCom / LLB(Hons) candidate at the Australian National University. Operating at the intersection of law, computing, and artificial intelligence.',
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
    title: 'Ahmed Hussain — Law, Computing & Technology',
    description:
      'BCom / LLB(Hons) candidate at ANU. At the intersection of law, computing, and artificial intelligence.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ahmed Hussain — Law, Computing & Technology',
    description:
      'BCom / LLB(Hons) candidate at ANU. At the intersection of law, computing, and artificial intelligence.',
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
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
