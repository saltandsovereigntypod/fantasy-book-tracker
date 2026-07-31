const STORAGE_KEY = 'warCollegeArchiveStateV1';

const PATHS = {
  rider: {
    name: 'Dragon Rider', short: 'Riders Quadrant', glyph: '🐉', accent: 'black leather and steel',
    description: 'Life-or-death command language, black leather, scorched reports, and a dragon that judges your survival instincts.',
    ranks: ['Candidate','Rider Cadet','Bonded Rider','Squad Leader','Section Leader','Wingleader'],
    progressName: 'Command', creatureType: 'Dragon', milestone: 'Threshing',
    copy: {
      navDashboard:'Command Hall', navLibrary:'Campaigns', navSession:'Reading Deployment', navTheories:'Intelligence Ledger', navWall:'Conspiracy Wall', navProfile:'Service Record', currentRank:'Current Rank',
      heroTitle:'Every chapter is a battlefield. Read like your squad depends on it.', heroBody:'Track the campaign, secure intelligence, and record every suspicion before it gets someone killed.',
      addBook:'Assign New Campaign', addTheory:'Record a Suspicion', startSession:'Begin Deployment', completeBook:'You survived the campaign.', saveTheory:'Secure this intelligence', noBooks:'No active campaigns are currently assigned.', noTheories:'No suspicions have been entered. Dangerous.', error:'Something failed. Try again before it becomes fatal.', success:'Intelligence secured.'
    }
  },
  scribe: {
    name:'Scribe', short:'Scribe Quadrant', glyph:'🪶', accent:'cream parchment and archival ink',
    description:'Cream parchment, indexed records, precise language, and a quietly judgmental archive that notices every contradiction.',
    ranks:['Scribe Candidate','Scribe Cadet','Archivist','Senior Archivist','Royal Archivist','Curator'],
    progressName:'Scholarly Standing', creatureType:'Archive Familiar', milestone:'Archival Appointment',
    copy:{
      navDashboard:'Central Archive', navLibrary:'Catalogued Volumes', navSession:'Text Examination', navTheories:'Hypothesis Register', navWall:'Evidence Map', navProfile:'Archival Record', currentRank:'Current Appointment',
      heroTitle:'Preserve the record. Separate testimony from truth.', heroBody:'Catalog each volume, document every contradiction, and allow no unsupported claim to pass into history.',
      addBook:'Catalogue New Volume', addTheory:'Enter Working Hypothesis', startSession:'Resume Examination', completeBook:'This volume has been fully documented.', saveTheory:'Enter into the archive', noBooks:'No volumes have been entered into the catalogue.', noTheories:'No supporting record currently exists.', error:'Record could not be preserved. Please resubmit.', success:'Historical record amended.'
    }
  },
  gryphon: {
    name:'Gryphon Flier', short:'Poromiel Drift', glyph:'🦅', accent:'brown leather and rebel copper',
    description:'Brown leather, weathered maps, rebellious commentary, and an interface that assumes the official story is lying.',
    ranks:['Flier Candidate','Flier Cadet','Bonded Flier','Driftleader','Wing Captain','Flight Commander'],
    progressName:'Defiance', creatureType:'Gryphon', milestone:'The Leap',
    copy:{
      navDashboard:'Rebel Command', navLibrary:'Liberated Stories', navSession:'Field Reading', navTheories:'Counter-Narratives', navWall:'The Real Story', navProfile:'Rebel Record', currentRank:'Current Standing',
      heroTitle:'Question the official story. Someone is always lying.', heroBody:'Read between sanctioned lines, dismantle convenient narratives, and preserve the evidence they hoped you would miss.',
      addBook:'Seize Another Story', addTheory:'Challenge the Record', startSession:'Return to the Field', completeBook:'Another sanctioned narrative dismantled.', saveTheory:'Add it to the real story', noBooks:'No stories have been liberated yet.', noTheories:'No one has challenged the official version. Suspicious.', error:'The system objected. Naturally. Try again.', success:'The real story has been updated.'
    }
  },
  dark: {
    name:'Dark Wielder', short:'The Source Below', glyph:'🐲', accent:'purple corruption and living shadow',
    description:'Violet corruption, hungry language, unstable layouts, and a wyvern that seems far too interested in your theories.',
    ranks:['Initiate','Asim','Sage','Maven'], progressName:'Power', creatureType:'Wyvern', milestone:'First Channeling',
    copy:{
      navDashboard:'The Hollow', navLibrary:'Worlds Consumed', navSession:'Feeding', navTheories:'Whispered Truths', navWall:'The Web', navProfile:'Corruption Record', currentRank:'Current Ascension',
      heroTitle:'Feed the suspicion. Let the story show you where it is weakest.', heroBody:'Consume every world, bind every clue to the web, and enjoy the moment certainty begins to scream.',
      addBook:'Consume Another World', addTheory:'Feed the Suspicion', startSession:'Draw from the Source', completeBook:'Delicious. Another world consumed.', saveTheory:'Bind it to the web', noBooks:'The hunger has not yet been fed.', noTheories:'Nothing whispers here yet. Disturbing.', error:'Something broke. How exciting. Do it again.', success:'The web tightens.'
    }
  },
  infantry: {
    name:'Infantry', short:'Infantry Quadrant', glyph:'⚔️', accent:'dark navy and weathered canvas',
    description:'Dark navy, disciplined grids, practical field language, and steady progress that values returning over perfection.',
    ranks:['Infantry Recruit','Infantry Cadet','Squad Corporal','Squad Sergeant','Company Captain','Battalion Commander'],
    progressName:'Merit', creatureType:'War Hound', milestone:'First Deployment',
    copy:{
      navDashboard:'Field Command', navLibrary:'Campaign Roster', navSession:'Deployment', navTheories:'Field Intelligence', navWall:'Tactical Board', navProfile:'Service Record', currentRank:'Current Rank',
      heroTitle:'Slow progress is still ground taken.', heroBody:'Advance one position at a time, log every useful piece of intelligence, and return to formation whenever the campaign is interrupted.',
      addBook:'Assign Objective', addTheory:'Log Field Intelligence', startSession:'Begin Deployment', completeBook:'Objective secured.', saveTheory:'Submit field intelligence', noBooks:'No objectives are currently assigned.', noTheories:'No field intelligence has been logged.', error:'Transmission failed. Regroup and retry.', success:'Field intelligence submitted.'
    }
  },
  healer: {
    name:'Healer', short:'Healer Quadrant', glyph:'⚕️', accent:'light blue linen and glass',
    description:'Light blue, breathable layouts, careful observations, and a calm interface that treats emotional damage as useful information.',
    ranks:['Healer Candidate','Healer Cadet','Field Healer','Senior Healer','Master Healer','Chief Healer'],
    progressName:'Mastery', creatureType:'Healing Familiar', milestone:'First Assessment',
    copy:{
      navDashboard:'Healer Station', navLibrary:'Case Records', navSession:'Observation Session', navTheories:'Diagnostic Notes', navWall:'Diagnostic Board', navProfile:'Clinical Record', currentRank:'Current Appointment',
      heroTitle:'You noticed what others dismissed.', heroBody:'Observe carefully, document the pattern beneath the wound, and remember that rest is information rather than failure.',
      addBook:'Open New Case', addTheory:'Record Possible Cause', startSession:'Begin Observation', completeBook:'Assessment complete. Emotional condition pending.', saveTheory:'Add to the assessment', noBooks:'No active case records are open.', noTheories:'No underlying causes have been proposed.', error:'The entry did not save. Nothing is lost yet. Try once more.', success:'Assessment updated.'
    }
  }
};

