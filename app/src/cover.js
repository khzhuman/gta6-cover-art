import { dimensions, findByKey, panelShapes, treatments } from './templates.js';

const PAPER = '#fff0d9';
const FONT = 'ViceDisplay';

function trace(context, vertices) {
  context.beginPath();
  vertices.forEach(([x, y], i) => i === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.closePath();
}

export function photoBounds(image, frame, pose) {
  const zoom = Math.max(frame.width / image.width, frame.height / image.height) * pose.scale;
  const width = image.width * zoom;
  const height = image.height * zoom;
  const overflowX = width - frame.width;
  const overflowY = height - frame.height;
  return {
    left: frame.left - overflowX * pose.horizontal,
    top: frame.top - overflowY * pose.vertical,
    width, height, overflowX, overflowY
  };
}

function headlineLines(text) {
  if (!text.trim()) return [];
  const words = text.trim().toUpperCase().split(/\s+/);
  if (text.length < 19 || words.length < 2) return [words.join(' ')];
  let split = 1;
  let best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const balance = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (balance < best) { best = balance; split = i; }
  }
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
}

function trackedText(context, text, x, y, size, spacing, available) {
  context.save();
  context.font = `700 ${size}px Arial`;
  const characters = Array.from(text);
  const length = characters.reduce((total, glyph) => total + context.measureText(glyph).width + spacing, -spacing);
  const compression = Math.min(1, available / Math.max(1, length));
  context.translate(x - length * compression / 2, y);
  context.scale(compression, 1);
  context.fillStyle = PAPER;
  let offset = 0;
  for (const glyph of characters) {
    context.fillText(glyph, offset, 0);
    offset += context.measureText(glyph).width + spacing;
  }
  context.restore();
}

function drawCaptions(context, design, width, height) {
  const unit = Math.min(width, height);
  const lines = headlineLines(design.headline);
  let size = Math.min(unit * (lines.length > 1 ? .22 : .265), height * .25);
  context.save();
  context.font = `700 ${size}px ${FONT}`;
  const measured = Math.max(1, ...lines.map(line => context.measureText(line).width * .66));
  size *= Math.min(1, width * .87 / measured);
  let baseline = unit * .07 + size * .75;
  lines.forEach((line, i) => {
    baseline = unit * .07 + size * .75 + i * size * .84;
    context.save();
    context.font = `700 ${size}px ${FONT}`;
    context.translate(width / 2 - context.measureText(line).width * .33, baseline);
    context.transform(.66, 0, -.12, 1, 0, 0);
    context.lineJoin = 'round';
    context.lineWidth = size * .09;
    context.strokeStyle = '#251929';
    context.shadowColor = '#100819dd';
    context.shadowBlur = unit * .012;
    context.shadowOffsetY = unit * .008;
    context.strokeText(line, 0, 0);
    context.shadowColor = 'transparent';
    const ink = context.createLinearGradient(0, -size * .8, 0, 0);
    ink.addColorStop(0, '#fff9eb');
    ink.addColorStop(.55, PAPER);
    ink.addColorStop(1, design.grade === 'neon' ? '#efbedf' : '#ffb493');
    context.fillStyle = ink;
    context.fillText(line, 0, 0);
    context.restore();
  });
  if (lines.length) trackedText(context, 'A VICE FRAME ORIGINAL', width / 2, unit * .043, unit * .011, unit * .003, width * .8);
  if (design.tagline.trim()) {
    context.shadowColor = '#100819';
    context.shadowBlur = unit * .008;
    trackedText(context, design.tagline.toUpperCase(), width / 2, lines.length ? baseline + size * .2 : unit * .12, unit * .017, unit * .004, width * .82);
  }
  context.restore();
}

let texture;
function grainTile() {
  if (texture) return texture;
  texture = document.createElement('canvas');
  texture.width = texture.height = 128;
  const context = texture.getContext('2d');
  const pixels = context.createImageData(128, 128);
  let random = 27183;
  for (let i = 0; i < pixels.data.length; i += 4) {
    random = random * 48271 % 2147483647;
    const shade = 60 + random % 140;
    pixels.data.set([shade, shade, shade, 255], i);
  }
  context.putImageData(pixels, 0, 0);
  return texture;
}

