'use client'

import { useT } from '@/lib/i18n/client'
import { BoardLegend } from './BoardLegend'
import { Tooltip } from './Tooltip'
import { Panel, PixelButton } from './ui'

export function BoardKeyPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useT()
  const d = t.catan.keyPanel

  return (
    <Panel style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <Tooltip content={d.title}>
        <PixelButton
          data-tutorial="legend"
          aria-expanded={open}
          onClick={onToggle}
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <span>{d.title}</span>
          <span aria-hidden>{open ? '-' : '+'}</span>
        </PixelButton>
      </Tooltip>
      {open ? (
        <div style={{ marginTop: 6 }}>
          <BoardLegend labels={t.catan.key} />
        </div>
      ) : null}
    </Panel>
  )
}
