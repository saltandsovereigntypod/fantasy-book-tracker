(() => {
  'use strict';

  const scenes = new Map();
  const fabricApi = () => globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric;
  const clone = value => JSON.parse(JSON.stringify(value));

  async function sceneToSvg(scene) {
    const fabric = fabricApi();
    if (!fabric?.StaticCanvas || !scene?.objects) return '';

    const width = Number(scene.width) || 420;
    const height = Number(scene.height) || 380;
    const element = document.createElement('canvas');
    element.width = width;
    element.height = height;

    const canvas = new fabric.StaticCanvas(element, {
      width,
      height,
      enableRetinaScaling: false,
      backgroundColor: scene.background || 'transparent'
    });

    try {
      await canvas.loadFromJSON(clone(scene));
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.renderAll();
      return canvas.toSVG({
        width,
        height,
        viewBox: { x: 0, y: 0, width, height },
        suppressPreamble: true
      });
    } finally {
      canvas.dispose();
    }
  }

  function install() {
    const api = globalThis.CanvasEditor;
    if (!api || api.__librarySvgInstalled) return false;

    const originalRegister = api.registerRenderScene?.bind(api);
    const originalRender = api.renderSavedCanvas?.bind(api);
    if (!originalRegister || !originalRender) return false;

    api.registerRenderScene = (scene, meta = {}) => {
      const key = originalRegister(scene, meta);
      scenes.set(key, clone(scene));
      return key;
    };

    api.renderSavedCanvas = async (element, options = {}) => {
      await originalRender(element, options);
      if (!element?.isConnected) return;

      const key = element.dataset.fabricSceneKey;
      const scene = key ? scenes.get(key) : null;
      if (!scene) return;

      const viewport = element.closest('.fabric-card-viewport');
      if (!viewport) return;

      try {
        const svgMarkup = await sceneToSvg(scene);
        if (!svgMarkup || !element.isConnected) return;

        let host = viewport.querySelector(':scope > .fabric-card-svg');
        if (!host) {
          host = document.createElement('div');
          host.className = 'fabric-card-svg';
          host.setAttribute('aria-hidden', 'true');
          viewport.insertBefore(host, viewport.firstChild);
        }
        host.innerHTML = svgMarkup;
        element.classList.add('is-vector-replaced');
        viewport.dataset.vectorCardReady = 'true';
      } catch (error) {
        console.error('Fabric SVG card render failed', { sceneKey: key, error });
        element.classList.remove('is-vector-replaced');
        viewport.removeAttribute('data-vector-card-ready');
      }
    };

    Object.defineProperty(api, '__librarySvgInstalled', { value: true });
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 25);
  setTimeout(() => clearInterval(timer), 20000);

  globalThis.LibraryCardSvg = { version: '20260804-1' };
})();
