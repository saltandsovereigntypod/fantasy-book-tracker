(() => {
  'use strict';

  const BUILDER_SCHEMA_VERSION = 1;
  const MODULE_TYPES = [
    'text','image','title','metadata','rating','slider','progress','stars','icons','counter',
    'linked-record','linked-dossier','linked-theory','relationship-count','quote','notes','tags','custom'
  ];
  const MIN_MODULE_WIDTH = 80;
  const MIN_MODULE_HEIGHT = 56;
  const histories = new Map();
  let activeTemplateId = '';
  let selectedModuleIds = new Set();
  let interaction = null;

  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value, min)));
  const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  function normalizeModule(module = {}, index = 0) {
    const type = MODULE_TYPES.includes(module.type) ? module.type : 'custom';
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
      config: {...cleanObject(module.config)}
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
    const normalized = normalizeTemplates(state.visualTemplates);
    state.visualTemplates = normalized;
    return normalized;
  }

  function persist() { saveState(); }
  function activeTemplate() { return ensureState().find(template=>template.id===activeTemplateId); }
  function snapshot(template) { const stack=histories.get(template.id)||[];stack.push(JSON.stringify(template));if(stack.length>30)stack.shift();histories.set(template.id,stack); }
  function undo(template) { const stack=histories.get(template.id)||[];const previous=stack.pop();if(!previous)return false;const restored=normalizeTemplate(JSON.parse(previous));const index=state.visualTemplates.findIndex(item=>item.id===template.id);state.visualTemplates[index]=restored;persist();return true; }

  function modulePreview(module) {
    const label=esc(module.name),value=esc(String(module.config.value ?? module.dataBinding.fallback ?? 'Sample'));
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
      <div class="builder-workspace"><aside class="builder-palette" aria-label="Builder tools"><label>Template<select data-builder-template>${state.visualTemplates.map(item=>`<option value="${item.id}" ${item.id===template.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label><button type="button" data-new-template>New Template</button><label>Module type<select data-module-type>${MODULE_TYPES.map(type=>`<option value="${type}">${type.replaceAll('-',' ')}</option>`).join('')}</select></label><label>Module name<input data-module-name placeholder="Custom label"></label><label>Icon or symbol<input data-module-icon placeholder="◆"></label><div class="builder-number-grid"><label>Minimum<input type="number" data-module-min value="0"></label><label>Maximum<input type="number" data-module-max value="5"></label></div><button type="button" class="primary-button" data-add-module>Add Module</button><p class="field-help">Modules are record-agnostic. Bind them to a book, dossier, profile, or future record later.</p></aside>
      <main class="builder-stage-wrap" aria-label="Visual template canvas"><div class="builder-canvas" data-builder-canvas style="width:${template.canvas.width}px;height:${template.canvas.height}px;--builder-grid:${template.canvas.grid}px">${template.modules.map(module=>`<article class="builder-module ${selectedModuleIds.has(module.id)?'is-selected':''} ${module.locked?'is-locked':''}" data-builder-module="${module.id}" tabindex="0" aria-selected="${selectedModuleIds.has(module.id)}" aria-label="${esc(module.name)}, ${Math.round(module.width)} by ${Math.round(module.height)}, position ${Math.round(module.x)}, ${Math.round(module.y)}" style="left:${module.x}px;top:${module.y}px;width:${module.width}px;height:${module.height}px;rotate:${module.rotation}deg"><div class="builder-module-content">${modulePreview(module)}</div><button type="button" class="builder-resize-handle" data-builder-resize="${module.id}" aria-label="Resize ${esc(module.name)}"></button></article>`).join('')}</div></main>
      <aside class="builder-inspector" aria-label="Selected module properties">${inspectorHtml(template)}</aside></div>`;
    bind(root,template);
  }

  function inspectorHtml(template) {
    const module=moduleById(template,[...selectedModuleIds][0]);
    if(!module)return '<div class="builder-empty"><strong>Select a module</strong><p>Choose a module on the canvas to move, resize, lock, duplicate, style, or delete it.</p></div>';
    return `<h3>${esc(module.name)}</h3><p>${esc(module.type)} module</p><label>Name<input data-inspect-name value="${esc(module.name)}"></label><label>Data binding path<input data-inspect-binding value="${esc(module.dataBinding.path||'')}" placeholder="record.field"></label><label>Display style<select data-inspect-display>${['default','stars','hearts','flames','number','bar','ring','percentage','icons'].map(value=>`<option ${module.style.display===value?'selected':''}>${value}</option>`).join('')}</select></label><div class="builder-number-grid"><label>X<input type="number" data-inspect-x value="${module.x}"></label><label>Y<input type="number" data-inspect-y value="${module.y}"></label><label>Width<input type="number" min="${MIN_MODULE_WIDTH}" data-inspect-width value="${module.width}"></label><label>Height<input type="number" min="${MIN_MODULE_HEIGHT}" data-inspect-height value="${module.height}"></label><label>Rotation<input type="number" min="-180" max="180" data-inspect-rotation value="${module.rotation}"></label></div><fieldset><legend>Move module</legend><div class="builder-nudge-grid"><button type="button" data-nudge-x="-10" aria-label="Move left">←</button><button type="button" data-nudge-y="-10" aria-label="Move up">↑</button><button type="button" data-nudge-y="10" aria-label="Move down">↓</button><button type="button" data-nudge-x="10" aria-label="Move right">→</button></div></fieldset><fieldset><legend>Resize module</legend><div class="builder-nudge-grid"><button type="button" data-size-x="-10" aria-label="Make narrower">− Width</button><button type="button" data-size-y="-10" aria-label="Make shorter">− Height</button><button type="button" data-size-y="10" aria-label="Make taller">+ Height</button><button type="button" data-size-x="10" aria-label="Make wider">+ Width</button></div></fieldset><div class="builder-inspector-actions"><button type="button" data-lock-module>${module.locked?'Unlock':'Lock'}</button><button type="button" data-duplicate-module>Duplicate</button><button type="button" class="danger-button" data-delete-module>Delete</button></div>`;
  }

  function bind(root,template) {
    const refresh=()=>render(),selected=()=>moduleById(activeTemplate(),[...selectedModuleIds][0]);
    root.querySelector('[data-builder-close]').onclick=()=>closeModal();
    root.querySelector('[data-builder-save]').onclick=()=>{persist();showToast('Visual template saved.');};
    root.querySelector('[data-builder-undo]').onclick=()=>{if(undo(template))refresh();};
    root.querySelector('[data-builder-template]').onchange=event=>{activeTemplateId=event.target.value;selectedModuleIds.clear();refresh();};
    root.querySelector('[data-new-template]').onclick=()=>{const name=prompt('Template name','Untitled Visual Template');if(!name)return;const next=createTemplate({name});state.visualTemplates.push(next);activeTemplateId=next.id;selectedModuleIds.clear();persist();refresh();};
    root.querySelector('[data-add-module]').onclick=()=>{snapshot(template);const type=root.querySelector('[data-module-type]').value,name=root.querySelector('[data-module-name]').value.trim(),icon=root.querySelector('[data-module-icon]').value.trim();const module=createModule(type,{name:name||undefined,x:32+template.modules.length*16,y:32+template.modules.length*16,config:{icon,min:number(root.querySelector('[data-module-min]').value),max:number(root.querySelector('[data-module-max]').value,5)}});template.modules.push(module);selectedModuleIds=new Set([module.id]);persist();refresh();};
    root.querySelectorAll('[data-builder-module]').forEach(element=>{element.onclick=event=>{if(event.target.closest('[data-builder-resize]'))return;selectedModuleIds=event.shiftKey?new Set([...selectedModuleIds,element.dataset.builderModule]):new Set([element.dataset.builderModule]);refresh();};element.onkeydown=event=>{const module=moduleById(template,element.dataset.builderModule);if(!module)return;if(['Enter',' '].includes(event.key)){event.preventDefault();selectedModuleIds=new Set([module.id]);return refresh();}const delta=event.shiftKey?10:1,map={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};if(map[event.key]&&!module.locked){event.preventDefault();snapshot(template);moveModule(template,module.id,module.x+map[event.key][0],module.y+map[event.key][1]);persist();refresh();}};element.onpointerdown=event=>{if(event.target.closest('button')||event.pointerType==='touch')return;const module=moduleById(template,element.dataset.builderModule);if(!module||module.locked)return;snapshot(template);interaction={kind:'move',id:module.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:module.x,y:module.y};element.setPointerCapture(event.pointerId);};element.onpointermove=event=>{if(interaction?.pointerId!==event.pointerId||interaction.kind!=='move')return;moveModule(template,interaction.id,interaction.x+event.clientX-interaction.startX,interaction.y+event.clientY-interaction.startY);element.style.left=`${moduleById(template,interaction.id).x}px`;element.style.top=`${moduleById(template,interaction.id).y}px`;};element.onpointerup=element.onpointercancel=event=>{if(interaction?.pointerId!==event.pointerId)return;interaction=null;persist();refresh();};});
    root.querySelectorAll('[data-builder-resize]').forEach(handle=>{handle.onpointerdown=event=>{event.stopPropagation();const module=moduleById(template,handle.dataset.builderResize);if(!module||module.locked)return;snapshot(template);interaction={kind:'resize',id:module.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,width:module.width,height:module.height};handle.setPointerCapture(event.pointerId);};handle.onpointermove=event=>{if(interaction?.pointerId!==event.pointerId||interaction.kind!=='resize')return;resizeModule(template,interaction.id,interaction.width+event.clientX-interaction.startX,interaction.height+event.clientY-interaction.startY);const element=root.querySelector(`[data-builder-module="${interaction.id}"]`),module=moduleById(template,interaction.id);element.style.width=`${module.width}px`;element.style.height=`${module.height}px`;};handle.onpointerup=handle.onpointercancel=event=>{if(interaction?.pointerId!==event.pointerId)return;interaction=null;persist();refresh();};});
    const updateInspector=()=>{const module=selected();if(!module)return;snapshot(template);module.name=root.querySelector('[data-inspect-name]').value.trim()||module.name;moveModule(template,module.id,root.querySelector('[data-inspect-x]').value,root.querySelector('[data-inspect-y]').value);resizeModule(template,module.id,root.querySelector('[data-inspect-width]').value,root.querySelector('[data-inspect-height]').value);module.rotation=clamp(root.querySelector('[data-inspect-rotation]').value,-180,180);module.dataBinding.path=root.querySelector('[data-inspect-binding]').value.trim();updateModuleStyle(template,module.id,{display:root.querySelector('[data-inspect-display]').value});persist();refresh();};
    root.querySelectorAll('[data-inspect-name],[data-inspect-binding],[data-inspect-display],[data-inspect-rotation],[data-inspect-x],[data-inspect-y],[data-inspect-width],[data-inspect-height]').forEach(input=>input.onchange=updateInspector);
    root.querySelectorAll('[data-nudge-x],[data-nudge-y],[data-size-x],[data-size-y]').forEach(button=>button.onclick=()=>{const module=selected();if(!module||module.locked)return;snapshot(template);if(button.dataset.nudgeX||button.dataset.nudgeY)moveModule(template,module.id,module.x+number(button.dataset.nudgeX),module.y+number(button.dataset.nudgeY));else resizeModule(template,module.id,module.width+number(button.dataset.sizeX),module.height+number(button.dataset.sizeY));persist();refresh();});
    root.querySelector('[data-lock-module]')?.addEventListener('click',()=>{snapshot(template);lockModule(template,selected().id,!selected().locked);persist();refresh();});
    root.querySelector('[data-duplicate-module]')?.addEventListener('click',()=>{snapshot(template);const copy=duplicateModule(template,selected().id);selectedModuleIds=new Set([copy.id]);persist();refresh();});
    root.querySelector('[data-delete-module]')?.addEventListener('click',()=>{snapshot(template);deleteModule(template,selected().id);selectedModuleIds.clear();persist();refresh();});
  }

  function open(templateId = '') {
    ensureState();
    let template=state.visualTemplates.find(item=>item.id===templateId)||state.visualTemplates[0];
    if(!template){template=createTemplate({name:'My Visual Template'});state.visualTemplates.push(template);persist();}
    activeTemplateId=template.id;selectedModuleIds.clear();
    modal('<section id="visualBuilderRoot" class="visual-builder" aria-label="Universal Visual Builder"></section>');
    document.getElementById('formModal').classList.add('visual-builder-backdrop');
    render();
  }

  globalThis.VisualBuilder={BUILDER_SCHEMA_VERSION,MODULE_TYPES,normalizeModule,normalizeTemplate,normalizeTemplates,createTemplate,createModule,moveModule,resizeModule,deleteModule,duplicateModule,lockModule,updateModuleStyle,open};
})();
