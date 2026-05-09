# LineFlash Reader

LineFlash Reader is an EPUB flash-reading web app for Even Realities G2. The app runs inside the Even Realities App WebView, extracts plain text from a local EPUB file on the phone side, splits it into short one-line chunks, and sends text updates to the G2 glasses through the Even Hub SDK.

The G2 side is intentionally minimal: one centered text chunk, short status updates, touchpad controls, and progress. EPUB parsing, playback state, settings, and cached book data stay in the WebView.

## Features

- Select a local `.epub` file from the phone WebView.
- Extract text in EPUB spine order without injecting EPUB HTML into the app DOM.
- Remove unsafe or display-unfriendly content such as `script`, `style`, `svg`, `img`, `nav`, and ruby annotation text.
- Split Japanese, English, and mixed text into G2-friendly chunks using punctuation, word boundaries, grapheme segmentation, and visual-width scoring.
- Display one chunk at a time on G2 with `textContainerUpgrade`.
- Use G2 touchpad input:
  - click: pause / resume
  - swipe up: faster
  - swipe down: slower
  - double click: exit confirmation
- Persist playback speed and progress with SDK local storage, with Web `localStorage` fallback.
- Cache extracted books and chunks in IndexedDB.
- Validate G2 behavior with EvenHub Simulator automation.

## Requirements

- Node.js 20 LTS or 22+
- npm

The project depends on:

- Vite + TypeScript
- `@evenrealities/even_hub_sdk`
- `@evenrealities/evenhub-simulator`
- `@evenrealities/evenhub-cli`
- Vitest

## Getting Started

```sh
npm install
npm run dev
```

Open the Vite URL in the EvenHub Simulator or in a browser for phone-side UI development.

## Scripts

```sh
npm run dev
```

Start the Vite development server.

```sh
npm run build
```

Run TypeScript checks and build the production bundle into `dist/`.

```sh
npm test
```

Run unit tests for chunking, EPUB extraction, event mapping, and playback scheduling.

```sh
npm run test:e2e
```

Build the app, start a local preview server, launch EvenHub Simulator with an automation port, verify that the G2 framebuffer is not black, and drive click / swipe / double-click inputs through the simulator HTTP API.

```sh
npm run pack
```

Package `dist/` and `app.json` into `lineflash-reader.ehpk`.

```sh
npm run pack:check
```

Package the app and check `package_id` availability. This requires `evenhub login` first.

```sh
npm run dev:host
npm run qr -- --url "http://<LAN-IP>:5173"
```

Run a LAN-visible development server and generate a QR code for hardware sideloading.

## EvenHub Manifest

The app manifest is defined in `app.json`:

```json
{
  "package_id": "com.sixuclz1.lineflashreader",
  "edition": "202601",
  "name": "LineFlash Reader",
  "version": "0.1.0",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.10",
  "entrypoint": "index.html",
  "permissions": [],
  "supported_languages": ["ja", "en"]
}
```

No network permissions are requested because the MVP only imports local EPUB files.

## Architecture

```text
EPUB file
  -> Phone WebView / Vite app
     -> EPUB parser
     -> sanitizer
     -> chunker
     -> playback controller
     -> settings store / IndexedDB cache
  -> Even Hub SDK bridge
  -> Even Realities App
  -> Even G2 glasses
```

Main modules:

- `src/epub/`: EPUB zip, OPF, spine, and text extraction.
- `src/reader/`: chunking, playback state, and scheduler.
- `src/g2/`: Even Hub bridge connection, display containers, and input event mapping.
- `src/storage/`: SDK local storage fallback and IndexedDB book cache.
- `src/ui/`: phone-side control UI.
- `src/tests/`: unit and simulator automation tests.

## Testing Notes

The E2E test uses EvenHub Simulator automation as an actual-device-like validation path:

- Starts Vite preview from the built `dist/` output.
- Starts `evenhub-simulator` with `--automation-port`.
- Captures the 576 x 288 glasses screenshot and checks that it is not black.
- Sends touchpad actions through `/api/input`.
- Checks webview console output for mapped reader actions.

This is still a simulator-based test. Final submission should also be checked on physical G2 hardware for Bluetooth update cadence, glyph rendering, swipe reliability, IndexedDB retention, and long-running WebView memory behavior.

## Limitations

- DRM-protected EPUB files are not supported.
- Image-heavy EPUBs, comics, and PDFs are out of scope for the MVP.
- Vertical writing and full ruby rendering are not preserved.
- The G2 display is not an HTML/CSS renderer; only SDK containers are used.
- Text chunk width may need hardware tuning for specific firmware and glyph sets.

## Package

After building and packing:

```sh
npm run build
npm run pack
```

The generated package is:

```text
lineflash-reader.ehpk
```

## Private Build Upload

Use this flow to upload a private build to Even Hub and test it on your own G2:

```sh
npm run verify:upload
npx evenhub login -e <your-even-hub-email>
npm run pack:check
```

Then open [Even Hub](https://hub.evenrealities.com/), enter Console, and upload `lineflash-reader.ehpk` from the project/package upload screen.

On hardware, confirm:

- First launch is not a black screen.
- Click toggles pause / resume.
- Swipe up decreases delay and shows speed feedback.
- Swipe down increases delay and shows speed feedback.
- Double click opens the system exit confirmation.
- Phone locked and Even Realities App backgrounded keeps the app responsive for about 5 minutes.
- Progress and speed restore after relaunch.
