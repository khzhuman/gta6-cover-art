import { arrangements, treatments, dimensions, stock, bounded, findByKey, panelShapes, pointInPanel } from './templates.js';
import { paintCover, photoBounds, makePNG } from './cover.js';
import { displayFont, imageFromURL, objectURL, releaseURL, sampleAsset } from './assets.js';

const $ = id => document.getElementById(id);
const photos = new Map();
const undoStack = [], redoStack = [];
const centered = asset => ({ asset, horizontal: .5, vertical: .5, scale: 1 });
let cover = {
  template: 'hero', grade: 'sunset', size: 'square', headline: 'VICE SUMMER',
  tagline: 'one last ride', intensity: 72, grain: true,
  frames: ['portrait', 'car', 'beach'].map(centered), personal: []
};
let selected = 0, gesture = null, paintPending = false, highlight = false;
let highlightTimer, messageTimer, exportURL, busy = false, ready = false, serial = 0;
const preview = $('preview');
const saveState = () => JSON.stringify(cover);
const frame = () => cover.frames[selected];
const format = () => findByKey(dimensions, cover.size);

function tell(message) {
  clearTimeout(messageTimer);
  $('notice').textContent = message;
  $('notice').hidden = false;
  messageTimer = setTimeout(() => { $('notice').hidden = true; }, 4000);
}

function remember() {
  const state = saveState();
  if (undoStack.at(-1) !== state) undoStack.push(state);
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
}

function edit(action) {
  remember();
  action();
  refresh();
}

function travel(from, to) {
  if (!from.length || gesture) return;
  to.push(saveState());
  cover = JSON.parse(from.pop());
  selected = Math.min(selected, cover.frames.length - 1);
  refresh();
}

function repaint() {
  if (paintPending) return;
  paintPending = true;
  requestAnimationFrame(() => {
    paintPending = false;
    const area = $('stage'), size = format();
    const width = Math.max(60, Math.min(area.clientWidth - 52, (area.clientHeight - 66) * size.width / size.height));
    const height = width * size.height / size.width;
    Object.assign($('sheet').style, { width: `${width}px`, height: `${height}px` });
    const density = Math.min(2, window.devicePixelRatio || 1);
    paintCover(preview, cover, photos, width * density, height * density, highlight ? selected : -1);
  });
}

function flashPanel() {
  clearTimeout(highlightTimer);
  highlight = true;
  repaint();
  highlightTimer = setTimeout(() => { highlight = false; repaint(); }, 1100);
}

function button(label, handler) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', handler);
  return element;
}

function photoTile(photo) {
  const tile = button('', () => {
    edit(() => { cover.frames[selected] = centered(photo.key); });
    flashPanel();
  });
  tile.className = 'photo-card';
  tile.dataset.asset = photo.key;
  tile.setAttribute('aria-label', `Use ${photo.name} in selected panel`);
  const image = new Image();
  image.src = photo.url;
  image.alt = photo.name;
  image.draggable = false;
  const caption = document.createElement('span');
  caption.textContent = photo.name;
  tile.append(image, caption);
  if (!photo.personal) return tile;
  const wrapper = document.createElement('div');
  wrapper.className = 'personal-card';
  const remove = button('×', () => edit(() => {
    cover.personal = cover.personal.filter(key => key !== photo.key);
    cover.frames = cover.frames.map(pose => pose.asset === photo.key ? centered('portrait') : pose);
  }));
  remove.className = 'remove';
  remove.setAttribute('aria-label', `Remove ${photo.name}`);
  wrapper.append(tile, remove);
  return wrapper;
}

