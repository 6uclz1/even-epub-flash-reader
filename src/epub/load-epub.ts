import { strFromU8, unzipSync } from 'fflate'
import { chunkPages, type ChunkOptions, type ReadingPage } from '../reader/chunker'
import { parseContainerXml, parseOpf, resolveZipPath } from './parse-opf'
import { extractPlainTextFromHtml } from './sanitize'

export type EpubChapter = {
  id: string
  href: string
  title?: string
  text: string
  pages: ReadingPage[]
  chunks: string[]
}

export type EpubBook = {
  id: string
  title: string
  chapters: EpubChapter[]
  pages: ReadingPage[]
  chunks: string[]
}

export type ExtractEpubOptions = {
  chunk?: boolean
  chunkOptions?: ChunkOptions
}

export async function extractEpubBook(arrayBuffer: ArrayBuffer, options: ExtractEpubOptions = {}): Promise<EpubBook> {
  const files = unzipSync(new Uint8Array(arrayBuffer))
  const containerXml = readText(files, 'META-INF/container.xml')
  const opfPath = parseContainerXml(containerXml)
  const opf = parseOpf(readText(files, opfPath))
  const shouldChunk = options.chunk ?? true
  const chapters: EpubChapter[] = []

  for (const idref of opf.spine) {
    const item = opf.manifest.get(idref)
    if (!item || item.properties.includes('nav')) continue
    if (!/x?html|xml/i.test(item.mediaType) && !/\.(xhtml|html|htm)$/i.test(item.href)) continue

    const href = resolveZipPath(opfPath, item.href)
    const text = extractPlainTextFromHtml(readText(files, href))
    if (text.length === 0) continue

    const pages = shouldChunk ? chunkPages(text, { chapterIndex: chapters.length, chapterId: item.id }, options.chunkOptions) : []
    chapters.push({
      id: item.id,
      href,
      text,
      pages,
      chunks: pages.map((page) => page.text),
    })
  }

  const pages = chapters.flatMap((chapter) => chapter.pages)
  return {
    id: createBookId(arrayBuffer, opf.title),
    title: opf.title,
    chapters,
    pages,
    chunks: pages.map((page) => page.text),
  }
}

export function ensureEpubBookPages(book: EpubBook, chunkOptions?: ChunkOptions): EpubBook {
  if (Array.isArray(book.pages) && book.pages.length > 0 && book.chapters.every((chapter) => Array.isArray(chapter.pages))) {
    return {
      ...book,
      chunks: book.pages.map((page) => page.text),
    }
  }

  const chapters = book.chapters.map((chapter, chapterIndex) => {
    const pages = chunkPages(chapter.text, { chapterIndex, chapterId: chapter.id }, chunkOptions)
    return {
      ...chapter,
      pages,
      chunks: pages.map((page) => page.text),
    }
  })
  const pages = chapters.flatMap((chapter) => chapter.pages)
  return {
    ...book,
    chapters,
    pages,
    chunks: pages.map((page) => page.text),
  }
}

function readText(files: Record<string, Uint8Array>, path: string): string {
  const normalizedPath = path.replace(/^\//, '')
  const key = Object.keys(files).find((candidate) => candidate === normalizedPath || candidate.toLowerCase() === normalizedPath.toLowerCase())
  const file = key ? files[key] : undefined
  if (!file) throw new Error(`EPUB file not found: ${path}; available: ${Object.keys(files).slice(0, 8).join(', ')}`)
  return strFromU8(file)
}

function createBookId(arrayBuffer: ArrayBuffer, title: string): string {
  const bytes = new Uint8Array(arrayBuffer)
  let hash = 2166136261
  for (let index = 0; index < bytes.length; index += Math.max(1, Math.floor(bytes.length / 4096))) {
    hash ^= bytes[index] ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return `${slug(title)}-${(hash >>> 0).toString(16)}`
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'
}
