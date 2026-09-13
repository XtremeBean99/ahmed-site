// scripts/extract-books.mjs
//
// Turns the three public-domain PDFs in assets/books/ into the page-by-page
// JSON the room's e-reader loads from public/books/.
//
// The PDFs themselves are NOT committed (see .gitignore) — they are large
// scans. Re-run this only when a source PDF changes; the JSON is the artefact
// the site ships.
//
//   npm i --no-save pdfjs-dist@4.10.38
//   node scripts/extract-books.mjs
//
// pdfjs-dist is deliberately NOT a dependency of the site: it is only needed
// for this one-off conversion. BOOKS_SRC / BOOKS_OUT override the input and
// output directories when the script is run from a scratch install.
//
// Extraction keeps the printed page as the unit: one JSON page per PDF page,
// so the reader turns pages exactly where the book does. Prose books reflow
// their lines into paragraphs (a paragraph starts where a line is indented
// past the page's left margin); verse keeps one line per line.

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceDir = process.env.BOOKS_SRC || join(__dirname, '..', 'assets', 'books')
const outputDir = process.env.BOOKS_OUT || join(__dirname, '..', 'public', 'books')

/** Same y within this many PDF units counts as one printed line. */
const ROW_TOLERANCE = 3

const BOOKS = [
  {
    id: 'moby-dick',
    file: 'moby-dick.pdf',
    title: 'Moby-Dick; or, The Whale',
    author: 'Herman Melville',
    year: '1851',
    edition: 'Volume I, Constable & Co. edition, scanned by the University of Toronto',
    mode: 'prose',
    firstPage: 31,
    lastPage: 387,
    // Running head: "LOOMINGS 3" / "4 MOBY-DICK"
    header: /^(\d+\s+)?[A-Z][A-Z'\-. ]{3,}(\s+\d+)?$/,
    heading: /^CHAPTER\s+[IVXLC]+\.?$/,
    // The chapter title sits on its own line under "CHAPTER N".
    subheading: /^[A-Z][A-Z'\-. ]{2,}$/,
    // Printer's signature marks at the foot of a page ("VOL. I. B").
    noise: /^VOL\.?\s*[IVX]+\.?(\s*[A-Z]\.?)?$/i,
  },
  {
    id: 'nineteen-eighty-four',
    file: 'nineteen-eighty-four.pdf',
    title: 'Nineteen Eighty-Four',
    author: 'George Orwell',
    year: '1949',
    edition: 'Project Gutenberg of Australia text',
    mode: 'prose',
    firstPage: 5,
    lastPage: 283,
    header: null,
    heading: /^(PART\s+(ONE|TWO|THREE)|Chapter\s+\d+|APPENDIX)$/,
    subheading: null,
  },
  {
    id: 'odyssey',
    file: 'odyssey.pdf',
    title: 'The Odyssey',
    author: 'Homer, translated by Alexander Pope',
    year: '1725',
    edition: 'Scanned by the University of California',
    mode: 'verse',
    firstPage: 13,
    lastPage: 343,
    // Running head: "BOOK II.] THE ODYSSEY. 23" and its mirror
    header: /THE\s+ODYSSEY/i,
    heading: /^(BOOK\s+[IVXL]+\.?|ARGUMENT\.?)$/,
    subheading: null,
  },
]

/** Collapse OCR spacing artefacts without touching the words themselves. */
function tidy(s) {
  return s
    .replace(/\s+/g, ' ')
    // The scans and the Gutenberg typesetting both split fi/fl ligatures.
    .replace(/([A-Za-z-])(ffi|fi|fl|ff) ([a-z])/g, '$1$2$3')
    // Space before closing punctuation: "word ;" -> "word;"
    .replace(/ ([;:,.!?])/g, '$1')
    .replace(/ ' /g, "' ")
    .trim()
}

/** One printed line: its text plus the x of its first glyph. */
function pageLines(textContent) {
  const rows = []
  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue
    const y = item.transform[5]
    let row = rows.find((r) => Math.abs(r.y - y) <= ROW_TOLERANCE)
    if (!row) {
      row = { y, items: [] }
      rows.push(row)
    }
    row.items.push({ x: item.transform[4], s: item.str })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x)
    return {
      x: row.items[0].x,
      text: tidy(row.items.map((i) => i.s).join(' ')),
    }
  }).filter((l) => l.text.length > 0)
}

