(() => {
  'use strict';

  const MAX_RETINA_SCALE = 4;
  const fabric = globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric;
  if (!fabric || fabric.__stretchAwareRetinaInstalled) return;

  function displayScale(canvas) {
    const logicalWidth = Number(canvas?.width) || Number(canvas?.lowerCanvasEl?.getAttribute?.('width')) || 1;
    const logicalHeight = Number(canvas?.height) || Number(canvas?.lowerCanvasEl?.getAttribute?.('height')) || 1;
    const element = canvas?.lowerCanvasEl;
    const host = element?.closest?.('.fabric-card-viewport, .fabric-canvas-frame') || element?.parentElement;
    const rect = host?.getBoundingClientRect?.();
    const widthScale = rect?.width > 0 ? rect.width / logicalWidth : 1;
    const heightScale = rect?.height > 0 ? rect.height / logicalHeight : 1;
    return Math.max(1, widthScale, heightScale);
  }

  function retinaScale(canvas) {
    const deviceScale = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
    return Math.min(MAX_RETINA_SCALE, deviceScale * displayScale(canvas));
  }

  function patchCanvasClass(name) {
    const Original = fabric[name];
    if (typeof Original !== 'function' || Original.__stretchAwareRetinaPatched) return;

    class StretchAwareCanvas extends Original {
      getRetinaScaling() {
        if (this.enableRetinaScaling === false) return 1;
        return retinaScale(this);
      }
    }

    Object.setPrototypeOf(StretchAwareCanvas, Original);
    Object.defineProperty(StretchAwareCanvas, '__stretchAwareRetinaPatched', { value: true });
    fabric[name] = StretchAwareCanvas;
  }

  patchCanvasClass('StaticCanvas');
  patchCanvasClass('Canvas');
  Object.defineProperty(fabric, '__stretchAwareRetinaInstalled', { value: true });

  globalThis.CrispFabricCanvas = {
    version: '20260804-1',
    maxRetinaScale: MAX_RETINA_SCALE
  };
})();
