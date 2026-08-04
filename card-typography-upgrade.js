(() => {
  'use strict';

  const VERSION = '20260804-1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function upgradeScene(source) {
    if (!source || !Array.isArray(source.objects)) return source;
    const scene = clone(source);
    const scale = Math.max(0.65, Math.min(2.5, Math.min(number(scene.width, 420) / 420, number(scene.height, 380) / 380)));
    const px = value => value * scale;

    const rules = {
      title: { size: 30, height: 58, family: 'Libre Baskerville', weight: '700', lineHeight: 1.08 },
      author: { size: 14, height: 24, family: 'Inter', weight: '700', lineHeight: 1.15 },
      series: { size: 13.5, height: 24, family: 'Inter', weight: '600', lineHeight: 1.15 },
      status: { size: 12, height: 20, family: 'Inter', weight: '700', lineHeight: 1.1 },
      'progress-label': { size: 12, height: 20, family: 'Inter', weight: '700', lineHeight: 1.1 },
      rating: { size: 14.5, height: 78, family: 'Libre Baskerville', weight: '700', lineHeight: 1.3 },
      spice: { size: 14.5, height: 78, family: 'Libre Baskerville', weight: '700', lineHeight: 1.3 },
      impact: { size: 14.5, height: 78, family: 'Libre Baskerville', weight: '700', lineHeight: 1.3 },
      reaction: { size: 12, height: 22, family: 'Libre Baskerville', weight: '600', lineHeight: 1.15 },
      'cover-placeholder-title': { size: 14, height: 58, family: 'Inter', weight: '700', lineHeight: 1.2 }
    };

    const identify = object => {
      const id = String(object?.id || '').toLowerCase();
      const path = String(object?.dataBinding?.path || '').toLowerCase();
      const role = String(object?.cardRole || '').toLowerCase();
      if (rules[id]) return id;
      if (rules[path]) return path;
      if (role === 'title') return 'title';
      if (role === 'author') return 'author';
      if (role === 'series') return 'series';
      if (role === 'status') return 'status';
      if (role === 'reaction') return 'reaction';
      if (role === 'rating') return 'rating';
      if (role === 'spice') return 'spice';
      if (role === 'impact') return 'impact';
      if (role === 'progress' && 'text' in object) return 'progress-label';
      return '';
    };

    const visit = object => {
      const key = identify(object);
      const rule = rules[key];
      if (rule && 'text' in object) {
        object.fontSize = Math.max(number(object.fontSize, 0), px(rule.size));
        object.height = Math.max(number(object.height, 0), px(rule.height));
        object.lineHeight = Math.max(number(object.lineHeight, 0), rule.lineHeight);
        object.fontWeight = object.fontWeight || rule.weight;

        // Tiny serif metadata is what looked soft. Preserve intentional larger custom fonts,
        // but move undersized metadata to a screen-friendly face at render time.
        if (['author', 'series', 'status', 'progress-label', 'cover-placeholder-title'].includes(key)) {
          if (number(object.fontSize, 0) <= px(rule.size + 1.5)) object.fontFamily = rule.family;
        } else if (!object.fontFamily) {
          object.fontFamily = rule.family;
        }
      }
      (object?.objects || []).forEach(visit);
    };

    scene.objects.forEach(visit);
    scene.typographyUpgradeVersion = VERSION;
    return scene;
  }

  function install() {
    const api = globalThis.CanvasEditor;
    if (!api || api.__cardTypographyUpgradeInstalled) return false;

    const originalResolve = api.resolveBookCardScene?.bind(api);
    const originalOpen = api.openBookCardEditor?.bind(api);
    const originalRegister = api.registerRenderScene?.bind(api);

    if (originalResolve) {
      api.resolveBookCardScene = (record = {}, template = {}, preferences = {}, options = {}) =>
        upgradeScene(originalResolve(record, template, preferences, options));
      api.resolveCardScene = (template = {}, record = {}, options = {}) =>
        api.resolveBookCardScene(record, template, options.visible || {}, options);
    }

    if (originalOpen) {
      api.openBookCardEditor = (book, adapters = {}) => {
        const template = adapters.template || {};
        const scene = template.fabricCanvasJson || template.canvasJson || template.fabricJson || template.canvas?.fabricJson;
        if (!scene) return originalOpen(book, adapters);
        return originalOpen(book, {
          ...adapters,
          template: { ...template, fabricCanvasJson: upgradeScene(scene) }
        });
      };
    }

    if (originalRegister) {
      api.registerRenderScene = (scene, meta = {}) => originalRegister(upgradeScene(scene), meta);
    }

    api.upgradeCardTypography = upgradeScene;
    Object.defineProperty(api, '__cardTypographyUpgradeInstalled', { value: true });
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 25);
  setTimeout(() => clearInterval(timer), 20000);

  globalThis.CardTypographyUpgrade = { VERSION, upgradeScene };
})();
