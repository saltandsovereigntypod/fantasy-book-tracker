'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const canvas = fs.readFileSync('canvas-editor.js', 'utf8');

for (const helper of [
  'function textObjectsFromTarget',
  'function selectedTextObjects',
  'function applyToSelectedText',
  'function applyImageTint'
]) assert.match(canvas, new RegExp(helper), `${helper} should exist`);

assert.match(canvas, /childObjects\(object\)\.forEach\(visit\)/, 'text lookup should recurse into grouped fields');
assert.match(canvas, /applyToSelectedText\(editor\.canvas, object => object\.set\('fontFamily'/, 'font picker should apply to every selected text object');
assert.match(canvas, /applyToSelectedText\(editor\.canvas, object => object\.set\('textAlign'/, 'text alignment should apply to every selected text object');
assert.match(canvas, /applyToSelectedText\(editor\.canvas, object => object\.set\('fill'/, 'text color should apply to every selected text object');
assert.match(canvas, /if \(!selectedTextObjects\(editor\.canvas\)\.length\) throw new Error\('Select a text object before applying a font\.'\)/, 'uploaded fonts should accept grouped or bound text selections');
assert.match(canvas, /const activeTextObjects = selectedTextObjects\(editor\.canvas\)/, 'inspector should reveal text tools for grouped or bound text selections');
assert.match(canvas, /if \(isImageObject\(object\)\) applyImageTint\(object, color\)/, 'universal color wheel should tint uploaded images');
assert.match(canvas, /fabric\.filters\?\.BlendColor/, 'image tint should use Fabric image filters when available');

console.log('visual text selection tool assertions passed');
