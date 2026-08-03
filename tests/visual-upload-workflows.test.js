'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const canvas = fs.readFileSync('canvas-editor.js', 'utf8');
const assets = fs.readFileSync('visual-assets.js', 'utf8');
const fonts = fs.readFileSync('visual-fonts.js', 'utf8');
const bridge = fs.readFileSync('supabase-bridge.js', 'utf8');
const migration = fs.readFileSync('migrations/202608030001_private_visual_libraries.sql', 'utf8');

assert.match(canvas, /data-fabric-asset-filename/);
assert.match(canvas, /data-fabric-asset-submit disabled/);
assert.match(canvas, /data-fabric-font-filename/);
assert.match(canvas, /data-fabric-font-submit disabled/);
assert.match(canvas, /Ready to upload\./);
assert.match(canvas, /Retry Library Refresh/);
assert.match(canvas, /No elements match the current search or category filter\./);
assert.match(canvas, /No reusable elements uploaded yet\./);
assert.match(canvas, /No custom fonts uploaded yet\./);
assert.match(canvas, /VisualAssets\.validate\(assetUploadFile\)/);
assert.match(canvas, /VisualAssets\.uploadAsset\(file/);
assert.match(canvas, /VisualFonts\.validate\(fontUploadFile\)/);
assert.match(canvas, /VisualFonts\.uploadFont\(file/);
assert.match(canvas, /VisualFonts\.loadFont\(font\)/);
assert.match(canvas, /fontButton\.disabled = fontUploading \|\| !fontUploadFile \|\| !license/);

const assetChangeHandler = canvas.slice(canvas.indexOf("document.querySelector('[data-fabric-asset-upload]')"), canvas.indexOf("document.querySelector('[data-fabric-asset-submit]')"));
assert.doesNotMatch(assetChangeHandler, /uploadAsset\(/, 'choosing an element file must not auto-upload');
const fontChangeHandler = canvas.slice(canvas.indexOf("document.querySelector('[data-fabric-font-upload]')"), canvas.indexOf("document.querySelector('[data-fabric-font-license]')"));
assert.doesNotMatch(fontChangeHandler, /uploadFont\(/, 'choosing a font file must not auto-upload');

for (const source of [assets, fonts, bridge]) {
  assert.match(source, /console\.error/);
}
assert.match(assets, /Element validation failed/);
assert.match(assets, /Element upload failed/);
assert.match(fonts, /Font validation failed/);
assert.match(fonts, /Saving font record/);
assert.match(fonts, /FontFace load failed/);
assert.match(bridge, /storage upload failed/);
assert.match(bridge, /metadata insert failed; removing uploaded object/);
assert.match(bridge, /remove\(\[path\]\)/);

assert.match(migration, /visual-assets/);
assert.match(migration, /custom-fonts/);
assert.match(migration, /create table if not exists public\.visual_assets/);
assert.match(migration, /create table if not exists public\.custom_fonts/);
assert.match(migration, /auth\.uid\(\)=user_id/);
assert.match(migration, /storage\.foldername\(name\)\)\[1\]=auth\.uid\(\)::text/);

console.log('visual upload workflow assertions passed');
