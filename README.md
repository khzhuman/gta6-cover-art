# VICE FRAME

Your life, on the cover. VICE FRAME is an offline photo collage studio with cinematic sunset and neon grades, cream panel borders, and original, oversized caption lettering. It is the make.fun `gta6-cover-art-01` entry in this repository.

## Open the studio

Open `app/index.html` in desktop Chrome. There is no install, build step, account, or runtime connection to an external service. All scripts, styles, fonts, and sample photos are packaged under `app/`.

Any static server also works. For example, from the repository root:

```sh
python3 -m http.server 8080 --directory app
```

Then open `http://localhost:8080`. The server only serves your local files; the application does not contact any remote service.

## Make a cover

The studio opens with a finished **VICE SUMMER** cover. **Demo cover** restores Hero Split, the portrait hero with car and beach supporting panels, the subtitle **one last ride**, the Vice Sunset grade, and the square format in one click. Your imported photos remain in the library.

1. Drop one or several photos anywhere in the studio, browse with the upload control, or paste an image. New photos fill the current template automatically; a single photo fills every panel.
2. Click a cover panel or its numbered button, then click a photo to assign it. Drag the photo directly on the cover to pan. Zoom crops closer, and Reset crop recenters only that panel. **Use photo in all panels** repeats the selected photo with independent crops.
3. Choose Hero Split, Trio, Quad, or Wide Duo; pick Vice Sunset, Neon Nights, Golden Hour, or Clean; edit the caption and subtitle; and choose an output size.
4. **Export cover** downloads a PNG and opens a large result preview with another download link. The expand button opens that preview without starting a download.

The three exact output sizes are 1080 × 1080, 1080 × 1350, and 1920 × 1080 pixels. Every layout works in every format. The same canvas engine draws the live preview and the exported artwork. Long captions wrap into two balanced lines; lettering fits within the cover automatically.

Arrow keys pan the selected photo when the cover has focus; Shift pans faster. Plus and minus change zoom. Number keys select panels. Use the undo/redo buttons or Ctrl/Cmd + Z and Ctrl/Cmd + Shift + Z outside text fields.

## Photos and font

All six supplied sample photos appear in the sample strip: portrait, car, beach, man, boulevard, and pier. Small embedded WebP copies in `app/src/sample-pixels.js` keep demo and sample exports working when Chrome opens the page directly from disk. Static-server mode uses the supplied full-size JPEGs. Your own photos are decoded from the local file picker as data URLs in either mode, retaining their original resolution; they never leave your device.

The requested Anton download was attempted at the specified Google Fonts location, but this environment could not reach GitHub. The app therefore ships the requested fallback, **Liberation Sans Bold**, copied from `/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf`. It is registered locally as `ViceDisplay`; the renderer gives it condensed proportions, tight spacing, a forward slant, a thick dark outline, and a soft shadow. Only the font's naming metadata was adjusted: its family is named ViceDisplay and informational URL fields were removed to keep `app/` free of URL strings. The original glyph outlines and copyright notices are retained. Liberation is freely redistributable under the **SIL Open Font License 1.1**; its copyright notice and license are in `app/fonts/OFL.txt`.

VICE FRAME uses its own name, frame mark, lettering treatment, layouts, and interface. No Rockstar logo, wordmark, official artwork, character, or font is included.

## Package the entry

Node 22.18 or newer runs the TypeScript packaging script directly. It uses the Node standard library and the untouched kit dossier library.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Without `MAKEFUN_OUTPUT_DIR`, the destination is `/output`. The script copies `app/` and, when present, the orchestrator's `screenshots/` into that directory, then writes `dossier.json` with `buildDossier` and the kit's size limits. Each run replaces the output copies.

The orchestrator owns the repository's `screenshots/`. If that directory has not arrived yet, the script places a clearly named **sample-only packaging placeholder** in the output's `screenshots/`, because the dossier library requires an image even for a local packaging check. It is not a review screenshot. A later run with the real source screenshots replaces that placeholder automatically; the script never creates or edits the source `screenshots/`.

## Source

`app/src/templates.js` contains layout geometry and grade presets. `app/src/cover.js` handles cover-fit crops, compositing, texture, lettering, and full-size PNG rendering. `app/src/main.js` handles the library, editor controls, dragging, history, and download/preview flow. The editor uses ordered classic scripts so it also opens from a local file without module loading restrictions.

Application code is covered by the repository's MIT license. The bundled font retains its separate SIL Open Font License.
