(() => {
  'use strict';

  const T = window.ViceFrameTemplates;
  const CREAM = '#fff0d6';
  const INK = '#221925';
  let grainCanvas;

  function polygon(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }

  function cropGeometry(image, rect, panel = {}) {
    const imageW = image.naturalWidth || image.width;
    const imageH = image.naturalHeight || image.height;
    const zoom = T.clamp(Number(panel.zoom) || 1, 1, 3);
    const scale = Math.max(rect.w / imageW, rect.h / imageH) * zoom;
    const w = imageW * scale;
    const h = imageH * scale;
    const overflowX = Math.max(0, w - rect.w);
    const overflowY = Math.max(0, h - rect.h);
    return {
      x: rect.x - overflowX * T.clamp(panel.panX ?? 0.5, 0, 1),
      y: rect.y - overflowY * T.clamp(panel.panY ?? 0.5, 0, 1),
      w, h, overflowX, overflowY
    };
  }

  function photoFilter(grade, strength) {
    if (!strength || grade.id === 'clean') return 'none';
    return grade.filter.replace(/(contrast|saturate|grayscale)\(([\d.]+)\)/g, (_, type, value) => {
      const neutral = type === 'grayscale' ? 0 : 1;
      return `${type}(${neutral + (Number(value) - neutral) * strength})`;
    });
  }

  function emptyScene(ctx, rect, index) {
    const background = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    background.addColorStop(0, '#34324d');
    background.addColorStop(0.6, '#895672');
    background.addColorStop(1, '#e39672');
    ctx.fillStyle = background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#ffc28d';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(rect.x + rect.w * 0.7, rect.y + rect.h * 0.45, Math.min(rect.w, rect.h) * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.min(rect.w, rect.h) * 0.038}px Arial, sans-serif`;
    ctx.fillText(`0${index + 1} / ADD A PHOTO`, rect.x + rect.w / 2, rect.y + rect.h * 0.74);
  }

  function drawPhotos(ctx, state, assets, layout, grade, strength) {
    for (const rect of layout) {
      const panel = state.panels[rect.index] || {};
      const asset = assets.get(panel.assetId);
      ctx.save();
      polygon(ctx, rect.points);
      ctx.clip();
      if (asset?.image?.complete && (asset.image.naturalWidth || asset.image.width)) {
        const crop = cropGeometry(asset.image, rect, panel);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.filter = photoFilter(grade, strength);
        ctx.drawImage(asset.image, crop.x, crop.y, crop.w, crop.h);
      } else {
        emptyScene(ctx, rect, rect.index);
      }
      ctx.restore();
    }
  }

  function drawGrade(ctx, grade, strength, width, height) {
    if (!grade.wash || !strength) return;
    ctx.save();
    const wash = ctx.createLinearGradient(0, 0, width * 0.22, height);
    grade.wash.forEach((color, index) => wash.addColorStop(index / (grade.wash.length - 1), color));
    ctx.globalCompositeOperation = grade.blend;
    ctx.globalAlpha = grade.opacity * strength;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.13, height * 0.12, 0, width * 0.13, height * 0.12, width * 0.8);
    glow.addColorStop(0, grade.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (grade.id === 'golden' ? 0.23 : 0.16) * strength;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.45, Math.min(width, height) * 0.18,
      width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, 'rgba(22,15,35,0)');
    vignette.addColorStop(0.58, 'rgba(22,15,35,0.08)');
    vignette.addColorStop(1, '#170e25');
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = grade.vignette * strength;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function getGrain() {
    if (grainCanvas) return grainCanvas;
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 192;
    const ctx = grainCanvas.getContext('2d');
    const pixels = ctx.createImageData(192, 192);
    let seed = 7463;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const value = 64 + seed % 128;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    return grainCanvas;
  }

  function letterMetrics(ctx, text, spacing) {
    const glyphs = Array.from(text);
    let x = 0;
    const positions = glyphs.map(glyph => {
      const position = x;
      x += ctx.measureText(glyph).width + spacing;
      return { glyph, x: position };
    });
    return { positions, width: Math.max(0, x - (glyphs.length ? spacing : 0)) };
  }

  function spacedLine(ctx, text, centerX, y, size, spacing, color, maxWidth = Infinity) {
    ctx.save();
    ctx.font = `700 ${size}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const metrics = letterMetrics(ctx, text, spacing);
    const fit = Math.min(1, maxWidth / Math.max(1, metrics.width));
    ctx.translate(centerX - metrics.width * fit / 2, y);
    ctx.scale(fit, 1);
    ctx.fillStyle = color;
    metrics.positions.forEach(({ glyph, x }) => ctx.fillText(glyph, x, 0));
    ctx.restore();
  }

  function captionLines(caption) {
    const title = String(caption || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (title.length <= 18 || !title.includes(' ')) return title ? [title] : [];
    const words = title.split(' ');
    let best = 1;
    let difference = Infinity;
    for (let i = 1; i < words.length; i++) {
      const next = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
      if (next < difference) { best = i; difference = next; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  function drawCaption(ctx, state, width, height, lines) {
    const short = Math.min(width, height);
    const xScale = 0.64;
    let fontSize = Math.min(short * (lines.length > 1 ? 0.215 : 0.26), height * 0.24);
    ctx.save();
    ctx.font = `700 ${fontSize}px "ViceDisplay", "Arial Narrow", Arial, sans-serif`;
    const widths = lines.map(line => letterMetrics(ctx, line, -fontSize * 0.024).width * xScale);
    const widest = Math.max(1, ...widths);
    fontSize *= Math.min(1, (width * 0.88 - fontSize * 0.12) / widest);
    const firstBaseline = short * 0.069 + fontSize * 0.73;
    let lastBaseline = firstBaseline;

    lines.forEach((line, index) => {
      const baseline = firstBaseline + index * fontSize * 0.82;
      lastBaseline = baseline;
      ctx.save();
      ctx.font = `700 ${fontSize}px "ViceDisplay", "Arial Narrow", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const metrics = letterMetrics(ctx, line, -fontSize * 0.024);
      ctx.translate(width / 2 - metrics.width * xScale / 2 - fontSize * 0.035, baseline);
      ctx.transform(xScale, 0, -0.13, 1, 0, 0);

      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = fontSize * 0.082;
      ctx.shadowColor = 'rgba(16,7,22,0.8)';
      ctx.shadowBlur = short * 0.015;
      ctx.shadowOffsetX = short * 0.003;
      ctx.shadowOffsetY = short * 0.009;
      metrics.positions.forEach(({ glyph, x }) => ctx.strokeText(glyph, x, 0));

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      const lettering = ctx.createLinearGradient(0, -fontSize * 0.8, 0, fontSize * 0.04);
      lettering.addColorStop(0, '#fff7e8');
      lettering.addColorStop(0.5, '#ffefd6');
      lettering.addColorStop(1, state.gradeId === 'neon' ? '#ecc0da' : '#ffba96');
      ctx.fillStyle = lettering;
      metrics.positions.forEach(({ glyph, x }) => ctx.fillText(glyph, x, 0));
      ctx.restore();
    });

    if (lines.length) {
      spacedLine(ctx, 'A VICE FRAME ORIGINAL', width / 2, short * 0.042, short * 0.0115,
        short * 0.0029, CREAM, width * 0.75);
    }
    const subtitle = String(state.subtitle || '').trim().toUpperCase();
    if (subtitle) {
      const y = lines.length ? lastBaseline + fontSize * 0.19 : short * 0.12;
      ctx.shadowColor = 'rgba(18,11,28,0.95)';
      ctx.shadowBlur = short * 0.006;
      ctx.shadowOffsetY = short * 0.002;
      spacedLine(ctx, subtitle, width / 2, y, short * 0.017, short * 0.0042, CREAM, width * 0.8);
    }
    ctx.restore();
  }

  function drawFooter(ctx, width, height) {
    const short = Math.min(width, height);
    const y = height - short * 0.043;
    ctx.save();
    ctx.fillStyle = CREAM;
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${short * 0.013}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('VICE FRAME', short * 0.043, y);
    ctx.font = `700 ${short * 0.0105}px Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('MADE FOR THE MOMENT', width - short * 0.043, y);
    ctx.fillStyle = '#f9ac91';
    ctx.fillRect(short * 0.043, y + short * 0.008, short * 0.067, short * 0.003);
    ctx.restore();
  }

  function render(canvas, state, assets, width, height) {
    const size = T.getSize(state.sizeId);
    width = Math.max(1, Math.round(width || size.width));
    height = Math.max(1, Math.round(height || size.height));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser could not start the canvas editor.');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, width, height);
    const short = Math.min(width, height);
    const margin = short * 0.014;
    const layout = T.panelLayout(state.templateId, width, height);
    const grade = T.getGrade(state.gradeId);
    const strength = T.clamp((state.intensity ?? 72) / 100, 0, 1);
    const lines = captionLines(state.caption);

    drawPhotos(ctx, state, assets, layout, grade, strength);
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin, margin, width - margin * 2, height - margin * 2);
    ctx.clip();
    drawGrade(ctx, grade, strength, width, height);
    if (state.texture) {
      ctx.save();
      ctx.globalAlpha = 0.11;
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = ctx.createPattern(getGrain(), 'repeat');
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (lines.length || state.subtitle) {
      const shade = ctx.createLinearGradient(0, 0, 0, height * (lines.length > 1 ? 0.51 : 0.36));
      shade.addColorStop(0, 'rgba(25,14,31,0.65)');
      shade.addColorStop(0.48, 'rgba(25,14,31,0.24)');
      shade.addColorStop(1, 'rgba(25,14,31,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height * (lines.length > 1 ? 0.51 : 0.36));
    }
    const footerShade = ctx.createLinearGradient(0, height * 0.78, 0, height);
    footerShade.addColorStop(0, 'rgba(22,12,28,0)');
    footerShade.addColorStop(1, 'rgba(22,12,28,0.7)');
    ctx.fillStyle = footerShade;
    ctx.fillRect(0, height * 0.78, width, height * 0.22);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = short * 0.0065;
    ctx.lineJoin = 'round';
    layout.forEach(rect => { polygon(ctx, rect.points); ctx.stroke(); });
    ctx.restore();
    drawCaption(ctx, state, width, height, lines);
    drawFooter(ctx, width, height);
    return canvas;
  }

  async function png(state, assets) {
    if (document.fonts) await document.fonts.ready;
    const canvas = render(document.createElement('canvas'), state, assets);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed. Try again.')), 'image/png');
    });
  }

  window.ViceFrameRenderer = Object.freeze({ render, png, cropGeometry, captionLines });
})();
