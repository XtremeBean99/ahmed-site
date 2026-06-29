import Link from 'next/link'
import { CopyrightYear } from '@/components/ui/CopyrightYear'
import { getDictionary } from '@/lib/i18n/server'
import { CONTACT_EMAIL } from '@/lib/resend'

export async function Footer() {
  const t = await getDictionary()

  const footerLinks = [
    { href: '/projects', label: t.footer.projects },
    { href: '/tutoring', label: t.footer.tutoring },
    { href: '/legal/privacy', label: t.footer.privacy },
    { href: '/legal/terms', label: t.footer.terms },
  ]

  return (
    <footer className="relative z-10 border-t border-border mt-24">
      <div className="max-w-container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Brand */}
          <div className="space-y-2">
            <p className="font-serif text-base font-semibold text-foreground">Ahmed Hussain</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {t.footer.blurb}
            </p>
          </div>

          {/* Nav */}
          <nav aria-label={t.footer.nav}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2" role="list">
              {footerLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://www.linkedin.com/in/ahmed-hussain-0880ba25a/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.footer.linkedin}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.footer.email}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-6 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © <CopyrightYear /> {t.footer.rights}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.footer.location}
          </p>
        </div>
      </div>
    </footer>
  )
}
