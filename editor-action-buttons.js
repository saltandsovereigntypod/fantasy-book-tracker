(() => {
  'use strict';

  const VERSION = '20260804-2';
  const ACTIONS = {
    reading: { label: 'Reading', fill: '#5b2f1d', appAction: 'start-reading' },
    complete: { label: 'Complete', fill: '#70401f', appAction: 'complete-book' },
    edit: { label: 'Edit', fill: '#3b2116', appAction: 'edit-book' },
    design: { label: 'Design', fill: '#8a4d28', appAction: '' }
  };

  const canvasRegistry = new Map();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fabricApi = () => globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric;

  function patchFabricCanvas() {
    const fabric = fabricApi();
    if (!fabric?.Canvas || fabric.Canvas.__actionTrackingPatched) return;
    const OriginalCanvas = fabric.Canvas;
    class TrackingCanvas extends OriginalCanvas {
      constructor(element, options) {
        super(element, options);
        const lower = this.lowerCanvasEl || (typeof element === 'string' ? document.getElementById(element) : element);
        if (lower) canvasRegistry.set(lower, this);
        this.on('selection:created', renderInspector);
        this.on('selection:updated', renderInspector);
        this.on('selection:cleared', renderInspector);
        this.on('object:modified', renderInspector);
      }
      dispose() {
        const lower = this.lowerCanvasEl;
        if (lower) canvasRegistry.delete(lower);
        return super.dispose();
      }
    }
    Object.setPrototypeOf(TrackingCanvas, OriginalCanvas);
    Object.defineProperty(TrackingCanvas, '__actionTrackingPatched', { value: true });
    fabric.Canvas = TrackingCanvas;
  }

  function activeCanvas() {
    const element = document.querySelector('.fabric-canvas-workspace canvas');
    if (!element) return null;
    return canvasRegistry.get(element) || [...canvasRegistry.values()].find(canvas => canvas.lowerCanvasEl === element || canvas.upperCanvasEl === element) || null;
  }

  function activeButton() {
    const object = activeCanvas()?.getActiveObject?.();
    return object?.cardRole === 'action-button' && ACTIONS[object.actionId] ? object : null;
  }

  function children(group) {
    const items = group?.getObjects?.() || group?._objects || group?.objects || [];
    return {
      rect: items.find(item => String(item?.type || '').toLowerCase() === 'rect') || items[0],
      text: items.find(item => ['textbox', 'text', 'i-text'].includes(String(item?.type || '').toLowerCase())) || items[1]
    };
  }

  function colors() {
    const styles = getComputedStyle(document.documentElement);
    const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    return { text: read('--ui-text', read('--text', '#f7ead2')), border: read('--ui-border', read('--border', '#7d4a2b')) };
  }

  function addButton(actionId) {
    const definition = ACTIONS[actionId];
    const canvas = activeCanvas();
    const fabric = fabricApi();
    if (!definition || !canvas || !fabric?.Group) return false;
    const theme = colors(), width = 96, height = 38;
    const offset = canvas.getObjects().filter(object => object.cardRole === 'action-button').length * 12;
    const left = Math.min((canvas.__designWidth || canvas.getWidth()) - width - 16, 22 + offset);
    const top = Math.min((canvas.__designHeight || canvas.getHeight()) - height - 16, 326);
    const rect = new fabric.Rect({ left: 0, top: 0, width, height, rx: 10, ry: 10, fill: definition.fill, stroke: theme.border, strokeWidth: 1, originX: 'left', originY: 'top' });
    const text = new fabric.Textbox(definition.label, { left: 8, top: 11, width: width - 16, height: 16, fontFamily: 'Inter', fontSize: 11, fontWeight: '700', textAlign: 'center', fill: theme.text, originX: 'left', originY: 'top', selectable: false, evented: false });
    const group = new fabric.Group([rect, text], { id: `action-${actionId}-${Date.now().toString(36)}`, name: `${definition.label} button`, cardRole: 'action-button', semanticGroup: 'book-actions', actionId, left, top, width, height, originX: 'left', originY: 'top', selectable: true, evented: true, transparentCorners: false, cornerStyle: 'circle' });
    canvas.add(group); canvas.setActiveObject(group); canvas.requestRenderAll(); canvas.fire('object:modified', { target: group }); renderInspector();
    return true;
  }

  function injectPalette() {
    const panel = document.querySelector('#fabric-panel-elements');
    if (!panel || panel.querySelector('[data-independent-card-actions]')) return;
    const coreGrid = panel.querySelector('.fabric-compact-grid');
    const section = document.createElement('div');
    section.dataset.independentCardActions = 'true';
    section.innerHTML = `<h4>Book action buttons</h4><div class="fabric-compact-grid"><button type="button" data-add-book-action="reading">Reading button</button><button type="button" data-add-book-action="complete">Complete button</button><button type="button" data-add-book-action="edit">Edit button</button><button type="button" data-add-book-action="design">Design button</button></div>`;
    (coreGrid?.parentElement || panel).insertBefore(section, coreGrid?.nextSibling || null);
    section.querySelectorAll('[data-add-book-action]').forEach(button => button.addEventListener('click', () => addButton(button.dataset.addBookAction)));
  }

  function injectInspector() {
    const inspector = document.querySelector('.fabric-editor-inspector');
    if (!inspector || inspector.querySelector('[data-action-button-inspector]')) return;
    const section = document.createElement('section');
    section.className = 'fabric-inspector-section';
    section.dataset.actionButtonInspector = 'true';
    section.hidden = true;
    section.innerHTML = `<h3>Button design</h3><label>Label <input type="text" data-action-label></label><label>Fill <input type="color" data-action-fill></label><label>Text <input type="color" data-action-text></label><label>Border <input type="color" data-action-border></label><label>Border width <input type="number" min="0" max="12" step="1" data-action-border-width></label><label>Corner radius <input type="number" min="0" max="80" step="1" data-action-radius></label><label>Font size <input type="number" min="6" max="72" step="1" data-action-font-size></label><label>Font family <select data-action-font-family><option>Inter</option><option>Libre Baskerville</option><option>Georgia</option><option>Arial</option><option>Trebuchet MS</option><option>Impact</option></select></label><label>Opacity <input type="range" min="0.1" max="1" step="0.05" data-action-opacity></label><small>The action type stays fixed even when the label and design change.</small>`;
    inspector.insertBefore(section, inspector.children[1] || null);
    section.querySelectorAll('input,select').forEach(input => input.addEventListener('input', updateFromInspector));
    renderInspector();
  }

  function renderInspector() {
    const section = document.querySelector('[data-action-button-inspector]');
    if (!section) return;
    const button = activeButton();
    section.hidden = !button;
    if (!button) return;
    const { rect, text } = children(button);
    section.querySelector('[data-action-label]').value = text?.text || ACTIONS[button.actionId].label;
    section.querySelector('[data-action-fill]').value = typeof rect?.fill === 'string' && rect.fill.startsWith('#') ? rect.fill : ACTIONS[button.actionId].fill;
    section.querySelector('[data-action-text]').value = typeof text?.fill === 'string' && text.fill.startsWith('#') ? text.fill : '#f7ead2';
    section.querySelector('[data-action-border]').value = typeof rect?.stroke === 'string' && rect.stroke.startsWith('#') ? rect.stroke : '#7d4a2b';
    section.querySelector('[data-action-border-width]').value = number(rect?.strokeWidth, 1);
    section.querySelector('[data-action-radius]').value = number(rect?.rx, 10);
    section.querySelector('[data-action-font-size]').value = number(text?.fontSize, 11);
    section.querySelector('[data-action-font-family]').value = text?.fontFamily || 'Inter';
    section.querySelector('[data-action-opacity]').value = number(button.opacity, 1);
  }

  function updateFromInspector() {
    const section = document.querySelector('[data-action-button-inspector]'), button = activeButton(), canvas = activeCanvas();
    if (!section || !button || !canvas) return;
    const { rect, text } = children(button);
    if (rect) rect.set({ fill: section.querySelector('[data-action-fill]').value, stroke: section.querySelector('[data-action-border]').value, strokeWidth: number(section.querySelector('[data-action-border-width]').value, 1), rx: number(section.querySelector('[data-action-radius]').value, 10), ry: number(section.querySelector('[data-action-radius]').value, 10) });
    if (text) text.set({ text: section.querySelector('[data-action-label]').value || ACTIONS[button.actionId].label, fill: section.querySelector('[data-action-text]').value, fontSize: number(section.querySelector('[data-action-font-size]').value, 11), fontFamily: section.querySelector('[data-action-font-family]').value });
    button.set({ opacity: number(section.querySelector('[data-action-opacity]').value, 1) });
    button.dirty = true; button.setCoords?.(); canvas.requestRenderAll(); canvas.fire('object:modified', { target: button });
  }

  function sceneButtons(scene) {
    const result = [];
    const visit = object => {
      if (!object || object.visible === false) return;
      if (object.cardRole === 'action-button' && ACTIONS[object.actionId]) result.push(object);
      (object.objects || []).forEach(visit);
    };
    (scene?.objects || []).forEach(visit);
    return result;
  }

  function overlayHtml(scene, record = {}, canvas = {}) {
    const buttons = sceneButtons(scene);
    if (!buttons.length) return '';
    const designWidth = number(canvas.width || scene.width, 420), designHeight = number(canvas.height || scene.height, 380);
    return buttons.map(object => {
      const { rect, text } = children(object), definition = ACTIONS[object.actionId];
      const width = number(object.width, 96) * number(object.scaleX, 1), height = number(object.height, 38) * number(object.scaleY, 1);
      const style = `position:absolute;left:${number(object.left) / designWidth * 100}%;top:${number(object.top) / designHeight * 100}%;width:${width / designWidth * 100}%;height:${height / designHeight * 100}%;background:${rect?.fill || definition.fill};color:${text?.fill || '#f7ead2'};border:${number(rect?.strokeWidth, 1)}px solid ${rect?.stroke || '#7d4a2b'};border-radius:${number(rect?.rx, 10)}px;font-family:${text?.fontFamily || 'Inter'};font-size:${number(text?.fontSize, 11)}px;font-weight:${text?.fontWeight || 700};opacity:${number(object.opacity, 1)};transform:rotate(${number(object.angle, 0)}deg);transform-origin:center;display:flex;align-items:center;justify-content:center;padding:2px 6px;pointer-events:auto;z-index:3;`;
      const id = escapeHtml(record.id || '');
      return object.actionId === 'design'
        ? `<button type="button" data-card-design-action data-id="${id}" style="${escapeHtml(style)}">${escapeHtml(text?.text || definition.label)}</button>`
        : `<button type="button" data-action="${definition.appAction}" data-id="${id}" style="${escapeHtml(style)}">${escapeHtml(text?.text || definition.label)}</button>`;
    }).join('');
  }

  function installOverlayHook() {
    const install = () => {
      const api = globalThis.CanvasEditor;
      if (!api || api.__editableActionOverlayInstalled) return false;
      const original = api.actionOverlayHtml?.bind(api);
      api.actionOverlayHtml = (scene, record, canvas) => {
        const custom = overlayHtml(scene, record, canvas);
        return custom || original?.(scene, record, canvas) || '';
      };
      Object.defineProperty(api, '__editableActionOverlayInstalled', { value: true });
      return true;
    };
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 25);
    setTimeout(() => clearInterval(timer), 15000);
  }

  document.addEventListener('click', event => {
    const design = event.target.closest?.('[data-card-design-action]');
    if (design) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      globalThis.VisualBuilder?.openForBook?.(design.dataset.id);
      return;
    }
    const save = event.target.closest?.('#saveBook');
    if (!save) return;
    let snapshot = null;
    try { snapshot = new Map(state.books.map(book => [book.id, { updatedAt: book.updatedAt, status: book.status, progress: book.progress }])); } catch {}
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      try {
        const changed = state.books.find(book => !snapshot?.has(book.id) || number(book.updatedAt) !== number(snapshot.get(book.id)?.updatedAt));
        if (!changed && attempts < 30) return setTimeout(sync, 100);
        if (!changed) return;
        const previous = snapshot?.get(changed.id);
        let nextProgress = number(changed.progress, 0);
        if (changed.status === 'completed') nextProgress = 100;
        else if (changed.status === 'want') nextProgress = 0;
        else if (changed.status === 'reading' && previous?.status === 'completed' && nextProgress >= 100) nextProgress = 0;
        if (nextProgress !== number(changed.progress, 0)) {
          changed.progress = nextProgress;
          saveState();
          renderAll();
        }
      } catch {}
    };
    setTimeout(sync, 50);
  }, true);

  patchFabricCanvas();
  installOverlayHook();
  const observer = new MutationObserver(() => { injectPalette(); injectInspector(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { injectPalette(); injectInspector(); });
  else { injectPalette(); injectInspector(); }

  globalThis.EditorActionButtons = { VERSION, ACTIONS, add: addButton };
})();
