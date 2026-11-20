import { dimensions, findByKey, panelShapes, treatments } from './templates.js';

const paper = '#fff0d9';
const gold = '#ffe078';
const display = 'ViceDisplay, Impact, sans-serif';

function outline(ctx, polygon) {
  const [[x, y], ...corners] = polygon;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (const corner of corners) ctx.lineTo(...corner);
  ctx.closePath();
}

export function photoBounds(image, frame, pose) {
  const { width: imageWidth, height: imageHeight } = image;
  const factor = pose.scale * Math.max(frame.width / imageWidth, frame.height / imageHeight);
  const width = imageWidth * factor;
  const height = imageHeight * factor;
  const overflowX = width - frame.width, overflowY = height - frame.height;
  return {
    width, height, overflowX, overflowY,
    left: frame.left - pose.horizontal * overflowX,
    top: frame.top - pose.vertical * overflowY
  };
}

function ramp(gradient, stops) {
  for (const [position, color] of stops) gradient.addColorStop(position, color);
  return gradient;
}

function exposedPhotos(ctx, design, library, panels, grade, strength, w, h) {
  const fallback = ramp(ctx.createLinearGradient(0, 0, w, h), [[0, '#393147'], [1, '#ce8a80']]);
  const contrast = 1 + strength * (grade.contrast - 1);
  const saturation = 1 + strength * (grade.saturation - 1);
  const gray = grade.key === 'neon' ? .4 * strength : 0;
  for (const panel of panels) {
    const pose = design.frames[panel.slot];
    const image = library.get(pose?.asset)?.bitmap;
    ctx.save();
    outline(ctx, panel.polygon);
    ctx.clip();
    if (!image) {
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.filter = 'contrast(' + contrast + ') saturate(' + saturation + ') grayscale(' + gray + ')';
      ctx.imageSmoothingQuality = 'high';
      const crop = photoBounds(image, panel, pose);
      ctx.drawImage(image, crop.left, crop.top, crop.width, crop.height);
    }
    ctx.restore();
  }
}

function reduceColors(ctx, w, h, levels) {
  const pixels = ctx.getImageData(0, 0, w, h);
  const channel = pixels.data;
  const interval = 255 / (levels - 1);
  const table = Uint8ClampedArray.from({ length: 256 }, (_, value) => Math.round(value / interval) * interval);
  for (let i = 0; i < channel.length; i += 4) {
    channel[i] = table[channel[i]];
    channel[i + 1] = table[channel[i + 1]];
    channel[i + 2] = table[channel[i + 2]];
  }
  ctx.putImageData(pixels, 0, 0);
}

function sequence(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const tiles = new Map();
function printTile(kind) {
  if (tiles.has(kind)) return tiles.get(kind);
  const tile = document.createElement('canvas');
  const side = kind === 'grain' ? 128 : 7;
  tile.width = tile.height = side;
  const ink = tile.getContext('2d');
  if (kind === 'grain') {
    const random = sequence(27183);
    const image = ink.createImageData(side, side);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const gray = Math.floor(44 + random() * 168);
      image.data.set([gray, gray, gray, 255], offset);
    }
    ink.putImageData(image, 0, 0);
  } else {
    ink.fillStyle = '#140b21';
    ink.beginPath();
    ink.arc(side / 2, side / 2, 1.45, 0, 2 * Math.PI);
    ink.fill();
  }
  tiles.set(kind, tile);
  return tile;
}

