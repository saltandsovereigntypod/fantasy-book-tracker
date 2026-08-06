import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import Workspace from './App';
import { BookProfileDrawer } from './BookProfileDrawer';
import { CardRenderer } from './CardRenderer';
import { ConspiracyWall } from './ConspiracyWall';
import { InvestigationModule } from './InvestigationModule';
import { freshArchive, loadCloudArchive, saveCloudArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { defaultBook, defaultDesign } from './defaults';
import { saveWorkspaceDraft, WORKSPACE_DRAFT_EVENT, type WorkspaceDraft } from './library';
import { getAuthSnapshot, signIn, signOut, signUp, supabase } from './supabase';
import { PATH_IDS, PATHS, pathFor, rankIndexForPoints, type PathId } from './paths';
import {
  PRYTHIAN_COURTS,
  PRYTHIAN_RANKS,
  PRYTHIAN_THRESHOLDS,
  freshUniverseProfiles,
  prythianRankIndex,
  type PrythianCourtId,
  type UniverseProfiles,
} from './universes';
import type { CardSize, ReadingStatus } from './domain';
import './full-app.css';
import './full-app-enhancements.css';
import './core-path.css';
import './prythian-core.css';

type AppView = 'dashboard' | 'library' | 'editor' | 'theories' | 'wall' | 'mindmap' | 'profile';
type AuthMode = 'signin' | 'signup';
type LibraryFilter = 'active' | ReadingStatus | 'favorites' | 'archived';
type LibrarySort = 'updated' | 'title' | 'author' | 'progress' | 'rating';
type AppArchive = V2ArchiveState & { universes?: UniverseProfiles };
type ExtendedProfile = V2ArchiveState['profile'] & {
  abilityId?: string;
  abilityName?: string;
  abilityDescription?: string;
  creature?: { kind: 'dragon' | 'gryphon' | 'wyvern'; name: string; color: string; tail?: string };
};

const VIEW_KEY = 'empyrean-v2-current-view';
const LIBRARY_QUERY_KEY = 'empyrean-v2-library-query';
const LIBRARY_SIZE_KEY = 'empyrean-v2-library-size';
const LIBRARY_FILTER_KEY = 'empyrean-v2-library-filter';
const LIBRARY_SORT_KEY = 'empyrean-v2-library-sort';

function clone<T>(value: T): T { return structuredClone(value); }
function readStorage(key: string, fallback: string): string { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function readView(): AppView { const value = readStorage(VIEW_KEY, 'dashboard'); return ['dashboard','library','editor','theories','wall','mindmap','profile'].includes(value) ? value as AppView : 'dashboard'; }
function readCardSize(): CardSize { const value = readStorage(LIBRARY_SIZE_KEY, 'medium'); return value === 'small' || value === 'large' ? value : 'medium'; }
function readLibraryFilter(): LibraryFilter { const value = readStorage(LIBRARY_FILTER_KEY, 'active'); return ['active','want','reading','paused','completed','dnf','favorites','archived'].includes(value) ? value as LibraryFilter : 'active'; }
function readLibrarySort(): LibrarySort { const value = readStorage(LIBRARY_SORT_KEY, 'updated'); return ['updated','title','author','progress','rating'].includes(value) ? value as LibrarySort : 'updated'; }
function universeProfiles(archive: AppArchive): UniverseProfiles {
  if (archive.universes?.empyrean && archive.universes?.prythian) return archive.universes;
  return freshUniverseProfiles(String(archive.profile.path || 'rider'));
}

export default function CoreFullApp() {
  const [user, setUser] = useState<User | null>(null);
  const [archive, setArchive] = useState<AppArchive>(() => freshArchive());
  const [view, setView] = useState<AppView>(readView);
  const [editorKey, setEditorKey] = useState(0);
  const [profileBookId, setProfileBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [error, setError] = useState('');
  const archiveRef = useRef<AppArchive>(archive);
  const cloudTimerRef = useRef<number | null>(null);

  useEffect(() => { archiveRef.current = archive; }, [archive]);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);
  useEffect(() => {
    let active = true;
    getAuthSnapshot().then(async ({ user: currentUser }) => {
      if (!active) return;
      setUser(currentUser);
      if (currentUser) setArchive(await loadCloudArchive(currentUser) as AppArchive);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'The archive could not be opened.')).finally(() => { if (active) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) setArchive(freshArchive());
      else loadCloudArchive(nextUser).then((next) => setArchive(next as AppArchive)).catch((reason) => setError(reason.message));
    });
    return () => { active = false; data.subscription.unsubscribe(); if (cloudTimerRef.current) window.clearTimeout(cloudTimerRef.current); };
  }, []);

  const persistArchive = useCallback(async (next: AppArchive) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    archiveRef.current = stamped;
    setArchive(stamped);
    if (!user) return;
    setSyncState('saving');
    try { await saveCloudArchive(user, stamped); setSyncState('saved'); window.setTimeout(() => setSyncState('idle'), 1400); }
    catch (reason) { setSyncState('error'); setError(reason instanceof Error ? reason.message : 'Cloud save failed.'); }
  }, [user]);

  useEffect(() => {
    function handleWorkspaceDraft(event: Event) {
      const draft = (event as CustomEvent<WorkspaceDraft>).detail;
      if (!draft?.book?.id || !draft.design) return;
      const current = archiveRef.current;
      const existing = current.books.find((book) => book.id === draft.book.id);
      const now = new Date().toISOString();
      const nextBook: V2BookRecord = { ...draft.book, design: clone(draft.design), createdAt: existing?.createdAt || now, updatedAt: now, favorite: existing?.favorite || false, archived: existing?.archived || false };
      const next = { ...current, books: existing ? current.books.map((book) => book.id === nextBook.id ? nextBook : book) : [...current.books, nextBook], updatedAt: now };
      archiveRef.current = next; setArchive(next); setSyncState('saving');
      if (cloudTimerRef.current) window.clearTimeout(cloudTimerRef.current);
      cloudTimerRef.current = window.setTimeout(() => void persistArchive(archiveRef.current), 900);
    }
    window.addEventListener(WORKSPACE_DRAFT_EVENT, handleWorkspaceDraft);
    return () => window.removeEventListener(WORKSPACE_DRAFT_EVENT, handleWorkspaceDraft);
  }, [persistArchive]);

  async function openNewBook() {
    const book = { ...clone(defaultBook), id: crypto.randomUUID(), title: 'Untitled Book', author: '', series: '', coverUrl: '', progress: 0, rating: 0, spice: 0, impact: 0, reaction: '' };
    await saveWorkspaceDraft(book, clone(defaultDesign)); setEditorKey((key) => key + 1); setProfileBookId(null); setView('editor');
  }
  async function openBook(bookId: string) {
    const selected = archiveRef.current.books.find((book) => book.id === bookId); if (!selected) return;
    const { design, createdAt: _createdAt, updatedAt: _updatedAt, favorite: _favorite, archived: _archived, ...book } = selected;
    await saveWorkspaceDraft(clone(book), clone(design)); setEditorKey((key) => key + 1); setProfileBookId(null); setView('editor');
  }
  async function saveBook(nextBook: V2BookRecord) { await persistArchive({ ...archiveRef.current, books: archiveRef.current.books.map((book) => book.id === nextBook.id ? { ...nextBook, updatedAt: new Date().toISOString() } : book) }); }
  async function saveBooks(nextBooks: V2BookRecord[]) { const updates = new Map(nextBooks.map((book) => [book.id, { ...book, updatedAt: new Date().toISOString() }])); await persistArchive({ ...archiveRef.current, books: archiveRef.current.books.map((book) => updates.get(book.id) ?? book) }); }
  async function deleteBook(bookId: string) { const selected = archiveRef.current.books.find((book) => book.id === bookId); if (!selected || !window.confirm(`Permanently delete “${selected.title}”? This cannot be undone.`)) return; setProfileBookId(null); await persistArchive({ ...archiveRef.current, books: archiveRef.current.books.filter((book) => book.id !== bookId) }); }
  async function deleteBooks(ids: string[]) { if (!ids.length || !window.confirm(`Permanently delete ${ids.length} selected ${ids.length === 1 ? 'book' : 'books'}? This cannot be undone.`)) return; setProfileBookId(null); await persistArchive({ ...archiveRef.current, books: archiveRef.current.books.filter((book) => !ids.includes(bookId)) }); }

  if (loading) return <div className="v2-boot-screen"><span>✦</span><strong>Restoring your archive…</strong></div>;
  if (!user) return <AuthScreen error={error} onError={setError} />;

  const profile = archive.profile as ExtendedProfile;
  const profiles = universeProfiles(archive);
  const isPrythian = profiles.activeUniverse === 'prythian';
  const path = pathFor(profile.path);
  const courtId = (profiles.prythian.court || 'night') as PrythianCourtId;
  const court = PRYTHIAN_COURTS[courtId];
  const accountPoints = Number(profile.points) || 0;
  const pathRankIndex = rankIndexForPoints(path.id, accountPoints);
  const courtRankIndex = prythianRankIndex(accountPoints);
  const rank = isPrythian ? PRYTHIAN_RANKS[courtRankIndex] : path.ranks[pathRankIndex];
  const displayName = profile.displayName || user.email?.split('@')[0] || 'Reader';
  const profileBook = archive.books.find((book) => book.id === profileBookId) ?? null;
  const navItems = isPrythian ? [
    { id: 'dashboard' as const, label: 'Court Hall', icon: '⌂' },
    { id: 'library' as const, label: 'Chronicles', icon: '▤' },
    { id: 'theories' as const, label: 'Whispers & Prophecies', icon: '⌁' },
    { id: 'wall' as const, label: 'Court Intrigue', icon: '✣' },
    { id: 'mindmap' as const, label: 'Mind Map', icon: '⌘' },
    { id: 'profile' as const, label: 'Court Record', icon: '♜' },
  ] : [
    { id: 'dashboard' as const, label: path.copy.navDashboard, icon: '⌂' },
    { id: 'library' as const, label: path.copy.navLibrary, icon: '▤' },
    { id: 'theories' as const, label: path.copy.navTheories, icon: '⌁' },
    { id: 'wall' as const, label: path.copy.navWall, icon: '✣' },
    { id: 'mindmap' as const, label: 'Mind Map', icon: '⌘' },
    { id: 'profile' as const, label: path.copy.navProfile, icon: '♜' },
  ];
  const viewLabel = view === 'editor' ? 'Book Workspace' : navItems.find((item) => item.id === view)?.label;
  const activeTheme = isPrythian ? court.theme : path.theme;
  const themeStyle = {
    '--v2-bg': activeTheme.background, '--v2-panel': activeTheme.panel, '--v2-panel-raised': activeTheme.panelAlt,
    '--v2-border': activeTheme.border, '--v2-border-strong': activeTheme.accent, '--v2-text': activeTheme.text,
    '--v2-muted': activeTheme.muted, '--v2-accent': activeTheme.accent, '--v2-accent-bright': activeTheme.accent,
    '--path-background': activeTheme.background, '--path-panel': activeTheme.panel, '--path-panel-alt': activeTheme.panelAlt,
    '--path-surface': activeTheme.surface, '--path-text': activeTheme.text, '--path-muted': activeTheme.muted,
    '--path-accent': activeTheme.accent, '--path-accent-soft': activeTheme.accentSoft, '--path-border': activeTheme.border,
    '--path-paper': activeTheme.paper,
  } as CSSProperties;

  useEffect(() => {
    document.documentElement.dataset.universe = isPrythian ? 'prythian' : 'empyrean';
    document.body.dataset.universe = isPrythian ? 'prythian' : 'empyrean';
    if (isPrythian) {
      document.documentElement.dataset.court = courtId;
      document.body.dataset.court = courtId;
    } else {
      delete document.documentElement.dataset.court;
      delete document.body.dataset.court;
    }
  }, [isPrythian, courtId]);

  return <div className="v2-full-app core-path-app" data-path={isPrythian ? undefined : path.id} data-universe={isPrythian ? 'prythian' : 'empyrean'} data-court={isPrythian ? courtId : undefined} style={themeStyle}>
    <aside className="v2-app-sidebar"><div className="v2-brand"><span>{isPrythian ? court.glyph : path.glyph}</span><div><small>{isPrythian ? 'The Prythian Archive' : 'The Empyrean Tracker'}</small><strong>{isPrythian ? court.name : path.short}</strong></div></div><nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? 'is-active' : ''} onClick={() => { setProfileBookId(null); setView(item.id); }}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="v2-sidebar-footer"><small>{rank}</small><strong>{displayName}</strong><button onClick={() => signOut().catch((reason) => setError(reason.message))}>Sign Out</button></div></aside>
    <main className="v2-app-main"><header className="v2-topbar"><div>{view === 'editor' && <button className="v2-editor-back" onClick={() => setView('library')}>← Back to {isPrythian ? 'Chronicles' : path.copy.navLibrary}</button>}<p>{viewLabel}</p><h1>{view === 'editor' ? 'Book Workspace' : `Welcome back, ${displayName}`}</h1></div><span className={`v2-sync-state is-${syncState}`}>{syncState === 'saving' ? 'Saving…' : syncState === 'saved' ? 'Cloud saved' : syncState === 'error' ? 'Save failed' : 'Cloud ready'}</span></header>
      {error && <div className="v2-app-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      <section className={`v2-view v2-view--${view}`}>
        {view === 'dashboard' && <Dashboard archive={archive} pathId={path.id} isPrythian={isPrythian} courtId={courtId} onNavigate={setView} onNewBook={openNewBook} onProfile={setProfileBookId} />}
        {view === 'library' && <Library archive={archive} title={isPrythian ? 'Chronicles' : path.copy.navLibrary} addLabel={isPrythian ? 'Add New Chronicle' : path.copy.addBook} onNewBook={openNewBook} onEditBook={openBook} onProfile={setProfileBookId} onDeleteBooks={deleteBooks} onSaveBooks={saveBooks} />}
        {view === 'editor' && <Workspace key={editorKey} />}
        {view === 'theories' && <InvestigationModule archive={archive} onSave={persistArchive} />}
        {view === 'wall' && <ConspiracyWall archive={archive} onSave={persistArchive} />}
        {view === 'mindmap' && <div className="core-mindmap-host"><div className="v2-coming-soon"><span>✦</span><h2>Mind Map</h2><p>The connected workspace is loading.</p></div></div>}
        {view === 'profile' && <Profile archive={archive} profiles={profiles} onSave={persistArchive} />}
      </section>
    </main>
    {profileBook && <BookProfileDrawer book={profileBook} archive={archive} onClose={() => setProfileBookId(null)} onEdit={() => openBook(profileBook.id)} onDelete={() => deleteBook(profileBook.id)} onSave={saveBook} />}
  </div>;
}

