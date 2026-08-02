(() => {
  'use strict';

  const FABRIC_VERSION = '6';
  const DEFAULT_SIZE = { width: 420, height: 380 };
  const SERIALIZE_PROPS = ['id', 'name', 'dataBinding', 'cardRole', 'appearancePreset', 'sliderConfig', 'selectable', 'evented'];
  const TYPE_ALIASES = { rect: 'Rect', textbox: 'Textbox', image: 'Image', circle: 'Circle', path: 'Path', group: 'Group', text: 'Text', 'i-text': 'IText' };
  const FIELD_META = {
    title: { label: 'Title', role: 'title' },
    author: { label: 'Author', role: 'metadata' },
    series: { label: 'Series', role: 'metadata' },
    status: { label: 'Status', role: 'metadata' },
    progress: { label: 'Progress', role: 'progress' },
    rating: { label: 'Overall', role: 'rating' },
    spice: { label: 'Spice', role: 'rating' },
    impact: { label: 'Impact', role: 'rating' }
  };
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

  function normalizeObjectTypes(object) {
    if (!object || typeof object !== 'object') return object;
    if (typeof object.type === 'string') object.type = TYPE_ALIASES[object.type] || object.type;
    if (Array.isArray(object.objects)) object.objects.forEach(normalizeObjectTypes);
    return object;
  }

  function normalizeScene(scene) {
    const source = validScene(scene);
    if (!source) return null;
    const clone = JSON.parse(JSON.stringify(source));
    clone.objects.forEach(normalizeObjectTypes);
    return clone;
  }

  function templateJson(template = {}) {
    return validScene(template.fabricCanvasJson)
      || validScene(template.canvasJson)
      || validScene(template.fabricJson)
      || validScene(template.canvas?.fabricJson);
  }

  function pathValue(source = {}, path = '') {
    return String(path).split('.').reduce((current, key) => current?.[key], source);
  }

  function recordValue(record = {}, path = '') {
    const direct = pathValue(record, path);
    if (direct !== undefined && direct !== null && direct !== '') return direct;
    if (path === 'rating') return record.ratings?.overall ?? record.ratings?.rating ?? 0;
    if (path === 'spice') return record.ratings?.spice ?? 0;
    if (path === 'impact') return record.ratings?.impact ?? 0;
    if (path === 'reaction') return record.ratings?.reaction ?? record.reaction ?? '';
    if (path === 'progress') return record.progress ?? record.readingProgress ?? record.percentComplete ?? 0;
    return direct;
  }

  function displayNumber(value, fallback = 0) {
    const resolved = number(value, fallback);
    return Number.isInteger(resolved) ? String(resolved) : resolved.toFixed(1).replace(/\.0$/, '');
  }

  function ratingDisplay(path, value, max = 5) {
    const rating = clamp(value ?? 0, 0, max);
    const filled = clamp(Math.round(rating), 0, max);
    const emptyCount = Math.max(0, max - filled);
    if (path === 'spice') return `${'🔥'.repeat(filled)}${'·'.repeat(emptyCount)}\n${displayNumber(rating)} of ${max}`;
    if (path === 'impact') return `${'♥'.repeat(filled)}${'♡'.repeat(emptyCount)}\n${displayNumber(rating)} of ${max}`;
    return `${'★'.repeat(filled)}${'☆'.repeat(emptyCount)}\n${displayNumber(rating)} of ${max}`;
  }

  function baseScene({ width = DEFAULT_SIZE.width, height = DEFAULT_SIZE.height, theme = currentTheme(), record = {} } = {}) {
    return {
      version: FABRIC_VERSION,
      objects: [
        { type: 'Rect', id: 'card-bg', name: 'Card background', cardRole: 'background', left: 0, top: 0, width, height, fill: theme.surface, stroke: theme.border, strokeWidth: 2, rx: 22, ry: 22, selectable: false, evented: false },
        { type: 'Rect', id: 'cover-panel', name: 'Cover panel', cardRole: 'decor', left: width * .06, top: height * .12, width: width * .25, height: height * .38, fill: theme.surfaceSoft, stroke: theme.border, strokeWidth: 1, rx: 14, ry: 14, opacity: .72 },
        { type: 'Textbox', id: 'cover-title', name: 'Cover title', cardRole: 'decor', dataBinding: { path: 'title' }, left: width * .085, top: height * .26, width: width * .20, fontSize: Math.max(14, width * .036), fontFamily: 'Libre Baskerville', fontWeight: '700', textAlign: 'center', fill: theme.accent, text: record.title || 'Book Title' },
        { type: 'Textbox', id: 'title', name: 'Title', cardRole: 'title', dataBinding: { path: 'title' }, left: width * .34, top: height * .07, width: width * .58, fontSize: Math.max(24, width * .075), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.title || 'Book Title' },
        { type: 'Textbox', id: 'author', name: 'Author', cardRole: 'metadata', dataBinding: { path: 'author' }, left: width * .34, top: height * .25, width: width * .28, fontSize: Math.max(14, width * .036), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.author || 'Author' },
        { type: 'Textbox', id: 'series', name: 'Series', cardRole: 'metadata', dataBinding: { path: 'series' }, left: width * .64, top: height * .25, width: width * .28, fontSize: Math.max(14, width * .036), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.series || 'Series' },
        { type: 'Textbox', id: 'status', name: 'Status', cardRole: 'metadata', dataBinding: { path: 'status' }, left: width * .06, top: height * .53, width: width * .25, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: record.status || 'status' },
        { type: 'Textbox', id: 'progress', name: 'Progress', cardRole: 'progress', dataBinding: { path: 'progress' }, left: width * .34, top: height * .53, width: width * .58, fontSize: Math.max(16, width * .042), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: `${displayNumber(recordValue(record, 'progress'))}%` },
        { type: 'Textbox', id: 'rating', name: 'Overall', cardRole: 'rating', dataBinding: { path: 'rating' }, left: width * .06, top: height * .72, width: width * .25, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.accent, text: ratingDisplay('rating', recordValue(record, 'rating')) },
        { type: 'Textbox', id: 'spice', name: 'Spice', cardRole: 'rating', dataBinding: { path: 'spice' }, left: width * .37, top: height * .72, width: width * .22, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: ratingDisplay('spice', recordValue(record, 'spice')) },
        { type: 'Textbox', id: 'impact', name: 'Impact', cardRole: 'rating', dataBinding: { path: 'impact' }, left: width * .67, top: height * .72, width: width * .24, fontSize: Math.max(15, width * .038), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.accent, text: ratingDisplay('impact', recordValue(record, 'impact')) }
      ],
      background: theme.surfaceSoft
    };
  }

  function bindRecord(scene, record = {}, options = {}) {
    const clone = normalizeScene(scene) || baseScene({ width: options.width, height: options.height, theme: options.theme || currentTheme(), record });
    (clone.objects || []).forEach(object => {
      const path = object.dataBinding?.path;
      if (!path) return;
      const value = recordValue(record, path);
      const type = String(object.type || '').toLowerCase();
      const textLike = ['textbox', 'text', 'i-text', 'itext'].includes(type);
      if (path === 'progress' && !textLike && object.sliderConfig?.trackWidth) {
        object.width = object.sliderConfig.trackWidth * clamp(value ?? 0, 0, 100) / 100;
        object.sliderConfig.value = clamp(value ?? 0, 0, 100);
      } else if (path === 'progress') object.text = `${displayNumber(clamp(value ?? 0, 0, 100))}%`;
      else if (['rating', 'spice', 'impact'].includes(path)) object.text = ratingDisplay(path, value);
      else object.text = String(value ?? object.text ?? '');
    });
    return clone;
  }

  async function loadScene(canvas, scene, record) {
    const json = bindRecord(scene, record, { width: canvas.__designWidth, height: canvas.__designHeight });
    await canvas.loadFromJSON(json);
    if (!canvas.getObjects().length) {
      await canvas.loadFromJSON(baseScene({ width: canvas.__designWidth, height: canvas.__designHeight, record }));
    }
    canvas.renderAll();
    return canvas;
  }

  function getActive(canvas) {
    return canvas.getActiveObject?.() || null;
  }

  function isTextObject(object) {
    return Boolean(object && (object.type === 'Textbox' || object.type === 'textbox' || object.type === 'Text' || object.type === 'IText' || object.isType?.('textbox') || object.isType?.('text')));
  }

  function updateActiveObject(canvas, changes = {}) {
    const active = getActive(canvas);
    if (!active) return false;
    Object.entries(changes).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') active.set(key, value);
    });
    active.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function applyAppearancePreset(canvas, preset = 'plain') {
    const active = getActive(canvas);
    if (!active) return false;
    const theme = currentTheme();
    const presets = {
      plain: { fill: 'transparent', stroke: 'transparent', strokeWidth: 0, shadow: null, rx: 0, ry: 0 },
      pill: { fill: theme.surfaceSoft, stroke: theme.border, strokeWidth: 1.5, rx: 999, ry: 999, shadow: '0 10px 22px rgba(0,0,0,.22)' },
      badge: { fill: theme.surface, stroke: theme.accent, strokeWidth: 2, rx: 14, ry: 14, shadow: '0 16px 34px rgba(0,0,0,.34)' },
      raised: { fill: theme.surface, stroke: theme.border, strokeWidth: 1, rx: 18, ry: 18, shadow: '0 18px 40px rgba(0,0,0,.42)' },
      glass: { fill: 'rgba(255,255,255,.08)', stroke: 'rgba(255,255,255,.26)', strokeWidth: 1, rx: 20, ry: 20, shadow: '0 18px 44px rgba(0,0,0,.32)' },
      accent: { fill: theme.accent, stroke: theme.accent, strokeWidth: 1, rx: 18, ry: 18, shadow: '0 16px 34px rgba(0,0,0,.36)' },
      outline: { fill: 'transparent', stroke: theme.accent, strokeWidth: 2, rx: 18, ry: 18, shadow: null }
    };
    active.appearancePreset = preset;
    active.set(presets[preset] || presets.plain);
    if (isTextObject(active) && preset === 'accent') active.set('fill', theme.surfaceSoft);
    active.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function applyCardPreset(canvas, preset = 'classic', record = {}) {
    const theme = currentTheme(), width = canvas.__designWidth || DEFAULT_SIZE.width, height = canvas.__designHeight || DEFAULT_SIZE.height;
    const scenes = {
      classic: baseScene({ width, height, theme, record }),
      poster: {
        ...baseScene({ width, height, theme, record }),
        objects: [
          { type: 'Rect', id: 'card-bg', name: 'Card background', cardRole: 'background', left: 0, top: 0, width, height, fill: theme.surface, stroke: theme.border, strokeWidth: 2, rx: 26, ry: 26, selectable: false, evented: false },
          { type: 'Textbox', id: 'title', name: 'Title', cardRole: 'title', dataBinding: { path: 'title' }, left: width * .08, top: height * .10, width: width * .84, fontSize: Math.max(34, width * .095), fontFamily: 'Libre Baskerville', fontWeight: '700', textAlign: 'center', fill: theme.text, text: record.title || 'Book Title' },
          { type: 'Textbox', id: 'author', name: 'Author', cardRole: 'metadata', dataBinding: { path: 'author' }, left: width * .12, top: height * .32, width: width * .76, fontSize: Math.max(17, width * .045), fontFamily: 'Libre Baskerville', fontWeight: '700', textAlign: 'center', fill: theme.muted, text: record.author || 'Author' },
          { type: 'Textbox', id: 'rating', name: 'Overall', cardRole: 'rating', dataBinding: { path: 'rating' }, left: width * .16, top: height * .60, width: width * .30, fontSize: Math.max(18, width * .046), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.accent, text: ratingDisplay('rating', recordValue(record, 'rating')) },
          { type: 'Textbox', id: 'spice', name: 'Spice', cardRole: 'rating', dataBinding: { path: 'spice' }, left: width * .55, top: height * .60, width: width * .28, fontSize: Math.max(18, width * .046), fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, text: ratingDisplay('spice', recordValue(record, 'spice')) },
          { type: 'Textbox', id: 'progress', name: 'Progress', cardRole: 'progress', dataBinding: { path: 'progress' }, left: width * .20, top: height * .80, width: width * .60, fontSize: Math.max(16, width * .04), fontFamily: 'Libre Baskerville', fontWeight: '700', textAlign: 'center', fill: theme.text, text: `${displayNumber(recordValue(record, 'progress'))}%` }
        ]
      },
      dashboard: {
        ...baseScene({ width, height, theme, record }),
        objects: baseScene({ width, height, theme, record }).objects.map(object => object.id === 'card-bg' ? { ...object, rx: 14, ry: 14 } : object)
      }
    };
    return loadScene(canvas, scenes[preset] || scenes.classic, record);
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

  function addProgressSlider(canvas, record = {}, options = {}) {
    const fabric = requireFabric(), theme = currentTheme(), width = canvas.__designWidth || DEFAULT_SIZE.width;
    const left = options.left || 64, top = options.top || 120, trackWidth = options.width || Math.min(260, width * .62);
    const track = new fabric.Rect({ left, top, width: trackWidth, height: 8, rx: 8, ry: 8, fill: options.fill || theme.border, opacity: .8, id: makeObjectId('progress-track'), name: 'Progress track', cardRole: 'progress' });
    const progress = clamp(recordValue(record, 'progress') ?? 0, 0, 100);
    const fill = new fabric.Rect({ left, top, width: trackWidth * progress / 100, height: 8, rx: 8, ry: 8, fill: options.accent || theme.accent, id: makeObjectId('progress-fill'), name: 'Progress fill', cardRole: 'progress', dataBinding: { path: 'progress' }, sliderConfig: { style: 'bar', value: progress, max: 100, trackWidth } });
    const label = new fabric.Textbox(`${displayNumber(progress)}%`, { left, top: top + 14, width: trackWidth, fontSize: 18, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, id: makeObjectId('progress-label'), name: 'Progress label', cardRole: 'progress', dataBinding: { path: 'progress' } });
    canvas.add(track, fill, label);
    canvas.setActiveObject(label);
    canvas.requestRenderAll();
    return label;
  }

  function sliderGlyphs(style, value, max) {
    const glyph = { stars: '★', hearts: '♥', fire: '🔥', dots: '●' }[style] || '★';
    const empty = { stars: '☆', hearts: '♡', fire: '·', dots: '○' }[style] || '☆';
    const filled = clamp(Math.round(value), 0, max);
    return `${glyph.repeat(filled)}${empty.repeat(Math.max(0, max - filled))}`;
  }

  function addCustomSlider(canvas, options = {}) {
    const fabric = requireFabric(), theme = currentTheme(), width = canvas.__designWidth || DEFAULT_SIZE.width;
    const name = String(options.name || 'Custom Tracker').trim() || 'Custom Tracker';
    const style = ['bar', 'stars', 'hearts', 'fire', 'dots'].includes(options.style) ? options.style : 'bar';
    const max = clamp(options.max ?? 5, 1, 100), value = clamp(options.value ?? 0, 0, max);
    const left = options.left || 64, top = options.top || 150, trackWidth = options.width || Math.min(280, width * .66);
    if (style === 'bar') {
      const label = new fabric.Textbox(name, { left, top, width: trackWidth, fontSize: 13, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.muted, name: `${name} label`, cardRole: 'custom-slider', sliderConfig: { name, style, value, max } });
      const track = new fabric.Rect({ left, top: top + 22, width: trackWidth, height: 10, rx: 999, ry: 999, fill: theme.border, opacity: .75, name: `${name} track`, cardRole: 'custom-slider', sliderConfig: { name, style, value, max } });
      const fill = new fabric.Rect({ left, top: top + 22, width: trackWidth * value / max, height: 10, rx: 999, ry: 999, fill: options.accent || theme.accent, name: `${name} fill`, cardRole: 'custom-slider', sliderConfig: { name, style, value, max } });
      const valueText = new fabric.Textbox(`${value} of ${max}`, { left, top: top + 38, width: trackWidth, fontSize: 18, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, name: `${name} value`, cardRole: 'custom-slider', sliderConfig: { name, style, value, max } });
      canvas.add(label, track, fill, valueText);
      canvas.setActiveObject(valueText);
      canvas.requestRenderAll();
      return valueText;
    }
    const tracker = new fabric.Textbox(`${name}\n${sliderGlyphs(style, value, max)}\n${value} of ${max}`, {
      left,
      top,
      width: trackWidth,
      fontSize: options.fontSize || 22,
      fontFamily: 'Libre Baskerville',
      fontWeight: '700',
      fill: options.fill || theme.accent,
      name,
      cardRole: 'custom-slider',
      sliderConfig: { name, style, value, max }
    });
    canvas.add(tracker);
    canvas.setActiveObject(tracker);
    canvas.requestRenderAll();
    return tracker;
  }

  function makeObjectId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
    const value = recordValue(record, path);
    if (path === 'progress') return `${displayNumber(clamp(value ?? 0, 0, 100))}%`;
    if (['rating', 'spice', 'impact'].includes(path)) return ratingDisplay(path, value);
    return String(value ?? path);
  }

  function addBoundTextBox(canvas, path, record = {}, options = {}) {
    const meta = FIELD_META[path] || { label: path, role: 'metadata' };
    const object = addEditableTextBox(canvas, fieldText(path, record), options);
    object.set({
      id: options.id || path,
      name: options.name || meta.label,
      dataBinding: { path },
      cardRole: options.cardRole || meta.role
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

  function selectedObjects(canvas) {
    const active = getActive(canvas);
    if (!active) return [];
    return active.type === 'activeSelection' && typeof active.getObjects === 'function' ? active.getObjects() : [active];
  }

  function alignActiveObjects(canvas, alignment) {
    const objects = selectedObjects(canvas).filter(object => object.selectable !== false);
    if (!objects.length) return false;
    const width = canvas.__designWidth || canvas.getWidth(), height = canvas.__designHeight || canvas.getHeight();
    objects.forEach(object => {
      const scaledWidth = object.getScaledWidth?.() || object.width || 0, scaledHeight = object.getScaledHeight?.() || object.height || 0;
      if (alignment === 'left') object.set('left', 0);
      if (alignment === 'center') object.set('left', (width - scaledWidth) / 2);
      if (alignment === 'right') object.set('left', width - scaledWidth);
      if (alignment === 'top') object.set('top', 0);
      if (alignment === 'middle') object.set('top', (height - scaledHeight) / 2);
      if (alignment === 'bottom') object.set('top', height - scaledHeight);
      object.setCoords?.();
    });
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
      addProgressSlider: (record, extra) => addProgressSlider(canvas, record, extra),
      addCustomSlider: extra => addCustomSlider(canvas, extra),
      alignActiveObjects: alignment => alignActiveObjects(canvas, alignment),
      applyAppearancePreset: preset => applyAppearancePreset(canvas, preset),
      applyCardPreset: (preset, record) => applyCardPreset(canvas, preset, record),
      updateActiveObject: changes => updateActiveObject(canvas, changes),
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
          <div class="fabric-tool-section">
            <p>Starter looks</p>
            <button type="button" data-fabric-card-preset="classic">Classic card</button>
            <button type="button" data-fabric-card-preset="poster">Poster card</button>
            <button type="button" data-fabric-card-preset="dashboard">Dashboard card</button>
          </div>
          <button type="button" data-fabric-add="shape">Shape box</button>
          <button type="button" data-fabric-add="text">Text box</button>
          <button type="button" data-fabric-add="progress-slider">Progress slider</button>
          <button type="button" data-fabric-add="custom-slider">Custom slider</button>
          <div class="fabric-field-palette" aria-label="Book fields">
            <p>Book fields</p>
            ${Object.entries(FIELD_META).map(([path, meta]) => `<button type="button" data-fabric-field="${path}">${escapeHtml(meta.label)}</button>`).join('')}
          </div>
          <label class="fabric-upload-control">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" data-fabric-upload></label>
          <button type="button" data-fabric-delete>Delete selected</button>
          <label>Zoom <input type="range" min="40" max="180" value="100" data-fabric-zoom></label>
          <div class="fabric-color-row"><label>Fill <input type="color" value="#bd662f" data-fabric-fill></label><label>Text <input type="color" value="#f7ead2" data-fabric-text></label></div>
          <p class="fabric-editor-hint">Drag, resize, rotate, edit text inline, or upload art. Everything saves as Fabric JSON.</p>
        </aside>
        <main class="fabric-canvas-workspace"><div class="fabric-canvas-frame"><canvas id="${canvasId}" width="${width}" height="${height}"></canvas></div></main>
        <aside class="fabric-editor-inspector" aria-label="Selected object controls">
          <div class="fabric-tool-section">
            <p>Selected piece</p>
            <output data-fabric-selected-name>Nothing selected</output>
          </div>
          <div class="fabric-preset-grid" aria-label="Appearance presets">
            ${['plain', 'pill', 'badge', 'raised', 'glass', 'accent', 'outline'].map(preset => `<button type="button" data-fabric-appearance="${preset}">${preset}</button>`).join('')}
          </div>
          <div class="fabric-align-grid" aria-label="Alignment controls">
            ${['left', 'center', 'right', 'top', 'middle', 'bottom'].map(action => `<button type="button" data-fabric-align="${action}">${action}</button>`).join('')}
          </div>
          <label>Font size <input type="range" min="8" max="72" value="24" data-fabric-prop="fontSize"></label>
          <label>Object width <input type="range" min="20" max="${Math.max(240, width)}" value="180" data-fabric-prop="width"></label>
          <label>Object height <input type="range" min="8" max="${Math.max(240, height)}" value="80" data-fabric-prop="height"></label>
          <label>Rotation <input type="range" min="-180" max="180" value="0" data-fabric-prop="angle"></label>
          <label>Opacity <input type="range" min="0" max="100" value="100" data-fabric-prop="opacity"></label>
          <label>Corner radius <input type="range" min="0" max="80" value="16" data-fabric-prop="cornerRadius"></label>
          <label>Border <input type="range" min="0" max="12" value="1" data-fabric-prop="strokeWidth"></label>
          <div class="fabric-color-row"><label>Border <input type="color" value="#75451f" data-fabric-stroke></label><label>Shadow <input type="checkbox" data-fabric-shadow></label></div>
          <p class="fabric-editor-hint">Select a title, rating, pill, shape, or uploaded image, then use these controls to style it.</p>
        </aside>
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
    const syncInspector = () => {
      const active = getActive(editor.canvas);
      const selectedName = document.querySelector('[data-fabric-selected-name]');
      if (selectedName) selectedName.textContent = active ? (active.name || active.id || active.type || 'Selected piece') : 'Nothing selected';
      document.querySelectorAll('[data-fabric-prop]').forEach(input => {
        if (!active) return;
        const prop = input.dataset.fabricProp;
        if (prop === 'opacity') input.value = Math.round(number(active.opacity, 1) * 100);
        else if (prop === 'cornerRadius') input.value = number(active.rx ?? active.ry, 0);
        else input.value = number(active[prop], number(input.value, 0));
      });
    };
    editor.canvas.on('selection:created', syncInspector);
    editor.canvas.on('selection:updated', syncInspector);
    editor.canvas.on('selection:cleared', syncInspector);
    editor.canvas.on('object:modified', syncInspector);
    document.querySelectorAll('[data-fabric-card-preset]').forEach(button => {
      button.addEventListener('click', () => {
        if (!confirm('Replace this card layout with this starter look? Book details stay safe.')) return;
        editor.applyCardPreset(button.dataset.fabricCardPreset, book);
      });
    });
    document.querySelector('[data-fabric-add="shape"]')?.addEventListener('click', () => editor.addShapeBox());
    document.querySelector('[data-fabric-add="text"]')?.addEventListener('click', () => editor.addEditableTextBox());
    document.querySelector('[data-fabric-add="progress-slider"]')?.addEventListener('click', () => editor.addProgressSlider(book));
    document.querySelector('[data-fabric-add="custom-slider"]')?.addEventListener('click', () => {
      const name = prompt('What should this slider track?', 'Scare level');
      if (!name) return;
      const style = prompt('Slider style: bar, stars, hearts, fire, or dots', 'stars') || 'stars';
      const max = clamp(prompt('Maximum value?', '5'), 1, 100);
      const value = clamp(prompt('Current value?', '0'), 0, max);
      editor.addCustomSlider({ name, style: style.toLowerCase(), max, value });
    });
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
      if (isTextObject(active)) active.set('fill', event.target.value);
      editor.canvas.requestRenderAll();
    });
    document.querySelector('[data-fabric-stroke]')?.addEventListener('input', event => editor.updateActiveObject({ stroke: event.target.value }));
    document.querySelector('[data-fabric-shadow]')?.addEventListener('change', event => editor.updateActiveObject({ shadow: event.target.checked ? '0 18px 42px rgba(0,0,0,.38)' : null }));
    document.querySelectorAll('[data-fabric-appearance]').forEach(button => button.addEventListener('click', () => editor.applyAppearancePreset(button.dataset.fabricAppearance)));
    document.querySelectorAll('[data-fabric-align]').forEach(button => button.addEventListener('click', () => editor.alignActiveObjects(button.dataset.fabricAlign)));
    document.querySelectorAll('[data-fabric-prop]').forEach(input => {
      input.addEventListener('input', event => {
        const prop = event.target.dataset.fabricProp;
        const raw = number(event.target.value, 0);
        if (prop === 'opacity') editor.updateActiveObject({ opacity: raw / 100 });
        else if (prop === 'cornerRadius') editor.updateActiveObject({ rx: raw, ry: raw });
        else editor.updateActiveObject({ [prop]: raw });
      });
    });
    const closeEditor = () => {
      document.removeEventListener('keydown', keyHandler, true);
      adapters.closeModal?.();
    };
    const keyHandler = event => {
      const active = getActive(editor.canvas);
      if (!active || active.isEditing || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        editor.deleteActiveElement();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const objects = editor.canvas.getObjects().filter(object => object.selectable !== false);
        if (objects.length) {
          const fabric = requireFabric();
          const selection = new fabric.ActiveSelection(objects, { canvas: editor.canvas });
          editor.canvas.setActiveObject(selection);
          editor.canvas.requestRenderAll();
        }
      }
    };
    document.addEventListener('keydown', keyHandler, true);
    document.querySelector('[data-fabric-close]')?.addEventListener('click', closeEditor);
    document.querySelector('[data-fabric-save]')?.addEventListener('click', () => {
      const saved = adapters.save?.(serializeCanvas(editor.canvas), { width, height, name: title, sourceTemplate: template });
      adapters.showToast?.(saved ? 'Canvas card saved.' : 'Canvas card could not be saved.');
      adapters.renderAll?.();
      closeEditor();
    });
    setTimeout(syncInspector, 0);
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
    addProgressSlider,
    addCustomSlider,
    alignActiveObjects,
    applyAppearancePreset,
    applyCardPreset,
    updateActiveObject,
    addImageFromFile,
    deleteActiveElement,
    baseScene,
    bindRecord,
    validScene,
    normalizeScene,
    renderSavedCanvas,
    renderSavedCanvases
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => renderSavedCanvases());
  }
})();
