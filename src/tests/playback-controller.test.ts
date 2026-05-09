import { describe, expect, it, vi } from 'vitest'
import { PlaybackController } from '../reader/playback-controller'

describe('PlaybackController', () => {
  it('renders chunks on schedule, pauses, resumes, and clamps speed', async () => {
    vi.useFakeTimers()
    const rendered: string[] = []
    const states: number[] = []
    const controller = new PlaybackController({
      chunks: ['one', 'two', 'three'],
      initialState: { bookId: 'book', chapterIndex: 0, chunkIndex: 0, isPlaying: false, delayMs: 800, lastUpdatedAt: 0 },
      renderChunk: async (chunk) => {
        rendered.push(chunk.text)
      },
      onStateChange: (state) => {
        states.push(state.delayMs)
      },
      persistState: async () => undefined,
    })

    await controller.resume()
    expect(rendered).toEqual(['one'])

    await vi.advanceTimersByTimeAsync(800)
    expect(rendered).toEqual(['one', 'two'])

    await controller.toggle()
    await vi.advanceTimersByTimeAsync(1600)
    expect(rendered).toEqual(['one', 'two'])

    controller.speedUp()
    expect(controller.getState().delayMs).toBe(700)
    controller.speedDown()
    controller.speedDown()
    expect(controller.getState().delayMs).toBe(900)
    expect(states).toContain(700)

    await controller.resume()
    await vi.advanceTimersByTimeAsync(900)
    expect(rendered).toEqual(['one', 'two', 'three'])

    vi.useRealTimers()
  })
})
