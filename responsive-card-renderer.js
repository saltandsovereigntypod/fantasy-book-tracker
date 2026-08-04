(() => {
  'use strict';

  const VERSION = '20260804-1';
  const SIZE_WIDTHS = Object.freeze({ small: 300, medium: 420, large: 560 });
  const scenes = new Map();
  const canvases = new WeakMap();
  const renderTokens = new WeakMap();
  const observed = new WeakSet();
  let generation = 0;

  const clone = value => JSON.parse(JSON.stringify(value));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fabricApi = () => globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric;

  function selectedSize(element) {
    const collection = element.closest('.book-collection');
    const requested = collection?.dataset?.cardSize || 'medium';
    return SIZE_WIDTHS[requested] ? requested : 'medium';
  }

  function displayDimensions(element, scene) {
    const designWidth = Math.max(1, number(element.dataset.designWidth || scene.width, 420));
    const designHeight = Math.max(1, number(element.dataset.designHeight || scene.height, 380));
    const viewport = element.closest('.fabric-card-viewport');
    const requestedWidth = SIZE_WIDTHS[selectedSize(element)];
    const availableWidth = Math.floor(viewport?.parentElement?.getBoundingClientRect?.().width || requestedWidth);
    const mobileWidth = window.matchMedia?.('(max-width: 760px)')?.matches ? availableWidth : requestedWidth;
    const width = Math.max(1, Math.round(Math.min(requestedWidth, mobileWidth || requestedWidth)));
    const height = Math.max(1, Math.round(width * designHeight / designWidth));
    return { designWidth, designHeight, width, height };
  }

  function sceneFor(element, json = null) {
    if (json) return clone(json);
    const key = element.dataset.fabricSceneKey;
    if (key && scenes.has(key)) return clone(scenes.get(key).scene);
    if (element.dataset.fabricCardJson) {
      try { return JSON.parse(element.dataset.fabricCardJson); }
      catch (error) { throw new Error(`Fabric scene parsing failed: ${error?.message || error}`, { cause: error }); }
    }
    throw new Error(`Fabric scene resolution failed for ${key || 'unknown scene'}.`);
  }

  function recordFor(element, explicitRecord = null) {
    if (explicitRecord) return explicitRecord;
    const key = element.dataset.fabricSceneKey;
    return key ? scenes.get(key)?.details?.record || null : null;
  }

  function dispose(element) {
    const canvas = canvases.get(element);
    if (!canvas) return;
    canvases.delete(element);
    try { Promise.resolve(canvas.dispose?.()).catch(error => console.error('Fabric canvas disposal failed', { error })); }
    catch (error) { console.error('Fabric canvas disposal failed', { error }); }
  }

  function state(element, value, error = null) {
    const viewport = element.closest('.fabric-card-viewport');
    if (!viewport) return;
    viewport.dataset.fabricRenderState = value;
    const overlay = viewport.querySelector('.fabric-card-action-overlay');
    if (overlay) overlay.hidden = value !== 'ready';
    if (error) viewport.dataset.fabricRenderError = error.message || String(error);
    else viewport.removeAttribute('data-fabric-render-error');
  }

  async function load(canvas, scene, record, api) {
    let resolved = api.resolveLibraryReferences ? await api.resolveLibraryReferences(scene) : clone(scene);
    if (record && api.bindRecord) resolved = api.bindRecord(resolved, record, {
      width: canvas.__designWidth,
      height: canvas.__designHeight
    });
    if (document.fonts?.ready) await document.fonts.ready;

    try {
      await canvas.loadFromJSON(resolved);
    } catch (error) {
      console.error('Fabric loadFromJSON failed; retrying without images', { error, objectCount: resolved?.objects?.length || 0 });
      canvas.clear();
      const fallback = api.replaceImagesWithPlaceholders ? api.replaceImagesWithPlaceholders(resolved) : resolved;
      await canvas.loadFromJSON(fallback);
    }
  }

  async function renderSavedCanvas(element, { record = null, json = null } = {}) {
    if (!element) throw new Error('Fabric library render host missing.');
    const api = globalThis.CanvasEditor;
    const fabric = fabricApi();
    if (!api || !fabric?.StaticCanvas) throw new Error('Fabric card renderer is unavailable.');

    const token = ++generation;
    renderTokens.set(element, token);
    state(element, 'loading');
    dispose(element);

    const scene = sceneFor(element, json);
    const dimensions = displayDimensions(element, scene);
    const viewport = element.closest('.fabric-card-viewport');
    if (viewport) {
      viewport.style.setProperty('--fabric-display-width', `${dimensions.width}px`);
      viewport.style.setProperty('--fabric-display-height', `${dimensions.height}px`);
      viewport.dataset.cardRenderSize = selectedSize(element);
    }

    element.width = dimensions.width;
    element.height = dimensions.height;
    element.style.width = `${dimensions.width}px`;
    element.style.height = `${dimensions.height}px`;

    const canvas = new fabric.StaticCanvas(element, {
      width: dimensions.width,
      height: dimensions.height,
      enableRetinaScaling: true,
      renderOnAddRemove: false,
      backgroundColor: scene.background || 'transparent'
    });
    canvas.__designWidth = dimensions.designWidth;
    canvas.__designHeight = dimensions.designHeight;
    canvases.set(element, canvas);

    await load(canvas, scene, recordFor(element, record), api);
    if (renderTokens.get(element) !== token || element.isConnected === false) {
      dispose(element);
      return null;
    }

    const scaleX = dimensions.width / dimensions.designWidth;
    const scaleY = dimensions.height / dimensions.designHeight;
    canvas.setViewportTransform([scaleX, 0, 0, scaleY, 0, 0]);
    canvas.requestRenderAll();

    element.dataset.fabricRendered = 'true';
    element.dataset.fabricRendererVersion = VERSION;
    state(element, 'ready');
    observe(element);
    return canvas;
  }

  function fail(element, error) {
    console.error('Fabric card render failed', {
      canvasId: element?.id,
      sceneKey: element?.dataset?.fabricSceneKey,
      error
    });
    if (element) state(element, 'failed', error);
  }

  function renderSavedCanvases(root = document) {
    const elements = root?.querySelectorAll?.('canvas[data-fabric-scene-key],canvas[data-fabric-card-json]');
    if (!elements) return;
    elements.forEach(element => renderSavedCanvas(element).catch(error => fail(element, error)));
  }

  function scheduleSavedCanvasRender(root = document) {
    const run = () => renderSavedCanvases(root);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    entries.forEach(entry => {
      const element = entry.target.querySelector?.('canvas[data-fabric-scene-key],canvas[data-fabric-card-json]');
      if (!element?.isConnected) return;
      const scene = (() => { try { return sceneFor(element); } catch { return null; } })();
      if (!scene) return;
      const next = displayDimensions(element, scene);
      const currentWidth = number(element.style.width?.replace('px', ''), element.clientWidth);
      if (Math.abs(currentWidth - next.width) < 1) return;
      renderSavedCanvas(element).catch(error => fail(element, error));
    });
  }) : null;

  function observe(element) {
    const viewport = element.closest('.fabric-card-viewport');
    if (!viewport || observed.has(viewport)) return;
    observed.add(viewport);
    resizeObserver?.observe(viewport);
  }

  function install() {
    const api = globalThis.CanvasEditor;
    if (!api || api.__responsiveCardRendererInstalled) return false;
    const originalRegister = api.registerRenderScene?.bind(api);
    if (!originalRegister) return false;

    api.registerRenderScene = (scene, details = {}) => {
      const key = originalRegister(scene, details);
      scenes.set(key, { scene: clone(scene), details });
      return key;
    };
    api.renderSavedCanvas = renderSavedCanvas;
    api.renderSavedCanvases = renderSavedCanvases;
    api.scheduleSavedCanvasRender = scheduleSavedCanvasRender;
    api.cardDisplaySizes = SIZE_WIDTHS;
    api.rerenderCardOutputs = () => scheduleSavedCanvasRender(document);

    Object.defineProperty(api, '__responsiveCardRendererInstalled', { value: true });

    const mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('canvas[data-fabric-scene-key],canvas[data-fabric-card-json]') || node.querySelector?.('canvas[data-fabric-scene-key],canvas[data-fabric-card-json]')) {
            scheduleSavedCanvasRender(node.matches?.('canvas') ? node.parentElement || document : node);
          }
        }
      }
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('change', event => {
      if (event.target?.matches?.('[data-card-size],select[name="cardSize"],#cardSize')) scheduleSavedCanvasRender(document);
    });

    scheduleSavedCanvasRender(document);
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 20);
  setTimeout(() => clearInterval(timer), 20000);

  globalThis.ResponsiveCardRenderer = { VERSION, SIZE_WIDTHS, renderSavedCanvas };
})();
