(() => {
  'use strict';

  const VERSION = '20260804-1';
  const ACTIONS = Object.freeze({
    reading: { label: 'Reading', appAction: 'start-reading' },
    complete: { label: 'Complete', appAction: 'complete-book' },
    edit: { label: 'Edit', appAction: 'edit-book' },
    design: { label: 'Design', appAction: '' }
  });

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = value => JSON.parse(JSON.stringify(value));

  function buttonObject(actionId, options = {}) {
    const definition = ACTIONS[actionId];
    if (!definition) throw new Error(`Unknown card action: ${actionId}`);
    const width = number(options.width, 88);
    const height = number(options.height, 34);
    const fill = options.fill || '#3b2116';
    const stroke = options.stroke || '#7d4a2b';
    const textFill = options.textFill || '#f7ead2';
    const radius = number(options.radius, 9);
    return {
      type: 'Group',
      id: options.id || `action-${actionId}`,
      name: `${definition.label} button`,
      cardRole: 'action-button',
      semanticGroup: 'book-actions',
      actionId,
      left: number(options.left, 22),
      top: number(options.top, 326),
      width,
      height,
      originX: 'left',
      originY: 'top',
      angle: number(options.angle, 0),
      selectable: true,
      evented: true,
      objects: [
        {
          type: 'Rect', left: 0, top: 0, width, height, rx: radius, ry: radius,
          fill, stroke, strokeWidth: number(options.strokeWidth, 1), originX: 'left', originY: 'top'
        },
        {
          type: 'Textbox', left: 7, top: Math.max(7, (height - 14) / 2), width: Math.max(20, width - 14),
          height: 16, text: options.label || definition.label, fontFamily: options.fontFamily || 'Inter',
          fontWeight: options.fontWeight || '700', fontSize: number(options.fontSize, 10),
          textAlign: 'center', fill: textFill, originX: 'left', originY: 'top', selectable: false, evented: false
        }
      ]
    };
  }

  function walk(objects, visitor, parent = null) {
    (Array.isArray(objects) ? objects : []).forEach(object => {
      visitor(object, parent);
      if (Array.isArray(object?.objects)) walk(object.objects, visitor, object);
    });
  }

  function hasIndependentButtons(scene) {
    let found = false;
    walk(scene?.objects, object => {
      if (object?.cardRole === 'action-button' && ACTIONS[object.actionId]) found = true;
    });
    return found;
  }

  function addDefaultButtons(scene) {
    if (!scene || !Array.isArray(scene.objects) || hasIndependentButtons(scene)) return scene;
    const result = clone(scene);
    result.objects = result.objects.filter(object => !['future-actions-zone', 'future-actions-note', 'actions'].includes(object?.id) && object?.cardRole !== 'actions');
    const width = number(result.width, 420);
    const height = number(result.height, 380);
    const sx = width / 420;
    const sy = height / 380;
    const positions = [22, 116, 210, 304];
    Object.keys(ACTIONS).forEach((actionId, index) => {
      result.objects.push(buttonObject(actionId, {
        left: positions[index] * sx,
        top: 326 * sy,
        width: 88 * sx,
        height: 34 * sy,
        radius: 9 * Math.min(sx, sy),
        fontSize: 10 * Math.min(sx, sy)
      }));
    });
    result.cardActionVersion = VERSION;
    return result;
  }

  function buttonAppearance(object) {
    const children = Array.isArray(object.objects) ? object.objects : [];
    const rect = children.find(child => String(child.type).toLowerCase() === 'rect') || {};
    const text = children.find(child => ['textbox', 'text', 'i-text'].includes(String(child.type).toLowerCase())) || {};
    return {
      label: String(text.text || ACTIONS[object.actionId]?.label || 'Action'),
      fill: String(rect.fill || '#3b2116'),
      border: String(rect.stroke || '#7d4a2b'),
      borderWidth: number(rect.strokeWidth, 1),
      radius: number(rect.rx ?? rect.ry, 9),
      color: String(text.fill || '#f7ead2'),
      fontFamily: String(text.fontFamily || 'Inter'),
      fontSize: number(text.fontSize, 10),
      fontWeight: String(text.fontWeight || '700'),
      opacity: number(object.opacity, 1)
    };
  }

  function actionOverlayHtml(scene, record = {}, canvas = {}) {
    const designWidth = number(canvas.width || scene?.width, 420);
    const designHeight = number(canvas.height || scene?.height, 380);
    const buttons = [];
    walk(scene?.objects, object => {
      if (object?.visible === false || object?.cardRole !== 'action-button' || !ACTIONS[object.actionId]) return;
      const definition = ACTIONS[object.actionId];
      const appearance = buttonAppearance(object);
      const scaleX = number(object.scaleX, 1);
      const scaleY = number(object.scaleY, 1);
      const width = number(object.width, 88) * scaleX;
      const height = number(object.height, 34) * scaleY;
      const left = number(object.left, 0);
      const top = number(object.top, 0);
      const style = [
        'position:absolute',
        `left:${left / designWidth * 100}%`,
        `top:${top / designHeight * 100}%`,
        `width:${width / designWidth * 100}%`,
        `height:${height / designHeight * 100}%`,
        `background:${appearance.fill}`,
        `color:${appearance.color}`,
        `border:${appearance.borderWidth}px solid ${appearance.border}`,
        `border-radius:${appearance.radius}px`,
        `font-family:${appearance.fontFamily}`,
        `font-size:clamp(8px,${appearance.fontSize / designWidth * 100}cqw,18px)`,
        `font-weight:${appearance.fontWeight}`,
        `opacity:${appearance.opacity}`,
        `transform:rotate(${number(object.angle, 0)}deg)`,
        'transform-origin:center',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:2px 6px',
        'overflow:hidden',
        'white-space:nowrap',
        'text-overflow:ellipsis',
        'pointer-events:auto',
        'z-index:2'
      ].join(';');
      const id = escapeHtml(record.id || '');
      if (object.actionId === 'design') {
        buttons.push(`<button type="button" class="fabric-card-action-button" data-card-design-action="true" data-id="${id}" style="${escapeHtml(style)}">${escapeHtml(appearance.label)}</button>`);
      } else {
        buttons.push(`<button type="button" class="fabric-card-action-button" data-action="${escapeHtml(definition.appAction)}" data-id="${id}" style="${escapeHtml(style)}">${escapeHtml(appearance.label)}</button>`);
      }
    });
    return buttons.join('');
  }

  function hasScene(template = {}) {
    const scene = template.fabricCanvasJson || template.canvasJson || template.fabricJson || template.canvas?.fabricJson;
    return scene && Array.isArray(scene.objects) && scene.objects.length;
  }

  function install(api) {
    if (!api || api.__independentActionButtonsInstalled) return api;
    const originalResolve = api.resolveBookCardScene?.bind(api);
    const originalOpen = api.openBookCardEditor?.bind(api);

    api.independentActionButton = buttonObject;
    api.addDefaultActionButtons = addDefaultButtons;
    api.actionDefinitions = record => Object.entries(ACTIONS).map(([actionId, definition]) => ({
      actionId,
      label: actionId === 'reading'
        ? record?.status === 'completed' ? 'Reread' : record?.status === 'reading' ? 'Update' : definition.label
        : definition.label
    }));
    api.actionOverlayHtml = actionOverlayHtml;

    if (originalResolve) {
      api.resolveBookCardScene = (record = {}, template = {}, preferences = {}, options = {}) => {
        const scene = originalResolve(record, template, preferences, options);
        return scene?.standardBookCard ? addDefaultButtons(scene) : scene;
      };
      api.resolveCardScene = (template = {}, record = {}, options = {}) => api.resolveBookCardScene(record, template, options.visible || {}, options);
    }

    if (originalOpen) {
      api.openBookCardEditor = (book, adapters = {}) => {
        const template = adapters.template || {};
        const scene = template.fabricCanvasJson || template.canvasJson || template.fabricJson || template.canvas?.fabricJson;
        if (scene?.standardBookCard || !hasScene(template)) {
          const width = number(template.canvas?.width ?? adapters.cardSizes?.[adapters.size || 'medium']?.width, 420);
          const height = number(template.canvas?.height ?? adapters.cardSizes?.[adapters.size || 'medium']?.height, 380);
          const base = scene || globalThis.StandardBookCardScene?.create?.(book, { width, height });
          const enhancedTemplate = {
            ...template,
            canvas: { ...template.canvas, width, height },
            fabricCanvasJson: addDefaultButtons(base)
          };
          return originalOpen(book, { ...adapters, template: enhancedTemplate });
        }
        return originalOpen(book, adapters);
      };
    }

    Object.defineProperty(api, '__independentActionButtonsInstalled', { value: true });
    return api;
  }

  function installWhenReady() {
    if (globalThis.CanvasEditor) {
      install(globalThis.CanvasEditor);
      return true;
    }
    return false;
  }

  const timer = setInterval(() => {
    if (installWhenReady()) clearInterval(timer);
  }, 25);
  setTimeout(() => clearInterval(timer), 15000);

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-card-design-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    globalThis.VisualBuilder?.openForBook?.(button.dataset.id);
  }, true);

  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const button = event.target.closest?.('[data-card-design-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    globalThis.VisualBuilder?.openForBook?.(button.dataset.id);
  }, true);

  globalThis.CardActionButtons = { VERSION, ACTIONS, create: buttonObject, addDefaults: addDefaultButtons, install };
})();
