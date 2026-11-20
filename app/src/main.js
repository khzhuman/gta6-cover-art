import { arrangements, treatments, dimensions, stock, bounded, findByKey, panelShapes, pointInPanel } from './templates.js';
import { makePNG, paintCover, photoBounds } from './cover.js';
import { displayFont, imageFromURL, objectURL, releaseURL, sampleAsset } from './assets.js';

const ui = Object.fromEntries(Array.from(document.querySelectorAll('[id]'), node => [node.id, node]));
const library = new Map();
const before = [], after = [];
const copyText = {
  headline: 'VICE SUMMER',
  tagline: 'one last summer',
  strip: 'SEVEN LIVES · ONE COASTLINE · NO WAY BACK',
  quote: 'PURE GOLDEN-HOUR MAYHEM',
  paper: 'THE HARBOR GAZETTE'
};
const ensembleCast = ['portrait', 'boss', 'driver', 'lifeguard', 'racer', 'man', 'beach'];
const starterCast = ['portrait', 'car', 'beach', 'man', 'driver', 'boss'];
const poseFor = asset => ({ asset, horizontal: .5, vertical: .5, scale: 1 });

function demoPanels(layout) {
  const cast = layout.key === 'ensemble' ? ensembleCast : starterCast;
  return {
    frames: cast.slice(0, layout.paths.length).map(poseFor),
    labels: structuredClone(layout.labels)
  };
}

let design = {
  template: 'ensemble', grade: 'goldenhour', size: 'wide',
  ...copyText, ...demoPanels(findByKey(arrangements, 'ensemble')),
  intensity: 85, grain: true, halftone: true, personal: []
};
let active = 0, cropDrag, indicator, previewRequest, noticeTimer;
let exporting = false, loaded = false, downloadURL, uploadNumber = 0;

const currentPose = () => design.frames[active];
const currentSize = () => findByKey(dimensions, design.size);

function notify(text) {
  window.clearTimeout(noticeTimer);
  ui.notice.hidden = false;
  ui.notice.textContent = text;
  noticeTimer = window.setTimeout(() => { ui.notice.hidden = true; }, 4000);
}

function record(snapshot) {
  before.push(snapshot);
  if (before.length > 60) before.shift();
  after.length = 0;
}

function edit(change) {
  if (cropDrag) return;
  const snapshot = structuredClone(design);
  change();
  record(snapshot);
  refresh();
}

function restore(source, destination) {
  if (cropDrag || source.length === 0) return;
  destination.push(design);
  design = source.pop();
  refresh();
}

function updatePreview() {
  if (previewRequest) return;
  previewRequest = requestAnimationFrame(() => {
    previewRequest = 0;
    const size = currentSize(), aspect = size.width / size.height;
    const width = Math.max(60, Math.min(ui.stage.clientWidth - 52, (ui.stage.clientHeight - 66) * aspect));
    const height = width / aspect;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    ui.sheet.style.width = width + 'px';
    ui.sheet.style.height = height + 'px';
    paintCover(ui.preview, design, library, width * density, height * density, indicator ? active : -1);
  });
}

function showSelection() {
  window.clearTimeout(indicator);
  indicator = window.setTimeout(() => {
    indicator = 0;
    updatePreview();
  }, 1100);
  updatePreview();
}

function action(text, click) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = text;
  control.onclick = click;
  return control;
}

function pressed(control, value) {
  control.classList.toggle('selected', value);
  control.setAttribute('aria-pressed', String(value));
}

