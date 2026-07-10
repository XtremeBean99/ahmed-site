import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CircuitMesh } from '@/components/ui/CircuitMesh'
import { CircuitBackdrop } from '@/components/ui/CyberSigils'
import { getDictionary } from '@/lib/i18n/server'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const dict = await getDictionary()

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-background focus:text-foreground focus:border focus:border-border focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
      >
        {dict.nav.skip}
      </a>
      <CircuitBackdrop />
      <CircuitMesh />
      <Header />
      <main id="main-content" className="relative z-10">{children}</main>
      <Footer />
    </>
  )
}
