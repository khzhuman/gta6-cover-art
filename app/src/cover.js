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
        pixels[p + channel] = mix(value, mix(contrasted, color[channel], .38), strength);
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
    ctx.font = `900 ${24 * unit}px system-ui, sans-serif`;
    const roleWidth = ctx.measureText(role).width;
    ctx.fillStyle = 'rgba(13,9,22,.92)';
    ctx.fillRect(x - 10 * unit, y - 28 * unit, roleWidth + 26 * unit, 37 * unit);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(x - 10 * unit, y - 28 * unit, 5 * unit, 37 * unit);
    ctx.fillStyle = cream;
    ctx.fillText(role, x + 9 * unit, y, limit);
    ctx.font = `italic ${13 * unit}px Georgia, serif`;
    ctx.fillStyle = '#ffddce';
    ctx.fillText(sub, x + 2 * unit, y + 21 * unit, limit);
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
  const size = Math.min(width * .175, height * .21);
  const stripes = ctx.canvas.ownerDocument.createElement('canvas');
  stripes.width = 4;
  stripes.height = Math.max(2, Math.round(size * .94));
  const sctx = stripes.getContext('2d');
  const bandColors = ['#fff3b0','#ffd76a','#ff9a3d','#ff7a4d','#ff5e7a','#e5488c','#a03d8f','#5f2d91'];
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const position = i / (bands - 1) * (bandColors.length - 1);
    const index = Math.min(Math.floor(position), bandColors.length - 2);
    const from = rgb(bandColors[index]);
    const to = rgb(bandColors[index + 1]);
    const [r, g, b] = from.map((value, channel) => Math.round(mix(value, to[channel], position - index)));
    sctx.fillStyle = `rgb(${r},${g},${b})`;
    sctx.fillRect(0, i * stripes.height / bands, 4, Math.ceil(stripes.height / bands));
    if (i >= 8) {
      sctx.fillStyle = 'rgba(20,8,32,.55)';
      sctx.fillRect(0, (i + 1) * stripes.height / bands - 2, 4, 2);
    }
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(8,4,16,.85)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 7 * unit;
  ctx.translate(0, y - size * .82);
  const pattern = ctx.createPattern(stripes, 'repeat');
  ctx.font = `700 ${size}px ViceDisplay, Impact, sans-serif`;
  outline(ctx, state.headline, width / 2, size * .82, width * .86, 16 * unit, pattern);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `italic 600 ${56 * unit}px 'Brush Script MT', 'Segoe Script', cursive`;
  ctx.shadowColor = '#ff438f';
  ctx.shadowBlur = 22 * unit;
  outline(ctx, state.tagline, width / 2, y + 60 * unit, width * .66, 5 * unit, '#ffe2ee');
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
  ctx.fillStyle = '#100d19f5';
  ctx.fillRect(0, 0, width, 58 * unit);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `800 ${19 * unit}px system-ui, sans-serif`;
  ctx.fillStyle = '#ffdc7b';
  ctx.fillText('★ ★ ★ ★ ★', margin, 39 * unit);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `italic 700 ${19 * unit}px Georgia, serif`;
  outline(ctx, state.quote, width / 2, 39 * unit, width * .54, 4 * unit, cream);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ffcf83';
  ctx.lineWidth = 2 * unit;
  ctx.strokeRect(width - margin - 88 * unit, 13 * unit, 88 * unit, 32 * unit);
  ctx.textAlign = 'center';
  ctx.font = `800 ${17 * unit}px ui-monospace, monospace`;
  outline(ctx, 'VOL. 1', width - margin - 44 * unit, 36 * unit, 88 * unit, 3 * unit, '#ffcf83');
  ctx.restore();

  const titleSize = Math.min(width * .175, height * .21);
  const ribbonY = height * .51 + titleSize * .46;
  const ribbonHeight = 34 * unit;
  ctx.save();
  ctx.translate(width / 2, ribbonY + ribbonHeight / 2);
  ctx.rotate(-.021);
  ctx.translate(-width / 2, -(ribbonY + ribbonHeight / 2));
  ctx.fillStyle = gradient(ctx, 0, 0, width, 0, ['#3a1c50', '#1c0e2e']);
  ctx.fillRect(0, ribbonY, width, ribbonHeight);
  ctx.fillStyle = '#ffcf83';
  ctx.fillRect(0, ribbonY, width, 2 * unit);
  ctx.fillRect(0, ribbonY + ribbonHeight - 2 * unit, width, 2 * unit);
  ctx.textAlign = 'center';
  ctx.font = `900 ${16 * unit}px system-ui, sans-serif`;
  ctx.fillStyle = cream;
  ctx.fillText(state.strip, width / 2, ribbonY + 23 * unit, width * .91);
  ctx.restore();

  seal(ctx, width - margin - 50 * unit, height * .60, unit);
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

function glowVignette(ctx, width, height) {
  const warm = ctx.createRadialGradient(width * .16, height * .04, 0, width * .16, height * .04, width * .55);
  warm.addColorStop(0, 'rgba(255,166,77,.13)');
  warm.addColorStop(1, 'rgba(255,166,77,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, width, height);

  const shade = ctx.createRadialGradient(width * .5, height * .44, Math.min(width, height) * .38, width * .5, height * .44, Math.max(width, height) * .78);
  shade.addColorStop(0, 'rgba(14,6,24,0)');
  shade.addColorStop(1, 'rgba(14,6,24,.36)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
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
  glowVignette(ctx, width, height);
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
