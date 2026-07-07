/** Escape sequences that could break out of a <script> tag. */
function escapeScriptContent(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/-->/g, '--\\>')
}

/**
 * JsonLd: injects Schema.org structured data via a <script type="application/ld+json">
 * block. Only pass author-controlled data (never user input).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeScriptContent(JSON.stringify(data)) }}
    />
  )
}
