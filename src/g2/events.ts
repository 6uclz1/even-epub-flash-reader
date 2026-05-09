import { type EvenHubEvent, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { ReaderAction } from '../reader/state'

export function eventToReaderAction(event: EvenHubEvent): ReaderAction | null {
  const eventType = event.textEvent?.eventType ?? event.listEvent?.eventType ?? event.sysEvent?.eventType

  if (eventType === undefined && event.sysEvent?.eventSource !== undefined) {
    return { type: 'toggle-playback' }
  }

  switch (eventType) {
    case OsEventTypeList.CLICK_EVENT:
      return { type: 'toggle-playback' }
    case OsEventTypeList.SCROLL_TOP_EVENT:
      return { type: 'speed-up' }
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      return { type: 'speed-down' }
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      return { type: 'request-exit' }
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      return { type: 'foreground-exit' }
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      return { type: 'foreground-enter' }
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
      return { type: 'abnormal-exit' }
    default:
      return null
  }
}
