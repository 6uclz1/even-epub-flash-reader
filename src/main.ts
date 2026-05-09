import './style.css'
import { chunkPages, type ReadingPage } from './reader/chunker'
import { PlaybackController } from './reader/playback-controller'
import { progressFromPage, resolveProgressPageIndex } from './reader/progress'
import { DEFAULT_READER_STATE, type ReaderAction, type ReaderState } from './reader/state'
import { ensureEpubBookPages, extractEpubBook, type EpubBook } from './epub/load-epub'
import { connectEvenBridge } from './g2/bridge'
import { G2Display } from './g2/display'
import { eventToReaderAction } from './g2/events'
import { BookDb } from './storage/book-db'
import { defaultSettings, SettingsStore } from './storage/settings-store'
import { PhoneApp } from './ui/phone-app'

const DEMO_CHUNKS = [
  'これはテストです。',
  '目を動かさずに読めます。',
  'タップで停止します。',
  'スワイプで速度を変えます。',
]
const DEMO_PAGES: ReadingPage[] = DEMO_CHUNKS.map((text, index) => ({
  text,
  chapterIndex: 0,
  chapterId: 'prototype',
  startOffset: index,
  endOffset: index + 1,
}))

async function main() {
  const root = document.querySelector<HTMLElement>('#app')
  if (!root) throw new Error('Missing #app root')

  const bridge = await connectEvenBridge()
  const display = new G2Display(bridge)
  const settingsStore = new SettingsStore(bridge)
  const bookDb = new BookDb()
  let settings = await settingsStore.load()
  let activeBook: EpubBook | null = null
  let currentChunks = DEMO_CHUNKS
  let currentPages = DEMO_PAGES
  let lastRenderedPageIndex = Math.min(settings.state.chunkIndex, Math.max(currentChunks.length - 1, 0))

  const saveSettings = async (state: ReaderState) => {
    const activeProgress = activeBook ? createCurrentProgress(activeBook.id, state) : null
    settings = {
      ...settings,
      state,
      lastBookId: activeBook?.id ?? settings.lastBookId,
      progressByBook: activeProgress
        ? { ...settings.progressByBook, [activeProgress.bookId]: activeProgress }
        : settings.progressByBook,
    }
    await settingsStore.save(settings)
  }

  const controller = new PlaybackController({
    chunks: currentChunks,
    initialState: {
      ...DEFAULT_READER_STATE,
      ...settings.state,
      bookId: settings.state.bookId ?? 'prototype',
      chunkIndex: Math.min(settings.state.chunkIndex, Math.max(currentChunks.length - 1, 0)),
    },
    renderChunk: async (chunk) => {
      lastRenderedPageIndex = chunk.index
      phoneApp.setCurrentLine(chunk.text)
      phoneApp.setProgress(chunk.index, chunk.total, controller.getState().delayMs)
      await display.renderMain(chunk.text, `${chunk.index + 1}/${chunk.total}`)
    },
    renderStatus: async (message) => {
      phoneApp.log(message)
      await display.renderStatus(message)
    },
    onStateChange: (state) => {
      phoneApp.setPlayback(state.isPlaying)
      phoneApp.setProgress(Math.max(state.chunkIndex - 1, 0), currentChunks.length, state.delayMs)
    },
    persistState: saveSettings,
  })

  const phoneApp = new PhoneApp(root, {
    onFileSelected: async (file) => {
      phoneApp.log(`Reading ${file.name}`)
      const book = await extractEpubBook(await file.arrayBuffer(), {
        chunkOptions: { maxVisualWidth: settings.chunkMaxVisualWidth },
      })
      activeBook = book
      currentChunks = book.chunks
      currentPages = book.pages
      lastRenderedPageIndex = 0
      await bookDb.saveBook(book)
      controller.setChunks(currentChunks, { bookId: book.id, chunkIndex: 0, chapterIndex: 0 })
      phoneApp.loadedBook(book)
      phoneApp.renderBooks(await bookDb.listBooks())
      phoneApp.setCurrentLine(currentChunks[0] ?? 'No text')
      await display.renderMain(currentChunks[0] ?? 'No text', currentChunks.length > 0 ? `1/${currentChunks.length}` : '0/0')
      await saveSettings({ ...controller.getState(), bookId: book.id, chunkIndex: 0 })
    },
    onTogglePlayback: async () => {
      await controller.toggle()
    },
    onSpeedChange: (delayMs) => {
      controller.setDelayMs(delayMs)
    },
    onChunkWidthChange: async (width) => {
      const anchor = activeBook ? createCurrentProgress(activeBook.id, controller.getState()) : null
      settings = { ...settings, chunkMaxVisualWidth: width }
      if (activeBook) {
        const chapters = activeBook.chapters.map((chapter, chapterIndex) => ({
          ...chapter,
          pages: chunkPages(chapter.text, { chapterIndex, chapterId: chapter.id }, { maxVisualWidth: width }),
        }))
        const hydratedChapters = chapters.map((chapter) => ({
          ...chapter,
          chunks: chapter.pages.map((page) => page.text),
        }))
        const pages = hydratedChapters.flatMap((chapter) => chapter.pages)
        const restoredIndex = resolveProgressPageIndex(pages, anchor)
        activeBook = {
          ...activeBook,
          chapters: hydratedChapters,
          pages,
          chunks: pages.map((page) => page.text),
        }
        currentChunks = activeBook.chunks
        currentPages = activeBook.pages
        lastRenderedPageIndex = restoredIndex
        await bookDb.saveBook(activeBook)
        controller.setChunks(currentChunks, { bookId: activeBook.id, chunkIndex: restoredIndex })
        phoneApp.setCurrentLine(currentChunks[restoredIndex] ?? 'Select EPUB')
        await display.renderMain(currentChunks[restoredIndex] ?? 'Select EPUB', currentChunks.length > 0 ? `${restoredIndex + 1}/${currentChunks.length}` : '0/0')
        await saveSettings({ ...controller.getState(), bookId: activeBook.id, chunkIndex: restoredIndex })
      }
      if (!activeBook) await settingsStore.save(settings)
      phoneApp.log(`Chunk width ${width}`)
    },
    onResetProgress: async () => {
      lastRenderedPageIndex = 0
      controller.setChunks(currentChunks, { chunkIndex: 0, bookId: activeBook?.id ?? 'prototype' })
      phoneApp.setCurrentLine(currentChunks[0] ?? 'Select EPUB')
      await display.renderMain(currentChunks[0] ?? 'Select EPUB', currentChunks.length > 0 ? `1/${currentChunks.length}` : '0/0')
      await saveSettings({ ...controller.getState(), chunkIndex: 0 })
      phoneApp.log('Progress reset')
    },
  })

  phoneApp.setConnectionStatus(Boolean(bridge))
  phoneApp.applySettings(settings)
  phoneApp.renderBooks(await bookDb.listBooks())

  if (settings.lastBookId) {
    const cachedBook = await bookDb.getBook(settings.lastBookId)
    if (cachedBook) {
      activeBook = ensureEpubBookPages(cachedBook, { maxVisualWidth: settings.chunkMaxVisualWidth })
      if (activeBook !== cachedBook) await bookDb.saveBook(activeBook)
      currentPages = activeBook.pages
      currentChunks = activeBook.chunks
      const restoredIndex = resolveProgressPageIndex(currentPages, settings.progressByBook[activeBook.id])
      lastRenderedPageIndex = restoredIndex
      controller.setChunks(currentChunks, {
        bookId: activeBook.id,
        chunkIndex: restoredIndex,
      })
      phoneApp.loadedBook(activeBook)
      phoneApp.setCurrentLine(currentChunks[restoredIndex] ?? 'Select EPUB')
    }
  }

  await display.initialize()
  phoneApp.setCurrentLine(currentChunks[controller.getState().chunkIndex] ?? currentChunks[0] ?? 'Select EPUB')
  await display.renderMain(
    currentChunks[controller.getState().chunkIndex] ?? currentChunks[0] ?? 'Select EPUB',
    currentChunks.length > 0 ? `${Math.min(controller.getState().chunkIndex + 1, currentChunks.length)}/${currentChunks.length}` : '0/0',
  )

  bridge?.onEvenHubEvent((event) => {
    const action = eventToReaderAction(event)
    if (action) void handleReaderAction(action)
  })

  window.addEventListener('beforeunload', () => {
    controller.dispose()
    void saveSettings(controller.getState())
  })

  exposeDebugApi(handleReaderAction)

  async function handleReaderAction(action: ReaderAction): Promise<void> {
    console.info('[lineflash] action', action.type)
    await controller.handleAction(action)
    if (action.type === 'request-exit') await display.shutdown(true)
  }

  function createCurrentProgress(bookId: string, state: ReaderState) {
    const pageIndex = Math.max(0, Math.min(lastRenderedPageIndex >= 0 ? lastRenderedPageIndex : state.chunkIndex, Math.max(currentPages.length - 1, 0)))
    const page = currentPages[pageIndex]
    return page ? progressFromPage(bookId, page, pageIndex, state.delayMs) : null
  }
}

function exposeDebugApi(dispatch: (action: ReaderAction) => Promise<void>): void {
  Object.assign(window, {
    __lineFlashDispatch: dispatch,
    __lineFlashDefaults: defaultSettings(),
  })
}

void main()