/** Strip the running head and the standalone page number, returning both. */
function stripFurniture(lines, book) {
  let label = ''
  const out = [...lines]

  const takeNumber = (line) => {
    const m = line && /(\d{1,4})/.exec(line.text)
    return m ? m[1] : ''
  }

  // A chapter opener starts the page with "CHAPTER N", which also looks like a
  // running head — the heading test wins.
  const topIsHeading = out.length && book.heading && book.heading.test(out[0].text)
  if (out.length && book.header && !topIsHeading && book.header.test(out[0].text)) {
    label = takeNumber(out[0])
    out.shift()
  }
  // Page number printed alone, top or bottom.
  while (out.length && /^\d{1,4}$/.test(out[out.length - 1].text)) {
    label = label || out[out.length - 1].text
    out.pop()
  }
  while (out.length && /^\d{1,4}$/.test(out[0].text)) {
    label = label || out[0].text
    out.shift()
  }
  return { lines: book.noise ? out.filter((l) => !book.noise.test(l.text)) : out, label }
}

/** Blocks for a prose page: headings kept, body lines reflowed into paragraphs. */
function proseBlocks(lines, book) {
  const xs = lines.map((l) => l.x).sort((a, b) => a - b)
  const margin = xs.length ? xs[Math.floor(xs.length / 2)] : 0
  const blocks = []
  let current = null

  const push = () => {
    if (current && current.s.trim()) blocks.push({ t: 'p', s: tidy(current.s) })
    current = null
  }

  for (const line of lines) {
    if (book.heading && book.heading.test(line.text)) {
      push()
      blocks.push({ t: 'h', s: line.text })
      continue
    }
    // A title line is only a title when it sits directly under "CHAPTER N";
    // every other line of capitals is body text (shouted dialogue, a sign).
    const last = blocks[blocks.length - 1]
    if (
      book.subheading &&
      !current &&
      last &&
      last.t === 'h' &&
      book.heading.test(last.s) &&
      book.subheading.test(line.text) &&
      line.text.length <= 40
    ) {
      last.s = `${last.s} — ${line.text}`
      continue
    }
    const indented = line.x > margin + 6
    const previousEnded = !current || /[.!?"”']$/.test(current.s.trimEnd())
    if (!current || (indented && previousEnded)) {
      push()
      current = { s: line.text }
      continue
    }
    // De-hyphenate a word broken across the line break.
    if (/[a-z]-$/.test(current.s)) current.s = current.s.slice(0, -1) + line.text
    else current.s += ' ' + line.text
  }
  push()
  return blocks
}

/** Blocks for a verse page: one block per printed line, headings marked. */
function verseBlocks(lines, book) {
  return lines.map((line) => ({
    t: book.heading && book.heading.test(line.text) ? 'h' : 'v',
    s: line.text,
  }))
}

async function extractBook(book) {
  const data = new Uint8Array(await readFile(join(sourceDir, book.file)))
  const doc = await getDocument({ data, verbosity: 0 }).promise

  const pages = []
  const chapters = []

  for (let n = book.firstPage; n <= Math.min(book.lastPage, doc.numPages); n++) {
    const page = await doc.getPage(n)
    const { lines, label } = stripFurniture(pageLines(await page.getTextContent()), book)
    if (!lines.length) continue

    const blocks = book.mode === 'verse' ? verseBlocks(lines, book) : proseBlocks(lines, book)
    const index = pages.length
    pages.push({ label, blocks })

    for (const b of blocks) {
      if (b.t !== 'h') continue
      const last = chapters[chapters.length - 1]
      // "BOOK II." followed by "ARGUMENT." on the same page is one entry.
      if (last && last.page === index && /^BOOK/i.test(last.title)) {
        last.title = `${last.title} — ${b.s}`
      } else {
        chapters.push({ title: b.s, page: index })
      }
    }
  }

  const words = pages.reduce(
    (sum, p) => sum + p.blocks.reduce((n, b) => n + b.s.split(' ').length, 0),
    0,
  )

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    year: book.year,
    edition: book.edition,
    mode: book.mode,
    words,
    pages,
    chapters,
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  for (const book of BOOKS) {
    const out = await extractBook(book)
    const path = join(outputDir, `${book.id}.json`)
    await writeFile(path, JSON.stringify(out))
    console.log(
      `${book.id}: ${out.pages.length} pages, ${out.chapters.length} headings, ~${out.words} words -> ${path}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
