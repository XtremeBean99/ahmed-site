import type { Metadata, Viewport } from 'next'
import { CatanGame } from '@/components/catan/CatanGame'

export const metadata: Metadata = {
  title: 'Catan',
  description: 'Play pixel Catan against bots, offline in your browser.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2a2220',
}

export default function CatanPage() {
  return <CatanGame />
}
