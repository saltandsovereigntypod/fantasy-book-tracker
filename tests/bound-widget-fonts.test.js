'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('canvas-editor.js','utf8');
let loads=0,renders=0;
const context={globalThis:null,console,Set,Map,Promise,JSON,Number,String,Math,Date,document:{addEventListener(){}},window:{},Image:function(){},VisualFonts:{loadFont:async()=>{loads++;}}};context.globalThis=context;vm.runInNewContext(source,context);const C=context.CanvasEditor;
const text=(type='Textbox',extra={})=>({type,fontFamily:'Libre Baskerville',dataBinding:{path:'title'},...extra,set(key,value){if(typeof key==='string')this[key]=value;else Object.assign(this,key);},initDimensions(){this.dimensions=(this.dimensions||0)+1;},setCoords(){this.coords=(this.coords||0)+1;}});
const title=text('Textbox'),author=text('IText',{dataBinding:{path:'author'}}),rating=text('Text',{sliderConfig:{path:'rating',value:4.5}}),progress=text('Textbox',{sliderConfig:{path:'progress',value:70}}),shape={type:'Rect',fill:'red'},icon={type:'Path',stroke:'blue'},group={type:'Group',objects:[rating,progress,shape,icon],setCoords(){this.coords=(this.coords||0)+1;}},selection={type:'activeSelection',objects:[title,author,group],getObjects:()=>[title,author,group],setCoords(){this.coords=(this.coords||0)+1;}},canvas={requestRenderAll(){renders++;}};
(async()=>{
 const collected=C.collectTextObjects(selection);assert.equal(collected.length,4);assert.equal(collected[0],title);assert.equal(collected[3],progress);
 assert.equal(await C.applyFontToSelection(canvas,title,'Georgia'),1);assert.equal(title.fontFamily,'Georgia');assert.equal(title.dataBinding.path,'title');
 const font={id:'font-1',family_name:'UserFont_1',storage_path:'owner/font-1/font.woff2'};assert.equal(await C.applyFontToSelection(canvas,selection,font.family_name,font),4);assert.equal(loads,1);
 for(const object of [title,author,rating,progress]){assert.equal(object.fontFamily,'UserFont_1');assert.equal(object.fontId,'font-1');assert.equal(object.fontFamilyKey,'UserFont_1');assert.equal(object.fontStoragePath,font.storage_path);assert.ok(object.dimensions&&object.coords);}
 assert.equal(shape.fill,'red');assert.equal(icon.stroke,'blue');assert.ok(group.coords&&selection.coords);assert.equal(rating.sliderConfig.value,4.5);assert.equal(progress.sliderConfig.value,70);const customSaved=C.serializeCanvas({toJSON:()=>({objects:[selection]})});assert.equal(customSaved.objects[0].objects[1].fontId,'font-1');assert.equal(customSaved.objects[0].objects[2].objects[0].fontStoragePath,font.storage_path);
 await C.applyFontToSelection(canvas,selection,'Arial');for(const object of [title,author,rating,progress]){assert.equal(object.fontFamily,'Arial');assert.equal(object.fontId,undefined);assert.equal(object.fontFamilyKey,undefined);assert.equal(object.fontStoragePath,undefined);}
 const saved=C.serializeCanvas({toJSON:()=>({objects:[selection]})});assert.equal(saved.objects[0].objects[0].fontFamily,'Arial');assert.equal(renders,3);
 console.log('bound fields, grouped widgets, multiple selection, metadata clearing, and font persistence assertions passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
