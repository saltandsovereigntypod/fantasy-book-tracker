import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft } from './library';
import { getAuthSnapshot } from './supabase';
import './library-metadata-runtime.css';

type ExtendedArchive = V2ArchiveState & { bookSeriesPositions?: Record<string,string> };
type SortCriterion = 'none'|'updated-new'|'updated-old'|'created-new'|'created-old'|'title-az'|'title-za'|'author-az'|'author-za'|'series-az'|'series-za'|'series-number'|'rating-high'|'rating-low'|'spice-high'|'impact-high'|'progress-high'|'progress-low'|'status'|'favorite-first';
type GroupCriterion = 'none'|'series'|'author'|'status'|'rating'|'progress'|'favorite'|'genre';

const SORT_OPTIONS: Array<[SortCriterion,string]> = [
  ['none','None'],['series-az','Series A to Z'],['series-za','Series Z to A'],['series-number','Number in series'],['title-az','Title A to Z'],['title-za','Title Z to A'],['author-az','Author A to Z'],['author-za','Author Z to A'],['updated-new','Recently updated'],['updated-old','Least recently updated'],['created-new','Newest added'],['created-old','Oldest added'],['rating-high','Rating high to low'],['rating-low','Rating low to high'],['progress-high','Progress high to low'],['progress-low','Progress low to high'],['spice-high','Spice high to low'],['impact-high','Emotional impact high to low'],['status','Reading status'],['favorite-first','Favorites first'],
];
const GROUP_OPTIONS: Array<[GroupCriterion,string]> = [
  ['none','No grouping'],['series','Series'],['author','Author'],['status','Reading status'],['rating','Rating'],['progress','Progress band'],['favorite','Favorite status'],['genre','Primary genre'],
];

function seriesNumber(value:string|undefined):number { const parsed=Number(value); return Number.isFinite(parsed)?parsed:Number.MAX_SAFE_INTEGER; }
function text(value:unknown):string { return String(value||'').trim(); }
function compareCriterion(a:V2BookRecord,b:V2BookRecord,sort:SortCriterion,positions:Record<string,string>):number {
  if(sort==='none')return 0;
  if(sort==='updated-new')return b.updatedAt.localeCompare(a.updatedAt);
  if(sort==='updated-old')return a.updatedAt.localeCompare(b.updatedAt);
  if(sort==='created-new')return b.createdAt.localeCompare(a.createdAt);
  if(sort==='created-old')return a.createdAt.localeCompare(b.createdAt);
  if(sort==='title-az')return a.title.localeCompare(b.title);
  if(sort==='title-za')return b.title.localeCompare(a.title);
  if(sort==='author-az')return a.author.localeCompare(b.author);
  if(sort==='author-za')return b.author.localeCompare(a.author);
  if(sort==='series-az')return text(a.series).localeCompare(text(b.series));
  if(sort==='series-za')return text(b.series).localeCompare(text(a.series));
  if(sort==='series-number')return seriesNumber(positions[a.id])-seriesNumber(positions[b.id]);
  if(sort==='rating-high')return b.rating-a.rating;
  if(sort==='rating-low')return a.rating-b.rating;
  if(sort==='spice-high')return b.spice-a.spice;
  if(sort==='impact-high')return b.impact-a.impact;
  if(sort==='progress-high')return b.progress-a.progress;
  if(sort==='progress-low')return a.progress-b.progress;
  if(sort==='status')return text(a.status).localeCompare(text(b.status));
  if(sort==='favorite-first')return Number(Boolean(b.favorite))-Number(Boolean(a.favorite));
  return 0;
}
function compareBooks(a:V2BookRecord,b:V2BookRecord,sorts:SortCriterion[],positions:Record<string,string>):number {
  for(const sort of sorts){const result=compareCriterion(a,b,sort,positions);if(result)return result;}
  return a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
}
function groupLabel(book:V2BookRecord,group:GroupCriterion):string {
  if(group==='series')return text(book.series)||'Standalone';
  if(group==='author')return text(book.author)||'Unknown author';
  if(group==='status')return ({want:'Want to read',reading:'Currently reading',paused:'Paused',completed:'Completed',dnf:'DNF'} as Record<string,string>)[book.status]||text(book.status)||'Unknown status';
  if(group==='rating')return book.rating>0?`${book.rating} star${book.rating===1?'':'s'}`:'Unrated';
  if(group==='progress'){const p=Number(book.progress)||0;return p>=100?'Completed':p>=75?'75–99%':p>=50?'50–74%':p>=25?'25–49%':p>0?'1–24%':'Not started';}
  if(group==='favorite')return book.favorite?'Favorites':'Other books';
  if(group==='genre')return text(book.genres?.[0])||'No genre';
  return '';
}

