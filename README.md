[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/khzhuman/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/khzhuman/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# VICE FRAME

Your life, on the cover. An original photo poster studio with cream collage borders, oversized lettering, sunset warmth and neon color. Vanilla JavaScript and Canvas 2D power both the live editor and full-resolution PNG output.

## Start locally

Serve the static application from this repository:

```sh
python3 -m http.server 8080 --directory app
```

Open `http://localhost:8080` in Chrome. There is no build step, dependency installation, account or external runtime request. Serve over HTTP so the bundled sample JPEGs remain usable in canvas exports. Every sample, script, stylesheet and font is a local file under `app/`.

## Create your poster

**Demo cover** restores the Hero Split layout with portrait, car and coastline samples, the VICE SUMMER headline, and Vice Sunset mood. All six sample scenes are available in the library, including the kit's boulevard and pier images and the four supplied AI images.

1. Browse, drop or paste your own photos. A single photo fills the whole layout; several photos fill successive panels.
2. Select a numbered panel or click it on the canvas, then choose its photo. Drag to pan, adjust Zoom, or reset that crop. Repeat one photo across all panels with independent positioning.
3. Pick Hero Split, Trio, Quad or Wide Duo. Choose Vice Sunset, Neon Nights, Golden Hour or Clean, and adjust the grade intensity and print grain.
4. Edit the headline and subtitle. Long headlines balance across two lines and fit the poster width.
5. Select Square (1080 × 1080), Portrait (1080 × 1350) or Wide (1920 × 1080). **Export cover** downloads a PNG and opens a large result overlay. The expand control opens the same full-resolution result without triggering a download.

Undo and redo work from their buttons or Ctrl/Cmd + Z and Ctrl/Cmd + Shift + Z. Focus the cover to pan with arrow keys (Shift moves faster), zoom with + / −, or select panels with 1–4. The demo preserves imported photos in the library.

## Privacy and assets

Imported images stay in browser memory as local object URLs. No photo is uploaded. Sample photos load exclusively from the six JPEG files in `app/samples/`; there are no embedded photo copies or runtime font hotlinks.

The one attempted Anton download failed because the environment's proxy was unreachable. This build retains the supplied Liberation Sans Bold fallback in `app/fonts/LiberationSans-Bold.ttf`, registered as FrameHeadline. Canvas applies condensed spacing, a slight slant, an ink outline and peach highlights. The font's existing internal ViceDisplay naming and its accompanying SIL Open Font License remain intact. No game font, official artwork, Rockstar mark or character asset is used.

## Packaging

Node 22.18 or later runs the starter entrypoint unchanged:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

The starter copies `app/` and `screenshots/` and writes `dossier.json` using the unchanged `vendor/makefun-app.ts`. Its default destination is `/output`. Use a fresh output directory for independent runs; the entrypoint is the kit's exact plumbing, with no output cleanup or screenshot substitution.

The four JPEGs in `screenshots/` show actual browser states captured after completing and verifying the app: a wide exported cover, the Hero Split editor, a portrait neon export, and the Trio editor with Golden Hour.

`app/src/templates.js` defines geometry, sample paths, grades and dimensions. `app/src/cover.js` paints photos, crops, grading, texture and typography. `app/src/main.js` connects the editor, local image library, history and PNG result flow. Application code is MIT licensed; the font retains its separate OFL license.
