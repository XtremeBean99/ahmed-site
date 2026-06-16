/**
 * JsonLd — injects Schema.org structured data via a <script type="application/ld+json">
 * block. Only pass author-controlled data (never user input).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
