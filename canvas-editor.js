(() => {
  'use strict';

  const FABRIC_VERSION = '6';
  const DEFAULT_SIZE = { width: 420, height: 380 };
  const SERIALIZE_PROPS = ['id', 'name', 'dataBinding', 'cardRole', 'selectable', 'evented'];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value, min)));
  const fabricApi = () => globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric?.Canvas ? globalThis.fabric.fabric : null;
  const themeValue = (name, fallback) => typeof document !== 'undefined' && typeof getComputedStyle === 'function'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    : fallback;
  const currentTheme = () => ({
    surface: themeValue('--ui-surface-raised', themeValue('--panel-2', '#2b160d')),
    surfaceSoft: themeValue('--ui-surface', themeValue('--panel', '#1b100a')),
    text: themeValue('--ui-text', themeValue('--text', '#f7ead2')),
    muted: themeValue('--ui-text-muted', themeValue('--muted', '#c8a878')),
    accent: themeValue('--ui-accent', themeValue('--accent', '#bd662f')),
    border: themeValue('--ui-border', themeValue('--border', '#75451f')),
    shadow: themeValue('--shadow', '0 20px 60px rgba(0,0,0,.35)')
  });

  function requireFabric() {
    const fabric = fabricApi();
    if (!fabric) throw new Error(`Fabric.js ${FABRIC_VERSION} is not loaded yet.`);
    return fabric;
  }

  function validScene(value) {
    return value && typeof value === 'object' && Array.isArray(value.objects) && value.objects.length ? value : null;
  }

  function templateJson(template = {}) {
    return validScene(template.fabricCanvasJson)
      || validScene(template.canvasJson)
      || validScene(template.fabricJson)
      || validScene(template.canvas?.fabricJson);
  }

  function baseScene({ width = DEFAULT_SIZE.width, height = DEFAULT_SIZE.height, theme = currentTheme(), record = {} } = {}) {
    return {
      version: FABRIC_VERSION,
      objects: [
        { type: 'rect', id: 'card-bg', name: 'Card background', cardRole: 'background', left: 0, top: 0, width, height, fill: theme.surface, stroke: theme.border, strokeWidth: 2, rx: 22, ry: 22, selectable: false, evented: false },
        { type: 'textbox', id: 'title', name: 'Title', cardRole: 'title', dataBinding: { path: 'title' }, left: width * .34, top: height * .07, width: width * .58, fontSize: Math.max(24, width * .075), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.title || 'Book Title' },
        { type: 'textbox', id: 'author', name: 'Author', cardRole: 'metadata', dataBinding: { path: 'author' }, left: width * .34, top: height * .25, width: width * .28, fontSize: Math.max(14, width * .036), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.author || 'Author' },
        { type: 'textbox', id: 'series', name: 'Series', cardRole: 'metadata', dataBinding: { path: 'series' }, left: width * .64, top: height * .25, width: width * .28, fontSize: Math.max(14, width * .036), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.series || 'Series' },
        { type: 'textbox', id: 'status', name: 'Status', cardRole: 'metadata', dataBinding: { path: 'status' }, left: width * .06, top: height * .53, width: width * .25, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.status || 'status' },
        { type: 'textbox', id: 'progress', name: 'Progress', cardRole: 'progress', dataBinding: { path: 'progress' }, left: width * .34, top: height * .53, width: width * .58, fontSize: Math.max(16, width * .042), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: `${record.progress ?? 0}%` },
        { type: 'textbox', id: 'rating', name: 'Overall', cardRole: 'rating', dataBinding: { path: 'rating' }, left: width * .06, top: height * .72, width: width * .25, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.accent, text: `★★★★★\n${record.rating ?? 0} of 5` },
        { type: 'textbox', id: 'spice', name: 'Spice', cardRole: 'rating', dataBinding: { path: 'spice' }, left: width * .37, top: height * .72, width: width * .22, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: `🔥🔥\n${record.spice ?? 0} of 5` },
        { type: 'textbox', id: 'impact', name: 'Impact', cardRole: 'rating', dataBinding: { path: 'impact' }, left: width * .67, top: height * .72, width: width * .24, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.accent, text: `♥♥♥\n${record.impact ?? 0} of 5` }
      ],
      background: theme.surfaceSoft
    };
  }

  function bindRecord(scene, record = {}) {
    const clone = JSON.parse(JSON.stringify(validScene(scene) || baseScene({ record })));
    (clone.objects || []).forEach(object => {
      const path = object.dataBinding?.path;
      if (!path) return;
      const value = path.split('.').reduce((current, key) => current?.[key], record);
      if (path === 'progress') object.text = `${value ?? 0}%`;
      else if (['rating', 'spice', 'impact'].includes(path)) object.text = object.text?.replace(/\n.*/, `\n${value ?? 0} of 5`) || `${value ?? 0} of 5`;
      else object.text = String(value ?? object.text ?? '');
    });
    return clone;
  }

  async function loadScene(canvas, scene, record) {
    const json = bindRecord(scene, record);
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    return canvas;
  }

  function serializeCanvas(canvas) {
    return canvas.toJSON(SERIALIZE_PROPS);
  }

  function setUniformScale(canvas, targetWidth = canvas.getWidth()) {
    const baseWidth = number(canvas.__designWidth || canvas.getWidth(), canvas.getWidth());
    const zoom = baseWidth ? targetWidth / baseWidth : 1;
    canvas.setZoom(zoom);
    canvas.setDimensions({ width: Math.round(baseWidth * zoom), height: Math.round(number(canvas.__designHeight || canvas.getHeight(), canvas.getHeight()) * zoom) });
    canvas.renderAll();
    return zoom;
  }

  function addShapeBox(canvas, options = {}) {
    const fabric = requireFabric(), theme = currentTheme();
    const rect = new fabric.Rect({
      left: 42,
      top: 42,
      width: 150,
      height: 96,
      rx: 18,
      ry: 18,
      fill: options.fill || theme.surfaceSoft,
      stroke: options.stroke || theme.accent,
      strokeWidth: 2,
      shadow: options.shadow || '0 12px 24px rgba(0,0,0,.28)'
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
    return rect;
  }

  function addEditableTextBox(canvas, text = 'Type something beautiful…', options = {}) {
    const fabric = requireFabric(), theme = currentTheme();
    const textbox = new fabric.Textbox(text, {
      left: 64,
      top: 64,
      width: 240,
      fontSize: options.fontSize || 24,
      fontFamily: options.fontFamily || 'Libre Baskerville',
      fontWeight: options.fontWeight || '700',
      fill: options.fill || theme.text,
      splitByGrapheme: true
    });
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
    textbox.enterEditing?.();
    return textbox;
  }

  function fieldText(path, record = {}) {
    const value = path.split('.').reduce((current, key) => current?.[key], record);
    if (path === 'progress') return `${value ?? 0}%`;
    if (path === 'rating') return `★★★★★\n${value ?? 0} of 5`;
    if (path === 'spice') return `🔥🔥\n${value ?? 0} of 5`;
    if (path === 'impact') return `♥♥♥\n${value ?? 0} of 5`;
    return String(value ?? path);
  }

  function addBoundTextBox(canvas, path, record = {}, options = {}) {
    const object = addEditableTextBox(canvas, fieldText(path, record), options);
    object.set({
      id: options.id || path,
      name: options.name || path.charAt(0).toUpperCase() + path.slice(1),
      dataBinding: { path },
      cardRole: options.cardRole || 'metadata'
    });
    object.exitEditing?.();
    canvas.requestRenderAll();
    return object;
  }

  function addImageFromFile(canvas, file) {
    const fabric = requireFabric();
    return new Promise((resolve, reject) => {
      if (!file?.type?.startsWith('image/')) return reject(new Error('Choose an image file.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Image could not be read.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Image could not be opened.'));
        image.onload = () => {
          const fabricImage = new fabric.Image(image, { left: 56, top: 56, opacity: 1 });
          fabricImage.scaleToWidth(Math.min(240, canvas.__designWidth * .5));
          canvas.add(fabricImage);
          canvas.setActiveObject(fabricImage);
          canvas.requestRenderAll();
          resolve(fabricImage);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function deleteActiveElement(canvas) {
    const active = canvas.getActiveObject();
    if (!active) return false;
    if (active.type === 'activeSelection') active.forEachObject(object => canvas.remove(object));
    else canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return true;
  }

  function initCanvasEditor(canvasId, theme = currentTheme(), options = {}) {
    const fabric = requireFabric(), element = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!element) throw new Error('Canvas element was not found.');
    const width = number(options.width, DEFAULT_SIZE.width), height = number(options.height, DEFAULT_SIZE.height);
    const canvas = new fabric.Canvas(element, {
      width,
      height,
      backgroundColor: theme.surfaceSoft || currentTheme().surfaceSoft,
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true
    });
    canvas.__designWidth = width;
    canvas.__designHeight = height;
    canvas.on('object:added', () => options.onChange?.(canvas));
    canvas.on('object:modified', () => options.onChange?.(canvas));
    canvas.on('object:removed', () => options.onChange?.(canvas));
    return {
      canvas,
      canvasInstance: canvas,
      addShapeBox: extra => addShapeBox(canvas, extra),
      addRectangle: extra => addShapeBox(canvas, extra),
      addEditableTextBox: (text, extra) => addEditableTextBox(canvas, text, extra),
      addTextBox: (text, extra) => addEditableTextBox(canvas, text, extra),
      addBoundTextBox: (path, record, extra) => addBoundTextBox(canvas, path, record, extra),
      addImageFromFile: file => addImageFromFile(canvas, file),
      handleImageUpload: file => addImageFromFile(canvas, file),
      deleteActiveElement: () => deleteActiveElement(canvas),
      deleteSelected: () => deleteActiveElement(canvas),
      serializeCanvas: () => serializeCanvas(canvas),
      setUniformScale: targetWidth => setUniformScale(canvas, targetWidth),
      setZoom: zoom => { canvas.setZoom(zoom); canvas.requestRenderAll(); return zoom; },
      loadJSON: json => loadScene(canvas, json, options.record)
    };
  }

  function editorShell({ canvasId, title, width, height }) {
    return `<section class="fabric-card-editor" aria-label="Canvas card editor">
      <header class="fabric-editor-header">
        <div><p class="eyebrow">Canvas card editor</p><h2 id="formModalTitle">${escapeHtml(title)}</h2><p>${width} × ${height} · Fabric.js ${FABRIC_VERSION}</p></div>
        <div class="fabric-editor-actions"><button type="button" class="primary-button" data-fabric-save>Save</button><button type="button" data-fabric-close>Cancel</button></div>
      </header>
      <div class="fabric-editor-layout">
        <aside class="fabric-editor-sidebar" aria-label="Canvas tools">
          <button type="button" data-fabric-add="shape">Shape box</button>
          <button type="button" data-fabric-add="text">Text box</button>
          <div class="fabric-field-palette" aria-label="Book fields">
            <p>Book fields</p>
            <button type="button" data-fabric-field="title">Title</button>
            <button type="button" data-fabric-field="author">Author</button>
            <button type="button" data-fabric-field="series">Series</button>
            <button type="button" data-fabric-field="status">Status</button>
            <button type="button" data-fabric-field="progress">Progress</button>
            <button type="button" data-fabric-field="rating">Overall</button>
            <button type="button" data-fabric-field="spice">Spice</button>
            <button type="button" data-fabric-field="impact">Impact</button>
          </div>
          <label class="fabric-upload-control">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" data-fabric-upload></label>
          <button type="button" data-fabric-delete>Delete selected</button>
          <label>Zoom <input type="range" min="40" max="180" value="100" data-fabric-zoom></label>
          <div class="fabric-color-row"><label>Fill <input type="color" value="#bd662f" data-fabric-fill></label><label>Text <input type="color" value="#f7ead2" data-fabric-text></label></div>
          <p class="fabric-editor-hint">Drag, resize, rotate, edit text inline, or upload art. Everything saves as Fabric JSON.</p>
        </aside>
        <main class="fabric-canvas-workspace"><div class="fabric-canvas-frame"><canvas id="${canvasId}" width="${width}" height="${height}"></canvas></div></main>
      </div>
    </section>`;
  }

  function openBookCardEditor(book, adapters = {}) {
    if (!book) return false;
    const template = adapters.template || {};
    const size = adapters.size || 'medium';
    const preset = adapters.cardSizes?.[size] || DEFAULT_SIZE;
    const width = number(template.canvas?.width, preset.width || DEFAULT_SIZE.width);
    const height = number(template.canvas?.height, preset.height || DEFAULT_SIZE.height);
    const title = `${book.title || 'Book'} Custom Card`;
    const canvasId = `fabric-card-${Date.now().toString(36)}`;
    if (adapters.modal?.(editorShell({ canvasId, title, width, height })) === false) return false;
    const host = document.getElementById('formModal');
    host?.classList.add('fabric-editor-backdrop');
    const editor = initCanvasEditor(canvasId, currentTheme(), { width, height, record: book });
    const scene = templateJson(template) || baseScene({ width, height, theme: currentTheme(), record: book });
    loadScene(editor.canvas, scene, book).catch(error => {
      console.error(error);
      loadScene(editor.canvas, baseScene({ width, height, theme: currentTheme(), record: book }), book);
    });
    document.querySelector('[data-fabric-add="shape"]')?.addEventListener('click', () => editor.addShapeBox());
    document.querySelector('[data-fabric-add="text"]')?.addEventListener('click', () => editor.addEditableTextBox());
    document.querySelectorAll('[data-fabric-field]').forEach(button => {
      button.addEventListener('click', () => editor.addBoundTextBox(button.dataset.fabricField, book, {
        width: Math.max(140, width * .4),
        fontSize: Math.max(18, width * .045),
        cardRole: ['rating', 'spice', 'impact'].includes(button.dataset.fabricField) ? 'rating' : 'metadata'
      }));
    });
    document.querySelector('[data-fabric-upload]')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) editor.addImageFromFile(file).catch(error => adapters.showToast?.(error.message || 'Image upload failed.'));
    });
    document.querySelector('[data-fabric-delete]')?.addEventListener('click', () => editor.deleteActiveElement());
    document.querySelector('[data-fabric-zoom]')?.addEventListener('input', event => {
      editor.canvas.setZoom(number(event.target.value, 100) / 100);
      editor.canvas.requestRenderAll();
    });
    document.querySelector('[data-fabric-fill]')?.addEventListener('input', event => {
      const active = editor.canvas.getActiveObject();
      if (active) active.set('fill', event.target.value);
      editor.canvas.requestRenderAll();
    });
    document.querySelector('[data-fabric-text]')?.addEventListener('input', event => {
      const active = editor.canvas.getActiveObject();
      if (active?.isType?.('textbox') || active?.type === 'textbox') active.set('fill', event.target.value);
      editor.canvas.requestRenderAll();
    });
    document.querySelector('[data-fabric-close]')?.addEventListener('click', () => adapters.closeModal?.());
    document.querySelector('[data-fabric-save]')?.addEventListener('click', () => {
      const saved = adapters.save?.(serializeCanvas(editor.canvas), { width, height, name: title, sourceTemplate: template });
      adapters.showToast?.(saved ? 'Canvas card saved.' : 'Canvas card could not be saved.');
      adapters.renderAll?.();
      adapters.closeModal?.();
    });
    return editor;
  }

  async function renderSavedCanvas(element, { record = null, json = null } = {}) {
    const fabric = requireFabric();
    const scene = json || JSON.parse(element.dataset.fabricCardJson || '{}');
    const width = number(element.dataset.designWidth || scene.width, element.width || DEFAULT_SIZE.width);
    const height = number(element.dataset.designHeight || scene.height, element.height || DEFAULT_SIZE.height);
    const canvas = new fabric.StaticCanvas(element, { width, height, backgroundColor: scene.background || currentTheme().surfaceSoft });
    canvas.__designWidth = width;
    canvas.__designHeight = height;
    await loadScene(canvas, scene, record);
    setUniformScale(canvas, element.clientWidth || width);
    element.dataset.fabricRendered = 'true';
    return canvas;
  }

  function renderSavedCanvases(root = document) {
    root.querySelectorAll('canvas[data-fabric-card-json]:not([data-fabric-rendered="true"])').forEach(element => {
      renderSavedCanvas(element).catch(error => console.error('Fabric card render failed:', error));
    });
  }

  globalThis.CanvasEditor = {
    FABRIC_VERSION,
    initCanvasEditor,
    openBookCardEditor,
    serializeCanvas,
    setUniformScale,
    addShapeBox,
    addEditableTextBox,
    addBoundTextBox,
    addImageFromFile,
    deleteActiveElement,
    baseScene,
    bindRecord,
    validScene,
    renderSavedCanvas,
    renderSavedCanvases
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => renderSavedCanvases());
  }
})();
