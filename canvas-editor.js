(() => {
  'use strict';

  const FABRIC_VERSION = '6';
  const DEFAULT_SIZE = { width: 420, height: 380 };
  const SERIALIZE_PROPS = ['id', 'name', 'dataBinding', 'cardRole', 'appearancePreset', 'sliderConfig', 'selectable', 'evented', 'locked', 'originX', 'originY', 'cropX', 'cropY', 'cropMode', 'backgroundImageSrc', 'assetId', 'assetStoragePath', 'fontId', 'fontFamilyKey', 'fontStoragePath'];
  let userAssets = [], userFonts = [];
  const TYPE_ALIASES = { rect: 'Rect', textbox: 'Textbox', image: 'Image', circle: 'Circle', path: 'Path', group: 'Group', text: 'Text', 'i-text': 'IText' };
  const FALLBACK_FIELD_META = {
    title: { label: 'Title', role: 'title' },
    author: { label: 'Author', role: 'metadata' },
    series: { label: 'Series', role: 'metadata' },
    status: { label: 'Status', role: 'metadata' },
    progress: { label: 'Progress', role: 'progress' },
    rating: { label: 'Overall', role: 'rating' },
    spice: { label: 'Spice', role: 'rating' },
    impact: { label: 'Impact', role: 'rating' }
  };
  const registryFields = () => {
    try { return globalThis.VisualFields?.fields?.() || []; }
    catch { return []; }
  };
  const FIELD_META = {
    ...FALLBACK_FIELD_META,
    ...Object.fromEntries(registryFields().map(field => [field.id, {
      label: field.label || field.id,
      role: field.role || field.type || 'metadata',
      path: field.path || field.id,
      category: field.category || 'Book fields',
      moduleType: field.moduleType || field.type || 'text',
      defaultWidth: field.defaultWidth,
      defaultHeight: field.defaultHeight,
      max: field.max,
      display: field.display
    }]))
  };
  const TEXT_STYLE_PRESETS = {
    romantasy: { label: 'Romantasy title', text: 'Moonlit Archive', fontFamily: 'Libre Baskerville', fontSize: 34, fontWeight: '700', fill: 'theme:text', shadow: '0 10px 24px rgba(0,0,0,.48)' },
    neon: { label: 'Neon script', text: 'Glowing Fate', fontFamily: 'Brush Script MT', fontSize: 42, fontWeight: '700', fill: '#ff82d8', shadow: '0 0 8px #ff82d8, 0 0 22px #a855f7' },
    tattoo: { label: 'Tattoo serif', text: 'Marked', fontFamily: 'Georgia', fontSize: 36, fontWeight: '700', fill: 'theme:text', stroke: 'theme:accent', strokeWidth: .8 },
    metallic: { label: 'Metallic emboss', text: 'Gilded', fontFamily: 'Impact', fontSize: 38, fontWeight: '700', fill: '#f3d28b', stroke: '#6b421f', strokeWidth: 1.2, shadow: '3px 4px 0 rgba(0,0,0,.34)' },
    softScript: { label: 'Soft script', text: 'Secret Chapter', fontFamily: 'Brush Script MT', fontSize: 40, fontWeight: '400', fill: 'theme:muted', shadow: '0 6px 18px rgba(0,0,0,.25)' },
    archive: { label: 'Archive label', text: 'BOOK ARCHIVE', fontFamily: 'Inter', fontSize: 16, fontWeight: '900', fill: 'theme:muted', charSpacing: 180, textAlign: 'center' },
    sticker: { label: 'Sticker pop', text: 'Obsessed', fontFamily: 'Trebuchet MS', fontSize: 34, fontWeight: '900', fill: 'theme:text', stroke: 'theme:accent', strokeWidth: 2.5, shadow: '0 8px 0 rgba(0,0,0,.28)' },
    gothic: { label: 'Gothic drama', text: 'Dark Bloom', fontFamily: 'Copperplate', fontSize: 36, fontWeight: '900', fill: 'theme:accent', stroke: 'theme:text', strokeWidth: .7, shadow: '0 14px 28px rgba(0,0,0,.45)' },
    typecraft: { label: 'Chunky pop', text: 'NEW DROP', fontFamily: 'Impact', fontSize: 40, fontWeight: '900', fill: 'theme:accent', stroke: 'theme:text', strokeWidth: 2.2, shadow: '5px 5px 0 rgba(0,0,0,.35)' },
    whisper: { label: 'Whisper serif', text: 'haunted pages', fontFamily: 'Didot', fontSize: 30, fontWeight: '400', fill: 'theme:text', charSpacing: 80, shadow: '0 0 18px rgba(255,255,255,.16)' },
    courierStamp: { label: 'Courier stamp', text: 'CLASSIFIED', fontFamily: 'Courier New', fontSize: 24, fontWeight: '900', fill: 'theme:accent', stroke: 'theme:accent', strokeWidth: .5, charSpacing: 120 }
  };
  const ELEMENT_PRESETS = {
    divider: { label: 'Divider', kind: 'divider' },
    thinRule: { label: 'Thin rule', kind: 'thinRule' },
    doubleRule: { label: 'Double rule', kind: 'doubleRule' },
    banner: { label: 'Banner', kind: 'banner' },
    badge: { label: 'Badge', kind: 'badge' },
    panel: { label: 'Panel', kind: 'panel' },
    glassPanel: { label: 'Glass panel', kind: 'glassPanel' },
    tornLabel: { label: 'Torn label', kind: 'tornLabel' },
    circle: { label: 'Circle', kind: 'circle' },
    oval: { label: 'Oval', kind: 'oval' },
    diamond: { label: 'Diamond', kind: 'diamond' },
    frame: { label: 'Frame', kind: 'frame' },
    ornateFrame: { label: 'Ornate frame', kind: 'ornateFrame' },
    sparkle: { label: 'Sparkles', kind: 'glyph', glyph: '✦ ✧ ✦' },
    moon: { label: 'Moon', kind: 'glyph', glyph: '☾' },
    stars: { label: 'Stars', kind: 'glyph', glyph: '★ ✦ ★' },
    hearts: { label: 'Hearts', kind: 'glyph', glyph: '♥ ♥ ♥' },
    flames: { label: 'Flames', kind: 'glyph', glyph: '🔥 ✦ 🔥' },
    dagger: { label: 'Dagger', kind: 'glyph', glyph: '†' },
    vines: { label: 'Vines', kind: 'glyph', glyph: '❧ ❦ ❧' },
    corners: { label: 'Corners', kind: 'corners' },
    flourish: { label: 'Flourish', kind: 'glyph', glyph: '❦' }
  };
  const FONT_OPTIONS = ['Libre Baskerville', 'Inter', 'Georgia', 'Arial', 'Trebuchet MS', 'Impact', 'Brush Script MT', 'Courier New', 'Verdana', 'Times New Roman', 'Palatino', 'Didot', 'Copperplate', 'Marker Felt', 'Papyrus'];
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
  function themeToken(value, theme = currentTheme()) {
    if (value === 'theme:text') return theme.text;
    if (value === 'theme:muted') return theme.muted;
    if (value === 'theme:accent') return theme.accent;
    if (value === 'theme:border') return theme.border;
    if (value === 'theme:surface') return theme.surface;
    if (value === 'theme:surfaceSoft') return theme.surfaceSoft;
    return value;
  }

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
    if (globalThis.VisualFields?.resolve) {
      const field = globalThis.VisualFields.byId?.(path);
      const resolved = globalThis.VisualFields.resolve(record, field || path);
      if (resolved !== undefined && resolved !== null && resolved !== '') return resolved;
    }
    if (path === 'rating') return record.ratings?.overall ?? record.ratings?.rating ?? pathValue(record, path) ?? 0;
    if (path === 'spice') return record.ratings?.spice ?? pathValue(record, path) ?? 0;
    if (path === 'impact') return record.ratings?.impact ?? pathValue(record, path) ?? 0;
    if (path === 'reaction') return record.ratings?.reaction ?? record.reaction ?? '';
    if (path === 'progress') return pathValue(record, path) ?? record.readingProgress ?? record.percentComplete ?? 0;
    const direct = pathValue(record, path);
    if (direct !== undefined && direct !== null && direct !== '') return direct;
    return direct;
  }

  function displayNumber(value, fallback = 0) {
    const resolved = number(value, fallback);
    return Number.isInteger(resolved) ? String(resolved) : resolved.toFixed(1).replace(/\.0$/, '');
  }

  function ratingDisplay(path, value, max = 5) {
    const rating = clamp(value ?? 0, 0, max);
    const full = Math.floor(rating);
    const hasHalf = rating - full >= .5 && full < max;
    const emptyCount = Math.max(0, max - full - (hasHalf ? 1 : 0));
    if (path === 'spice') return `${'🔥'.repeat(full)}${hasHalf ? '½' : ''}${'·'.repeat(emptyCount)}\n${displayNumber(rating)} of ${max}`;
    if (path === 'impact') return `${'♥'.repeat(full)}${hasHalf ? '◐' : ''}${'♡'.repeat(emptyCount)}\n${displayNumber(rating)} of ${max}`;
    return `${'★'.repeat(full)}${hasHalf ? '⯨' : ''}${'☆'.repeat(emptyCount)}\n${displayNumber(rating)} of ${max}`;
  }

  function sliderDisplay(config = {}, path = '') {
    const style = config.style || sliderStyleForPath(path);
    const max = sliderMaxForPath(path, number(config.max, path === 'progress' ? 100 : 5));
    const value = clamp(config.value ?? 0, 0, max);
    const name = config.name || FIELD_META[path]?.label || 'Custom Tracker';
    if (path === 'progress') return `${displayNumber(value)}%`;
    if (['rating', 'spice', 'impact'].includes(path)) return ratingDisplay(path, value, max);
    const iconNote = style === 'custom-icon' && config.iconName ? ` (${config.iconName})` : '';
    return `${name}${iconNote}\n${sliderGlyphs(style, value, max)}\n${displayNumber(value)} of ${max}`;
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
      const meta = FIELD_META[path] || globalThis.VisualFields?.byId?.(path) || {};
      if (path === '$actions' || object.cardRole === 'actions') return;
      if (path === 'trackerValues' || path === 'customTracker') {
        if (object.sliderConfig) {
          const tracker = recordValue(record, 'customTracker');
          const next = typeof tracker === 'object' ? tracker : {};
          object.sliderConfig = { ...(object.sliderConfig || {}), name: next.name || object.sliderConfig.name || 'Custom tracker', value: clamp(next.value ?? object.sliderConfig.value ?? 0, 0, next.max || object.sliderConfig.max || 5), max: next.max || object.sliderConfig.max || 5, style: next.style || object.sliderConfig.style || 'stars' };
          if (textLike) object.text = sliderDisplay(object.sliderConfig, '');
        }
        return;
      }
      if (type === 'image' || object.cardRole === 'image' || meta.moduleType === 'image') {
        if (value) object.set ? object.set({ src: value, crossOrigin: 'anonymous' }) : Object.assign(object, { src: value, crossOrigin: 'anonymous' });
        return;
      }
      if (!textLike && !object.sliderConfig) return;
      if (path === 'progress' && !textLike && object.sliderConfig?.trackWidth) {
        object.width = object.sliderConfig.trackWidth * clamp(value ?? 0, 0, 100) / 100;
        object.sliderConfig = { ...(object.sliderConfig || {}), path, value: clamp(value ?? 0, 0, 100), max: 100, style: 'bar' };
      } else if (path === 'progress') {
        const progressValue = clamp(value ?? 0, 0, 100);
        object.sliderConfig = { ...(object.sliderConfig || {}), path, name: 'Progress', style: 'bar', value: progressValue, max: 100 };
        object.text = sliderDisplay(object.sliderConfig, path);
      }
      else if (['rating', 'spice', 'impact'].includes(path)) {
        object.sliderConfig = { ...(object.sliderConfig || {}), path, name: FIELD_META[path]?.label || path, style: sliderStyleForPath(path), value: clamp(value ?? 0, 0, 5), max: 5 };
        object.text = sliderDisplay(object.sliderConfig, path);
      }
      else object.text = String(value ?? object.text ?? '');
    });
    return clone;
  }

  async function resolveLibraryReferences(scene) {
    const json = JSON.parse(JSON.stringify(scene || {}));
    const visit = async object => {
      if (object?.assetStoragePath && globalThis.VisualAssets) {
        try { object.src = await globalThis.VisualAssets.getAssetUrl({ id: object.assetId || object.assetStoragePath, storage_path: object.assetStoragePath }); } catch { object.visible = false; }
      }
      if (object?.fontId && globalThis.VisualFonts) {
        try {
          await globalThis.VisualFonts.loadFont({ id: object.fontId, family_name: object.fontFamilyKey || object.fontFamily, storage_path: object.fontStoragePath, font_weight: object.fontWeight, font_style: object.fontStyle });
        } catch { /* Preserve the stable reference and allow browser fallback. */ }
      }
      await Promise.all((object?.objects || []).map(visit));
    };
    await Promise.all((json.objects || []).map(visit));
    return json;
  }

  async function loadScene(canvas, scene, record) {
    const resolved = await resolveLibraryReferences(scene);
    const json = bindRecord(resolved, record, { width: canvas.__designWidth, height: canvas.__designHeight });
    await canvas.loadFromJSON(json);
    if (!canvas.getObjects().length) {
      await canvas.loadFromJSON(baseScene({ width: canvas.__designWidth, height: canvas.__designHeight, record }));
    }
    applyCenterOrigins(canvas);
    canvas.renderAll();
    return canvas;
  }

  function getActive(canvas) {
    return canvas.getActiveObject?.() || null;
  }

  function isTextObject(object) {
    return Boolean(object && (object.type === 'Textbox' || object.type === 'textbox' || object.type === 'Text' || object.type === 'IText' || object.isType?.('textbox') || object.isType?.('text')));
  }

  function isImageObject(object) {
    return Boolean(object && (object.type === 'Image' || object.type === 'image' || object.isType?.('image')));
  }

  function childObjects(object) {
    if (!object) return [];
    if (typeof object.getObjects === 'function') return object.getObjects() || [];
    return object.objects || object._objects || [];
  }

  function textObjectsFromTarget(target) {
    const textObjects = [];
    const seen = new Set();
    const visit = object => {
      if (!object || seen.has(object)) return;
      seen.add(object);
      if (isTextObject(object)) textObjects.push(object);
      childObjects(object).forEach(visit);
    };
    visit(target);
    return textObjects;
  }

  function selectedTextObjects(canvas) {
    const active = getActive(canvas);
    return textObjectsFromTarget(active);
  }

  function applyToSelectedText(canvas, callback) {
    const active = getActive(canvas);
    const textObjects = textObjectsFromTarget(active);
    if (!textObjects.length) return false;
    textObjects.forEach(object => {
      callback(object);
      object.initDimensions?.();
      object.setCoords?.();
    });
    active?.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function applyImageTint(object, color) {
    if (!isImageObject(object) || !color) return false;
    const fabric = requireFabric();
    object.imageTint = color;
    object.set({ stroke: color, strokeWidth: Math.max(number(object.strokeWidth, 0), 1) });
    const existing = (object.filters || []).filter(filter => filter?.__visualTint !== true);
    const BlendColor = fabric.filters?.BlendColor;
    if (BlendColor) {
      const tint = new BlendColor({ color, mode: 'tint', alpha: 0.45 });
      tint.__visualTint = true;
      object.filters = [...existing, tint];
      object.applyFilters?.();
    } else {
      object.filters = existing;
    }
    object.setCoords?.();
    return true;
  }

  function isSliderObject(object) {
    const path = bindingPath(object);
    return Boolean(object?.sliderConfig || object?.cardRole === 'custom-slider' || object?.cardRole === 'rating' || object?.cardRole === 'progress' || ['progress', 'rating', 'spice', 'impact'].includes(path));
  }

  function centerOriginObject(object) {
    if (!object || object.selectable === false) return object;
    const center = object.getCenterPoint?.();
    object.set?.({ originX: 'center', originY: 'center', centeredRotation: true });
    if (center && object.setPositionByOrigin) object.setPositionByOrigin(center, 'center', 'center');
    object.setCoords?.();
    return object;
  }

  function applyCenterOrigins(canvas) {
    canvas.getObjects?.().forEach(centerOriginObject);
    canvas.requestRenderAll?.();
  }

  function updateActiveObject(canvas, changes = {}) {
    const active = getActive(canvas);
    if (!active) return false;
    const textOnlyKeys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'textAlign', 'charSpacing', 'lineHeight'];
    const keys = Object.keys(changes);
    if (keys.length && keys.every(key => textOnlyKeys.includes(key)) && textObjectsFromTarget(active).length) {
      return applyToSelectedText(canvas, object => {
        Object.entries(changes).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') object.set(key, value);
        });
      });
    }
    Object.entries(changes).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') active.set(key, value);
    });
    active.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function applySmartColor(canvas, color) {
    const active = getActive(canvas);
    if (!active || !color) return false;
    const objects = selectedObjects(canvas);
    const targets = objects.length ? objects : [active];
    targets.forEach(object => {
      if (isSliderObject(object)) {
        sliderObjects(canvas, object).forEach(item => {
          const role = item.sliderConfig?.role;
          if (role === 'fill' || role === 'value' || role === undefined) item.set?.('fill', color);
          if (role === 'track') item.set?.('stroke', color);
          if (isTextObject(item)) item.set?.('fill', color);
        });
        return;
      }
      const nestedText = textObjectsFromTarget(object);
      if (nestedText.length) nestedText.forEach(item => item.set('fill', color));
      else if (isImageObject(object)) applyImageTint(object, color);
      else object.set({ fill: color, stroke: object.stroke && object.stroke !== 'transparent' ? color : object.stroke });
      object.setCoords?.();
    });
    canvas.requestRenderAll();
    return true;
  }

  function setCardBackgroundColor(canvas, color) {
    const background = canvas.getObjects().find(object => object.id === 'card-bg' || object.cardRole === 'background');
    if (background) background.set({ fill: color });
    canvas.backgroundColor = color;
    canvas.requestRenderAll();
    return true;
  }

  function setImageCropMode(canvas, mode = 'cover') {
    const active = getActive(canvas);
    if (!active || !(active.type === 'Image' || active.type === 'image')) return false;
    active.cropMode = mode;
    if (mode === 'contain') active.set({ scaleX: Math.abs(active.scaleX || 1), scaleY: Math.abs(active.scaleY || 1), cropX: 0, cropY: 0 });
    if (mode === 'cover') active.set({ cropX: 0, cropY: 0 });
    active.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function cropActiveImage(canvas, changes = {}) {
    const active = getActive(canvas);
    if (!active || !(active.type === 'Image' || active.type === 'image')) return false;
    const scale = changes.zoom !== undefined ? clamp(changes.zoom, 10, 300) / 100 : Math.max(Math.abs(active.scaleX || 1), .01);
    active.set({
      scaleX: active.flipX ? -scale : scale,
      scaleY: active.flipY ? -scale : scale,
      cropX: clamp(changes.cropX ?? active.cropX ?? 0, 0, 10000),
      cropY: clamp(changes.cropY ?? active.cropY ?? 0, 0, 10000),
      cropMode: active.cropMode || 'cover'
    });
    active.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function setActiveImageAsBackground(canvas) {
    const active = getActive(canvas);
    if (!active || !(active.type === 'Image' || active.type === 'image')) return false;
    const width = canvas.__designWidth || canvas.getWidth(), height = canvas.__designHeight || canvas.getHeight();
    active.set({ left: width / 2, top: height / 2, originX: 'center', originY: 'center', selectable: false, evented: false, cardRole: 'background-image', name: 'Background image' });
    active.scaleToWidth(width);
    if (active.getScaledHeight?.() < height) active.scaleToHeight(height);
    canvas.sendObjectToBack?.(active) || canvas.sendToBack?.(active);
    const cardBg = canvas.getObjects().find(object => object.id === 'card-bg');
    if (cardBg) canvas.sendObjectToBack?.(cardBg) || canvas.sendToBack?.(cardBg);
    canvas.requestRenderAll();
    return true;
  }

  function applyTextEffect(canvas, effect = 'clear') {
    const theme = currentTheme();
    return applyToSelectedText(canvas, object => {
      if (effect === 'shadow') object.set({ shadow: '0 8px 16px rgba(0,0,0,.45)' });
      if (effect === 'glow') object.set({ shadow: `0 0 16px ${theme.accent}` });
      if (effect === 'outline') object.set({ stroke: theme.accent, strokeWidth: 1 });
      if (effect === 'hollow') object.set({ fill: 'transparent', stroke: theme.text, strokeWidth: 1.5, shadow: null });
      if (effect === 'lift') object.set({ shadow: `2px 3px 0 ${theme.accent}, 0 12px 26px rgba(0,0,0,.36)` });
      if (effect === 'clear') object.set({ shadow: null, stroke: null, strokeWidth: 0 });
    });
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
    const json = canvas.toJSON(SERIALIZE_PROPS);
    const stripTemporaryUrls = object => {
      if (object?.assetId || object?.assetStoragePath) delete object.src;
      (object?.objects || []).forEach(stripTemporaryUrls);
    };
    (json.objects || []).forEach(stripTemporaryUrls);
    return json;
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

  function addTextPreset(canvas, presetKey = 'romantasy') {
    const fabric = requireFabric(), theme = currentTheme();
    const preset = TEXT_STYLE_PRESETS[presetKey] || TEXT_STYLE_PRESETS.romantasy;
    const textbox = new fabric.Textbox(preset.text, {
      left: 72,
      top: 72,
      width: 260,
      fontSize: preset.fontSize || 28,
      fontFamily: preset.fontFamily || 'Libre Baskerville',
      fontWeight: preset.fontWeight || '700',
      fill: themeToken(preset.fill, theme),
      stroke: themeToken(preset.stroke, theme),
      strokeWidth: number(preset.strokeWidth, 0),
      shadow: preset.shadow || null,
      charSpacing: number(preset.charSpacing, 0),
      textAlign: preset.textAlign || 'left',
      name: preset.label,
      cardRole: 'text-preset',
      splitByGrapheme: true
    });
    canvas.add(textbox);
    centerOriginObject(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
    return textbox;
  }

  function addElement(canvas, elementKey = 'panel') {
    const fabric = requireFabric(), theme = currentTheme();
    const preset = ELEMENT_PRESETS[elementKey] || ELEMENT_PRESETS.panel;
    let object;
    if (preset.kind === 'divider') {
      object = new fabric.Rect({ left: 72, top: 92, width: 220, height: 4, rx: 999, ry: 999, fill: theme.accent, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'thinRule') {
      object = new fabric.Rect({ left: 72, top: 92, width: 240, height: 2, rx: 999, ry: 999, fill: theme.muted, opacity: .75, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'doubleRule') {
      object = new fabric.Textbox('━━━━━━\n━━━━━━', { left: 72, top: 84, width: 260, fontSize: 18, fontFamily: 'Georgia', fill: theme.accent, charSpacing: 90, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'banner') {
      object = new fabric.Rect({ left: 64, top: 64, width: 230, height: 56, rx: 18, ry: 18, fill: theme.accent, stroke: theme.border, strokeWidth: 1, shadow: '0 14px 28px rgba(0,0,0,.30)', name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'badge') {
      object = new fabric.Circle({ left: 84, top: 72, radius: 44, fill: theme.surfaceSoft, stroke: theme.accent, strokeWidth: 3, shadow: '0 16px 34px rgba(0,0,0,.34)', name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'panel') {
      object = new fabric.Rect({ left: 48, top: 48, width: 260, height: 150, rx: 24, ry: 24, fill: theme.surfaceSoft, stroke: theme.border, strokeWidth: 2, opacity: .9, shadow: '0 20px 46px rgba(0,0,0,.36)', name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'glassPanel') {
      object = new fabric.Rect({ left: 48, top: 48, width: 260, height: 150, rx: 28, ry: 28, fill: 'rgba(255,255,255,.08)', stroke: 'rgba(255,255,255,.24)', strokeWidth: 1.5, opacity: .9, shadow: '0 22px 50px rgba(0,0,0,.42)', name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'tornLabel') {
      object = new fabric.Textbox('▰  ▰▰  ▰', { left: 56, top: 70, width: 220, fontSize: 34, fontFamily: 'Courier New', fill: theme.surfaceSoft, stroke: theme.accent, strokeWidth: 1, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'circle') {
      object = new fabric.Circle({ left: 86, top: 76, radius: 54, fill: 'transparent', stroke: theme.accent, strokeWidth: 2, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'oval') {
      object = new fabric.Rect({ left: 64, top: 74, width: 210, height: 78, rx: 999, ry: 999, fill: 'transparent', stroke: theme.accent, strokeWidth: 2, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'diamond') {
      object = new fabric.Rect({ left: 110, top: 78, width: 88, height: 88, angle: 45, fill: 'transparent', stroke: theme.accent, strokeWidth: 2, name: preset.label, cardRole: 'decor' });
    } else if (preset.kind === 'frame') {
      object = new fabric.Rect({ left: 52, top: 52, width: 180, height: 230, rx: 18, ry: 18, fill: 'transparent', stroke: theme.muted, strokeWidth: 3, shadow: 'inset 0 0 0 1px rgba(255,255,255,.12)', name: preset.label, cardRole: 'frame' });
    } else if (preset.kind === 'ornateFrame') {
      object = new fabric.Textbox('╔════════╗\n║        ║\n║        ║\n╚════════╝', { left: 58, top: 50, width: 260, fontSize: 24, fontFamily: 'Georgia', fontWeight: '700', fill: theme.accent, name: preset.label, cardRole: 'frame' });
    } else if (preset.kind === 'corners') {
      object = new fabric.Textbox('⌜        ⌝\n\n\n⌞        ⌟', { left: 60, top: 60, width: 220, fontSize: 34, fontFamily: 'Georgia', fontWeight: '700', fill: theme.accent, name: preset.label, cardRole: 'decor', splitByGrapheme: true });
    } else {
      object = new fabric.Textbox(preset.glyph || '✦', { left: 76, top: 76, width: 180, fontSize: 34, fontFamily: 'Georgia', fontWeight: '700', fill: theme.accent, name: preset.label, cardRole: 'decor', splitByGrapheme: true });
    }
    canvas.add(object);
    centerOriginObject(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    return object;
  }

  function addProgressSlider(canvas, record = {}, options = {}) {
    const fabric = requireFabric(), theme = currentTheme(), width = canvas.__designWidth || DEFAULT_SIZE.width;
    const left = options.left || 64, top = options.top || 120, trackWidth = options.width || Math.min(260, width * .62);
    const sliderId = makeObjectId('progress-slider');
    const baseConfig = { sliderId, path: 'progress', name: 'Progress', style: 'bar', value: 0, max: 100, trackWidth };
    const track = new fabric.Rect({ left, top, width: trackWidth, height: 8, rx: 8, ry: 8, fill: options.fill || theme.border, opacity: .8, id: makeObjectId('progress-track'), name: 'Progress track', cardRole: 'progress', sliderConfig: { ...baseConfig, role: 'track' } });
    const progress = clamp(recordValue(record, 'progress') ?? 0, 0, 100);
    const liveConfig = { ...baseConfig, value: progress };
    const fill = new fabric.Rect({ left, top, width: trackWidth * progress / 100, height: 8, rx: 8, ry: 8, fill: options.accent || theme.accent, id: makeObjectId('progress-fill'), name: 'Progress fill', cardRole: 'progress', dataBinding: { path: 'progress' }, sliderConfig: { ...liveConfig, role: 'fill' } });
    const label = new fabric.Textbox(`${displayNumber(progress)}%`, { left, top: top + 14, width: trackWidth, fontSize: 18, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, id: makeObjectId('progress-label'), name: 'Progress label', cardRole: 'progress', dataBinding: { path: 'progress' }, sliderConfig: { ...liveConfig, role: 'value' } });
    canvas.add(track, fill, label);
    canvas.setActiveObject(label);
    canvas.requestRenderAll();
    return label;
  }

  function sliderGlyphs(style, value, max) {
    if (style === 'bar') {
      const cells = 10;
      const raw = (number(value, 0) / Math.max(1, number(max, 1))) * cells;
      const full = Math.floor(raw), half = raw - full >= .5 && full < cells;
      return `${'█'.repeat(full)}${half ? '▌' : ''}${'░'.repeat(Math.max(0, cells - full - (half ? 1 : 0)))}`;
    }
    const glyph = { stars: '★', hearts: '♥', fire: '🔥', dots: '●', 'custom-icon': '◆' }[style] || '★';
    const halfGlyph = { stars: '⯨', hearts: '◐', fire: '½', dots: '◐', 'custom-icon': '◐' }[style] || '⯨';
    const empty = { stars: '☆', hearts: '♡', fire: '·', dots: '○', 'custom-icon': '◇' }[style] || '☆';
    const numeric = clamp(value, 0, max);
    const full = Math.floor(numeric), half = numeric - full >= .5 && full < max;
    return `${glyph.repeat(full)}${half ? halfGlyph : ''}${empty.repeat(Math.max(0, max - full - (half ? 1 : 0)))}`;
  }

  function bindingPath(object) {
    return object?.dataBinding?.path || object?.sliderConfig?.path || '';
  }

  function sliderStyleForPath(path, fallback = 'stars') {
    if (path === 'rating') return 'stars';
    if (path === 'spice') return 'fire';
    if (path === 'impact') return 'hearts';
    if (path === 'progress') return 'bar';
    return fallback;
  }

  function sliderMaxForPath(path, fallback = 5) {
    return path === 'progress' ? 100 : fallback;
  }

  function setBookValue(record = {}, path = '', value) {
    const numeric = number(value, 0);
    if (path === 'rating') {
      record.rating = numeric;
      record.ratings = { ...(record.ratings || {}), overall: numeric };
    } else if (path === 'spice' || path === 'impact') {
      record[path] = numeric;
      record.ratings = { ...(record.ratings || {}), [path]: numeric };
    } else if (path === 'progress') {
      record.progress = clamp(numeric, 0, 100);
      if (record.progress > 0 && record.status === 'want') record.status = 'reading';
      if (record.progress >= 100) record.status = 'completed';
    }
    record.updatedAt = Date.now();
  }

  function sliderObjects(canvas, object) {
    const sliderId = object?.sliderConfig?.sliderId;
    if (!sliderId || !canvas?.getObjects) return object ? [object] : [];
    return canvas.getObjects().filter(item => item.sliderConfig?.sliderId === sliderId);
  }

  function updateSliderObject(object, value, extra = {}) {
    if (!object) return false;
    const path = bindingPath(object);
    const config = { ...(object.sliderConfig || {}) };
    const max = sliderMaxForPath(path, number(extra.max ?? config.max, path === 'progress' ? 100 : 5));
    const style = extra.style || config.style || sliderStyleForPath(path);
    const numeric = clamp(value, 0, max);
    const nextConfig = { ...config, path: path || config.path, style, value: numeric, max };
    if (extra.name !== undefined) nextConfig.name = String(extra.name || config.name || object.name || 'Custom Tracker');
    sliderObjects(object.canvas, object).forEach(item => {
      item.sliderConfig = { ...(item.sliderConfig || {}), ...nextConfig };
      if (item.sliderConfig.role === 'fill' && item.sliderConfig.trackWidth) item.set?.('width', item.sliderConfig.trackWidth * numeric / Math.max(1, max));
      if (isTextObject(item) && item.sliderConfig.role === 'label') item.set?.('text', item.sliderConfig.name || nextConfig.name || item.text);
      else if (isTextObject(item)) item.set?.('text', sliderDisplay(item.sliderConfig, path));
      item.setCoords?.();
    });
    object.setCoords?.();
    return true;
  }

  function addCustomSlider(canvas, options = {}) {
    const fabric = requireFabric(), theme = currentTheme(), width = canvas.__designWidth || DEFAULT_SIZE.width;
    const name = String(options.name || 'Custom Tracker').trim() || 'Custom Tracker';
    const style = ['bar', 'stars', 'hearts', 'fire', 'dots', 'custom-icon'].includes(options.style) ? options.style : 'bar';
    const max = clamp(options.max ?? 5, 1, 100), value = clamp(options.value ?? 0, 0, max);
    const left = options.left || 64, top = options.top || 150, trackWidth = options.width || Math.min(280, width * .66);
    const sliderId = makeObjectId('custom-slider');
    if (style === 'bar') {
      const baseConfig = { sliderId, name, style, value, max, trackWidth };
      const label = new fabric.Textbox(name, { left, top, width: trackWidth, fontSize: 13, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.muted, name: `${name} label`, cardRole: 'custom-slider', sliderConfig: { ...baseConfig, role: 'label' } });
      const track = new fabric.Rect({ left, top: top + 22, width: trackWidth, height: 10, rx: 999, ry: 999, fill: theme.border, opacity: .75, name: `${name} track`, cardRole: 'custom-slider', sliderConfig: { ...baseConfig, role: 'track' } });
      const fill = new fabric.Rect({ left, top: top + 22, width: trackWidth * value / max, height: 10, rx: 999, ry: 999, fill: options.accent || theme.accent, name: `${name} fill`, cardRole: 'custom-slider', sliderConfig: { ...baseConfig, role: 'fill' } });
      const valueText = new fabric.Textbox(`${displayNumber(value)} of ${max}`, { left, top: top + 38, width: trackWidth, fontSize: 18, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, name: `${name} value`, cardRole: 'custom-slider', sliderConfig: { ...baseConfig, role: 'value' } });
      canvas.add(label, track, fill, valueText);
      canvas.setActiveObject(valueText);
      canvas.requestRenderAll();
      return valueText;
    }
    const tracker = new fabric.Textbox(`${name}\n${sliderGlyphs(style, value, max)}\n${displayNumber(value)} of ${max}`, {
      left,
      top,
      width: trackWidth,
      fontSize: options.fontSize || 22,
      fontFamily: 'Libre Baskerville',
      fontWeight: '700',
      fill: options.fill || theme.accent,
      name,
      cardRole: 'custom-slider',
      sliderConfig: { sliderId, role: 'value', name, style, value, max, iconSrc: options.iconSrc || '', iconName: options.iconName || '' }
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
    if (globalThis.VisualFields?.display) {
      const meta = FIELD_META[path] || {};
      const resolved = globalThis.VisualFields.display(record, meta.path || path);
      if (resolved !== undefined && resolved !== null && resolved !== '') return String(resolved);
    }
    const value = recordValue(record, path);
    if (path === 'progress') return `${displayNumber(clamp(value ?? 0, 0, 100))}%`;
    if (['rating', 'spice', 'impact'].includes(path)) return ratingDisplay(path, value);
    return String(value ?? path);
  }

  function addBoundImage(canvas, path, record = {}, options = {}) {
    const fabric = requireFabric(), theme = currentTheme();
    const meta = FIELD_META[path] || { label: path, role: 'image', moduleType: 'image' };
    const sourcePath = meta.path || path;
    const src = recordValue(record, sourcePath);
    const left = options.left ?? 64, top = options.top ?? 64;
    const width = options.width || meta.defaultWidth || 120, height = options.height || meta.defaultHeight || 160;
    const finish = object => {
      object.set({
        id: options.id || path,
        name: options.name || meta.label,
        dataBinding: { path: sourcePath },
        cardRole: options.cardRole || meta.role || 'image',
        originX: 'center',
        originY: 'center',
        centeredRotation: true
      });
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      return object;
    };
    if (!src) return Promise.resolve(finish(new fabric.Rect({ left, top, width, height, fill: theme.surfaceSoft, stroke: theme.border, strokeWidth: 1.5, rx: 16, ry: 16 })));
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const object = new fabric.Image(image, { left, top, opacity: 1, crossOrigin: 'anonymous' });
        object.scaleToWidth(width);
        if (object.getScaledHeight?.() > height) object.scaleToHeight(height);
        resolve(finish(object));
      };
      image.onerror = () => resolve(finish(new fabric.Rect({ left, top, width, height, fill: theme.surfaceSoft, stroke: theme.border, strokeWidth: 1.5, rx: 16, ry: 16 })));
      image.src = src;
    });
  }

  function addActionButtons(canvas, record = {}, options = {}) {
    const fabric = requireFabric(), theme = currentTheme(), width = canvas.__designWidth || DEFAULT_SIZE.width;
    const labels = record.status === 'completed'
      ? ['Reread', 'Rate & Edit', 'Progress', 'Pin']
      : [record.status === 'reading' ? 'Update' : 'Start Reading', 'Rate & Edit', 'Progress', 'Pin'];
    const left = options.left ?? 64, top = options.top ?? Math.max(220, (canvas.__designHeight || DEFAULT_SIZE.height) - 88);
    const buttonWidth = options.buttonWidth || Math.max(64, Math.min(92, (width - 110) / labels.length));
    const gap = 8;
    const groupItems = labels.map((label, index) => {
      const rect = new fabric.Rect({ left: index * (buttonWidth + gap), top: 0, width: buttonWidth, height: 34, rx: 999, ry: 999, fill: theme.surfaceSoft, stroke: theme.border, strokeWidth: 1.5, shadow: '0 8px 16px rgba(0,0,0,.24)' });
      const text = new fabric.Textbox(label, { left: index * (buttonWidth + gap), top: 7, width: buttonWidth, fontSize: 10, fontFamily: 'Libre Baskerville', fontWeight: '700', fill: theme.text, textAlign: 'center', selectable: false, evented: false });
      return [rect, text];
    }).flat();
    const group = new fabric.Group(groupItems, {
      left,
      top,
      name: 'Action buttons',
      cardRole: 'actions',
      dataBinding: { path: '$actions' },
      originX: 'center',
      originY: 'center',
      centeredRotation: true
    });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    return group;
  }

  function addBoundTextBox(canvas, path, record = {}, options = {}) {
    const meta = FIELD_META[path] || { label: path, role: 'metadata' };
    if (meta.moduleType === 'image' || meta.role === 'image') return addBoundImage(canvas, path, record, options);
    if (meta.moduleType === 'actions' || meta.role === 'actions' || path === '$actions') return addActionButtons(canvas, record, options);
    if (meta.moduleType === 'custom-slider' || meta.role === 'custom-slider' || path === 'customTracker' || path === 'trackerValues') {
      const tracker = recordValue(record, 'customTracker');
      const next = typeof tracker === 'object' ? tracker : {};
      return addCustomSlider(canvas, { name: next.name || 'Custom tracker', value: next.value ?? 0, max: next.max || 5, style: next.style || 'stars', width: options.width, left: options.left, top: options.top });
    }
    const object = addEditableTextBox(canvas, fieldText(path, record), options);
    const isBoundSlider = ['rating', 'spice', 'impact', 'progress'].includes(path);
    object.set({
      id: options.id || path,
      name: options.name || meta.label,
      dataBinding: { path },
      cardRole: options.cardRole || meta.role,
      ...(isBoundSlider ? { sliderConfig: { path, name: meta.label, style: sliderStyleForPath(path), value: clamp(recordValue(record, path), 0, sliderMaxForPath(path)), max: sliderMaxForPath(path) } } : {})
    });
    object.exitEditing?.();
    canvas.requestRenderAll();
    return object;
  }

  function addBoundField(canvas, path, record = {}, options = {}) {
    const meta = FIELD_META[path] || globalThis.VisualFields?.byId?.(path) || {};
    if (meta.moduleType === 'actions' || meta.role === 'actions' || path === '$actions') return addActionButtons(canvas, record, options);
    if (meta.moduleType === 'custom-slider' || meta.role === 'custom-slider' || path === 'customTracker' || path === 'trackerValues') return addBoundTextBox(canvas, path, record, options);
    return meta.moduleType === 'image' || meta.role === 'image'
      ? addBoundImage(canvas, path, record, options)
      : addBoundTextBox(canvas, path, record, options);
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

  async function addLibraryAsset(canvas, asset) {
    const fabric = requireFabric();
    const url = await globalThis.VisualAssets?.getAssetUrl?.(asset);
    if (!url) throw new Error('This visual element is unavailable.');
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The visual element could not be opened.'));
      element.src = url;
    });
    const object = new fabric.Image(image, {
      left: 56, top: 56, opacity: 1, name: asset.name || 'Uploaded element',
      assetId: asset.id, assetStoragePath: asset.storage_path
    });
    object.scaleToWidth(Math.min(240, canvas.__designWidth * .5));
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    return object;
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

  function cloneActiveElement(canvas) {
    const active = getActive(canvas);
    if (!active || active.selectable === false) return Promise.resolve(false);
    return active.clone(SERIALIZE_PROPS).then(clone => {
      clone.set({ left: number(active.left, 0) + 18, top: number(active.top, 0) + 18, evented: true });
      if (active.type === 'activeSelection') {
        clone.canvas = canvas;
        clone.forEachObject(object => {
          object.set({ left: number(object.left, 0) + 18, top: number(object.top, 0) + 18, evented: true });
          canvas.add(object);
        });
        clone.setCoords?.();
      } else canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
      return clone;
    });
  }

  function styleSnapshot(object) {
    if (!object) return null;
    const keys = ['fill', 'stroke', 'strokeWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'textAlign', 'shadow', 'opacity', 'rx', 'ry', 'charSpacing'];
    return keys.reduce((snapshot, key) => {
      if (object[key] !== undefined) snapshot[key] = object[key];
      return snapshot;
    }, {});
  }

  function pasteStyle(canvas, snapshot) {
    const active = getActive(canvas);
    if (!active || !snapshot) return false;
    Object.entries(snapshot).forEach(([key, value]) => active.set?.(key, value));
    active.setCoords?.();
    canvas.requestRenderAll();
    return true;
  }

  function groupSelection(canvas) {
    const fabric = requireFabric();
    const active = getActive(canvas);
    if (!active || active.type !== 'activeSelection' || typeof active.toGroup !== 'function') return false;
    const group = active.toGroup();
    group.set({ name: 'Group', cardRole: 'group' });
    centerOriginObject(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    return true;
  }

  function ungroupSelection(canvas) {
    const active = getActive(canvas);
    if (!active || active.type !== 'group' || typeof active.toActiveSelection !== 'function') return false;
    active.toActiveSelection();
    canvas.requestRenderAll();
    return true;
  }

  function distributeActiveObjects(canvas, axis = 'horizontal') {
    const objects = selectedObjects(canvas).filter(object => object.selectable !== false);
    if (objects.length < 3) return false;
    const entries = objects.map(object => ({ object, rect: object.getBoundingRect?.() || { left: number(object.left, 0), top: number(object.top, 0), width: object.getScaledWidth?.() || object.width || 0, height: object.getScaledHeight?.() || object.height || 0 } }));
    const key = axis === 'vertical' ? 'top' : 'left';
    const sizeKey = axis === 'vertical' ? 'height' : 'width';
    entries.sort((a, b) => a.rect[key] - b.rect[key]);
    const first = entries[0].rect[key], last = entries[entries.length - 1].rect[key], totalSize = entries.reduce((sum, entry) => sum + entry.rect[sizeKey], 0);
    const gap = (last + entries[entries.length - 1].rect[sizeKey] - first - totalSize) / (entries.length - 1);
    let cursor = first;
    entries.forEach(entry => {
      const left = axis === 'vertical' ? entry.rect.left : cursor;
      const top = axis === 'vertical' ? cursor : entry.rect.top;
      if (entry.object.setPositionByOrigin) entry.object.setPositionByOrigin({ x: left, y: top }, 'left', 'top');
      else entry.object.set({ left, top });
      entry.object.setCoords?.();
      cursor += entry.rect[sizeKey] + gap;
    });
    canvas.requestRenderAll();
    return true;
  }

  function applySliderIconFromFile(object, file) {
    return new Promise((resolve, reject) => {
      if (!isSliderObject(object)) return reject(new Error('Select a slider or rating widget first.'));
      if (!file?.type?.startsWith('image/')) return reject(new Error('Choose an image file.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Slider icon could not be read.'));
      reader.onload = () => {
        object.sliderConfig = { ...(object.sliderConfig || {}), style: 'custom-icon', iconSrc: reader.result, iconName: file.name || 'custom icon' };
        updateSliderObject(object, object.sliderConfig.value ?? 0, object.sliderConfig);
        object.canvas?.requestRenderAll();
        resolve(object);
      };
      reader.readAsDataURL(file);
    });
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
      const rect = object.getBoundingRect?.() || { left: number(object.left, 0), top: number(object.top, 0), width: scaledWidth, height: scaledHeight };
      let left = rect.left, top = rect.top;
      if (alignment === 'left') left = 0;
      if (alignment === 'center') left = (width - scaledWidth) / 2;
      if (alignment === 'right') left = width - scaledWidth;
      if (alignment === 'top') top = 0;
      if (alignment === 'middle') top = (height - scaledHeight) / 2;
      if (alignment === 'bottom') top = height - scaledHeight;
      if (object.setPositionByOrigin) object.setPositionByOrigin({ x: left, y: top }, 'left', 'top');
      else object.set({ left, top });
      object.setCoords?.();
    });
    canvas.requestRenderAll();
    return true;
  }

  function nudgeActiveObjects(canvas, dx = 0, dy = 0) {
    const objects = selectedObjects(canvas).filter(object => object.selectable !== false && !object.locked);
    if (!objects.length) return false;
    objects.forEach(object => {
      object.set({ left: number(object.left, 0) + dx, top: number(object.top, 0) + dy });
      object.setCoords?.();
    });
    canvas.requestRenderAll();
    return true;
  }

  function rotateActiveObjects(canvas, delta = 0) {
    const objects = selectedObjects(canvas).filter(object => object.selectable !== false && !object.locked);
    if (!objects.length) return false;
    objects.forEach(object => {
      const next = number(object.angle, 0) + delta;
      const snapped = [0, 90, 180, -90, -180].find(angle => Math.abs(next - angle) <= 3);
      object.set('angle', snapped ?? next);
      object.setCoords?.();
    });
    canvas.requestRenderAll();
    return true;
  }

  function moveLayer(canvas, action = 'front') {
    selectedObjects(canvas).filter(object => object.selectable !== false).forEach(object => {
      if (action === 'front') canvas.bringObjectToFront?.(object) || canvas.bringToFront?.(object);
      if (action === 'back') canvas.sendObjectToBack?.(object) || canvas.sendToBack?.(object);
      if (action === 'forward') canvas.bringObjectForward?.(object) || canvas.bringForward?.(object);
      if (action === 'backward') canvas.sendObjectBackwards?.(object) || canvas.sendBackwards?.(object);
    });
    canvas.requestRenderAll();
    return true;
  }

  function toggleLockActive(canvas) {
    const objects = selectedObjects(canvas);
    if (!objects.length) return false;
    const shouldLock = !objects.every(object => object.locked);
    objects.forEach(object => {
      object.locked = shouldLock;
      object.set({
        lockMovementX: shouldLock,
        lockMovementY: shouldLock,
        lockScalingX: shouldLock,
        lockScalingY: shouldLock,
        lockRotation: shouldLock,
        hasControls: !shouldLock
      });
    });
    canvas.requestRenderAll();
    return shouldLock;
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
      controlsAboveOverlay: true,
      centeredRotation: true
    });
    canvas.__designWidth = width;
    canvas.__designHeight = height;
    canvas.on('object:added', event => { if (!canvas.__restoringHistory) centerOriginObject(event.target); options.onChange?.(canvas); });
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
      addBoundField: (path, record, extra) => addBoundField(canvas, path, record, extra),
      addBoundImage: (path, record, extra) => addBoundImage(canvas, path, record, extra),
      addProgressSlider: (record, extra) => addProgressSlider(canvas, record, extra),
      addCustomSlider: extra => addCustomSlider(canvas, extra),
      addTextPreset: preset => addTextPreset(canvas, preset),
      addElement: element => addElement(canvas, element),
      alignActiveObjects: alignment => alignActiveObjects(canvas, alignment),
      nudgeActiveObjects: (dx, dy) => nudgeActiveObjects(canvas, dx, dy),
      rotateActiveObjects: delta => rotateActiveObjects(canvas, delta),
      distributeActiveObjects: axis => distributeActiveObjects(canvas, axis),
      moveLayer: action => moveLayer(canvas, action),
      toggleLockActive: () => toggleLockActive(canvas),
      cloneActiveElement: () => cloneActiveElement(canvas),
      groupSelection: () => groupSelection(canvas),
      ungroupSelection: () => ungroupSelection(canvas),
      styleSnapshot: object => styleSnapshot(object || getActive(canvas)),
      pasteStyle: snapshot => pasteStyle(canvas, snapshot),
      applyAppearancePreset: preset => applyAppearancePreset(canvas, preset),
      applyTextEffect: effect => applyTextEffect(canvas, effect),
      applySmartColor: color => applySmartColor(canvas, color),
      setCardBackgroundColor: color => setCardBackgroundColor(canvas, color),
      setImageCropMode: mode => setImageCropMode(canvas, mode),
      cropActiveImage: changes => cropActiveImage(canvas, changes),
      setActiveImageAsBackground: () => setActiveImageAsBackground(canvas),
      applySliderIconFromFile: file => applySliderIconFromFile(getActive(canvas), file),
      applyCardPreset: (preset, record) => applyCardPreset(canvas, preset, record),
      updateActiveObject: changes => updateActiveObject(canvas, changes),
      addImageFromFile: file => addImageFromFile(canvas, file),
      addActionButtons: (record, extra) => addActionButtons(canvas, record, extra),
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
        <div class="fabric-editor-actions"><button type="button" data-fabric-undo disabled>Undo</button><button type="button" data-fabric-redo disabled>Redo</button><button type="button" class="primary-button" data-fabric-save>Save</button><button type="button" data-fabric-close>Cancel</button></div>
      </header>
      <div class="fabric-editor-layout">
        <aside class="fabric-editor-sidebar" aria-label="Canvas tools">
          <nav class="fabric-panel-tabs" aria-label="Editor panels">
            <a href="#fabric-panel-templates">Templates</a>
            <a href="#fabric-panel-elements">Elements</a>
            <a href="#fabric-panel-text">Text</a>
            <a href="#fabric-panel-fields">Book info</a>
            <a href="#fabric-panel-uploads">Uploads</a>
          </nav>
          <button type="button" class="fabric-mobile-more" data-fabric-mobile-more aria-expanded="false">See more tools</button>
          <section id="fabric-panel-templates" class="fabric-tool-section fabric-panel">
            <p>Starter looks</p>
            <button type="button" data-fabric-card-preset="classic">Classic card</button>
            <button type="button" data-fabric-card-preset="poster">Poster card</button>
            <button type="button" data-fabric-card-preset="dashboard">Dashboard card</button>
            <button type="button" data-fabric-share-formatting>Share formatting across all cards</button>
          </section>
          <section id="fabric-panel-elements" class="fabric-tool-section fabric-panel">
            <p>Elements</p>
            <button type="button" data-fabric-add="shape">Shape box</button>
            <button type="button" data-fabric-add="progress-slider">Progress slider</button>
            <button type="button" data-fabric-add="custom-slider">Custom slider</button>
            <div class="fabric-elements-palette" aria-label="Decorative elements">
              ${Object.entries(ELEMENT_PRESETS).map(([key, preset]) => `<button type="button" data-fabric-element="${key}">${escapeHtml(preset.label)}</button>`).join('')}
            </div>
          </section>
          <section id="fabric-panel-text" class="fabric-tool-section fabric-panel">
            <p>Text</p>
            <button type="button" data-fabric-add="text">Add a text box</button>
            <label>Font family <select data-fabric-new-font>${FONT_OPTIONS.map(font => `<option value="${escapeHtml(font)}">${escapeHtml(font)}</option>`).join('')}</select></label>
            <div class="fabric-style-palette" aria-label="Text style presets">
              ${Object.entries(TEXT_STYLE_PRESETS).map(([key, preset]) => `<button type="button" data-fabric-text-preset="${key}"><span>${escapeHtml(preset.label)}</span><em>${escapeHtml(preset.text)}</em></button>`).join('')}
            </div>
            <div class="fabric-library-manager" aria-label="My fonts">
              <p>My fonts</p>
              <label>Display name <input type="text" name="fabricFontName" data-fabric-font-name></label>
              <label class="fabric-upload-control">Choose font<input type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" data-fabric-font-upload></label>
              <output class="fabric-upload-filename" data-fabric-font-filename>No font selected.</output>
              <label class="fabric-check-control"><input type="checkbox" name="fabricFontLicense" data-fabric-font-license> I confirm that I own this font or have permission to upload and use it.</label>
              <button type="button" data-fabric-font-submit disabled>Upload Font</button>
              <output class="fabric-library-status" data-fabric-font-status aria-live="polite"></output>
              <div class="fabric-library-list" data-fabric-font-list></div>
            </div>
          </section>
          <section id="fabric-panel-fields" class="fabric-tool-section fabric-panel">
            <p>Book information</p>
            <div class="fabric-field-palette" aria-label="Book fields">
              ${Object.entries(FIELD_META).map(([path, meta]) => `<button type="button" data-fabric-field="${path}">${escapeHtml(meta.label)}</button>`).join('')}
            </div>
          </section>
          <section id="fabric-panel-uploads" class="fabric-tool-section fabric-panel">
            <p>Uploads</p>
            <label class="fabric-upload-control">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" data-fabric-upload></label>
            <button type="button" data-fabric-action="image-background">Set selected image as background</button>
            <div class="fabric-library-manager" aria-label="My reusable elements">
              <p>My elements</p>
              <label>Name <input type="text" name="fabricAssetName" data-fabric-asset-name></label>
              <label>Category <select name="fabricAssetCategory" data-fabric-asset-category>${['element','background','texture','overlay','divider','frame','logo','sticker','symbol','decoration'].map(value => `<option value="${value}">${value}</option>`).join('')}</select></label>
              <label class="fabric-upload-control">Choose reusable element<input type="file" accept="image/png,image/jpeg,image/webp" data-fabric-asset-upload></label>
              <output class="fabric-upload-filename" data-fabric-asset-filename>No element selected.</output>
              <button type="button" data-fabric-asset-submit disabled>Upload Element</button>
              <label>Search <input type="search" name="fabricAssetSearch" data-fabric-asset-search></label>
              <label>Filter <select name="fabricAssetFilter" data-fabric-asset-filter><option value="">All categories</option>${['element','background','texture','overlay','divider','frame','logo','sticker','symbol','decoration'].map(value => `<option value="${value}">${value}</option>`).join('')}</select></label>
              <output class="fabric-library-status" data-fabric-asset-status aria-live="polite"></output>
              <div class="fabric-library-grid" data-fabric-asset-list></div>
            </div>
          </section>
          <section class="fabric-tool-section fabric-panel">
            <p>Canvas</p>
            <label>Zoom <input type="range" min="40" max="180" value="100" data-fabric-zoom></label>
            <label class="fabric-check-control"><input type="checkbox" checked data-fabric-snapping> Snap to edges and center</label>
            <label>Card background <input type="color" value="#2b160d" data-fabric-card-bg></label>
            <button type="button" data-fabric-delete>Delete selected</button>
          </section>
          <p class="fabric-editor-hint">Drag, resize, rotate, edit text inline, or upload art. Everything saves as Fabric JSON.</p>
        </aside>
        <main class="fabric-canvas-workspace"><div class="fabric-canvas-frame"><canvas id="${canvasId}" width="${width}" height="${height}"></canvas></div></main>
        <aside class="fabric-editor-inspector" aria-label="Selected object controls">
          <div class="fabric-tool-section">
            <p>Selected piece</p>
            <output data-fabric-selected-name>Nothing selected</output>
          </div>
          <div class="fabric-tool-section fabric-universal-colors">
            <p>Color</p>
            <label>Color wheel <input type="color" value="#bd662f" data-fabric-color-wheel></label>
            <div class="fabric-color-swatches">
              ${['#bd662f', '#f7ead2', '#a61f3f', '#f4b942', '#9b5de5', '#00bbf9', '#2b160d', '#111111'].map(color => `<button type="button" style="--swatch:${color}" data-fabric-color-swatch="${color}" aria-label="${color}"></button>`).join('')}
            </div>
            <label>Border color <input type="color" value="#75451f" data-fabric-stroke></label>
          </div>
          <div class="fabric-value-controls" data-fabric-value-controls hidden>
            <label>Widget label <input type="text" value="" data-fabric-slider-name></label>
            <label>Live value <output data-fabric-value-output>0</output><input type="range" min="0" max="5" step="0.5" value="0" data-fabric-value></label>
            <label>Maximum <input type="number" min="1" max="100" step="1" value="5" data-fabric-slider-max></label>
            <label>Slider look <select data-fabric-slider-style><option value="stars">Stars</option><option value="fire">Fire</option><option value="hearts">Hearts</option><option value="dots">Dots</option><option value="bar">Bar</option><option value="custom-icon">Custom icon</option></select></label>
            <label class="fabric-upload-control">Upload slider icon<input type="file" accept="image/png,image/jpeg,image/webp" data-fabric-slider-icon></label>
          </div>
          <div class="fabric-image-controls" data-fabric-image-controls hidden>
            <p>Image crop</p>
            <div class="fabric-quick-actions">
              <button type="button" data-fabric-image-fit="cover">Crop / cover</button>
              <button type="button" data-fabric-image-fit="contain">Fit inside</button>
              <button type="button" data-fabric-action="image-background">Use as background</button>
            </div>
            <label>Image zoom <input type="range" min="20" max="300" value="100" data-fabric-image-crop="zoom"></label>
            <label>Crop X <input type="range" min="0" max="600" value="0" data-fabric-image-crop="cropX"></label>
            <label>Crop Y <input type="range" min="0" max="600" value="0" data-fabric-image-crop="cropY"></label>
          </div>
          <div class="fabric-tool-section">
            <p>Layers</p>
            <div class="fabric-layer-list" data-fabric-layer-list aria-label="Layer list"></div>
            <div class="fabric-quick-actions">
              <button type="button" data-fabric-action="forward">Forward</button>
              <button type="button" data-fabric-action="backward">Backward</button>
            </div>
          </div>
          <div class="fabric-quick-actions" aria-label="Object actions">
            <button type="button" data-fabric-action="duplicate">Duplicate</button>
            <button type="button" data-fabric-action="lock">Lock</button>
            <button type="button" data-fabric-action="copy-style">Copy style</button>
            <button type="button" data-fabric-action="paste-style">Paste style</button>
            <button type="button" data-fabric-action="group">Group</button>
            <button type="button" data-fabric-action="ungroup">Ungroup</button>
            <button type="button" data-fabric-action="flip-x">Flip X</button>
            <button type="button" data-fabric-action="flip-y">Flip Y</button>
            <button type="button" data-fabric-action="front">To front</button>
            <button type="button" data-fabric-action="back">To back</button>
          </div>
          <div class="fabric-text-tools" data-fabric-text-tools aria-label="Text tools" hidden>
            <label>Font <select data-fabric-font-family>${FONT_OPTIONS.map(font => `<option value="${escapeHtml(font)}">${escapeHtml(font)}</option>`).join('')}</select></label>
            <label>Align <select data-fabric-text-align><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
            <div class="fabric-text-effect-grid"><button type="button" data-fabric-text-effect="shadow">Shadow</button><button type="button" data-fabric-text-effect="glow">Glow</button><button type="button" data-fabric-text-effect="outline">Outline</button><button type="button" data-fabric-text-effect="hollow">Hollow</button><button type="button" data-fabric-text-effect="lift">Lift</button><button type="button" data-fabric-text-effect="clear">Clear FX</button></div>
          </div>
          <div class="fabric-preset-grid" aria-label="Appearance presets">
            ${['plain', 'pill', 'badge', 'raised', 'glass', 'accent', 'outline'].map(preset => `<button type="button" data-fabric-appearance="${preset}">${preset}</button>`).join('')}
          </div>
          <div class="fabric-align-grid" aria-label="Alignment controls">
            ${['left', 'center', 'right', 'top', 'middle', 'bottom'].map(action => `<button type="button" data-fabric-align="${action}">${action}</button>`).join('')}
            <button type="button" data-fabric-distribute="horizontal">Distribute H</button>
            <button type="button" data-fabric-distribute="vertical">Distribute V</button>
          </div>
          <label>Font size <input type="range" min="8" max="72" value="24" data-fabric-prop="fontSize"></label>
          <label>Object width <input type="range" min="20" max="${Math.max(240, width)}" value="180" data-fabric-prop="width"></label>
          <label>Object height <input type="range" min="8" max="${Math.max(240, height)}" value="80" data-fabric-prop="height"></label>
          <label>Rotation <input type="range" min="-180" max="180" value="0" data-fabric-prop="angle"></label>
          <label>Opacity <input type="range" min="0" max="100" value="100" data-fabric-prop="opacity"></label>
          <label>Corner radius <input type="range" min="0" max="80" value="16" data-fabric-prop="cornerRadius"></label>
          <label>Border <input type="range" min="0" max="12" value="1" data-fabric-prop="strokeWidth"></label>
          <div class="fabric-color-row"><label>Shadow <input type="checkbox" data-fabric-shadow></label></div>
          <p class="fabric-editor-hint">Select a title, rating, pill, shape, or uploaded image, then use these controls to style it. Use the circular Fabric handle on the selection box for free rotation.</p>
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
    const undoButton = document.querySelector('[data-fabric-undo]');
    const redoButton = document.querySelector('[data-fabric-redo]');
    let history = [], historyIndex = -1, restoringHistory = false, historyTimer = null;
    let assetUploadFile = null, fontUploadFile = null, assetUploading = false, fontUploading = false, libraryLoading = false;
    const logLibraryError = (kind, stage, error, context = {}) => console.error(`[CanvasEditor] ${kind} ${stage}`, { ...context, error });
    const setLibraryStatus = (kind, message) => { const output = document.querySelector(`[data-fabric-${kind}-status]`); if (output) output.textContent = message || ''; };
    const setUploadFilename = (kind, file) => {
      const output = document.querySelector(`[data-fabric-${kind}-filename]`);
      if (output) output.textContent = file ? file.name : (kind === 'font' ? 'No font selected.' : 'No element selected.');
    };
    const syncUploadButtons = () => {
      const assetButton = document.querySelector('[data-fabric-asset-submit]');
      const fontButton = document.querySelector('[data-fabric-font-submit]');
      const license = document.querySelector('[data-fabric-font-license]')?.checked;
      if (assetButton) assetButton.disabled = assetUploading || !assetUploadFile || !globalThis.VisualCloud?.isSignedIn?.();
      if (fontButton) fontButton.disabled = fontUploading || !fontUploadFile || !license || !globalThis.VisualCloud?.isSignedIn?.();
    };
    const withRetryRefresh = (kind, message) => {
      setLibraryStatus(kind, message);
      const output = document.querySelector(`[data-fabric-${kind}-status]`);
      if (!output || output.querySelector('button')) return;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry Library Refresh';
      retry.addEventListener('click', () => refreshLibraries().catch(error => {
        logLibraryError(kind, 'retry-refresh-failed', error);
        setLibraryStatus(kind, error.message || 'Library refresh failed again.');
      }));
      output.append(' ', retry);
    };
    const applyCustomFont = async font => {
      if (!selectedTextObjects(editor.canvas).length) throw new Error('Select a text object before applying a font.');
      await globalThis.VisualFonts.loadFont(font);
      applyToSelectedText(editor.canvas, object => {
        object.set({ fontFamily: font.family_name, fontId: font.id, fontFamilyKey: font.family_name, fontStoragePath: font.storage_path });
      });
      pushHistory();
      syncInspector();
    };
    const renderFontLibrary = () => {
      document.querySelectorAll('[data-fabric-new-font],[data-fabric-font-family]').forEach(select => {
        select.querySelectorAll('option[data-user-font]').forEach(option => option.remove());
        userFonts.forEach(font => { const option = document.createElement('option'); option.value = font.family_name; option.dataset.userFont = font.id; option.textContent = font.display_name; option.style.fontFamily = font.family_name; select.append(option); });
      });
      const list = document.querySelector('[data-fabric-font-list]');
      if (!list) return;
      list.replaceChildren();
      if ((libraryLoading || fontUploading) && !userFonts.length) {
        list.textContent = fontUploading ? 'Uploading font…' : 'Loading library…';
        return;
      }
      userFonts.forEach(font => {
        const row = document.createElement('div'); row.className = 'fabric-library-row';
        const preview = document.createElement('span'); preview.className = 'fabric-font-preview'; preview.textContent = font.display_name; preview.style.fontFamily = font.family_name;
        const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'Apply'; apply.addEventListener('click', () => applyCustomFont(font).catch(error => { logLibraryError('font', 'apply-failed', error, { id: font.id }); setLibraryStatus('font', error.message); }));
        const rename = document.createElement('button'); rename.type = 'button'; rename.textContent = 'Rename'; rename.addEventListener('click', async () => { const name = prompt('Font display name', font.display_name); if (!name) return; try { await globalThis.VisualFonts.renameFont(font.id, name); await refreshLibraries(); } catch (error) { logLibraryError('font', 'rename-failed', error, { id: font.id }); setLibraryStatus('font', error.message); } });
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete'; remove.addEventListener('click', async () => { if (!confirm(`Delete ${font.display_name}? Existing cards will use a fallback font.`)) return; try { await globalThis.VisualFonts.deleteFont(font.id); await refreshLibraries(); } catch (error) { logLibraryError('font', 'delete-failed', error, { id: font.id }); setLibraryStatus('font', error.message); } });
        row.append(preview, apply, rename, remove); list.append(row);
      });
      if (!userFonts.length) list.textContent = globalThis.VisualCloud?.isSignedIn?.() ? 'No custom fonts uploaded yet.' : 'Sign in to use reusable fonts.';
    };
    const renderAssetLibrary = async () => {
      const list = document.querySelector('[data-fabric-asset-list]');
      if (!list) return;
      list.replaceChildren();
      if ((libraryLoading || assetUploading) && !userAssets.length) {
        list.textContent = assetUploading ? 'Uploading element…' : 'Loading library…';
        return;
      }
      const search = document.querySelector('[data-fabric-asset-search]')?.value.trim().toLowerCase() || '';
      const category = document.querySelector('[data-fabric-asset-filter]')?.value || '';
      const matches = userAssets.filter(asset => (!search || String(asset.name).toLowerCase().includes(search)) && (!category || asset.category === category));
      for (const asset of matches) {
        const card = document.createElement('div'); card.className = 'fabric-library-card';
        const image = document.createElement('img'); image.alt = asset.name || 'Reusable element thumbnail'; image.loading = 'lazy'; globalThis.VisualAssets.getAssetUrl(asset).then(url => { image.src = url; }).catch(error => { image.hidden = true; logLibraryError('asset', 'signed-url-failed', error, { id: asset.id }); });
        const meta = document.createElement('span'); meta.className = 'fabric-library-meta'; meta.textContent = `${asset.name || 'Untitled'} · ${asset.category || 'element'}`;
        const insert = document.createElement('button'); insert.type = 'button'; insert.textContent = 'Insert'; insert.addEventListener('click', () => addLibraryAsset(editor.canvas, asset).then(() => { pushHistory(); syncInspector(); }).catch(error => { logLibraryError('asset', 'insert-failed', error, { id: asset.id }); setLibraryStatus('asset', error.message); }));
        const rename = document.createElement('button'); rename.type = 'button'; rename.textContent = 'Rename'; rename.addEventListener('click', async () => { const name = prompt('Element name', asset.name); if (!name) return; try { await globalThis.VisualAssets.renameAsset(asset.id, name); await refreshLibraries(); } catch (error) { logLibraryError('asset', 'rename-failed', error, { id: asset.id }); setLibraryStatus('asset', error.message); } });
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete'; remove.addEventListener('click', async () => { if (!confirm(`Delete ${asset.name}? Placed copies will show as unavailable.`)) return; try { await globalThis.VisualAssets.deleteAsset(asset.id); await refreshLibraries(); } catch (error) { logLibraryError('asset', 'delete-failed', error, { id: asset.id }); setLibraryStatus('asset', error.message); } });
        card.append(image, meta, insert, rename, remove); list.append(card);
      }
      if (!matches.length && globalThis.VisualCloud?.isSignedIn?.()) list.textContent = (search || category) ? 'No elements match the current search or category filter.' : 'No reusable elements uploaded yet.';
      if (!matches.length && !globalThis.VisualCloud?.isSignedIn?.()) list.textContent = 'Sign in to use reusable elements.';
    };
    const refreshLibraries = async () => {
      libraryLoading = true;
      setLibraryStatus('asset', 'Loading library…');
      setLibraryStatus('font', 'Loading library…');
      renderFontLibrary(); await renderAssetLibrary();
      try {
        if (!globalThis.VisualCloud?.isSignedIn?.()) {
          userAssets = []; userFonts = [];
          setLibraryStatus('asset', '');
          setLibraryStatus('font', '');
          renderFontLibrary(); await renderAssetLibrary();
          return;
        }
        const [assets, fonts] = await Promise.all([globalThis.VisualAssets?.listAssets?.() || [], globalThis.VisualFonts?.listFonts?.() || []]);
        userAssets = assets; userFonts = fonts;
        const fontResults = await Promise.allSettled(userFonts.map(font => globalThis.VisualFonts.loadFont(font)));
        fontResults.filter(result => result.status === 'rejected').forEach(result => logLibraryError('font', 'fontface-load-failed', result.reason));
        renderFontLibrary(); await renderAssetLibrary();
        setLibraryStatus('asset', '');
        setLibraryStatus('font', '');
      } catch (error) {
        logLibraryError('library', 'refresh-failed', error);
        throw error;
      } finally {
        libraryLoading = false;
        renderFontLibrary(); await renderAssetLibrary();
        syncUploadButtons();
      }
    };
    const historyJson = () => JSON.stringify(serializeCanvas(editor.canvas));
    const syncHistoryButtons = () => {
      if (undoButton) undoButton.disabled = historyIndex <= 0;
      if (redoButton) redoButton.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
    };
    const pushHistory = () => {
      if (restoringHistory) return;
      clearTimeout(historyTimer);
      historyTimer = setTimeout(() => {
        const snapshot = historyJson();
        if (history[historyIndex] === snapshot) return;
        history = history.slice(0, historyIndex + 1);
        history.push(snapshot);
        if (history.length > 60) history.shift();
        historyIndex = history.length - 1;
        syncHistoryButtons();
      }, 0);
    };
    const restoreHistory = async nextIndex => {
      if (nextIndex < 0 || nextIndex >= history.length) return false;
      restoringHistory = true;
      editor.canvas.__restoringHistory = true;
      await editor.canvas.loadFromJSON(JSON.parse(history[nextIndex]));
      applyCenterOrigins(editor.canvas);
      historyIndex = nextIndex;
      editor.canvas.__restoringHistory = false;
      restoringHistory = false;
      editor.canvas.discardActiveObject();
      editor.canvas.requestRenderAll();
      syncInspector();
      syncHistoryButtons();
      return true;
    };
    const fitCanvasToWorkspace = () => {
      const workspace = document.querySelector('.fabric-canvas-workspace');
      const available = Math.max(260, number(workspace?.clientWidth, width) - 42);
      const target = globalThis.matchMedia?.('(max-width: 640px)')?.matches ? Math.min(width, available) : width;
      const zoom = editor.setUniformScale(target);
      const zoomInput = document.querySelector('[data-fabric-zoom]');
      if (zoomInput) zoomInput.value = String(Math.round(zoom * 100));
    };
    loadScene(editor.canvas, scene, book).catch(error => {
      console.error(error);
      loadScene(editor.canvas, baseScene({ width, height, theme: currentTheme(), record: book }), book);
    }).finally(() => {
      fitCanvasToWorkspace();
      pushHistory();
    });
    const syncInspector = () => {
      const active = getActive(editor.canvas);
      const selectedName = document.querySelector('[data-fabric-selected-name]');
      const activePath = bindingPath(active);
      if (selectedName) selectedName.textContent = active ? (active.name || active.id || active.type || 'Selected piece') : 'Nothing selected';
      const valueControls = document.querySelector('[data-fabric-value-controls]');
      const valueInput = document.querySelector('[data-fabric-value]');
      const valueOutput = document.querySelector('[data-fabric-value-output]');
      const styleSelect = document.querySelector('[data-fabric-slider-style]');
      const nameInput = document.querySelector('[data-fabric-slider-name]');
      const maxInput = document.querySelector('[data-fabric-slider-max]');
      const textTools = document.querySelector('[data-fabric-text-tools]');
      const fontSelect = document.querySelector('[data-fabric-font-family]');
      const textAlignSelect = document.querySelector('[data-fabric-text-align]');
      const imageControls = document.querySelector('[data-fabric-image-controls]');
      const layerList = document.querySelector('[data-fabric-layer-list]');
      const isValueObject = Boolean(active && isSliderObject(active));
      if (valueControls) valueControls.hidden = !isValueObject;
      const activeTextObjects = selectedTextObjects(editor.canvas);
      if (textTools) textTools.hidden = !activeTextObjects.length;
      if (imageControls) imageControls.hidden = !(active && (active.type === 'Image' || active.type === 'image'));
      if (layerList) {
        layerList.innerHTML = editor.canvas.getObjects().slice().reverse().filter(object => object.selectable !== false || object.cardRole === 'background-image').map((object, index) => {
          const id = object.id || object.name || `layer-${index}`;
          const activeClass = active === object ? ' is-active' : '';
          return `<button type="button" class="${activeClass}" data-fabric-layer-index="${editor.canvas.getObjects().indexOf(object)}">${escapeHtml(object.name || object.cardRole || object.type || id)}</button>`;
        }).join('');
      }
      if (isValueObject && valueInput) {
        const max = sliderMaxForPath(activePath, number(active.sliderConfig?.max, 5));
        const value = clamp(active.sliderConfig?.value ?? recordValue(book, activePath), 0, max);
        valueInput.max = String(max);
        valueInput.step = activePath === 'progress' ? '1' : '0.5';
        valueInput.value = String(value);
        if (valueOutput) valueOutput.textContent = activePath === 'progress' ? `${displayNumber(value)}%` : `${displayNumber(value)} of ${max}`;
        if (styleSelect) styleSelect.value = active.sliderConfig?.style || sliderStyleForPath(activePath);
        if (nameInput) {
          nameInput.value = active.sliderConfig?.name || FIELD_META[activePath]?.label || active.name || '';
          nameInput.disabled = Boolean(activePath && FIELD_META[activePath]);
        }
        if (maxInput) {
          maxInput.value = String(max);
          maxInput.disabled = activePath === 'progress';
        }
      }
      if (activeTextObjects.length) {
        const firstText = activeTextObjects[0];
        if (fontSelect) fontSelect.value = firstText.fontFamily || 'Libre Baskerville';
        if (textAlignSelect) textAlignSelect.value = firstText.textAlign || 'left';
      }
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
    editor.canvas.on('object:added', syncInspector);
    editor.canvas.on('object:removed', syncInspector);
    editor.canvas.on('object:modified', pushHistory);
    editor.canvas.on('object:added', pushHistory);
    editor.canvas.on('object:removed', pushHistory);
    editor.canvas.on('mouse:dblclick', () => {
      const active = getActive(editor.canvas);
      if (isTextObject(active)) active.enterEditing?.();
    });
    editor.canvas.on('object:moving', event => {
      if (!document.querySelector('[data-fabric-snapping]')?.checked) return;
      const object = event.target;
      const guide = 8, canvasWidth = editor.canvas.__designWidth || width, canvasHeight = editor.canvas.__designHeight || height;
      const rect = object.getBoundingRect?.() || { left: number(object.left, 0), top: number(object.top, 0), width: object.getScaledWidth?.() || object.width || 0, height: object.getScaledHeight?.() || object.height || 0 };
      let left = rect.left, top = rect.top;
      const centers = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (Math.abs(rect.left) < guide) left = 0;
      if (Math.abs(rect.top) < guide) top = 0;
      if (Math.abs((rect.left + rect.width) - canvasWidth) < guide) left = canvasWidth - rect.width;
      if (Math.abs((rect.top + rect.height) - canvasHeight) < guide) top = canvasHeight - rect.height;
      if (Math.abs(centers.x - canvasWidth / 2) < guide) left = (canvasWidth - rect.width) / 2;
      if (Math.abs(centers.y - canvasHeight / 2) < guide) top = (canvasHeight - rect.height) / 2;
      if (left !== rect.left || top !== rect.top) {
        if (object.setPositionByOrigin) object.setPositionByOrigin({ x: left, y: top }, 'left', 'top');
        else object.set({ left, top });
      }
    });
    const mobileToolbox = document.querySelector('.fabric-editor-sidebar');
    const mobileMore = document.querySelector('[data-fabric-mobile-more]');
    let mobileToolPointer = null;
    mobileToolbox?.addEventListener('pointerdown', event => {
      mobileToolPointer = { x: event.clientX, y: event.clientY, moved: false };
    }, true);
    mobileToolbox?.addEventListener('pointermove', event => {
      if (!mobileToolPointer) return;
      if (Math.abs(event.clientX - mobileToolPointer.x) > 10 || Math.abs(event.clientY - mobileToolPointer.y) > 10) mobileToolPointer.moved = true;
    }, true);
    mobileToolbox?.addEventListener('click', event => {
      if (!mobileToolPointer?.moved) return;
      if (!event.target.closest('button,a,label')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      mobileToolPointer = null;
    }, true);
    mobileMore?.addEventListener('click', event => {
      const button = event.currentTarget;
      const sidebar = button.closest('.fabric-editor-sidebar');
      const layout = button.closest('.fabric-editor-layout');
      const expanded = !sidebar?.classList.contains('is-expanded');
      sidebar?.classList.toggle('is-expanded', expanded);
      layout?.classList.toggle('is-tools-expanded', expanded);
      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = expanded ? 'Show fewer tools' : 'See more tools';
    });
    document.querySelectorAll('[data-fabric-card-preset]').forEach(button => {
      button.addEventListener('click', () => {
        if (!confirm('Replace this card layout with this starter look? Book details stay safe.')) return;
        editor.applyCardPreset(button.dataset.fabricCardPreset, book);
        pushHistory();
        syncInspector();
      });
    });
    document.querySelector('[data-fabric-add="shape"]')?.addEventListener('click', () => editor.addShapeBox());
    document.querySelector('[data-fabric-add="text"]')?.addEventListener('click', () => {
      editor.addEditableTextBox('Type something beautiful…', { fontFamily: document.querySelector('[data-fabric-new-font]')?.value || 'Libre Baskerville' });
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-add="progress-slider"]')?.addEventListener('click', () => editor.addProgressSlider(book));
    document.querySelectorAll('[data-fabric-text-preset]').forEach(button => {
      button.addEventListener('click', () => {
        editor.addTextPreset(button.dataset.fabricTextPreset);
        pushHistory();
        syncInspector();
      });
    });
    document.querySelectorAll('[data-fabric-element]').forEach(button => {
      button.addEventListener('click', () => {
        editor.addElement(button.dataset.fabricElement);
        pushHistory();
        syncInspector();
      });
    });
    document.querySelector('[data-fabric-add="custom-slider"]')?.addEventListener('click', () => {
      const name = prompt('What should this slider track?', 'Scare level');
      if (!name) return;
      const style = prompt('Slider style: bar, stars, hearts, fire, dots, or custom-icon', 'stars') || 'stars';
      const max = clamp(prompt('Maximum value?', '5'), 1, 100);
      const value = clamp(prompt('Current value?', '0'), 0, max);
      editor.addCustomSlider({ name, style: style.toLowerCase(), max, value });
      pushHistory();
      syncInspector();
    });
    document.querySelectorAll('[data-fabric-field]').forEach(button => {
      button.addEventListener('click', () => Promise.resolve(editor.addBoundField(button.dataset.fabricField, book, {
        width: Math.max(140, width * .4),
        fontSize: Math.max(18, width * .045),
        cardRole: ['rating', 'spice', 'impact'].includes(button.dataset.fabricField) ? 'rating' : 'metadata'
      })).then(() => {
        pushHistory();
        syncInspector();
      }));
    });
    document.querySelector('[data-fabric-upload]')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) editor.addImageFromFile(file).catch(error => adapters.showToast?.(error.message || 'Image upload failed.'));
    });
    document.querySelector('[data-fabric-asset-upload]')?.addEventListener('change', async event => {
      assetUploadFile = event.target.files?.[0] || null;
      setUploadFilename('asset', assetUploadFile);
      syncUploadButtons();
      if (!assetUploadFile) return setLibraryStatus('asset', '');
      try {
        setLibraryStatus('asset', 'Validating…');
        await globalThis.VisualAssets.validate(assetUploadFile);
        setLibraryStatus('asset', 'Ready to upload.');
      } catch (error) {
        logLibraryError('asset', 'validation-failed', error, { fileName: assetUploadFile?.name });
        assetUploadFile = null;
        event.target.value = '';
        setUploadFilename('asset', null);
        setLibraryStatus('asset', error.message || 'Element validation failed.');
      } finally {
        syncUploadButtons();
      }
    });
    document.querySelector('[data-fabric-asset-submit]')?.addEventListener('click', async event => {
      if (!assetUploadFile || assetUploading) return;
      const fileInput = document.querySelector('[data-fabric-asset-upload]');
      assetUploading = true;
      syncUploadButtons();
      try {
        const file = assetUploadFile;
        setLibraryStatus('asset', 'Validating…');
        await globalThis.VisualAssets.uploadAsset(file, {
          name: document.querySelector('[data-fabric-asset-name]')?.value || file.name,
          category: document.querySelector('[data-fabric-asset-category]')?.value || 'element',
          onStatus: message => setLibraryStatus('asset', message)
        });
        assetUploadFile = null;
        if (fileInput) fileInput.value = '';
        setUploadFilename('asset', null);
        try {
          await refreshLibraries();
          setLibraryStatus('asset', 'Upload complete.');
        } catch (refreshError) {
          logLibraryError('asset', 'refresh-after-upload-failed', refreshError);
          withRetryRefresh('asset', `Upload complete, but library refresh failed: ${refreshError.message}`);
        }
      } catch (error) {
        logLibraryError('asset', 'upload-failed', error, { fileName: assetUploadFile?.name });
        setLibraryStatus('asset', error.message || 'Element upload failed.');
      } finally {
        assetUploading = false;
        syncUploadButtons();
      }
    });
    document.querySelector('[data-fabric-font-upload]')?.addEventListener('change', async event => {
      fontUploadFile = event.target.files?.[0] || null;
      setUploadFilename('font', fontUploadFile);
      syncUploadButtons();
      if (!fontUploadFile) return setLibraryStatus('font', '');
      try {
        setLibraryStatus('font', 'Validating…');
        await globalThis.VisualFonts.validate(fontUploadFile);
        setLibraryStatus('font', document.querySelector('[data-fabric-font-license]')?.checked ? 'Ready to upload.' : 'Confirm the font license to enable upload.');
      } catch (error) {
        logLibraryError('font', 'validation-failed', error, { fileName: fontUploadFile?.name });
        fontUploadFile = null;
        event.target.value = '';
        setUploadFilename('font', null);
        setLibraryStatus('font', error.message || 'Font validation failed.');
      } finally {
        syncUploadButtons();
      }
    });
    document.querySelector('[data-fabric-font-license]')?.addEventListener('change', () => {
      syncUploadButtons();
      if (fontUploadFile) setLibraryStatus('font', document.querySelector('[data-fabric-font-license]')?.checked ? 'Ready to upload.' : 'Confirm the font license to enable upload.');
    });
    document.querySelector('[data-fabric-font-submit]')?.addEventListener('click', async () => {
      if (!fontUploadFile || fontUploading) return;
      const fileInput = document.querySelector('[data-fabric-font-upload]');
      fontUploading = true;
      syncUploadButtons();
      try {
        const file = fontUploadFile;
        setLibraryStatus('font', 'Validating…');
        const font = await globalThis.VisualFonts.uploadFont(file, {
          displayName: document.querySelector('[data-fabric-font-name]')?.value || file.name.replace(/\.[^.]+$/, ''),
          licenseConfirmed: document.querySelector('[data-fabric-font-license]')?.checked,
          onStatus: message => setLibraryStatus('font', message)
        });
        setLibraryStatus('font', 'Loading font…');
        await globalThis.VisualFonts.loadFont(font);
        fontUploadFile = null;
        if (fileInput) fileInput.value = '';
        setUploadFilename('font', null);
        const licenseBox = document.querySelector('[data-fabric-font-license]');
        if (licenseBox) licenseBox.checked = false;
        try {
          await refreshLibraries();
          setLibraryStatus('font', 'Upload complete.');
        } catch (refreshError) {
          logLibraryError('font', 'refresh-after-upload-failed', refreshError);
          withRetryRefresh('font', `Upload complete, but library refresh failed: ${refreshError.message}`);
        }
      } catch (error) {
        logLibraryError('font', 'upload-failed', error, { fileName: fontUploadFile?.name });
        setLibraryStatus('font', error.message || 'Font upload failed.');
      } finally {
        fontUploading = false;
        syncUploadButtons();
      }
    });
    document.querySelector('[data-fabric-asset-search]')?.addEventListener('input', renderAssetLibrary);
    document.querySelector('[data-fabric-asset-filter]')?.addEventListener('change', renderAssetLibrary);
    document.querySelector('[data-fabric-slider-icon]')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      editor.applySliderIconFromFile(file)
        .then(() => { pushHistory(); syncInspector(); adapters.showToast?.('Slider icon attached.'); })
        .catch(error => adapters.showToast?.(error.message || 'Slider icon failed.'));
    });
    document.querySelector('[data-fabric-delete]')?.addEventListener('click', () => editor.deleteActiveElement());
    document.querySelector('[data-fabric-zoom]')?.addEventListener('input', event => {
      editor.canvas.setZoom(number(event.target.value, 100) / 100);
      editor.canvas.requestRenderAll();
    });
    document.querySelector('[data-fabric-fill]')?.addEventListener('input', event => {
      editor.applySmartColor(event.target.value);
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-text]')?.addEventListener('input', event => {
      applyToSelectedText(editor.canvas, object => object.set('fill', event.target.value));
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-card-bg]')?.addEventListener('input', event => {
      editor.setCardBackgroundColor(event.target.value);
      pushHistory();
    });
    document.querySelector('[data-fabric-share-formatting]')?.addEventListener('click', () => {
      if (!confirm('Use this canvas layout for every book card? Each book keeps its own title, ratings, cover, and details.')) return;
      const shared = adapters.shareFormatting?.(serializeCanvas(editor.canvas), { width, height, name: 'Shared Canvas Book Card', sourceTemplate: template });
      adapters.showToast?.(shared ? 'Formatting shared across book cards.' : 'Could not share formatting.');
    });
    document.querySelector('[data-fabric-stroke]')?.addEventListener('input', event => { editor.updateActiveObject({ stroke: event.target.value }); pushHistory(); });
    document.querySelector('[data-fabric-color-wheel]')?.addEventListener('input', event => {
      editor.applySmartColor(event.target.value);
      pushHistory();
      syncInspector();
    });
    document.querySelectorAll('[data-fabric-color-swatch]').forEach(button => {
      button.addEventListener('click', () => {
        editor.applySmartColor(button.dataset.fabricColorSwatch);
        pushHistory();
        syncInspector();
      });
    });
    document.querySelectorAll('[data-fabric-image-fit]').forEach(button => {
      button.addEventListener('click', () => {
        editor.setImageCropMode(button.dataset.fabricImageFit);
        pushHistory();
        syncInspector();
      });
    });
    document.querySelectorAll('[data-fabric-image-crop]').forEach(input => {
      input.addEventListener('input', event => {
        editor.cropActiveImage({ [event.target.dataset.fabricImageCrop]: number(event.target.value, 0) });
        pushHistory();
        syncInspector();
      });
    });
    document.querySelector('[data-fabric-layer-list]')?.addEventListener('click', event => {
      const button = event.target.closest?.('[data-fabric-layer-index]');
      if (!button) return;
      const object = editor.canvas.getObjects()[number(button.dataset.fabricLayerIndex, -1)];
      if (!object || object.selectable === false) return;
      editor.canvas.setActiveObject(object);
      editor.canvas.requestRenderAll();
      syncInspector();
    });
    document.querySelector('[data-fabric-shadow]')?.addEventListener('change', event => { editor.updateActiveObject({ shadow: event.target.checked ? '0 18px 42px rgba(0,0,0,.38)' : null }); pushHistory(); });
    document.querySelector('[data-fabric-value]')?.addEventListener('input', event => {
      const active = getActive(editor.canvas);
      if (!isSliderObject(active)) return;
      const path = bindingPath(active);
      const value = number(event.target.value, 0);
      updateSliderObject(active, value, { style: document.querySelector('[data-fabric-slider-style]')?.value });
      if (path) setBookValue(book, path, value);
      editor.canvas.requestRenderAll();
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-slider-style]')?.addEventListener('change', event => {
      const active = getActive(editor.canvas);
      if (!isSliderObject(active)) return;
      updateSliderObject(active, active.sliderConfig?.value ?? recordValue(book, bindingPath(active)), { style: event.target.value });
      editor.canvas.requestRenderAll();
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-slider-max]')?.addEventListener('input', event => {
      const active = getActive(editor.canvas);
      if (!isSliderObject(active)) return;
      const max = clamp(event.target.value, 1, 100);
      const value = clamp(active.sliderConfig?.value ?? 0, 0, max);
      updateSliderObject(active, value, { max, style: document.querySelector('[data-fabric-slider-style]')?.value });
      editor.canvas.requestRenderAll();
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-slider-name]')?.addEventListener('input', event => {
      const active = getActive(editor.canvas);
      if (!isSliderObject(active)) return;
      updateSliderObject(active, active.sliderConfig?.value ?? 0, { name: event.target.value, style: document.querySelector('[data-fabric-slider-style]')?.value });
      editor.canvas.requestRenderAll();
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-font-family]')?.addEventListener('change', async event => {
      if (!selectedTextObjects(editor.canvas).length) return;
      const custom = userFonts.find(font => font.family_name === event.target.value);
      if (custom) { try { await applyCustomFont(custom); } catch (error) { setLibraryStatus('font', error.message); } return; }
      applyToSelectedText(editor.canvas, object => object.set('fontFamily', event.target.value));
      pushHistory();
      syncInspector();
    });
    document.querySelector('[data-fabric-text-align]')?.addEventListener('change', event => {
      if (!selectedTextObjects(editor.canvas).length) return;
      applyToSelectedText(editor.canvas, object => object.set('textAlign', event.target.value));
      pushHistory();
      syncInspector();
    });
    document.querySelectorAll('[data-fabric-text-effect]').forEach(button => {
      button.addEventListener('click', () => {
        editor.applyTextEffect(button.dataset.fabricTextEffect);
        pushHistory();
        syncInspector();
      });
    });
    document.querySelectorAll('[data-fabric-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.fabricAction;
        const active = getActive(editor.canvas);
        if (action === 'duplicate') editor.cloneActiveElement();
        if (action === 'lock') editor.toggleLockActive();
        if (action === 'copy-style') copiedStyle = editor.styleSnapshot(active);
        if (action === 'paste-style') editor.pasteStyle(copiedStyle);
        if (action === 'group') editor.groupSelection();
        if (action === 'ungroup') editor.ungroupSelection();
        if (action === 'flip-x') {
          if (active) editor.updateActiveObject({ flipX: !active.flipX });
        }
        if (action === 'flip-y') {
          if (active) editor.updateActiveObject({ flipY: !active.flipY });
        }
        if (action === 'image-background') editor.setActiveImageAsBackground();
        if (action === 'front') editor.moveLayer('front');
        if (action === 'back') editor.moveLayer('back');
        if (action === 'forward') editor.moveLayer('forward');
        if (action === 'backward') editor.moveLayer('backward');
        pushHistory();
        syncInspector();
      });
    });
    document.querySelectorAll('[data-fabric-appearance]').forEach(button => button.addEventListener('click', () => { editor.applyAppearancePreset(button.dataset.fabricAppearance); pushHistory(); syncInspector(); }));
    document.querySelectorAll('[data-fabric-align]').forEach(button => button.addEventListener('click', () => { editor.alignActiveObjects(button.dataset.fabricAlign); pushHistory(); syncInspector(); }));
    document.querySelectorAll('[data-fabric-distribute]').forEach(button => button.addEventListener('click', () => { editor.distributeActiveObjects(button.dataset.fabricDistribute); pushHistory(); syncInspector(); }));
    document.querySelectorAll('[data-fabric-prop]').forEach(input => {
      input.addEventListener('input', event => {
        const prop = event.target.dataset.fabricProp;
        const raw = number(event.target.value, 0);
        if (prop === 'opacity') editor.updateActiveObject({ opacity: raw / 100 });
        else if (prop === 'cornerRadius') editor.updateActiveObject({ rx: raw, ry: raw });
        else editor.updateActiveObject({ [prop]: raw });
        pushHistory();
        syncInspector();
      });
    });
    let copiedObject = null, copiedStyle = null;
    const saveEditor = () => {
      const saved = adapters.save?.(serializeCanvas(editor.canvas), { width, height, name: title, sourceTemplate: template });
      adapters.showToast?.(saved ? 'Canvas card saved.' : 'Canvas card could not be saved.');
      adapters.renderAll?.();
      closeEditor();
    };
    const closeEditor = () => {
      document.removeEventListener('keydown', keyHandler, true);
      window.removeEventListener?.('resize', fitCanvasToWorkspace);
      adapters.closeModal?.();
    };
    const keyHandler = event => {
      const active = getActive(editor.canvas);
      const key = event.key;
      const targetTag = event.target?.tagName;
      const isTypingControl = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag);
      if (isTypingControl || active?.isEditing) return;
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 's') {
        event.preventDefault();
        saveEditor();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'z') {
        event.preventDefault();
        restoreHistory(historyIndex + (event.shiftKey ? 1 : -1));
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'y') {
        event.preventDefault();
        restoreHistory(historyIndex + 1);
        return;
      }
      if (!active && !((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'a')) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        editor.deleteActiveElement();
      }
      if (key === 'Escape') {
        event.preventDefault();
        editor.canvas.discardActiveObject();
        editor.canvas.requestRenderAll();
      }
      if (key === 'Enter' && isTextObject(active)) {
        event.preventDefault();
        active.enterEditing?.();
        active.selectAll?.();
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'a') {
        event.preventDefault();
        const objects = editor.canvas.getObjects().filter(object => object.selectable !== false);
        if (objects.length) {
          const fabric = requireFabric();
          const selection = new fabric.ActiveSelection(objects, { canvas: editor.canvas });
          editor.canvas.setActiveObject(selection);
          editor.canvas.requestRenderAll();
        }
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'd') {
        event.preventDefault();
        editor.cloneActiveElement();
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'g') {
        event.preventDefault();
        if (event.shiftKey) editor.ungroupSelection();
        else editor.groupSelection();
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'c') {
        event.preventDefault();
        if (event.shiftKey) {
          copiedStyle = editor.styleSnapshot(active);
          return;
        }
        active?.clone?.(SERIALIZE_PROPS).then(clone => { copiedObject = clone; });
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'v' && (copiedObject || (event.shiftKey && copiedStyle))) {
        event.preventDefault();
        if (event.shiftKey && copiedStyle) {
          editor.pasteStyle(copiedStyle);
          return;
        }
        copiedObject.clone(SERIALIZE_PROPS).then(clone => {
          clone.set({ left: number(clone.left, 0) + 18, top: number(clone.top, 0) + 18, evented: true });
          editor.canvas.add(clone);
          editor.canvas.setActiveObject(clone);
          editor.canvas.requestRenderAll();
          copiedObject = clone;
        });
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        if (key === 'ArrowLeft') editor.nudgeActiveObjects(-amount, 0);
        if (key === 'ArrowRight') editor.nudgeActiveObjects(amount, 0);
        if (key === 'ArrowUp') editor.nudgeActiveObjects(0, -amount);
        if (key === 'ArrowDown') editor.nudgeActiveObjects(0, amount);
      }
      if (key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        editor.rotateActiveObjects(event.shiftKey ? -15 : 15);
      }
      if (key === ']') {
        event.preventDefault();
        editor.moveLayer(event.shiftKey ? 'front' : 'forward');
      }
      if (key === '[') {
        event.preventDefault();
        editor.moveLayer(event.shiftKey ? 'back' : 'backward');
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'l') {
        event.preventDefault();
        editor.toggleLockActive();
      }
      if (key.toLowerCase() === 'h' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        editor.updateActiveObject({ flipX: !active.flipX });
      }
      if (key.toLowerCase() === 'v' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        editor.updateActiveObject({ flipY: !active.flipY });
      }
    };
    document.addEventListener('keydown', keyHandler, true);
    window.addEventListener?.('resize', fitCanvasToWorkspace);
    undoButton?.addEventListener('click', () => restoreHistory(historyIndex - 1));
    redoButton?.addEventListener('click', () => restoreHistory(historyIndex + 1));
    document.querySelector('[data-fabric-close]')?.addEventListener('click', closeEditor);
    document.querySelector('[data-fabric-save]')?.addEventListener('click', saveEditor);
    setTimeout(syncInspector, 0);
    refreshLibraries().catch(error => {
      setLibraryStatus('asset', error.message || 'Reusable elements are temporarily unavailable.');
      setLibraryStatus('font', error.message || 'Custom fonts are temporarily unavailable.');
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
    addBoundField,
    addBoundImage,
    addProgressSlider,
    addCustomSlider,
    addTextPreset,
    addElement,
    alignActiveObjects,
    nudgeActiveObjects,
    rotateActiveObjects,
    distributeActiveObjects,
    moveLayer,
    toggleLockActive,
    cloneActiveElement,
    groupSelection,
    ungroupSelection,
    styleSnapshot,
    pasteStyle,
    applyAppearancePreset,
    applyTextEffect,
    applySmartColor,
    setCardBackgroundColor,
    setImageCropMode,
    cropActiveImage,
    setActiveImageAsBackground,
    applyCardPreset,
    updateActiveObject,
    applySliderIconFromFile,
    addImageFromFile,
    addLibraryAsset,
    resolveLibraryReferences,
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
