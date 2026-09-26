'use client'

import { useT } from '@/lib/i18n/client'
import { COSTS } from '@/lib/games/catan/constants'
import type { GameState, PlayerId, ResourceCounts } from '@/lib/games/catan/types'
import type { BuildMode } from '../ActionBar'
import { fill } from '../event-text'
import { ResourceIcon } from '../ResourceIcon'
import { Tooltip } from '../Tooltip'
import { COLORS, Muted, PixelButton } from '../ui'

function CostLine({ cost }: { cost: ResourceCounts }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {(['brick', 'lumber', 'wool', 'grain', 'ore'] as const).flatMap((r) =>
        cost[r] > 0
          ? Array.from({ length: cost[r] }, (_, i) => <ResourceIcon key={`${r}-${i}`} resource={r} size={16} />)
          : [],
      )}
    </span>
  )
}

function actionTip(tip: string, cost: string | null, reason: string | null): string | null {
  const parts = [tip]
  if (cost) parts.push(cost)
  if (reason) parts.push(reason)
  return parts.join('. ')
}

export function BuildGrid({
  state,
  human,
  buildMode,
  onBuildModeChange,
  canRoad,
  canSettlement,
  canCity,
  canBuyDev,
  roadReasonText,
  settlementReasonText,
  cityReasonText,
  devReasonText,
  onBuyDev,
}: {
  state: GameState
  human: PlayerId
  buildMode: BuildMode
  onBuildModeChange: (mode: BuildMode) => void
  canRoad: boolean
  canSettlement: boolean
  canCity: boolean
  canBuyDev: boolean
  roadReasonText: string | null
  settlementReasonText: string | null
  cityReasonText: string | null
  devReasonText: string | null
  onBuyDev: () => void
}) {
  const t = useT()
  const bar = t.catan.actionBar
  const tips = t.catan.tooltips
  const l = t.catan.layout
  const me = state.players[human]
  const toggle = (mode: Exclude<BuildMode, null>) => onBuildModeChange(buildMode === mode ? null : mode)

  const cell = (props: {
    label: string
    ariaLabel: string
    cost: ResourceCounts
    piecesText: string
    reason: string | null
    selected: boolean
    disabled: boolean
    tutorialId: string
    tooltip: string | null
    onClick: () => void
    anchor?: string
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Tooltip content={props.tooltip}>
        <PixelButton
          data-tutorial={props.tutorialId}
          {...(props.anchor ? { 'data-catan-anchor': props.anchor } : {})}
          selected={props.selected}
          disabled={props.disabled}
          onClick={props.onClick}
          aria-pressed={props.selected}
          aria-label={props.ariaLabel}
          style={{
            width: '100%',
            minHeight: 56,
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 3,
            padding: '6px 8px',
            borderColor: props.selected ? COLORS.accent : undefined,
          }}
        >
          <span style={{ fontSize: 12 }}>{props.label}</span>
          <CostLine cost={props.cost} />
          <span style={{ fontSize: 10, color: COLORS.muted }}>{props.piecesText}</span>
        </PixelButton>
      </Tooltip>
      {props.reason ? <Muted style={{ lineHeight: 1.2 }}>{props.reason}</Muted> : null}
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {cell({
        label: bar.road,
        ariaLabel: bar.roadAria,
        cost: COSTS.road,
        piecesText: fill(l.piecesLeft, { n: me.roadsLeft }),
        reason: roadReasonText,
        selected: buildMode === 'road',
        disabled: !canRoad,
        tutorialId: 'build-road',
        tooltip: actionTip(tips.road, t.catan.cost.road, roadReasonText),
        onClick: () => toggle('road'),
      })}
      {cell({
        label: bar.settlement,
        ariaLabel: bar.settlementAria,
        cost: COSTS.settlement,
        piecesText: fill(l.piecesLeft, { n: me.settlementsLeft }),
        reason: settlementReasonText,
        selected: buildMode === 'settlement',
        disabled: !canSettlement,
        tutorialId: 'build-settlement',
        tooltip: actionTip(tips.settlement, t.catan.cost.settlement, settlementReasonText),
        onClick: () => toggle('settlement'),
      })}
      {cell({
        label: bar.city,
        ariaLabel: bar.cityAria,
        cost: COSTS.city,
        piecesText: fill(l.piecesLeft, { n: me.citiesLeft }),
        reason: cityReasonText,
        selected: buildMode === 'city',
        disabled: !canCity,
        tutorialId: 'build-city',
        tooltip: actionTip(tips.city, t.catan.cost.city, cityReasonText),
        onClick: () => toggle('city'),
      })}
      {cell({
        label: bar.buyDevCard,
        ariaLabel: bar.buyDevCardAria,
        cost: COSTS.devCard,
        piecesText: fill(l.deckCount, { n: state.devDeck.length }),
        reason: devReasonText,
        selected: false,
        disabled: !canBuyDev,
        tutorialId: 'buy-card',
        tooltip: actionTip(tips.buyDevCard, t.catan.cost.devCard, devReasonText),
        onClick: onBuyDev,
        anchor: 'dev-deck',
      })}
    </div>
  )
}
