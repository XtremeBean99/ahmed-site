import type { SourceType, SourceConfig } from './types'

/**
 * Declarative field configuration per source type. Order here is the order the
 * inputs render in, and the order of `SOURCE_TYPES` is the order of the
 * selector. Each `example` is an AGLC4-correct footnote for orientation.
 */
export const SOURCES: Record<SourceType, SourceConfig> = {
  'reported-case': {
    label: 'Case - reported',
    example: 'Mabo v Queensland [No 2] (1992) 175 CLR 1, 42.',
    fields: [
      { key: 'caseName', label: 'Case name', placeholder: 'Mabo v Queensland [No 2]' },
      { key: 'year', label: 'Year', placeholder: '1992', hint: 'Round brackets are added for you.' },
      { key: 'volume', label: 'Volume', placeholder: '175' },
      { key: 'reporter', label: 'Reporter', placeholder: 'CLR' },
      { key: 'page', label: 'Starting page', placeholder: '1' },
      { key: 'pinpoint', label: 'Pinpoint', placeholder: '42', hint: 'Optional. The exact page referred to.' },
    ],
  },
  'unreported-case': {
    label: 'Case - unreported (medium neutral)',
    example: 'Smith v Jones [2010] HCA 5, [15].',
    fields: [
      { key: 'caseName', label: 'Case name', placeholder: 'Smith v Jones' },
      { key: 'year', label: 'Year', placeholder: '2010', hint: 'Square brackets are added for you.' },
      { key: 'court', label: 'Court identifier', placeholder: 'HCA' },
      { key: 'number', label: 'Judgment number', placeholder: '5' },
      { key: 'pinpoint', label: 'Pinpoint paragraph', placeholder: '15', hint: 'Optional. Rendered as [15].' },
    ],
  },
  legislation: {
    label: 'Legislation (Act)',
    example: 'Migration Act 1958 (Cth) s 5.',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Migration Act' },
      { key: 'year', label: 'Year', placeholder: '1958' },
      { key: 'jurisdiction', label: 'Jurisdiction', placeholder: 'Cth', hint: 'Cth, NSW, Vic, Qld, WA, SA, Tas, ACT, NT.' },
      { key: 'pinpoint', label: 'Pinpoint', placeholder: 's 5', hint: 'Optional. e.g. s 5, pt 3, sch 1.' },
    ],
  },
  'delegated-legislation': {
    label: 'Delegated legislation (Regulation)',
    example: 'Migration Regulations 1994 (Cth) reg 2.07.',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Migration Regulations' },
      { key: 'year', label: 'Year', placeholder: '1994' },
      { key: 'jurisdiction', label: 'Jurisdiction', placeholder: 'Cth' },
      { key: 'pinpoint', label: 'Pinpoint', placeholder: 'reg 2.07', hint: 'Optional. e.g. reg 2.07.' },
    ],
  },
  'journal-article': {
    label: 'Journal article',
    example:
      "Paul Finn, 'Statutes and the Common Law' (1992) 22 University of Western Australia Law Review 7, 12.",
    fields: [
      { key: 'author', label: 'Author(s)', placeholder: 'Paul Finn', hint: 'e.g. "Jane Doe" or "Jane Doe and John Roe".' },
      { key: 'title', label: 'Article title', placeholder: 'Statutes and the Common Law' },
      { key: 'year', label: 'Year', placeholder: '1992' },
      { key: 'volume', label: 'Volume', placeholder: '22' },
      { key: 'journal', label: 'Journal', placeholder: 'University of Western Australia Law Review' },
      { key: 'page', label: 'Starting page', placeholder: '7' },
      { key: 'pinpoint', label: 'Pinpoint', placeholder: '12', hint: 'Optional.' },
    ],
  },
  book: {
    label: 'Book',
    example: 'Peter Cane, The Anatomy of Tort Law (Hart Publishing, 1997) 25.',
    fields: [
      { key: 'author', label: 'Author(s)', placeholder: 'Peter Cane' },
      { key: 'title', label: 'Title', placeholder: 'The Anatomy of Tort Law' },
      { key: 'publisher', label: 'Publisher', placeholder: 'Hart Publishing' },
      { key: 'edition', label: 'Edition', placeholder: '2nd ed', hint: 'Optional. Omit for a first edition.' },
      { key: 'year', label: 'Year', placeholder: '1997' },
      { key: 'pinpoint', label: 'Pinpoint', placeholder: '25', hint: 'Optional.' },
    ],
  },
  'book-chapter': {
    label: 'Chapter in an edited book',
    example:
      "Jane Stapleton, 'The Golden Thread at the Heart of Tort Law' in Andrew Robertson (ed), The Goals of Private Law (Hart Publishing, 2009) 237, 240.",
    fields: [
      { key: 'author', label: 'Chapter author(s)', placeholder: 'Jane Stapleton' },
      { key: 'chapterTitle', label: 'Chapter title', placeholder: 'The Golden Thread at the Heart of Tort Law' },
      { key: 'editor', label: 'Editor(s)', placeholder: 'Andrew Robertson', hint: '"(ed)" / "(eds)" is chosen for you.' },
      { key: 'bookTitle', label: 'Book title', placeholder: 'The Goals of Private Law' },
      { key: 'publisher', label: 'Publisher', placeholder: 'Hart Publishing' },
      { key: 'edition', label: 'Edition', placeholder: '', hint: 'Optional.' },
      { key: 'year', label: 'Year', placeholder: '2009' },
      { key: 'page', label: 'Starting page', placeholder: '237' },
      { key: 'pinpoint', label: 'Pinpoint', placeholder: '240', hint: 'Optional.' },
    ],
  },
  web: {
    label: 'Internet / web page',
    example:
      "Australian Law Reform Commission, 'About Us', Australian Law Reform Commission (Web Page, 2023) <https://www.alrc.gov.au/about>.",
    fields: [
      { key: 'author', label: 'Author(s)', placeholder: 'Australian Law Reform Commission' },
      { key: 'title', label: 'Document title', placeholder: 'About Us' },
      { key: 'website', label: 'Website name', placeholder: 'Australian Law Reform Commission' },
      { key: 'date', label: 'Date', placeholder: '2023', hint: 'Optional. Full date if available.' },
      { key: 'url', label: 'URL', placeholder: 'https://www.alrc.gov.au/about' },
    ],
  },
  hansard: {
    label: 'Hansard (parliamentary debates)',
    example:
      'Commonwealth, Parliamentary Debates, House of Representatives, 26 November 2003, 23110 (Daryl Williams).',
    fields: [
      { key: 'jurisdiction', label: 'Jurisdiction', placeholder: 'Commonwealth' },
      { key: 'chamber', label: 'Chamber', placeholder: 'House of Representatives' },
      { key: 'date', label: 'Full date', placeholder: '26 November 2003' },
      { key: 'page', label: 'Page', placeholder: '23110' },
      { key: 'speaker', label: 'Speaker', placeholder: 'Daryl Williams', hint: 'Optional.' },
    ],
  },
}

/** Selector order. */
export const SOURCE_TYPES: SourceType[] = [
  'reported-case',
  'unreported-case',
  'legislation',
  'delegated-legislation',
  'journal-article',
  'book',
  'book-chapter',
  'web',
  'hansard',
]
