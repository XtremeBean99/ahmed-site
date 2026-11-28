import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        // Preflight puts this on <html>. --font-sans is not defined, so text with no
        // font of its own gets the browser default: changing this changes that text.
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#09090b',
        foreground: '#fafafa',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease forwards',
      },
    },
  },
  plugins: [],
} satisfies Config