function colorAndTexture(ctx, design, grade, strength, w, h, inset) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, w - 2 * inset, h - 2 * inset);
  ctx.clip();
  const wash = ramp(ctx.createLinearGradient(0, 0, w * .18, h),
    grade.palette.map((color, index) => [index / (grade.palette.length - 1), color]));
  const flare = ramp(ctx.createRadialGradient(w * .1, h * .08, 0, w * .1, h * .08, w * .85),
    [[0, grade.palette[0]], [1, '#00000000']]);
  const shade = ramp(ctx.createLinearGradient(0, 0, 0, h),
    [[0, '#170d24aa'], [.4, '#170d2400'], [.76, '#170d2400'], [1, '#170d24b8']]);
  const layers = [[wash, grade.blend, grade.alpha * strength], [flare, 'screen', .15 * strength]];
  if (design.grain) {
    const strongGrain = ['goldenhour', 'poster'].includes(grade.key);
    layers.push([ctx.createPattern(printTile('grain'), 'repeat'), 'soft-light', strongGrain ? .22 : .12]);
  }
  if (design.halftone) layers.push([ctx.createPattern(printTile('dots'), 'repeat'), 'overlay', .15]);
  layers.push([shade, 'source-over', 1]);
  for (const [ink, blend, opacity] of layers) {
    ctx.fillStyle = ink;
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = opacity;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function letterRun(ctx, text, size, gap) {
  ctx.font = '700 ' + size + 'px Arial, sans-serif';
  const glyphs = Array.from(text ?? '', glyph => [glyph, ctx.measureText(glyph).width + gap]);
  const width = Math.max(0, glyphs.reduce((total, item) => total + item[1], 0) - gap);
  return { glyphs, width, font: ctx.font };
}

function printRun(ctx, run, x, baseline, space, color, centered = true) {
  const squeeze = Math.min(1, space / (run.width || 1));
  ctx.save();
  ctx.translate(x - (centered ? run.width * squeeze / 2 : 0), baseline);
  ctx.scale(squeeze, 1);
  ctx.font = run.font;
  ctx.fillStyle = color;
  let cursor = 0;
  for (const [glyph, advance] of run.glyphs) {
    ctx.fillText(glyph, cursor, 0);
    cursor += advance;
  }
  ctx.restore();
}

// A bounding box can extend beyond an angled panel edge. Fit the tab on both
// of its scanlines so clipping doesn't cut off the start or end of a caption.
function spanAt(polygon, y) {
  const crossings = [];
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    if ((y0 > y) !== (y1 > y)) crossings.push(x0 + (x1 - x0) * (y - y0) / (y1 - y0));
  }
  return [Math.min(...crossings), Math.max(...crossings)];
}

function castTabs(ctx, panels, labels, h, u, paperInset) {
  const inset = u * .012, padding = u * .008;
  for (const panel of panels) {
    const label = labels?.[panel.slot];
    const role = label?.role?.trim().toUpperCase();
    if (!role) continue;
    const sub = label.sub?.trim().toUpperCase();
    const bottom = panel.top + panel.height;
    const band = u * (sub ? .052 : .034);
    const atCoverCorner = panel.top === paperInset && panel.left === paperInset;
    const top = panel.top + inset + (atCoverCorner ? u * .034 : 0);
    const y = h - bottom <= u * .17 ? top : bottom - inset - band;
    const spans = [spanAt(panel.polygon, y), spanAt(panel.polygon, y + band)];
    const x = Math.max(panel.left, ...spans.map(span => span[0])) + inset;
    const room = Math.min(panel.width * .92, Math.min(...spans.map(span => span[1])) - x - inset) - 2 * padding;
    if (room <= 0) continue;

    ctx.save();
    outline(ctx, panel.polygon);
    ctx.clip();
    const caption = letterRun(ctx, sub, u * .0115, u * .0012);
    const roleFont = size => '700 ' + size + 'px ' + display;
    let size = u * .024;
    ctx.font = roleFont(size);
    size *= Math.min(1, room / (ctx.measureText(role).width * .84));
    ctx.font = roleFont(size);
    const roleWidth = Math.min(room, ctx.measureText(role).width * .84);
    const tabWidth = Math.min(room, Math.max(caption.width, roleWidth));
    ctx.fillStyle = '#0d0714ee';
    ctx.fillRect(x, y, tabWidth + 2 * padding, band);
    ctx.fillStyle = paper;
    ctx.fillText(role, x + padding, y + u * .025, roleWidth);
    if (sub) printRun(ctx, caption, x + padding, y + u * .042, room, '#ffd9a8', false);
    ctx.restore();
  }
}