function refresh() {
  selected = bounded(selected, 0, cover.frames.length - 1);
  for (const [group, property] of [['templates', 'template'], ['grades', 'grade'], ['sizes', 'size']]) {
    $(group).querySelectorAll('button').forEach(element => {
      const pressed = element.dataset.key === cover[property];
      element.classList.toggle('selected', pressed);
      element.setAttribute('aria-pressed', String(pressed));
    });
  }
  ['headline', 'tagline', 'intensity'].forEach(id => { $(id).value = cover[id]; });
  $('grain').checked = cover.grain;
  $('letters').textContent = `${cover.headline.length} / 36`;
  $('intensity-readout').textContent = `${cover.intensity}%`;
  $('intensity').disabled = cover.grade === 'clean';
  $('scale').value = frame().scale;
  $('scale-readout').textContent = `${Math.round(frame().scale * 100)}%`;
  $('aspect').textContent = format().ratio;
  $('pixels').textContent = `${format().width} × ${format().height} px`;
  $('template-note').textContent = findByKey(arrangements, cover.template).detail;
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
  $('export').disabled = busy || !ready || !cover.frames.some(pose => photos.has(pose.asset));
  $('enlarge').disabled = $('export').disabled;
  $('frame-picks').replaceChildren(...cover.frames.map((pose, index) => {
    const role = index === 0 && cover.template === 'hero' ? 'Hero' : 'Scene';
    const pick = button(`${String(index + 1).padStart(2, '0')} ${role}`, () => {
      selected = index;
      refresh();
      flashPanel();
    });
    pick.classList.toggle('selected', index === selected);
    pick.setAttribute('aria-label', `Select panel ${index + 1}`);
    pick.setAttribute('aria-pressed', String(index === selected));
    return pick;
  }));
  const signature = cover.personal.join('|');
  if ($('uploads').dataset.signature !== signature) {
    $('uploads').replaceChildren(...cover.personal.map(key => photoTile(photos.get(key))));
    $('uploads').dataset.signature = signature;
  }
  $('personal').hidden = cover.personal.length === 0;
  $('upload-count').textContent = cover.personal.length;
  document.querySelectorAll('[data-asset]').forEach(tile => {
    const pressed = tile.dataset.asset === frame().asset;
    tile.classList.toggle('selected', pressed);
    tile.setAttribute('aria-pressed', String(pressed));
    tile.disabled = !photos.has(tile.dataset.asset);
  });
  repaint();
}

function buildChoices() {
  const svgNS = 'http://www.w3.org/2000/svg';
  for (const layout of arrangements) {
    const pick = button('', () => edit(() => {
      const previous = cover.frames;
      cover.template = layout.key;
      cover.frames = layout.paths.map((_, i) => ({ ...previous[i % previous.length] }));
    }));
    const miniature = document.createElementNS(svgNS, 'svg');
    miniature.setAttribute('viewBox', '0 0 48 34');
    for (const vertices of layout.paths) {
      const polygon = document.createElementNS(svgNS, 'polygon');
      polygon.setAttribute('points', vertices.map(([x, y]) => `${3 + x * 42},${3 + y * 28}`).join(' '));
      miniature.append(polygon);
    }
    const label = document.createElement('span');
    label.textContent = layout.name;
    pick.append(miniature, label);
    pick.dataset.key = layout.key;
    pick.title = layout.detail;
    $('templates').append(pick);
  }
  for (const grade of treatments) {
    const pick = button('', () => edit(() => { cover.grade = grade.key; }));
    const swatch = document.createElement('i');
    swatch.style.background = `linear-gradient(135deg,${grade.palette.join(',')})`;
    pick.append(swatch, document.createTextNode(grade.name));
    pick.dataset.key = grade.key;
    $('grades').append(pick);
  }
  for (const size of dimensions) {
    const pick = button(size.name, () => edit(() => { cover.size = size.key; }));
    const ratio = document.createElement('small');
    ratio.textContent = size.ratio;
    pick.append(ratio);
    pick.dataset.key = size.key;
    $('sizes').append(pick);
  }
}

async function addPhotos(files) {
  const imported = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = objectURL(file);
    try {
      const bitmap = await imageFromURL(url);
      const key = `personal-${++serial}`;
      photos.set(key, { key, name: file.name, url, bitmap, personal: true });
      imported.push(key);
    } catch {
      releaseURL(url);
      tell(`Could not open ${file.name}. Try a JPG, PNG or WebP.`);
    }
  }
  if (!imported.length) return;
  edit(() => {
    cover.personal.push(...imported);
    cover.frames = cover.frames.map((_, i) => centered(imported[i % imported.length]));
  });
  tell(`${imported.length} photo${imported.length === 1 ? '' : 's'} added. Drag to reframe.`);
}

function demo() {
  edit(() => {
    cover.headline = 'VICE SUMMER';
    cover.tagline = 'one last ride';
    const cast = cover.template === 'duo' ? ['portrait', 'car'] : ['portrait', 'car', 'beach', 'man'];
    cover.frames = findByKey(arrangements, cover.template).paths.map((_, i) => centered(cast[i % cast.length]));
  });
}

async function exportCover() {
  if (busy || !ready) return;
  busy = true;
  refresh();
  $('export').textContent = 'Rendering your cover…';
  // Use one immutable design for the pixels, filename and dimensions.
  const exporting = JSON.parse(saveState());
  try {
    const blob = await makePNG(exporting, photos);
    releaseURL(exportURL);
    exportURL = objectURL(blob);
    $('output-image').src = exportURL;
    await $('output-image').decode();
    $('download').href = exportURL;
    $('download').download = `vice-frame-${exporting.size}.png`;
    const size = findByKey(dimensions, exporting.size);
    $('output-size').textContent = `${size.width} × ${size.height}`;
    $('result').showModal();
  } catch (error) {
    tell(error.message);
  } finally {
    busy = false;
    const arrow = document.createElement('span');
    arrow.textContent = '→';
    $('export').replaceChildren(document.createTextNode('↧ \u00a0 Export cover '), arrow);
    refresh();
  }
}

