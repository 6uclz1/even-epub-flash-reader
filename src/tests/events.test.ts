import { describe, expect, it } from 'vitest'
import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import { eventToReaderAction } from '../g2/events'

describe('G2 event reducer', () => {
  it.each([
    [OsEventTypeList.CLICK_EVENT, 'toggle-playback'],
    [OsEventTypeList.SCROLL_TOP_EVENT, 'speed-up'],
    [OsEventTypeList.SCROLL_BOTTOM_EVENT, 'speed-down'],
    [OsEventTypeList.DOUBLE_CLICK_EVENT, 'request-exit'],
    [OsEventTypeList.FOREGROUND_EXIT_EVENT, 'foreground-exit'],
    [OsEventTypeList.FOREGROUND_ENTER_EVENT, 'foreground-enter'],
    [OsEventTypeList.ABNORMAL_EXIT_EVENT, 'abnormal-exit'],
  ] as const)('maps %s to %s', (eventType, action) => {
    expect(eventToReaderAction({ textEvent: { eventType } } as EvenHubEvent)).toEqual({ type: action })
  })

  it('returns null for unrelated events', () => {
    expect(eventToReaderAction({ sysEvent: { eventType: OsEventTypeList.IMU_DATA_REPORT } } as EvenHubEvent)).toBeNull()
  })

  it('treats simulator touch sys events without eventType as click fallback', () => {
    expect(eventToReaderAction({ sysEvent: { eventSource: 1 } } as EvenHubEvent)).toEqual({ type: 'toggle-playback' })
  })
})
