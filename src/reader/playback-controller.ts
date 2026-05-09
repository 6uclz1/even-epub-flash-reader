import { MAX_DELAY_MS, MIN_DELAY_MS, SPEED_STEP_MS, type ReaderAction, type ReaderState } from './state'

export type RenderChunk = {
  index: number
  text: string
  total: number
}

export type PlaybackControllerOptions = {
  chunks: string[]
  initialState: ReaderState
  renderChunk: (chunk: RenderChunk) => Promise<void> | void
  renderStatus?: (message: string) => Promise<void> | void
  onStateChange?: (state: ReaderState) => void
  persistState?: (state: ReaderState) => Promise<void> | void
}

export class PlaybackController {
  private chunks: string[]
  private state: ReaderState
  private readonly renderChunk: PlaybackControllerOptions['renderChunk']
  private readonly renderStatus: NonNullable<PlaybackControllerOptions['renderStatus']>
  private readonly onStateChange: NonNullable<PlaybackControllerOptions['onStateChange']>
  private readonly persistState: NonNullable<PlaybackControllerOptions['persistState']>
  private timer: number | null = null

  constructor(options: PlaybackControllerOptions) {
    this.chunks = options.chunks
    this.state = { ...options.initialState }
    this.renderChunk = options.renderChunk
    this.renderStatus = options.renderStatus ?? (() => undefined)
    this.onStateChange = options.onStateChange ?? (() => undefined)
    this.persistState = options.persistState ?? (() => undefined)
  }

  getState(): ReaderState {
    return { ...this.state }
  }

  setChunks(chunks: string[], statePatch: Partial<ReaderState> = {}): void {
    this.stopTimer()
    this.chunks = chunks
    this.state = { ...this.state, ...statePatch, chunkIndex: statePatch.chunkIndex ?? 0, isPlaying: false }
    this.emit()
  }

  async resume(): Promise<void> {
    if (this.chunks.length === 0) {
      await this.renderStatus('Select EPUB')
      return
    }

    this.state = { ...this.state, isPlaying: true, lastUpdatedAt: Date.now() }
    this.emit()
    await this.tick()
  }

  async pause(message = 'Paused'): Promise<void> {
    this.stopTimer()
    this.state = { ...this.state, isPlaying: false, lastUpdatedAt: Date.now() }
    this.emit()
    await this.renderStatus(message)
    await this.persistState(this.getState())
  }

  async toggle(): Promise<void> {
    if (this.state.isPlaying) {
      await this.pause()
      return
    }
    await this.resume()
  }

  speedUp(): ReaderState {
    return this.setDelay(Math.max(MIN_DELAY_MS, this.state.delayMs - SPEED_STEP_MS), 'Speed +')
  }

  speedDown(): ReaderState {
    return this.setDelay(Math.min(MAX_DELAY_MS, this.state.delayMs + SPEED_STEP_MS), 'Speed -')
  }

  setDelayMs(delayMs: number): ReaderState {
    const bounded = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, delayMs))
    return this.setDelay(bounded, 'Speed')
  }

  async handleAction(action: ReaderAction): Promise<void> {
    switch (action.type) {
      case 'toggle-playback':
        await this.toggle()
        break
      case 'speed-up':
        this.speedUp()
        break
      case 'speed-down':
        this.speedDown()
        break
      case 'request-exit':
        await this.pause('Exit?')
        break
      case 'foreground-exit':
      case 'abnormal-exit':
        await this.pause('Paused')
        break
      case 'foreground-enter':
        await this.renderCurrent()
        break
    }
  }

  dispose(): void {
    this.stopTimer()
  }

  private async tick(): Promise<void> {
    this.stopTimer()
    if (!this.state.isPlaying) return

    if (this.state.chunkIndex >= this.chunks.length) {
      this.state = { ...this.state, isPlaying: false, chunkIndex: this.chunks.length, lastUpdatedAt: Date.now() }
      this.emit()
      await this.renderStatus('End')
      await this.persistState(this.getState())
      return
    }

    await this.renderCurrent()
    this.state = { ...this.state, chunkIndex: this.state.chunkIndex + 1, lastUpdatedAt: Date.now() }
    this.emit()
    await this.persistState(this.getState())

    if (this.state.isPlaying) {
      this.timer = window.setTimeout(() => void this.tick(), this.state.delayMs)
    }
  }

  private async renderCurrent(): Promise<void> {
    const index = Math.max(0, Math.min(this.state.chunkIndex, Math.max(this.chunks.length - 1, 0)))
    const text = this.chunks[index] ?? 'Select EPUB'
    await this.renderChunk({ index, text, total: this.chunks.length })
  }

  private setDelay(delayMs: number, label: string): ReaderState {
    this.state = { ...this.state, delayMs, lastUpdatedAt: Date.now() }
    this.emit()
    void this.persistState(this.getState())
    void this.renderStatus(`${label} ${delayMs}ms`)
    return this.getState()
  }

  private emit(): void {
    this.onStateChange(this.getState())
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
  }
}
