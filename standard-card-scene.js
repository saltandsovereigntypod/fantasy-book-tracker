(() => {
  'use strict';

  const VERSION = '20260804-1';
  const WIDTH = 420;
  const HEIGHT = 380;

  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value, min)));
  const valueAt = (source, path) => String(path || '').split('.').reduce((value, key) => value?.[key], source);

  function recordValue(record = {}, path = '') {
    if (path === 'coverUrl') return record.coverUrl || record.cover || record.coverImage || record.image || '';
    if (path === 'progress') return record.progress ?? record.readingProgress ?? record.percentComplete ?? 0;
    if (path === 'rating') return record.ratings?.overall ?? record.ratings?.rating ?? record.rating ?? 0;
    if (path === 'spice') return record.ratings?.spice ?? record.spice ?? 0;
    if (path === 'impact') return record.ratings?.impact ?? record.impact ?? 0;
    if (path === 'reaction') return record.ratings?.reaction ?? record.reaction ?? '';
    return valueAt(record, path) ?? '';
  }

  function theme() {
    const styles = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
    const read = (name, fallback) => styles?.getPropertyValue(name).trim() || fallback;
    return {
      background: read('--ui-surface-raised', read('--panel-2', '#2a160f')),
      panel: read('--ui-surface', read('--panel', '#1a100b')),
      panelSoft: read('--ui-surface-soft', '#3b2116'),
      text: read('--ui-text', read('--text', '#f7ead2')),
      muted: read('--ui-text-muted', read('--muted', '#c9ab83')),
      accent: read('--ui-accent', read('--accent', '#c76c31')),
      border: read('--ui-border', read('--border', '#7d4a2b')),
      borderStrong: read('--ui-border-strong', '#a66a3d')
    };
  }

  function ratingValue(record, path) {
    const value = clamp(recordValue(record, path), 0, 5);
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function standardCardScene(record = {}, options = {}) {
    const width = number(options.width, WIDTH);
    const height = number(options.height, HEIGHT);
    const sx = width / WIDTH;
    const sy = height / HEIGHT;
    const scale = Math.min(sx, sy);
    const x = value => value * sx;
    const y = value => value * sy;
    const font = value => Math.max(8, value * scale);
    const colors = theme();
    const coverSource = recordValue(record, 'coverUrl');
    const progress = clamp(recordValue(record, 'progress'), 0, 100);

    const objects = [
      {
        type: 'Rect', id: 'standard-background', name: 'Card background', cardRole: 'background', semanticGroup: 'standard-shell',
        left: 0, top: 0, width, height, fill: colors.background, stroke: colors.borderStrong, strokeWidth: 2,
        rx: x(20), ry: x(20), selectable: true, evented: true
      },
      {
        type: 'Rect', id: 'standard-inner-panel', name: 'Inner panel', cardRole: 'decor', semanticGroup: 'standard-shell',
        left: x(10), top: y(10), width: x(400), height: y(360), fill: colors.panel, stroke: colors.border,
        strokeWidth: 1, rx: x(15), ry: x(15), selectable: true, evented: true
      },
      {
        type: 'Rect', id: 'standard-accent', name: 'Accent line', cardRole: 'decor',
        left: x(144), top: y(77), width: x(248), height: y(3), fill: colors.accent, rx: x(2), ry: x(2)
      }
    ];

    if (coverSource) {
      objects.push({
        type: 'Image', id: 'cover', name: 'Cover', cardRole: 'cover', dataBinding: { path: 'coverUrl' },
        src: coverSource, crossOrigin: 'anonymous', left: x(22), top: y(22), width: x(108), height: y(162),
        originX: 'left', originY: 'top'
      });
    } else {
      objects.push(
        {
          type: 'Rect', id: 'cover', name: 'Cover', cardRole: 'cover', dataBinding: { path: 'coverUrl' },
          left: x(22), top: y(22), width: x(108), height: y(162), fill: colors.panelSoft,
          stroke: colors.borderStrong, strokeWidth: 1, rx: x(10), ry: x(10)
        },
        {
          type: 'Textbox', id: 'cover-placeholder-title', name: 'Cover placeholder', cardRole: 'cover', dataBinding: { path: 'title' },
          left: x(32), top: y(78), width: x(88), height: y(52), text: String(record.title || 'Book Cover'),
          fontFamily: 'Libre Baskerville', fontWeight: '700', fontSize: font(13), textAlign: 'center', fill: colors.muted
        }
      );
    }

    objects.push(
      {
        type: 'Textbox', id: 'title', name: 'Title', cardRole: 'title', dataBinding: { path: 'title' },
        left: x(144), top: y(20), width: x(248), height: y(52), text: String(record.title || 'Book Title'),
        fontFamily: 'Libre Baskerville', fontWeight: '700', fontSize: font(27), lineHeight: 1.05, fill: colors.text
      },
      {
        type: 'Textbox', id: 'author', name: 'Author', cardRole: 'author', dataBinding: { path: 'author' },
        left: x(144), top: y(88), width: x(118), height: y(38), text: String(record.author || 'Author'),
        fontFamily: 'Libre Baskerville', fontWeight: '700', fontSize: font(13), fill: colors.text
      },
      {
        type: 'Textbox', id: 'series', name: 'Series', cardRole: 'series', dataBinding: { path: 'series' },
        left: x(272), top: y(88), width: x(120), height: y(38), text: String(record.series || 'Series'),
        fontFamily: 'Libre Baskerville', fontSize: font(12), textAlign: 'right', fill: colors.muted
      },
      {
        type: 'Rect', id: 'status-pill', name: 'Status background', cardRole: 'status', semanticGroup: 'status',
        left: x(144), top: y(130), width: x(112), height: y(28), fill: colors.panelSoft, stroke: colors.border,
        strokeWidth: 1, rx: x(14), ry: x(14)
      },
      {
        type: 'Textbox', id: 'status', name: 'Status', cardRole: 'status', semanticGroup: 'status', dataBinding: { path: 'status' },
        left: x(154), top: y(136), width: x(92), height: y(18), text: String(record.status || 'Unread'),
        fontFamily: 'Inter', fontWeight: '700', fontSize: font(10), textAlign: 'center', fill: colors.text
      },
      {
        type: 'Textbox', id: 'progress-label', name: 'Progress label', cardRole: 'progress', semanticGroup: 'progress',
        left: x(270), top: y(132), width: x(122), height: y(18), text: `Progress ${Math.round(progress)}%`,
        fontFamily: 'Inter', fontWeight: '700', fontSize: font(10), textAlign: 'right', fill: colors.muted,
        dataBinding: { path: 'progress' }
      },
      {
        type: 'Rect', id: 'progress-track', name: 'Progress track', cardRole: 'progress', semanticGroup: 'progress',
        left: x(144), top: y(168), width: x(248), height: y(9), fill: colors.panelSoft, stroke: colors.border,
        strokeWidth: 1, rx: x(5), ry: x(5), sliderConfig: { path: 'progress', role: 'track', max: 100, trackWidth: x(248) }
      },
      {
        type: 'Rect', id: 'progress-fill', name: 'Progress fill', cardRole: 'progress', semanticGroup: 'progress',
        left: x(144), top: y(168), width: x(248) * progress / 100, height: y(9), fill: colors.accent,
        rx: x(5), ry: x(5), dataBinding: { path: 'progress' },
        sliderConfig: { path: 'progress', role: 'fill', max: 100, trackWidth: x(248) }
      },
      {
        type: 'Rect', id: 'rating-panel', name: 'Ratings panel', cardRole: 'decor',
        left: x(22), top: y(200), width: x(370), height: y(88), fill: colors.panelSoft, stroke: colors.border,
        strokeWidth: 1, rx: x(12), ry: x(12), opacity: 0.82
      }
    );

    const ratings = [
      { path: 'rating', label: 'OVERALL', icon: '★', left: 34 },
      { path: 'spice', label: 'SPICE', icon: '🔥', left: 158 },
      { path: 'impact', label: 'IMPACT', icon: '♥', left: 282 }
    ];

    ratings.forEach(item => {
      objects.push(
        {
          type: 'Textbox', id: `${item.path}-label`, name: `${item.label} label`, cardRole: item.path,
          semanticGroup: item.path, left: x(item.left), top: y(214), width: x(98), height: y(16), text: item.label,
          fontFamily: 'Inter', fontWeight: '800', fontSize: font(9), charSpacing: 80, textAlign: 'center', fill: colors.muted
        },
        {
          type: 'Textbox', id: item.path, name: item.label, cardRole: item.path, semanticGroup: item.path,
          dataBinding: { path: item.path }, left: x(item.left), top: y(238), width: x(98), height: y(35),
          text: `${item.icon} ${ratingValue(record, item.path)} / 5`, fontFamily: 'Libre Baskerville', fontWeight: '700',
          fontSize: font(15), textAlign: 'center', fill: item.path === 'rating' ? colors.accent : colors.text
        }
      );
    });

    objects.push(
      {
        type: 'Textbox', id: 'reaction', name: 'Reaction', cardRole: 'reaction', dataBinding: { path: 'reaction' },
        left: x(22), top: y(296), width: x(370), height: y(24), text: String(recordValue(record, 'reaction') || ''),
        fontFamily: 'Libre Baskerville', fontStyle: 'italic', fontSize: font(10), textAlign: 'center', fill: colors.muted
      },
      {
        type: 'Rect', id: 'future-actions-zone', name: 'Future button area', cardRole: 'decor', semanticGroup: 'future-actions',
        left: x(22), top: y(326), width: x(370), height: y(34), fill: 'transparent', stroke: colors.border,
        strokeWidth: 1, strokeDashArray: [5, 5], rx: x(9), ry: x(9), opacity: 0.65
      },
      {
        type: 'Textbox', id: 'future-actions-note', name: 'Future button area label', cardRole: 'decor', semanticGroup: 'future-actions',
        left: x(32), top: y(336), width: x(350), height: y(14), text: 'BUTTON AREA — FUNCTIONAL CONTROLS ARE ADDED NEXT',
        fontFamily: 'Inter', fontWeight: '700', fontSize: font(8), charSpacing: 35, textAlign: 'center', fill: colors.muted,
        opacity: 0.75
      }
    );

    return {
      version: '6',
      width,
      height,
      standardBookCard: true,
      standardSceneVersion: VERSION,
      background: colors.panel,
      objects
    };
  }

  function hasSavedScene(template = {}) {
    const candidates = [template.fabricCanvasJson, template.canvasJson, template.fabricJson, template.canvas?.fabricJson];
    return candidates.some(scene => scene && typeof scene === 'object' && Array.isArray(scene.objects) && scene.objects.length);
  }

  function install(api) {
    if (!api || api.__standardSceneInstalled) return api;

    const originalResolve = api.resolveBookCardScene?.bind(api);
    const originalOpen = api.openBookCardEditor?.bind(api);

    api.standardCardScene = standardCardScene;
    api.baseScene = ({ width = WIDTH, height = HEIGHT, record = {} } = {}) => standardCardScene(record, { width, height });
    api.classicScene = ({ width = WIDTH, height = HEIGHT, record = {} } = {}) => standardCardScene(record, { width, height });

    if (originalResolve) {
      api.resolveBookCardScene = (record = {}, template = {}, preferences = {}, options = {}) => {
        if (hasSavedScene(template)) return originalResolve(record, template, preferences, options);
        const width = number(options.width ?? template.canvas?.width, WIDTH);
        const height = number(options.height ?? template.canvas?.height, HEIGHT);
        const scene = standardCardScene(record, { width, height });
        return typeof api.applySceneVisibility === 'function'
          ? api.applySceneVisibility(scene, preferences)
          : scene;
      };
      api.resolveCardScene = (template = {}, record = {}, options = {}) => api.resolveBookCardScene(record, template, options.visible || {}, options);
    }

    if (originalOpen) {
      api.openBookCardEditor = (book, adapters = {}) => {
        const template = adapters.template || {};
        if (hasSavedScene(template)) return originalOpen(book, adapters);
        const size = adapters.size || 'medium';
        const preset = adapters.cardSizes?.[size] || {};
        const width = number(template.canvas?.width ?? preset.width, WIDTH);
        const height = number(template.canvas?.height ?? preset.height, HEIGHT);
        const temporaryTemplate = {
          ...template,
          canvas: { ...template.canvas, width, height },
          fabricCanvasJson: standardCardScene(book, { width, height })
        };
        return originalOpen(book, { ...adapters, template: temporaryTemplate });
      };
    }

    Object.defineProperty(api, '__standardSceneInstalled', { value: true, configurable: false });
    return api;
  }

  let stored;
  Object.defineProperty(globalThis, 'CanvasEditor', {
    configurable: true,
    enumerable: true,
    get() { return stored; },
    set(value) {
      stored = install(value);
      Object.defineProperty(globalThis, 'CanvasEditor', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: stored
      });
    }
  });

  globalThis.StandardBookCardScene = { VERSION, create: standardCardScene, install };
})();
