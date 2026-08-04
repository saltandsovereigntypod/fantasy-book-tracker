import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Workspace from './App';
import { BookProfileDrawer } from './BookProfileDrawer';
import { CardActionsPreview } from './CardActionsDesigner';
import { CardRenderer } from './CardRenderer';
import { freshArchive, loadCloudArchive, saveCloudArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { defaultBook, defaultDesign } from './defaults';
import { saveWorkspaceDraft, WORKSPACE_DRAFT_EVENT, type WorkspaceDraft } from './library';
import { getAuthSnapshot, signIn, signOut, signUp, supabase } from './supabase';
import type { CardAction, CardSize, ReadingStatus } from './domain';
import './full-app.css';
import './full-app-enhancements.css';

type AppView = 'dashboard' | 'library' | 'editor' | 'theories' | 'wall' | 'mindmap' | 'profile';
type NavView = Exclude<AppView, 'editor'>;
type AuthMode = 'signin' | 'signup';
type LibrarySort = 'updated' | 'title' | 'author' | 'progress' | 'rating';
type LibraryFilter = 'active' | ReadingStatus | 'favorites' | 'archived';

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Command Hall', icon: '⌂' },
  { id: 'library', label: 'Library', icon: '▤' },
  { id: 'theories', label: 'Theories', icon: '⌁' },
  { id: 'wall', label: 'Conspiracy Wall', icon: '✣' },
  { id: 'mindmap', label: 'Mind Map', icon: '⌘' },
  { id: 'profile', label: 'Profile', icon: '♜' },
];

function clone<T>(value: T): T { return structuredClone(value); }

