'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness({ failImages = false, alwaysFail = false } = {}) {
  const instances = [], errors = [];
  class StaticCanvas {
    constructor(element, options) { this.element = element; this.options = options; this.objects = []; this.disposed = false; this.width = options.width; this.height = options.height; instances.push(this); }
    async loadFromJSON(scene) {
      if (alwaysFail || (failImages && scene.objects.some(object => object.type === 'Image'))) throw new Error('image failed');
      this.objects = scene.objects.map(object => ({ ...object }));
    }
    getObjects() { return this.objects; }
    clear() { this.objects = []; }
    renderAll() {}
    requestRenderAll() {}
    setZoom(value) { this.zoom = value; }
    setDimensions(value) { this.dimensions = value; }
    getWidth() { return this.width; }
    getHeight() { return this.height; }
    dispose() { this.disposed = true; }
  }
  const context = { globalThis: null, console: { error: (...args) => errors.push(args), log: console.log }, Promise, JSON, Number, String, Math, Date, Set, Map, WeakMap, setTimeout, fabric: { Canvas: function(){}, StaticCanvas } };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync('canvas-editor.js', 'utf8'), context, { filename: 'canvas-editor.js' });
  return { C: context.CanvasEditor, instances, errors };
}

function host(scene, key, connected = true) {
  const overlay = { hidden: true }, fallback = { hidden: true, textContent: '' };
  const viewport = { dataset: {}, querySelector(selector) { return selector.includes('action-overlay') ? overlay : fallback; } };
  const element = { id: `canvas-${key}`, dataset: { fabricSceneKey: key, designWidth: '420', designHeight: '380' }, width: 420, height: 380, clientWidth: 210, isConnected: connected, closest() { return viewport; } };
  return { element, overlay, fallback, viewport };
}

(async () => {
  const { C, instances, errors } = harness({ failImages: true });
  const book = { id: 'stock', title: 'Iron Flame', author: 'Rebecca Yarros', series: 'The Empyrean', coverUrl: 'broken-cover.jpg', status: 'reading', progress: 40, rating: 4, spice: 3, impact: 5 };
  const template = { canvas: { width: 420, height: 380 } };
  const generated = C.resolveCardScene(template, book, {});
  assert.ok(generated.objects.length > 1);
  for (const id of ['cover','title','author','series','status','progress','rating','spice','impact','actions']) assert.ok(generated.objects.some(object => object.id === id));
  const key = C.registerRenderScene(generated, { bookId: book.id });
  const first = host(generated, key);
  const rendered = await C.renderSavedCanvas(first.element);
  assert.equal(rendered, instances[0]);
  assert.equal(instances[0].objects.some(object => object.id === 'title'), true, 'text survives a failed cover load');
  assert.equal(instances[0].objects.find(object => object.id === 'cover').type, 'Rect', 'failed cover becomes a placeholder');
  assert.equal(first.viewport.dataset.fabricRenderState, 'ready');
  assert.equal(first.overlay.hidden, false, 'actions appear only after paint succeeds');
  assert.ok(errors.some(entry => String(entry[0]).includes('loadFromJSON failed')), 'image failure includes contextual diagnostics');

  const savedScene = { version: '6', width: 420, height: 380, objects: [{ type: 'Textbox', id: 'saved', text: 'Edited' }] };
  const savedKey = C.registerRenderScene(savedScene);
  const savedHost = host(savedScene, savedKey);
  await C.renderSavedCanvas(savedHost.element);
  assert.equal(instances[1].objects[0].id, 'saved', 'saved Fabric scenes still load');

  const rerenderKey = C.registerRenderScene(generated);
  first.element.dataset.fabricSceneKey = rerenderKey;
  delete first.element.dataset.fabricRendered;
  await C.renderSavedCanvas(first.element);
  assert.equal(instances[0].disposed, true, 'rerender disposes the prior Fabric instance');

  const disconnectedKey = C.registerRenderScene(generated);
  const disconnected = host(generated, disconnectedKey, false);
  assert.equal(await C.renderSavedCanvas(disconnected.element), null, 'detached async renders cannot publish stale output');
  assert.equal(disconnected.overlay.hidden, true);

  const failedHarness = harness({ alwaysFail: true });
  const failedKey = failedHarness.C.registerRenderScene(generated);
  const failed = host(generated, failedKey);
  await assert.rejects(failedHarness.C.renderSavedCanvas(failed.element));
  // renderSavedCanvases owns the visible failure state; exercise it with a real host collection.
  const failedKey2 = failedHarness.C.registerRenderScene(generated);
  const failed2 = host(generated, failedKey2);
  failedHarness.C.renderSavedCanvases({ querySelectorAll: () => [failed2.element] });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(failed2.viewport.dataset.fabricRenderState, 'failed');
  assert.equal(failed2.overlay.hidden, true);
  assert.equal(failed2.fallback.hidden, false, 'failure shows a visible fallback instead of a blank shell');
  assert.ok(failedHarness.errors.some(entry => String(entry[0]).includes('card render failed')), 'terminal failures include card context');

  const builderContext = { ...harness().C, globalThis: null };
  const context = { globalThis: null, CanvasEditor: C, state: { books: [], sessions: [], visualTemplates: [] }, console, Date, Math, Number, String, Boolean, Array, Set, Map, JSON, saveState(){}, renderAll(){}, bookCardStats(){ return {notesCount:0,theoryCount:0,dossierCount:0,wallCount:0}; } };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync('visual-builder.js','utf8'), context);
  const cards = ['Iron Flame','Fourth Wing','Onyx Storm'].map((title,index) => context.VisualBuilder.renderBookCard({ ...book, id: `book-${index}`, title }));
  const ids = cards.map(html => html.match(/id="(fabric-library-[^"]+)"/)[1]);
  assert.equal(new Set(ids).size, 3, 'multiple stock cards receive unique Fabric hosts');
  assert.ok(cards.every(html => /data-fabric-scene-key=/.test(html) && /fabric-card-action-overlay" hidden/.test(html)));
  console.log('Fabric library render lifecycle assertions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
