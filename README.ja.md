# LineFlash Reader

LineFlash Reader は、Even Realities G2 向けの EPUB フラッシュ読書 Web アプリです。アプリ本体は G2 上ではなく Even Realities App 内の WebView で動作し、スマートフォン側で EPUB から本文を抽出して短い 1 行 chunk に分割し、Even Hub SDK 経由で G2 グラスへテキスト更新を送ります。

G2 側の表示は最小限です。中央に現在の 1 chunk、短時間のステータス表示、進捗、touchpad 操作のみを扱います。EPUB 解析、再生状態、設定、書籍キャッシュは WebView 側で管理します。

## 機能

- スマートフォン側 WebView でローカル `.epub` ファイルを選択。
- EPUB の spine 順に本文を抽出。
- EPUB 内 HTML をアプリ DOM に直接挿入しない安全な抽出。
- `script`、`style`、`svg`、`img`、`nav`、ルビ注釈など、表示対象外の要素を除去。
- 日本語、英語、混在文を punctuation、単語境界、grapheme segmentation、visual-width score で G2 向け chunk に分割。
- G2 には `textContainerUpgrade` で 1 chunk ずつ表示。
- G2 touchpad 操作:
  - click: 一時停止 / 再開
  - swipe up: 速度を上げる
  - swipe down: 速度を下げる
  - double click: 終了確認
- SDK local storage に再生速度と読書位置を保存し、Web `localStorage` に fallback。
- IndexedDB に抽出済み書籍と chunk をキャッシュ。
- EvenHub Simulator automation による G2 相当の E2E 検証。

## 必要環境

- Node.js 20 LTS または 22+
- npm

主な依存関係:

- Vite + TypeScript
- `@evenrealities/even_hub_sdk`
- `@evenrealities/evenhub-simulator`
- `@evenrealities/evenhub-cli`
- Vitest

## 開発開始

```sh
npm install
npm run dev
```

Vite の URL を EvenHub Simulator で開くか、通常のブラウザでスマートフォン側 UI を確認します。

## スクリプト

```sh
npm run dev
```

Vite 開発サーバーを起動します。

```sh
npm run build
```

TypeScript の型チェックを行い、production bundle を `dist/` に生成します。

```sh
npm test
```

chunker、EPUB 抽出、G2 event mapping、playback scheduler の unit test を実行します。

```sh
npm run test:e2e
```

アプリを build し、ローカル preview server と EvenHub Simulator を起動します。Simulator automation port 経由で、G2 framebuffer が黒画面ではないこと、click / swipe / double click が reader action に変換されることを確認します。

```sh
npm run pack
```

`dist/` と `app.json` から `lineflash-reader.ehpk` を生成します。

```sh
npm run pack:check
```

package を作成し、`package_id` の availability も確認します。事前に `evenhub login` が必要です。

```sh
npm run dev:host
npm run qr -- --url "http://<LAN-IP>:5173"
```

LAN からアクセスできる開発サーバーを起動し、実機 sideloading 用 QR を生成します。

## EvenHub Manifest

manifest は `app.json` に定義されています。

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

MVP はローカル EPUB の import のみを扱うため、network permission は要求していません。

## アーキテクチャ

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

主要モジュール:

- `src/epub/`: EPUB zip、OPF、spine、本文抽出。
- `src/reader/`: chunking、再生状態、scheduler。
- `src/g2/`: Even Hub bridge 接続、表示 container、入力 event mapping。
- `src/storage/`: SDK local storage fallback と IndexedDB 書籍キャッシュ。
- `src/ui/`: スマートフォン側操作 UI。
- `src/tests/`: unit test と simulator automation test。

## テスト方針

E2E test は EvenHub Simulator automation を使い、実機相当の検証経路として実行します。

- build 済み `dist/` から Vite preview を起動。
- `--automation-port` 付きで `evenhub-simulator` を起動。
- 576 x 288 の glasses screenshot を取得し、黒画面ではないことを検証。
- `/api/input` で touchpad action を送信。
- WebView console output から reader action への変換を確認。

ただし、これは simulator ベースのテストです。提出前には物理 G2 実機で Bluetooth 経由の更新頻度、glyph rendering、swipe の取りこぼし、IndexedDB 保持、長時間利用時の WebView memory を確認してください。

## 制限事項

- DRM 付き EPUB は非対応。
- 画像中心の EPUB、漫画、PDF は MVP の対象外。
- 縦書き再現と完全なルビ表示は保持しません。
- G2 は HTML/CSS renderer ではないため、SDK container のみで表示します。
- 実 firmware や glyph set によっては chunk 幅の調整が必要です。

## パッケージ作成

```sh
npm run build
npm run pack
```

生成される package:

```text
lineflash-reader.ehpk
```

## Private Build のアップロード

自分の G2 で private build を確認する場合は、次の流れで進めます。

```sh
npm run verify:upload
npx evenhub login -e <Even Hub account email>
npm run pack:check
```

その後、[Even Hub](https://hub.evenrealities.com/) を開き、Console に入り、project/package upload 画面から `lineflash-reader.ehpk` をアップロードします。

実機では以下を確認します。

- 初回起動で黒画面にならない。
- click で pause / resume が切り替わる。
- swipe up で delay が短くなり、速度表示が出る。
- swipe down で delay が長くなり、速度表示が出る。
- double click で system exit confirmation が出る。
- phone locked + Even Realities App backgrounded で約 5 分間 responsive のまま動く。
- 再起動後に読書位置と速度が復元される。
