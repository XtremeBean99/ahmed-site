import { ImageResponse } from 'next/og'

/**
 * Shared Open Graph / Twitter image generator matching the site monochrome
 * template: #09090b background, tracked eyebrow, large serif title, subtitle,
 * and a bottom rule with "ahmedyhussain.com".
 */
interface OgImageProps {
  eyebrow: string
  title: string
  subtitle: string
}

export function renderOgImage({ eyebrow, title, subtitle }: OgImageProps) {
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
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            color: '#a1a1aa',
            fontSize: 24,
            letterSpacing: 8,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>

        {/* Title + subtitle block */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 700,
              color: '#fafafa',
              lineHeight: 1.1,
              maxWidth: 960,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 32,
              color: '#a1a1aa',
              maxWidth: 920,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Footer */}
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
          <div style={{ display: 'flex' }}>Ahmed Hussain</div>
          <div style={{ display: 'flex' }}>ahmedyhussain.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
