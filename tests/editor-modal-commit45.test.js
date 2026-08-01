'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const wall=fs.readFileSync('infinite-wall.js','utf8');
const builder=fs.readFileSync('visual-builder.js','utf8');
const builderCss=fs.readFileSync('visual-builder.css','utf8');
const editorCss=fs.readFileSync('dossier-experience.css','utf8');

const bodyClasses=new Set(['modal-open']);
const appElement={inert:true};
const modalClasses=new Set();
const modalAttributes={};
const hosts={app:appElement};
const context={
  __ABILITY_TEST__:true,console,setTimeout,clearTimeout,
  localStorage:{getItem:()=>null,setItem:()=>{}},
  document:{
    body:{classList:{add:name=>bodyClasses.add(name),remove:name=>bodyClasses.delete(name)}},
    getElementById:id=>hosts[id]||null
  },
  globalThis:null
};
context.globalThis=context;
vm.runInNewContext(app,context,{filename:'app.js'});
assert.doesNotThrow(()=>context.closeModal(),'a missing modal host is a safe no-op');
assert.equal(bodyClasses.has('modal-open'),false,'closing restores body scrolling even without a host');
assert.equal(appElement.inert,false,'closing restores application interactivity');
assert.equal(context.openModal(),false,'opening without a host reports failure');
hosts.formModal={classList:{add:name=>modalClasses.add(name),remove:name=>modalClasses.delete(name)},setAttribute:(name,value)=>{modalAttributes[name]=value;}};
assert.equal(context.openModal(),true);
assert.equal(modalClasses.has('is-open'),true);
assert.equal(modalAttributes['aria-hidden'],'false');
assert.equal(context.closeModal(),true);
assert.equal(modalClasses.has('is-open'),false);
assert.equal(modalAttributes['aria-hidden'],'true');

assert.match(wall,/host\?\.classList\?\.remove/);
assert.match(wall,/focusTarget\?\.focus\?\.\(\)/);
assert.match(wall,/event\.key==='Escape'/);
assert.match(wall,/VisualBuilder\?\.discardDraft\?\.\(\)/,'X and Escape discard a builder draft');

assert.match(app,/class="book-editor-tabs"/);
for(const section of ['Overview','Reading','Ratings & Trackers','Connections','Card Design','Danger Zone'])assert.ok(app.includes(`'${section}'`),section);
assert.match(app,/existing\?JSON\.parse\(JSON\.stringify\(existing\)\):\{\}/,'book editor starts from a detached draft');
assert.match(app,/cancelBook'\)\.onclick=\(\)=>closeModal\(\)/,'Cancel only closes the detached draft');
assert.match(app,/Object\.assign\(existing,data\)/,'Save commits the collected draft fields');

const canonical={id:'template-one',name:'Canonical',type:'generic',canvas:{width:400,height:300},modules:[]};
const state={visualTemplates:[canonical],books:[]};
let saves=0;
const builderContext={globalThis:null,state,console,Date,Math,Number,String,Boolean,Array,Set,Map,saveState:()=>saves++,renderAll:()=>{},document:{querySelector:()=>null}};
builderContext.globalThis=builderContext;
vm.runInNewContext(builder,builderContext,{filename:'visual-builder.js'});
const B=builderContext.VisualBuilder;
const savesBeforeDraft=saves;
const canonicalTemplate=()=>state.visualTemplates.find(template=>template.id==='template-one');
let draft=B.beginDraft(canonicalTemplate());
draft.name='Cancelled name';
B.discardDraft();
assert.equal(canonicalTemplate().name,'Canonical','discard leaves the canonical template unchanged');
draft=B.beginDraft(canonicalTemplate());
draft.name='Saved name';
B.commitDraft();
assert.equal(canonicalTemplate().name,'Saved name','Save replaces the canonical template with the draft');
assert.equal(saves-savesBeforeDraft,1,'template commit persists once');

for(const layout of ['list','cards'])assert.match(builderCss,new RegExp(`data-library-layout="${layout}"`));
for(const size of ['small','medium','large'])assert.match(builderCss,new RegExp(`data-card-size="${size}"`));
assert.match(builderCss,/--template-card-block-size/,'list and cards share template size tokens');
assert.match(editorCss,/\.book-editor-tabs/);
assert.match(editorCss,/var\(--ui-surface/);
assert.doesNotMatch(editorCss.slice(editorCss.indexOf('/* Transactional book editor')),/(#[0-9a-f]{3,8}|rgba?\()/i);

console.log('Commit 4.5 modal, editor draft, builder draft, and shared sizing assertions passed');
