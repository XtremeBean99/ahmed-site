import type { Metadata } from 'next'
import { CatanGame } from '@/components/catan/CatanGame'

export const metadata: Metadata = {
  title: 'Catan',
  description: 'Play pixel Catan against bots, offline in your browser.',
}

export default function CatanPage() {
  return <CatanGame />
}