export default function FullApp() {
  const [user, setUser] = useState<User | null>(null);
  const [archive, setArchive] = useState<V2ArchiveState>(() => freshArchive());
  const [view, setView] = useState<AppView>('dashboard');
  const [editorKey, setEditorKey] = useState(0);
  const [profileBookId, setProfileBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const archiveRef = useRef(archive);
  const cloudTimerRef = useRef<number | null>(null);

  useEffect(() => { archiveRef.current = archive; }, [archive]);

  useEffect(() => {
    let active = true;
    getAuthSnapshot().then(async ({ user: currentUser }) => {
      if (!active) return;
      setUser(currentUser);
      if (currentUser) setArchive(await loadCloudArchive(currentUser));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'The archive could not be opened.'); }).finally(() => { if (active) setLoading(false); });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) setArchive(freshArchive());
      else loadCloudArchive(nextUser).then(setArchive).catch((reason) => setError(reason.message));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      if (cloudTimerRef.current) window.clearTimeout(cloudTimerRef.current);
    };
  }, []);

  const persistArchive = useCallback(async (next: V2ArchiveState) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    archiveRef.current = stamped;
    setArchive(stamped);
    if (!user) return;
    setSyncState('saving');
    try {
      await saveCloudArchive(user, stamped);
      setSyncState('saved');
      window.setTimeout(() => setSyncState('idle'), 1400);
    } catch (reason) {
      console.error(reason);
      setSyncState('error');
      setError(reason instanceof Error ? reason.message : 'Cloud save failed.');
    }
  }, [user]);

  useEffect(() => {
    function handleWorkspaceDraft(event: Event) {
      const draft = (event as CustomEvent<WorkspaceDraft>).detail;
      if (!draft?.book?.id || !draft.design) return;
      const current = archiveRef.current;
      const existing = current.books.find((book) => book.id === draft.book.id);
      const now = new Date().toISOString();
      const nextBook: V2BookRecord = {
        ...draft.book,
        design: clone(draft.design),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        favorite: existing?.favorite || false,
        archived: existing?.archived || false,
      };
      const next = { ...current, books: existing ? current.books.map((book) => book.id === nextBook.id ? nextBook : book) : [...current.books, nextBook], updatedAt: now };
      archiveRef.current = next;
      setArchive(next);
      setSyncState('saving');
      if (cloudTimerRef.current) window.clearTimeout(cloudTimerRef.current);
      cloudTimerRef.current = window.setTimeout(() => { persistArchive(archiveRef.current); }, 900);
    }
    window.addEventListener(WORKSPACE_DRAFT_EVENT, handleWorkspaceDraft);
    return () => window.removeEventListener(WORKSPACE_DRAFT_EVENT, handleWorkspaceDraft);
  }, [persistArchive]);

  async function openNewBook() {
    const book = { ...clone(defaultBook), id: crypto.randomUUID(), title: 'Untitled Book', author: '', series: '', coverUrl: '', progress: 0, rating: 0, spice: 0, impact: 0, reaction: '' };
    await saveWorkspaceDraft(book, clone(defaultDesign));
    setEditorKey((key) => key + 1);
    setProfileBookId(null);
    setView('editor');
  }

  async function openBook(bookId: string) {
    const selected = archiveRef.current.books.find((book) => book.id === bookId);
    if (!selected) return;
    const { design, createdAt: _createdAt, updatedAt: _updatedAt, favorite: _favorite, archived: _archived, ...book } = selected;
    await saveWorkspaceDraft(clone(book), clone(design));
    setEditorKey((key) => key + 1);
    setProfileBookId(null);
    setView('editor');
  }

  async function saveBook(nextBook: V2BookRecord) {
    const current = archiveRef.current;
    await persistArchive({ ...current, books: current.books.map((book) => book.id === nextBook.id ? { ...nextBook, updatedAt: new Date().toISOString() } : book) });
  }

  async function deleteBook(bookId: string) {
    const selected = archiveRef.current.books.find((book) => book.id === bookId);
    if (!selected || !window.confirm(`Permanently delete “${selected.title}”? This cannot be undone.`)) return;
    setProfileBookId(null);
    await persistArchive({ ...archiveRef.current, books: archiveRef.current.books.filter((book) => book.id !== bookId) });
  }

  if (loading) return <div className="v2-boot-screen"><span>✦</span><strong>Restoring your archive…</strong></div>;
  if (!user) return <AuthScreen error={error} onError={setError} />;

  const displayName = archive.profile.displayName || user.email?.split('@')[0] || 'Reader';
  const profileBook = archive.books.find((book) => book.id === profileBookId) ?? null;
  const viewLabel = view === 'editor' ? 'Book Workspace' : NAV_ITEMS.find((item) => item.id === view)?.label;

  return <div className="v2-full-app">
    <aside className="v2-app-sidebar">
      <div className="v2-brand"><span>✦</span><div><small>The Empyrean Tracker</small><strong>Private Reading Command</strong></div></div>
      <nav>{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? 'is-active' : ''} onClick={() => { setProfileBookId(null); setView(item.id); }}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="v2-sidebar-footer"><small>{archive.profile.path}</small><strong>{displayName}</strong><button onClick={() => signOut().catch((reason) => setError(reason.message))}>Sign Out</button></div>
    </aside>
    <main className="v2-app-main">
      <header className="v2-topbar"><div>{view === 'editor' && <button className="v2-editor-back" onClick={() => setView('library')}>← Back to Library</button>}<p>{viewLabel}</p><h1>{view === 'editor' ? 'Book Workspace' : `Welcome back, ${displayName}`}</h1></div><span className={`v2-sync-state is-${syncState}`}>{syncState === 'saving' ? 'Saving…' : syncState === 'saved' ? 'Cloud saved' : syncState === 'error' ? 'Save failed' : 'Cloud ready'}</span></header>
      {error && <div className="v2-app-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      <section className={`v2-view v2-view--${view}`}>
        {view === 'dashboard' && <Dashboard archive={archive} onNavigate={setView} onNewBook={openNewBook} onProfile={setProfileBookId} />}
        {view === 'library' && <Library archive={archive} onNewBook={openNewBook} onEditBook={openBook} onProfile={setProfileBookId} onDeleteBook={deleteBook} onSaveBook={saveBook} />}
        {view === 'editor' && <Workspace key={editorKey} />}
        {view === 'theories' && <ComingSoon title="Theories" body="Theories, suspicions, evidence links, and book relationships are the next investigation module." />}
        {view === 'wall' && <ComingSoon title="Conspiracy Wall" body="The V2 wall will use the same typed archive and connection records as books and theories." />}
        {view === 'mindmap' && <ComingSoon title="Mind Map" body="The V2 mind map will be rebuilt as an infinite connected workspace." />}
        {view === 'profile' && <Profile archive={archive} onSave={persistArchive} />}
      </section>
    </main>
    {profileBook && <BookProfileDrawer book={profileBook} archive={archive} onClose={() => setProfileBookId(null)} onEdit={() => openBook(profileBook.id)} onDelete={() => deleteBook(profileBook.id)} onSave={saveBook} />}
  </div>;
}

