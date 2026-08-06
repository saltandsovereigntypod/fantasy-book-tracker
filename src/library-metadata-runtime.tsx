import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft } from './library';
import { getAuthSnapshot } from './supabase';
import './library-metadata-runtime.css';

type ExtendedArchive = V2ArchiveState & { bookSeriesPositions?: Record<string,string> };
type AdvancedSort = 'updated-new'|'updated-old'|'created-new'|'created-old'|'title-az'|'title-za'|'author-az'|'author-za'|'series-az'|'series-za'|'series-number'|'rating-high'|'rating-low'|'spice-high'|'impact-high'|'progress-high'|'progress-low';

function seriesNumber(value:string|undefined):number { const parsed=Number(value); return Number.isFinite(parsed)?parsed:Number.MAX_SAFE_INTEGER; }
function compareBooks(a:V2BookRecord,b:V2BookRecord,sort:AdvancedSort,positions:Record<string,string>):number {
  if(sort==='updated-old')return a.updatedAt.localeCompare(b.updatedAt);
  if(sort==='created-new')return b.createdAt.localeCompare(a.createdAt);
  if(sort==='created-old')return a.createdAt.localeCompare(b.createdAt);
  if(sort==='title-az')return a.title.localeCompare(b.title);
  if(sort==='title-za')return b.title.localeCompare(a.title);
  if(sort==='author-az')return a.author.localeCompare(b.author)||a.title.localeCompare(b.title);
  if(sort==='author-za')return b.author.localeCompare(a.author)||a.title.localeCompare(b.title);
  if(sort==='series-az')return a.series.localeCompare(b.series)||seriesNumber(positions[a.id])-seriesNumber(positions[b.id])||a.title.localeCompare(b.title);
  if(sort==='series-za')return b.series.localeCompare(a.series)||seriesNumber(positions[a.id])-seriesNumber(positions[b.id])||a.title.localeCompare(b.title);
  if(sort==='series-number')return seriesNumber(positions[a.id])-seriesNumber(positions[b.id])||a.series.localeCompare(b.series)||a.title.localeCompare(b.title);
  if(sort==='rating-high')return b.rating-a.rating||a.title.localeCompare(b.title);
  if(sort==='rating-low')return a.rating-b.rating||a.title.localeCompare(b.title);
  if(sort==='spice-high')return b.spice-a.spice||b.rating-a.rating;
  if(sort==='impact-high')return b.impact-a.impact||b.rating-a.rating;
  if(sort==='progress-high')return b.progress-a.progress||a.title.localeCompare(b.title);
  if(sort==='progress-low')return a.progress-b.progress||a.title.localeCompare(b.title);
  return b.updatedAt.localeCompare(a.updatedAt);
}

