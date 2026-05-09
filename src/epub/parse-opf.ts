export type OpfManifestItem = {
  id: string
  href: string
  mediaType: string
  properties: string
}

export type OpfDocument = {
  title: string
  manifest: Map<string, OpfManifestItem>
  spine: string[]
}

export function parseContainerXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const rootfile = Array.from(doc.getElementsByTagName('*')).find((node) => node.localName === 'rootfile')
  const fullPath = rootfile?.getAttribute('full-path')
  if (!fullPath) throw new Error('EPUB container.xml does not include a rootfile full-path')
  return fullPath
}

export function parseOpf(xml: string): OpfDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const titleNode = Array.from(doc.getElementsByTagName('*')).find((node) => node.localName === 'title')
  const manifest = new Map<string, OpfManifestItem>()

  for (const item of Array.from(doc.getElementsByTagName('*')).filter((node) => node.localName === 'item')) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (!id || !href) continue
    manifest.set(id, {
      id,
      href,
      mediaType: item.getAttribute('media-type') ?? '',
      properties: item.getAttribute('properties') ?? '',
    })
  }

  const spine = Array.from(doc.getElementsByTagName('*'))
    .filter((node) => node.localName === 'itemref')
    .map((node) => node.getAttribute('idref'))
    .filter((idref): idref is string => Boolean(idref))

  return {
    title: titleNode?.textContent?.trim() || 'Untitled EPUB',
    manifest,
    spine,
  }
}

export function resolveZipPath(baseFile: string, href: string): string {
  const baseParts = baseFile.split('/').slice(0, -1)
  const parts = [...baseParts, ...href.split('/')]
  const resolved: string[] = []

  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      resolved.pop()
      continue
    }
    resolved.push(decodeURIComponent(part))
  }

  return resolved.join('/')
}
