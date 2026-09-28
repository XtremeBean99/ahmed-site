'use client'

import { Component, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { ARCADE, ArcadeButton, PIXEL_FONT } from './pixel-ui'

interface AppBoundaryProps {
  children: ReactNode
  message: string
  reloadLabel: string
  desktopLabel: string
  onDesktop: () => void
}

/**
 * One desk app that fails (usually its code chunk on a flaky phone connection)
 * shows a message on the screen instead of taking the whole page down.
 */
export class AppBoundary extends Component<AppBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center"
        style={{ ...PIXEL_FONT, backgroundColor: ARCADE.paper, color: ARCADE.ink, fontSize: 11 }}
      >
        <span>{this.props.message}</span>
        <div className="flex gap-2">
          <ArcadeButton tone="dark" size="md" onClick={() => window.location.reload()}>{this.props.reloadLabel}</ArcadeButton>
          <ArcadeButton tone="cream" size="md" onClick={this.props.onDesktop}>{this.props.desktopLabel}</ArcadeButton>
        </div>
      </div>
    )
  }
}

/** Shown while a desk app's code loads. */
export function AppLoading() {
  const label = useT().desk.appLoading
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ ...PIXEL_FONT, backgroundColor: ARCADE.paper, color: ARCADE.inkSoft, fontSize: 11 }}
    >
      {label}
    </div>
  )
}
