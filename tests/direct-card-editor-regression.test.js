const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('visual-builder.js','utf8');
const css=fs.readFileSync('visual-builder.css','utf8');

assert.match(source,/data-action="view-book"/,'the whole rendered card opens the book even if a title module is awkward');
assert.match(source,/role="button"/,'the card shell keeps button semantics for opening profiles');
assert.match(source,/tabindex="0"/,'the card shell can be opened from the keyboard');
assert.match(source,/renderBookCard → renderCard/,'library cards use the shared renderer');

assert.match(css,/data-card-size=small\] \.visual-template-card\{--card-display-max:320px\}/);
assert.match(css,/data-card-size=medium\] \.visual-template-card\{--card-display-max:420px\}/);
assert.match(css,/data-card-size=large\] \.visual-template-card\{--card-display-max:640px\}/);
assert.match(css,/font-size:var\(--module-font-size\)/,'absolute card typography scales with the canvas');
assert.doesNotMatch(css,/font-size:max\(14px/,'small cards do not force desktop-sized title text');

console.log('direct card editor regression tests passed');
