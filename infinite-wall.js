(() => {
  'use strict';

  const SCHEMA_VERSION = 6;
  const FIELD_TYPES = ['text','longtext','number','percentage','status','badge','linked','multi-linked','date','image','quote','confidence'];
  const FRONT_STYLES = ['label','value','badge','chips','confidence','status','image','quote','link'];
  const LAYOUTS = ['freeform','grid','vertical','horizontal'];
  const SORTS = ['manual','alphabetical','newest','oldest','connected','confidence','source','custom'];
  const originalHandleAction = handleAction;
  const originalOpenWallForm = openWallForm;
  const originalCloseModal = closeModal;
  let saveTimer;
  let frame;
  let wallFilters = {query:'',category:'',tag:'',book:'',seriesId:'',status:'',region:'',unresolved:false,orphans:false,multiBook:false,noSeries:false,noBooks:false};

  const dossierById = id => state.dossiers.find(item => item.id === id);
  const appearanceById = id => state.wallAppearances.find(item => item.id === id);
  const activeViewport = () => state.wallViewports[state.activeWallId] || (state.wallViewports[state.activeWallId] = {panX:0,panY:0,zoom:1});
  const activeRegions = () => state.wallRegions.filter(region => region.wallId === state.activeWallId);
  const activeAppearances = () => state.wallAppearances.filter(item => item.wallId === state.activeWallId);
  const dossierLinks = id => state.dossierLinks.filter(link => link.fromDossierId === id || link.toDossierId === id);
  const queueSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 350); };
  const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(drawInfiniteLinks); };
  const csv = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);

  function defaultTileSettings(card = {}) {
    return {mode:card.displayMode || 'standard',showSummary:true,showImage:true,showCounts:true,showTags:true,showCategory:true,showSeries:false,showBooks:false,bookStyle:'chips'};
  }

  function stableSeriesId(name) {
    const slug=String(name||'series').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'series';
    let id=`series-${slug}`,suffix=2; while(state.series.some(item=>item.id===id&&item.name.toLowerCase()!==String(name).toLowerCase()))id=`series-${slug}-${suffix++}`; return id;
  }

  function normalizeSeriesAndIntegrity() {
    state.series=Array.isArray(state.series)?state.series:[];
    const redirects=new Map(),deduped=[];const knownNames=new Map();state.series.forEach(item=>{const key=String(item.name||'').trim().toLowerCase();if(!key)return;const existing=knownNames.get(key);if(existing)redirects.set(item.id,existing.id);else{knownNames.set(key,item);deduped.push(item);}});state.series=deduped;
    state.books.forEach(book=>{if(redirects.has(book.seriesId))book.seriesId=redirects.get(book.seriesId);});state.dossiers.forEach(dossier=>{if(redirects.has(dossier.seriesId))dossier.seriesId=redirects.get(dossier.seriesId);});state.walls.forEach(wall=>{if(redirects.has(wall.sourceSeriesId))wall.sourceSeriesId=redirects.get(wall.sourceSeriesId);});
    const byName=new Map(state.series.map(item=>[String(item.name).trim().toLowerCase(),item]));
    state.books.forEach(book=>{const name=String(book.series||'').trim();if(name&&!book.seriesId){let series=byName.get(name.toLowerCase());if(!series){series={id:stableSeriesId(name),name,description:'',createdAt:Date.now(),updatedAt:Date.now()};state.series.push(series);byName.set(name.toLowerCase(),series);}book.seriesId=series.id;}});
    const bookIds=new Set(state.books.map(book=>book.id)),seriesIds=new Set(state.series.map(item=>item.id)),regionIds=new Set(state.wallRegions.map(item=>item.id)),dossierIds=new Set(state.dossiers.map(item=>item.id));
    state.dossiers.forEach(dossier=>{dossier.bookIds=[...new Set([...(Array.isArray(dossier.bookIds)?dossier.bookIds:[]),...(dossier.sourceBookId?[dossier.sourceBookId]:[])])].filter(id=>bookIds.has(id));if(!seriesIds.has(dossier.seriesId))dossier.seriesId='';if(!dossier.seriesId){const book=state.books.find(item=>dossier.bookIds.includes(item.id)&&item.seriesId);if(book)dossier.seriesId=book.seriesId;} (dossier.fields||[]).forEach(field=>{if(!['linked','multi-linked'].includes(field.type))return;const values=(Array.isArray(field.value)?field.value:[field.value]).filter(id=>dossierIds.has(id));field.value=field.type==='linked'?(values[0]||''):[...new Set(values)];});});
    state.wallAppearances=state.wallAppearances.filter(item=>dossierIds.has(item.dossierId)&&state.walls.some(w=>w.id===item.wallId));state.wallAppearances.forEach(item=>{if(item.regionId&&!regionIds.has(item.regionId))item.regionId='';});
    const seenHomes=new Set(),seenReferences=new Set();state.wallAppearances=state.wallAppearances.filter(item=>{const key=`${item.dossierId}|${item.wallId}`;if(item.appearanceType==='home'){if(seenHomes.has(key)){item.appearanceType='reference';}else seenHomes.add(key);}if(item.appearanceType==='reference'&&item.regionId){const refKey=`${key}|${item.regionId}`;if(seenReferences.has(refKey))return false;seenReferences.add(refKey);}return true;});
    state.dossierLinks=state.dossierLinks.filter(link=>dossierIds.has(link.fromDossierId)&&dossierIds.has(link.toDossierId));
    state.walls.forEach(wall=>{if(!seriesIds.has(wall.sourceSeriesId))wall.sourceSeriesId='';});
  }

  function migrateInvestigationState() {
    state.dossiers = Array.isArray(state.dossiers) ? state.dossiers : [];
    state.wallAppearances = Array.isArray(state.wallAppearances) ? state.wallAppearances : [];
    state.wallRegions = Array.isArray(state.wallRegions) ? state.wallRegions : [];
    state.dossierLinks = Array.isArray(state.dossierLinks) ? state.dossierLinks : [];
    state.wallViewports = state.wallViewports && typeof state.wallViewports === 'object' ? state.wallViewports : {};
    const dossierIds = new Set(state.dossiers.map(item => item.id));
    const appearanceSourceIds = new Set(state.wallAppearances.map(item => item.legacyCardId).filter(Boolean));

    state.wallCards.forEach(card => {
      let dossier = dossierById(card.dossierId || card.id);
      if (!dossier && !dossierIds.has(card.id)) {
        dossier = {
          id:card.id, category:card.category || card.type || 'Evidence', title:card.title || 'Untitled dossier',
          summary:card.text || '', image:card.image || '', tags:Array.isArray(card.tags) ? card.tags : [],
          sourceBookId:card.sourceBookId || (card.sourceType === 'book' ? card.sourceId : ''), spoilerThreshold:card.spoilerThreshold || '',
          fields:Array.isArray(card.fields) ? card.fields : [], sections:Array.isArray(card.sections) ? card.sections : [],
          tileSettings:{...defaultTileSettings(card),...(card.tileSettings || {})}, sourceType:card.sourceType || 'custom', sourceId:card.sourceId || '',
          createdAt:card.createdAt || Date.now(), updatedAt:card.updatedAt || card.createdAt || Date.now()
        };
        state.dossiers.push(dossier); dossierIds.add(dossier.id);
      }
      if (dossier && !appearanceSourceIds.has(card.id) && !state.wallAppearances.some(a => a.id === card.id)) {
        state.wallAppearances.push({
          id:card.id, legacyCardId:card.id, dossierId:dossier.id, wallId:card.wallId || 'main', regionId:card.regionId || '',
          appearanceType:'home', x:Number(card.x) || 30, y:Number(card.y) || 30, width:Number(card.width) || 300,
          height:Number(card.height) || null, displayMode:card.displayMode || dossier.tileSettings?.mode || 'standard',
          zIndex:Number(card.zIndex) || 10, locked:!!card.locked
        });
        appearanceSourceIds.add(card.id);
      }
    });

    const linkIds = new Set(state.dossierLinks.map(link => link.id));
    state.wallLinks.forEach(link => {
      if (linkIds.has(link.id)) return;
      const fromAppearance = appearanceById(link.fromCardId);
      const toAppearance = appearanceById(link.toCardId);
      if (!fromAppearance || !toAppearance) return;
      state.dossierLinks.push({id:link.id,fromDossierId:fromAppearance.dossierId,toDossierId:toAppearance.dossierId,type:link.type || 'linked to',reason:link.reason || '',sourceBookId:link.sourceBookId || '',chapter:link.chapter || '',confidence:link.confidence ?? '',spoilerThreshold:link.spoilerThreshold || '',createdAt:link.createdAt || Date.now()});
      linkIds.add(link.id);
    });
    state.walls.forEach(wall => {
      state.wallViewports[wall.id] ||= {panX:0,panY:0,zoom:Number(wall.defaultZoom) || 1};
      wall.wallType ||= 'custom'; wall.sourceBookId ||= '';
    });
    normalizeSeriesAndIntegrity();
    state.investigationSchemaVersion = SCHEMA_VERSION;
    saveState();
  }

  function fieldValue(field) {
    if (['linked','multi-linked'].includes(field.type)) {
      const ids = Array.isArray(field.value) ? field.value : field.value ? [field.value] : [];
      return ids.map(id => dossierById(id)?.title).filter(Boolean).join(', ');
    }
    return String(field.value ?? '');
  }

  function fieldFront(field) {
    const value = fieldValue(field); if (!value) return '';
    const style = field.frontStyle || 'label';
    if (style === 'confidence' || field.type === 'confidence') return `<div class="dossier-front-field"><small>${esc(field.name)}</small><div class="confidence-bar"><span style="width:${Math.max(0,Math.min(100,Number(field.value)||0))}%"></span></div></div>`;
    if (style === 'badge' || style === 'status') return `<span class="dossier-chip">${style === 'badge' ? '' : `${esc(field.name)} · `}${esc(value)}</span>`;
    if (style === 'quote') return `<blockquote>${esc(value)}</blockquote>`;
    if (style === 'image') return `<img class="dossier-field-image" src="${esc(value)}" alt="${esc(field.name)}">`;
    if (style === 'value') return `<div class="dossier-front-value">${esc(value)}</div>`;
    return `<div class="dossier-front-field"><small>${esc(field.name)}</small><strong>${esc(value)}</strong></div>`;
  }

  function dossierTile(appearance) {
    const dossier = dossierById(appearance.dossierId); if (!dossier) return '';
    const settings = {...defaultTileSettings(),...(dossier.tileSettings || {})};
    const mode = appearance.displayMode || settings.mode || 'standard';
    const limit = mode === 'compact' ? 0 : mode === 'expanded' ? 6 : 3;
    const frontFields = (dossier.fields || []).filter(item => item.showOnFront);
    const visibleFields = frontFields.slice(0,limit);
    const links = dossierLinks(dossier.id).length;
    const references = state.wallAppearances.filter(item => item.dossierId === dossier.id && item.appearanceType === 'reference').length;
    const crossWall = state.dossierLinks.some(link => (link.fromDossierId === dossier.id || link.toDossierId === dossier.id) && !state.wallAppearances.some(item => item.wallId === appearance.wallId && item.dossierId === (link.fromDossierId === dossier.id ? link.toDossierId : link.fromDossierId)));
    const width = Math.max(220,Math.min(560,Number(appearance.width) || (mode === 'compact' ? 240 : mode === 'expanded' ? 420 : 300)));
    const height = appearance.height ? `height:${Math.max(130,Number(appearance.height))}px;` : '';
    return `<article class="dossier-tile mode-${mode} ${appearance.appearanceType === 'reference' ? 'is-reference' : ''}" data-appearance-id="${appearance.id}" data-dossier-id="${dossier.id}" tabindex="0" aria-label="Open ${esc(dossier.title)} dossier" style="left:${appearance.x}px;top:${appearance.y}px;width:${width}px;${height}z-index:${appearance.zIndex || 10}">
      <div class="dossier-tile-content">
        ${appearance.appearanceType === 'reference' ? '<span class="reference-flag">Reference</span>' : ''}
        ${settings.showCategory ? `<small class="dossier-category">${esc(dossier.category)}</small>` : ''}
        ${settings.showImage && dossier.image ? `<img class="dossier-tile-image" src="${esc(dossier.image)}" alt="">` : ''}
        <h4>${esc(dossier.title)}</h4>
        ${settings.showSummary && dossier.summary ? `<p class="dossier-summary">${esc(dossier.summary)}</p>` : ''}
        ${settings.showSeries && dossier.seriesId ? `<div class="dossier-front-field"><small>Series</small><strong>${esc(seriesName(dossier.seriesId))}</strong></div>` : ''}
        ${settings.showBooks && dossier.bookIds?.length ? `<div class="dossier-front-field"><small>Books</small>${settings.bookStyle==='count'?`<strong>${dossier.bookIds.length} books</strong>`:settings.bookStyle==='first'?`<strong>${esc(state.books.find(book=>book.id===dossier.bookIds[0])?.title||'Book')}${dossier.bookIds.length>1?` +${dossier.bookIds.length-1} more`:''}</strong>`:`<div class="dossier-tags">${dossier.bookIds.slice(0,settings.bookStyle==='full'?99:4).map(id=>`<span>${esc(state.books.find(book=>book.id===id)?.title||'Unknown')}</span>`).join('')}</div>`}</div>` : ''}
        ${visibleFields.length ? `<div class="dossier-front-fields">${visibleFields.map(fieldFront).join('')}</div>` : ''}
        ${frontFields.length > visibleFields.length ? `<span class="more-fields">+${frontFields.length-visibleFields.length} more fields</span>` : ''}
        ${settings.showTags && dossier.tags?.length ? `<div class="dossier-tags">${dossier.tags.slice(0,4).map(tag => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
      </div>
      <footer>${settings.showCounts ? `<span>${links} links · ${references} refs${crossWall?' · ↗ cross-wall':''}</span>` : '<span></span>'}<button type="button" data-open-dossier="${dossier.id}">Open dossier</button></footer>
      <button class="tile-resize" data-resize-appearance="${appearance.id}" aria-label="Resize ${esc(dossier.title)}"></button>
    </article>`;
  }

  function sortedRegionAppearances(region, appearances) {
    const list = appearances.filter(item => item.regionId === region.id);
    const value = item => dossierById(item.dossierId);
    if (region.sortMode === 'alphabetical') list.sort((a,b) => value(a).title.localeCompare(value(b).title));
    if (region.sortMode === 'newest') list.sort((a,b) => value(b).createdAt-value(a).createdAt);
    if (region.sortMode === 'oldest') list.sort((a,b) => value(a).createdAt-value(b).createdAt);
    if (region.sortMode === 'connected') list.sort((a,b) => dossierLinks(b.dossierId).length-dossierLinks(a.dossierId).length);
    return list;
  }

  function applyRegionLayouts() {
    activeRegions().forEach(region => {
      if (region.collapsed || region.layoutMode === 'freeform') return;
      const items = sortedRegionAppearances(region,activeAppearances());
      items.forEach((item,index) => {
        if (region.layoutMode === 'grid') { const cols=Math.max(1,Math.floor((region.width-40)/320)); item.x=region.x+20+(index%cols)*320; item.y=region.y+70+Math.floor(index/cols)*220; }
        if (region.layoutMode === 'vertical') { item.x=region.x+20; item.y=region.y+70+index*220; }
        if (region.layoutMode === 'horizontal') { item.x=region.x+20+index*320; item.y=region.y+70; }
      });
    });
  }

  function ruleMatches(dossier, rule) {
    const key = rule.key || 'category';
    const wall=state.walls.find(item=>item.id===state.activeWallId),books=dossier.bookIds||[];
    let actual = key.startsWith('field:') ? fieldValue((dossier.fields || []).find(field => field.name.toLowerCase() === key.slice(6).toLowerCase()) || {}) : ({category:dossier.category,sourceBookId:dossier.sourceBookId,seriesId:dossier.seriesId,bookIds:books,status:(dossier.fields||[]).find(f=>f.name.toLowerCase()==='status')?.value,tags:(dossier.tags||[]).join(','),type:dossier.sourceType,confidence:(dossier.fields||[]).find(f=>['confidence','percentage'].includes(f.type))?.value}[key]);
    const expected = rule.value ?? '';
    if(rule.operator==='booksAny')return csv(expected).some(id=>books.includes(id));
    if(rule.operator==='booksAll')return csv(expected).every(id=>books.includes(id));
    if(rule.operator==='multiBook')return books.length>1;
    if(rule.operator==='currentWallBook')return !!wall?.sourceBookId&&books.includes(wall.sourceBookId);
    if(rule.operator==='currentWallSeries')return !!wall?.sourceSeriesId&&dossier.seriesId===wall.sourceSeriesId;
    if(rule.operator==='none')return !actual||(Array.isArray(actual)&&!actual.length);
    if (rule.operator === 'oneOf') return csv(expected).some(value => String(actual).toLowerCase() === value.toLowerCase());
    if (rule.operator === 'contains') return String(actual||'').toLowerCase().includes(String(expected).toLowerCase());
    if (rule.operator === 'notEquals') return String(actual||'').toLowerCase() !== String(expected).toLowerCase();
    if (rule.operator === 'gt') return Number(actual) > Number(expected);
    if (rule.operator === 'lt') return Number(actual) < Number(expected);
    if (rule.operator === 'hasLinks') return dossierLinks(dossier.id).length > 0;
    if (rule.operator === 'noLinks') return dossierLinks(dossier.id).length === 0;
    return String(actual||'').toLowerCase() === String(expected).toLowerCase();
  }

  function matchingDossiers(region) { const rules=region.rules||[]; return state.dossiers.filter(d => rules.length && rules.every(rule => ruleMatches(d,rule))); }
  function newAppearance(dossierId,wallId,regionId,type='home') {const region=state.wallRegions.find(item=>item.id===regionId);return{id:uid(),dossierId,wallId,regionId:regionId||'',appearanceType:type,x:(region?.x||50)+30,y:(region?.y||50)+90,width:type==='reference'?240:300,height:null,displayMode:type==='reference'?'compact':'standard',zIndex:10,locked:false};}
  function assignMatchingDossier(dossier,region) {
    if((region.ignoredDossierIds||[]).includes(dossier.id))return null;
    const onWall=state.wallAppearances.filter(item=>item.wallId===region.wallId&&item.dossierId===dossier.id),inTarget=onWall.find(item=>item.regionId===region.id);
    if(inTarget)return null;
    const home=onWall.find(item=>item.appearanceType==='home');
    if(home&&!home.regionId){home.regionId=region.id;return home;}
    if(home){const reference=newAppearance(dossier.id,region.wallId,region.id,'reference');state.wallAppearances.push(reference);return reference;}
    const created=newAppearance(dossier.id,region.wallId,region.id,'home');state.wallAppearances.push(created);return created;
  }
  function moveHomeRegion(dossierId,wallId,targetRegionId,leaveReference=true) {
    const appearances=state.wallAppearances.filter(item=>item.dossierId===dossierId&&item.wallId===wallId),home=appearances.find(item=>item.appearanceType==='home'),target=appearances.find(item=>item.regionId===(targetRegionId||'')&&item.appearanceType==='reference');
    if(target){target.appearanceType='home';if(home&&home.id!==target.id){if(leaveReference&&home.regionId&&!appearances.some(item=>item.id!==home.id&&item.appearanceType==='reference'&&item.regionId===home.regionId))home.appearanceType='reference';else state.wallAppearances=state.wallAppearances.filter(item=>item.id!==home.id);}}else if(home){const oldRegion=home.regionId;if(leaveReference&&oldRegion&&oldRegion!==targetRegionId&&!appearances.some(item=>item.appearanceType==='reference'&&item.regionId===oldRegion))state.wallAppearances.push({...home,id:uid(),appearanceType:'reference'});home.regionId=targetRegionId||'';}else{state.wallAppearances.push(newAppearance(dossierId,wallId,targetRegionId,'home'));}
    normalizeSeriesAndIntegrity();
    return state.wallAppearances.find(item=>item.dossierId===dossierId&&item.wallId===wallId&&item.appearanceType==='home');
  }
  function addRegionReference(dossierId,wallId,regionId) {if(!regionId)return null;const existing=state.wallAppearances.find(item=>item.dossierId===dossierId&&item.wallId===wallId&&item.regionId===regionId);if(existing)return existing;const reference=newAppearance(dossierId,wallId,regionId,'reference');state.wallAppearances.push(reference);return reference;}
  function runAutomaticAssignments() {
    let changed = false;
    activeRegions().filter(r=>r.assignmentMode==='automatic').forEach(region => matchingDossiers(region).forEach(dossier => {
      if(assignMatchingDossier(dossier,region))changed=true;
    }));
    if (changed) queueSave();
  }

  function regionHtml(region) {
    const suggestions = region.assignmentMode === 'assisted' ? matchingDossiers(region).filter(d=>!state.wallAppearances.some(a=>a.wallId===region.wallId&&a.regionId===region.id&&a.dossierId===d.id)) : [];
    return `<section class="wall-region ${region.collapsed?'is-collapsed':''} ${region.locked?'is-locked':''}" data-region-id="${region.id}" aria-label="${esc(region.name)} region" style="left:${region.x}px;top:${region.y}px;width:${region.width}px;height:${region.collapsed?64:region.height}px;--region-color:${esc(region.color||'#856b9e')};z-index:${region.zIndex||1}">
      <header><div><strong>${esc(region.name)}</strong><small>${esc(region.description||'')}</small></div><div class="region-actions"><button data-focus-region="${region.id}" aria-label="Focus region">⌖</button><button data-toggle-region="${region.id}" aria-label="${region.collapsed?'Expand':'Collapse'} region">${region.collapsed?'＋':'−'}</button><button data-edit-region="${region.id}" aria-label="Edit region">•••</button></div></header>
      ${suggestions.length ? `<div class="region-suggestions"><span>${suggestions.length} suggested</span><button data-accept-suggestions="${region.id}">Place matches</button></div>`:''}
      ${!region.locked&&!region.collapsed?`<button class="region-resize" data-resize-region="${region.id}" aria-label="Resize ${esc(region.name)} region"></button>`:''}
    </section>`;
  }

  function filterAppearances(items) {
    return items.filter(item => { const d=dossierById(item.dossierId); if(!d)return false;
      if(wallFilters.query&&!`${d.title} ${d.summary} ${seriesName(d.seriesId)} ${(d.bookIds||[]).map(id=>state.books.find(book=>book.id===id)?.title||'').join(' ')} ${(d.tags||[]).join(' ')} ${(d.fields||[]).map(fieldValue).join(' ')}`.toLowerCase().includes(wallFilters.query.toLowerCase()))return false;
      if(wallFilters.category&&d.category!==wallFilters.category)return false;
      if(wallFilters.tag&&!(d.tags||[]).includes(wallFilters.tag))return false;
      if(wallFilters.book&&!(d.bookIds||[]).includes(wallFilters.book))return false;
      if(wallFilters.seriesId&&d.seriesId!==wallFilters.seriesId)return false;
      if(wallFilters.multiBook&&(d.bookIds||[]).length<2)return false;
      if(wallFilters.noSeries&&d.seriesId)return false;
      if(wallFilters.noBooks&&(d.bookIds||[]).length)return false;
      if(wallFilters.status&&!String((d.fields||[]).find(f=>f.name.toLowerCase()==='status')?.value||'').toLowerCase().includes(wallFilters.status.toLowerCase()))return false;
      if(wallFilters.region&&item.regionId!==wallFilters.region)return false;
      if(wallFilters.unresolved&&['confirmed','resolved'].includes(String((d.fields||[]).find(f=>f.name.toLowerCase()==='status')?.value||'').toLowerCase()))return false;
      if(wallFilters.orphans&&item.regionId)return false; return true;
    });
  }

  renderWall = function renderInfiniteWall() {
    runAutomaticAssignments(); applyRegionLayouts();
    const el=document.getElementById('wall'),wall=activeWall(),viewport=activeViewport();
    const appearances=filterAppearances(activeAppearances());
    const categories=[...new Set(state.dossiers.map(d=>d.category))].sort(); const tags=[...new Set(state.dossiers.flatMap(d=>d.tags||[]))].sort();
    el.innerHTML=`<div class="wall-tabs"><div class="wall-tab-scroll">${state.walls.map(w=>`<button class="wall-tab ${w.id===wall.id?'is-active':''}" data-action="switch-wall" data-id="${w.id}">${esc(w.name)}</button>`).join('')}</div><button class="small-button" data-action="new-wall">＋ Wall</button><button class="small-button" data-action="edit-wall">Edit</button></div>
      <div class="infinite-wall-toolbar"><div><p class="eyebrow">${esc(wall.description||'Infinite investigation canvas')}</p><strong>${state.dossiers.length} dossiers · ${appearances.length} appearances · ${activeRegions().length} regions</strong></div><div class="button-row"><button class="primary-button" data-new-dossier>Add Dossier</button><button class="secondary-button" data-new-region>Add Region</button><button class="secondary-button" data-action="create-link">Link Dossiers</button></div></div>
      <div class="wall-navigation"><input class="text-input" id="wallSearch" value="${esc(wallFilters.query)}" placeholder="Search and jump…" aria-label="Search dossiers"><select id="wallCategory"><option value="">All categories</option>${categories.map(x=>`<option ${wallFilters.category===x?'selected':''}>${esc(x)}</option>`).join('')}</select><select id="wallTag"><option value="">All tags</option>${tags.map(x=>`<option ${wallFilters.tag===x?'selected':''}>${esc(x)}</option>`).join('')}</select><select id="wallBook"><option value="">All books</option>${state.books.map(b=>`<option value="${b.id}" ${wallFilters.book===b.id?'selected':''}>${esc(b.title)}</option>`).join('')}</select><select id="wallSeries"><option value="">All series</option>${state.series.map(item=>`<option value="${item.id}" ${wallFilters.seriesId===item.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select><select id="wallRegion"><option value="">All regions</option>${activeRegions().map(r=>`<option value="${r.id}" ${wallFilters.region===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select><input class="text-input compact-filter" id="wallStatus" value="${esc(wallFilters.status)}" placeholder="Status"><button data-filter-unresolved class="${wallFilters.unresolved?'is-active':''}">Unresolved</button><button data-filter-multibook class="${wallFilters.multiBook?'is-active':''}">Multiple books</button><button data-filter-noseries class="${wallFilters.noSeries?'is-active':''}">No series</button><button data-filter-nobooks class="${wallFilters.noBooks?'is-active':''}">No books</button><button data-filter-orphans class="${wallFilters.orphans?'is-active':''}">Orphans</button><button data-fit-all>Fit all</button><button data-reset-view>Reset</button><button data-zoom="out" aria-label="Zoom out">−</button><output id="wallZoom">${Math.round(viewport.zoom*100)}%</output><button data-zoom="in" aria-label="Zoom in">＋</button></div>
      <div class="infinite-canvas" id="infiniteCanvas" tabindex="0" aria-label="Infinite conspiracy wall canvas"><div class="infinite-world" id="infiniteWorld" style="transform:translate(${viewport.panX}px,${viewport.panY}px) scale(${viewport.zoom})"><svg class="infinite-lines" id="infiniteLines" aria-hidden="true"></svg>${activeRegions().map(regionHtml).join('')}${appearances.map(dossierTile).join('')}</div><div class="canvas-help">Drag empty space to pan · Wheel to zoom · Drag tiles and regions to arrange</div></div>`;
    bindInfiniteWall(); redraw();
  };

  function applyTransform() { const v=activeViewport(),world=document.getElementById('infiniteWorld'); if(world)world.style.transform=`translate(${v.panX}px,${v.panY}px) scale(${v.zoom})`; const out=document.getElementById('wallZoom');if(out)out.value=`${Math.round(v.zoom*100)}%`; redraw(); }
  function worldPoint(clientX,clientY) { const rect=document.getElementById('infiniteCanvas').getBoundingClientRect(),v=activeViewport();return{x:(clientX-rect.left-v.panX)/v.zoom,y:(clientY-rect.top-v.panY)/v.zoom}; }

  function bindInfiniteWall() {
    const canvas=document.getElementById('infiniteCanvas'); if(!canvas)return;
    canvas.addEventListener('click', event => {
      const target=event.target.closest('button,[data-appearance-id]'); if(!target)return;
      if(target.dataset.openDossier)return openDossier(target.dataset.openDossier);
      if(target.dataset.appearanceId&&!event.target.closest('button')){if(target.dataset.justDragged){delete target.dataset.justDragged;return;}return openDossier(target.dataset.dossierId,target.dataset.appearanceId);}
      if(target.dataset.newDossier!==undefined)return openDossierEditor();
      if(target.dataset.newRegion!==undefined)return openRegionEditor();
      if(target.dataset.editRegion)return openRegionEditor(target.dataset.editRegion);
      if(target.dataset.focusRegion)return focusRegion(target.dataset.focusRegion);
      if(target.dataset.toggleRegion){const r=state.wallRegions.find(x=>x.id===target.dataset.toggleRegion);r.collapsed=!r.collapsed;saveState();renderWall();return;}
      if(target.dataset.acceptSuggestions)return acceptSuggestions(target.dataset.acceptSuggestions);
    });
    elBind('[data-new-dossier]',()=>openDossierEditor()); elBind('[data-new-region]',()=>openRegionEditor());
    elBind('[data-fit-all]',fitAll); elBind('[data-reset-view]',()=>{state.wallViewports[state.activeWallId]={panX:0,panY:0,zoom:1};saveState();applyTransform();});
    elBind('[data-filter-orphans]',()=>{wallFilters.orphans=!wallFilters.orphans;renderWall();});
    elBind('[data-filter-unresolved]',()=>{wallFilters.unresolved=!wallFilters.unresolved;renderWall();});elBind('[data-filter-multibook]',()=>{wallFilters.multiBook=!wallFilters.multiBook;renderWall();});elBind('[data-filter-noseries]',()=>{wallFilters.noSeries=!wallFilters.noSeries;renderWall();});elBind('[data-filter-nobooks]',()=>{wallFilters.noBooks=!wallFilters.noBooks;renderWall();});
    document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>zoomAt(b.dataset.zoom==='in'?1.2:1/1.2));
    ['wallCategory','wallTag','wallBook','wallSeries','wallRegion'].forEach(id=>document.getElementById(id).onchange=e=>{wallFilters[{wallCategory:'category',wallTag:'tag',wallBook:'book',wallSeries:'seriesId',wallRegion:'region'}[id]]=e.target.value;renderWall();});
    document.getElementById('wallSearch').oninput=e=>{wallFilters.query=e.target.value;renderWall();requestAnimationFrame(()=>{const input=document.getElementById('wallSearch');input?.focus();input?.setSelectionRange(input.value.length,input.value.length);});};
    document.getElementById('wallSearch').onkeydown=e=>{if(e.key==='Enter'){const first=filterAppearances(activeAppearances())[0];if(first)focusAppearance(first.id);}};
    document.getElementById('wallStatus').onchange=e=>{wallFilters.status=e.target.value;renderWall();};
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(Math.exp(-e.deltaY*.001),e.clientX,e.clientY);},{passive:false});
    bindCanvasPan(canvas); document.querySelectorAll('.dossier-tile').forEach(bindAppearanceDrag); document.querySelectorAll('.wall-region').forEach(bindRegionDrag);
    document.querySelectorAll('[data-resize-appearance]').forEach(button=>bindResizeHandle(button,'appearance'));
    document.querySelectorAll('[data-resize-region]').forEach(button=>bindResizeHandle(button,'region'));
  }
  function elBind(selector,fn){const e=document.querySelector(selector);if(e)e.onclick=fn;}

  function bindCanvasPan(canvas) { let start;
    canvas.onpointerdown=e=>{if(e.target!==canvas)return;canvas.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY,panX:activeViewport().panX,panY:activeViewport().panY};canvas.classList.add('is-panning');};
    canvas.onpointermove=e=>{if(!start)return;activeViewport().panX=start.panX+e.clientX-start.x;activeViewport().panY=start.panY+e.clientY-start.y;applyTransform();};
    canvas.onpointerup=()=>{if(start){start=null;canvas.classList.remove('is-panning');queueSave();}};
  }
  function zoomAt(factor,cx,cy){const canvas=document.getElementById('infiniteCanvas'),v=activeViewport(),rect=canvas.getBoundingClientRect();cx??=rect.left+rect.width/2;cy??=rect.top+rect.height/2;const old=v.zoom,next=Math.max(.2,Math.min(2.5,old*factor));const wx=(cx-rect.left-v.panX)/old,wy=(cy-rect.top-v.panY)/old;v.zoom=next;v.panX=cx-rect.left-wx*next;v.panY=cy-rect.top-wy*next;applyTransform();queueSave();}

  function bindAppearanceDrag(element){let start,moved=false; element.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const a=appearanceById(element.dataset.appearanceId);if(a.locked)return;start={point:worldPoint(e.clientX,e.clientY),x:a.x,y:a.y};moved=false;element.setPointerCapture(e.pointerId);element.classList.add('is-selected');};element.onpointermove=e=>{if(!start)return;const a=appearanceById(element.dataset.appearanceId),p=worldPoint(e.clientX,e.clientY);a.x=start.x+p.x-start.point.x;a.y=start.y+p.y-start.point.y;element.style.left=`${a.x}px`;element.style.top=`${a.y}px`;moved=true;redraw();};element.onpointerup=()=>{if(!start)return;const a=appearanceById(element.dataset.appearanceId);start=null;if(moved){element.dataset.justDragged='true';assignToContainingRegion(a);saveState();}};}
  function assignToContainingRegion(a){const cx=a.x+(a.width||300)/2,cy=a.y+(a.height||150)/2;const region=activeRegions().filter(r=>!r.collapsed&&cx>=r.x&&cx<=r.x+r.width&&cy>=r.y&&cy<=r.y+r.height).sort((a,b)=>(b.zIndex||1)-(a.zIndex||1))[0],targetId=region?.id||'';const duplicate=targetId&&state.wallAppearances.find(item=>item.id!==a.id&&item.dossierId===a.dossierId&&item.wallId===a.wallId&&item.regionId===targetId&&item.appearanceType==='reference');if(duplicate){if(a.appearanceType==='home')duplicate.appearanceType='home';state.wallAppearances=state.wallAppearances.filter(item=>item.id!==a.id);normalizeSeriesAndIntegrity();requestAnimationFrame(()=>focusAppearance(duplicate.id));return duplicate;}a.regionId=targetId;return a;}
  function bindRegionDrag(element){let start; element.querySelector('header').onpointerdown=e=>{if(e.target.closest('button'))return;const r=state.wallRegions.find(x=>x.id===element.dataset.regionId);if(r.locked)return;start={point:worldPoint(e.clientX,e.clientY),x:r.x,y:r.y,children:activeAppearances().filter(a=>a.regionId===r.id).map(a=>({a,x:a.x,y:a.y}))};element.setPointerCapture(e.pointerId);};element.onpointermove=e=>{if(!start)return;const r=state.wallRegions.find(x=>x.id===element.dataset.regionId),p=worldPoint(e.clientX,e.clientY),dx=p.x-start.point.x,dy=p.y-start.point.y;r.x=start.x+dx;r.y=start.y+dy;element.style.left=`${r.x}px`;element.style.top=`${r.y}px`;start.children.forEach(c=>{c.a.x=c.x+dx;c.a.y=c.y+dy;const tile=document.querySelector(`[data-appearance-id="${c.a.id}"]`);if(tile){tile.style.left=`${c.a.x}px`;tile.style.top=`${c.a.y}px`;}});redraw();};element.onpointerup=()=>{if(start){start=null;saveState();}};}
  function bindResizeHandle(button,kind){button.onpointerdown=e=>{e.stopPropagation();const id=kind==='appearance'?button.dataset.resizeAppearance:button.dataset.resizeRegion,obj=kind==='appearance'?appearanceById(id):state.wallRegions.find(x=>x.id===id),start={x:e.clientX,y:e.clientY,w:obj.width||300,h:obj.height||180};button.setPointerCapture(e.pointerId);button.onpointermove=move=>{if(!start)return;const scale=activeViewport().zoom;obj.width=Math.max(kind==='appearance'?220:360,Math.min(kind==='appearance'?560:1800,start.w+(move.clientX-start.x)/scale));obj.height=Math.max(kind==='appearance'?130:180,Math.min(kind==='appearance'?700:1400,start.h+(move.clientY-start.y)/scale));const host=button.parentElement;host.style.width=`${obj.width}px`;host.style.height=`${obj.height}px`;redraw();};button.onpointerup=()=>{start=null;button.onpointermove=null;queueSave();};};}

  function drawInfiniteLinks(){const svg=document.getElementById('infiniteLines');if(!svg)return;const appearances=activeAppearances(),byDossier=new Map();appearances.forEach(a=>{if(!byDossier.has(a.dossierId)||a.appearanceType==='home')byDossier.set(a.dossierId,a);});svg.innerHTML=state.dossierLinks.map(link=>{const a=byDossier.get(link.fromDossierId),b=byDossier.get(link.toDossierId);if(!a||!b)return'';const x1=a.x+(a.width||300)/2,y1=a.y+(a.height||160)/2,x2=b.x+(b.width||300)/2,y2=b.y+(b.height||160)/2;return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line><text x="${(x1+x2)/2}" y="${(y1+y2)/2-8}">${esc(link.type)}</text></g>`;}).join('');}
  function boundsFor(items){if(!items.length)return null;return {minX:Math.min(...items.map(x=>x.x)),minY:Math.min(...items.map(x=>x.y)),maxX:Math.max(...items.map(x=>x.x+x.width)),maxY:Math.max(...items.map(x=>x.y+x.height))};}
  function fitBounds(bounds){if(!bounds)return;const canvas=document.getElementById('infiniteCanvas'),pad=70,w=bounds.maxX-bounds.minX,h=bounds.maxY-bounds.minY,v=activeViewport();v.zoom=Math.max(.2,Math.min(1.5,Math.min((canvas.clientWidth-pad*2)/Math.max(1,w),(canvas.clientHeight-pad*2)/Math.max(1,h))));v.panX=(canvas.clientWidth-w*v.zoom)/2-bounds.minX*v.zoom;v.panY=(canvas.clientHeight-h*v.zoom)/2-bounds.minY*v.zoom;applyTransform();queueSave();}
  function fitAll(){const items=[...activeRegions().map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),...activeAppearances().map(a=>({x:a.x,y:a.y,width:a.width||300,height:a.height||160}))];fitBounds(boundsFor(items));}
  function focusRegion(id){const r=state.wallRegions.find(x=>x.id===id);if(r)fitBounds({minX:r.x,minY:r.y,maxX:r.x+r.width,maxY:r.y+r.height});}
  function focusAppearance(id){const a=appearanceById(id);if(!a)return;const canvas=document.getElementById('infiniteCanvas'),v=activeViewport();v.panX=canvas.clientWidth/2-(a.x+(a.width||300)/2)*v.zoom;v.panY=canvas.clientHeight/2-(a.y+(a.height||160)/2)*v.zoom;applyTransform();setTimeout(()=>document.querySelector(`[data-appearance-id="${id}"]`)?.classList.add('is-reference-target'),50);}

  function seriesName(id){return state.series.find(item=>item.id===id)?.name||'';}
  function dossierBooksEditor(dossier={}){const selected=new Set(dossier.bookIds||[]);return `<div class="book-assignment"><div class="editor-row"><input id="dBookSearch" class="text-input" placeholder="Search books" aria-label="Search books"><button type="button" id="selectSeriesBooks">Select all books in series</button><button type="button" id="clearDossierBooks">Clear books</button></div><div id="dossierBookChoices">${state.books.map(book=>`<label class="book-choice" data-book-search="${esc(`${book.title} ${book.series||''}`.toLowerCase())}" data-book-series="${book.seriesId||''}"><input type="checkbox" value="${book.id}" ${selected.has(book.id)?'checked':''}> <span>${esc(book.title)}</span><small>${esc(book.series||seriesName(book.seriesId)||'No series')}</small></label>`).join('')}</div></div>`;}
  function appearancesEditorHtml(dossier){if(!dossier)return '<p>Save this dossier to create its first appearance.</p>';return state.walls.map(wall=>{const items=state.wallAppearances.filter(item=>item.dossierId===dossier.id&&item.wallId===wall.id),home=items.find(item=>item.appearanceType==='home'),refs=items.filter(item=>item.appearanceType==='reference'),regions=state.wallRegions.filter(item=>item.wallId===wall.id);return `<article class="appearance-wall" data-appearance-wall="${wall.id}"><header><strong>${esc(wall.name)}</strong><span>${items.length} appearance${items.length===1?'':'s'}</span></header><label>Home region<select class="home-region"><option value="">Unassigned canvas</option>${regions.map(region=>`<option value="${region.id}" ${home?.regionId===region.id?'selected':''}>${esc(region.name)}</option>`).join('')}</select></label><label class="form-check"><input class="leave-reference" type="checkbox" checked>Leave a reference in the previous region</label><div class="editor-row"><button type="button" data-apply-home="${wall.id}">${home?'Move home':'Create home'}</button>${home?`<button type="button" data-jump-editor-appearance="${home.id}">Jump to home</button>`:''}<select class="reference-region"><option value="">Add reference to region…</option>${regions.map(region=>`<option value="${region.id}">${esc(region.name)}</option>`).join('')}</select><button type="button" data-add-editor-reference="${wall.id}">Add reference</button></div><div class="appearance-reference-list">${refs.map(ref=>`<div><span>${esc(regions.find(region=>region.id===ref.regionId)?.name||'Unassigned reference')}</span><button type="button" data-jump-editor-appearance="${ref.id}">Jump</button><button type="button" data-promote-editor-reference="${ref.id}">Set as home</button><button type="button" data-remove-editor-reference="${ref.id}">Remove</button></div>`).join('')||'<small>No references on this wall.</small>'}</div></article>`;}).join('');}

  function fieldEditorRow(field={}) {const linked=Array.isArray(field.value)?field.value:field.value?[field.value]:[];return `<div class="dossier-field-editor" data-field-id="${field.id||uid()}"><div class="editor-row"><input class="text-input field-name" value="${esc(field.name||'')}" placeholder="Custom field name"><select class="field-type">${FIELD_TYPES.map(x=>`<option value="${x}" ${field.type===x?'selected':''}>${x}</option>`).join('')}</select><button type="button" data-move-field="up">↑</button><button type="button" data-move-field="down">↓</button><button type="button" data-remove-field>×</button></div><div class="editor-row field-value-wrap">${['linked','multi-linked'].includes(field.type)?linkedSelect(field.type==='multi-linked',linked):`<textarea class="text-area field-value" placeholder="Value">${esc(field.value??'')}</textarea>`}<label><input type="checkbox" class="field-front" ${field.showOnFront?'checked':''}> Tile front</label><select class="field-style">${FRONT_STYLES.map(x=>`<option value="${x}" ${field.frontStyle===x?'selected':''}>${x}</option>`).join('')}</select></div></div>`;}
  function linkedSelect(multiple,selected=[]){return `<select class="field-value" ${multiple?'multiple size="4"':''}><option value="">No linked dossier</option>${state.dossiers.map(d=>`<option value="${d.id}" ${selected.includes(d.id)?'selected':''}>${esc(d.category)} › ${esc(d.title)}</option>`).join('')}</select>`;}
  function sectionRow(section={}){return `<div class="dossier-section-editor" data-section-id="${section.id||uid()}"><div class="editor-row"><input class="text-input section-name" value="${esc(section.title||'')}" placeholder="Section title"><button type="button" data-move-section="up">↑</button><button type="button" data-move-section="down">↓</button><button type="button" data-remove-section>×</button></div><textarea class="text-area section-value" placeholder="Section details">${esc(section.value||'')}</textarea></div>`;}
  function bindReorder(container,itemSelector,moveAttr,removeAttr){container.onclick=e=>{const remove=e.target.closest(`[${removeAttr}]`),move=e.target.closest(`[${moveAttr}]`);if(remove)return remove.closest(itemSelector).remove();if(move){const row=move.closest(itemSelector),sibling=move.getAttribute(moveAttr)==='up'?row.previousElementSibling:row.nextElementSibling;if(sibling)move.getAttribute(moveAttr)==='up'?container.insertBefore(row,sibling):container.insertBefore(sibling,row);}};}

  function openDossierEditor(id='',appearanceId='') {const d=id?dossierById(id):null;modal(`<div class="dossier-editor"><p class="eyebrow">${d?'Edit canonical dossier':'New canonical dossier'}</p><h2 id="formModalTitle">${esc(d?.title||'Build a dossier')}</h2><div class="form-grid"><label class="form-group"><span class="field-label">Category</span><input id="dCategory" class="text-input" value="${esc(d?.category||'Evidence')}"></label><label class="form-group"><span class="field-label">Title</span><input id="dTitle" class="text-input" value="${esc(d?.title||'')}"></label><label class="form-group full"><span class="field-label">Summary</span><textarea id="dSummary" class="text-area">${esc(d?.summary||'')}</textarea></label><label class="form-group"><span class="field-label">Image URL</span><input id="dImage" class="text-input" value="${esc(d?.image||'')}"></label><label class="form-group"><span class="field-label">Tags, comma separated</span><input id="dTags" class="text-input" value="${esc((d?.tags||[]).join(', '))}"></label><label class="form-group"><span class="field-label">Series</span><input id="dSeries" class="text-input" list="seriesChoices" value="${esc(seriesName(d?.seriesId))}" placeholder="No series"><datalist id="seriesChoices">${state.series.map(item=>`<option value="${esc(item.name)}"></option>`).join('')}</datalist></label><label class="form-group"><span class="field-label">Legacy source book</span><select id="dBook"><option value="">No book</option>${bookOptions(d?.sourceBookId||'')}</select></label><label class="form-group"><span class="field-label">Spoiler threshold</span><input id="dSpoiler" class="text-input" value="${esc(d?.spoilerThreshold||'')}"></label></div><section class="editor-section"><header><h3>Books</h3><small>Select zero or more books; outside-series choices are preserved.</small></header>${dossierBooksEditor(d||{})}</section><section class="editor-section"><header><h3>Appearances and Regions</h3><small>One home per wall; one reference per region.</small></header><div id="appearanceRegionEditor">${appearancesEditorHtml(d)}</div></section><section class="editor-section"><header><h3>Custom Fields</h3><button id="addDossierField" type="button">＋ Add Field</button></header><div id="dossierFields">${(d?.fields||[]).map(fieldEditorRow).join('')}</div></section><section class="editor-section"><header><h3>Custom Sections</h3><button id="addDossierSection" type="button">＋ Add Section</button></header><div id="dossierSections">${(d?.sections||[]).map(sectionRow).join('')}</div></section><section class="editor-section"><h3>Tile Front</h3><div class="form-grid"><label>Mode<select id="dMode">${['compact','standard','expanded'].map(x=>`<option ${d?.tileSettings?.mode===x?'selected':''}>${x}</option>`).join('')}</select></label>${[['Summary','showSummary'],['Image','showImage'],['Counts','showCounts'],['Tags','showTags'],['Category','showCategory'],['Series','showSeries'],['Books','showBooks']].map(([label,key])=>`<label class="form-check"><input type="checkbox" id="${key}" ${(d?.tileSettings?.[key]??defaultTileSettings()[key])?'checked':''}>${label}</label>`).join('')}<label>Books style<select id="bookStyle">${['chips','count','first','full'].map(style=>`<option ${d?.tileSettings?.bookStyle===style?'selected':''}>${style}</option>`).join('')}</select></label></div></section><div class="button-row"><button class="primary-button" id="saveDossier">Save Dossier</button>${d?'<button class="secondary-button" id="deleteDossier">Delete Canonical Dossier</button>':''}</div></div>`);document.getElementById('formModal').classList.add('dossier-drawer');
    const fields=document.getElementById('dossierFields'),sections=document.getElementById('dossierSections'); fields.insertAdjacentHTML ||= function(){};
    const refreshBookVisibility=()=>{const query=document.getElementById('dBookSearch').value.toLowerCase(),series=state.series.find(item=>item.name.toLowerCase()===v('dSeries').toLowerCase())?.id||'';document.querySelectorAll('.book-choice').forEach(label=>{label.hidden=!!query&&!label.dataset.bookSearch.includes(query);label.classList.toggle('outside-series',!!series&&label.dataset.bookSeries!==series);});};
    document.getElementById('dBookSearch').oninput=refreshBookVisibility;document.getElementById('dSeries').onchange=refreshBookVisibility;document.getElementById('selectSeriesBooks').onclick=()=>{const series=state.series.find(item=>item.name.toLowerCase()===v('dSeries').toLowerCase())?.id;document.querySelectorAll('.book-choice').forEach(label=>{if(series&&label.dataset.bookSeries===series)label.querySelector('input').checked=true;});};document.getElementById('clearDossierBooks').onclick=()=>document.querySelectorAll('.book-choice input').forEach(input=>input.checked=false);
    const appearanceEditor=document.getElementById('appearanceRegionEditor');if(d)appearanceEditor.onclick=e=>{const wallRow=e.target.closest('[data-appearance-wall]');if(!wallRow)return;const wallId=wallRow.dataset.appearanceWall;if(e.target.closest('[data-apply-home]')){moveHomeRegion(d.id,wallId,wallRow.querySelector('.home-region').value,wallRow.querySelector('.leave-reference').checked);saveState();openDossierEditor(d.id);return;}if(e.target.closest('[data-add-editor-reference]')){addRegionReference(d.id,wallId,wallRow.querySelector('.reference-region').value);normalizeSeriesAndIntegrity();saveState();openDossierEditor(d.id);return;}const remove=e.target.closest('[data-remove-editor-reference]'),promote=e.target.closest('[data-promote-editor-reference]'),jump=e.target.closest('[data-jump-editor-appearance]');if(remove){state.wallAppearances=state.wallAppearances.filter(item=>item.id!==remove.dataset.removeEditorReference);saveState();openDossierEditor(d.id);}if(promote){const ref=appearanceById(promote.dataset.promoteEditorReference);moveHomeRegion(d.id,ref.wallId,ref.regionId,false);saveState();openDossierEditor(d.id);}if(jump)jumpToAppearance(jump.dataset.jumpEditorAppearance);};
    document.getElementById('addDossierField').onclick=()=>{fields.insertAdjacentHTML('beforeend',fieldEditorRow());};document.getElementById('addDossierSection').onclick=()=>sections.insertAdjacentHTML('beforeend',sectionRow());bindReorder(fields,'.dossier-field-editor','data-move-field','data-remove-field');bindReorder(sections,'.dossier-section-editor','data-move-section','data-remove-section');
    fields.onchange=e=>{if(!e.target.classList.contains('field-type'))return;const row=e.target.closest('.dossier-field-editor'),old=row.querySelector('.field-value'),linked=['linked','multi-linked'].includes(e.target.value);if(linked)old.outerHTML=linkedSelect(e.target.value==='multi-linked',[]);else old.outerHTML='<textarea class="text-area field-value" placeholder="Value"></textarea>';};
    document.getElementById('saveDossier').onclick=()=>{const title=v('dTitle');if(!title)return showToast('A dossier needs a title.');const now=Date.now(),seriesId=state.series.find(item=>item.name.toLowerCase()===v('dSeries').toLowerCase())?.id||'',bookIds=[...document.querySelectorAll('.book-choice input:checked')].map(input=>input.value),data={category:v('dCategory')||'Custom',title,summary:v('dSummary'),image:v('dImage'),tags:csv(v('dTags')),seriesId,bookIds,sourceBookId:v('dBook'),spoilerThreshold:v('dSpoiler'),fields:[...fields.querySelectorAll('.dossier-field-editor')].map(row=>{const input=row.querySelector('.field-value'),multiple=input.multiple;return{id:row.dataset.fieldId,name:row.querySelector('.field-name').value.trim(),type:row.querySelector('.field-type').value,value:multiple?[...input.selectedOptions].map(o=>o.value).filter(Boolean):input.value,showOnFront:row.querySelector('.field-front').checked,frontStyle:row.querySelector('.field-style').value};}).filter(f=>f.name),sections:[...sections.querySelectorAll('.dossier-section-editor')].map(row=>({id:row.dataset.sectionId,title:row.querySelector('.section-name').value.trim(),value:row.querySelector('.section-value').value.trim()})).filter(s=>s.title||s.value),tileSettings:{mode:v('dMode'),showSummary:document.getElementById('showSummary').checked,showImage:document.getElementById('showImage').checked,showCounts:document.getElementById('showCounts').checked,showTags:document.getElementById('showTags').checked,showCategory:document.getElementById('showCategory').checked,showSeries:document.getElementById('showSeries').checked,showBooks:document.getElementById('showBooks').checked,bookStyle:v('bookStyle')},updatedAt:now};if(d)Object.assign(d,data);else{const dossier={id:uid(),...data,createdAt:now,sourceType:'custom'};state.dossiers.push(dossier);state.wallAppearances.push({id:uid(),dossierId:dossier.id,wallId:state.activeWallId,regionId:'',appearanceType:'home',x:80,y:100,width:300,height:null,displayMode:data.tileSettings.mode,zIndex:10,locked:false});}normalizeSeriesAndIntegrity();runAutomaticAssignments();saveState();closeDossierModal();renderWall();};
    if(d)document.getElementById('deleteDossier').onclick=()=>{if(!confirm(`Delete ${d.title} and every appearance and link?`))return;state.dossiers=state.dossiers.filter(x=>x.id!==d.id);state.wallAppearances=state.wallAppearances.filter(x=>x.dossierId!==d.id);state.dossierLinks=state.dossierLinks.filter(x=>x.fromDossierId!==d.id&&x.toDossierId!==d.id);state.dossiers.forEach(x=>(x.fields||[]).forEach(f=>{if(['linked','multi-linked'].includes(f.type)){const values=Array.isArray(f.value)?f.value:[f.value];f.value=(f.type==='linked'?values.filter(y=>y!==d.id)[0]||'':values.filter(y=>y!==d.id));}}));saveState();closeDossierModal();renderWall();};
  }
  function closeDossierModal(){document.getElementById('formModal').classList.remove('dossier-drawer');closeModal();}

  function openDossier(id,appearanceId='') {const d=dossierById(id);if(!d)return;const links=dossierLinks(id),appearances=state.wallAppearances.filter(a=>a.dossierId===id);modal(`<div class="dossier-detail"><p class="eyebrow">${esc(d.category)}</p><h2 id="formModalTitle">${esc(d.title)}</h2>${d.image?`<img class="dossier-hero" src="${esc(d.image)}" alt="">`:''}<p class="dossier-detail-summary">${esc(d.summary||'No summary recorded.')}</p>${d.tags?.length?`<div class="dossier-tags">${d.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<div class="dossier-detail-grid"><section><h3>Fields</h3>${(d.fields||[]).map(f=>`<div class="detail-field"><small>${esc(f.name)}</small><strong>${esc(fieldValue(f))}</strong></div>`).join('')||'<p>No custom fields.</p>'}</section><section><h3>Sections</h3>${(d.sections||[]).map(s=>`<article><h4>${esc(s.title)}</h4><p>${esc(s.value)}</p></article>`).join('')||'<p>No custom sections.</p>'}</section><section><h3>Connections</h3>${links.map(l=>{const other=dossierById(l.fromDossierId===id?l.toDossierId:l.fromDossierId);return `<button data-jump-dossier="${other?.id||''}">${esc(l.type)} · ${esc(other?.title||'Missing')}</button><p>${esc(l.reason||'')}</p>`;}).join('')||'<p>No links.</p>'}</section><section><h3>Appearances</h3>${appearances.map(a=>{const w=state.walls.find(x=>x.id===a.wallId),r=state.wallRegions.find(x=>x.id===a.regionId);return `<button data-jump-appearance="${a.id}">${a.appearanceType==='reference'?'Reference':'Home'} · ${esc(w?.name||'')} ${r?`› ${esc(r.name)}`:''}</button>`;}).join('')}</section></div><p class="field-help">Source: ${esc(state.books.find(b=>b.id===d.sourceBookId)?.title||'None')} · Spoilers: ${esc(d.spoilerThreshold||'Not set')} · Updated ${new Date(d.updatedAt||d.createdAt).toLocaleString()}</p><div class="button-row"><button class="primary-button" id="editDossier">Edit dossier</button><button class="secondary-button" id="addReference">Add reference here</button>${appearanceId&&appearanceById(appearanceId)?.appearanceType==='reference'?'<button class="secondary-button" id="deleteReference">Remove this reference</button>':''}</div></div>`);document.getElementById('formModal').classList.add('dossier-drawer');document.getElementById('editDossier').onclick=()=>openDossierEditor(id,appearanceId);document.getElementById('addReference').onclick=()=>{state.wallAppearances.push({id:uid(),dossierId:id,wallId:state.activeWallId,regionId:'',appearanceType:'reference',x:120,y:130,width:240,height:null,displayMode:'compact',zIndex:10,locked:false});saveState();closeDossierModal();renderWall();};if(document.getElementById('deleteReference'))document.getElementById('deleteReference').onclick=()=>{state.wallAppearances=state.wallAppearances.filter(a=>a.id!==appearanceId);saveState();closeDossierModal();renderWall();};document.querySelectorAll('[data-jump-appearance]').forEach(b=>b.onclick=()=>jumpToAppearance(b.dataset.jumpAppearance));document.querySelectorAll('[data-jump-dossier]').forEach(b=>b.onclick=()=>openDossier(b.dataset.jumpDossier));}
  function jumpToAppearance(id){const a=appearanceById(id);if(!a)return;state.activeWallId=a.wallId;saveState();closeDossierModal();renderWall();requestAnimationFrame(()=>focusAppearance(id));}

  function ruleRow(rule={}){return `<div class="rule-row" data-rule-id="${rule.id||uid()}"><input class="rule-key" value="${esc(rule.key||'category')}" placeholder="category, seriesId, bookIds, field:Status"><select class="rule-operator">${['equals','notEquals','oneOf','contains','gt','lt','hasLinks','noLinks','booksAny','booksAll','multiBook','currentWallBook','currentWallSeries','none'].map(x=>`<option value="${x}" ${rule.operator===x?'selected':''}>${x}</option>`).join('')}</select><input class="rule-value" value="${esc(rule.value||'')}" placeholder="Match IDs or value"><button type="button" data-remove-rule>×</button></div>`;}
  function openRegionEditor(id=''){const r=id?state.wallRegions.find(x=>x.id===id):null;modal(`<p class="eyebrow">Canvas region</p><h2 id="formModalTitle">${r?'Edit Region':'Add Region'}</h2><div class="form-grid"><label>Name<input id="rName" class="text-input" value="${esc(r?.name||'New Region')}"></label><label>Color<input id="rColor" type="color" value="${esc(r?.color||'#856b9e')}"></label><label class="full">Description<textarea id="rDesc" class="text-area">${esc(r?.description||'')}</textarea></label><label>Layout<select id="rLayout">${LAYOUTS.map(x=>`<option ${r?.layoutMode===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Sort<select id="rSort">${SORTS.map(x=>`<option ${r?.sortMode===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Assignment<select id="rAssignment">${['manual','assisted','automatic'].map(x=>`<option ${r?.assignmentMode===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="form-check"><input id="rLocked" type="checkbox" ${r?.locked?'checked':''}>Locked</label><label class="form-check"><input id="rReferences" type="checkbox" ${r?.allowReferences!==false?'checked':''}>Allow references</label></div><section class="editor-section"><header><div><h3>Matching Rules</h3><small>All rules use AND logic. Use field:Field Name for custom fields.</small></div><button id="addRule" type="button">＋ Rule</button></header><div id="regionRules">${(r?.rules||[]).map(ruleRow).join('')}</div></section><div class="button-row"><button id="saveRegion" class="primary-button">Save Region</button>${r?'<button id="forwardRegion">Bring Forward</button><button id="backRegion">Send Back</button><button id="deleteRegion" class="secondary-button">Delete Region</button>':''}</div>`);const rules=document.getElementById('regionRules');document.getElementById('addRule').onclick=()=>rules.insertAdjacentHTML('beforeend',ruleRow());rules.onclick=e=>{if(e.target.closest('[data-remove-rule]'))e.target.closest('.rule-row').remove();};document.getElementById('saveRegion').onclick=()=>{const data={name:v('rName')||'Region',description:v('rDesc'),color:v('rColor'),layoutMode:v('rLayout'),sortMode:v('rSort'),assignmentMode:v('rAssignment'),locked:document.getElementById('rLocked').checked,allowReferences:document.getElementById('rReferences').checked,rules:[...rules.querySelectorAll('.rule-row')].map(row=>({id:row.dataset.ruleId,key:row.querySelector('.rule-key').value.trim(),operator:row.querySelector('.rule-operator').value,value:row.querySelector('.rule-value').value.trim()}))};if(r)Object.assign(r,data);else state.wallRegions.push({id:uid(),wallId:state.activeWallId,...data,x:80,y:80,width:760,height:520,zIndex:1,collapsed:false});saveState();closeModal();renderWall();};if(r){document.getElementById('forwardRegion').onclick=()=>{r.zIndex=Math.max(...activeRegions().map(x=>x.zIndex||1))+1;saveState();closeModal();renderWall();};document.getElementById('backRegion').onclick=()=>{r.zIndex=Math.min(...activeRegions().map(x=>x.zIndex||1))-1;saveState();closeModal();renderWall();};document.getElementById('deleteRegion').onclick=()=>{if(!confirm('Delete this region? Dossiers will become unassigned.'))return;state.wallAppearances.filter(a=>a.regionId===r.id).forEach(a=>a.regionId='');state.wallRegions=state.wallRegions.filter(x=>x.id!==r.id);saveState();closeModal();renderWall();};}}
  function acceptSuggestions(id){const r=state.wallRegions.find(x=>x.id===id);matchingDossiers(r).forEach(d=>assignMatchingDossier(d,r));normalizeSeriesAndIntegrity();saveState();renderWall();}

  openWallCardForm = function(){openDossierEditor();};
  closeModal = function closeModalAndDrawer(id='formModal'){document.getElementById(id)?.classList.remove('dossier-drawer');originalCloseModal(id);};
  openEditCard = function(id){const appearance=appearanceById(id);if(appearance)openDossier(appearance.dossierId,id);else{const dossier=dossierById(id);if(dossier)openDossier(dossier.id);}};
  openLinkForm = function(prefill=''){if(state.dossiers.length<2)return showToast('Add at least two dossiers first.');const pre=appearanceById(prefill)?.dossierId||prefill;modal(`<p class="eyebrow">Canonical relationship</p><h2 id="formModalTitle">Link Dossiers</h2><label>From<select id="dlFrom">${state.dossiers.map(d=>`<option value="${d.id}" ${d.id===pre?'selected':''}>${esc(d.category)} › ${esc(d.title)}</option>`).join('')}</select></label><label>Relationship<input id="dlType" class="text-input" placeholder="supports, bonded to, contradicts…"></label><label>To<select id="dlTo">${state.dossiers.map(d=>`<option value="${d.id}">${esc(d.category)} › ${esc(d.title)}</option>`).join('')}</select></label><label>Explanation<textarea id="dlReason" class="text-area"></textarea></label><div class="form-grid"><label>Source book<select id="dlBook"><option value="">None</option>${bookOptions()}</select></label><label>Chapter<input id="dlChapter" class="text-input"></label><label>Confidence<input id="dlConfidence" type="number" min="0" max="100"></label><label>Spoiler threshold<input id="dlSpoiler" class="text-input"></label></div><button id="saveDossierLink" class="primary-button full-width">Create Link</button>`);document.getElementById('saveDossierLink').onclick=()=>{const from=v('dlFrom'),to=v('dlTo');if(from===to)return showToast('Choose two different dossiers.');state.dossierLinks.push({id:uid(),fromDossierId:from,toDossierId:to,type:v('dlType')||'linked to',reason:v('dlReason'),sourceBookId:v('dlBook'),chapter:v('dlChapter'),confidence:v('dlConfidence'),spoilerThreshold:v('dlSpoiler'),createdAt:Date.now()});saveState();closeModal();renderWall();};};
  openWallForm = function(existing=null){originalOpenWallForm(existing);const content=document.getElementById('formModalContent'),button=document.getElementById('saveWall');if(!button)return;button.insertAdjacentHTML('beforebegin',`<div class="form-grid"><label>Wall type<select id="wallType">${['book','series','investigation','custom'].map(x=>`<option ${existing?.wallType===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Source series<select id="wallSourceSeries"><option value="">No source</option>${state.series.map(item=>`<option value="${item.id}" ${existing?.sourceSeriesId===item.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label><label>Source book<select id="wallSourceBook"><option value="">No source</option>${bookOptions(existing?.sourceBookId||'')}</select></label><label>Default zoom<input id="wallDefaultZoom" type="number" min="0.2" max="2.5" step="0.1" value="${existing?.defaultZoom||1}"></label></div>`);const old=button.onclick;button.onclick=()=>{old();const wall=existing||state.walls.at(-1);if(wall){wall.wallType=v('wallType');wall.sourceBookId=v('wallSourceBook');wall.sourceSeriesId=v('wallSourceSeries')||state.books.find(book=>book.id===wall.sourceBookId)?.seriesId||'';wall.defaultZoom=Number(v('wallDefaultZoom'))||1;state.wallViewports[wall.id]||={panX:0,panY:0,zoom:wall.defaultZoom};saveState();}};};
  handleAction = function(a,id){if(a==='add-wall-card')return openDossierEditor();if(a==='create-link')return openLinkForm(id);return originalHandleAction(a,id);};

  openPinSource = function pinCanonicalSource(type,id){const source=sourceData(type,id);if(!source)return;modal(`<p class="eyebrow">Pin canonical dossier</p><h2 id="formModalTitle">Choose a wall</h2><p><strong>${esc(source.title)}</strong><br>${esc(source.text)}</p><label>Destination wall<select id="pinWall">${state.walls.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></label><label>Category<input id="pinCategory" class="text-input" value="${esc(source.category)}"></label><button class="primary-button full-width" id="doPin">Pin to Wall</button>`);document.getElementById('doPin').onclick=()=>{let dossier=state.dossiers.find(d=>d.sourceType===type&&d.sourceId===id);if(!dossier){dossier={id:uid(),category:v('pinCategory')||source.category,title:source.title,summary:source.text,image:'',tags:[],sourceBookId:type==='book'?id:'',spoilerThreshold:'',fields:[],sections:[],tileSettings:defaultTileSettings(),sourceType:type,sourceId:id,createdAt:Date.now(),updatedAt:Date.now()};state.dossiers.push(dossier);}const wallId=v('pinWall');if(!state.wallAppearances.some(a=>a.wallId===wallId&&a.dossierId===dossier.id))state.wallAppearances.push({id:uid(),dossierId:dossier.id,wallId,regionId:'',appearanceType:'home',x:80,y:100,width:300,height:null,displayMode:'standard',zIndex:10,locked:false});state.activeWallId=wallId;normalizeSeriesAndIntegrity();saveState();closeModal();switchView('wall');};};

  globalThis.InfiniteWall={openDossier,jumpToAppearance,moveHomeRegion,addRegionReference,assignMatchingDossier,normalizeSeriesAndIntegrity,reevaluateRegions:()=>{runAutomaticAssignments();normalizeSeriesAndIntegrity();saveState();if(activeView==='wall')renderWall();}};

  migrateInvestigationState();
  if (activeView === 'wall') renderWall();
})();
