import { normalizeText } from '../reader/chunker'

export function extractPlainTextFromHtml(html: string): string {
  const doc = parseHtml(html)
  doc.querySelectorAll('script, style, svg, img, nav, head, metadata, link, rt, rp').forEach((node) => node.remove())
  return normalizeText(doc.body?.textContent ?? doc.documentElement.textContent ?? '')
}

function parseHtml(html: string): Document {
  const parser = new DOMParser()
  const xhtml = parser.parseFromString(html, 'application/xhtml+xml')
  if (xhtml.querySelector('parsererror')) return parser.parseFromString(html, 'text/html')
  return xhtml
}
