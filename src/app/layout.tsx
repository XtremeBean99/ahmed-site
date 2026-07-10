import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import localFont from 'next/font/local'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { I18nProvider } from '@/lib/i18n/client'
import { MotionProvider } from '@/components/providers/MotionProvider'
import { getDictionary } from '@/lib/i18n/server'
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

const minecraft = localFont({
  src: '../fonts/Minecraft.ttf',
  variable: '--font-pixel',
  display: 'swap',
  preload: false,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dict = await getDictionary()

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${minecraft.variable}`}>
      <body>
        <I18nProvider locale="en" dict={dict}>
          <MotionProvider>{children}</MotionProvider>
        </I18nProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