function bindControls() {
  $('demo').onclick = demo;
  $('guide-demo').onclick = () => { $('guide').close(); demo(); };
  $('help').onclick = () => $('guide').showModal();
  document.querySelectorAll('[data-close]').forEach(element => {
    element.onclick = () => element.closest('dialog').close();
  });
  $('export').onclick = $('enlarge').onclick = exportCover;
  $('drop').onclick = () => $('files').click();
  $('files').onchange = event => {
    addPhotos(event.target.files);
    event.target.value = '';
  };
  $('fill-all').onclick = () => edit(() => { cover.frames = cover.frames.map(() => centered(frame().asset)); });
  $('recenter').onclick = () => edit(() => Object.assign(frame(), centered(frame().asset)));
  $('undo').onclick = () => travel(undoStack, redoStack);
  $('redo').onclick = () => travel(redoStack, undoStack);
  for (const id of ['headline', 'tagline', 'intensity']) {
    $(id).oninput = () => edit(() => { cover[id] = id === 'intensity' ? Number($(id).value) : $(id).value; });
  }
  $('grain').onchange = () => edit(() => { cover.grain = $('grain').checked; });
  $('scale').oninput = () => edit(() => { frame().scale = Number($('scale').value); });
}

function bindCanvas() {
  preview.onpointerdown = event => {
    const rect = preview.getBoundingClientRect();
    const ratio = preview.width / rect.width;
    const x = (event.clientX - rect.left) * ratio;
    const y = (event.clientY - rect.top) * preview.height / rect.height;
    const hit = panelShapes(cover.template, preview.width, preview.height).find(panel => pointInPanel(panel.polygon, x, y));
    if (!hit) return;
    selected = hit.slot;
    remember();
    gesture = { x: event.clientX, y: event.clientY, pose: { ...frame() }, panel: hit, ratio };
    preview.setPointerCapture(event.pointerId);
    preview.focus();
    refresh();
    flashPanel();
  };
  preview.onpointermove = event => {
    if (!gesture) return;
    const photo = photos.get(frame().asset);
    if (!photo) return;
    const crop = photoBounds(photo.bitmap, gesture.panel, gesture.pose);
    frame().horizontal = bounded(gesture.pose.horizontal - (event.clientX - gesture.x) * gesture.ratio / Math.max(1, crop.overflowX), 0, 1);
    frame().vertical = bounded(gesture.pose.vertical - (event.clientY - gesture.y) * gesture.ratio / Math.max(1, crop.overflowY), 0, 1);
    repaint();
  };
  preview.onpointerup = preview.onpointercancel = () => { gesture = null; refresh(); };
  preview.onkeydown = event => {
    const moves = { ArrowLeft: [.025, 0], ArrowRight: [-.025, 0], ArrowUp: [0, .025], ArrowDown: [0, -.025] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      edit(() => {
        frame().horizontal = bounded(frame().horizontal + move[0], 0, 1);
        frame().vertical = bounded(frame().vertical + move[1], 0, 1);
      });
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      edit(() => { frame().scale = bounded(frame().scale + (event.key === '-' ? -.1 : .1), 1, 3); });
    }
  };
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.target.matches('input')) {
      event.preventDefault();
      if (event.shiftKey) travel(redoStack, undoStack);
      else travel(undoStack, redoStack);
    }
  });
  for (const type of ['dragover', 'drop']) document.addEventListener(type, event => event.preventDefault());
  document.addEventListener('drop', event => addPhotos(event.dataTransfer.files));
  document.addEventListener('paste', event => {
    if (event.clipboardData.files.length) addPhotos(event.clipboardData.files);
  });
  new ResizeObserver(repaint).observe($('stage'));
}

buildChoices();
bindControls();
bindCanvas();
refresh();
await Promise.all([
  displayFont().catch(() => tell('Display font unavailable. Please reload the studio.')),
  ...stock.map(async scene => {
    try { photos.set(scene.key, await sampleAsset(scene)); }
    catch { tell(`Sample unavailable: ${scene.name}`); }
  })
]);
$('samples').replaceChildren(...stock.filter(scene => photos.has(scene.key)).map(scene => photoTile(photos.get(scene.key))));
await document.fonts.ready;
ready = true;
refresh();
