import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { ensureEpubBookPages, extractEpubBook, type EpubBook } from '../epub/load-epub'

function bytes(value: string): Uint8Array {
  return new Uint8Array(strToU8(value))
}

function fixtureEpub(): ArrayBuffer {
  const files = {
    'META-INF': {
      'container.xml': bytes(`<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`),
    },
    OPS: {
      'package.opf': bytes(`<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Fixture Book</dc:title></metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chapter-ja" href="chapter-ja.xhtml" media-type="application/xhtml+xml"/>
          <item id="chapter-en" href="Text/chapter-en.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="nav"/>
          <itemref idref="chapter-ja"/>
          <itemref idref="chapter-en"/>
        </spine>
      </package>`),
      'nav.xhtml': bytes('<html><body><nav>Table of contents only</nav></body></html>'),
      'chapter-ja.xhtml': bytes('<html><body><h1>一章</h1><p>これは本文です。<ruby>漢<rt>かん</rt></ruby>字。</p><script>bad()</script></body></html>'),
      Text: {
        'chapter-en.xhtml': bytes('<html><body><style>bad{}</style><p>Hello <strong>reader</strong>.</p><img src="x.png"/></body></html>'),
      },
    },
  }

  return zipSync(files).buffer as ArrayBuffer
}

describe('extractEpubBook', () => {
  it('extracts spine text in order without injecting EPUB HTML', async () => {
    const book = await extractEpubBook(fixtureEpub())

    expect(book.title).toBe('Fixture Book')
    expect(book.chapters.map((chapter) => chapter.id)).toEqual(['chapter-ja', 'chapter-en'])
    expect(book.chapters[0].text).toContain('これは本文です。漢字。')
    expect(book.chapters[0].text).not.toContain('かん')
    expect(book.chapters[0].text).not.toContain('bad()')
    expect(book.chapters[1].text).toContain('Hello reader.')
    expect(book.chapters[1].text).not.toContain('bad{}')
    expect(book.pages.length).toBeGreaterThan(0)
    expect(book.chunks).toEqual(book.pages.map((page) => page.text))
  })

  it('hydrates old cached books that do not have page metadata', async () => {
    const book = await extractEpubBook(fixtureEpub(), { chunk: true, chunkOptions: { maxVisualWidth: 12 } })
    const oldBook = {
      ...book,
      pages: undefined,
      chapters: book.chapters.map((chapter) => ({ ...chapter, pages: undefined })),
    } as unknown as EpubBook

    const hydrated = ensureEpubBookPages(oldBook, { maxVisualWidth: 12 })

    expect(hydrated.pages.length).toBeGreaterThan(0)
    expect(hydrated.chapters.every((chapter) => chapter.pages.length > 0)).toBe(true)
    expect(hydrated.chunks).toEqual(hydrated.pages.map((page) => page.text))
  })
})
