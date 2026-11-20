import { bounds, grades, templates } from './templates.js';

const ink = '#100d19';
const cream = '#fff1d5';
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (a, b, weight) => a + (b - a) * weight;

function polygon(ctx, points, width, height) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * width, y * height);
    else ctx.lineTo(x * width, y * height);
  });
  ctx.closePath();
}

function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function headlineSeed(text) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.codePointAt(0), 16777619);
  return seed;
}

function gradient(ctx, x, y, endX, endY, colors) {
  const paint = ctx.createLinearGradient(x, y, endX, endY);
  colors.forEach((color, index) => paint.addColorStop(index / (colors.length - 1), color));
  return paint;
}

function coverPhoto(ctx, image, width, height, crop) {
  const fit = Math.max(width / image.naturalWidth, height / image.naturalHeight) * crop.zoom;
  const drawWidth = image.naturalWidth * fit;
  const drawHeight = image.naturalHeight * fit;
  const x = clamp((width - drawWidth) / 2 + crop.x * width, width - drawWidth, 0);
  const y = clamp((height - drawHeight) / 2 + crop.y * height, height - drawHeight, 0);
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function rgb(hex) {
  const number = Number.parseInt(hex.slice(1), 16);
  return [number >> 16, (number >> 8) & 255, number & 255];
}

function gradePhoto(ctx, width, height, grade, strength, halftone, unit) {
  if (!strength) return;
  const raster = ctx.getImageData(0, 0, width, height);
  const pixels = raster.data;
  const palette = grade.colors.map(rgb).reverse();
  if (grade.steps) {
    const levels = grade.steps - 1;
    for (let p = 0; p < pixels.length; p += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const value = pixels[p + channel];
        pixels[p + channel] = mix(value, Math.round(value * levels / 255) * 255 / levels, strength);
      }
    }
  } else {
    // Precompute the sunset ramp so a preview redraw only needs a lookup per pixel.
    const ramp = Array.from({ length: 256 }, (_, luma) => {
      const position = luma * (palette.length - 1) / 255;
      const index = Math.min(Math.floor(position), palette.length - 2);
      return palette[index].map((value, channel) => mix(value, palette[index + 1][channel], position - index));
    });
    for (let p = 0; p < pixels.length; p += 4) {
      const luma = Math.round(.2126 * pixels[p] + .7152 * pixels[p + 1] + .0722 * pixels[p + 2]);
      const color = ramp[luma];
      for (let channel = 0; channel < 3; channel++) {
        const value = pixels[p + channel];
        const saturated = luma + (value - luma) * grade.saturation;
        const contrasted = clamp((saturated - 127.5) * grade.contrast + 127.5, 0, 255);
        pixels[p + channel] = mix(value, mix(contrasted, color[channel], .28), strength);
      }
    }
  }
  ctx.putImageData(raster, 0, 0);
  if (grade.steps && halftone) {
    const step = Math.max(4, Math.round(8 * unit));
    ctx.fillStyle = `rgba(19,10,30,${strength * .48})`;
    ctx.beginPath();
    for (let y = Math.floor(step / 2); y < height; y += step) {
      for (let x = Math.floor(step / 2); x < width; x += step) {
        const p = (y * width + x) * 4;
        const light = (.2126 * pixels[p] + .7152 * pixels[p + 1] + .0722 * pixels[p + 2]) / 255;
        const radius = step * (.06 + .32 * (1 - light));
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

function drawFrames(ctx, state, assets, width, height, unit, grade) {
  const raster = ctx.canvas.ownerDocument.createElement('canvas');
  const photoCtx = raster.getContext('2d', { willReadFrequently: true });
  const frames = templates[state.template].panels;
  frames.forEach((frame, index) => {
    const panel = state.panels[index];
    const image = assets.get(panel.photo)?.bitmap;
    const box = bounds(frame.points);
    const x = Math.floor(box.left * width);
    const y = Math.floor(box.top * height);
    const w = Math.ceil(box.right * width) - x;
    const h = Math.ceil(box.bottom * height) - y;
    ctx.save();
    polygon(ctx, frame.points, width, height);
    ctx.clip();
    ctx.fillStyle = gradient(ctx, x, y, x + w, y + h, ['#572f55', '#20172f']);
    ctx.fillRect(x, y, w, h);
    if (image) {
      raster.width = w;
      raster.height = h;
      coverPhoto(photoCtx, image, w, h, panel.crop);
      gradePhoto(photoCtx, w, h, grade, state.intensity / 100, state.halftone, unit);
      ctx.drawImage(raster, x, y);
    }
    ctx.fillStyle = gradient(ctx, x, y, x, y + h, ['#140d260d', '#150b1910', '#10091670']);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  });

  ctx.strokeStyle = ink;
  ctx.lineWidth = 6 * unit;
  ctx.lineJoin = 'round';
  for (const frame of frames) {
    polygon(ctx, frame.points, width, height);
    ctx.stroke();
  }
}

function frameCaptions(ctx, state, width, height, unit) {
  templates[state.template].panels.forEach(({ points, label }, index) => {
    const { role, sub } = state.panels[index];
    const [x, y] = [label[0] * width, label[1] * height];
    const limit = Math.max(1, (bounds(points).right - label[0] - .02) * width);
    ctx.save();
    polygon(ctx, points, width, height);
    ctx.clip();
    ctx.shadowColor = '#140c1c';
    ctx.shadowBlur = 8 * unit;
    ctx.shadowOffsetY = 2 * unit;
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(x, y - 25 * unit, 22 * unit, 2 * unit);
    ctx.font = `900 ${22 * unit}px system-ui, sans-serif`;
    ctx.fillStyle = cream;
    ctx.fillText(role, x, y, limit);
    ctx.font = `italic ${15 * unit}px Georgia, serif`;
    ctx.fillStyle = '#ffddce';
    ctx.fillText(sub, x, y + 19 * unit, limit);
    ctx.restore();
  });
}

function outline(ctx, text, x, y, width, weight, paint) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = weight;
  ctx.strokeStyle = '#0b0710';
  ctx.strokeText(text, x, y, width);
  ctx.fillStyle = paint;
  ctx.fillText(text, x, y, width);
}

function title(ctx, state, width, height, unit) {
  const y = height * .51;
  const size = Math.min(width * .162, height * .20);
  const colors = grades.golden.colors;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 ${size}px ViceDisplay, Impact, sans-serif`;
  outline(ctx, state.headline, width / 2, y, width * .84, 14 * unit,
    gradient(ctx, 0, y - size * .82, 0, y + size * .10, colors));

  ctx.font = `italic 600 ${47 * unit}px 'Brush Script MT', 'Segoe Script', cursive`;
  ctx.shadowColor = '#ff438f';
  ctx.shadowBlur = 17 * unit;
  outline(ctx, state.tagline, width / 2, y + 49 * unit, width * .64, 4 * unit, '#ffe2ee');
  ctx.restore();
}

function seal(ctx, x, y, unit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.16);
  ctx.beginPath();
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI / 32;
    const radius = (i % 2 ? 40 : 44) * unit;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = gradient(ctx, 0, -44 * unit, 0, 44 * unit, ['#ffed9c', '#d28d45', '#ffe4a1']);
  ctx.fill();
  ctx.strokeStyle = '#683e32';
  ctx.lineWidth = 1.5 * unit;
  ctx.beginPath();
  ctx.arc(0, 0, 35 * unit, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#41262b';
  ctx.font = `900 ${10 * unit}px system-ui, sans-serif`;
  ctx.fillText('ORIGINAL', 0, -6 * unit);
  ctx.fillText('COVER ART', 0, 8 * unit);
  ctx.fillText('✦', 0, 22 * unit);
  ctx.restore();
}

function barcode(ctx, headline, x, y, unit) {
  const random = randomFrom(headlineSeed(headline));
  const width = 91 * unit;
  ctx.fillStyle = cream;
  ctx.fillRect(x, y, width, 35 * unit);
  ctx.fillStyle = ink;
  let cursor = 5 * unit;
  while (cursor < width - 6 * unit) {
    const bar = (1 + Math.floor(random() * 3)) * unit;
    ctx.fillRect(x + cursor, y + 5 * unit, Math.min(bar, width - 5 * unit - cursor), 24 * unit);
    cursor += bar + (1 + Math.floor(random() * 2)) * unit;
  }
}

function coverLines(ctx, state, width, height, unit) {
  const margin = width * .028;
  ctx.save();
  ctx.font = `800 ${17 * unit}px ui-monospace, monospace`;
  outline(ctx, state.paper.toUpperCase(), margin, 43 * unit, width * .6, 5 * unit, cream);
  ctx.textAlign = 'right';
  outline(ctx, 'VOL. 1', width - margin, 43 * unit, width * .15, 5 * unit, '#ffcf83');
  ctx.restore();

  const ribbonY = height * .755;
  const ribbonHeight = 36 * unit;
  ctx.fillStyle = gradient(ctx, 0, 0, width, 0, ['#fbc36f', '#ec9d7b', '#dd678f']);
  ctx.fillRect(0, ribbonY, width, ribbonHeight);
  ctx.fillStyle = ink;
  ctx.fillRect(0, ribbonY - 3 * unit, width, 3 * unit);
  ctx.fillRect(0, ribbonY + ribbonHeight, width, 3 * unit);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `900 ${16 * unit}px system-ui, sans-serif`;
  ctx.fillText(state.strip, width / 2, ribbonY + 23 * unit, width * .91);
  ctx.font = `700 ${20 * unit}px system-ui, sans-serif`;
  outline(ctx, '★ ★ ★ ★ ★', width / 2, height * .824, width * .44, 3 * unit, '#ffdc7b');
  ctx.font = `italic 700 ${17 * unit}px Georgia, serif`;
  outline(ctx, state.quote, width / 2, height * .854, width * .47, 4 * unit, cream);
  ctx.restore();

  seal(ctx, width - margin - 50 * unit, height * .66, unit);
  const foot = height * .917;
  ctx.fillStyle = '#100d19ef';
  ctx.fillRect(0, foot, width, height - foot);
  ctx.fillStyle = '#ffbe75';
  ctx.fillRect(0, foot, width, unit);
  barcode(ctx, state.headline, width - margin - 91 * unit, foot + 17 * unit, unit);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe0b1';
  ctx.font = `800 ${12 * unit}px ui-monospace, monospace`;
  ctx.fillText(state.paper.toUpperCase() + '  /  VICE FRAME STUDIO', width / 2, foot + 23 * unit, width * .65);
  ctx.font = `700 ${11 * unit}px ui-monospace, monospace`;
  ctx.fillText('STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND', width / 2, foot + 42 * unit, width * .69);
  ctx.restore();
}

function filmGrain(ctx, width, height, unit, opacity) {
  const random = randomFrom(19790317);
  const speck = Math.max(1, Math.round(unit * 1.5));
  const amount = Math.round(width * height / (45 * speck * speck));
  ctx.save();
  ctx.globalAlpha = opacity;
  for (const color of ['#fff5db', '#160e21']) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < amount; i++) {
      ctx.rect(Math.floor(random() * width), Math.floor(random() * height), speck, speck);
    }
    ctx.fill();
  }
  ctx.restore();
}

export function drawCover(ctx, state, assets) {
  const { width, height } = ctx.canvas;
  const unit = Math.min(width, height) / 1080;
  const grade = grades[state.grade];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, width, height);
  drawFrames(ctx, state, assets, width, height, unit, grade);
  frameCaptions(ctx, state, width, height, unit);
  title(ctx, state, width, height, unit);
  coverLines(ctx, state, width, height, unit);
  if (state.grain && state.intensity) filmGrain(ctx, width, height, unit, grade.grain * state.intensity / 100);
  ctx.strokeStyle = '#ffd7a49c';
  ctx.lineWidth = 1.5 * unit;
  const inset = 9 * unit;
  ctx.strokeRect(inset, inset, width - 2 * inset, height - 2 * inset);
  ctx.restore();
}
