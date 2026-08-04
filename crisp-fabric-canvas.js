(() => {
  'use strict';

  const fabric = globalThis.fabric?.Canvas ? globalThis.fabric : globalThis.fabric?.fabric;
  if (!fabric?.StaticCanvas || fabric.__displaySizedCanvasInstalled) return;

  const OriginalStaticCanvas = fabric.StaticCanvas;

  class DisplaySizedStaticCanvas extends OriginalStaticCanvas {
    constructor(element, options = {}) {
      super(element, { ...options, enableRetinaScaling: true });
      this.__crispDesignWidth = Number(options.width) || 420;
      this.__crispDesignHeight = Number(options.height) || 380;
      this.__crispSizing = false;
      this.__crispSizedWidth = 0;
      this.__crispSizedHeight = 0;
      this.__applyDisplaySize();
    }

    __isLibraryCard() {
      return Boolean(this.lowerCanvasEl?.closest?.('.fabric-card-viewport'));
    }

    __applyDisplaySize() {
      if (this.__crispSizing || !this.__isLibraryCard()) return;

      const viewport = this.lowerCanvasEl.closest('.fabric-card-viewport');
      const rect = viewport?.getBoundingClientRect?.();
      const displayWidth = Math.max(1, Math.round(rect?.width || 0));
      const displayHeight = Math.max(1, Math.round(rect?.height || 0));
      if (!displayWidth || !displayHeight) return;
      if (displayWidth === this.__crispSizedWidth && displayHeight === this.__crispSizedHeight) return;

      const designWidth = Number(this.__designWidth) || this.__crispDesignWidth || 420;
      const designHeight = Number(this.__designHeight) || this.__crispDesignHeight || 380;
      const scaleX = displayWidth / designWidth;
      const scaleY = displayHeight / designHeight;

      this.__crispSizing = true;
      try {
        super.setDimensions({ width: displayWidth, height: displayHeight });
        super.setViewportTransform([scaleX, 0, 0, scaleY, 0, 0]);

        if (this.lowerCanvasEl) {
          this.lowerCanvasEl.style.width = '100%';
          this.lowerCanvasEl.style.height = '100%';
        }

        this.__crispSizedWidth = displayWidth;
        this.__crispSizedHeight = displayHeight;
      } finally {
        this.__crispSizing = false;
      }
    }

    renderAll() {
      this.__applyDisplaySize();
      return super.renderAll();
    }

    requestRenderAll() {
      this.__applyDisplaySize();
      return super.requestRenderAll();
    }
  }

  Object.setPrototypeOf(DisplaySizedStaticCanvas, OriginalStaticCanvas);
  Object.defineProperty(DisplaySizedStaticCanvas, '__displaySizedCanvasPatched', { value: true });
  fabric.StaticCanvas = DisplaySizedStaticCanvas;
  Object.defineProperty(fabric, '__displaySizedCanvasInstalled', { value: true });

  globalThis.CrispFabricCanvas = {
    version: '20260804-2',
    method: 'display-sized-static-canvas'
  };
})();
