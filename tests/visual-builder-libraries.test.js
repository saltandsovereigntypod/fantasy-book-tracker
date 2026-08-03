'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const builder = fs.readFileSync('visual-builder.js', 'utf8');
const fieldsSource = fs.readFileSync('visual-fields.js', 'utf8');
const canvas = fs.readFileSync('canvas-editor.js', 'utf8');
const assets = fs.readFileSync('visual-assets.js', 'utf8');
const fonts = fs.readFileSync('visual-fonts.js', 'utf8');
const bridge = fs.readFileSync('supabase-bridge.js', 'utf8');
const migration = fs.readFileSync('migrations/202608030001_private_visual_libraries.sql', 'utf8');

const fieldContext = { globalThis: null };
fieldContext.globalThis = fieldContext;
vm.runInNewContext(fieldsSource, fieldContext);
const fields = fieldContext.VisualFields.fields();
for (const path of ['coverUrl', 'title', 'author', 'series', 'status', 'progress', 'rating', 'spice', 'impact', 'reaction', 'summary', 'about', 'genres', 'tags', 'linkedDossierIds', 'linkedTheoryIds', 'linkedWallIds', 'trackerValues', 'customTracker']) {
  assert.ok(fields.some(field => field.path === path || field.id === path), path);
}

for (const hook of ['data-fabric-field', 'data-fabric-asset-upload', 'data-fabric-asset-submit', 'data-fabric-font-upload', 'data-fabric-font-submit', 'data-fabric-font-family', 'data-fabric-new-font', 'assetId', 'assetStoragePath', 'fontId', 'fontFamilyKey', 'renderAssetLibrary', 'renderFontLibrary', 'refreshLibraries']) {
  assert.ok(canvas.includes(hook), hook);
}

assert.match(builder, /createBoundModule/);
assert.match(builder, /globalThis\.VisualBuilder/);
assert.match(bridge, /'visual-fields\.js', 'visual-assets\.js', 'visual-fonts\.js', 'canvas-editor\.js', 'visual-builder\.js'/);

assert.match(assets, /8 \* 1024 \* 1024/);
assert.match(assets, /image\/png/);
assert.doesNotMatch(assets, /image\/svg/);
assert.match(fonts, /5 \* 1024 \* 1024/);
assert.match(fonts, /licenseConfirmed/);
assert.match(fonts, /new FontFace/);
assert.match(migration, /auth\.uid\(\)=user_id/);
assert.match(migration, /public\s*=\s*false/);

const state = { books: [], sessions: [], visualTemplates: [] };
const context = { __ABILITY_TEST__: true, globalThis: null, state, console, Date, Math, Number, String, Boolean, Array, Set, Map };
context.globalThis = context;
vm.runInNewContext(builder, context);
const B = context.VisualBuilder;
const field = fieldContext.VisualFields.byId('title');
const fieldModule = B.createModule(field.moduleType, { id: 'field', dataBinding: { path: field.path } });
const assetModule = B.createModule('uploaded-image', { id: 'asset', config: { assetId: 'owned-asset', assetStoragePath: 'user/asset/file.png', src: '' } });
const fontModule = B.createModule('decorative-text', { id: 'font', style: { fontFamily: 'UserFont_safe' }, config: { fontId: 'owned-font', fontFamilyKey: 'UserFont_safe' } });
const saved = B.normalizeTemplate({ id: 'libraries', modules: [fieldModule, assetModule, fontModule] });
const reopened = B.normalizeTemplate(JSON.parse(JSON.stringify(saved)));
assert.deepEqual(reopened.modules.map(module => ({ id: module.id, type: module.type, binding: module.dataBinding.path, assetId: module.config.assetId, fontId: module.config.fontId, fontFamily: module.style.fontFamily })), saved.modules.map(module => ({ id: module.id, type: module.type, binding: module.dataBinding.path, assetId: module.config.assetId, fontId: module.config.fontId, fontFamily: module.style.fontFamily })));
console.log('VisualBuilder reusable library assertions passed');
