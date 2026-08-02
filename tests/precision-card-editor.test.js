'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('visual-builder.js','utf8'),css=fs.readFileSync('visual-builder.css','utf8');
const state={books:[],sessions:[],visualTemplates:[]},context={globalThis:null,state,console,Date,Math,Number,String,Boolean,Array,Set,Map,saveState(){},renderAll(){}};context.globalThis=context;vm.runInNewContext(source,context);const B=context.VisualBuilder;

const narrow=B.createModule('metadata',{id:'author',customWidth:120,customHeight:44,dataBinding:{path:'author'},style:{minFontSize:6,maxFontSize:18,autoFit:true}});
assert.ok(B.fitTextSize(narrow,'Rebecca Yarros')<18,'auto-fit accounts for wrapping, labels, and available height');
narrow.style.autoFit=false;assert.equal(B.fitTextSize(narrow,'Rebecca Yarros'),18,'manual typography uses the selected maximum');

const movable=B.createModule('metadata',{id:'move',x:280,y:20,width:328,height:52,dataBinding:{path:'author'}}),moveTemplate=B.createTemplate({canvas:{width:420,height:380,grid:1,snap:false},modules:[movable]});
B.moveWithVisibleBounds(moveTemplate,'move',350,40,[{id:'move',x:280,y:20,width:70,height:30}]);
assert.deepEqual([moveTemplate.modules[0].x,moveTemplate.modules[0].y],[350,40],'freeform placement uses rendered bounds rather than stale design bounds');

const resizeTemplate=B.createTemplate({canvas:{width:420,height:380,grid:1,snap:false},modules:[B.createModule('metadata',{id:'resize',x:40,y:40,customWidth:120,customHeight:60})]});
B.commitDirectResize(resizeTemplate,{id:'resize',x:40,y:40,width:120,height:60,nextWidth:200,nextHeight:60});
assert.deepEqual([resizeTemplate.modules[0].width,resizeTemplate.modules[0].height],[200,60],'an edge resize changes one axis without stretching the other');

const broken=B.createTemplate({canvas:{width:640,height:480,size:'custom'},modules:[B.createModule('title',{id:'title',x:5,y:400,customWidth:50,customHeight:44,dataBinding:{path:'title'}}),B.createModule('metadata',{id:'author',x:500,y:420,customWidth:80,customHeight:44,dataBinding:{path:'author'}})]});
B.autoArrangeBookTemplate(broken);assert.ok(broken.modules.every(module=>module.sizingMode==='auto'&&module.customWidth===null&&module.customHeight===null));assert.ok(broken.modules.every(module=>module.x>=0&&module.y>=0&&module.x+module.width<=broken.canvas.width&&module.y+module.height<=broken.canvas.height),'arrange neatly repairs malformed saved geometry');

const styled=B.createModule('metadata',{id:'styled',style:{presentation:'pill',showLabel:false},dataBinding:{path:'author'}}),html=B.renderTemplateCanvas(B.createTemplate({modules:[styled]}),{id:'book',author:'Rebecca Yarros'});
assert.match(html,/data-module-presentation="pill"/);assert.doesNotMatch(html,/<small>Metadata<\/small>/,'labels can be hidden per module');
for(const hook of ['beginDirectCardInteraction','moveWithVisibleBounds','Saved to this card','Arrange neatly','data-inspect-presentation'])assert.ok(source.includes(hook),hook);
for(const style of ['data-module-presentation=pill','data-module-presentation=tag','data-module-presentation=button','data-module-presentation=card','builder-save-status','builder-resize-handle.is-n'])assert.ok(css.includes(style),style);

console.log('precise movement, one-axis resizing, typography fitting, save feedback, appearance styles, and layout recovery assertions passed');
