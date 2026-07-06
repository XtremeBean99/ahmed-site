import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const roomDir = join(__dirname, '..', 'public', 'room')

async function main() {
  const bg = await sharp(join(roomDir, 'background.png')).toBuffer()

  // Monitor placement - we need to position it on the desk
  // The desk surface right of the lamp. Let's try roughly x=350, y=280
  const monitorOff = await sharp(join(roomDir, 'monitor-off.png')).toBuffer()
  const monMeta = await sharp(monitorOff).metadata()

  // Poster placement from the extraction script
  const posterX = 997, posterY = 78
  const poster1 = await sharp(join(roomDir, 'poster-1.png')).toBuffer()

  // Try a few monitor positions
  const positions = [
    { x: 350, y: 260, label: 'pos1' },
    { x: 380, y: 250, label: 'pos2' },
    { x: 330, y: 270, label: 'pos3' },
  ]

  for (const pos of positions) {
    await sharp(bg)
      .composite([
        { input: monitorOff, top: pos.y, left: pos.x },
        { input: poster1, top: posterY, left: posterX },
      ])
      .png()
      .toFile(join(roomDir, `preview-${pos.label}.png`))
    console.log(`Created preview-${pos.label}.png (monitor at ${pos.x},${pos.y})`)
  }
}

main().catch(console.error)
