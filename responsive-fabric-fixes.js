(() => {
  'use strict';

  const instances = new WeakMap();
  const scenes = new Map();
  const SIDEBAR_KEY = 'empyrean-sidebar-collapsed';

  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function installSidebarToggle() {
    const app = document.getElementById('app');
    const sidebar = app?.querySelector('.sidebar');
    if (!app || !sidebar || sidebar.querySelector('.sidebar-collapse-toggle')) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar-collapse-toggle';
    toggle.setAttribute('aria-label', 'Collapse navigation');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.innerHTML = '‹';
    sidebar.append(toggle);

    const apply = (collapsed, { remember = true } = {}) => {
      app.classList.toggle('sidebar-is-collapsed', collapsed);
      app.classList.toggle('sidebar-user-expanded', !collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
      toggle.textContent = collapsed ? '›' : '‹';
      if (remember) localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
      window.dispatchEvent(new Event('resize'));
    };

    const stored = localStorage.getItem(SIDEBAR_KEY);
    const initiallyCollapsed = stored === '1' || (stored === null && window.matchMedia('(max-width: 1280px)').matches);
    apply(initiallyCollapsed, { remember: false });
    toggle.addEventListener('click', () => apply(!app.classList.contains('sidebar-is-collapsed')));
  }

  function cloneScene(scene) {
    try { return JSON.parse(JSON.stringify(scene)); }
    catch { return scene; }
  }

  function showReadyState(element) {
    element.dataset.fabricRendered = 'true';
    const host = element.closest('.fabric-card-viewport');
    if (!host) return;
    host.dataset.fabricRenderState = 'ready';
    const overlay = host.querySelector('.fabric-card-action-overlay');
    if (overlay) overlay.hidden = false;
    const fallback = host.querySelector('.fabric-card-render-fallback');
    if (fallback) fallback.hidden = true;
  }

  async function renderCrispCanvas(element, scene) {
    if (!element || !scene || !globalThis.fabric?.StaticCanvas) return false;
    const host = element.closest('.fabric-card-viewport') || element.parentElement;
    if (!host) return false;

    const designWidth = Math.max(1, number(element.dataset.designWidth || scene.width, 420));
    const designHeight = Math.max(1, number(element.dataset.designHeight || scene.height, 380));
    const availableWidth = Math.max(1, host.getBoundingClientRect().width || element.clientWidth || designWidth);
    const displayWidth = availableWidth;
    const displayHeight = displayWidth * designHeight / designWidth;
    const scale = displayWidth / designWidth;

    const previous = instances.get(element);
    try { previous?.dispose?.(); } catch {}

    element.style.width = `${displayWidth}px`;
    element.style.height = `${displayHeight}px`;

    const canvas = new globalThis.fabric.StaticCanvas(element, {
      width: Math.round(displayWidth),
      height: Math.round(displayHeight),
      enableRetinaScaling: true,
      renderOnAddRemove: false,
      backgroundColor: scene.background || 'transparent'
    });
    instances.set(element, canvas);
    await canvas.loadFromJSON(cloneScene(scene));
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    canvas.requestRenderAll();
    showReadyState(element);
    return true;
  }

  function installCanvasPatch() {
    const editor = globalThis.CanvasEditor;
    if (!editor || editor.__responsiveSharpnessPatch) return false;
    editor.__responsiveSharpnessPatch = true;

    if (typeof editor.registerRenderScene === 'function') {
      const originalRegister = editor.registerRenderScene.bind(editor);
      editor.registerRenderScene = (scene, metadata) => {
        const key = originalRegister(scene, metadata);
        if (key) scenes.set(key, cloneScene(scene));
        return key;
      };
    }

    const originalRender = typeof editor.renderSavedCanvas === 'function' ? editor.renderSavedCanvas.bind(editor) : null;
    editor.renderSavedCanvas = async (element, options = {}) => {
      const inline = options.json || (() => {
        try { return JSON.parse(element?.dataset?.fabricCardJson || 'null'); }
        catch { return null; }
      })();
      const scene = inline || scenes.get(element?.dataset?.fabricSceneKey);
      if (scene) {
        try { return await renderCrispCanvas(element, scene); }
        catch (error) { console.error('High-DPI Fabric render failed; using original renderer.', error); }
      }
      return originalRender ? originalRender(element, options) : false;
    };

    const rerender = () => {
      document.querySelectorAll('canvas[data-fabric-scene-key],canvas[data-fabric-card-json]').forEach(canvas => {
        try { instances.get(canvas)?.dispose?.(); } catch {}
        instances.delete(canvas);
        canvas.removeAttribute('data-fabric-rendered');
      });
      editor.scheduleSavedCanvasRender?.(document);
    };

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(rerender, 120);
    }, { passive: true });

    rerender();
    return true;
  }

  function boot() {
    installSidebarToggle();
    if (installCanvasPatch()) return;
    const timer = window.setInterval(() => {
      installSidebarToggle();
      if (installCanvasPatch()) window.clearInterval(timer);
    }, 100);
    window.setTimeout(() => window.clearInterval(timer), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