function titleRows(headline = '') {
  const text = headline.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!text) return [];
  if (text.length < 19 || !text.includes(' ')) return [text];
  const breaks = Array.from(text.matchAll(/ /g), match => match.index);
  const split = breaks.reduce((best, next) =>
    Math.abs(text.length - 1 - 2 * next) < Math.abs(text.length - 1 - 2 * best) ? next : best);
  return [text.slice(0, split), text.slice(split + 1)];
}

function masthead(ctx, design, w, u) {
  const middle = w / 2;
  const rows = titleRows(design.headline);
  ctx.save();
  ctx.shadowColor = '#160a1c';
  ctx.shadowBlur = u * .006;
  const credit = letterRun(ctx, 'A VICE FRAME ORIGINAL', u * .011, u * .003);
  printRun(ctx, credit, middle, u * .045, w * .7, paper);

  let size = u * (rows.length > 1 ? .193 : .235);
  ctx.font = '700 ' + size + 'px ' + display;
  const widest = Math.max(1, ...rows.map(row => ctx.measureText(row).width));
  size *= Math.min(1, w * .79 / (.66 * widest + .13 * size));
  let baseline = u * .10;
  for (const [index, row] of rows.entries()) {
    baseline = u * .071 + size * (.79 + index * .87);
    ctx.save();
    ctx.translate(middle, baseline);
    ctx.transform(.66, 0, -.07, 1, 0, 0);
    ctx.font = '700 ' + size + 'px ' + display;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * .13;
    ctx.strokeStyle = '#160a1c';
    ctx.shadowBlur = u * .013;
    ctx.shadowOffsetY = u * .007;
    ctx.strokeText(row, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = ramp(ctx.createLinearGradient(0, -size * .75, 0, 0),
      [[0, '#ffe95c'], [.35, '#ffb03a'], [.68, '#ff5e7a'], [1, '#b04fd8']]);
    ctx.fillText(row, 0, 0);
    ctx.restore();
  }
  const subtitle = design.tagline?.trim();
  if (subtitle) {
    ctx.translate(middle, baseline + u * .047);
    ctx.rotate(-.03);
    ctx.textAlign = 'center';
    ctx.font = "italic 700 " + u * .045 + "px 'Segoe Script','Brush Script MT',cursive";
    ctx.fillStyle = '#ffd7f4';
    ctx.shadowColor = '#ff2fb3';
    ctx.shadowBlur = u * .013;
    ctx.fillText(subtitle, 0, 0, w * .78);
  }
  ctx.restore();
}

function cornerMarks(ctx, w, u, inset) {
  const left = inset + u * .012, top = inset + u * .012;
  const bugWidth = u * .072;
  ctx.strokeStyle = paper;
  ctx.lineWidth = u * .0012;
  ctx.strokeRect(left, top, bugWidth, u * .028);
  printRun(ctx, letterRun(ctx, 'VOL. 1', u * .014, u * .001),
    left + bugWidth / 2, top + u * .019, bugWidth * .85, paper);

  const radius = u * .042;
  const x = w - left - radius, y = top + radius;
  ctx.fillStyle = ramp(ctx.createRadialGradient(x - radius * .3, y - radius * .36, 0, x, y, radius),
    [[0, '#fff6a7'], [.63, '#f4c95d'], [1, '#b77426']]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 ' + u * .052 + 'px Arial, sans-serif';
  ctx.fillStyle = '#352014';
  ctx.fillText('★', x, y);
  ctx.restore();
  ['ORIGINAL', 'COVER ART'].forEach((line, i) => {
    printRun(ctx, letterRun(ctx, line, u * .0085, u * .0015),
      x, y + radius + u * (.014 + i * .012), radius * 2, paper);
  });
}

function barcode(ctx, x, y, u) {
  const width = u * .105, height = u * .046;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#161018';
  const random = sequence(613);
  const edge = x + width - u * .007;
  for (let cursor = x + u * .007; cursor < edge;) {
    const bar = u * (.0009 + random() * .0026);
    ctx.fillRect(cursor, y + u * .005, Math.min(bar, edge - cursor), u * .024);
    cursor += bar + u * (.0008 + random() * .0016);
  }
  printRun(ctx, letterRun(ctx, 'VF-001', u * .008, u * .0011),
    x + width / 2, y + u * .040, width, '#161018');
}

function creditsAndPress(ctx, design, w, h, u, inset) {
  const stripBottom = h - u * .082;
  const stripTop = stripBottom - u * .036;
  const left = inset + u * .012;
  ctx.save();
  ctx.shadowColor = '#140a1c';
  ctx.shadowBlur = u * .005;
  ctx.fillStyle = gold;
  ctx.font = '700 ' + u * .020 + 'px Arial, sans-serif';
  ctx.fillText('★★★★★', left, stripTop - u * .056);
  ctx.fillStyle = paper;
  ctx.font = 'italic 700 ' + u * .019 + 'px Arial, sans-serif';
  ctx.fillText((design.quote ?? '').toUpperCase(), left, stripTop - u * .031, w - 2 * left - u * .12);
  if (design.paper?.trim()) {
    const source = letterRun(ctx, '— ' + design.paper.toUpperCase(), u * .0115, u * .0014);
    printRun(ctx, source, left, stripTop - u * .012, w - 2 * left - u * .12, paper, false);
  }
  ctx.restore();
  barcode(ctx, w - left - u * .105, stripTop - u * .055, u);

  ctx.fillStyle = '#160a1ccc';
  ctx.fillRect(inset, stripTop, w - 2 * inset, stripBottom - stripTop);
  const strip = letterRun(ctx, design.strip?.toUpperCase(), u * .017, u * .0024);
  printRun(ctx, strip, w / 2, stripBottom - u * .012, w - 2 * left, paper);

  ctx.save();
  ctx.shadowColor = '#160a1c';
  ctx.shadowBlur = u * .005;
  const credits = [
    ['A VICE FRAME PICTURES PRODUCTION', .05, .0115],
    ['STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND', .024, .0105]
  ];
  for (const [line, offset, size] of credits) {
    printRun(ctx, letterRun(ctx, line, u * size, u * .0019), w / 2, h - u * offset, w - 2 * left, paper);
  }
  ctx.restore();
}

export function paintCover(canvas, design, library, width, height, selected = -1) {
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d', { alpha: false });
  const w = canvas.width, h = canvas.height;
  const unit = Math.min(w, h), inset = unit * .014;
  const grade = findByKey(treatments, design.grade);
  const panels = panelShapes(design.template, w, h);
  const strength = design.intensity / 100;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  exposedPhotos(ctx, design, library, panels, grade, strength, w, h);
  if (grade.steps) reduceColors(ctx, w, h, grade.steps);
  colorAndTexture(ctx, design, grade, strength, w, h, inset);
  ctx.strokeStyle = paper;
  ctx.lineWidth = unit * .007;
  ctx.lineJoin = 'round';
  for (const panel of panels) {
    outline(ctx, panel.polygon);
    ctx.stroke();
  }
  masthead(ctx, design, w, unit);
  cornerMarks(ctx, w, unit, inset);
  creditsAndPress(ctx, design, w, h, unit, inset);
  castTabs(ctx, panels, design.labels, h, unit, inset);
  if (panels[selected]) {
    ctx.strokeStyle = '#ffbc9a';
    ctx.lineWidth = unit * .008;
    ctx.setLineDash([unit * .015, unit * .01]);
    outline(ctx, panels[selected].polygon);
    ctx.stroke();
  }
  return canvas;
}

export async function makePNG(design, library) {
  await document.fonts.ready;
  const size = findByKey(dimensions, design.size);
  const surface = document.createElement('canvas');
  paintCover(surface, design, library, size.width, size.height);
  return new Promise((resolve, reject) => {
    surface.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error('Could not encode your cover.'));
    }, 'image/png');
  });
}