function AuthScreen({ error, onError }: { error: string; onError: (value: string) => void }) {
  const [mode, setMode] = useState<AuthMode>('signin'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState(''); const [inviteCode, setInviteCode] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); onError(''); setBusy(true); try { if (mode === 'signin') await signIn(email.trim(), password); else await signUp(email.trim(), password, displayName.trim(), inviteCode.trim()); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Authentication failed.'); } finally { setBusy(false); } }
  return <main className="v2-auth-screen"><section className="v2-auth-card"><div className="v2-auth-sigil">✦</div><p>The Empyrean Tracker</p><h1>{mode === 'signin' ? 'Enter the Archive' : 'Create Your Archive'}</h1><div className="v2-auth-tabs"><button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>Sign In</button><button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>Create Account</button></div><form onSubmit={submit}>{mode === 'signup' && <><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label><label>Invitation code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required /></label></>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="v2-auth-error">{error}</p>}<button className="v2-auth-submit" disabled={busy}>{busy ? 'Opening…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button></form></section></main>;
}

function Dashboard({ archive, pathId, isPrythian, courtId, onNavigate, onNewBook, onProfile }: { archive: AppArchive; pathId: PathId; isPrythian: boolean; courtId: PrythianCourtId; onNavigate: (view: AppView) => void; onNewBook: () => Promise<void>; onProfile: (id: string) => void }) {
  const path = PATHS[pathId]; const court = PRYTHIAN_COURTS[courtId]; const points = Number(archive.profile.points) || 0; const rank = isPrythian ? PRYTHIAN_RANKS[prythianRankIndex(points)] : path.ranks[rankIndexForPoints(pathId, points)];
  const activeBooks = archive.books.filter((book) => book.status === 'reading' && !book.archived); const completed = archive.books.filter((book) => book.status === 'completed' && !book.archived).length;
  const heroTitle = isPrythian ? `The ${court.name} keeps every story worth protecting.` : path.copy.heroTitle;
  const heroBody = isPrythian ? 'Record each chronicle, follow every whisper, and preserve the truths your court cannot afford to lose.' : path.copy.heroBody;
  return <div className="v2-dashboard"><section className="core-assignment-compact"><div><span>{isPrythian ? 'Your court' : 'Your assignment'}</span><strong>{isPrythian ? `${court.glyph} ${court.name}` : `${path.glyph} ${path.name}`}</strong></div><div><span>{isPrythian ? 'Court standing' : path.copy.currentRank}</span><strong>{rank}</strong><small>{points} points</small></div></section><section className="v2-hero"><div><p>{isPrythian ? court.name : path.short}</p><h2>{heroTitle}</h2><span>{heroBody}</span><div><button onClick={() => onNewBook()}>{isPrythian ? 'Add New Chronicle' : path.copy.addBook}</button><button onClick={() => onNavigate('library')}>Open {isPrythian ? 'Chronicles' : path.copy.navLibrary}</button></div></div><strong>{isPrythian ? court.glyph : path.glyph}</strong></section><div className="v2-metric-grid"><article><span>Total Books</span><strong>{archive.books.filter((book) => !book.archived).length}</strong></article><article><span>Currently Reading</span><strong>{activeBooks.length}</strong></article><article><span>Completed</span><strong>{completed}</strong></article><article><span>Open Theories</span><strong>{archive.theories.filter((theory) => theory.status === 'open').length}</strong></article></div><section className="v2-dashboard-panel"><header><h3>Active Reading</h3><button onClick={() => onNavigate('library')}>View all</button></header>{activeBooks.length ? <div className="v2-mini-books">{activeBooks.slice(0,3).map((book) => <button type="button" key={book.id} onClick={() => onProfile(book.id)}><strong>{book.title}</strong><span>{book.author || 'Unknown author'}</span><small>{book.progress}% complete</small></button>)}</div> : <p>No active books yet.</p>}</section></div>;
}

function Library({ archive, title, addLabel, onNewBook, onEditBook, onProfile, onDeleteBooks, onSaveBooks }: { archive: AppArchive; title: string; addLabel: string; onNewBook: () => Promise<void>; onEditBook: (id: string) => Promise<void>; onProfile: (id: string) => void; onDeleteBooks: (ids: string[]) => Promise<void>; onSaveBooks: (books: V2BookRecord[]) => Promise<void> }) {
  const [query, setQuery] = useState(() => readStorage(LIBRARY_QUERY_KEY, '')); const [size, setSize] = useState<CardSize>(readCardSize); const [filter, setFilter] = useState<LibraryFilter>(readLibraryFilter); const [sort, setSort] = useState<LibrarySort>(readLibrarySort); const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => { try { localStorage.setItem(LIBRARY_QUERY_KEY, query); localStorage.setItem(LIBRARY_SIZE_KEY, size); localStorage.setItem(LIBRARY_FILTER_KEY, filter); localStorage.setItem(LIBRARY_SORT_KEY, sort); } catch {} }, [query,size,filter,sort]);
  const books = useMemo(() => { const q = query.trim().toLowerCase(); return archive.books.filter((book) => { if (filter === 'active' && book.archived) return false; if (filter === 'archived' && !book.archived) return false; if (filter === 'favorites' && (!book.favorite || book.archived)) return false; if (['want','reading','paused','completed','dnf'].includes(filter) && (book.status !== filter || book.archived)) return false; return !q || `${book.title} ${book.author} ${book.series} ${(book.genres ?? []).join(' ')} ${(book.tags ?? []).join(' ')}`.toLowerCase().includes(q); }).sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'author' ? a.author.localeCompare(b.author) : sort === 'progress' ? b.progress-a.progress : sort === 'rating' ? b.rating-a.rating : b.updatedAt.localeCompare(a.updatedAt)); }, [archive.books,filter,query,sort]);
  const selectedBooks = archive.books.filter((book) => selectedIds.includes(book.id)); const single = selectedBooks.length === 1 ? selectedBooks[0] : null;
  const favoriteSelected = () => onSaveBooks(selectedBooks.map((book) => ({ ...book, favorite: !selectedBooks.every((item) => item.favorite) })));
  return <div className="v2-library"><header><div><h2>{title}</h2><p>Select books for commands, or click a card to open its profile.</p></div><button onClick={() => onNewBook()}>{addLabel}</button></header><div className="v2-library-controls v2-library-controls--expanded"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, authors, genres, or tags" /><select value={filter} onChange={(event) => setFilter(event.target.value as LibraryFilter)}><option value="active">All active books</option><option value="reading">Currently reading</option><option value="want">Want to read</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="dnf">DNF</option><option value="favorites">Favorites</option><option value="archived">Archived</option></select><select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option><option value="progress">Highest progress</option><option value="rating">Highest rated</option></select><select value={size} onChange={(event) => setSize(event.target.value as CardSize)}><option value="small">Small cards</option><option value="medium">Medium cards</option><option value="large">Large cards</option></select></div><div className="v2-library-actionbar"><span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select a book to use commands'}</span><button disabled={!single} onClick={() => single && onProfile(single.id)}>Profile</button><button disabled={!single} onClick={() => single && onEditBook(single.id)}>Edit</button><button disabled={!selectedBooks.length} onClick={() => void favoriteSelected()}>Favorite</button><button disabled={!selectedBooks.length} onClick={() => onDeleteBooks(selectedIds).then(() => setSelectedIds([]))}>Delete</button></div>{books.length ? <div className={`v2-library-grid is-${size}`}>{books.map((book) => <article key={book.id} className={selectedIds.includes(book.id) ? 'is-selected' : ''}><label className="v2-library-select"><input type="checkbox" checked={selectedIds.includes(book.id)} onChange={() => setSelectedIds((ids) => ids.includes(book.id) ? ids.filter((id) => id !== book.id) : [...ids,book.id])} /><span>Select {book.title}</span></label><button type="button" className="v2-library-card-open" onClick={() => onProfile(book.id)}><CardRenderer book={book} design={book.design} size={size} /></button></article>)}</div> : <div className="v2-empty-state"><span>▤</span><h3>No books found</h3><button onClick={() => onNewBook()}>{addLabel}</button></div>}</div>;
}

