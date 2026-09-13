/**
 * The three books on the shelf. Each one is a public-domain text converted to
 * page-by-page JSON by scripts/extract-books.mjs and served from /books/.
 *
 * `hotspot` is the clickable spine, in coordinates RELATIVE to the books
 * sprite's top-left (ROOM_OBJECTS 'books' = 164, 152). The spines run left to
 * right across the sprite: Moby-Dick (teal), Nineteen Eighty-Four (brown),
 * The Odyssey (purple).
 */
export interface ShelfBook {
  id: string
  title: string
  author: string
  /** Spine colour, used for the reader's ribbon and the loading state. */
  spine: string
  hotspot: { x: number; y: number; w: number; h: number }
}

export const SHELF_BOOKS: ShelfBook[] = [
  {
    id: 'moby-dick',
    title: 'Moby-Dick; or, The Whale',
    author: 'Herman Melville',
    spine: '#00533f',
    hotspot: { x: 36, y: 9, w: 11, h: 64 },
  },
  {
    id: 'nineteen-eighty-four',
    title: 'Nineteen Eighty-Four',
    author: 'George Orwell',
    spine: '#af4400',
    hotspot: { x: 46, y: 8, w: 12, h: 85 },
  },
  {
    id: 'odyssey',
    title: 'The Odyssey',
    author: 'Homer, trans. Alexander Pope',
    spine: '#681758',
    hotspot: { x: 58, y: 12, w: 32, h: 78 },
  },
]

/** A block of text on a page: heading, paragraph, or a line of verse. */
export interface BookBlock {
  t: 'h' | 'p' | 'v'
  s: string
}

export interface BookPage {
  /** Printed page number as it appears in the book; '' when the scan lost it. */
  label: string
  blocks: BookBlock[]
}

export interface BookData {
  id: string
  title: string
  author: string
  year: string
  edition: string
  mode: 'prose' | 'verse'
  words: number
  pages: BookPage[]
  chapters: { title: string; page: number }[]
}