function imageChoice(item) {
  const use = action('', () => {
    edit(() => { design.frames[active] = poseFor(item.key); });
    showSelection();
  });
  use.dataset.asset = item.key;
  use.className = 'photo-card';
  use.setAttribute('aria-label', 'Use ' + item.name + ' in selected panel');
  const thumbnail = document.createElement('img');
  thumbnail.alt = item.name;
  thumbnail.src = item.url;
  thumbnail.draggable = false;
  const title = document.createElement('span');
  title.textContent = item.name;
  use.append(thumbnail, title);
  if (!item.personal) return use;

  const card = document.createElement('div');
  card.className = 'personal-card';
  const discard = action('×', () => edit(() => {
    design.personal = design.personal.filter(key => key !== item.key);
    design.frames = design.frames.map(pose => pose.asset === item.key ? poseFor('portrait') : pose);
  }));
  discard.className = 'remove';
  discard.setAttribute('aria-label', 'Remove ' + item.name);
  card.append(use, discard);
  return card;
}

const fields = Object.keys(copyText);
const toggles = ['grain', 'halftone'];
const choiceGroups = [['templates', 'template'], ['grades', 'grade'], ['sizes', 'size']];

function refresh() {
  active = Math.min(active, design.frames.length - 1);
  for (const [id, property] of choiceGroups) {
    for (const control of ui[id].children) pressed(control, control.dataset.key === design[property]);
  }
  for (const field of [...fields, 'intensity']) ui[field].value = design[field];
  for (const field of toggles) ui[field].checked = design[field];
  const { role, sub } = design.labels[active];
  ui.role.value = role;
  ui.sub.value = sub;
  ui.letters.textContent = design.headline.length + ' / 36';
  ui['intensity-readout'].value = design.intensity + '%';
  ui.intensity.disabled = design.grade === 'clean';
  ui.scale.value = currentPose().scale;
  ui['scale-readout'].value = Math.round(currentPose().scale * 100) + '%';
  const { ratio, width, height } = currentSize();
  ui.aspect.textContent = ratio;
  ui.pixels.textContent = width + ' × ' + height + ' px';
  ui['template-note'].textContent = findByKey(arrangements, design.template).detail;
  ui.undo.disabled = !before.length;
  ui.redo.disabled = !after.length;
  const canExport = loaded && !exporting && design.frames.some(({ asset }) => library.has(asset));
  ui.export.disabled = ui.enlarge.disabled = !canExport;

  const picks = ui['frame-picks'];
  while (picks.childElementCount > design.labels.length) picks.lastElementChild.remove();
  for (const [index, label] of design.labels.entries()) {
    let choice = picks.children[index];
    if (!choice) {
      choice = action('', () => {
        if (cropDrag) return;
        active = index;
        refresh();
        showSelection();
      });
      picks.append(choice);
    }
    const number = String(index + 1).padStart(2, '0');
    choice.textContent = label.role.trim() ? number + ' ' + label.role.toUpperCase() : number;
    choice.setAttribute('aria-label', 'Select panel ' + choice.textContent);
    pressed(choice, index === active);
  }
  const signature = design.personal.join(',');
  if (signature !== ui.uploads.dataset.signature) {
    ui.uploads.replaceChildren(...design.personal.map(key => imageChoice(library.get(key))));
    ui.uploads.dataset.signature = signature;
  }
  ui.personal.hidden = !design.personal.length;
  ui['upload-count'].textContent = design.personal.length;
  for (const tile of document.querySelectorAll('[data-asset]')) {
    pressed(tile, tile.dataset.asset === currentPose().asset);
  }
  updatePreview();
}

function layoutIcon(layout) {
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 48 34');
  icon.setAttribute('aria-hidden', 'true');
  for (const path of layout.paths) {
    const shape = document.createElementNS(ns, 'polygon');
    shape.setAttribute('points', path.map(([u, v]) => [3 + 42 * u, 3 + 28 * v].join(',')).join(' '));
    icon.append(shape);
  }
  return icon;
}

