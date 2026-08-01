(() => {
  'use strict';

  const BUILDER_SCHEMA_VERSION = 1;
  const MODULE_TYPES = [
    'text','image','title','metadata','rating','slider','progress','stars','icons','counter',
    'linked-record','linked-dossier','linked-theory','relationship-count','quote','notes','tags','custom'
  ];
  const TRACKER_TYPES = ['rating','slider','progress','stars','icons','counter'];
  const MIN_MODULE_WIDTH = 80;
  const MIN_MODULE_HEIGHT = 56;
  const histories = new Map();
  let activeTemplateId = '';
  let selectedModuleIds = new Set();
  let interaction = null;
  let builderContext = {recordType:'generic',recordId:''};

  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value, min)));
  const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  function normalizeModule(module = {}, index = 0) {
    const type = MODULE_TYPES.includes(module.type) ? module.type : 'custom',config={...cleanObject(module.config)};
    if(TRACKER_TYPES.includes(type)||config.tracker){const tracker=cleanObject(config.tracker);config.tracker={id:String(tracker.id||module.id||`tracker-${index}`),name:String(tracker.name||module.name||'Custom Tracker'),type:String(tracker.type||type),min:number(tracker.min??config.min,0),max:number(tracker.max??config.max,5),step:Math.max(.01,number(tracker.step??config.step,1)),icon:String(tracker.icon||config.icon||''),displayStyle:String(tracker.displayStyle||module.style?.display||'default'),valueBinding:String(tracker.valueBinding||module.dataBinding?.path||''),themeBehavior:String(tracker.themeBehavior||'inherit'),profile:Boolean(tracker.profile)};}
    return {
      id: String(module.id || `module-${index}`),
      type,
      name: String(module.name || type.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase())),
      x: number(module.x, 24),
      y: number(module.y, 24),
      width: clamp(module.width ?? 220, MIN_MODULE_WIDTH, 1600),
      height: clamp(module.height ?? 120, MIN_MODULE_HEIGHT, 1200),
      rotation: clamp(module.rotation ?? 0, -180, 180),
      locked: Boolean(module.locked),
      style: {...cleanObject(module.style)},
      dataBinding: {...cleanObject(module.dataBinding)},
      config
    };
  }

  function normalizeTemplate(template = {}, index = 0) {
    const createdAt = number(template.createdAt, Date.now());
    return {
      id: String(template.id || `template-${index}`),
      name: String(template.name || 'Untitled Visual Template'),
      type: String(template.type || 'generic'),
      canvas: {
        width: clamp(template.canvas?.width ?? 900, 280, 2400),
        height: clamp(template.canvas?.height ?? 620, 240, 2400),
        grid: clamp(template.canvas?.grid ?? 8, 1, 100),
        background: String(template.canvas?.background || 'surface')
      },
      modules: (Array.isArray(template.modules) ? template.modules : []).map(normalizeModule),
      theme: {mode:'inherit', ...cleanObject(template.theme)},
      target: {recordType:String(template.target?.recordType || 'generic'), recordId:String(template.target?.recordId || '')},
      createdAt,
      updatedAt: number(template.updatedAt, createdAt),
      schemaVersion: BUILDER_SCHEMA_VERSION
    };
  }

  function normalizeTemplates(templates) {
    const seen = new Set();
    return (Array.isArray(templates) ? templates : []).map(normalizeTemplate).filter(template => {
      if (seen.has(template.id)) return false;
      seen.add(template.id);
      return true;
    });
  }

  function createTemplate(values = {}) {
    return normalizeTemplate({id:values.id || makeId('template'), createdAt:Date.now(), updatedAt:Date.now(), ...values});
  }

  function createModule(type = 'text', values = {}) {
    return normalizeModule({id:values.id || makeId('module'), type, ...values});
  }

  function moduleById(template, moduleId) { return template?.modules.find(module => module.id === moduleId); }
  function moveModule(template, moduleId, x, y) { const module=moduleById(template,moduleId);if(!module||module.locked)return null;module.x=number(x,module.x);module.y=number(y,module.y);template.updatedAt=Date.now();return module; }
  function resizeModule(template, moduleId, width, height) { const module=moduleById(template,moduleId);if(!module||module.locked)return null;module.width=clamp(width,MIN_MODULE_WIDTH,1600);module.height=clamp(height,MIN_MODULE_HEIGHT,1200);template.updatedAt=Date.now();return module; }
  function deleteModule(template, moduleId) { const length=template.modules.length;template.modules=template.modules.filter(module=>module.id!==moduleId);if(template.modules.length!==length)template.updatedAt=Date.now();return template.modules.length!==length; }
  function duplicateModule(template, moduleId) { const source=moduleById(template,moduleId);if(!source)return null;const copy=normalizeModule({...JSON.parse(JSON.stringify(source)),id:makeId('module'),name:`${source.name} copy`,x:source.x+24,y:source.y+24,locked:false});template.modules.push(copy);template.updatedAt=Date.now();return copy; }
  function lockModule(template, moduleId, locked=true) { const module=moduleById(template,moduleId);if(!module)return null;module.locked=Boolean(locked);template.updatedAt=Date.now();return module; }
  function updateModuleStyle(template,moduleId,style={}) { const module=moduleById(template,moduleId);if(!module)return null;module.style={...module.style,...cleanObject(style)};template.updatedAt=Date.now();return module; }

  function ensureState() {
    if(Array.isArray(state.visualTemplates)&&state.visualTemplates.every(template=>template?.schemaVersion===BUILDER_SCHEMA_VERSION&&Array.isArray(template.modules)))return state.visualTemplates;
    const normalized = normalizeTemplates(state.visualTemplates);
    state.visualTemplates = normalized;
    return normalized;
  }

  function persist() { saveState(); }
  function activeTemplate() { return ensureState().find(template=>template.id===activeTemplateId); }
  function snapshot(template) { const stack=histories.get(template.id)||[];stack.push(JSON.stringify(template));if(stack.length>30)stack.shift();histories.set(template.id,stack); }
  function undo(template) { const stack=histories.get(template.id)||[];const previous=stack.pop();if(!previous)return false;const restored=normalizeTemplate(JSON.parse(previous));const index=state.visualTemplates.findIndex(item=>item.id===template.id);state.visualTemplates[index]=restored;persist();return true; }

  const DEFAULT_BOOK_TEMPLATE_ID='default-book-card-v1';
  function defaultBookTemplate(){return createTemplate({id:DEFAULT_BOOK_TEMPLATE_ID,name:'Default Book Card',type:'book-card',canvas:{width:420,height:360,grid:8},target:{recordType:'book'},modules:[
    {id:'default-cover',type:'image',name:'Cover',x:12,y:12,width:105,height:150,dataBinding:{path:'coverUrl'}},
    {id:'default-title',type:'title',name:'Title',x:130,y:12,width:276,height:44,dataBinding:{path:'title'}},
    {id:'default-author',type:'metadata',name:'Author',x:130,y:62,width:276,height:30,dataBinding:{path:'author'}},
    {id:'default-series',type:'metadata',name:'Series',x:130,y:96,width:276,height:30,dataBinding:{path:'series'}},
    {id:'default-genres',type:'tags',name:'Genres',x:130,y:130,width:276,height:42,dataBinding:{path:'genres'}},
    {id:'default-status',type:'metadata',name:'Status',x:12,y:172,width:105,height:34,dataBinding:{path:'status'}},
    {id:'default-progress',type:'progress',name:'Progress',x:130,y:180,width:276,height:54,dataBinding:{path:'progress'},style:{display:'bar'},config:{min:0,max:100,tracker:{profile:false}}},
    {id:'default-rating',type:'rating',name:'Overall',x:12,y:238,width:120,height:44,dataBinding:{path:'rating'},style:{display:'stars'},config:{min:0,max:5,step:.5,tracker:{profile:false}}},
    {id:'default-spice',type:'rating',name:'Spice',x:142,y:238,width:120,height:44,dataBinding:{path:'spice'},style:{display:'flames'},config:{min:0,max:5,step:.5,tracker:{profile:false}}},
    {id:'default-impact',type:'rating',name:'Impact',x:272,y:238,width:134,height:44,dataBinding:{path:'impact'},style:{display:'hearts'},config:{min:0,max:5,step:.5,tracker:{profile:false}}},
    {id:'default-actions',type:'metadata',name:'Actions',x:12,y:296,width:394,height:56,dataBinding:{path:'$actions'}}
  ]});}
  function ensureDefaultBookTemplate(){ensureState();let template=state.visualTemplates.find(item=>item.id===DEFAULT_BOOK_TEMPLATE_ID),created=false;if(!template){template=defaultBookTemplate();state.visualTemplates.unshift(template);created=true;}return{template,created};}
  function templateForBook(book){const fallback=ensureDefaultBookTemplate(),assigned=state.visualTemplates.find(template=>template.id===book.visualTemplateId);if(fallback.created)persist();return assigned||fallback.template;}
  function resolveBinding(record,path){if(!path)return'';return path.split('.').reduce((value,key)=>value?.[key],record);}
  function trackerConfig(module){return normalizeModule(module).config.tracker||{id:module.id,name:module.name,type:module.type,min:0,max:5,step:1,icon:'',displayStyle:module.style?.display||'default',themeBehavior:'inherit'};}
  function trackerValue(book,module){const tracker=trackerConfig(module),bound=resolveBinding(book,tracker.valueBinding||module.dataBinding?.path);return number(book.trackerValues?.[module.id]??bound??module.config.value,tracker.min);}
  function trackerDisplay(module,value){const tracker=trackerConfig(module),min=tracker.min,max=Math.max(min+tracker.step,tracker.max),ratio=clamp((value-min)/(max-min),0,1),count=Math.max(0,Math.round(value-min)),style=module.style?.display||tracker.displayStyle||module.type;if(['stars','hearts','flames','icons'].includes(style)||['stars','icons'].includes(module.type)){const icon=style==='hearts'?'♥':style==='flames'?'🔥':style==='stars'?'★':tracker.icon||'◆';return`<span class="visual-tracker-icons" aria-hidden="true">${Array.from({length:Math.min(20,count)},()=>esc(icon)).join('')}</span><span class="sr-only">${value} of ${max}</span>`;}if(['progress','bar'].includes(style)||module.type==='progress')return`<div class="visual-tracker-bar" role="progressbar" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}"><span style="width:${ratio*100}%"></span></div><strong>${value}${max===100?'%':` / ${max}`}</strong>`;if(style==='counter'||module.type==='counter')return`<strong>${value} / ${max}</strong>`;if(style==='slider'||module.type==='slider')return`<div class="visual-slider-readout" aria-label="${esc(tracker.name)}: ${value} of ${max}"><span style="width:${ratio*100}%"></span><i style="left:${ratio*100}%"></i></div><strong>${value} / ${max}</strong>`;return`<strong>${value} / ${max}</strong>`;}
  function visibleForBinding(path,visible){const key={coverUrl:'cover',author:'author',series:'series',genres:'series',status:'status',progress:'progress',rating:'rating',spice:'spice',impact:'impact','$actions':'actions'}[path];return !key||visible?.[key]!==false;}
  function renderBookModule(module,book,visible={}){const path=module.dataBinding?.path;if(!visibleForBinding(path,visible))return'';const value=resolveBinding(book,path),style=`--module-x:${module.x/module._canvasWidth*100}%;--module-y:${module.y/module._canvasHeight*100}%;--module-width:${module.width/module._canvasWidth*100}%;--module-height:${module.height/module._canvasHeight*100}%;--module-rotation:${module.rotation}deg`;
    let body='';if(path==='$actions')body=`<div class="visual-book-actions"><button class="small-button" data-action="start-reading" data-id="${book.id}">${activeSessionForBook(book.id)?'Current Session':book.status==='completed'?'Reread':'Start Reading'}</button><button class="small-button" data-action="edit-book" data-id="${book.id}">Rate &amp; Edit</button><button class="small-button" data-action="progress-book" data-id="${book.id}">Progress</button><button class="small-button" data-action="pin-book" data-id="${book.id}">Pin</button>${book.status!=='completed'?`<button class="small-button" data-action="complete-book" data-id="${book.id}">Complete</button>`:''}</div>`;else if(module.type==='image')body=value?`<img src="${esc(value)}" alt="Cover of ${esc(book.title)}">`:`<span class="visual-cover-placeholder">${esc(book.title)}</span>`;else if(module.type==='title')body=`<button class="book-profile-link" data-action="view-book" data-id="${book.id}">${esc(value||book.title)}</button>`;else if(module.type==='tags')body=`<div class="visual-book-tags">${(Array.isArray(value)?value:[]).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`;else if(TRACKER_TYPES.includes(module.type)||module.config.tracker)body=`<small>${esc(module.name)}</small>${trackerDisplay(module,trackerValue(book,module))}`;else body=`<small>${esc(module.name)}</small><strong>${esc(String(value||''))}</strong>`;return`<section class="visual-book-module type-${module.type}" data-visual-module="${module.id}" style="${style}">${body}</section>`;}
  function activeSessionForBook(bookId){return(state.sessions||[]).find(session=>session.bookId===bookId&&!session.completedAt&&session.status==='reading');}
  function renderBookCard(book,{compact=false,visible={}}={}){const template=templateForBook(book),stats=typeof bookCardStats==='function'?bookCardStats(book):{notesCount:(book.notes||[]).length,theoryCount:0,dossierCount:0,wallCount:0},modules=template.modules.map(module=>renderBookModule({...module,_canvasWidth:template.canvas.width,_canvasHeight:template.canvas.height},book,visible)).join('');return`<article class="book-card visual-template-card ${compact?'is-compact':''}" data-template-id="${template.id}" data-book-id="${book.id}" data-notes-count="${stats.notesCount}" data-theory-count="${stats.theoryCount}" data-dossier-count="${stats.dossierCount}" data-wall-count="${stats.wallCount}"><div class="visual-book-canvas" style="--template-ratio:${template.canvas.width}/${template.canvas.height}">${modules}</div></article>`;}
  function openForBook(bookId){const book=state.books.find(item=>item.id===bookId);if(!book)return;const fallback=ensureDefaultBookTemplate();let template=state.visualTemplates.find(item=>item.id===book.visualTemplateId);if(!template||template.id===DEFAULT_BOOK_TEMPLATE_ID){template=normalizeTemplate({...JSON.parse(JSON.stringify(fallback.template)),id:makeId('template'),name:`${book.title} Card`,target:{recordType:'book'},createdAt:Date.now(),updatedAt:Date.now()});state.visualTemplates.push(template);book.visualTemplateId=template.id;persist();}open(template.id,{recordType:'book',recordId:book.id});}
  function renderTrackerControls(book){const template=templateForBook(book),trackers=template.modules.filter(module=>trackerConfig(module).profile);return trackers.length?`<div class="book-tracker-list">${trackers.map(module=>{const tracker=trackerConfig(module),value=trackerValue(book,module);return`<label class="book-tracker-control"><span><strong>${esc(tracker.name)}</strong><output data-tracker-output="${module.id}">${value} / ${tracker.max}</output></span><input type="range" class="shared-range" data-range-format="number" data-tracker-module="${module.id}" min="${tracker.min}" max="${tracker.max}" step="${tracker.step}" value="${value}" aria-label="${esc(tracker.name)}" aria-valuetext="${value} of ${tracker.max}"><div data-tracker-display="${module.id}">${trackerDisplay(module,value)}</div></label>`;}).join('')}</div>`:'<p>No custom trackers on this template.</p>';}
  function updateTrackerValue(bookId,moduleId,value,{persist:shouldPersist=true}={}){const book=state.books.find(item=>item.id===bookId),template=book&&templateForBook(book),module=template?.modules.find(item=>item.id===moduleId);if(!book||!module)return null;const tracker=trackerConfig(module),numeric=clamp(value,tracker.min,tracker.max);book.trackerValues||={};book.trackerValues[moduleId]=numeric;book.updatedAt=Date.now();const output=globalThis.document?.querySelector?.(`[data-tracker-output="${moduleId}"]`);if(output)output.value=`${numeric} / ${tracker.max}`;const display=globalThis.document?.querySelector?.(`[data-tracker-display="${moduleId}"]`),input=globalThis.document?.querySelector?.(`[data-tracker-module="${moduleId}"]`);if(display)display.innerHTML=trackerDisplay(module,numeric);if(input)input.setAttribute('aria-valuetext',`${numeric} of ${tracker.max}`);if(shouldPersist){persist();renderAll();}return numeric;}

  function modulePreview(module) {
    const record=builderContext.recordType==='book'?state.books.find(item=>item.id===builderContext.recordId):null,label=esc(module.name),resolved=record?resolveBinding(record,module.dataBinding?.path):undefined,value=esc(String(resolved??module.config.value??module.dataBinding.fallback??'Sample'));
    if((TRACKER_TYPES.includes(module.type)||module.config.tracker)&&record)return `<small>${label}</small>${trackerDisplay(module,trackerValue(record,module))}`;
    if(module.type==='image')return `<span class="builder-image-placeholder" aria-hidden="true">▧</span><strong>${label}</strong>`;
    if(['rating','stars'].includes(module.type))return `<small>${label}</small><strong aria-label="Sample rating">★★★★★</strong>`;
    if(['progress','slider'].includes(module.type))return `<small>${label}</small><div class="builder-progress"><span style="width:${clamp(module.config.value??60,0,100)}%"></span></div><strong>${value}${module.type==='progress'?'%':''}</strong>`;
    if(module.type==='icons')return `<small>${label}</small><strong>${esc(module.config.icon||'◆')} ${value}</strong>`;
    if(module.type==='quote')return `<blockquote>${value}</blockquote>`;
    if(['tags','notes','metadata','linked-record','linked-dossier','linked-theory','relationship-count'].includes(module.type))return `<small>${label}</small><strong>${value}</strong>`;
    return `<strong>${label}</strong><p>${value}</p>`;
  }

  function render() {
    const template=activeTemplate();if(!template)return;
    const root=document.getElementById('visualBuilderRoot');if(!root)return;
    root.innerHTML=`<header class="builder-header"><div><p class="eyebrow">Universal layout engine</p><h2 id="formModalTitle">${esc(template.name)}</h2><p>Generic template · ${template.modules.length} modules · theme inherited</p></div><div class="builder-header-actions"><button type="button" class="secondary-button" data-builder-undo ${!(histories.get(template.id)||[]).length?'disabled':''}>Undo</button><button type="button" class="primary-button" data-builder-save>Save Layout</button><button type="button" class="secondary-button" data-builder-close>Done</button></div></header>
      <div class="builder-workspace"><aside class="builder-palette" aria-label="Builder tools"><label>Template<select data-builder-template>${state.visualTemplates.map(item=>`<option value="${item.id}" ${item.id===template.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label><button type="button" data-new-template>New Template</button><label>Module type<select data-module-type>${MODULE_TYPES.map(type=>`<option value="${type}">${type.replaceAll('-',' ')}</option>`).join('')}</select></label><label>Module name<input data-module-name placeholder="Custom label"></label><label>Icon or symbol<input data-module-icon placeholder="◆"></label><div class="builder-number-grid"><label>Minimum<input type="number" data-module-min value="0"></label><label>Maximum<input type="number" data-module-max value="5"></label><label>Step<input type="number" min="0.01" step="0.01" data-module-step value="1"></label><label>Display<select data-module-display><option>default</option><option>slider</option><option>stars</option><option>hearts</option><option>flames</option><option>icons</option><option>bar</option><option>counter</option></select></label></div><button type="button" class="primary-button" data-add-module>Add Module</button><p class="field-help">Modules are record-agnostic. Bind them to a book, dossier, profile, or future record later.</p></aside>
      <main class="builder-stage-wrap" aria-label="Visual template canvas"><div class="builder-canvas" data-builder-canvas style="width:${template.canvas.width}px;height:${template.canvas.height}px;--builder-grid:${template.canvas.grid}px">${template.modules.map(module=>`<article class="builder-module ${selectedModuleIds.has(module.id)?'is-selected':''} ${module.locked?'is-locked':''}" data-builder-module="${module.id}" tabindex="0" aria-selected="${selectedModuleIds.has(module.id)}" aria-label="${esc(module.name)}, ${Math.round(module.width)} by ${Math.round(module.height)}, position ${Math.round(module.x)}, ${Math.round(module.y)}" style="left:${module.x}px;top:${module.y}px;width:${module.width}px;height:${module.height}px;rotate:${module.rotation}deg"><div class="builder-module-content">${modulePreview(module)}</div><button type="button" class="builder-resize-handle" data-builder-resize="${module.id}" aria-label="Resize ${esc(module.name)}"></button></article>`).join('')}</div></main>
      <aside class="builder-inspector" aria-label="Selected module properties">${inspectorHtml(template)}</aside></div>`;
    bind(root,template);
  }

  function inspectorHtml(template) {
    const module=moduleById(template,[...selectedModuleIds][0]);
    if(!module)return '<div class="builder-empty"><strong>Select a module</strong><p>Choose a module on the canvas to move, resize, lock, duplicate, style, or delete it.</p></div>';
    return `<h3>${esc(module.name)}</h3><p>${esc(module.type)} module</p><label>Name<input data-inspect-name value="${esc(module.name)}"></label><label>Data binding path<input data-inspect-binding value="${esc(module.dataBinding.path||'')}" placeholder="record.field"></label><label>Display style<select data-inspect-display>${['default','stars','hearts','flames','number','bar','ring','percentage','icons'].map(value=>`<option ${module.style.display===value?'selected':''}>${value}</option>`).join('')}</select></label>${module.config.tracker?`<fieldset class="builder-tracker-settings"><legend>Tracker settings</legend><label>Icon<input data-inspect-tracker-icon value="${esc(module.config.tracker.icon||'')}"></label><div class="builder-number-grid"><label>Minimum<input type="number" data-inspect-tracker-min value="${module.config.tracker.min}"></label><label>Maximum<input type="number" data-inspect-tracker-max value="${module.config.tracker.max}"></label><label>Step<input type="number" min="0.01" step="0.01" data-inspect-tracker-step value="${module.config.tracker.step}"></label></div></fieldset>`:''}<div class="builder-number-grid"><label>X<input type="number" data-inspect-x value="${module.x}"></label><label>Y<input type="number" data-inspect-y value="${module.y}"></label><label>Width<input type="number" min="${MIN_MODULE_WIDTH}" data-inspect-width value="${module.width}"></label><label>Height<input type="number" min="${MIN_MODULE_HEIGHT}" data-inspect-height value="${module.height}"></label><label>Rotation<input type="number" min="-180" max="180" data-inspect-rotation value="${module.rotation}"></label></div><fieldset><legend>Move module</legend><div class="builder-nudge-grid"><button type="button" data-nudge-x="-10" aria-label="Move left">←</button><button type="button" data-nudge-y="-10" aria-label="Move up">↑</button><button type="button" data-nudge-y="10" aria-label="Move down">↓</button><button type="button" data-nudge-x="10" aria-label="Move right">→</button></div></fieldset><fieldset><legend>Resize module</legend><div class="builder-nudge-grid"><button type="button" data-size-x="-10" aria-label="Make narrower">− Width</button><button type="button" data-size-y="-10" aria-label="Make shorter">− Height</button><button type="button" data-size-y="10" aria-label="Make taller">+ Height</button><button type="button" data-size-x="10" aria-label="Make wider">+ Width</button></div></fieldset><div class="builder-inspector-actions"><button type="button" data-lock-module>${module.locked?'Unlock':'Lock'}</button><button type="button" data-duplicate-module>Duplicate</button><button type="button" class="danger-button" data-delete-module>Delete</button></div>`;
  }

  function bind(root,template) {
    const refresh=()=>render(),selected=()=>moduleById(activeTemplate(),[...selectedModuleIds][0]);
    root.querySelector('[data-builder-close]').onclick=()=>closeModal();
    root.querySelector('[data-builder-save]').onclick=()=>{persist();renderAll();showToast('Visual template saved.');};
    root.querySelector('[data-builder-undo]').onclick=()=>{if(undo(template))refresh();};
    root.querySelector('[data-builder-template]').onchange=event=>{activeTemplateId=event.target.value;selectedModuleIds.clear();refresh();};
    root.querySelector('[data-new-template]').onclick=()=>{const name=prompt('Template name','Untitled Visual Template');if(!name)return;const next=createTemplate({name});state.visualTemplates.push(next);activeTemplateId=next.id;selectedModuleIds.clear();persist();refresh();};
    root.querySelector('[data-add-module]').onclick=()=>{snapshot(template);const type=root.querySelector('[data-module-type]').value,name=root.querySelector('[data-module-name]').value.trim(),icon=root.querySelector('[data-module-icon]').value.trim();const min=number(root.querySelector('[data-module-min]').value),max=number(root.querySelector('[data-module-max]').value,5),step=number(root.querySelector('[data-module-step]').value,1),displayStyle=root.querySelector('[data-module-display]').value,isTracker=TRACKER_TYPES.includes(type)||type==='custom',config={icon,min,max,step,...(isTracker?{tracker:{name:name||type,type,min,max,step,icon,displayStyle,valueBinding:'',themeBehavior:'inherit',profile:true}}:{})},module=createModule(type,{name:name||undefined,x:32+template.modules.length*16,y:32+template.modules.length*16,config,style:{display:displayStyle}});template.modules.push(module);selectedModuleIds=new Set([module.id]);persist();refresh();};
    root.querySelectorAll('[data-builder-module]').forEach(element=>{element.onclick=event=>{if(event.target.closest('[data-builder-resize]'))return;selectedModuleIds=event.shiftKey?new Set([...selectedModuleIds,element.dataset.builderModule]):new Set([element.dataset.builderModule]);refresh();};element.onkeydown=event=>{const module=moduleById(template,element.dataset.builderModule);if(!module)return;if(['Enter',' '].includes(event.key)){event.preventDefault();selectedModuleIds=new Set([module.id]);return refresh();}const delta=event.shiftKey?10:1,map={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};if(map[event.key]&&!module.locked){event.preventDefault();snapshot(template);moveModule(template,module.id,module.x+map[event.key][0],module.y+map[event.key][1]);persist();refresh();}};element.onpointerdown=event=>{if(event.target.closest('button')||event.pointerType==='touch')return;const module=moduleById(template,element.dataset.builderModule);if(!module||module.locked)return;snapshot(template);interaction={kind:'move',id:module.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:module.x,y:module.y};element.setPointerCapture(event.pointerId);};element.onpointermove=event=>{if(interaction?.pointerId!==event.pointerId||interaction.kind!=='move')return;moveModule(template,interaction.id,interaction.x+event.clientX-interaction.startX,interaction.y+event.clientY-interaction.startY);element.style.left=`${moduleById(template,interaction.id).x}px`;element.style.top=`${moduleById(template,interaction.id).y}px`;};element.onpointerup=element.onpointercancel=event=>{if(interaction?.pointerId!==event.pointerId)return;interaction=null;persist();refresh();};});
    root.querySelectorAll('[data-builder-resize]').forEach(handle=>{handle.onpointerdown=event=>{event.stopPropagation();const module=moduleById(template,handle.dataset.builderResize);if(!module||module.locked)return;snapshot(template);interaction={kind:'resize',id:module.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,width:module.width,height:module.height};handle.setPointerCapture(event.pointerId);};handle.onpointermove=event=>{if(interaction?.pointerId!==event.pointerId||interaction.kind!=='resize')return;resizeModule(template,interaction.id,interaction.width+event.clientX-interaction.startX,interaction.height+event.clientY-interaction.startY);const element=root.querySelector(`[data-builder-module="${interaction.id}"]`),module=moduleById(template,interaction.id);element.style.width=`${module.width}px`;element.style.height=`${module.height}px`;};handle.onpointerup=handle.onpointercancel=event=>{if(interaction?.pointerId!==event.pointerId)return;interaction=null;persist();refresh();};});
    const updateInspector=()=>{const module=selected();if(!module)return;snapshot(template);module.name=root.querySelector('[data-inspect-name]').value.trim()||module.name;moveModule(template,module.id,root.querySelector('[data-inspect-x]').value,root.querySelector('[data-inspect-y]').value);resizeModule(template,module.id,root.querySelector('[data-inspect-width]').value,root.querySelector('[data-inspect-height]').value);module.rotation=clamp(root.querySelector('[data-inspect-rotation]').value,-180,180);module.dataBinding.path=root.querySelector('[data-inspect-binding]').value.trim();if(module.config.tracker){module.config.tracker.icon=root.querySelector('[data-inspect-tracker-icon]').value;module.config.tracker.min=number(root.querySelector('[data-inspect-tracker-min]').value);module.config.tracker.max=number(root.querySelector('[data-inspect-tracker-max]').value,5);module.config.tracker.step=Math.max(.01,number(root.querySelector('[data-inspect-tracker-step]').value,1));module.config.tracker.displayStyle=root.querySelector('[data-inspect-display]').value;}updateModuleStyle(template,module.id,{display:root.querySelector('[data-inspect-display]').value});persist();refresh();};
    root.querySelectorAll('[data-inspect-name],[data-inspect-binding],[data-inspect-display],[data-inspect-tracker-icon],[data-inspect-tracker-min],[data-inspect-tracker-max],[data-inspect-tracker-step],[data-inspect-rotation],[data-inspect-x],[data-inspect-y],[data-inspect-width],[data-inspect-height]').forEach(input=>input.onchange=updateInspector);
    root.querySelectorAll('[data-nudge-x],[data-nudge-y],[data-size-x],[data-size-y]').forEach(button=>button.onclick=()=>{const module=selected();if(!module||module.locked)return;snapshot(template);if(button.dataset.nudgeX||button.dataset.nudgeY)moveModule(template,module.id,module.x+number(button.dataset.nudgeX),module.y+number(button.dataset.nudgeY));else resizeModule(template,module.id,module.width+number(button.dataset.sizeX),module.height+number(button.dataset.sizeY));persist();refresh();});
    root.querySelector('[data-lock-module]')?.addEventListener('click',()=>{snapshot(template);lockModule(template,selected().id,!selected().locked);persist();refresh();});
    root.querySelector('[data-duplicate-module]')?.addEventListener('click',()=>{snapshot(template);const copy=duplicateModule(template,selected().id);selectedModuleIds=new Set([copy.id]);persist();refresh();});
    root.querySelector('[data-delete-module]')?.addEventListener('click',()=>{snapshot(template);deleteModule(template,selected().id);selectedModuleIds.clear();persist();refresh();});
  }

  function open(templateId = '',context=null) {
    if(context)builderContext={...builderContext,...context};else if(!templateId)builderContext={recordType:'generic',recordId:''};
    ensureState();
    let template=state.visualTemplates.find(item=>item.id===templateId)||state.visualTemplates[0];
    if(!template){template=createTemplate({name:'My Visual Template'});state.visualTemplates.push(template);persist();}
    activeTemplateId=template.id;selectedModuleIds.clear();
    modal('<section id="visualBuilderRoot" class="visual-builder" aria-label="Universal Visual Builder"></section>');
    document.getElementById('formModal').classList.add('visual-builder-backdrop');
    render();
  }

  if(!globalThis.__ABILITY_TEST__&&typeof state!=='undefined'){const seeded=ensureDefaultBookTemplate();if(seeded.created)persist();if(['dashboard','library'].includes(typeof activeView==='undefined'?'':activeView))renderAll();}

  globalThis.VisualBuilder={BUILDER_SCHEMA_VERSION,MODULE_TYPES,TRACKER_TYPES,DEFAULT_BOOK_TEMPLATE_ID,normalizeModule,normalizeTemplate,normalizeTemplates,createTemplate,createModule,moveModule,resizeModule,deleteModule,duplicateModule,lockModule,updateModuleStyle,defaultBookTemplate,ensureDefaultBookTemplate,templateForBook,renderBookModule,renderBookCard,trackerConfig,trackerDisplay,renderTrackerControls,updateTrackerValue,openForBook,open};
})();
