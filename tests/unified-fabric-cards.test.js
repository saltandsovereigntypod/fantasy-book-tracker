'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { console, setTimeout, clearTimeout, Date, Math, Number, String, Boolean, Array, Set, Map, JSON, globalThis: null };
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('canvas-editor.js', 'utf8'), context, { filename: 'canvas-editor.js' });
const C = context.CanvasEditor;
const book = { id: 'unified-1', title: 'Fourth Wing', author: 'Rebecca Yarros', series: 'The Empyrean', status: 'reading', progress: 42, rating: 4.5, spice: 3, impact: 5, coverUrl: 'cover.jpg' };
const template = { id: 'standard-book-card-v1', canvas: { width: 420, height: 380 }, modules: [] };

const standard = C.resolveCardScene(template, book, {});
for (const id of ['cover', 'title', 'author', 'series', 'status', 'progress', 'rating', 'spice', 'impact', 'actions']) {
  assert.ok(standard.objects.some(object => object.id === id), `standard scene contains ${id}`);
}
assert.equal(standard.width, 420);
assert.equal(standard.height, 380);
const actionGroup = standard.objects.find(object => object.cardRole === 'actions');
assert.ok(actionGroup.left >= 0 && actionGroup.left + actionGroup.width <= standard.width, 'standard actions remain inside card bounds');
assert.deepEqual(Array.from(actionGroup.actionButtons, action => action.actionId), ['start-reading', 'edit-book', 'progress-book', 'pin-book', 'complete-book']);
assert.match(C.actionOverlayHtml(standard, book, template.canvas), /data-action="start-reading"/);
assert.match(C.actionOverlayHtml(standard, book, template.canvas), /data-action="progress-book"/);

const source = JSON.parse(JSON.stringify(standard));
const sourceBefore = JSON.stringify(source);
const hidden = C.resolveCardScene({ ...template, fabricCanvasJson: source }, book, { visible: { cover: false, author: false, series: false, status: false, progress: false, rating: false, spice: false, impact: false, actions: false } });
for (const key of ['cover', 'author', 'series', 'status', 'progress', 'rating', 'spice', 'impact', 'actions']) {
  const object = hidden.objects.find(item => C.visibilityKey(item) === key);
  assert.equal(object.visible, false, `${key} is hidden at render time`);
}
assert.equal(C.actionOverlayHtml(hidden, book, template.canvas), '', 'hidden actions create no HTML controls');
assert.equal(JSON.stringify(source), sourceBefore, 'render-time visibility never mutates saved Fabric JSON');
const shown = C.resolveCardScene({ ...template, fabricCanvasJson: source }, book, { visible: { cover: true, author: true, progress: true, actions: true } });
assert.notEqual(shown.objects.find(object => object.id === 'cover').visible, false, 're-enabling restores original cover geometry');
assert.equal(shown.objects.find(object => object.id === 'cover').left, source.objects.find(object => object.id === 'cover').left);

const custom = { version: '6.0.0', width: 420, height: 380, objects: [{ type: 'Textbox', id: 'custom-title', left: 73, top: 44, width: 201, text: 'Old', dataBinding: { path: 'title' }, fontId: 'font-1', fontFamilyKey: 'private-font', fontStoragePath: 'user/font.woff2' }, { type: 'Image', id: 'asset', left: 1, top: 2, assetId: 'asset-1', assetStoragePath: 'user/asset.png' }] };
const resolvedCustom = C.resolveCardScene({ ...template, fabricCanvasJson: custom }, book, {});
assert.equal(resolvedCustom.objects[0].left, 73, 'existing edited geometry wins over standard scene');
assert.equal(resolvedCustom.objects[0].text, book.title);
assert.equal(resolvedCustom.objects[0].fontId, 'font-1');
assert.equal(resolvedCustom.objects[1].assetStoragePath, 'user/asset.png');
const completed = C.resolveCardScene(template, { ...book, status: 'completed' }, {});
assert.deepEqual(Array.from(completed.objects.find(object => object.cardRole === 'actions').actionButtons, action => action.label), ['Reread', 'Rate & Edit', 'Progress', 'Pin']);

context.state = { books: [book], sessions: [], visualTemplates: [] };
context.document = { querySelector: () => null, querySelectorAll: () => [] };
context.saveState = () => {};
context.renderAll = () => {};
context.esc = value => String(value).replace(/[&<>"']/g, '');
context.bookCardStats = () => ({ notesCount: 0, theoryCount: 0, dossierCount: 0, wallCount: 0 });
vm.runInNewContext(fs.readFileSync('visual-builder.js', 'utf8'), context, { filename: 'visual-builder.js' });
const html = context.VisualBuilder.renderBookCard(book, { visible: { author: false } });
assert.match(html, /fabric-card-canvas/, 'stock cards use saved Fabric rendering entry point');
assert.match(html, /fabric-card-action-overlay/, 'library cards render semantic HTML action overlay');
assert.doesNotMatch(html, /data-visual-module=/, 'stock cards no longer use the legacy card renderer');
assert.match(fs.readFileSync('app.js', 'utf8'), /addEventListener\('click',[^]+handleAction\(b\.dataset\.action,b\.dataset\.id\)/, 'overlay data-actions use the existing delegated application handler');
assert.match(fs.readFileSync('canvas-editor.js', 'utf8'), /setUniformScale\(canvas, element\.clientWidth \|\| width\)/, 'saved output uses the shared uniform scaling helper');
console.log('unified Fabric card scene assertions passed');
