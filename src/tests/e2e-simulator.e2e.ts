import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it } from 'vitest'

const children: ChildProcessWithoutNullStreams[] = []

afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGTERM')
})

describe('EvenHub Simulator automation E2E', () => {
  it('renders non-black G2 output and handles touchpad actions', async () => {
    const webPort = await freePort()
    const automationPort = await freePort()
    const preview = start('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(webPort)])
    await waitForHttp(`http://127.0.0.1:${webPort}`)

    const simulator = start('npx', [
      'evenhub-simulator',
      `http://127.0.0.1:${webPort}`,
      '--automation-port',
      String(automationPort),
      '--no-glow',
    ])
    await waitForHttp(`http://127.0.0.1:${automationPort}/api/ping`, 45_000)

    const firstRatio = await waitForNonBlackScreenshot(automationPort)
    expect(firstRatio).toBeGreaterThan(0.001)

    await clearConsole(automationPort)
    for (const action of ['click', 'click', 'up', 'down', 'double_click']) {
      await postInput(automationPort, action)
      await sleep(350)
    }

    const consoleText = await consoleOutput(automationPort)
    expect(consoleText).toContain('toggle-playback')
    expect(consoleText).toContain('speed-up')
    expect(consoleText).toContain('speed-down')
    expect(consoleText).toContain('request-exit')

    preview.kill('SIGTERM')
    simulator.kill('SIGTERM')
  }, 90_000)
})

function start(command: string, args: string[]): ChildProcessWithoutNullStreams {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  })
  child.stderr.on('data', (data) => process.stderr.write(data))
  child.stdout.on('data', (data) => process.stdout.write(data))
  children.push(child)
  return child
}

async function freePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  server.close()
  await once(server, 'close')
  return port
}

async function waitForHttp(url: string, timeoutMs = 20_000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      await sleep(250)
    }
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed: ${url} ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function waitForNonBlackScreenshot(port: number): Promise<number> {
  const startedAt = Date.now()
  let ratio = 0
  while (Date.now() - startedAt < 12_000) {
    const image = await fetchBytes(`http://127.0.0.1:${port}/api/screenshot/glasses`)
    ratio = nonBlackPixelRatio(image)
    if (ratio > 0.001) return ratio
    await sleep(300)
  }
  throw new Error(`Glasses framebuffer stayed black; console=${await consoleOutput(port)}`)
}

function nonBlackPixelRatio(pngBytes: Buffer): number {
  const png = PNG.sync.read(pngBytes)
  let lit = 0
  const total = png.width * png.height

  for (let offset = 0; offset < png.data.length; offset += 4) {
    const alpha = png.data[offset + 3] ?? 0
    const brightness = (png.data[offset] ?? 0) + (png.data[offset + 1] ?? 0) + (png.data[offset + 2] ?? 0)
    if (alpha > 0 && brightness > 8) lit += 1
  }

  return lit / total
}

async function postInput(port: number, action: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/api/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!response.ok) throw new Error(`Input failed: ${action} ${response.status}`)
}

async function clearConsole(port: number): Promise<void> {
  await fetch(`http://127.0.0.1:${port}/api/console`, { method: 'DELETE' })
}

async function consoleOutput(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/api/console`)
  return JSON.stringify(await response.json())
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
