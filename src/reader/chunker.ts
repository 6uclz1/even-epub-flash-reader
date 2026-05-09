import TinySegmenter from 'tiny-segmenter'

export type ChunkOptions = {
  maxVisualWidth?: number
}

export type ChapterMeta = {
  chapterIndex: number
  chapterId: string
}

export type ReadingPage = {
  text: string
  chapterIndex: number
  chapterId: string
  startOffset: number
  endOffset: number
}

export type ChapterChunks = {
  id: string
  title?: string
  chunks: string[]
}

export function visualWidthScore(char: string): number {
  if (/^[ -~]$/.test(char)) return 0.55
  if (/^[。、！？「」『』（）,.!?;:()[\]{}]$/.test(char)) return 0.8
  return 1
}

export function chunkText(input: string, options: ChunkOptions = {}): string[] {
  return chunkPages(input, { chapterIndex: 0, chapterId: 'chapter-0' }, options).map((page) => page.text)
}

export function chunkPages(input: string, chapter: ChapterMeta, options: ChunkOptions = {}): ReadingPage[] {
  const maxVisualWidth = options.maxVisualWidth ?? 30
  const normalized = normalizeText(input)
  const tokens = tokenize(normalized)
  const pages: ReadingPage[] = []
  let current: Token[] = []

  const flush = () => {
    const page = createPage(current, chapter)
    if (page) pages.push(page)
    current = []
  }

  for (const token of tokens) {
    if (token.text.trim().length === 0 && current.length === 0) continue

    const tokenScore = score(token.text)
    const currentScore = score(tokensText(current))
    const nextScore = currentScore + tokenScore
    const isAsciiWord = /^[A-Za-z0-9][A-Za-z0-9'’-]*$/.test(token.text)
    const currentWordCount = tokensText(current).trim().split(/\s+/).filter(Boolean).length

    if (tokenScore > maxVisualWidth) {
      flush()
      splitLongToken(token, maxVisualWidth, chapter).forEach((page) => pages.push(page))
      continue
    }

    if (current.length > 0 && nextScore > maxVisualWidth) {
      const breakIndex = findBestBreakIndex(current)
      if (breakIndex > 0 && breakIndex < current.length) {
        const keep = current.slice(breakIndex)
        const page = createPage(current.slice(0, breakIndex), chapter)
        if (page) pages.push(page)
        current = keep
      } else {
        flush()
      }
    }
    if (current.length > 0 && isAsciiWord && currentWordCount >= 2 && currentScore >= maxVisualWidth * 0.65) flush()

    current.push(token)

    if (/[。！？!?]$/.test(token.text)) flush()
  }

  flush()
  return pages
}

export function createChunkIndex(chapters: ChapterChunks[]) {
  const starts: number[] = []
  let totalChunks = 0

  for (const chapter of chapters) {
    starts.push(totalChunks)
    totalChunks += chapter.chunks.length
  }

  return {
    totalChunks,
    toGlobal(chapterIndex: number, localChunkIndex: number) {
      return (starts[chapterIndex] ?? 0) + localChunkIndex
    },
    fromGlobal(globalIndex: number) {
      const bounded = Math.max(0, Math.min(globalIndex, Math.max(totalChunks - 1, 0)))
      let chapterIndex = 0
      for (let index = 0; index < starts.length; index += 1) {
        if (starts[index] <= bounded) chapterIndex = index
      }
      return {
        chapterIndex,
        localChunkIndex: bounded - (starts[chapterIndex] ?? 0),
      }
    },
  }
}

export function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type Token = {
  text: string
  start: number
  end: number
  naturalBreakAfter: boolean
}

function tokenize(input: string): Token[] {
  const segmented = tokenizeWithTinySegmenter(input)
  if (segmented.length > 0) return segmented
  return tokenizeWithGraphemes(input)
}

function tokenizeWithTinySegmenter(input: string): Token[] {
  try {
    const segmenter = new TinySegmenter()
    let cursor = 0
    return segmenter.segment(input).flatMap((segment) => {
      const start = input.indexOf(segment, cursor)
      if (start < 0) return []
      const end = start + segment.length
      cursor = end
      return [{
        text: segment,
        start,
        end,
        naturalBreakAfter: isNaturalBreakToken(segment),
      }]
    })
  } catch {
    return []
  }
}

function tokenizeWithGraphemes(input: string): Token[] {
  const graphemes = splitGraphemes(input)
  const tokens: Token[] = []
  let word = ''
  let wordStart = 0
  let cursor = 0

  const flushWord = () => {
    if (word.length > 0) {
      tokens.push({
        text: word,
        start: wordStart,
        end: cursor,
        naturalBreakAfter: isNaturalBreakToken(word),
      })
    }
    word = ''
  }

  for (const char of graphemes) {
    const start = cursor
    cursor += char.length
    if (/^[A-Za-z0-9'’-]$/.test(char)) {
      if (word.length === 0) wordStart = start
      word += char
      continue
    }

    flushWord()
    tokens.push({
      text: char,
      start,
      end: cursor,
      naturalBreakAfter: isNaturalBreakToken(char),
    })
  }

  flushWord()
  return tokens
}

function splitLongToken(token: Token, maxVisualWidth: number, chapter: ChapterMeta): ReadingPage[] {
  const pages: ReadingPage[] = []
  let current: Token[] = []
  let cursor = token.start

  for (const char of splitGraphemes(token.text)) {
    const next: Token = {
      text: char,
      start: cursor,
      end: cursor + char.length,
      naturalBreakAfter: false,
    }
    if (current.length > 0 && score(tokensText([...current, next])) > maxVisualWidth) {
      const page = createPage(current, chapter)
      if (page) pages.push(page)
      current = []
    }
    current.push(next)
    cursor = next.end
  }

  const page = createPage(current, chapter)
  if (page) pages.push(page)
  return pages
}

function score(value: string): number {
  return splitGraphemes(value).reduce((sum, char) => sum + visualWidthScore(char), 0)
}

function splitGraphemes(value: string): string[] {
  const Segmenter = 'Segmenter' in Intl ? (Intl.Segmenter as unknown as new (...args: unknown[]) => { segment: (value: string) => Iterable<{ segment: string }> }) : null
  if (Segmenter) {
    return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map((part) => part.segment)
  }
  return Array.from(value)
}

function tokensText(tokens: Token[]): string {
  return tokens.map((token) => token.text).join('')
}

function createPage(tokens: Token[], chapter: ChapterMeta): ReadingPage | null {
  const raw = tokensText(tokens)
  const text = raw.trim()
  if (text.length === 0 || tokens.length === 0) return null
  const leadingTrim = raw.length - raw.trimStart().length
  const trailingTrim = raw.length - raw.trimEnd().length
  return {
    text,
    chapterIndex: chapter.chapterIndex,
    chapterId: chapter.chapterId,
    startOffset: (tokens[0]?.start ?? 0) + leadingTrim,
    endOffset: (tokens[tokens.length - 1]?.end ?? 0) - trailingTrim,
  }
}

function findBestBreakIndex(tokens: Token[]): number {
  for (let index = tokens.length - 1; index > 0; index -= 1) {
    if (tokens[index - 1]?.naturalBreakAfter) return index
  }
  return -1
}

function isNaturalBreakToken(token: string): boolean {
  if (/[。、，,.！？!?）」』】]$/.test(token)) return true
  return /^(は|が|を|に|へ|で|と|も|や|の|から|まで|より|て|で|です|ます|ました|ない|する|した|して|いる|ある)$/.test(token)
}
