'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const canvasSource=fs.readFileSync('canvas-editor.js','utf8'),builderSource=fs.readFileSync('visual-builder.js','utf8'),css=fs.readFileSync('visual-builder.css','utf8'),html=fs.readFileSync('index.html','utf8'),bridge=fs.readFileSync('supabase-bridge.js','utf8');

const canvasContext={globalThis:null,console,Date,Math,Number,String,Boolean,Array,Set,Map,JSON};
canvasContext.globalThis=canvasContext;
vm.runInNewContext(canvasSource,canvasContext,{filename:'canvas-editor.js'});
const CE=canvasContext.CanvasEditor,theme={surface:'#22130c',surfaceSoft:'#160d08',text:'#f7ead2',muted:'#c8a878',accent:'#bd662f',border:'#75451f'};
assert.equal(CE.FABRIC_VERSION,'6');
assert.equal(typeof CE.initCanvasEditor,'function');
assert.equal(typeof CE.serializeCanvas,'function');
assert.equal(typeof CE.setUniformScale,'function');
assert.equal(typeof CE.addShapeBox,'function');
assert.equal(typeof CE.addEditableTextBox,'function');
assert.equal(typeof CE.addBoundTextBox,'function');
assert.equal(typeof CE.addProgressSlider,'function');
assert.equal(typeof CE.applyCardPreset,'function');
assert.equal(typeof CE.applyAppearancePreset,'function');
assert.equal(typeof CE.addImageFromFile,'function');
assert.equal(typeof CE.deleteActiveElement,'function');
assert.equal(typeof CE.validScene,'function');
const scene=CE.baseScene({width:420,height:380,theme,record:{title:'Onyx Storm',author:'Rebecca Yarros',series:'The Empyrean',status:'completed',progress:100,rating:5,spice:2,impact:3}});
assert.ok(scene.objects.length>=8,'starter Fabric scene includes card modules');
const rebound=CE.bindRecord(scene,{title:'Fourth Wing',author:'Rebecca Yarros',series:'The Empyrean',status:'reading',progress:44,rating:4.5,spice:3,impact:5});
assert.equal(rebound.objects.find(item=>item.id==='title').text,'Fourth Wing');
assert.equal(rebound.objects.find(item=>item.id==='progress').text,'44%');
const fallback=CE.bindRecord({}, {title:'Onyx Storm',author:'Rebecca Yarros',series:'The Empyrean',status:'completed',progress:100,rating:5,spice:2,impact:3});
assert.equal(fallback.objects.find(item=>item.id==='title').text,'Onyx Storm','empty saved Fabric JSON falls back to starter book fields');
assert.equal(CE.validScene({}),null);
assert.ok(CE.validScene(scene));

let saves=0;
const detailedBook={id:'book',title:'Fourth Wing',author:'Rebecca Yarros',series:'The Empyrean',genres:['Romantasy'],tags:['dragons'],summary:'Violet goes to war college.',about:'Archive note',status:'completed',progress:100,rating:5,spice:2,impact:4,reaction:'Loved it',coverUrl:'cover.jpg',images:[{id:'img',url:'x'}],notes:[{id:'note',text:'Do not erase'}],metadata:{source:'manual'},visualTemplateId:''};
const state={libraryPreferences:{cardSize:'medium'},books:[detailedBook],sessions:[],visualTemplates:[]};
const builderContext={globalThis:null,state,console,Date,Math,Number,String,Boolean,Array,Set,Map,JSON,setTimeout,CanvasEditor:{bindRecord:CE.bindRecord},saveState(){saves++;},renderAll(){},bookCardStats(){return{notesCount:0,theoryCount:0,dossierCount:0,wallCount:0}}};
builderContext.globalThis=builderContext;
vm.runInNewContext(builderSource,builderContext,{filename:'visual-builder.js'});
const B=builderContext.VisualBuilder,saved=B.saveFabricBookTemplate(state.books[0],scene,{width:420,height:380,name:'Fourth Wing Fabric Card'});
assert.equal(saved.fabricCanvasJson.objects.length,scene.objects.length);
assert.equal(state.books[0].visualTemplateId,saved.id);
assert.equal(state.books[0].title,'Fourth Wing');
assert.equal(state.books[0].author,'Rebecca Yarros');
assert.deepEqual(state.books[0].genres,['Romantasy']);
assert.deepEqual(state.books[0].notes,[{id:'note',text:'Do not erase'}]);
assert.equal(state.books[0].coverUrl,'cover.jpg');
assert.ok(saves>0,'Fabric card save uses the existing state persistence pipeline');
const card=B.renderBookCard(state.books[0],{size:'medium'});
assert.match(card,/fabric-card-canvas/);
assert.match(card,/data-fabric-card-json=/);
assert.match(card,/CanvasEditor\.renderSavedCanvas|fabric-card-canvas/);
assert.doesNotMatch(card,/builder-card-canvas/,'Fabric-backed production cards do not render the old editor canvas');

for(const hook of ['initCanvasEditor','canvas.toJSON','canvas.setZoom','openBookCardEditor','data-fabric-save','data-fabric-upload','deleteActiveElement','fabricCanvasJson','data-fabric-field','addBoundTextBox','validScene','data-fabric-card-preset','data-fabric-appearance','data-fabric-prop','addProgressSlider','applyCardPreset'])
  assert.ok(canvasSource.includes(hook)||builderSource.includes(hook),hook);
for(const style of ['Fabric canvas editor','fabric-editor-sidebar','fabric-canvas-workspace','fabric-card-viewport','fabric-field-palette','fabric-editor-inspector','fabric-preset-grid'])
  assert.ok(css.includes(style),style);
assert.match(html,/fabric@6\/dist\/index\.min\.js/);
assert.match(bridge,/canvas-editor\.js', 'visual-builder\.js/);
console.log('Fabric canvas editor module, save pipeline, themed shell, and production render assertions passed');