const QUIZ = [
  { q:'When a threat appears, what do you do first?', a:[['Stand between it and everyone else','protective'],['Study it until I understand the weakness','strategic'],['Break the rule that allowed it to happen','rebellious'],['Reach for more power than is sensible','ambitious']]},
  { q:'Which truth unsettles you most?', a:[['That loyalty can be exploited','loyal'],['That history can be rewritten','curious'],['That safety can become obedience','independent'],['That power always asks for more','intuitive']]},
  { q:'What makes a theory irresistible?', a:[['It protects someone everyone misjudged','empathetic'],['It explains several clues at once','strategic'],['It contradicts the official answer','rebellious'],['It is dangerous enough to be true','risk']]},
  { q:'What would your companion value most?', a:[['Courage under pressure','brave'],['Patience and observation','controlled'],['Fierce independence','independent'],['Relentless hunger','ambitious']]}
];

const DEFAULT_STATE = {
  onboarded:false, profile:{ name:'Reader', path:'rider', creatureName:'Vaelith', creatureType:'Dragon', signet:'Thread-Sight', temperament:'Watchful, territorial, deeply selective', rankIndex:0, points:0 },
  books:[], theories:[], wallCards:[], sessions:[], currentSession:null
};

let state = loadState();
let activeView = 'dashboard';
let sessionTimer = null;
let sessionSeconds = 0;

