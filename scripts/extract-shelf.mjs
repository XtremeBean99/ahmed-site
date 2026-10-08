import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(__dirname, '..', 'assets', 'pixel-art', 'shelf')
const outputDir = join(__dirname, '..', 'public', 'room')
const shelfGamesModule = join(__dirname, '..', 'src', 'lib', 'room', 'shelf-games.ts')

async function getNonTransparentBounds(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  let left = width, top = height, right = -1, bottom = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3]
      if (alpha > 0) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }

  if (right === -1) return null
  return { left, top, right, bottom }
}

const SHELF_GAME_IDS = ['chess', 'mahjong', 'solitaire', 'blackjack', 'minesweeper', 'snake', 'breakout', 'pong']

// Each group is a rest frame plus hover-highlight frames, all drawn on the
// full 1408x768 stage canvas. Output is `<out>-1.png`, `-2.png`, ... cropped to
// the group's union bounding box.
const GROUPS = [
  { out: 'catan', sources: ['catan.png', 'catan2.png', 'catan3.png'] },
  { out: 'books', sources: ['books1.png', 'books2.png', 'books3.png'] },
  { out: 'vhs', sources: ['vhs1.png', 'vhs2.png', 'vhs3.png'] },
  // The desk games, drawn by scripts/draw-shelf-games.mjs, in render order
  // (left to right; on an overlap the later one is in front).
  ...SHELF_GAME_IDS.map((id) => ({
    out: `shelf-${id}`,
    game: id,
    sources: [`${id}.png`, `${id}2.png`, `${id}3.png`],
  })),
]

async function extractGroup(group) {
  const files = group.sources.map((f) => join(sourceDir, f))

  let unionBox = null
  for (const file of files) {
    const bounds = await getNonTransparentBounds(file)
    if (!bounds) {
      console.error(`Warning: ${file} is fully transparent`)
      continue
    }
    console.log(`${file}: bounds =`, bounds)
    if (!unionBox) {
      unionBox = { ...bounds }
    } else {
      unionBox.left = Math.min(unionBox.left, bounds.left)
      unionBox.top = Math.min(unionBox.top, bounds.top)
      unionBox.right = Math.max(unionBox.right, bounds.right)
      unionBox.bottom = Math.max(unionBox.bottom, bounds.bottom)
    }
  }

  if (!unionBox) {
    console.error('No non-transparent pixels found in any frame')
    process.exit(1)
  }

  const imgW = 1408, imgH = 768
  const pad = 2
  unionBox.left = Math.max(0, unionBox.left - pad)
  unionBox.top = Math.max(0, unionBox.top - pad)
  unionBox.right = Math.min(imgW - 1, unionBox.right + pad)
  unionBox.bottom = Math.min(imgH - 1, unionBox.bottom + pad)

  const cropW = unionBox.right - unionBox.left + 1
  const cropH = unionBox.bottom - unionBox.top + 1

  console.log(`\nUnion crop box (with ${pad}px pad):`, unionBox)
  console.log(`Crop dimensions: ${cropW} x ${cropH}`)

  for (let i = 0; i < files.length; i++) {
    const outPath = join(outputDir, `${group.out}-${i + 1}.png`)
    await sharp(files[i])
      .extract({
        left: unionBox.left,
        top: unionBox.top,
        width: cropW,
        height: cropH,
      })
      .png()
      .toFile(outPath)
    console.log(`Saved ${outPath}`)
  }

  console.log(`\n--- object registry data ---`)
  console.log(`${group.out}: { x: ${unionBox.left}, y: ${unionBox.top}, w: ${cropW}, h: ${cropH} }\n`)

  if (!group.game) return null
  return { id: group.game, x: unionBox.left, y: unionBox.top, w: cropW, h: cropH, hit: await hitPath(files[files.length - 1], unionBox, cropW, cropH) }
}

/**
 * The shelf games overlap, so each one's hotspot is its own pixels rather than
 * its box: an SVG path for CSS clip-path, local to the crop. It is the widest
 * highlight frame's alpha plus the same mask 2 px higher, so the art never
 * lifts (-2 px on hover) out from under the pointer.
 */
async function hitPath(file, box, cropW, cropH) {
  const { data, info } = await sharp(file)
    .extract({ left: box.left, top: box.top, width: cropW, height: cropH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const solid = (x, y) => y >= 0 && y < cropH && data[(y * cropW + x) * info.channels + 3] > 0
  const rows = []
  for (let y = 0; y < cropH; y++) {
    const runs = []
    for (let x = 0; x < cropW; x++) {
      if (!(solid(x, y) || solid(x, y + 2))) continue
      if (runs.length && runs[runs.length - 1][1] === x) runs[runs.length - 1][1] = x + 1
      else runs.push([x, x + 1])
    }
    rows.push(runs)
  }
  let d = ''
  for (let y = 0; y < rows.length; ) {
    // Stack identical rows into one rect.
    const key = rows[y].join()
    let n = 1
    while (y + n < rows.length && rows[y + n].join() === key) n++
    for (const [x0, x1] of rows[y]) d += `M${x0} ${y}h${x1 - x0}v${n}h${x0 - x1}z`
    y += n
  }
  return d
}

async function writeShelfGames(games) {
  const lines = games.map(
    (g) => `  { app: '${g.id}', x: ${g.x}, y: ${g.y}, w: ${g.w}, h: ${g.h},\n    hit: '${g.hit}' },`,
  )
  const src = `// Generated by scripts/extract-shelf.mjs from the art drawn by
// scripts/draw-shelf-games.mjs. Do not edit: rerun
//   node scripts/draw-shelf-games.mjs && node scripts/extract-shelf.mjs && npm run lighting
//
// Each desk game's sprite box on the stage, in render order (an object later in
// the list stands in front of the ones it overlaps), and \`hit\`, its pixel
// mask as an SVG path local to that box for CSS clip-path.

export const SHELF_GAME_SPRITES = [
${lines.join('\n')}
] as const
`
  await writeFile(shelfGamesModule, src)
  console.log(`Wrote ${shelfGamesModule}`)
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  const games = []
  for (const group of GROUPS) {
    const game = await extractGroup(group)
    if (game) games.push(game)
  }
  await writeShelfGames(games)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
