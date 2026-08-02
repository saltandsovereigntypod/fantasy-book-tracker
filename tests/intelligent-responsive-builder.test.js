'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('visual-builder.js','utf8');
const css=fs.readFileSync('visual-builder.css','utf8');
const context={globalThis:null,console,Date,Math,Number,String,Boolean,Array,Set,Map};context.globalThis=context;
vm.runInNewContext(source,context,{filename:'visual-builder.js'});
const B=context.VisualBuilder;

const template=B.createTemplate({id:'responsive',canvas:{size:'medium',width:420,height:360,padding:16,grid:1,snap:false},modules:[B.createModule('title',{id:'title',x:100,y:50,width:200,height:80,style:{minFontSize:12,maxFontSize:24,letterSpacing:1,borderRadius:8}})]});
const title=template.modules[0],before={...title,style:{...title.style}};
const scale=B.scaleTemplate(template,640,480);
assert.equal(scale.scaleX,640/420);assert.equal(scale.scaleY,480/360);
assert.equal(title.x,before.x*scale.scaleX);assert.equal(title.y,before.y*scale.scaleY);assert.equal(title.width,before.width*scale.scaleX);assert.equal(title.height,before.height*scale.scaleY);
assert.equal(title.style.maxFontSize,before.style.maxFontSize*scale.scale,'typography scales with the coordinate system');
B.setCanvasPreset(template,'small');assert.equal(template.canvas.width,320);assert.equal(template.canvas.height,320);assert.ok(title.x+title.width<=320&&title.y+title.height<=220);

const anchored=B.createTemplate({id:'anchors',canvas:{width:420,height:360,grid:1,snap:false},modules:[
 B.createModule('image',{id:'cover',x:20,y:20,width:100,height:120}),
 B.createModule('title',{id:'anchored-title',x:136,y:20,width:200,height:50,anchor:{targetType:'module',targetId:'cover',horizontal:'after',vertical:'top',offsetX:16,offsetY:0}}),
 B.createModule('metadata',{id:'actions',x:20,y:290,width:380,height:50,anchor:{targetType:'card',horizontal:'center',vertical:'bottom',offsetX:0,offsetY:-20}})
]});
B.applyAnchors(anchored);assert.equal(anchored.modules[1].x,136);B.resizeModule(anchored,'cover',140,140);assert.equal(anchored.modules[1].x,176,'module anchor follows parent resize');B.scaleTemplate(anchored,640,480);assert.equal(Math.round(anchored.modules[2].y+anchored.modules[2].height-anchored.canvas.height),Math.round(anchored.modules[2].anchor.offsetY),'card-edge anchor survives card scaling');

const grouped=B.createTemplate({canvas:{width:640,height:480,grid:1,snap:false},modules:[B.createModule('title',{id:'one',x:20,y:20,width:100,height:60}),B.createModule('metadata',{id:'two',x:140,y:20,width:100,height:60})]});
const groupId=B.groupModules(grouped,['one','two'],'Header Group'),bounds=B.groupBounds(grouped,groupId);assert.equal(bounds.width,220);B.resizeModule(grouped,'one',200,120);assert.equal(grouped.modules[1].x,260);assert.equal(grouped.modules[1].width,200,'group children scale proportionally');B.lockModule(grouped,'one',true);assert.ok(grouped.modules.every(module=>module.locked));B.lockModule(grouped,'one',false);const duplicate=B.duplicateModule(grouped,'one');assert.ok(duplicate.groupId!==groupId);assert.equal(grouped.modules.filter(module=>module.groupId===duplicate.groupId).length,2);

const short=B.createModule('title',{width:260,height:90,style:{autoFit:true,minFontSize:10,maxFontSize:40,scalingCurve:.8}}),long=B.createModule('title',{width:260,height:90,style:{autoFit:true,minFontSize:10,maxFontSize:40,scalingCurve:1.4}});assert.ok(B.fitTextSize(short,'Wing')>B.fitTextSize(long,'Fourth Wing: A Very Long Empyrean Chronicle'));for(const module of [short,long]){const size=B.fitTextSize(module,'Test title');assert.ok(size>=module.style.minFontSize&&size<=module.style.maxFontSize);}

const legacy=B.normalizeTemplate({id:'legacy',schemaVersion:2,canvas:{width:420,height:360},modules:[{id:'old',type:'text',groupId:'old-group'}]});assert.equal(legacy.schemaVersion,5);assert.equal(legacy.groups[0].id,'old-group');assert.equal(legacy.modules[0].anchor.targetType,'none');assert.equal(legacy.modules[0].responsive.scale,'proportional');assert.equal(legacy.scalingRules.positions,'proportional');assert.deepEqual(B.normalizeTemplate(legacy),legacy,'schema migration is idempotent');
const standard=B.standardBookTemplate();for(const group of ['Header Region','Progress Region','Rating Region','Action Region'])assert.ok(standard.groups.some(item=>item.name===group),group);assert.ok(standard.modules.some(module=>module.anchor.targetType==='module'));assert.ok(standard.modules.some(module=>module.anchor.targetType==='card'));

const moveHandler=source.slice(source.indexOf("element.onpointermove=event=>"),source.indexOf("element.onpointerup=element.onpointercancel",source.indexOf("element.onpointermove=event=>")));assert.doesNotMatch(moveHandler,/moveModule|saveState|persist|render\(/,'drag frames only update visual transforms');assert.match(moveHandler,/style\.transform/);const resizeStart=source.indexOf("handle.onpointermove=event=>"),resizeHandler=source.slice(resizeStart,source.indexOf("handle.onpointerup=handle.onpointercancel",resizeStart));assert.doesNotMatch(resizeHandler,/resizeModule|saveState|persist|render\(/,'resize frames only update element styles');assert.match(source,/moveModule\(editorDraft,pending\.id/,'position commits once on release');assert.match(source,/resizeModule\(editorDraft,pending\.id/,'size commits once on release');
for(const hook of ['data-editing-mode="composer"','data-editing-mode="expert"','data-anchor-type','data-inspect-scaling-curve','data-preview-mode'])assert.ok(source.includes(hook),hook);
assert.match(css,/container-name:visual-card/);assert.match(css,/var\(--ui-accent/);assert.doesNotMatch(css.slice(css.indexOf('/* Intelligent responsive coordinate system')),/(#[0-9a-f]{3,8}|rgba?\()/i);
console.log('responsive scaling, anchors, group containers, text curves, migration, and drag performance assertions passed');