function loadState(){
  try { return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return structuredClone(DEFAULT_STATE); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function path(){ return PATHS[state.profile.path] || PATHS.rider; }
function copy(key){ return path().copy[key] || key; }
function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function uid(){ return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`; }
function showToast(message){ const t=document.getElementById('toast'); t.textContent=message; t.classList.add('is-visible'); setTimeout(()=>t.classList.remove('is-visible'),2400); }
function openModal(id){ const el=document.getElementById(id); el.classList.add('is-open'); el.setAttribute('aria-hidden','false'); }
function closeModal(id){ const el=document.getElementById(id); el.classList.remove('is-open'); el.setAttribute('aria-hidden','true'); }

function init(){
  buildPathGrid(); bindGlobalEvents();
  if(!state.onboarded) openModal('onboardingModal');
  else renderAll();
}

function buildPathGrid(){
  const grid = document.getElementById('pathGrid');
  grid.innerHTML = Object.entries(PATHS).map(([key,p]) => `<button class="path-choice" data-path-choice="${key}"><span style="font-size:30px">${p.glyph}</span><strong>${p.name}</strong><small>${p.description}</small></button>`).join('');
  grid.addEventListener('click', e=>{
    const btn=e.target.closest('[data-path-choice]'); if(!btn) return;
    document.querySelectorAll('.path-choice').forEach(x=>x.classList.remove('is-selected'));
    btn.classList.add('is-selected'); state.profile.path=btn.dataset.pathChoice;
    document.getElementById('app').dataset.path=state.profile.path;
  });
}

function bindGlobalEvents(){
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  document.querySelectorAll('[data-close-modal]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.closeModal)));
  document.getElementById('profileChip').addEventListener('click',()=>switchView('profile'));
  document.getElementById('quickMarkBtn').addEventListener('click',()=>openQuickMark());
  document.getElementById('continueOnboarding').addEventListener('click',continueOnboarding);
  document.getElementById('backOnboarding').addEventListener('click',()=>setOnboardingStep(1));
  document.getElementById('finishOnboarding').addEventListener('click',finishOnboarding);
  document.getElementById('enterArchive').addEventListener('click',()=>{ state.onboarded=true; saveState(); closeModal('onboardingModal'); renderAll(); });
  document.getElementById('resetApp').addEventListener('click',()=>{ if(confirm('Reset all locally stored data for this prototype?')){ localStorage.removeItem(STORAGE_KEY); location.reload(); } });
}

function continueOnboarding(){
  const name=document.getElementById('readerName').value.trim();
  if(!name){ showToast('Enter a reader name first.'); return; }
  if(!document.querySelector('.path-choice.is-selected')){ showToast('Choose a path first.'); return; }
  state.profile.name=name;
  const p=path();
  document.getElementById('quizIntro').innerHTML=`<p class="eyebrow">${p.milestone}</p><h3 style="font:600 28px var(--heading-font);margin:8px 0">${['rider','gryphon','dark'].includes(state.profile.path)?`Your ${p.creatureType} is waiting.`:'Complete your path assessment.'}</h3><p style="color:var(--muted)">Your answers influence your companion, signet, temperament, and opening title. No tools are locked by the result.</p>`;
  document.getElementById('quizQuestions').innerHTML=QUIZ.map((q,i)=>`<div class="quiz-question"><h4>${i+1}. ${q.q}</h4><div class="answer-list">${q.a.map((a,j)=>`<label class="answer-option"><input type="radio" name="q${i}" value="${a[1]}" ${j===0?'checked':''}><span>${a[0]}</span></label>`).join('')}</div></div>`).join('');
  setOnboardingStep(2);
}
function setOnboardingStep(n){ document.querySelectorAll('.onboarding-step').forEach(x=>x.classList.toggle('is-active',x.dataset.step==n)); }
function finishOnboarding(){
  const traits=[...document.querySelectorAll('#quizQuestions input:checked')].map(x=>x.value);
  const p=path();
  const trait=traits.sort()[0] || 'strategic';
  const options={
    rider:{names:['Vaelith','Tairon','Sorynth','Kaelira'],signets:['Thread-Sight','Truth-Sensing','Storm Wielding','Object Reading']},
    gryphon:{names:['Aestra','Korren','Vaelis','Rhyka'],signets:['Wind-Sight','Echo Reading','Distance Wielding','Amplification']},
    dark:{names:['Veyrix','Nhalor','Sythren','Maevrax'],signets:['Shadow Wielding','Hunger-Sight','Memory Fracture','Vein-Sense']},
    scribe:{names:['Orin','Quill','Morrow','Vesper'],signets:['Archive Recall','Contradiction Sense','Thread-Sight','Object Reading']},
    infantry:{names:['Bastion','Kestrel','Rook','Valor'],signets:['Battle Sense','Steadfastness','Distance Sight','Command Resonance']},
    healer:{names:['Aster','Eir','Solace','Morrow'],signets:['Mending','Pain-Sight','Life Sense','Memory Walking']}
  }[state.profile.path];
  const idx=Math.abs(traits.join('').split('').reduce((a,c)=>a+c.charCodeAt(0),0))%options.names.length;
  state.profile.creatureName=options.names[idx]; state.profile.creatureType=p.creatureType; state.profile.signet=options.signets[idx];
  state.profile.temperament={protective:'Fiercely protective and slow to trust',strategic:'Quiet, calculating, and almost impossible to surprise',rebellious:'Defiant, clever, and deeply unimpressed by authority',ambitious:'Powerful, hungry, and delighted by impossible odds',loyal:'Loyal beyond reason and terrifying when provoked',curious:'Observant, relentless, and drawn to hidden doors',independent:'Proud, selective, and unwilling to be commanded',intuitive:'Unnervingly perceptive and guided by instinct',empathetic:'Gentle with wounds and merciless with cruelty',risk:'Bold, volatile, and magnetized toward danger',brave:'Steady under pressure and impossible to intimidate',controlled:'Patient, disciplined, and devastatingly precise'}[trait] || 'Watchful, selective, and deeply intelligent';
  document.getElementById('assignmentResult').innerHTML=`<div class="assignment-card"><div class="assignment-glyph">${p.glyph}</div><p class="eyebrow">Assignment Confirmed</p><h3>${escapeHtml(state.profile.creatureName)}</h3><p style="color:var(--muted)">${escapeHtml(state.profile.temperament)}</p><div class="assignment-details"><div><small>Path</small><strong>${p.name}</strong></div><div><small>Companion</small><strong>${p.creatureType}</strong></div><div><small>Signet / Gift</small><strong>${state.profile.signet}</strong></div><div><small>Opening Rank</small><strong>${p.ranks[0]}</strong></div></div></div>`;
  saveState(); setOnboardingStep(3);
}

function switchView(view){
  activeView=view;
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('is-active',x.dataset.view===view));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('is-visible',x.id===view));
  document.getElementById('viewTitle').textContent=document.querySelector(`[data-view="${view}"] [data-copy]`)?.textContent || view;
  renderView(view);
}
function applyTheme(){
  document.getElementById('app').dataset.path=state.profile.path;
  document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=copy(el.dataset.copy));
  document.getElementById('topEyebrow').textContent=path().short;
  document.getElementById('profilePath').textContent=path().name;
  document.getElementById('profileName').textContent=state.profile.name;
  document.getElementById('profileInitial').textContent=(state.profile.name||'R')[0].toUpperCase();
  document.getElementById('sidebarRank').textContent=currentRank();
}
function currentRank(){ return path().ranks[Math.min(state.profile.rankIndex,path().ranks.length-1)]; }
function pointsToNext(){ const thresholds=[0,120,300,650,1100,1700]; return thresholds[Math.min(state.profile.rankIndex+1,thresholds.length-1)] || thresholds.at(-1); }
function recalcRank(){
  const max=path().ranks.length-1; const thresholds=path().ranks.length===4?[0,250,700,1500]:[0,120,300,650,1100,1700];
  let idx=0; thresholds.forEach((t,i)=>{ if(state.profile.points>=t) idx=i; });
  state.profile.rankIndex=Math.min(idx,max);
}
function award(points,msg){ state.profile.points+=points; recalcRank(); saveState(); applyTheme(); showToast(msg || `+${points} ${path().progressName}`); }
function renderAll(){ recalcRank(); applyTheme(); renderView(activeView); }
function renderView(view){ ({dashboard:renderDashboard,library:renderLibrary,session:renderSession,theories:renderTheories,wall:renderWall,profile:renderProfile}[view]||renderDashboard)(); }

function renderDashboard(){
  const books=state.books; const active=books.find(b=>b.status==='reading')||books[0]; const completed=books.filter(b=>b.status==='completed').length;
  const next=pointsToNext(); const pct=state.profile.rankIndex>=path().ranks.length-1?100:Math.min(100,Math.round(state.profile.points/next*100));
  document.getElementById('dashboard').innerHTML=`
    <div class="hero-panel"><div class="hero-grid"><div><p class="eyebrow">${path().short}</p><h3>${copy('heroTitle')}</h3><p>${copy('heroBody')}</p><div class="button-row"><button class="primary-button" data-action="add-book">${copy('addBook')}</button><button class="secondary-button" data-action="start-session">${copy('startSession')}</button></div></div><div class="hero-creature"><div class="creature-glyph">${path().glyph}</div><div class="creature-label"><span>${escapeHtml(state.profile.creatureName)}</span><span>${path().creatureType}</span></div></div></div></div>
    <div class="metric-grid">
      <div class="metric-card"><small>Active books</small><strong>${books.filter(b=>b.status==='reading').length}</strong></div>
      <div class="metric-card"><small>Completed</small><strong>${completed}</strong></div>
      <div class="metric-card"><small>Theories</small><strong>${state.theories.length}</strong></div>
      <div class="metric-card"><small>${path().progressName}</small><strong>${state.profile.points}</strong><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-header"><h3>${active?'Current Assignment':'No Active Assignment'}</h3><button class="small-button" data-action="add-book">＋</button></div>${active?bookCard(active,true):`<p>${copy('noBooks')}</p>`}</div>
      <div class="panel"><div class="panel-header"><h3>Recent Intelligence</h3><button class="small-button" data-action="add-theory">＋</button></div>${state.theories.slice(-3).reverse().map(theoryCard).join('')||`<p>${copy('noTheories')}</p>`}</div>
    </div>`;
  bindRenderedActions(document.getElementById('dashboard'));
}

function renderLibrary(){
  const el=document.getElementById('library');
  el.innerHTML=`<div class="toolbar"><input class="search-input" id="bookSearch" placeholder="Search titles, authors, or series"><div class="toolbar-group"><button class="primary-button" data-action="add-book">${copy('addBook')}</button></div></div><div class="panel" id="bookList"></div>`;
  const list=el.querySelector('#bookList');
  const draw=(q='')=>{ const filtered=state.books.filter(b=>`${b.title} ${b.author} ${b.series}`.toLowerCase().includes(q.toLowerCase())); list.innerHTML=filtered.length?filtered.map(b=>bookCard(b,false)).join(''):`<div class="empty-state"><div class="empty-icon">▤</div><h3>${copy('noBooks')}</h3><p>Add your first book to begin tracking progress, theories, evidence, and emotional damage.</p><button class="primary-button" data-action="add-book">${copy('addBook')}</button></div>`; bindRenderedActions(list); };
  draw(); el.querySelector('#bookSearch').addEventListener('input',e=>draw(e.target.value)); bindRenderedActions(el);
}
function bookCard(book,compact){
  return `<div class="book-card" data-book-id="${book.id}"><div class="book-cover">${escapeHtml(book.title)}</div><div class="book-info"><h4>${escapeHtml(book.title)}</h4><p>${escapeHtml(book.author||'Unknown author')}${book.series?` · ${escapeHtml(book.series)}`:''}</p><span class="status-pill">${book.status==='reading'?'Currently reading':book.status==='completed'?'Completed':book.status}</span><div class="progress-track"><div class="progress-fill" style="width:${book.progress||0}%"></div></div></div><div class="book-actions"><button class="small-button" data-action="progress-book" data-id="${book.id}">${book.progress||0}%</button>${book.status!=='completed'?`<button class="small-button" data-action="complete-book" data-id="${book.id}">Complete</button>`:''}${compact?'':`<button class="small-button" data-action="delete-book" data-id="${book.id}">Delete</button>`}</div></div>`;
}

function renderSession(){
  const active=state.books.find(b=>b.status==='reading'); const el=document.getElementById('session');
  if(!active){ el.innerHTML=`<div class="empty-state"><div class="empty-icon">◉</div><h3>No active reading assignment</h3><p>Add a book and mark it as currently reading before beginning a focused session.</p><button class="primary-button" data-action="add-book">${copy('addBook')}</button></div>`; bindRenderedActions(el); return; }
  const running=!!state.currentSession;
  el.innerHTML=`<div class="panel session-card"><p class="eyebrow">${path().short}</p><h3 class="session-book">${escapeHtml(active.title)}</h3><div class="session-meta"><span>Progress ${active.progress||0}%</span><span>Chapter ${escapeHtml(active.chapter||'Unknown')}</span></div><div class="timer" id="timerDisplay">${formatTime(running?sessionSeconds:0)}</div><div class="button-row" style="justify-content:center"><button class="primary-button" id="sessionToggle">${running?'End Session':copy('startSession')}</button><button class="secondary-button" data-action="progress-book" data-id="${active.id}">Update Progress</button></div><div class="quick-grid">${['Theory','Suspicious','Important clue','Character update','Quote','Prediction'].map(x=>`<button class="quick-choice" data-quick="${x}">${x}</button>`).join('')}</div></div>`;
  el.querySelector('#sessionToggle').addEventListener('click',()=>running?endSession(active):startSession(active));
  el.querySelectorAll('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>openQuickMark(btn.dataset.quick,active.id)));
  bindRenderedActions(el);
  if(running) startTimerLoop();
}
function formatTime(sec){ const h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor(sec%3600/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0'); return `${h}:${m}:${s}`; }
function startSession(book){ state.currentSession={id:uid(),bookId:book.id,startedAt:Date.now()}; sessionSeconds=0; saveState(); award(5,'Deployment begun.'); renderSession(); }
function startTimerLoop(){ clearInterval(sessionTimer); sessionTimer=setInterval(()=>{ if(!state.currentSession) return; sessionSeconds=Math.floor((Date.now()-state.currentSession.startedAt)/1000); const d=document.getElementById('timerDisplay'); if(d)d.textContent=formatTime(sessionSeconds); },1000); }
function endSession(book){ clearInterval(sessionTimer); const duration=Math.floor((Date.now()-state.currentSession.startedAt)/1000); state.sessions.push({...state.currentSession,duration,endedAt:Date.now()}); state.currentSession=null; sessionSeconds=0; saveState(); award(Math.max(10,Math.round(duration/300)),`Session recorded. +${Math.max(10,Math.round(duration/300))} ${path().progressName}`); renderSession(); }

function renderTheories(){
  const el=document.getElementById('theories');
  el.innerHTML=`<div class="toolbar"><div><p class="eyebrow">Spoiler-safe personal intelligence</p><h3 style="font:600 26px var(--heading-font);margin:6px 0">${copy('navTheories')}</h3></div><button class="primary-button" data-action="add-theory">${copy('addTheory')}</button></div><div id="theoryList">${state.theories.length?state.theories.slice().reverse().map(theoryCard).join(''):`<div class="empty-state"><div class="empty-icon">⌁</div><h3>${copy('noTheories')}</h3><p>Capture a suspicion in seconds, then attach confidence, evidence, characters, and spoiler boundaries later.</p><button class="primary-button" data-action="add-theory">${copy('addTheory')}</button></div>`}</div>`;
  bindRenderedActions(el);
}
function theoryCard(t){ const book=state.books.find(b=>b.id===t.bookId); return `<article class="theory-card" data-theory-id="${t.id}"><h4>${escapeHtml(t.statement)}</h4><p>${escapeHtml(t.notes||'')}</p><div class="confidence"><small>Confidence ${t.confidence||50}%</small><div class="confidence-bar"><span style="width:${t.confidence||50}%"></span></div></div><div class="theory-meta"><span class="tag">${escapeHtml(t.status||'Under investigation')}</span>${book?`<span class="tag">${escapeHtml(book.title)}</span>`:''}<button class="small-button" data-action="wall-theory" data-id="${t.id}">Pin to wall</button><button class="small-button" data-action="delete-theory" data-id="${t.id}">Delete</button></div></article>`; }

function renderWall(){
  const el=document.getElementById('wall');
  el.innerHTML=`<div class="wall-toolbar"><button class="primary-button" data-action="add-wall-card">Add Card</button><button class="secondary-button" data-action="auto-wall">Pin Latest Theories</button><button class="secondary-button" data-action="clear-wall">Clear Wall</button></div><div class="wall-board" id="wallBoard">${state.wallCards.length?'':`<div class="wall-empty"><div><div style="font-size:48px;color:var(--accent)">✣</div><h3>No evidence has been pinned yet.</h3><p>Pin theories, characters, clues, questions, and evidence. Drag every card into place.</p></div></div>`}${state.wallCards.map(c=>`<div class="wall-card" data-card-id="${c.id}" data-type="${c.type}" style="left:${c.x}px;top:${c.y}px;--rot:${c.rot||0}deg"><span class="wall-pin"></span><h4>${escapeHtml(c.title)}</h4><p>${escapeHtml(c.text||'')}</p></div>`).join('')}</div>`;
  bindRenderedActions(el); enableWallDragging();
}
function enableWallDragging(){
  const board=document.getElementById('wallBoard'); if(!board)return;
  board.querySelectorAll('.wall-card').forEach(card=>{
    let sx,sy,ox,oy,drag=false;
    const move=e=>{ if(!drag)return; const p=e.touches?.[0]||e; const rect=board.getBoundingClientRect(); const x=Math.max(0,Math.min(rect.width-card.offsetWidth,ox+p.clientX-sx)); const y=Math.max(0,Math.min(rect.height-card.offsetHeight,oy+p.clientY-sy)); card.style.left=`${x}px`; card.style.top=`${y}px`; const data=state.wallCards.find(c=>c.id===card.dataset.cardId); data.x=x;data.y=y; };
    const up=()=>{ if(drag){drag=false;saveState();} document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up); };
    const down=e=>{ const p=e.touches?.[0]||e; drag=true;sx=p.clientX;sy=p.clientY;ox=parseFloat(card.style.left)||0;oy=parseFloat(card.style.top)||0;document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',up); };
    card.addEventListener('mousedown',down); card.addEventListener('touchstart',down,{passive:true});
  });
}

function renderProfile(){
  const p=path(); const next=pointsToNext(); const pct=state.profile.rankIndex>=p.ranks.length-1?100:Math.round(state.profile.points/next*100);
  document.getElementById('profile').innerHTML=`<div class="profile-layout"><div class="panel identity-card"><div class="identity-sigil">${p.glyph}</div><p class="eyebrow">${p.short}</p><h3>${escapeHtml(state.profile.name)}</h3><p>${escapeHtml(state.profile.creatureName)} · ${p.creatureType}</p><div class="tag">${escapeHtml(state.profile.signet)}</div><div class="progress-track" style="margin-top:18px"><div class="progress-fill" style="width:${pct}%"></div></div><p>${state.profile.points} ${p.progressName}</p><button class="secondary-button" data-action="change-path">Change Path Theme</button></div><div class="panel"><div class="panel-header"><h3>Rank Progression</h3><span class="tag">${currentRank()}</span></div><div class="rank-list">${p.ranks.map((r,i)=>`<div class="rank-row ${i<=state.profile.rankIndex?'is-earned':''}"><span class="rank-dot">${i<=state.profile.rankIndex?'✓':i+1}</span><div><strong>${r}</strong><small style="display:block;color:var(--muted)">${i===state.profile.rankIndex?'Current rank':i<state.profile.rankIndex?'Earned':'Not yet earned'}</small></div></div>`).join('')}</div></div></div>`;
  bindRenderedActions(document.getElementById('profile'));
}

function bindRenderedActions(root){ root.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>handleAction(btn.dataset.action,btn.dataset.id))); }
function handleAction(action,id){
  if(action==='add-book') return openBookForm();
  if(action==='add-theory') return openTheoryForm();
  if(action==='start-session') return switchView('session');
  if(action==='progress-book') return openProgressForm(id);
  if(action==='complete-book') return completeBook(id);
  if(action==='delete-book'){ state.books=state.books.filter(b=>b.id!==id); saveState(); renderAll(); }
  if(action==='delete-theory'){ state.theories=state.theories.filter(t=>t.id!==id); saveState(); renderAll(); }
  if(action==='wall-theory') return pinTheory(id);
  if(action==='add-wall-card') return openWallCardForm();
  if(action==='auto-wall'){ state.theories.slice(-5).forEach((t,i)=>{ if(!state.wallCards.some(c=>c.sourceId===t.id)) state.wallCards.push({id:uid(),sourceId:t.id,type:'theory',title:'Theory',text:t.statement,x:30+i*45,y:30+i*55,rot:(i%2?2:-2)}); }); saveState(); renderWall(); }
  if(action==='clear-wall'){ if(confirm('Clear every card from the wall?')){state.wallCards=[];saveState();renderWall();} }
  if(action==='change-path') return openPathChange();
}

function openBookForm(){
  document.getElementById('formModalContent').innerHTML=`<p class="eyebrow">${path().short}</p><h2 id="formModalTitle" style="font:600 28px var(--heading-font)">${copy('addBook')}</h2><div class="form-grid"><label class="form-group full"><span class="field-label">Title</span><input class="text-input" id="bookTitle"></label><label class="form-group"><span class="field-label">Author</span><input class="text-input" id="bookAuthor"></label><label class="form-group"><span class="field-label">Series</span><input class="text-input" id="bookSeries"></label><label class="form-group"><span class="field-label">Status</span><select class="select-input" id="bookStatus"><option value="reading">Currently reading</option><option value="want">Want to read</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="dnf">DNF</option></select></label><label class="form-group"><span class="field-label">Starting progress</span><input type="number" min="0" max="100" value="0" class="number-input" id="bookProgress"></label><label class="form-group"><span class="field-label">Current chapter</span><input class="text-input" id="bookChapter"></label><div class="form-group full"><button class="primary-button" id="saveBook">${copy('addBook')}</button></div></div>`;
  openModal('formModal');
  document.getElementById('saveBook').addEventListener('click',()=>{ const title=document.getElementById('bookTitle').value.trim(); if(!title)return showToast('A title is required.'); state.books.push({id:uid(),title,author:document.getElementById('bookAuthor').value.trim(),series:document.getElementById('bookSeries').value.trim(),status:document.getElementById('bookStatus').value,progress:Number(document.getElementById('bookProgress').value)||0,chapter:document.getElementById('bookChapter').value.trim()}); saveState(); closeModal('formModal'); award(15,copy('success')); renderAll(); });
}
function openProgressForm(id){ const b=state.books.find(x=>x.id===id); if(!b)return; document.getElementById('formModalContent').innerHTML=`<p class="eyebrow">${escapeHtml(b.title)}</p><h2 id="formModalTitle" style="font:600 28px var(--heading-font)">Update Progress</h2><div class="form-grid"><label class="form-group"><span class="field-label">Progress percent</span><input type="number" min="0" max="100" class="number-input" id="progressValue" value="${b.progress||0}"></label><label class="form-group"><span class="field-label">Current chapter</span><input class="text-input" id="chapterValue" value="${escapeHtml(b.chapter||'')}"></label><div class="form-group full"><button class="primary-button" id="saveProgress">Save Progress</button></div></div>`; openModal('formModal'); document.getElementById('saveProgress').addEventListener('click',()=>{ const old=b.progress||0; b.progress=Math.max(0,Math.min(100,Number(document.getElementById('progressValue').value)||0)); b.chapter=document.getElementById('chapterValue').value.trim(); if(b.progress>0&&b.status==='want')b.status='reading'; saveState(); closeModal('formModal'); award(Math.max(2,Math.round((b.progress-old)/2)),'Progress secured.'); renderAll(); }); }
function completeBook(id){ const b=state.books.find(x=>x.id===id); if(!b)return; b.status='completed';b.progress=100; saveState(); award(100,copy('completeBook')); renderAll(); }
function openTheoryForm(prefill='',bookId=''){
  document.getElementById('formModalContent').innerHTML=`<p class="eyebrow">Spoiler-Safe Intelligence</p><h2 id="formModalTitle" style="font:600 28px var(--heading-font)">${copy('addTheory')}</h2><div class="form-grid"><label class="form-group full"><span class="field-label">Theory statement</span><textarea class="text-area" id="theoryStatement">${escapeHtml(prefill)}</textarea></label><label class="form-group"><span class="field-label">Book</span><select class="select-input" id="theoryBook"><option value="">Unassigned</option>${state.books.map(b=>`<option value="${b.id}" ${b.id===bookId?'selected':''}>${escapeHtml(b.title)}</option>`).join('')}</select></label><label class="form-group"><span class="field-label">Status</span><select class="select-input" id="theoryStatus"><option>Fleeting suspicion</option><option selected>Under investigation</option><option>Strong possibility</option><option>Nearly certain</option><option>Confirmed</option><option>Partially confirmed</option><option>Disproven</option><option>Technically correct, catastrophically misunderstood</option></select></label><label class="form-group full"><span class="field-label">Notes or evidence</span><textarea class="text-area" id="theoryNotes"></textarea></label><label class="form-group full"><span class="field-label">Confidence: <span id="confidenceLabel">50%</span></span><input type="range" id="theoryConfidence" min="0" max="100" value="50"></label><div class="form-group full"><button class="primary-button" id="saveTheory">${copy('saveTheory')}</button></div></div>`;
  openModal('formModal'); const range=document.getElementById('theoryConfidence'); range.addEventListener('input',()=>document.getElementById('confidenceLabel').textContent=`${range.value}%`);
  document.getElementById('saveTheory').addEventListener('click',()=>{ const statement=document.getElementById('theoryStatement').value.trim(); if(!statement)return showToast('Write the theory first.'); state.theories.push({id:uid(),statement,bookId:document.getElementById('theoryBook').value,status:document.getElementById('theoryStatus').value,notes:document.getElementById('theoryNotes').value.trim(),confidence:Number(range.value),createdAt:Date.now()}); saveState(); closeModal('formModal'); award(25,copy('success')); renderAll(); });
}
function openQuickMark(type='Theory',bookId=''){ if(type==='Theory')return openTheoryForm('',bookId); document.getElementById('formModalContent').innerHTML=`<p class="eyebrow">Quick Mark · ${escapeHtml(type)}</p><h2 id="formModalTitle" style="font:600 28px var(--heading-font)">Record it before it disappears</h2><label class="form-group"><span class="field-label">What did you notice?</span><textarea class="text-area" id="quickText" autofocus></textarea></label><button class="primary-button full-width" id="saveQuick" style="margin-top:14px">Save Quick Mark</button>`; openModal('formModal'); document.getElementById('saveQuick').addEventListener('click',()=>{ const text=document.getElementById('quickText').value.trim(); if(!text)return; state.wallCards.push({id:uid(),type:type.toLowerCase().includes('character')?'character':type.toLowerCase().includes('question')?'question':'evidence',title:type,text,x:30+Math.random()*180,y:30+Math.random()*220,rot:(Math.random()*4-2)}); saveState(); closeModal('formModal'); award(8,'Quick mark secured.'); }); }
function openWallCardForm(){ document.getElementById('formModalContent').innerHTML=`<p class="eyebrow">Conspiracy Wall</p><h2 id="formModalTitle" style="font:600 28px var(--heading-font)">Pin New Card</h2><div class="form-grid"><label class="form-group"><span class="field-label">Card type</span><select class="select-input" id="wallType"><option value="theory">Theory</option><option value="character">Character</option><option value="evidence">Evidence</option><option value="question">Question</option></select></label><label class="form-group"><span class="field-label">Title</span><input class="text-input" id="wallTitle"></label><label class="form-group full"><span class="field-label">Note</span><textarea class="text-area" id="wallText"></textarea></label><div class="form-group full"><button class="primary-button" id="saveWallCard">Pin to Wall</button></div></div>`; openModal('formModal'); document.getElementById('saveWallCard').addEventListener('click',()=>{ const title=document.getElementById('wallTitle').value.trim(); if(!title)return; state.wallCards.push({id:uid(),type:document.getElementById('wallType').value,title,text:document.getElementById('wallText').value.trim(),x:30+Math.random()*250,y:30+Math.random()*250,rot:Math.random()*4-2}); saveState(); closeModal('formModal'); renderWall(); }); }
function pinTheory(id){ const t=state.theories.find(x=>x.id===id); if(!t)return; if(!state.wallCards.some(c=>c.sourceId===id))state.wallCards.push({id:uid(),sourceId:id,type:'theory',title:'Theory',text:t.statement,x:30+Math.random()*240,y:30+Math.random()*260,rot:Math.random()*4-2}); saveState(); showToast('Pinned to the wall.'); }
function openPathChange(){ document.getElementById('formModalContent').innerHTML=`<p class="eyebrow">Theme Assignment</p><h2 id="formModalTitle" style="font:600 28px var(--heading-font)">Change Path</h2><p style="color:var(--muted)">This changes the interface, language, layout, companion type, and visible rank ladder. Your books and theories remain intact.</p><div class="path-grid">${Object.entries(PATHS).map(([k,p])=>`<button class="path-choice ${state.profile.path===k?'is-selected':''}" data-new-path="${k}"><span style="font-size:30px">${p.glyph}</span><strong>${p.name}</strong><small>${p.description}</small></button>`).join('')}</div>`; openModal('formModal'); document.querySelectorAll('[data-new-path]').forEach(btn=>btn.addEventListener('click',()=>{ state.profile.path=btn.dataset.newPath; state.profile.creatureType=path().creatureType; recalcRank(); saveState(); closeModal('formModal'); renderAll(); })); }

init();
