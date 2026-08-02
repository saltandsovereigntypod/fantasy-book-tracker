const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('visual-builder.js','utf8');
const css=fs.readFileSync('visual-builder.css','utf8');

assert.match(source,/function selectBuilderModuleFromPointer\(event\)/,'editor selects a module before pointer-up redraws it');
assert.match(source,/document\.addEventListener\('pointerdown',selectBuilderModuleFromPointer,true\)/,'selection runs in the capture phase');
assert.match(source,/classList\.toggle\('is-selected',active\)/,'pointer selection immediately exposes the resize handles');

const directStart=css.lastIndexOf('Direct-on-card editing'),directEnd=css.indexOf('Precise editor controls',directStart),directEditing=css.slice(directStart,directEnd);
assert.match(directEditing,/data-card-size=small\]\{grid-template-columns:repeat\(auto-fill,320px\)/);
assert.match(directEditing,/data-card-size=medium\]\{grid-template-columns:repeat\(auto-fill,420px\)/);
assert.match(directEditing,/data-card-size=large\]\{grid-template-columns:repeat\(auto-fill,640px\)/);
assert.doesNotMatch(directEditing,/minmax\([^)]*,1fr\)/,'card sizes do not stretch into identical flexible tracks');
assert.match(directEditing,/is-builder-module:hover/,'all card objects have visible editor affordances');

console.log('direct card editor regression tests passed');
