import { describe, expect, it } from 'vitest'
import { chunkPages, chunkText, createChunkIndex, visualWidthScore } from '../reader/chunker'
import { progressFromPage, resolveProgressPageIndex } from '../reader/progress'

describe('chunker', () => {
  it('scores ASCII narrower than CJK and punctuation', () => {
    expect(visualWidthScore('A')).toBeLessThan(visualWidthScore('漢'))
    expect(visualWidthScore('。')).toBeLessThanOrEqual(visualWidthScore('漢'))
  })

  it('prefers Japanese punctuation boundaries and respects max visual width', () => {
    const chunks = chunkText('これは長いテストです。目を動かさずに読めます。タップで停止します。', {
      maxVisualWidth: 12,
    })

    expect(chunks).toContain('これは長いテストです。')
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true)
    expect(chunks.every((chunk) => [...chunk].reduce((sum, char) => sum + visualWidthScore(char), 0) <= 13)).toBe(true)
  })

  it('keeps English words together where possible and splits long tokens safely', () => {
    const chunks = chunkText('Read without eye movement at a comfortable pace supercalifragilisticexpialidocious.', {
      maxVisualWidth: 10,
    })

    expect(chunks).toEqual(expect.arrayContaining(['Read without', 'eye movement']))
    expect(chunks.join('').replace(/\s+/g, '')).toContain('supercalifragilisticexpialidocious')
    expect(chunks.every((chunk) => chunk.trim() === chunk)).toBe(true)
  })

  it('does not split emoji grapheme clusters', () => {
    const chunks = chunkText('A family emoji 👨‍👩‍👧‍👦 should remain intact.', {
      maxVisualWidth: 6,
    })

    expect(chunks.some((chunk) => chunk.includes('👨‍👩‍👧‍👦'))).toBe(true)
  })

  it('maps global chunk indexes back to chapters', () => {
    const index = createChunkIndex([
      { id: 'c1', title: 'One', chunks: ['a', 'b'] },
      { id: 'c2', title: 'Two', chunks: ['c'] },
    ])

    expect(index.totalChunks).toBe(3)
    expect(index.toGlobal(1, 0)).toBe(2)
    expect(index.fromGlobal(2)).toEqual({ chapterIndex: 1, localChunkIndex: 0 })
  })

  it('creates page offsets that map back to normalized source text', () => {
    const text = '今日は静かな朝です。ゆっくり本を読みます。'
    const pages = chunkPages(text, { chapterIndex: 2, chapterId: 'chapter-ja' }, { maxVisualWidth: 10 })

    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0]).toMatchObject({ chapterIndex: 2, chapterId: 'chapter-ja' })
    for (const page of pages) {
      expect(text.slice(page.startOffset, page.endOffset)).toBe(page.text)
    }
  })

  it('uses Japanese natural break candidates instead of splitting mid-phrase when possible', () => {
    const pages = chunkPages('私は昨日、静かな図書館で本を読みました。', { chapterIndex: 0, chapterId: 'ja' }, { maxVisualWidth: 8 })

    expect(pages.map((page) => page.text)).toEqual(expect.arrayContaining(['私は昨日、']))
    expect(pages.every((page) => page.text.length > 0)).toBe(true)
  })

  it('resolves the closest page after chunk width changes from a saved anchor', () => {
    const text = '第一のページです。第二のページです。第三のページです。'
    const narrow = chunkPages(text, { chapterIndex: 0, chapterId: 'c1' }, { maxVisualWidth: 9 })
    const sourceIndex = narrow.findIndex((page) => page.text.includes('第二'))
    const progress = progressFromPage('book', narrow[sourceIndex]!, sourceIndex, 800, 1)
    const wide = chunkPages(text, { chapterIndex: 0, chapterId: 'c1' }, { maxVisualWidth: 18 })
    const restoredIndex = resolveProgressPageIndex(wide, progress)

    expect(wide[restoredIndex]?.text).toContain('第二')
  })
})
