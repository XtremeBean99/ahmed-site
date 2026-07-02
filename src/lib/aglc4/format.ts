import type { Segment, SourceType, Values } from './types'

/**
 * Pure AGLC4 formatters. Each source type maps to a footnote and a bibliography
 * builder; both return `Segment[]` so italics survive into the UI and into the
 * clipboard (as plain text).
 *
 * These intentionally do not enforce required fields - they format whatever is
 * present, so the citation updates live as the user types.
 */

type Part = string | { i: string } | null | undefined | false

/** Compose parts into segments, dropping empties and merging adjacent runs. */
function build(parts: Part[]): Segment[] {
  const out: Segment[] = []
  for (const p of parts) {
    if (!p) continue
    const seg: Segment =
      typeof p === 'string' ? { text: p } : { text: p.i, italic: true }
    if (seg.text === '') continue
    const last = out[out.length - 1]
    if (last && !!last.italic === !!seg.italic) last.text += seg.text
    else out.push(seg)
  }
  // Trim leading/trailing whitespace on the whole citation.
  if (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, '')
    out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '')
  }
  return out.filter((s) => s.text !== '')
}

const v = (values: Values, key: string) => (values[key] ?? '').trim()

/** Reverse a single "Given Family" into "Family, Given". */
function reverseName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.trim()
  const surname = parts[parts.length - 1]
  return `${surname}, ${parts.slice(0, -1).join(' ')}`
}

/** Reverse only the first author; leave any "and …" / ", …" tail untouched. */
function reverseFirstAuthor(authors: string): string {
  const a = authors.trim()
  if (!a) return ''
  const m = a.match(/^(.*?)(\s+and\s+|,\s+)(.*)$/)
  if (!m) return reverseName(a)
  return reverseName(m[1]) + m[2] + m[3]
}

/** "(ed)" for one editor, "(eds)" when more than one is detected. */
function edLabel(editor: string): string {
  return /\s+and\s+|,/.test(editor) ? '(eds)' : '(ed)'
}

/** Comma-join the non-empty publication details inside the parentheses. */
function pubDetails(values: Values): string {
  return [v(values, 'publisher'), v(values, 'edition'), v(values, 'year')]
    .filter(Boolean)
    .join(', ')
}

interface Formatter {
  footnote: (values: Values) => Segment[]
  bibliography: (values: Values) => Segment[]
}

