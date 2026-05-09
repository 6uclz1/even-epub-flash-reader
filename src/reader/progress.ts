import type { ReadingPage } from './chunker'

export type ReadingProgress = {
  bookId: string
  chapterId: string
  chapterIndex: number
  charOffset: number
  pageIndex: number
  delayMs: number
  updatedAt: number
}

export function progressFromPage(bookId: string, page: ReadingPage, pageIndex: number, delayMs: number, now = Date.now()): ReadingProgress {
  return {
    bookId,
    chapterId: page.chapterId,
    chapterIndex: page.chapterIndex,
    charOffset: page.startOffset,
    pageIndex,
    delayMs,
    updatedAt: now,
  }
}

export function resolveProgressPageIndex(pages: ReadingPage[], progress?: ReadingProgress | null): number {
  if (pages.length === 0) return 0
  if (!progress) return 0

  const sameChapter = pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => page.chapterId === progress.chapterId || page.chapterIndex === progress.chapterIndex)

  const candidates = sameChapter.length > 0 ? sameChapter : pages.map((page, index) => ({ page, index }))
  const containing = candidates.find(({ page }) => page.startOffset <= progress.charOffset && progress.charOffset < page.endOffset)
  if (containing) return containing.index

  let best = candidates[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = Math.min(
      Math.abs(candidate.page.startOffset - progress.charOffset),
      Math.abs(candidate.page.endOffset - progress.charOffset),
    )
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }

  return best?.index ?? Math.max(0, Math.min(progress.pageIndex, pages.length - 1))
}