function buildCatalogs() {
  for (const layout of arrangements) {
    const tile = action('', () => edit(() => {
      const previous = design.frames;
      design.frames = layout.paths.map((_, slot) => ({ ...previous[slot % previous.length] }));
      design.template = layout.key;
      design.labels = structuredClone(layout.labels);
    }));
    const name = document.createElement('span');
    name.textContent = layout.name;
    tile.title = layout.detail;
    tile.dataset.key = layout.key;
    tile.append(layoutIcon(layout), name);
    ui.templates.append(tile);
  }
  for (const treatment of treatments) {
    const tile = action(treatment.name, () => edit(() => { design.grade = treatment.key; }));
    const sample = document.createElement('i');
    sample.style.backgroundImage = 'linear-gradient(135deg, ' + treatment.palette.join(', ') + ')';
    tile.prepend(sample);
    tile.dataset.key = treatment.key;
    ui.grades.append(tile);
  }
  for (const dimension of dimensions) {
    const tile = action(dimension.name, () => edit(() => { design.size = dimension.key; }));
    const ratio = document.createElement('small');
    ratio.textContent = dimension.ratio;
    tile.append(ratio);
    tile.dataset.key = dimension.key;
    ui.sizes.append(tile);
  }
}

async function importImages(files) {
  const keys = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = objectURL(file);
    try {
      const bitmap = await imageFromURL(url);
      const key = 'upload-' + ++uploadNumber;
      library.set(key, { key, name: file.name, url, bitmap, personal: true });
      keys.push(key);
    } catch {
      releaseURL(url);
      notify('Could not open ' + file.name + '. Try a JPG, PNG or WebP.');
    }
  }
  if (!keys.length) return;
  if (cropDrag) finishCrop();
  edit(() => {
    design.personal = design.personal.concat(keys);
    design.frames = design.frames.map((_, index) => poseFor(keys[index % keys.length]));
  });
  notify(keys.length === 1 ? '1 photo added. Drag to reframe.' : keys.length + ' photos added. Drag to reframe.');
}

function demo() {
  edit(() => {
    const layout = findByKey(arrangements, design.template);
    Object.assign(design, copyText, demoPanels(layout));
  });
}

async function openExport() {
  if (ui.export.disabled) return;
  const original = [...ui.export.childNodes];
  const snapshot = structuredClone(design);
  const size = findByKey(dimensions, snapshot.size);
  exporting = true;
  refresh();
  ui.export.textContent = 'Rendering your cover…';
  try {
    const url = objectURL(await makePNG(snapshot, library));
    releaseURL(downloadURL);
    downloadURL = url;
    ui['output-image'].src = url;
    await ui['output-image'].decode();
    ui.download.href = url;
    ui.download.download = 'vice-frame-' + snapshot.size + '.png';
    ui['output-size'].textContent = size.width + ' × ' + size.height;
    ui.result.showModal();
  } catch (error) {
    notify(error.message);
  } finally {
    exporting = false;
    ui.export.replaceChildren(...original);
    refresh();
  }
}

function bindEditor() {
  for (const field of fields) {
    ui[field].oninput = event => edit(() => { design[field] = event.target.value; });
  }
  for (const field of ['role', 'sub']) {
    ui[field].oninput = event => edit(() => { design.labels[active][field] = event.target.value; });
  }
  for (const field of toggles) {
    ui[field].onchange = event => edit(() => { design[field] = event.target.checked; });
  }
  ui.intensity.oninput = event => edit(() => { design.intensity = event.target.valueAsNumber; });
  ui.scale.oninput = event => edit(() => { currentPose().scale = event.target.valueAsNumber; });
  ui.recenter.onclick = () => edit(() => { design.frames[active] = poseFor(currentPose().asset); });
  ui['fill-all'].onclick = () => edit(() => {
    const asset = currentPose().asset;
    design.frames = design.frames.map(() => poseFor(asset));
  });
  ui.undo.onclick = () => restore(before, after);
  ui.redo.onclick = () => restore(after, before);
  ui.demo.onclick = demo;
  ui.help.onclick = () => ui.guide.showModal();
  ui['guide-demo'].onclick = () => {
    ui.guide.close();
    demo();
  };
  for (const close of document.querySelectorAll('[data-close]')) {
    close.onclick = () => close.closest('dialog').close();
  }
  ui.enlarge.onclick = ui.export.onclick = openExport;
  ui.drop.onclick = () => ui.files.click();
  ui.files.onchange = () => {
    importImages(Array.from(ui.files.files));
    ui.files.value = '';
  };
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => {
    event.preventDefault();
    importImages(Array.from(event.dataTransfer.files));
  });
  document.addEventListener('paste', event => importImages(Array.from(event.clipboardData.files)));
}

