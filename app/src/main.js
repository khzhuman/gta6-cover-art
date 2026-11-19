(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', start, { once: true });

  async function start() {
    const T = window.ViceFrameTemplates;
    const R = window.ViceFrameRenderer;
    const $ = id => document.getElementById(id);
    const canvas = $('preview-canvas');
    const assets = new Map();
    const undoStack = [];
    const redoStack = [];
    let state = {
      templateId: 'hero', gradeId: 'sunset', sizeId: 'square',
      caption: 'VICE SUMMER', subtitle: 'one last ride', intensity: 72, texture: true,
      selectedPanel: 0, panels: [], uploads: []
    };
    let samplePromise;
    let serial = 0;
    let renderQueued = false;
    let busy = false;
    let loading = true;
    let drag = null;
    let dragDepth = 0;
    let toastTimer;
    let outlineTimer;
    let resultURL;
    const inputSessions = new Set();

    const snapshot = () => JSON.stringify(state);
    const newPanel = assetId => ({ assetId, panX: 0.5, panY: 0.5, zoom: 1 });

    function notify(message, error = false) {
      clearTimeout(toastTimer);
      const toast = $('toast');
      toast.textContent = message;
      toast.classList.toggle('error', error);
      toast.hidden = false;
      toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 7000 : 3600);
    }

    function updateHistory() {
      $('undo-button').disabled = !undoStack.length;
      $('redo-button').disabled = !redoStack.length;
    }

    function record(before = snapshot()) {
      if (undoStack[undoStack.length - 1] !== before) undoStack.push(before);
      if (undoStack.length > 40) undoStack.shift();
      redoStack.length = 0;
      updateHistory();
    }

    function change(callback) {
      record();
      callback();
      syncUI();
      requestRender();
    }

    function undo() {
      if (!undoStack.length || drag) return;
      redoStack.push(snapshot());
      state = JSON.parse(undoStack.pop());
      inputSessions.clear();
      syncUI();
      requestRender();
    }

    function redo() {
      if (!redoStack.length || drag) return;
      undoStack.push(snapshot());
      state = JSON.parse(redoStack.pop());
      inputSessions.clear();
      syncUI();
      requestRender();
    }

    function loadImage(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('This image could not be opened. Try a JPG, PNG, or WEBP.'));
        image.src = source;
      });
    }

    function loadSamples() {
      if (samplePromise) return samplePromise;
      samplePromise = Promise.allSettled(T.samples.map(async sample => {
        // Data copies keep the canvas exportable when the page is opened as a local file.
        const embedded = window.ViceFrameSamplePixels?.[sample.id];
        const source = location.protocol === 'file:' && embedded ? `data:image/webp;base64,${embedded}` : sample.file;
        const image = await loadImage(source);
        assets.set(`sample:${sample.id}`, { id: `sample:${sample.id}`, name: sample.name, image, url: sample.file, sample: true });
      })).then(results => {
        const failed = results.filter(result => result.status === 'rejected');
        if (failed.length) notify('Some samples could not load. You can still use your own photos.', true);
        syncUI();
      });
      return samplePromise;
    }

    async function demo(withHistory = true) {
      await loadSamples();
      const available = ['portrait', 'car', 'beach'].map(id => `sample:${id}`).filter(id => assets.has(id));
      if (withHistory) {
        record();
        state = {
          templateId: 'hero', gradeId: 'sunset', sizeId: 'square',
          caption: 'VICE SUMMER', subtitle: 'one last ride', intensity: 72, texture: true,
          selectedPanel: 0, panels: T.getTemplate('hero').panels.map((_, i) => newPanel(available[i % available.length] || null)),
          uploads: state.uploads
        };
      } else if (!state.uploads.length) {
        state.panels = T.getTemplate(state.templateId).panels.map((_, i) => newPanel(available[i % available.length] || null));
      }
      loading = false;
      $('stage-loader').hidden = true;
      inputSessions.clear();
      syncUI();
      requestRender();
      if (withHistory) notify('VICE SUMMER is ready. Make it yours.');
    }

    function photoCard(asset, isSample, position) {
      const card = document.createElement('div');
      card.className = 'photo-card';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-button';
      button.dataset.asset = asset.id;
      button.title = `Use ${asset.name} in the selected panel`;
      button.setAttribute('aria-label', `Use ${asset.name} in the selected panel`);
      const image = document.createElement('img');
      image.src = asset.url;
      image.alt = asset.name;
      image.draggable = false;
      if (position) image.style.objectPosition = position;
      const name = document.createElement('span');
      name.className = 'photo-name';
      name.textContent = asset.name;
      const tick = document.createElement('span');
      tick.className = 'photo-selected';
      tick.textContent = '✓';
      tick.setAttribute('aria-hidden', 'true');
      tick.hidden = true;
      button.append(image, name, tick);
      button.addEventListener('click', () => {
        if (!assets.has(asset.id)) return;
        change(() => { state.panels[state.selectedPanel] = newPanel(asset.id); });
        showOutline();
      });
      card.append(button);
      if (!isSample) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'photo-remove';
        remove.textContent = '×';
        remove.title = `Remove ${asset.name}`;
        remove.setAttribute('aria-label', `Remove ${asset.name}`);
        remove.addEventListener('click', () => {
          change(() => {
            state.uploads = state.uploads.filter(id => id !== asset.id);
            const replacement = state.uploads[0] || (assets.has('sample:portrait') ? 'sample:portrait' : null);
            state.panels = state.panels.map(panel => panel.assetId === asset.id ? newPanel(replacement) : panel);
          });
        });
        card.append(remove);
      }
      return card;
    }

    function buildSampleStrip() {
      T.samples.forEach(sample => {
        $('sample-grid').append(photoCard({ id: `sample:${sample.id}`, name: sample.name, url: sample.file }, true, sample.position));
      });
    }

    function buildOptions() {
      T.templates.forEach(template => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'template-button';
        button.dataset.template = template.id;
        button.title = template.description;
        button.innerHTML = `<svg viewBox="0 0 44 32" aria-hidden="true"><use href="#layout-${template.icon}"/></svg>`;
        const label = document.createElement('span');
        label.textContent = template.name;
        button.append(label);
        button.addEventListener('click', () => {
          if (state.templateId === template.id) return;
          change(() => {
            const previous = state.panels;
            state.templateId = template.id;
            state.panels = template.panels.map((_, i) => ({ ...(previous[i % previous.length] || newPanel(null)) }));
            state.selectedPanel = Math.min(state.selectedPanel, state.panels.length - 1);
          });
        });
        $('template-options').append(button);
      });
      T.grades.forEach(grade => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'grade-button';
        button.dataset.grade = grade.id;
        button.title = grade.note;
        const swatch = document.createElement('span');
        swatch.className = 'grade-swatch';
        swatch.style.setProperty('--grade-start', grade.colors[0]);
        swatch.style.setProperty('--grade-end', grade.colors[1]);
        swatch.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = grade.name;
        button.append(swatch, label);
        button.addEventListener('click', () => {
          if (state.gradeId !== grade.id) change(() => { state.gradeId = grade.id; });
        });
        $('grade-options').append(button);
      });
      T.sizes.forEach(size => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'size-button';
        button.dataset.size = size.id;
        button.title = `${size.width} × ${size.height} pixels`;
        const label = document.createElement('span');
        label.textContent = size.name;
        const ratio = document.createElement('small');
        ratio.textContent = size.ratio;
        button.append(label, ratio);
        button.addEventListener('click', () => {
          if (state.sizeId !== size.id) change(() => { state.sizeId = size.id; });
        });
        $('size-options').append(button);
      });
    }

    function updateLibrary() {
      const grid = $('upload-grid');
      const signature = state.uploads.join('|');
      if (grid.dataset.signature !== signature) {
        grid.replaceChildren(...state.uploads.map(id => assets.get(id)).filter(Boolean).map(asset => photoCard(asset, false)));
        grid.dataset.signature = signature;
      }
      $('upload-section').hidden = !state.uploads.length;
      $('photo-count').textContent = state.uploads.length;
      const current = state.panels[state.selectedPanel]?.assetId;
      document.querySelectorAll('.photo-button').forEach(button => {
        const selected = button.dataset.asset === current;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.disabled = !assets.has(button.dataset.asset);
        button.querySelector('.photo-selected').hidden = !selected;
      });
      $('fill-all-button').disabled = !assets.has(current);
    }

    function updatePanelTabs() {
      const tabs = $('panel-tabs');
      const template = T.getTemplate(state.templateId);
      if (tabs.dataset.template !== state.templateId) {
        tabs.replaceChildren(...template.panels.map((panel, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'panel-tab';
          button.dataset.panel = index;
          const number = document.createElement('span');
          number.className = 'panel-tab-number';
          number.textContent = String(index + 1).padStart(2, '0');
          const name = document.createElement('span');
          name.textContent = panel.name;
          button.append(number, name);
          button.addEventListener('click', () => selectPanel(index));
          return button;
        }));
        tabs.dataset.template = state.templateId;
      }
      tabs.querySelectorAll('button').forEach(button => {
        const active = Number(button.dataset.panel) === state.selectedPanel;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function rangeFill(input) {
      const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
      input.style.setProperty('--range-fill', `${percent}%`);
    }

    function syncUI() {
      const size = T.getSize(state.sizeId);
      const grade = T.getGrade(state.gradeId);
      const panel = state.panels[state.selectedPanel];
      document.querySelectorAll('[data-template]').forEach(button => {
        if (!button.classList.contains('template-button')) return;
        const active = button.dataset.template === state.templateId;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      document.querySelectorAll('[data-grade]').forEach(button => {
        const active = button.dataset.grade === state.gradeId;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      document.querySelectorAll('[data-size]').forEach(button => {
        const active = button.dataset.size === state.sizeId;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if ($('caption-input').value !== state.caption) $('caption-input').value = state.caption;
      if ($('subtitle-input').value !== state.subtitle) $('subtitle-input').value = state.subtitle;
      $('caption-count').textContent = `${state.caption.length} / 36`;
      $('texture-input').checked = state.texture;
      $('intensity-input').value = state.intensity;
      $('intensity-input').disabled = grade.id === 'clean';
      $('intensity-value').textContent = grade.id === 'clean' ? '—' : `${state.intensity}%`;
      $('zoom-input').value = panel?.zoom || 1;
      $('zoom-value').textContent = `${Math.round((panel?.zoom || 1) * 100)}%`;
      const canCrop = !!assets.get(panel?.assetId);
      $('zoom-input').disabled = !canCrop;
      $('reset-crop-button').disabled = !canCrop;
      $('crop-hint').textContent = canCrop ? 'Drag photo to reframe' : 'Pick a photo for this panel';
      $('layout-note').textContent = T.getTemplate(state.templateId).description;
      $('preview-size-label').textContent = size.ratio;
      $('size-note').textContent = `${size.width} × ${size.height} px`;
      const hasPhoto = state.panels.some(item => assets.has(item.assetId));
      $('export-button').disabled = busy || loading || !hasPhoto;
      $('view-button').disabled = busy || loading || !hasPhoto;
      $('export-button').querySelector('span').textContent = busy ? 'Creating PNG…' : 'Export cover';
      canvas.setAttribute('aria-label', `Live ${size.name.toLowerCase()} cover: ${state.caption || 'untitled'}. Click a panel and drag to reposition its photo. Arrow keys pan the selected photo.`);
      rangeFill($('zoom-input'));
      rangeFill($('intensity-input'));
      updatePanelTabs();
      updateLibrary();
      updateHistory();
    }

    function requestRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        const stage = $('stage-space');
        const style = getComputedStyle(stage);
        const availableW = Math.max(100, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
        const availableH = Math.max(100, stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
        const size = T.getSize(state.sizeId);
        const ratio = size.width / size.height;
        const cssW = Math.floor(Math.min(availableW, availableH * ratio));
        const cssH = cssW / ratio;
        const wrap = $('canvas-wrap');
        wrap.style.width = `${cssW}px`;
        wrap.style.height = `${cssH}px`;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        try {
          R.render(canvas, state, assets, cssW * dpr, cssH * dpr);
          updateOutline();
        } catch (error) {
          notify(error.message || 'The preview could not render.', true);
        }
      });
    }

    function updateOutline() {
      const rect = T.panelLayout(state.templateId, canvas.width, canvas.height)[state.selectedPanel];
      $('panel-outline').setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
      if (rect) $('outline-path').setAttribute('d', rect.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ') + ' Z');
    }

    function showOutline() {
      clearTimeout(outlineTimer);
      updateOutline();
      $('panel-outline').classList.remove('outline-hidden');
      outlineTimer = setTimeout(() => {
        if (!drag) $('panel-outline').classList.add('outline-hidden');
      }, 1600);
    }

    function selectPanel(index) {
      state.selectedPanel = T.clamp(index, 0, state.panels.length - 1);
      syncUI();
      showOutline();
    }

    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      });
    }

    async function addPhotos(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      notify('Opening your photos…');
      const results = await Promise.allSettled(files.map(async file => {
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(file.name)) {
          throw new Error(`${file.name} is not a supported photo.`);
        }
        const url = await readFile(file);
        const image = await loadImage(url);
        const id = `upload:${Date.now().toString(36)}-${serial++}`;
        const asset = { id, name: file.name, image, url, sample: false };
        assets.set(id, asset);
        return id;
      }));
      const added = results.filter(result => result.status === 'fulfilled').map(result => result.value);
      const failed = results.filter(result => result.status === 'rejected');
      if (added.length) {
        change(() => {
          state.uploads.push(...added);
          state.panels = T.getTemplate(state.templateId).panels.map((_, index) => newPanel(added[index % added.length]));
          state.selectedPanel = 0;
        });
        loading = false;
        $('stage-loader').hidden = true;
        syncUI();
        notify(added.length === 1 ? 'Your photo fills every panel. Drag to find each angle.' : `${added.length} photos added. Your cover is taking shape.`);
      }
      if (failed.length) {
        const detail = failed[0].reason?.message || 'Try a JPG, PNG, or WEBP.';
        notify(`${failed.length === 1 ? 'One photo' : `${failed.length} photos`} could not open. ${detail}`, true);
      }
    }

    function pointOnCanvas(event) {
      const box = canvas.getBoundingClientRect();
      return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height };
    }

    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || loading || drag) return;
      const point = pointOnCanvas(event);
      const layout = T.panelLayout(state.templateId, canvas.width, canvas.height);
      const rect = layout.find(panel => T.pointInPanel(point.x, point.y, panel.points));
      if (!rect) return;
      selectPanel(rect.index);
      const panel = state.panels[rect.index];
      const asset = assets.get(panel.assetId);
      if (!asset) return;
      canvas.focus({ preventScroll: true });
      drag = {
        pointerId: event.pointerId, before: snapshot(), point, panel: { ...panel },
        crop: R.cropGeometry(asset.image, rect, panel), index: rect.index, changed: false
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-panning');
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = pointOnCanvas(event);
      const panel = state.panels[drag.index];
      if (drag.crop.overflowX > 0.1) panel.panX = T.clamp(drag.panel.panX - (point.x - drag.point.x) / drag.crop.overflowX, 0, 1);
      if (drag.crop.overflowY > 0.1) panel.panY = T.clamp(drag.panel.panY - (point.y - drag.point.y) / drag.crop.overflowY, 0, 1);
      drag.changed = panel.panX !== drag.panel.panX || panel.panY !== drag.panel.panY;
      requestRender();
      showOutline();
    });
    function finishDrag(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.changed) record(drag.before);
      drag = null;
      canvas.classList.remove('is-panning');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      showOutline();
    }
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('lostpointercapture', event => {
      if (drag) finishDrag(event);
    });

    function bindInput(id, update) {
      const input = $(id);
      input.addEventListener('input', () => {
        if (!inputSessions.has(id)) { record(); inputSessions.add(id); }
        update(input.value);
        syncUI();
        requestRender();
      });
      input.addEventListener('change', () => inputSessions.delete(id));
      input.addEventListener('blur', () => inputSessions.delete(id));
    }
    bindInput('caption-input', value => { state.caption = value; });
    bindInput('subtitle-input', value => { state.subtitle = value; });
    bindInput('zoom-input', value => {
      const panel = state.panels[state.selectedPanel];
      if (panel) panel.zoom = T.clamp(Number(value), 1, 3);
    });
    bindInput('intensity-input', value => { state.intensity = T.clamp(Number(value), 0, 100); });
    $('texture-input').addEventListener('change', event => change(() => { state.texture = event.target.checked; }));
    $('reset-crop-button').addEventListener('click', () => {
      change(() => {
        const panel = state.panels[state.selectedPanel];
        if (panel) { panel.panX = panel.panY = 0.5; panel.zoom = 1; }
      });
      showOutline();
    });
    $('fill-all-button').addEventListener('click', () => {
      const id = state.panels[state.selectedPanel]?.assetId;
      if (!assets.has(id)) return;
      change(() => { state.panels = state.panels.map(() => newPanel(id)); });
      notify('One photo. Every panel. Find a different angle in each.');
    });
    $('photo-input').addEventListener('change', event => {
      addPhotos(event.target.files);
      event.target.value = '';
    });
    $('upload-zone').addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('photo-input').click(); }
    });

    const carriesFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
    document.addEventListener('dragenter', event => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth++;
      $('drop-overlay').hidden = false;
    });
    document.addEventListener('dragover', event => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', event => {
      if (!carriesFiles(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) $('drop-overlay').hidden = true;
    });
    document.addEventListener('drop', event => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth = 0;
      $('drop-overlay').hidden = true;
      addPhotos(event.dataTransfer.files);
    });
    window.addEventListener('blur', () => { dragDepth = 0; $('drop-overlay').hidden = true; });
    document.addEventListener('paste', event => {
      const files = event.clipboardData?.files;
      if (files?.length) { event.preventDefault(); addPhotos(files); }
    });

    document.addEventListener('keydown', event => {
      const typing = event.target.matches('input, textarea, [contenteditable="true"]');
      if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (event.target !== canvas || drag) return;
      const panel = state.panels[state.selectedPanel];
      if (!panel) return;
      const directions = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (directions[event.key]) {
        event.preventDefault();
        if (!event.repeat) record();
        const step = event.shiftKey ? 0.08 : 0.02;
        const [x, y] = directions[event.key];
        panel.panX = T.clamp(panel.panX + x * step, 0, 1);
        panel.panY = T.clamp(panel.panY + y * step, 0, 1);
        requestRender();
        showOutline();
      } else if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault();
        change(() => { panel.zoom = T.clamp(panel.zoom + (event.key === '-' ? -0.1 : 0.1), 1, 3); });
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        selectPanel(Number(event.key) - 1);
      }
    });
    $('undo-button').addEventListener('click', undo);
    $('redo-button').addEventListener('click', redo);
    $('demo-button').addEventListener('click', () => demo());

    async function exportCover(download) {
      if (busy || loading) return;
      busy = true;
      syncUI();
      const saved = JSON.parse(snapshot());
      try {
        const blob = await R.png(saved, assets);
        if (resultURL) URL.revokeObjectURL(resultURL);
        resultURL = URL.createObjectURL(blob);
        const size = T.getSize(saved.sizeId);
        const slug = saved.caption.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'your-cover';
        const name = `vice-frame-${slug}-${size.width}x${size.height}.png`;
        $('result-image').src = resultURL;
        $('result-image').alt = `${saved.caption || 'Your'} cover, ${T.getTemplate(saved.templateId).name}, ${T.getGrade(saved.gradeId).name}`;
        $('download-again').href = resultURL;
        $('download-again').download = name;
        $('result-dimensions').textContent = `${size.width} × ${size.height}`;
        $('result-description').textContent = download ? 'Your PNG is ready. Save it, share it, make it yours.' : 'Take a closer look. Your full-resolution PNG is ready whenever you are.';
        if (download) {
          const link = document.createElement('a');
          link.href = resultURL;
          link.download = name;
          document.body.append(link);
          link.click();
          link.remove();
        }
        $('result-dialog').showModal();
      } catch (error) {
        notify(error.message || 'The PNG could not be exported. Please try again.', true);
      } finally {
        busy = false;
        syncUI();
      }
    }
    $('export-button').addEventListener('click', () => exportCover(true));
    $('view-button').addEventListener('click', () => exportCover(false));
    $('help-button').addEventListener('click', () => $('help-dialog').showModal());
    $('help-demo-button').addEventListener('click', () => { $('help-dialog').close(); demo(); });
    document.querySelectorAll('[data-close-dialog]').forEach(button => {
      button.addEventListener('click', () => button.closest('dialog').close());
    });
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
      });
    });
    window.addEventListener('beforeunload', () => { if (resultURL) URL.revokeObjectURL(resultURL); });
    window.addEventListener('resize', requestRender);
    if (window.ResizeObserver) new ResizeObserver(requestRender).observe($('stage-space'));

    state.panels = T.getTemplate(state.templateId).panels.map(() => newPanel(null));
    buildOptions();
    buildSampleStrip();
    syncUI();
    requestRender();
    if (document.fonts) document.fonts.load('700 32px "ViceDisplay"').then(requestRender).catch(() => requestRender());
    await demo(false);
  }
})();
