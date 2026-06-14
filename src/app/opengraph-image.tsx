import { ImageResponse } from 'next/og'

// Branded social share image, generated at build/request time by Next.js.
// Picked up automatically for og:image (and, via twitter-image, twitter:image).
export const alt = 'Ahmed Hussain, Law, Computing and Technology'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#09090b',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: '#a1a1aa',
            fontSize: 24,
            letterSpacing: 8,
            textTransform: 'uppercase',
          }}
        >
          Canberra, Australia
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 128, fontWeight: 700, color: '#fafafa', lineHeight: 1 }}>
            Ahmed Hussain
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 36, color: '#a1a1aa', maxWidth: 920 }}>
            Law, computing, and the governance of artificial intelligence.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#52525b',
            fontSize: 24,
            borderTop: '1px solid #27272a',
            paddingTop: 32,
          }}
        >
          <div style={{ display: 'flex' }}>BCom / LLB(Hons), Australian National University</div>
          <div style={{ display: 'flex' }}>ahmedyhussain.com</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
