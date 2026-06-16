import Link from 'next/link'
import { CopyrightYear } from '@/components/ui/CopyrightYear'

const footerLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/tutoring', label: 'Tutoring' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/terms', label: 'Terms of Use' },
]

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Brand */}
          <div className="space-y-2">
            <p className="font-serif text-base font-semibold text-foreground">Ahmed Hussain</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              All content on this website is copyrighted and may not be reproduced, scraped, indexed
              for AI training, or incorporated into generative AI systems without prior written
              permission.
            </p>
          </div>

          {/* Nav */}
          <nav aria-label="Footer navigation">
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
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="mailto:ahmedyhussain07@gmail.com"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-6 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © <CopyrightYear /> Ahmed Hussain. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Canberra, Australia · ahmedyhussain.com
          </p>
        </div>
      </div>
    </footer>
  )
}
