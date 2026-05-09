import { CreateStartUpPageContainer, StartUpPageCreateResult, TextContainerProperty, TextContainerUpgrade, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type G2DisplayBridge = Pick<EvenAppBridge, 'createStartUpPageContainer' | 'textContainerUpgrade' | 'shutDownPageContainer'>

const CAPTURE_CONTAINER_ID = 1
const MAIN_CONTAINER_ID = 2
const STATUS_CONTAINER_ID = 3
const PROGRESS_CONTAINER_ID = 4

export class G2Display {
  private initialized = false
  private statusTimer: number | null = null
  private readonly bridge: G2DisplayBridge | null

  constructor(bridge: G2DisplayBridge | null) {
    this.bridge = bridge
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    await this.safeCall(() =>
      this.bridge?.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            containerID: CAPTURE_CONTAINER_ID,
            containerName: 'capture',
            xPosition: 0,
            yPosition: 0,
            width: 576,
            height: 288,
            borderWidth: 0,
            borderColor: 0,
            borderRadius: 0,
            paddingLength: 0,
            content: ' ',
            isEventCapture: 1,
          }),
          new TextContainerProperty({
            containerID: MAIN_CONTAINER_ID,
            containerName: 'main',
            xPosition: 28,
            yPosition: 106,
            width: 520,
            height: 72,
            borderWidth: 0,
            borderColor: 0,
            borderRadius: 0,
            paddingLength: 0,
            content: 'Select EPUB',
            isEventCapture: 0,
          }),
          new TextContainerProperty({
            containerID: STATUS_CONTAINER_ID,
            containerName: 'status',
            xPosition: 28,
            yPosition: 20,
            width: 520,
            height: 38,
            borderWidth: 0,
            borderColor: 0,
            borderRadius: 0,
            paddingLength: 0,
            content: 'LineFlash Reader',
            isEventCapture: 0,
          }),
          new TextContainerProperty({
            containerID: PROGRESS_CONTAINER_ID,
            containerName: 'progress',
            xPosition: 28,
            yPosition: 250,
            width: 520,
            height: 28,
            borderWidth: 0,
            borderColor: 0,
            borderRadius: 0,
            paddingLength: 0,
            content: '',
            isEventCapture: 0,
          }),
        ],
      })),
    )
  }

  async renderMain(content: string, progress?: string): Promise<void> {
    await this.upgrade(MAIN_CONTAINER_ID, 'main', content)
    if (progress) await this.upgrade(PROGRESS_CONTAINER_ID, 'progress', progress)
  }

  async renderStatus(content: string, autoClearMs = 1400): Promise<void> {
    if (this.statusTimer !== null) window.clearTimeout(this.statusTimer)
    await this.upgrade(STATUS_CONTAINER_ID, 'status', content)
    if (autoClearMs > 0) {
      this.statusTimer = window.setTimeout(() => {
        void this.upgrade(STATUS_CONTAINER_ID, 'status', '')
      }, autoClearMs)
    }
  }

  async shutdown(confirm = true): Promise<void> {
    await this.safeCall(() => this.bridge?.shutDownPageContainer(confirm ? 1 : 0))
  }

  private async upgrade(containerID: number, containerName: string, content: string): Promise<void> {
    const payload = new TextContainerUpgrade({
      containerID,
      containerName,
      contentOffset: 0,
      contentLength: content.length,
      content,
    })

    await this.safeCall(() => this.bridge?.textContainerUpgrade(payload))
  }

  private async safeCall(call: () => Promise<unknown> | undefined): Promise<void> {
    if (!this.bridge) return
    try {
      const result = await call()
      if (result === StartUpPageCreateResult.invalid || result === StartUpPageCreateResult.oversize || result === StartUpPageCreateResult.outOfMemory) {
        console.warn('G2 display command did not succeed', result)
      }
    } catch (error) {
      console.warn('G2 display bridge unavailable', error)
    }
  }
}