const FORMATTERS: Record<SourceType, Formatter> = {
  'reported-case': {
    footnote: (d) =>
      build([
        { i: v(d, 'caseName') },
        v(d, 'year') && ` (${v(d, 'year')})`,
        v(d, 'volume') && ` ${v(d, 'volume')}`,
        v(d, 'reporter') && ` ${v(d, 'reporter')}`,
        v(d, 'page') && ` ${v(d, 'page')}`,
        v(d, 'pinpoint') && `, ${v(d, 'pinpoint')}`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        { i: v(d, 'caseName') },
        v(d, 'year') && ` (${v(d, 'year')})`,
        v(d, 'volume') && ` ${v(d, 'volume')}`,
        v(d, 'reporter') && ` ${v(d, 'reporter')}`,
        v(d, 'page') && ` ${v(d, 'page')}`,
      ]),
  },
  'unreported-case': {
    footnote: (d) =>
      build([
        { i: v(d, 'caseName') },
        v(d, 'year') && ` [${v(d, 'year')}]`,
        v(d, 'court') && ` ${v(d, 'court')}`,
        v(d, 'number') && ` ${v(d, 'number')}`,
        v(d, 'pinpoint') && `, [${v(d, 'pinpoint')}]`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        { i: v(d, 'caseName') },
        v(d, 'year') && ` [${v(d, 'year')}]`,
        v(d, 'court') && ` ${v(d, 'court')}`,
        v(d, 'number') && ` ${v(d, 'number')}`,
      ]),
  },
  legislation: {
    footnote: (d) =>
      build([
        { i: [v(d, 'title'), v(d, 'year')].filter(Boolean).join(' ') },
        v(d, 'jurisdiction') && ` (${v(d, 'jurisdiction')})`,
        v(d, 'pinpoint') && ` ${v(d, 'pinpoint')}`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        { i: [v(d, 'title'), v(d, 'year')].filter(Boolean).join(' ') },
        v(d, 'jurisdiction') && ` (${v(d, 'jurisdiction')})`,
        '.',
      ]),
  },
  'delegated-legislation': {
    footnote: (d) =>
      build([
        { i: [v(d, 'title'), v(d, 'year')].filter(Boolean).join(' ') },
        v(d, 'jurisdiction') && ` (${v(d, 'jurisdiction')})`,
        v(d, 'pinpoint') && ` ${v(d, 'pinpoint')}`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        { i: [v(d, 'title'), v(d, 'year')].filter(Boolean).join(' ') },
        v(d, 'jurisdiction') && ` (${v(d, 'jurisdiction')})`,
        '.',
      ]),
  },
  'journal-article': {
    footnote: (d) =>
      build([
        v(d, 'author') && `${v(d, 'author')}, `,
        v(d, 'title') && `'${v(d, 'title')}'`,
        v(d, 'year') && ` (${v(d, 'year')})`,
        v(d, 'volume') && ` ${v(d, 'volume')}`,
        v(d, 'journal') && ' ',
        { i: v(d, 'journal') },
        v(d, 'page') && ` ${v(d, 'page')}`,
        v(d, 'pinpoint') && `, ${v(d, 'pinpoint')}`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        v(d, 'author') && `${reverseFirstAuthor(v(d, 'author'))}, `,
        v(d, 'title') && `'${v(d, 'title')}'`,
        v(d, 'year') && ` (${v(d, 'year')})`,
        v(d, 'volume') && ` ${v(d, 'volume')}`,
        v(d, 'journal') && ' ',
        { i: v(d, 'journal') },
        v(d, 'page') && ` ${v(d, 'page')}`,
      ]),
  },
  book: {
    footnote: (d) =>
      build([
        v(d, 'author') && `${v(d, 'author')}, `,
        { i: v(d, 'title') },
        pubDetails(d) && ` (${pubDetails(d)})`,
        v(d, 'pinpoint') && ` ${v(d, 'pinpoint')}`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        v(d, 'author') && `${reverseFirstAuthor(v(d, 'author'))}, `,
        { i: v(d, 'title') },
        pubDetails(d) && ` (${pubDetails(d)})`,
      ]),
  },
  'book-chapter': {
    footnote: (d) =>
      build([
        v(d, 'author') && `${v(d, 'author')}, `,
        v(d, 'chapterTitle') && `'${v(d, 'chapterTitle')}'`,
        v(d, 'editor') && ` in ${v(d, 'editor')} ${edLabel(v(d, 'editor'))},`,
        v(d, 'bookTitle') && ' ',
        { i: v(d, 'bookTitle') },
        pubDetails(d) && ` (${pubDetails(d)})`,
        v(d, 'page') && ` ${v(d, 'page')}`,
        v(d, 'pinpoint') && `, ${v(d, 'pinpoint')}`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        v(d, 'author') && `${reverseFirstAuthor(v(d, 'author'))}, `,
        v(d, 'chapterTitle') && `'${v(d, 'chapterTitle')}'`,
        v(d, 'editor') && ` in ${v(d, 'editor')} ${edLabel(v(d, 'editor'))},`,
        v(d, 'bookTitle') && ' ',
        { i: v(d, 'bookTitle') },
        pubDetails(d) && ` (${pubDetails(d)})`,
        v(d, 'page') && ` ${v(d, 'page')}`,
      ]),
  },
  web: {
    footnote: (d) =>
      build([
        v(d, 'author') && `${v(d, 'author')}, `,
        v(d, 'title') && `'${v(d, 'title')}', `,
        { i: v(d, 'website') },
        ` (Web Page${v(d, 'date') ? `, ${v(d, 'date')}` : ''})`,
        v(d, 'url') && ` <${v(d, 'url')}>`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        v(d, 'author') && `${reverseFirstAuthor(v(d, 'author'))}, `,
        v(d, 'title') && `'${v(d, 'title')}', `,
        { i: v(d, 'website') },
        ` (Web Page${v(d, 'date') ? `, ${v(d, 'date')}` : ''})`,
        v(d, 'url') && ` <${v(d, 'url')}>`,
      ]),
  },
  hansard: {
    footnote: (d) =>
      build([
        v(d, 'jurisdiction') && `${v(d, 'jurisdiction')}, `,
        { i: 'Parliamentary Debates' },
        v(d, 'chamber') && `, ${v(d, 'chamber')}`,
        v(d, 'date') && `, ${v(d, 'date')}`,
        v(d, 'page') && `, ${v(d, 'page')}`,
        v(d, 'speaker') && ` (${v(d, 'speaker')})`,
        '.',
      ]),
    bibliography: (d) =>
      build([
        v(d, 'jurisdiction') && `${v(d, 'jurisdiction')}, `,
        { i: 'Parliamentary Debates' },
        v(d, 'chamber') && `, ${v(d, 'chamber')}`,
        v(d, 'date') && `, ${v(d, 'date')}`,
        v(d, 'page') && `, ${v(d, 'page')}`,
      ]),
  },
}

export function formatFootnote(type: SourceType, values: Values): Segment[] {
  return FORMATTERS[type].footnote(values)
}

export function formatBibliography(type: SourceType, values: Values): Segment[] {
  return FORMATTERS[type].bibliography(values)
}

/** Flatten segments to plain text for the clipboard. */
export function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('')
}

/** True when a citation has meaningful content (more than a trailing full stop). */
export function hasContent(segments: Segment[]): boolean {
  return segmentsToText(segments).replace(/[.\s]/g, '').length > 0
}