function LibraryMetadataTools(){
  const[archive,setArchive]=useState<ExtendedArchive|null>(null); const[editorTarget,setEditorTarget]=useState<Element|null>(null); const[libraryTarget,setLibraryTarget]=useState<Element|null>(null); const[currentBookId,setCurrentBookId]=useState(''); const[position,setPosition]=useState(''); const[saveState,setSaveState]=useState(''); const[sort,setSort]=useState<AdvancedSort>('updated-new');
  useEffect(()=>{let active=true;const syncTargets=()=>{setEditorTarget(document.querySelector('.v2-view--editor .book-panel .field-stack'));setLibraryTarget(document.querySelector('.v2-view--library .v2-library-controls'));};syncTargets();const observer=new MutationObserver(syncTargets);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});getAuthSnapshot().then(async({user})=>{if(!user||!active)return;const next=await loadCloudArchive(user) as ExtendedArchive;if(active)setArchive(next);}).catch(()=>undefined);return()=>{active=false;observer.disconnect();};},[]);
  useEffect(()=>{if(!editorTarget||!archive)return;loadWorkspaceDraft().then(draft=>{const id=draft?.book?.id||'';setCurrentBookId(id);setPosition(id?(archive.bookSeriesPositions?.[id]||''):'');}).catch(()=>undefined);},[editorTarget,archive]);
  const booksByTitle=useMemo(()=>{const map=new Map<string,V2BookRecord[]>();for(const book of archive?.books||[]){const key=book.title.trim().toLowerCase();map.set(key,[...(map.get(key)||[]),book]);}return map;},[archive?.books]);
  useEffect(()=>{if(!libraryTarget||!archive)return;const timer=window.setTimeout(()=>{const grid=document.querySelector('.v2-view--library .v2-library-grid');if(!grid)return;const articles=[...grid.querySelectorAll<HTMLElement>(':scope > article')];const used=new Set<string>();const mapped=articles.map(article=>{const text=(article.querySelector('.card-title,[data-binding="title"],h2,h3,strong')?.textContent||article.textContent||'').trim().toLowerCase();const matches=[...(booksByTitle.get(text)||[])];const book=matches.find(item=>!used.has(item.id))||archive.books.find(item=>article.textContent?.includes(item.title)&&!used.has(item.id));if(book){used.add(book.id);article.dataset.bookId=book.id;}return{article,book};}).filter((entry):entry is {article:HTMLElement;book:V2BookRecord}=>Boolean(entry.book));mapped.sort((a,b)=>compareBooks(a.book,b.book,sort,archive.bookSeriesPositions||{})).forEach(entry=>grid.appendChild(entry.article));},20);return()=>window.clearTimeout(timer);},[libraryTarget,archive,sort,booksByTitle]);
  async function savePosition(){if(!archive||!currentBookId)return;const clean=position.trim();const nextMap={...(archive.bookSeriesPositions||{})};if(!clean||clean.toLowerCase()==='n/a'||clean.toLowerCase()==='na')delete nextMap[currentBookId];else nextMap[currentBookId]=clean;const next={...archive,bookSeriesPositions:nextMap,updatedAt:new Date().toISOString()};setArchive(next);saveLocalArchive(next);setSaveState('Saving…');try{const{user}=await getAuthSnapshot();if(!user)throw new Error('Session expired');await saveCloudArchive(user,next);setSaveState(clean&&clean.toLowerCase()!=='n/a'?'Saved':'Standalone book');window.setTimeout(()=>setSaveState(''),1500);}catch{setSaveState('Save failed');}}
  return <>{editorTarget&&createPortal(<section className="series-position-field"><div><label htmlFor="series-position-input">Book number in series</label><small>Use a number such as 1, 2, or 3.5. Enter N/A or leave blank for a standalone.</small></div><div><input id="series-position-input" value={position} onChange={event=>setPosition(event.target.value)} onBlur={()=>void savePosition()} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void savePosition();}}} placeholder="N/A"/><button type="button" onClick={()=>void savePosition()}>Save</button></div>{saveState&&<em>{saveState}</em>}</section>,editorTarget)}{libraryTarget&&createPortal(<label className="advanced-library-sort">Detailed sort<select value={sort} onChange={event=>setSort(event.target.value as AdvancedSort)}><option value="updated-new">Recently updated</option><option value="updated-old">Least recently updated</option><option value="created-new">Newest added</option><option value="created-old">Oldest added</option><option value="title-az">Title A to Z</option><option value="title-za">Title Z to A</option><option value="author-az">Author A to Z</option><option value="author-za">Author Z to A</option><option value="series-az">Series A to Z, then book number</option><option value="series-za">Series Z to A, then book number</option><option value="series-number">Book number in series</option><option value="rating-high">Rating high to low</option><option value="rating-low">Rating low to high</option><option value="spice-high">Spice high to low</option><option value="impact-high">Emotional impact high to low</option><option value="progress-high">Progress high to low</option><option value="progress-low">Progress low to high</option></select></label>,libraryTarget)}</>;
}
function start(){const host=document.createElement('div');host.id='library-metadata-runtime';document.body.appendChild(host);createRoot(host).render(<StrictMode><LibraryMetadataTools/></StrictMode>);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
