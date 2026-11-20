import { bounds, contains, grades, samples, sizes, templates } from './templates.js';
import { drawCover } from './cover.js';
import { displayFont, imageFromURL, objectURL, releaseURL, sampleAsset } from './assets.js';

const byId = id => document.getElementById(id);
const preview = byId('preview');
const stage = byId('stage');
const sheet = byId('sheet');
const assets = new Map();
const past = [];
const future = [];
const center = () => ({ x: 0, y: 0, zoom: 1 });
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const dimensions = size => `${size.width} × ${size.height}`;

function makePanels(template, previous = []) {
  return template.panels.map(({ role, sub }, index) => ({
    role, sub, photo: previous[index]?.photo ?? null,
    crop: previous[index] ? { ...previous[index].crop } : center(),
  }));
}

let state = {
  template: 'ensemble', grade: 'golden', size: 'wide', active: 0,
  photo: null, uploads: [], panels: makePanels(templates.ensemble),
  intensity: 85, grain: true, halftone: true,
  headline: 'VICE SUMMER', tagline: 'one last summer',
  strip: 'SEVEN LIVES · ONE COASTLINE · NO WAY BACK',
  quote: '“PURE GOLDEN-HOUR MAYHEM” — THE HARBOR GAZETTE',
  paper: 'The Harbor Gazette',
};

let editGroup = null;
let drag = null;
let pendingDraw = 0;
let noticeTimer;
let uploadNumber = 0;
let outputURL;

function notice(message) {
  const toast = byId('notice');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}

function activePanel() {
  return state.panels[state.active];
}

// Keep image data outside snapshots, including photos currently reachable only by history.
function edit(mutate, group = null) {
  const before = structuredClone(state);
  mutate();
  if (JSON.stringify(state) === JSON.stringify(before)) return;
  if (!group || editGroup !== group) past.push(before);
  editGroup = group;
  future.length = 0;
  sync();
}

function restore(from, to) {
  if (!from.length) return;
  editGroup = null;
  drag = null;
  to.push(state);
  state = from.pop();
  sync();
}

function button(label, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.append(label);
  node.addEventListener('click', action);
  return node;
}

function selected(node, value) {
  node.classList.toggle('selected', value);
  node.setAttribute('aria-pressed', String(value));
}

function setValue(id, value) {
  const input = byId(id);
  if (input.value !== String(value)) input.value = value;
}

function thumbnail(template) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '-4 -4 108 88');
  svg.setAttribute('aria-hidden', 'true');
  for (const { points } of template.panels) {
    const shape = document.createElementNS(ns, 'polygon');
    shape.setAttribute('points', points.map(([x, y]) => `${x * 100},${y * 80}`).join(' '));
    shape.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(shape);
  }
  return svg;
}

const choiceButtons = {};
function makeChoices(id, options, decorate, action) {
  const root = byId(id);
  choiceButtons[id] = Object.entries(options).map(([key, option]) => {
    const node = button(option.name, () => edit(() => action(key)));
    decorate(node, option);
    root.append(node);
    return [key, node];
  });
}

function changeTemplate(key) {
  if (state.template === key) return;
  state.panels = makePanels(templates[key], state.panels);
  state.template = key;
  state.active = Math.min(state.active, state.panels.length - 1);
  state.photo = activePanel().photo;
}

function assign(panel, photo) {
  if (panel.photo === photo) return;
  panel.photo = photo;
  panel.crop = center();
}

function selectPanel(index) {
  if (index === state.active) return;
  editGroup = null;
  state.active = index;
  state.photo = activePanel().photo;
  sync();
}

function photoCard(photo) {
  const tile = button('', () => edit(() => {
    state.photo = photo.id;
    assign(activePanel(), photo.id);
  }));
  tile.className = 'photo-card';
  const image = document.createElement('img');
  image.src = photo.url;
  image.alt = '';
  const caption = document.createElement('span');
  caption.textContent = photo.name;
  tile.append(image, caption);
  tile.dataset.photo = photo.id;
  return tile;
}

function removePhoto(id) {
  edit(() => {
    state.uploads = state.uploads.filter(photo => photo !== id);
    for (const panel of state.panels) if (panel.photo === id) assign(panel, null);
    if (state.photo === id) state.photo = activePanel().photo;
  });
}

let visibleUploads;
function syncLibrary() {
  const list = state.uploads.join(',');
  if (visibleUploads !== list) {
    visibleUploads = list;
    byId('personal').hidden = state.uploads.length === 0;
    byId('upload-count').textContent = state.uploads.length;
    byId('uploads').replaceChildren(...state.uploads.map(id => {
      const photo = assets.get(id);
      const wrapper = document.createElement('div');
      wrapper.className = 'personal-card';
      const remove = button('×', () => removePhoto(id));
      remove.className = 'remove';
      remove.setAttribute('aria-label', `Remove ${photo.name}`);
      wrapper.append(photoCard(photo), remove);
      return wrapper;
    }));
  }
  for (const tile of document.querySelectorAll('.photo-card[data-photo]')) {
    selected(tile, tile.dataset.photo === state.photo);
  }
  byId('fill-all').disabled = !state.photo;
}

