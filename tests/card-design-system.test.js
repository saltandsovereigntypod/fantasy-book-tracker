'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('visual-builder.js','utf8');
const css=fs.readFileSync('visual-builder.css','utf8');
const state={books:[{id:'book',title:'Fourth Wing',author:'Rebecca Yarros',series:'The Empyrean',status:'reading',progress:50,rating:4.5,spice:3,impact:4,trackerValues:{}}],sessions:[],visualTemplates:[]};
const context={globalThis:null,state,console,Date,Math,Number,String,Boolean,Array,Set,Map,saveState:()=>{},renderAll:()=>{},bookCardStats:()=>({notesCount:0,theoryCount:0,dossierCount:0,wallCount:0})};context.globalThis=context;
vm.runInNewContext(source,context,{filename:'visual-builder.js'});
const B=context.VisualBuilder;
assert.deepEqual(Object.keys(B.CARD_SIZES),['small','medium','large']);
const template=B.createTemplate({id:'design',canvas:{size:'medium',...B.CARD_SIZES.medium,grid:10,snap:true},modules:[
  B.createModule('title',{id:'title',x:11,y:13,width:180,height:60,dataBinding:{path:'title'}}),
  B.createModule('metadata',{id:'author',x:230,y:90,width:120,height:50,dataBinding:{path:'author'}}),
  B.createModule('metadata',{id:'series',x:230,y:170,width:120,height:50,dataBinding:{path:'series'}})
]});
B.moveModule(template,'title',399,359);assert.equal(template.modules[0].x,240,'movement clamps to card width');assert.equal(template.modules[0].y,300,'movement clamps to card height');
B.resizeModule(template,'title',999,999);assert.equal(template.modules[0].width,180);assert.equal(template.modules[0].height,60);
B.moveModule(template,'title',10,10);const group=B.groupModules(template,['title','author']);assert.ok(group);B.moveModule(template,'title',30,30);assert.equal(template.modules[1].x,250,'group moves together');B.lockModule(template,'title',true);assert.equal(template.modules[1].locked,true,'group locks together');B.lockModule(template,'title',false);const groupCopy=B.duplicateModule(template,'title');assert.ok(groupCopy.groupId&&groupCopy.groupId!==group);assert.equal(template.modules.filter(module=>module.groupId===groupCopy.groupId).length,2,'group duplicates together');
B.ungroupModule(template,'title');assert.equal(template.modules[0].groupId,'');
B.alignModules(template,['author','series'],'left');assert.equal(template.modules.find(module=>module.id==='author').x,template.modules.find(module=>module.id==='series').x);
const title=template.modules.find(module=>module.id==='title'),oldLayer=title.layer;B.layerModule(template,'title','front');assert.ok(title.layer>=oldLayer);assert.equal(template.modules.at(-1).id,'title');
assert.equal(B.fitTextSize(B.createModule('title',{width:300,height:100,style:{autoFit:true,minFontSize:12,maxFontSize:40}}),'Fourth Wing'),40);assert.ok(B.fitTextSize(B.createModule('title',{width:80,height:44,style:{autoFit:true,minFontSize:10,maxFontSize:40}}),'A deliberately very long title')<20);
B.setCanvasPreset(template,'small');assert.equal(template.canvas.width,320);assert.equal(template.canvas.height,220);template.modules.forEach(module=>{assert.ok(module.x>=0&&module.y>=0);assert.ok(module.x+module.width<=320);assert.ok(module.y+module.height<=220);});
const standard=B.standardBookTemplate();assert.equal(standard.name,'Standard Book Card');for(const path of ['coverUrl','title','author','series','status','progress','rating','spice','impact','$actions'])assert.ok(standard.modules.some(module=>module.dataBinding.path===path),path);
const personal=B.normalizeTemplate({...JSON.parse(JSON.stringify(standard)),id:'personal',name:"Ash's Custom Card"});personal.modules[0].x=99;assert.notEqual(standard.modules[0].x,personal.modules[0].x,'personal template is isolated from the standard template');
state.visualTemplates.push(standard);state.books[0].visualTemplateId=standard.id;const card=B.renderBookCard(state.books[0]);const canvas=B.renderTemplateCanvas(standard,state.books[0]);assert.ok(card.includes(canvas),'the final card embeds the shared canvas renderer');
assert.match(source,/renderTemplateCanvas\(editorDraft,record,\{editor:true\}\)/,'builder calls shared renderer');assert.match(source,/renderTemplateCanvas\(template,book,\{visible,presentation\}\)/,'library card calls shared renderer');
for(const control of ['data-align','data-layer','data-group-module','data-builder-redo','data-preview-mode','data-canvas-snap'])assert.ok(source.includes(control),control);
for(const typography of ['autoFit','minFontSize','maxFontSize','alignment','lineHeight','letterSpacing','fontWeight','overflow'])assert.ok(source.includes(typography),typography);
for(const variable of ['--ui-surface','--ui-border','--ui-accent','--ui-focus'])assert.ok(css.includes(`var(${variable}`),variable);
assert.doesNotMatch(css.slice(css.indexOf('/* True card designer')),/(#[0-9a-f]{3,8}|rgba?\()/i);
console.log('true card canvas, shared renderer, grouping, alignment, layers, and text fitting assertions passed');