function AuthScreen({ error, onError }: { error: string; onError: (value: string) => void }) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); onError(''); setBusy(true);
    try { if (mode === 'signin') await signIn(email.trim(), password); else await signUp(email.trim(), password, displayName.trim(), inviteCode.trim()); }
    catch (reason) { onError(reason instanceof Error ? reason.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }
  return <main className="v2-auth-screen"><section className="v2-auth-card"><div className="v2-auth-sigil">✦</div><p>The Empyrean Tracker</p><h1>{mode === 'signin' ? 'Enter the Archive' : 'Create Your Archive'}</h1><div className="v2-auth-tabs"><button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>Sign In</button><button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>Create Account</button></div><form onSubmit={submit}>{mode === 'signup' && <><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label><label>Invitation code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required /></label></>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="v2-auth-error">{error}</p>}<button className="v2-auth-submit" disabled={busy}>{busy ? 'Opening…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button></form></section></main>;
}

function Dashboard({ archive, onNavigate, onNewBook, onProfile }: { archive: V2ArchiveState; onNavigate: (view: AppView) => void; onNewBook: () => Promise<void>; onProfile: (id: string) => void }) {
  const activeBooks = archive.books.filter((book) => book.status === 'reading' && !book.archived);
  const completed = archive.books.filter((book) => book.status === 'completed' && !book.archived).length;
  return <div className="v2-dashboard"><section className="v2-hero"><div><p>Private Reading Command</p><h2>Every chapter leaves evidence.</h2><span>Track the books, preserve the theories, and build the card exactly the way you want it.</span><div><button onClick={() => onNewBook()}>Add or Design a Book</button><button onClick={() => onNavigate('library')}>Open Library</button></div></div><strong>✦</strong></section><div className="v2-metric-grid"><article><span>Total Books</span><strong>{archive.books.filter((book) => !book.archived).length}</strong></article><article><span>Currently Reading</span><strong>{activeBooks.length}</strong></article><article><span>Completed</span><strong>{completed}</strong></article><article><span>Open Theories</span><strong>{archive.theories.length}</strong></article></div><section className="v2-dashboard-panel"><header><h3>Active Reading</h3><button onClick={() => onNavigate('library')}>View all</button></header>{activeBooks.length ? <div className="v2-mini-books">{activeBooks.slice(0, 3).map((book) => <button type="button" key={book.id} onClick={() => onProfile(book.id)}><strong>{book.title}</strong><span>{book.author || 'Unknown author'}</span><small>{book.progress}% complete</small></button>)}</div> : <p>No active books yet. The editor is ready when you are.</p>}</section></div>;
}

function Library({ archive, onNewBook, onEditBook, onProfile, onDeleteBook, onSaveBook }: { archive: V2ArchiveState; onNewBook: () => Promise<void>; onEditBook: (id: string) => Promise<void>; onProfile: (id: string) => void; onDeleteBook: (id: string) => Promise<void>; onSaveBook: (book: V2BookRecord) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<CardSize>('medium');
  const [filter, setFilter] = useState<LibraryFilter>('active');
  const [sort, setSort] = useState<LibrarySort>('updated');

  const books = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return archive.books.filter((book) => {
      if (filter === 'active' && book.archived) return false;
      if (filter === 'archived' && !book.archived) return false;
      if (filter === 'favorites' && (!book.favorite || book.archived)) return false;
      if (['want', 'reading', 'paused', 'completed', 'dnf'].includes(filter) && (book.status !== filter || book.archived)) return false;
      return !normalizedQuery || `${book.title} ${book.author} ${book.series} ${(book.genres ?? []).join(' ')} ${(book.tags ?? []).join(' ')}`.toLowerCase().includes(normalizedQuery);
    }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'author' ? a.author.localeCompare(b.author) : sort === 'progress' ? b.progress - a.progress : sort === 'rating' ? b.rating - a.rating : b.updatedAt.localeCompare(a.updatedAt));
  }, [archive.books, filter, query, sort]);

  async function runAction(book: V2BookRecord, action: CardAction) {
    if (action.action === 'profile') { onProfile(book.id); return; }
    if (action.action === 'edit') { await onEditBook(book.id); return; }
    if (action.action === 'favorite') { await onSaveBook({ ...book, favorite: !book.favorite }); return; }
    if (action.action === 'archive') { await onSaveBook({ ...book, archived: !book.archived }); return; }
    if (action.action === 'delete') { await onDeleteBook(book.id); return; }

    if (action.action === 'progress') {
      const raw = window.prompt(`Update progress for “${book.title}” (0–100)`, String(book.progress));
      if (raw == null) return;
      const progress = Math.max(0, Math.min(100, Number(raw)));
      if (!Number.isFinite(progress)) return;
      await onSaveBook({ ...book, progress, status: progress >= 100 ? 'completed' : book.status === 'want' ? 'reading' : book.status });
      return;
    }

    if (action.action === 'add-note') {
      const text = window.prompt(`Add a note to “${book.title}”`);
      if (!text?.trim()) return;
      const now = new Date().toISOString();
      await onSaveBook({ ...book, notes: [...(book.notes ?? []), { id: crypto.randomUUID(), text: text.trim(), createdAt: now, updatedAt: now }] });
      return;
    }

    if (action.action === 'start-reading') {
      const now = new Date().toISOString();
      const hasActiveSession = (book.readingSessions ?? []).some((session) => !session.completedAt);
      await onSaveBook({
        ...book,
        status: 'reading',
        readingSessions: hasActiveSession ? [...(book.readingSessions ?? [])] : [...(book.readingSessions ?? []), { id: crypto.randomUUID(), startedAt: now, startProgress: book.progress, endProgress: book.progress }],
      });
      return;
    }

    if (action.action === 'finish-reading') {
      const now = new Date().toISOString();
      const sessions = [...(book.readingSessions ?? [])];
      let activeIndex = -1;
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if (!sessions[index].completedAt) { activeIndex = index; break; }
      }
      if (activeIndex >= 0) sessions[activeIndex] = { ...sessions[activeIndex], completedAt: now, endProgress: 100 };
      else sessions.push({ id: crypto.randomUUID(), startedAt: now, completedAt: now, startProgress: book.progress, endProgress: 100 });
      await onSaveBook({ ...book, progress: 100, status: 'completed', readingSessions: sessions });
    }
  }

  return <div className="v2-library"><header><div><h2>Book Library</h2><p>The same renderer used in the editor powers every saved card.</p></div><button onClick={() => onNewBook()}>Add Book</button></header><div className="v2-library-controls v2-library-controls--expanded"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, authors, genres, or tags" /><select value={filter} onChange={(event) => setFilter(event.target.value as LibraryFilter)}><option value="active">All active books</option><option value="reading">Currently reading</option><option value="want">Want to read</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="dnf">DNF</option><option value="favorites">Favorites</option><option value="archived">Archived</option></select><select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option><option value="progress">Highest progress</option><option value="rating">Highest rated</option></select><select value={size} onChange={(event) => setSize(event.target.value as CardSize)}><option value="small">Small cards</option><option value="medium">Medium cards</option><option value="large">Large cards</option></select></div>{books.length ? <div className={`v2-library-grid is-${size}`}>{books.map((book) => <article key={book.id}><CardRenderer book={book} design={book.design} size={size} /><CardActionsPreview actions={book.design.actions} size={size} interactive onAction={(action) => { runAction(book, action).catch((reason) => console.error(reason)); }} /></article>)}</div> : <div className="v2-empty-state"><span>▤</span><h3>No books found</h3><p>Adjust the filters or create another book.</p><button onClick={() => onNewBook()}>Add Book</button></div>}</div>;
}

function Profile({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => void }) {
  const [name, setName] = useState(archive.profile.displayName);
  return <div className="v2-profile"><section><p>Profile</p><h2>Your archive identity</h2><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label><button onClick={() => onSave({ ...archive, profile: { ...archive.profile, displayName: name } })}>Save Profile</button></section><section><span>Current path</span><strong>{archive.profile.path}</strong><small>{archive.profile.points.toLocaleString()} points</small></section></div>;
}

function ComingSoon({ title, body }: { title: string; body: string }) { return <div className="v2-coming-soon"><span>✦</span><h2>{title}</h2><p>{body}</p></div>; }