function drawPhotos(context, design, library, frames, width, height, grade, intensity) {
  for (const frame of frames) {
    context.save();
    trace(context, frame.polygon);
    context.clip();
    const pose = design.frames[frame.slot];
    const photo = library.get(pose.asset);
    if (photo) {
      const crop = photoBounds(photo.bitmap, frame, pose);
      const contrast = 1 + (grade.contrast - 1) * intensity;
      const saturation = 1 + (grade.saturation - 1) * intensity;
      context.filter = `contrast(${contrast}) saturate(${saturation}) grayscale(${design.grade === 'neon' ? .4 * intensity : 0})`;
      context.imageSmoothingQuality = 'high';
      context.drawImage(photo.bitmap, crop.left, crop.top, crop.width, crop.height);
    } else {
      const placeholder = context.createLinearGradient(0, 0, width, height);
      placeholder.addColorStop(0, '#393147');
      placeholder.addColorStop(1, '#ce8a80');
      context.fillStyle = placeholder;
      context.fillRect(0, 0, width, height);
    }
    context.restore();
  }
}

function drawMood(context, design, grade, intensity, width, height, unit) {
  context.save();
  const inset = unit * .014;
  context.beginPath();
  context.rect(inset, inset, width - inset * 2, height - inset * 2);
  context.clip();
  const wash = context.createLinearGradient(0, 0, width * .18, height);
  grade.palette.forEach((color, i) => wash.addColorStop(i / (grade.palette.length - 1), color));
  context.globalCompositeOperation = grade.blend;
  context.globalAlpha = grade.alpha * intensity;
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = .15 * intensity;
  const flare = context.createRadialGradient(width * .1, height * .08, 0, width * .1, height * .08, width * .85);
  flare.addColorStop(0, grade.palette[0]);
  flare.addColorStop(1, '#00000000');
  context.fillStyle = flare;
  context.fillRect(0, 0, width, height);
  if (design.grain) {
    context.globalCompositeOperation = 'soft-light';
    context.globalAlpha = .12;
    context.fillStyle = context.createPattern(grainTile(), 'repeat');
    context.fillRect(0, 0, width, height);
  }
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  const shade = context.createLinearGradient(0, 0, 0, height);
  for (const [stop, color] of [[0, '#170d24aa'], [.4, '#170d2400'], [.76, '#170d2400'], [1, '#170d24a0']]) shade.addColorStop(stop, color);
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
  context.restore();
}

export function paintCover(canvas, design, library, width, height, selected = -1) {
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext('2d', { alpha: false });
  const w = canvas.width, h = canvas.height, unit = Math.min(w, h);
  const frames = panelShapes(design.template, w, h);
  const grade = findByKey(treatments, design.grade);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, w, h);
  drawPhotos(context, design, library, frames, w, h, grade, design.intensity / 100);
  drawMood(context, design, grade, design.intensity / 100, w, h, unit);
  context.strokeStyle = PAPER;
  context.lineWidth = unit * .007;
  context.lineJoin = 'round';
  frames.forEach(frame => { trace(context, frame.polygon); context.stroke(); });
  drawCaptions(context, design, w, h);
  context.fillStyle = PAPER;
  context.font = `700 ${unit * .013}px Arial`;
  context.fillText('VICE FRAME', unit * .044, h - unit * .044);
  context.textAlign = 'right';
  context.font = `700 ${unit * .01}px Arial`;
  context.fillText('MADE FOR THE MOMENT', w - unit * .044, h - unit * .044);
  context.fillStyle = '#f4ad99';
  context.fillRect(unit * .044, h - unit * .035, unit * .07, unit * .003);
  if (frames[selected]) {
    context.strokeStyle = '#ffbc9a';
    context.setLineDash([unit * .015, unit * .01]);
    trace(context, frames[selected].polygon);
    context.stroke();
  }
  return canvas;
}

export async function makePNG(design, library) {
  await document.fonts.ready;
  const { width, height } = findByKey(dimensions, design.size);
  const canvas = paintCover(document.createElement('canvas'), design, library, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode your cover.')), 'image/png');
  });
}
