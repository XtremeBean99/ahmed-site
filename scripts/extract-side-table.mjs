import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const bgDir = join(__dirname, '..', 'assets', 'pixel-art', 'background')

async function getBounds(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 0) {
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

const SIDE_TABLE_FRAMES = ['side-table1.png', 'side-table2.png']

// The book lying in the table's lower cubby is the guestbook. It is cut out of
// the closed-drawer frame into its own sprite (bedside-book-1..3: rest plus the
// shelf objects' two-step #f6da9c highlight), and the hole is filled with the
// cubby colours so the book can lift 2 px on hover like the shelf objects.
const BOOK_COLUMNS = { left: 741, right: 780 } // x 740 is the table's left post
const BOOK_TOP = 536
const BOOK_SEED_LIMIT = 575 // below this the cubby floor starts
const CUBBY = new Set(['5a3638', '2b141a', '2d1a20', '3e2125', '442626', '492b29'])
const HIGHLIGHT = [0xf6, 0xda, 0x9c]

/** Stage pixels of the book: per column, its top outline down to the cubby floor. */
function bookMask(data, w) {
  const key = (x, y) => {
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  const mask = new Set()
  for (let x = BOOK_COLUMNS.left; x <= BOOK_COLUMNS.right; x++) {
    // First book-coloured pixel in the column, then out through its outline.
    // The right-edge columns are outline only, so they start at their first ink.
    let y = BOOK_TOP
    while (y < BOOK_SEED_LIMIT && (CUBBY.has(key(x, y)) || key(x, y) === '000000')) y++
    if (y === BOOK_SEED_LIMIT) for (y = BOOK_TOP; key(x, y) !== '000000'; y++);
    let top = y
    while (key(x, top - 1) === '000000') top--
    for (y = top; !CUBBY.has(key(x, y)); y++) mask.add(y * w + x)
  }
  return mask
}

/** Rest + highlight frames of the book, and the table frame with the book removed. */
async function cutBook(src, imgW, imgH) {
  const { data } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const mask = bookMask(data, imgW)
  const book = Buffer.alloc(data.length)
  for (const k of mask) data.copy(book, k * 4, k * 4, k * 4 + 4)

  // Fill the hole from the nearest cubby pixel to the right on the same row.
  const table = Buffer.from(data)
  for (const k of mask) {
    const y = Math.floor(k / imgW)
    let x = (k % imgW) + 1
    while (mask.has(y * imgW + x) || !CUBBY.has([0, 1, 2].map((j) => data[(y * imgW + x) * 4 + j].toString(16).padStart(2, '0')).join(''))) x++
    data.copy(table, k * 4, (y * imgW + x) * 4, (y * imgW + x) * 4 + 4)
  }

  // Highlight rings, never left of the post, so the book still reads as behind it.
  const grow = (radius) => {
    const out = Buffer.from(book)
    for (let y = 0; y < imgH; y++) {
      for (let x = BOOK_COLUMNS.left; x < imgW; x++) {
        if (mask.has(y * imgW + x)) continue
        let hit = false
        for (let dy = -radius; dy <= radius && !hit; dy++) {
          for (let dx = -radius; dx <= radius && !hit; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= radius && mask.has((y + dy) * imgW + (x + dx))) hit = true
          }
        }
        if (hit) {
          const i = (y * imgW + x) * 4
          out[i] = HIGHLIGHT[0]
          out[i + 1] = HIGHLIGHT[1]
          out[i + 2] = HIGHLIGHT[2]
          out[i + 3] = 255
        }
      }
    }
    return out
  }
  return { table, frames: [book, grow(1), grow(2)] }
}
const CLOCK_JOB = { src: 'side-table-digital-clock-no-numbers.png', out: 'side-table-clock.png' }

async function main() {
  await mkdir(outDir, { recursive: true })
  const pad = 2
  const imgW = 1408, imgH = 768

  // Multi-frame side table: union bbox across both frames.
  const bounds = []
  for (const src of SIDE_TABLE_FRAMES) {
    const b = await getBounds(join(bgDir, src))
    if (!b) {
      console.error('No opaque pixels in', src)
      process.exitCode = 1
      continue
    }
    bounds.push(b)
  }
  const union = {
    left: Math.min(...bounds.map((b) => b.left)),
    top: Math.min(...bounds.map((b) => b.top)),
    right: Math.max(...bounds.map((b) => b.right)),
    bottom: Math.max(...bounds.map((b) => b.bottom)),
  }
  const left = Math.max(0, union.left - pad)
  const top = Math.max(0, union.top - pad)
  const right = Math.min(imgW - 1, union.right + pad)
  const bottom = Math.min(imgH - 1, union.bottom + pad)
  const w = right - left + 1
  const h = bottom - top + 1

  const raw = { raw: { width: imgW, height: imgH, channels: 4 } }
  const book = await cutBook(join(bgDir, SIDE_TABLE_FRAMES[0]), imgW, imgH)
  for (let i = 0; i < SIDE_TABLE_FRAMES.length; i++) {
    const src = i === 0 ? sharp(book.table, raw) : sharp(join(bgDir, SIDE_TABLE_FRAMES[i]))
    await src
      .extract({ left, top, width: w, height: h })
      .png()
      .toFile(join(outDir, `side-table-${i + 1}.png`))
    console.log(`side-table-${i + 1}.png: ${w}x${h} at stage (${left},${top})`)
  }

  // Bedside book: union bbox of its three frames + pad, like every multi-frame sprite.
  let bl = imgW, bt = imgH, br = -1, bb = -1
  for (const frame of book.frames) {
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        if (!frame[(y * imgW + x) * 4 + 3]) continue
        bl = Math.min(bl, x); bt = Math.min(bt, y); br = Math.max(br, x); bb = Math.max(bb, y)
      }
    }
  }
  bl -= pad; bt -= pad; br += pad; bb += pad
  for (let i = 0; i < book.frames.length; i++) {
    await sharp(book.frames[i], raw)
      .extract({ left: bl, top: bt, width: br - bl + 1, height: bb - bt + 1 })
      .png()
      .toFile(join(outDir, `bedside-book-${i + 1}.png`))
  }
  console.log(`bedside-book-1..3.png: ${br - bl + 1}x${bb - bt + 1} at stage (${bl},${bt})`)

  // Clock face (single frame, unchanged)
  const cb = await getBounds(join(bgDir, CLOCK_JOB.src))
  if (!cb) {
    console.error('No opaque pixels in', CLOCK_JOB.src)
    process.exitCode = 1
  } else {
    const cleft = Math.max(0, cb.left - pad)
    const ctop = Math.max(0, cb.top - pad)
    const cright = Math.min(imgW - 1, cb.right + pad)
    const cbottom = Math.min(imgH - 1, cb.bottom + pad)
    const cw = cright - cleft + 1
    const ch = cbottom - ctop + 1
    await sharp(join(bgDir, CLOCK_JOB.src))
      .extract({ left: cleft, top: ctop, width: cw, height: ch })
      .png()
      .toFile(join(outDir, CLOCK_JOB.out))
    console.log(`${CLOCK_JOB.out}: ${cw}x${ch} at stage (${cleft},${ctop})`)
  }
}

main().catch(console.error)
