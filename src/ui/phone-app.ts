import type { EpubBook } from '../epub/load-epub'
import type { ReaderSettings } from '../storage/settings-store'

export type PhoneAppCallbacks = {
  onFileSelected: (file: File) => Promise<void>
  onTogglePlayback: () => Promise<void>
  onSpeedChange: (delayMs: number) => void
  onChunkWidthChange: (width: number) => Promise<void>
  onResetProgress: () => Promise<void>
}

export class PhoneApp {
  private readonly logEl: HTMLElement
  private readonly bookListEl: HTMLElement
  private readonly playButton: HTMLButtonElement
  private readonly speedInput: HTMLInputElement
  private readonly chunkWidthInput: HTMLInputElement
  private readonly speedOutput: HTMLOutputElement
  private readonly chunkWidthOutput: HTMLOutputElement
  private readonly progressEl: HTMLElement
  private readonly connectionEl: HTMLElement
  private readonly callbacks: PhoneAppCallbacks

  constructor(
    root: HTMLElement,
    callbacks: PhoneAppCallbacks,
  ) {
    this.callbacks = callbacks
    root.innerHTML = `
      <main class="app-shell">
        <section class="reader-panel">
          <div class="topbar">
            <div>
              <p class="eyebrow">G2 flash reader</p>
              <h1>LineFlash Reader</h1>
            </div>
            <span id="connection" class="status-pill">Bridge: checking</span>
          </div>

          <div class="current-line" id="current-line">Select EPUB</div>
          <div class="reader-actions">
            <label class="file-button">
              <input id="file-input" type="file" accept=".epub,application/epub+zip" />
              <span>Choose EPUB</span>
            </label>
            <button id="play-button" type="button">Start</button>
            <button id="reset-button" type="button">Reset</button>
          </div>
          <div id="progress" class="progress-text">No book loaded</div>
        </section>

        <section class="settings-grid">
          <div class="settings-block">
            <h2>Playback</h2>
            <label>
              Delay
              <input id="speed-input" type="range" min="250" max="2500" step="50" value="800" />
              <output id="speed-output">800ms</output>
            </label>
            <label>
              Chunk width
              <input id="chunk-width-input" type="range" min="18" max="42" step="1" value="30" />
              <output id="chunk-width-output">30</output>
            </label>
          </div>
          <div class="settings-block">
            <h2>Books</h2>
            <div id="book-list" class="book-list"></div>
          </div>
          <div class="settings-block log-block">
            <h2>Extract log</h2>
            <div id="log" class="log"></div>
          </div>
        </section>
      </main>
    `

    this.logEl = root.querySelector('#log')!
    this.bookListEl = root.querySelector('#book-list')!
    this.playButton = root.querySelector('#play-button')!
    this.speedInput = root.querySelector('#speed-input')!
    this.chunkWidthInput = root.querySelector('#chunk-width-input')!
    this.progressEl = root.querySelector('#progress')!
    this.connectionEl = root.querySelector('#connection')!

    const fileInput = root.querySelector<HTMLInputElement>('#file-input')!
    this.speedOutput = root.querySelector<HTMLOutputElement>('#speed-output')!
    this.chunkWidthOutput = root.querySelector<HTMLOutputElement>('#chunk-width-output')!
    const resetButton = root.querySelector<HTMLButtonElement>('#reset-button')!

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (file) void this.callbacks.onFileSelected(file)
    })
    this.playButton.addEventListener('click', () => void this.callbacks.onTogglePlayback())
    resetButton.addEventListener('click', () => void this.callbacks.onResetProgress())
    this.speedInput.addEventListener('input', () => {
      this.speedOutput.value = `${this.speedInput.value}ms`
      this.callbacks.onSpeedChange(Number(this.speedInput.value))
    })
    this.chunkWidthInput.addEventListener('change', () => {
      this.chunkWidthOutput.value = this.chunkWidthInput.value
      void this.callbacks.onChunkWidthChange(Number(this.chunkWidthInput.value))
    })
    this.chunkWidthInput.addEventListener('input', () => {
      this.chunkWidthOutput.value = this.chunkWidthInput.value
    })
  }

  setConnectionStatus(connected: boolean): void {
    this.connectionEl.textContent = connected ? 'Bridge: connected' : 'Bridge: simulator/local'
    this.connectionEl.classList.toggle('is-connected', connected)
  }

  applySettings(settings: ReaderSettings): void {
    this.speedInput.value = String(settings.state.delayMs)
    this.chunkWidthInput.value = String(settings.chunkMaxVisualWidth)
    this.speedOutput.value = `${settings.state.delayMs}ms`
    this.chunkWidthOutput.value = String(settings.chunkMaxVisualWidth)
  }

  setCurrentLine(line: string): void {
    const currentLine = document.querySelector<HTMLElement>('#current-line')
    if (currentLine) currentLine.textContent = line
  }

  setPlayback(isPlaying: boolean): void {
    this.playButton.textContent = isPlaying ? 'Pause' : 'Start'
  }

  setProgress(index: number, total: number, delayMs: number): void {
    this.progressEl.textContent = total > 0 ? `${Math.min(index + 1, total)} / ${total} chunks · ${delayMs}ms` : 'No book loaded'
  }

  renderBooks(books: Array<{ id: string; title: string; updatedAt: number }>): void {
    this.bookListEl.textContent = ''
    if (books.length === 0) {
      this.bookListEl.textContent = 'No cached books'
      return
    }

    for (const book of books) {
      const item = document.createElement('div')
      item.className = 'book-item'
      const title = document.createElement('strong')
      title.textContent = book.title
      const date = document.createElement('span')
      date.textContent = new Date(book.updatedAt).toLocaleString()
      item.append(title, date)
      this.bookListEl.append(item)
    }
  }

  log(message: string): void {
    const line = document.createElement('div')
    line.textContent = message
    this.logEl.prepend(line)
  }

  loadedBook(book: EpubBook): void {
    this.log(`Loaded ${book.title}: ${book.chapters.length} chapters, ${book.chunks.length} chunks`)
  }
}
