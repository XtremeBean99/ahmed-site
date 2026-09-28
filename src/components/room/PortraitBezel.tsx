import { BEZEL, type PortraitGeometry } from '@/lib/room/desk-screen'

// Sampled from desk-closeup.png: the monitor body, its lit rim and the power LED.
const BODY = '#816965'
const RIM = '#c19e8b'
const RIM_DARK = '#917a72'
const LED = '#62995a'
const LED_LIT = '#8fd07f'

/** The monitor's bezel around the portrait screen, in CSS px. Decorative. */
export function PortraitBezel({ geo }: { geo: PortraitGeometry }) {
  const sw = geo.w * geo.scale
  const sh = geo.h * geo.scale
  return (
    <div
      aria-hidden
      className="absolute pointer-events-none"
      style={{
        left: geo.left - BEZEL.side,
        top: geo.top - BEZEL.top,
        width: sw + 2 * BEZEL.side,
        height: sh + BEZEL.top + BEZEL.chin,
        boxSizing: 'border-box',
        border: '2px solid #000',
        backgroundColor: BODY,
        boxShadow: `inset 2px 2px 0 ${RIM}, inset -2px -2px 0 ${RIM_DARK}`,
      }}
    >
      {/* The black lip around the glass */}
      <div className="absolute" style={{ left: BEZEL.side - 4, top: BEZEL.top - 4, width: sw + 4, height: sh + 4, backgroundColor: '#000' }} />
      {/* Power LED in the chin, under the right of the glass like the desk art */}
      <div
        className="absolute"
        style={{ right: 16, bottom: 9, width: 12, height: 4, backgroundColor: LED, boxShadow: `0 0 0 1px #000, inset 1px 1px 0 ${LED_LIT}` }}
      />
    </div>
  )
}
