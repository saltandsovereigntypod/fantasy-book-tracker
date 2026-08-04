(() => {
  'use strict';

  const VERSION = '20260804-1';
  const renderMeta = new Map();
  let editorCover = null;

  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value, min)));
  const clone = value => JSON.parse(JSON.stringify(value));
  const valueAt = (source, path) => String(path || '').split('.').reduce((value, key) => value?.[key], source);

  function recordValue(record = {}, path = '') {
    if (path === 'coverUrl') return record.coverUrl || record.coverImage || record.cover || record.image || '';
    if (path === 'progress') return record.progress ?? record.readingProgress ?? record.percentComplete ?? 0;
    if (path === 'rating') return record.ratings?.overall ?? record.ratings?.rating ?? record.rating ?? 0;
    if (path === 'spice') return record.ratings?.spice ?? record.spice ?? 0;
    if (path === 'impact') return record.ratings?.impact ?? record.impact ?? 0;
    if (path === 'reaction') return record.ratings?.reaction ?? record.reaction ?? '';
    return valueAt(record, path) ?? '';
  }

  function ratingText(path, value) {
    const numeric = clamp(value, 0, 5), full = Math.floor(numeric), half = numeric - full >= .5 && full < 5;
    const label = path === 'spice' ? 'Spice' : path === 'impact' ? 'Emotional impact' : 'Overall rating';
    const fullGlyph = path === 'spice' ? '🔥' : path === 'impact' ? '♥' : '★';
    const emptyGlyph = path === 'spice' ? '·' : path === 'impact' ? '♡' : '☆';
    const glyphs = `${fullGlyph.repeat(full)}${half ? '½' : ''}${emptyGlyph.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}`;
    return `${label}\n${glyphs}\n${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)} of 5`;
  }

  function statusLabel(value) {
    const status = String(value || 'want').toLowerCase();
    return ({ reading: 'Currently reading', completed: 'Completed', want: 'Want to read', paused: 'Paused', dnf: 'DNF' })[status] || status;
  }

  function sanitizeScene(source, record = {}) {
    const scene = clone(source || {});
    const removableIds = new Set(['future-actions-zone', 'future-actions-note', 'actions', 'rating-label', 'spice-label', 'impact-label']);
    const coverUrl = String(recordValue(record, 'coverUrl') || '');
    let cover = null;

    const cleanObjects = objects => (Array.isArray(objects) ? objects : []).flatMap(object => {
      if (!object || removableIds.has(object.id) || ['actions', 'action-button'].includes(object.cardRole) || ['future-actions', 'book-actions'].includes(object.semanticGroup)) return [];
      if (Array.isArray(object.objects)) object.objects = cleanObjects(object.objects);
      const path = object.dataBinding?.path || object.sliderConfig?.path || '';
      const type = String(object.type || '').toLowerCase();

      if (path === 'coverUrl' || object.id === 'cover') {
        if (coverUrl && (type === 'image' || object.src || object.dataBinding?.path === 'coverUrl')) {
          cover ||= { src: coverUrl, left: number(object.left, 22), top: number(object.top, 22), width: number(object.width, 108) * number(object.scaleX, 1), height: number(object.height, 162) * number(object.scaleY, 1), angle: number(object.angle, 0) };
          return [{ type: 'Rect', id: `${object.id || 'cover'}-safe-placeholder`, name: 'Cover placeholder', cardRole: 'cover', left: number(object.left, 22), top: number(object.top, 22), width: number(object.width, 108), height: number(object.height, 162), scaleX: number(object.scaleX, 1), scaleY: number(object.scaleY, 1), angle: number(object.angle, 0), fill: 'rgba(255,255,255,.025)', stroke: 'rgba(255,255,255,.14)', strokeWidth: 1, rx: 10, ry: 10, selectable: object.selectable !== false, evented: object.evented !== false }];
        }
      }

      if (path === 'status' && 'text' in object) object.text = statusLabel(recordValue(record, path));
      if (path === 'reaction' && 'text' in object) {
        const reaction = String(recordValue(record, path) || '');
        object.text = reaction === 'Not rated' ? '' : reaction;
      }
      if (['rating', 'spice', 'impact'].includes(path) && 'text' in object) object.text = ratingText(path, recordValue(record, path));
      if (path === 'progress' && 'text' in object) object.text = `${Math.round(clamp(recordValue(record, path), 0, 100))}%`;
      return [object];
    });

    scene.objects = cleanObjects(scene.objects);
    const objects = scene.objects || [];
    const track = objects.find(object => object.id === 'progress-track' || (object.sliderConfig?.path === 'progress' && object.sliderConfig?.role === 'track'));
    const fill = objects.find(object => object.id === 'progress-fill' || (object.sliderConfig?.path === 'progress' && object.sliderConfig?.role === 'fill'));
    const progress = clamp(recordValue(record, 'progress'), 0, 100);
    if (fill) {
      const trackWidth = number(fill.sliderConfig?.trackWidth, number(track?.width, number(fill.width, 248)));
      fill.sliderConfig = { ...(fill.sliderConfig || {}), path: 'progress', role: 'fill', max: 100, trackWidth };
      fill.width = trackWidth * progress / 100;
      fill.scaleX = 1;
    }
    if (track) track.sliderConfig = { ...(track.sliderConfig || {}), path: 'progress', role: 'track', max: 100, trackWidth: number(track.width, 248) };
    scene.__repairCover = cover;
    scene.__repairVersion = VERSION;
    return scene;
  }

  function scaleScene(source, factor) {
    if (factor <= 1) return clone(source);
    const scene = clone(source);
    const geometric = ['left', 'top', 'width', 'height', 'fontSize', 'strokeWidth', 'rx', 'ry', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'];
    const visit = object => {
      geometric.forEach(key => { if (Number.isFinite(Number(object?.[key]))) object[key] = Number(object[key]) * factor; });
      if (object?.sliderConfig?.trackWidth) object.sliderConfig.trackWidth *= factor;
      if (Array.isArray(object?.strokeDashArray)) object.strokeDashArray = object.strokeDashArray.map(value => number(value) * factor);
      (object?.objects || []).forEach(visit);
    };
    (scene.objects || []).forEach(visit);
    scene.width = number(scene.width, 420) * factor;
    scene.height = number(scene.height, 380) * factor;
    if (scene.__repairCover) {
      ['left', 'top', 'width', 'height'].forEach(key => scene.__repairCover[key] *= factor);
    }
    return scene;
  }

  function addCoverOverlay(viewport, cover, designWidth, designHeight, editor = false) {
    if (!viewport || !cover?.src) return;
    viewport.querySelectorAll(editor ? '.fabric-editor-cover-overlay' : '.fabric-cover-overlay').forEach(node => node.remove());
    const image = document.createElement('img');
    image.className = editor ? 'fabric-editor-cover-overlay' : 'fabric-cover-overlay';
    image.alt = '';
    image.src = cover.src;
    image.style.left = `${cover.left / designWidth * 100}%`;
    image.style.top = `${cover.top / designHeight * 100}%`;
    image.style.width = `${cover.width / designWidth * 100}%`;
    image.style.height = `${cover.height / designHeight * 100}%`;
    image.style.transform = `rotate(${number(cover.angle, 0)}deg)`;
    image.style.transformOrigin = 'center';
    image.onerror = () => image.remove();
    viewport.appendChild(image);
  }

  function installCanvasRepairs() {
    const api = globalThis.CanvasEditor;
    if (!api || api.__uiRepairInstalled) return false;
    const originalResolve = api.resolveBookCardScene?.bind(api);
    const originalRegister = api.registerRenderScene?.bind(api);
    const originalRender = api.renderSavedCanvas?.bind(api);
    const originalOpen = api.openBookCardEditor?.bind(api);

    if (originalResolve) {
      api.resolveBookCardScene = (record = {}, template = {}, preferences = {}, options = {}) => sanitizeScene(originalResolve(record, template, preferences, options), record);
      api.resolveCardScene = (template = {}, record = {}, options = {}) => api.resolveBookCardScene(record, template, options.visible || {}, options);
    }

    if (originalRegister) {
      api.registerRenderScene = (scene, meta = {}) => {
        const factor = Math.max(2, Math.min(3, Math.ceil(globalThis.devicePixelRatio || 1)));
        const clean = sanitizeScene(scene, meta.record || {});
        const scaled = scaleScene(clean, factor);
        const key = originalRegister(scaled, meta);
        renderMeta.set(key, { factor, cover: scaled.__repairCover || null, width: number(scaled.width, 420), height: number(scaled.height, 380) });
        return key;
      };
    }

    if (originalRender) {
      api.renderSavedCanvas = async (element, options = {}) => {
        const key = element?.dataset?.fabricSceneKey;
        const meta = key ? renderMeta.get(key) : null;
        const originalWidth = element?.dataset?.designWidth;
        const originalHeight = element?.dataset?.designHeight;
        if (meta && element) {
          element.dataset.designWidth = String(meta.width);
          element.dataset.designHeight = String(meta.height);
        }
        try { await originalRender(element, options); }
        finally {
          if (element) {
            if (originalWidth != null) element.dataset.designWidth = originalWidth;
            if (originalHeight != null) element.dataset.designHeight = originalHeight;
            const viewport = element.closest('.fabric-card-viewport');
            if (meta?.cover && viewport) addCoverOverlay(viewport, meta.cover, meta.width, meta.height, false);
          }
        }
      };
    }

    if (originalOpen) {
      api.openBookCardEditor = (book, adapters = {}) => {
        const template = adapters.template || {};
        const scene = template.fabricCanvasJson || template.canvasJson || template.fabricJson || template.canvas?.fabricJson;
        const clean = scene ? sanitizeScene(scene, book) : scene;
        editorCover = clean?.__repairCover || null;
        const result = originalOpen(book, clean ? { ...adapters, template: { ...template, fabricCanvasJson: clean } } : adapters);
        setTimeout(injectEditorCover, 50);
        return result;
      };
    }

    Object.defineProperty(api, '__uiRepairInstalled', { value: true });
    return true;
  }

  function injectEditorCover() {
    const frame = document.querySelector('.fabric-canvas-frame');
    const canvas = frame?.querySelector('canvas');
    if (!frame || !canvas || !editorCover) return;
    frame.style.position = 'relative';
    const width = number(canvas.width || canvas.dataset.designWidth, 420);
    const height = number(canvas.height || canvas.dataset.designHeight, 380);
    addCoverOverlay(frame, editorCover, width, height, true);
  }

  function ensureModalClose() {
    document.querySelectorAll('.modal-backdrop[aria-hidden="false"] .modal').forEach(modal => {
      if (modal.querySelector(':scope > .modal-close, :scope > .ui-repair-close')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-repair-close';
      button.setAttribute('aria-label', 'Close');
      button.textContent = '×';
      button.addEventListener('click', () => {
        if (typeof globalThis.closeModal === 'function') globalThis.closeModal();
        else {
          const backdrop = modal.closest('.modal-backdrop');
          backdrop?.setAttribute('aria-hidden', 'true');
          backdrop?.classList.remove('is-visible', 'active', 'open');
        }
      });
      modal.prepend(button);
    });
  }

  function addTrailingBookTile() {
    document.querySelectorAll('.book-collection').forEach(collection => {
      if (collection.querySelector('[data-ui-repair-add-book]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'book-add-tail';
      button.dataset.uiRepairAddBook = 'true';
      button.innerHTML = '<div><span aria-hidden="true">＋</span><strong>Add another book</strong><small>Create a new library entry</small></div>';
      button.addEventListener('click', () => {
        if (typeof globalThis.openBookForm === 'function') globalThis.openBookForm();
        else document.querySelector('[data-action="add-book"],#addBookBtn,.library-add-book')?.click();
      });
      collection.appendChild(button);
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const visible = document.querySelector('.modal-backdrop[aria-hidden="false"]');
    if (!visible) return;
    if (typeof globalThis.closeModal === 'function') globalThis.closeModal();
    else visible.setAttribute('aria-hidden', 'true');
  });

  const timer = setInterval(() => { if (installCanvasRepairs()) clearInterval(timer); }, 25);
  setTimeout(() => clearInterval(timer), 20000);
  const observer = new MutationObserver(() => {
    ensureModalClose();
    addTrailingBookTile();
    injectEditorCover();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { ensureModalClose(); addTrailingBookTile(); });
  else { ensureModalClose(); addTrailingBookTile(); }

  globalThis.UiRepair = { VERSION, sanitizeScene };
})();
