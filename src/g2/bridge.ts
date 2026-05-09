import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

export async function connectEvenBridge(timeoutMs = 1500): Promise<EvenAppBridge | null> {
  try {
    return await Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } catch (error) {
    console.warn('Even App bridge was not available', error)
    return null
  }
}
