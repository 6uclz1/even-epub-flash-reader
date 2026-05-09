import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { ReadingProgress } from '../reader/progress'
import { DEFAULT_READER_STATE, type ReaderState } from '../reader/state'

const SETTINGS_KEY = 'lineflash-reader-settings'

export type ReaderSettings = {
  state: ReaderState
  lastBookId: string | null
  chunkMaxVisualWidth: number
  autoResume: boolean
  progressByBook: Record<string, ReadingProgress>
}

export class SettingsStore {
  private readonly bridge: Pick<EvenAppBridge, 'getLocalStorage' | 'setLocalStorage'> | null

  constructor(bridge: Pick<EvenAppBridge, 'getLocalStorage' | 'setLocalStorage'> | null) {
    this.bridge = bridge
  }

  async load(): Promise<ReaderSettings> {
    const raw = await this.getRaw()
    if (!raw) return defaultSettings()

    try {
      const parsed = JSON.parse(raw) as Partial<ReaderSettings>
      return {
        ...defaultSettings(),
        ...parsed,
        state: { ...DEFAULT_READER_STATE, ...parsed.state },
        progressByBook: parsed.progressByBook ?? {},
      }
    } catch {
      return defaultSettings()
    }
  }

  async save(settings: ReaderSettings): Promise<void> {
    const raw = JSON.stringify(settings)
    if (this.bridge) {
      try {
        await this.bridge.setLocalStorage(SETTINGS_KEY, raw)
        localStorage.setItem(SETTINGS_KEY, raw)
        return
      } catch (error) {
        console.warn('SDK local storage unavailable; falling back to Web localStorage', error)
      }
    }
    localStorage.setItem(SETTINGS_KEY, raw)
  }

  private async getRaw(): Promise<string | null> {
    if (this.bridge) {
      try {
        const value = await this.bridge.getLocalStorage(SETTINGS_KEY)
        if (value) return value
      } catch (error) {
        console.warn('SDK local storage read failed; falling back to Web localStorage', error)
      }
    }
    return localStorage.getItem(SETTINGS_KEY)
  }
}

export function defaultSettings(): ReaderSettings {
  return {
    state: { ...DEFAULT_READER_STATE },
    lastBookId: null,
    chunkMaxVisualWidth: 30,
    autoResume: false,
    progressByBook: {},
  }
}
