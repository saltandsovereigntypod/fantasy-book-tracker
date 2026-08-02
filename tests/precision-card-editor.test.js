'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('visual-builder.js','utf8'),css=fs.readFileSync('visual-builder.css','utf8');
const state={books:[],sessions:[],visualTemplates:[]},context={globalThis:null,state,console,Date,Math,Number,String,Boolean,Array,Set,Map,saveState(){},renderAll(){},__ABILITY_TEST__:true};
context.globalThis=context;vm.runInNewContext(source,context);const B=context.VisualBuilder;

const narrow=B.createModule('metadata',{id:'author',customWidth:120,customHeight:44,dataBinding:{path:'author'},style:{fontSize:18,minFontSize:6,maxFontSize:18,autoFit:true}});
assert.ok(B.fitTextSize(narrow,'Rebecca Yarros')<18,'auto-fit accounts for wrapping, labels, and available height');
narrow.style.autoFit=false;assert.equal(B.fitTextSize(narrow,'Rebecca Yarros'),18,'manual typography uses the selected maximum');
assert.equal(B.snapRotation(88),90,'rotation snaps near 90 degrees');
assert.equal(B.snapRotation(177),180,'rotation snaps near 180 degrees');
assert.equal(B.snapRotation(44),44,'rotation remains free away from snap points');

const movable=B.createModule('metadata',{id:'move',x:40,y:20,width:120,height:52,dataBinding:{path:'author'}});
const moveTemplate=B.createTemplate({canvas:{width:420,height:380,grid:1,snap:false},modules:[movable]});
B.moveModule(moveTemplate,'move',250,40);
assert.deepEqual([moveTemplate.modules[0].x,moveTemplate.modules[0].y],[250,40],'freeform placement respects exact unsnapped coordinates inside the canvas');

const resizeTemplate=B.createTemplate({canvas:{width:420,height:380,grid:1,snap:false},modules:[B.createModule('metadata',{id:'resize',x:40,y:40,customWidth:120,customHeight:60})]});
B.resizeModule(resizeTemplate,'resize',200,60);
assert.deepEqual([resizeTemplate.modules[0].width,resizeTemplate.modules[0].height],[200,60],'edge-style resizing can change width without stretching height');
B.moveModule(resizeTemplate,'resize',20,20);B.resizeModule(resizeTemplate,'resize',220,80);
assert.deepEqual([resizeTemplate.modules[0].x,resizeTemplate.modules[0].y,Math.round(resizeTemplate.modules[0].width),resizeTemplate.modules[0].height],[20,20,220,80],'corner-style resizing can change both axes after moving the box');

const broken=B.createTemplate({canvas:{width:640,height:480,size:'custom'},modules:[B.createModule('title',{id:'title',x:5,y:400,customWidth:50,customHeight:44,dataBinding:{path:'title'}}),B.createModule('metadata',{id:'author',x:500,y:420,customWidth:80,customHeight:44,dataBinding:{path:'author'}})]});
B.autoArrangeBookTemplate(broken);
assert.ok(broken.modules.every(module=>module.sizingMode==='custom'&&module.customWidth===module.width&&module.customHeight===module.height));
assert.ok(broken.modules.every(module=>module.x>=0&&module.y>=0&&module.x+module.width<=broken.canvas.width&&module.y+module.height<=broken.canvas.height),'arrange neatly repairs malformed saved geometry into fixed canvas boxes');

const portrait=B.createTemplate({type:'book-card',canvas:{width:640,height:900,size:'custom'},modules:[B.createModule('title',{id:'portrait-title',x:280,y:40,customWidth:328,customHeight:100,dataBinding:{path:'title'}})]});
B.normalizeBookCardCanvas(portrait,'medium');
assert.deepEqual([portrait.canvas.width,portrait.canvas.height,portrait.canvas.size],[420,380,'medium'],'book cards normalize away from accidental portrait editor canvases');
assert.ok(portrait.modules[0].x+portrait.modules[0].width<=portrait.canvas.width&&portrait.modules[0].y+portrait.modules[0].height<=portrait.canvas.height,'normalization keeps saved objects inside the card');

const styled=B.createModule('metadata',{id:'styled',style:{preset:'glass',fill:'var(--ui-accent-soft, var(--panel))',showLabel:false},dataBinding:{path:'author'}});
const html=B.renderTemplateCanvas(B.createTemplate({modules:[styled]}),{id:'book',author:'Rebecca Yarros'});
assert.match(html,/data-style-preset="glass"/,'existing modules render their selected appearance preset');
assert.match(html,/data-sizing-mode="custom"/,'live cards use fixed saved boxes instead of content-hugging auto boxes');
assert.match(html,/data-saved-sizing-mode="custom"/,'the renderer preserves the original saved sizing mode for auditing');

for(const hook of ['renderCard','data-editor-view','data-builder-zoom="fit"','data-builder-zoom="100"','data-upload-asset','data-template-preset','autoArrangeBookTemplate','normalizeBookCardCanvas','data-action="view-book"','data-saved-sizing-mode','const action=button.dataset.builderZoom','data-style-preset-quick','data-style-swatch','type="color"','builder-side-rail','builder-floating-toolbar','data-floating-action="duplicate"','data-floating-action="delete"','data-floating-action="rotate-left"','rotationSnap','applyEditorAction','editorContextMenuHtml','data-context-action','editorClipboard','stage.oncontextmenu','root.onkeydown'])
  assert.ok(source.includes(hook),hook);
assert.doesNotMatch(source,/querySelector\('\[data-builder-zoom-fit\]'\)\.onclick/,'zoom controls do not bind to missing selectors');

for(const style of ['Canvas parity repair','Canva workspace foundation','Canvas command menu','Production card guardrails','visual-card-viewport','data-style-preset=glass','data-style-preset=raised-panel','data-style-preset=pill','visual-book-actions button:after','builder-color-control','builder-color-swatches','builder-style-gallery','style-tile','builder-layers','builder-side-rail','builder-floating-toolbar','builder-context-menu','font-size:var(--module-font-size)','scrollbar-gutter:stable','visual-builder-backdrop>.modal'])
  assert.ok(css.includes(style),style);
assert.doesNotMatch(css,/font-size:max\(14px/,'small cards do not force desktop title text');
assert.doesNotMatch(css,/\.visual-book-module\{[^}]*container-type:size/,'modules do not create isolated size containers that make text measure against tiny boxes');

console.log('canvas card editor scaling, clickability, scroll rails, typography, and appearance assertions passed');