function syncFrames() {
  const picker = byId('frame-picks');
  if (picker.children.length !== state.panels.length) {
    picker.replaceChildren(...state.panels.map((_, index) => button('', () => selectPanel(index))));
  }
  state.panels.forEach(({ role }, index) => {
    const node = picker.children[index];
    node.textContent = role || `Panel ${index + 1}`;
    selected(node, index === state.active);
  });
  const { role, sub, crop } = activePanel();
  setValue('role', role);
  setValue('sub', sub);
  setValue('scale', crop.zoom);
  byId('scale-readout').value = `${Math.round(crop.zoom * 100)}%`;
}

const textFields = ['headline', 'tagline', 'strip', 'quote', 'paper'];
function sync() {
  syncLibrary();
  syncFrames();
  for (const [id, value] of [['templates', state.template], ['grades', state.grade], ['sizes', state.size]]) {
    for (const [key, node] of choiceButtons[id]) selected(node, key === value);
  }
  byId('template-note').textContent = templates[state.template].note;
  for (const field of textFields) setValue(field, state[field]);
  byId('letters').textContent = `${state.headline.length} / 36`;
  for (const field of ['grain', 'halftone']) byId(field).checked = state[field];
  setValue('intensity', state.intensity);
  byId('intensity-readout').value = `${state.intensity}%`;
  const size = sizes[state.size];
  byId('aspect').textContent = size.aspect;
  byId('pixels').textContent = dimensions(size);
  byId('undo').disabled = past.length === 0;
  byId('redo').disabled = future.length === 0;
  scheduleDraw();
}

function scheduleDraw() {
  if (pendingDraw) return;
  pendingDraw = requestAnimationFrame(() => {
    pendingDraw = 0;
    const { width, height } = sizes[state.size];
    const ratio = width / height;
    const displayWidth = Math.max(1, Math.floor(Math.min(stage.clientWidth * .92,
      Math.max(80, stage.clientHeight - 64) * ratio)));
    sheet.style.width = `${displayWidth}px`;
    sheet.style.height = `${displayWidth / ratio}px`;
    const backingWidth = Math.min(width, Math.max(1, Math.round(displayWidth * Math.min(devicePixelRatio || 1, 2))));
    const backingHeight = Math.max(1, Math.round(backingWidth / ratio));
    if (preview.width !== backingWidth || preview.height !== backingHeight) {
      preview.width = backingWidth;
      preview.height = backingHeight;
    }
    drawCover(preview.getContext('2d'), state, assets);
  });
}

function fillDemo() {
  const available = samples.filter(photo => assets.has(photo.id));
  if (!available.length) return;
  const { demo } = templates[state.template];
  state.panels.forEach((panel, index) => {
    panel.photo = assets.has(demo[index]) ? demo[index] : available[index % available.length].id;
    panel.crop = center();
  });
  state.photo = activePanel().photo;
}

async function importPhotos(files) {
  const images = Array.from(files).filter(file => file.type.startsWith('image/') || !file.type);
  if (!images.length) {
    notice('Choose an image file to add a photo.');
    return;
  }
  const decoded = await Promise.all(images.map(async file => {
    const id = `upload-${++uploadNumber}`;
    const url = objectURL(file);
    try {
      const bitmap = await imageFromURL(url);
      return { id, name: file.name || 'Pasted photo', url, bitmap };
    } catch {
      releaseURL(url);
      return null;
    }
  }));
  const photos = decoded.filter(Boolean);
  if (photos.length !== decoded.length || images.length !== files.length) notice('Some files could not be opened as photos.');
  if (!photos.length) return;
  for (const photo of photos) assets.set(photo.id, photo);
  edit(() => {
    state.uploads.push(...photos.map(photo => photo.id));
    state.panels.forEach((panel, index) => assign(panel, photos[index % photos.length].id));
    state.photo = activePanel().photo;
  });
}

function wireImports() {
  const drop = byId('drop');
  const input = byId('files');
  drop.onclick = () => input.click();
  input.onchange = () => {
    if (input.files.length) void importPhotos(input.files);
    input.value = '';
  };
  const carriesFiles = event => Array.from(event.dataTransfer.types).includes('Files');
  document.addEventListener('dragover', event => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('drop', event => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    void importPhotos(event.dataTransfer.files);
  });
  document.addEventListener('paste', event => {
    const photos = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (!photos.length) return;
    event.preventDefault();
    void importPhotos(photos);
  });
}

