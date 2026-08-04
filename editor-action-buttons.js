(() => {
  'use strict';

  const ACTIONS = {
    reading: { label: 'Reading', fill: '#5b2f1d' },
    complete: { label: 'Complete', fill: '#70401f' },
    edit: { label: 'Edit', fill: '#3b2116' },
    design: { label: 'Design', fill: '#8a4d28' }
  };

  const canvasRegistry = new Map();

  function patchFabricCanvas() {
    const fabric = globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric;
    if (!fabric?.Canvas || fabric.Canvas.__actionTrackingPatched) return;
    const OriginalCanvas = fabric.Canvas;
    class TrackingCanvas extends OriginalCanvas {
      constructor(element, options) {
        super(element, options);
        const lower = this.lowerCanvasEl || (typeof element === 'string' ? document.getElementById(element) : element);
        if (lower) canvasRegistry.set(lower, this);
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
    return canvasRegistry.get(element) || [...canvasRegistry.values()].find(canvas => canvas.lowerCanvasEl === element) || null;
  }

  function colors() {
    const styles = getComputedStyle(document.documentElement);
    const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    return {
      text: read('--ui-text', read('--text', '#f7ead2')),
      border: read('--ui-border', read('--border', '#7d4a2b'))
    };
  }

  function addButton(actionId) {
    const definition = ACTIONS[actionId];
    const canvas = activeCanvas();
    const fabric = globalThis.fabric?.Group ? globalThis.fabric : globalThis.fabric?.fabric;
    if (!definition || !canvas || !fabric) return false;

    const theme = colors();
    const width = 96;
    const height = 38;
    const offset = canvas.getObjects().filter(object => object.cardRole === 'action-button').length * 12;
    const left = Math.min((canvas.__designWidth || canvas.getWidth()) - width - 16, 22 + offset);
    const top = Math.min((canvas.__designHeight || canvas.getHeight()) - height - 16, 326);

    const rect = new fabric.Rect({
      left: 0, top: 0, width, height, rx: 10, ry: 10,
      fill: definition.fill, stroke: theme.border, strokeWidth: 1,
      originX: 'left', originY: 'top'
    });
    const text = new fabric.Textbox(definition.label, {
      left: 8, top: 11, width: width - 16, height: 16,
      fontFamily: 'Inter', fontSize: 11, fontWeight: '700',
      textAlign: 'center', fill: theme.text,
      originX: 'left', originY: 'top', selectable: false, evented: false
    });
    const group = new fabric.Group([rect, text], {
      id: `action-${actionId}-${Date.now().toString(36)}`,
      name: `${definition.label} button`,
      cardRole: 'action-button',
      semanticGroup: 'book-actions',
      actionId,
      left, top, width, height,
      originX: 'left', originY: 'top',
      selectable: true, evented: true
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    canvas.fire('object:modified', { target: group });
    return true;
  }

  function injectPalette() {
    const panel = document.querySelector('#fabric-panel-elements');
    if (!panel || panel.querySelector('[data-independent-card-actions]')) return;
    const coreGrid = panel.querySelector('.fabric-compact-grid');
    const section = document.createElement('div');
    section.dataset.independentCardActions = 'true';
    section.innerHTML = `
      <h4>Book action buttons</h4>
      <div class="fabric-compact-grid">
        <button type="button" data-add-book-action="reading">Reading button</button>
        <button type="button" data-add-book-action="complete">Complete button</button>
        <button type="button" data-add-book-action="edit">Edit button</button>
        <button type="button" data-add-book-action="design">Design button</button>
      </div>`;
    (coreGrid?.parentElement || panel).insertBefore(section, coreGrid?.nextSibling || null);
    section.querySelectorAll('[data-add-book-action]').forEach(button => {
      button.addEventListener('click', () => addButton(button.dataset.addBookAction));
    });
  }

  patchFabricCanvas();
  const observer = new MutationObserver(injectPalette);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectPalette);
  else injectPalette();

  globalThis.EditorActionButtons = { ACTIONS, add: addButton };
})();
