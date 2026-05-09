export type ReaderState = {
  bookId: string | null
  chapterIndex: number
  chunkIndex: number
  isPlaying: boolean
  delayMs: number
  lastUpdatedAt: number
}

export const DEFAULT_READER_STATE: ReaderState = {
  bookId: null,
  chapterIndex: 0,
  chunkIndex: 0,
  isPlaying: false,
  delayMs: 800,
  lastUpdatedAt: 0,
}

export type ReaderAction =
  | { type: 'toggle-playback' }
  | { type: 'speed-up' }
  | { type: 'speed-down' }
  | { type: 'request-exit' }
  | { type: 'foreground-exit' }
  | { type: 'foreground-enter' }
  | { type: 'abnormal-exit' }

export const MIN_DELAY_MS = 250
export const MAX_DELAY_MS = 2500
export const SPEED_STEP_MS = 100