function wireCanvas() {
  preview.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const rect = preview.getBoundingClientRect();
    const frames = templates[state.template].panels;
    const index = frames.findIndex(({ points }) => contains(points,
      (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height));
    if (index < 0) return;
    selectPanel(index);
    preview.focus({ preventScroll: true });
    if (!activePanel().photo) return;
    const box = bounds(frames[index].points);
    drag = {
      pointer: event.pointerId, panel: activePanel(), start: { ...activePanel().crop },
      x: event.clientX, y: event.clientY,
      width: (box.right - box.left) * rect.width,
      height: (box.bottom - box.top) * rect.height,
    };
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId || drag.panel !== activePanel()) return;
    edit(() => {
      drag.panel.crop.x = clamp(drag.start.x + (event.clientX - drag.x) / drag.width, -4, 4);
      drag.panel.crop.y = clamp(drag.start.y + (event.clientY - drag.y) / drag.height, -4, 4);
    }, drag);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    preview.addEventListener(type, event => {
      if (drag?.pointer !== event.pointerId) return;
      if (editGroup === drag) editGroup = null;
      drag = null;
    });
  }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  preview.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = arrows[event.key];
    const zoom = ['+', '='].includes(event.key) ? .1 : ['-', '−'].includes(event.key) ? -.1 : 0;
    if (!direction && !zoom) return;
    event.preventDefault();
    edit(() => {
      const { crop } = activePanel();
      if (zoom) crop.zoom = clamp(Math.round((crop.zoom + zoom) * 100) / 100, 1, 3);
      if (direction) {
        crop.x = clamp(crop.x + direction[0] * .025, -4, 4);
        crop.y = clamp(crop.y + direction[1] * .025, -4, 4);
      }
    });
  });
}

function bindInput(id, update, read = input => input.value, event = 'input') {
  const input = byId(id);
  input.addEventListener(event, () => edit(() => update(read(input)), event === 'input' ? input : null));
  input.addEventListener('blur', () => { if (editGroup === input) editGroup = null; });
  if (input.type === 'range') {
    input.addEventListener('change', () => { if (editGroup === input) editGroup = null; });
  }
}

let exporting = false;
async function showResult() {
  if (exporting) return;
  exporting = true;
  try {
    const size = sizes[state.size];
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    drawCover(canvas.getContext('2d'), state, assets);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed.');
    const previous = outputURL;
    outputURL = objectURL(blob);
    byId('output-image').src = outputURL;
    byId('download').href = outputURL;
    byId('output-size').textContent = dimensions(size);
    if (previous) releaseURL(previous);
    if (!byId('result').open) byId('result').showModal();
  } catch {
    notice('Could not render the PNG. Please try again.');
  } finally {
    exporting = false;
  }
}

function wireEditor() {
  makeChoices('templates', templates, (node, option) => node.prepend(thumbnail(option)), changeTemplate);
  makeChoices('grades', grades, (node, option) => {
    const swatch = document.createElement('i');
    swatch.style.background = `linear-gradient(135deg, ${option.colors.join(', ')})`;
    node.prepend(swatch);
  }, key => { state.grade = key; });
  makeChoices('sizes', sizes, (node, size) => {
    const line = document.createElement('small');
    line.textContent = dimensions(size);
    node.append(line);
  }, key => { state.size = key; });

  for (const id of textFields) bindInput(id, value => { state[id] = value; });
  for (const id of ['role', 'sub']) bindInput(id, value => { activePanel()[id] = value; });
  for (const id of ['grain', 'halftone']) bindInput(id, value => { state[id] = value; }, input => input.checked, 'change');
  bindInput('intensity', value => { state.intensity = value; }, input => input.valueAsNumber);
  bindInput('scale', value => { activePanel().crop.zoom = value; }, input => input.valueAsNumber);

  byId('recenter').onclick = () => edit(() => { activePanel().crop = center(); });
  byId('undo').onclick = () => restore(past, future);
  byId('redo').onclick = () => restore(future, past);
  byId('fill-all').onclick = () => edit(() => {
    if (state.photo) for (const panel of state.panels) assign(panel, state.photo);
  });

  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) restore(future, past);
    else restore(past, future);
  });

  const guide = byId('guide');
  byId('help').onclick = () => guide.showModal();
  byId('demo').onclick = () => edit(fillDemo);
  byId('guide-demo').onclick = () => {
    guide.close();
    edit(fillDemo);
  };
  for (const control of document.querySelectorAll('dialog [data-close]')) {
    control.addEventListener('click', () => control.closest('dialog').close());
  }
  byId('export').onclick = showResult;
  byId('enlarge').onclick = showResult;
  wireImports();
  wireCanvas();
  new ResizeObserver(scheduleDraw).observe(stage);
}

async function start() {
  const [font, ...photos] = await Promise.allSettled([displayFont(), ...samples.map(sampleAsset)]);
  for (const photo of photos) {
    if (photo.status !== 'fulfilled') continue;
    assets.set(photo.value.id, photo.value);
    byId('samples').append(photoCard(photo.value));
  }
  fillDemo();
  wireEditor();
  sync();
  if (font.status === 'rejected' || photos.some(photo => photo.status === 'rejected')) {
    notice('Some studio assets could not be loaded. You can still use your own photos.');
  }
}

void start();