function finishCrop(event) {
  if (!cropDrag || (event && event.pointerId !== cropDrag.id)) return;
  const { snapshot, pose } = cropDrag;
  cropDrag = null;
  const current = currentPose();
  if (current.horizontal !== pose.horizontal || current.vertical !== pose.vertical) record(snapshot);
  refresh();
}

function bindPreview() {
  ui.preview.onpointerdown = event => {
    if (cropDrag || event.button !== 0) return;
    const box = ui.preview.getBoundingClientRect();
    const sx = ui.preview.width / box.width;
    const sy = ui.preview.height / box.height;
    const x = (event.clientX - box.left) * sx;
    const y = (event.clientY - box.top) * sy;
    const panels = panelShapes(design.template, ui.preview.width, ui.preview.height);
    const panel = panels.find(({ polygon }) => pointInPanel(polygon, x, y));
    if (!panel) return;
    active = panel.slot;
    const pose = { ...currentPose() };
    const image = library.get(pose.asset)?.bitmap;
    cropDrag = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY, sx, sy,
      pose, crop: image && photoBounds(image, panel, pose), snapshot: structuredClone(design)
    };
    ui.preview.setPointerCapture(event.pointerId);
    ui.preview.focus();
    refresh();
    showSelection();
  };
  ui.preview.onpointermove = event => {
    if (event.pointerId !== cropDrag?.id || !cropDrag.crop) return;
    const { pose, crop, startX, startY, sx, sy } = cropDrag;
    const dx = (event.clientX - startX) * sx;
    const dy = (event.clientY - startY) * sy;
    if (crop.overflowX > 0) currentPose().horizontal = bounded(pose.horizontal - dx / crop.overflowX, 0, 1);
    if (crop.overflowY > 0) currentPose().vertical = bounded(pose.vertical - dy / crop.overflowY, 0, 1);
    updatePreview();
  };
  ui.preview.onpointerup = ui.preview.onpointercancel = ui.preview.onlostpointercapture = finishCrop;

  const arrows = { ArrowLeft: [.025, 0], ArrowRight: [-.025, 0], ArrowUp: [0, .025], ArrowDown: [0, -.025] };
  ui.preview.onkeydown = event => {
    const pan = arrows[event.key];
    if (pan) {
      event.preventDefault();
      edit(() => {
        const pose = currentPose();
        pose.horizontal = bounded(pose.horizontal + pan[0], 0, 1);
        pose.vertical = bounded(pose.vertical + pan[1], 0, 1);
      });
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault();
      edit(() => {
        const pose = currentPose();
        pose.scale = bounded(pose.scale + (event.key === '-' ? -.1 : .1), 1, 3);
      });
    }
  };
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.target.matches('input')) return;
    event.preventDefault();
    if (event.shiftKey) restore(after, before);
    else restore(before, after);
  });
  new ResizeObserver(updatePreview).observe(ui.stage);
}

buildCatalogs();
bindEditor();
bindPreview();
refresh();
const fontLoad = displayFont().catch(() => notify('Display font unavailable. Please reload the studio.'));
const samples = await Promise.all(stock.map(async entry => {
  try {
    const photo = await sampleAsset(entry);
    library.set(photo.key, photo);
    return photo;
  } catch {
    notify('Sample unavailable: ' + entry.name);
    return null;
  }
}));
ui.samples.replaceChildren(...samples.filter(Boolean).map(imageChoice));
await fontLoad;
await document.fonts.ready;
loaded = true;
refresh();