function Profile({ archive, profiles, onSave }: { archive: AppArchive; profiles: UniverseProfiles; onSave: (next: AppArchive) => Promise<void> }) {
  const [name, setName] = useState(archive.profile.displayName); const [busyPath, setBusyPath] = useState<PathId | null>(null); const profile = archive.profile as ExtendedProfile; const path = pathFor(profile.path); const current = rankIndexForPoints(path.id, profile.points || 0);
  const isPrythian = profiles.activeUniverse === 'prythian';
  const courtId = (profiles.prythian.court || 'night') as PrythianCourtId;
  const court = PRYTHIAN_COURTS[courtId];
  const courtCurrent = prythianRankIndex(Number(profile.points) || 0);
  async function changePath(nextPath: PathId) { if (nextPath === path.id || busyPath) return; setBusyPath(nextPath); await onSave({ ...archive, profile: { ...profile, path: nextPath, rankIndex: rankIndexForPoints(nextPath, profile.points || 0) } }); setBusyPath(null); }
  return <div className="v2-profile core-profile">{isPrythian ? <section className="core-profile-assignment prythian-core-profile"><header><div><span>Your court</span><h2>{court.glyph} {court.name}</h2><small>{court.family === 'solar' ? 'Solar Court' : 'Seasonal Court'} · Ruled by {court.ruler}</small></div><div><span>Court standing</span><strong>{PRYTHIAN_RANKS[courtCurrent]}</strong><small>{profile.points || 0} points</small></div></header><div className="core-rank-ladder"><h3>Court standing levels</h3><ol>{PRYTHIAN_RANKS.map((rank,index) => <li key={rank} className={index < courtCurrent ? 'is-unlocked' : index === courtCurrent ? 'is-current' : 'is-locked'}><span>{index+1}</span><div><strong>{rank}</strong><small>{PRYTHIAN_THRESHOLDS[index].toLocaleString()} points</small></div><em>{index < courtCurrent ? 'Unlocked' : index === courtCurrent ? 'Current' : 'Locked'}</em></li>)}</ol></div></section> : <section className="core-profile-assignment"><header><div><span>Your assignment</span><h2>{path.glyph} {path.name}</h2></div><div><span>{path.copy.currentRank}</span><strong>{path.ranks[current]}</strong><small>{profile.points || 0} points</small></div></header>{profile.abilityName && <article><span>{path.id === 'gryphon' ? 'Mindwork gift' : 'Signet'}</span><strong>{profile.abilityName}</strong><small>{profile.abilityDescription}</small></article>}{profile.creature && <article><span>Bonded creature</span><strong>{profile.creature.name}</strong><small>{profile.creature.color}{profile.creature.tail ? ` ${profile.creature.tail}` : ''}</small></article>}<div className="core-path-picker"><h3>Choose your active path</h3><p>Your points and logged data remain unchanged.</p><div>{PATH_IDS.map((id) => { const option = PATHS[id]; return <button key={id} className={id === path.id ? 'is-active' : ''} disabled={Boolean(busyPath)} onClick={() => void changePath(id)}><span>{option.glyph}</span><strong>{option.name}</strong><small>{option.ranks[rankIndexForPoints(id, profile.points || 0)]}</small></button>; })}</div></div><div className="core-rank-ladder"><h3>{path.progressName} levels</h3><ol>{path.ranks.map((rank,index) => <li key={rank} className={index < current ? 'is-unlocked' : index === current ? 'is-current' : 'is-locked'}><span>{index+1}</span><div><strong>{rank}</strong><small>{path.thresholds[index].toLocaleString()} points</small></div><em>{index < current ? 'Unlocked' : index === current ? 'Current' : 'Locked'}</em></li>)}</ol></div></section>}<section><p>Profile</p><h2>Your archive identity</h2><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label><button onClick={() => void onSave({ ...archive, profile: { ...profile, displayName: name } })}>Save Profile</button></section></div>;
}
