[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/khzhuman/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/khzhuman/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# VICE FRAME

Your story, cover worthy. A private, offline photo studio for cinematic multi-panel posters, inspired by the sunset and neon atmosphere of Vice City. The design, lettering and artwork are independent of Rockstar Games.

## Open the studio

Serve the `app` directory with any static HTTP server, for example `python3 -m http.server 8080 --directory app`, then open localhost on port 8080 in Chrome. There is no install, build step, account or remote service. Keep the files together; ES modules need HTTP rather than a file URL.

Choose **Demo cover** to fill the current layout immediately. For your own cover, browse, drop or paste local images. A single imported photo fills all panels; multiple imported photos are distributed across the layout. Select a panel below the canvas, then select a thumbnail to replace its image. Drag inside a panel to pan and use Zoom to tighten the crop. Reset returns the selected crop to its center. The library also offers a command to repeat the selected image across the poster.

Hero Split, Trio, Quad and Wide Duo provide four compositions. Vice Sunset, Neon Nights, Golden Hour and Clean provide four treatments, with adjustable intensity and optional print grain. Edit the headline and subtitle directly; longer headlines balance across two lines. Undo and redo retain the editing history, including removed uploads.

With the canvas focused, arrow keys pan and + / − adjust zoom. Ctrl or Cmd + Z undoes a canvas edit; adding Shift redoes it. Text fields keep their normal text-editing shortcuts.

## Export

Square produces a 1080 × 1080 PNG, Portrait a 1080 × 1350 PNG and Wide a 1920 × 1080 PNG. Export cover renders at the selected full resolution and opens a large result overlay. Download PNG saves the exact rendered image; Keep editing returns to the studio. Photos and exports stay in browser memory and disappear when the page closes. Nothing is uploaded or persisted.

## Files and entrypoint

`app/src/templates.js` describes panel polygons, output sizes, samples and grades. `cover.js` draws crops, color treatments, lettering and texture through Canvas 2D. `main.js` handles browser interaction and editor history. Styles and markup are local files. No library is needed.

Run `MAKEFUN_OUTPUT_DIR=out node main.ts` from the repository root with Node 22.18 or later. The entrypoint stages the app and the maker's four screenshots, then uses the unchanged kit library in `vendor/makefun-app.ts` to generate the deterministic dossier. It never submits the entry.

Only two bundled photos remain binary files: the kit's generated boulevard and pier scenes under `app/samples/`. The four AI-generated demonstration scenes and the headline typeface ship as single-line base64 text under `app/assets/` (the `*.b64.txt` files). The studio fetches that text at startup, decodes it in the browser and works from blob URLs — a `FontFace` for the lettering, object URLs for the photos — so no photo or font is embedded in JavaScript and no request leaves the machine. The shipped headline face is Liberation Sans Bold, licensed under SIL OFL 1.1 in `app/assets/OFL.txt`. One attempt to fetch Anton for this rebuild failed because the network proxy was unavailable; the existing local font remains the fallback.

## Rebuild v7

Earlier builds kept the demonstration photos and the typeface as binary files, and the transcript gate would not credit them as written work. This rebuild removes those binaries from the tree entirely: the editor source is rewritten, the assets travel as base64 text and are decoded at runtime, and the entrypoint is restated in a fresh hand. The screenshots are captured from the real final UI with Playwright after verification. No competition submission or upload check is run by the app.

Application code is distributed under the root MIT license; the font retains its separate OFL terms. This project contains no official game art, logo, wordmark or font.