function LibraryMetadataTools(){
  const[archive,setArchive]=useState<ExtendedArchive|null>(null); const[editorTarget,setEditorTarget]=useState<Element|null>(null); const[libraryTarget,setLibraryTarget]=useState<Element|null>(null); const[currentBookId,setCurrentBookId]=useState(''); const[position,setPosition]=useState(''); const[saveState,setSaveState]=useState('');
  const[primary,setPrimary]=useState<SortCriterion>('updated-new'); const[secondary,setSecondary]=useState<SortCriterion>('none'); const[tertiary,setTertiary]=useState<SortCriterion>('none'); const[group,setGroup]=useState<GroupCriterion>('none');
  useEffect(()=>{let active=true;const syncTargets=()=>{setEditorTarget(document.querySelector('.v2-view--editor .book-panel .field-stack'));setLibraryTarget(document.querySelector('.v2-view--library .v2-library-controls'));};syncTargets();const observer=new MutationObserver(syncTargets);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});getAuthSnapshot().then(async({user})=>{if(!user||!active)return;const next=await loadCloudArchive(user) as ExtendedArchive;if(active)setArchive(next);}).catch(()=>undefined);return()=>{active=false;observer.disconnect();};},[]);
  useEffect(()=>{if(!editorTarget||!archive)return;loadWorkspaceDraft().then(draft=>{const id=draft?.book?.id||'';setCurrentBookId(id);setPosition(id?(archive.bookSeriesPositions?.[id]||''):'');}).catch(()=>undefined);},[editorTarget,archive]);
  const booksByTitle=useMemo(()=>{const map=new Map<string,V2BookRecord[]>();for(const book of archive?.books||[]){const key=book.title.trim().toLowerCase();map.set(key,[...(map.get(key)||[]),book]);}return map;},[archive?.books]);
  useEffect(()=>{if(!libraryTarget||!archive)return;const timer=window.setTimeout(()=>{const grid=document.querySelector<HTMLElement>('.v2-view--library .v2-library-grid');if(!grid)return;grid.querySelectorAll(':scope > .library-group-marker').forEach(marker=>marker.remove());const articles=[...grid.querySelectorAll<HTMLElement>(':scope > article')];const used=new Set<string>();const mapped=articles.map(article=>{const textValue=(article.querySelector('.card-title,[data-binding="title"],h2,h3,strong')?.textContent||article.textContent||'').trim().toLowerCase();const matches=[...(booksByTitle.get(textValue)||[])];const book=matches.find(item=>!used.has(item.id))||archive.books.find(item=>article.textContent?.includes(item.title)&&!used.has(item.id));if(book){used.add(book.id);article.dataset.bookId=book.id;}return{article,book};}).filter((entry):entry is {article:HTMLElement;book:V2BookRecord}=>Boolean(entry.book));mapped.sort((a,b)=>compareBooks(a.book,b.book,[primary,secondary,tertiary],archive.bookSeriesPositions||{}));let previousGroup='';mapped.forEach(entry=>{if(group!=='none'){const label=groupLabel(entry.book,group);if(label!==previousGroup){const marker=document.createElement('div');marker.className='library-group-marker';marker.innerHTML=`<span>${label}</span>`;grid.appendChild(marker);previousGroup=label;}}grid.appendChild(entry.article);});},20);return()=>window.clearTimeout(timer);},[libraryTarget,archive,primary,secondary,tertiary,group,booksByTitle]);
  async function savePosition(){if(!archive||!currentBookId)return;const clean=position.trim();const nextMap={...(archive.bookSeriesPositions||{})};if(!clean||clean.toLowerCase()==='n/a'||clean.toLowerCase()==='na')delete nextMap[currentBookId];else nextMap[currentBookId]=clean;const next={...archive,bookSeriesPositions:nextMap,updatedAt:new Date().toISOString()};setArchive(next);saveLocalArchive(next);setSaveState('Saving…');try{const{user}=await getAuthSnapshot();if(!user)throw new Error('Session expired');await saveCloudArchive(user,next);setSaveState(clean&&clean.toLowerCase()!=='n/a'?'Saved':'Standalone book');window.setTimeout(()=>setSaveState(''),1500);}catch{setSaveState('Save failed');}}
  const sortSelect=(label:string,value:SortCriterion,onChange:(next:SortCriterion)=>void,key:string)=><label><span>{label}</span><select data-library-pref={key} value={value} onChange={event=>onChange(event.target.value as SortCriterion)}>{SORT_OPTIONS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
  return <>{editorTarget&&createPortal(<section className="series-position-field"><div><label htmlFor="series-position-input">Book number in series</label><small>Use a number such as 1, 2, or 3.5. Enter N/A or leave blank for a standalone.</small></div><div><input id="series-position-input" value={position} onChange={event=>setPosition(event.target.value)} onBlur={()=>void savePosition()} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void savePosition();}}} placeholder="N/A"/><button type="button" onClick={()=>void savePosition()}>Save</button></div>{saveState&&<em>{saveState}</em>}</section>,editorTarget)}{libraryTarget&&createPortal(<div className="advanced-library-sort"><div className="advanced-library-sort-priorities">{sortSelect('1st',primary,setPrimary,'sortPrimary')}{sortSelect('2nd',secondary,setSecondary,'sortSecondary')}{sortSelect('3rd',tertiary,setTertiary,'sortTertiary')}</div><label className="advanced-library-group"><span>Group</span><select data-library-pref="groupBy" value={group} onChange={event=>setGroup(event.target.value as GroupCriterion)}>{GROUP_OPTIONS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>,libraryTarget)}</>;
}
function start(){const host=document.createElement('div');host.id='library-metadata-runtime';document.body.appendChild(host);createRoot(host).render(<StrictMode><LibraryMetadataTools/></StrictMode>);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();