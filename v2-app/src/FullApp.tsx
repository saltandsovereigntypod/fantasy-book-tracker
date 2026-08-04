import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Workspace from './App';
import { CardRenderer } from './CardRenderer';
import { freshArchive, loadCloudArchive, saveCloudArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { defaultBook, defaultDesign } from './defaults';
import { saveWorkspaceDraft, WORKSPACE_DRAFT_EVENT, type WorkspaceDraft } from './library';
import { getAuthSnapshot, signIn, signOut, signUp, supabase } from './supabase';
import type { CardSize } from './domain';
import './full-app.css';

type AppView = 'dashboard' | 'library' | 'editor' | 'theories' | 'wall' | 'mindmap' | 'profile';
type AuthMode = 'signin' | 'signup';

const NAV_ITEMS: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Command Hall', icon: '⌂' },
  { id: 'library', label: 'Library', icon: '▤' },
  { id: 'editor', label: 'Book Workspace', icon: '✦' },
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
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const archiveRef = useRef(archive);
  const cloudTimerRef = useRef<number | null>(null);

  useEffect(() => { archiveRef.current = archive; }, [archive]);

  useEffect(() => {
    let active = true;
    getAuthSnapshot()
      .then(async ({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        if (currentUser) setArchive(await loadCloudArchive(currentUser));
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'The archive could not be opened.'); })
      .finally(() => { if (active) setLoading(false); });

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
      const next = {
        ...current,
        books: existing
          ? current.books.map((book) => book.id === nextBook.id ? nextBook : book)
          : [...current.books, nextBook],
        updatedAt: now,
      };
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
    setView('editor');
  }

  async function openBook(bookId: string) {
    const selected = archiveRef.current.books.find((book) => book.id === bookId);
    if (!selected) return;
    const { design, createdAt: _createdAt, updatedAt: _updatedAt, favorite: _favorite, archived: _archived, ...book } = selected;
    await saveWorkspaceDraft(clone(book), clone(design));
    setEditorKey((key) => key + 1);
    setView('editor');
  }

  if (loading) return <div className="v2-boot-screen"><span>✦</span><strong>Restoring your archive…</strong></div>;
  if (!user) return <AuthScreen error={error} onError={setError} />;

  const displayName = archive.profile.displayName || user.email?.split('@')[0] || 'Reader';
  return <div className="v2-full-app">
    <aside className="v2-app-sidebar">
      <div className="v2-brand"><span>✦</span><div><small>The Empyrean Tracker</small><strong>Private Reading Command</strong></div></div>
      <nav>{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? 'is-active' : ''} onClick={() => item.id === 'editor' ? openNewBook().catch((reason) => setError(reason.message)) : setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="v2-sidebar-footer"><small>{archive.profile.path}</small><strong>{displayName}</strong><button onClick={() => signOut().catch((reason) => setError(reason.message))}>Sign Out</button></div>
    </aside>

    <main className="v2-app-main">
      <header className="v2-topbar"><div><p>{NAV_ITEMS.find((item) => item.id === view)?.label}</p><h1>{view === 'editor' ? 'Book Workspace' : `Welcome back, ${displayName}`}</h1></div><span className={`v2-sync-state is-${syncState}`}>{syncState === 'saving' ? 'Saving…' : syncState === 'saved' ? 'Cloud saved' : syncState === 'error' ? 'Save failed' : 'Cloud ready'}</span></header>
      {error && <div className="v2-app-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      <section className={`v2-view v2-view--${view}`}>
        {view === 'dashboard' && <Dashboard archive={archive} onNavigate={setView} onNewBook={openNewBook} onEditBook={openBook} />}
        {view === 'library' && <Library archive={archive} onNewBook={openNewBook} onEditBook={openBook} />}
        {view === 'editor' && <Workspace key={editorKey} />}
        {view === 'theories' && <ComingSoon title="Theories" body="Theories, suspicions, evidence links, and book relationships are the next investigation module." />}
        {view === 'wall' && <ComingSoon title="Conspiracy Wall" body="The V2 wall will use the same typed archive and connection records as books and theories." />}
        {view === 'mindmap' && <ComingSoon title="Mind Map" body="The V2 mind map will be rebuilt as an infinite connected workspace." />}
        {view === 'profile' && <Profile archive={archive} onSave={persistArchive} />}
      </section>
    </main>
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
    event.preventDefault();
    onError('');
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, displayName.trim(), inviteCode.trim());
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="v2-auth-screen"><section className="v2-auth-card"><div className="v2-auth-sigil">✦</div><p>The Empyrean Tracker</p><h1>{mode === 'signin' ? 'Enter the Archive' : 'Create Your Archive'}</h1><div className="v2-auth-tabs"><button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>Sign In</button><button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>Create Account</button></div><form onSubmit={submit}>{mode === 'signup' && <><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label><label>Invitation code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required /></label></>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="v2-auth-error">{error}</p>}<button className="v2-auth-submit" disabled={busy}>{busy ? 'Opening…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button></form></section></main>;
}

function Dashboard({ archive, onNavigate, onNewBook, onEditBook }: { archive: V2ArchiveState; onNavigate: (view: AppView) => void; onNewBook: () => Promise<void>; onEditBook: (id: string) => Promise<void> }) {
  const activeBooks = archive.books.filter((book) => book.status === 'reading' && !book.archived);
  const completed = archive.books.filter((book) => book.status === 'completed').length;
  return <div className="v2-dashboard"><section className="v2-hero"><div><p>Private Reading Command</p><h2>Every chapter leaves evidence.</h2><span>Track the books, preserve the theories, and build the card exactly the way you want it.</span><div><button onClick={() => onNewBook()}>Add or Design a Book</button><button onClick={() => onNavigate('library')}>Open Library</button></div></div><strong>✦</strong></section><div className="v2-metric-grid"><article><span>Total Books</span><strong>{archive.books.length}</strong></article><article><span>Currently Reading</span><strong>{activeBooks.length}</strong></article><article><span>Completed</span><strong>{completed}</strong></article><article><span>Open Theories</span><strong>{archive.theories.length}</strong></article></div><section className="v2-dashboard-panel"><header><h3>Active Reading</h3><button onClick={() => onNavigate('library')}>View all</button></header>{activeBooks.length ? <div className="v2-mini-books">{activeBooks.slice(0, 3).map((book) => <button type="button" key={book.id} onClick={() => onEditBook(book.id)}><strong>{book.title}</strong><span>{book.author}</span><small>{book.progress}% complete</small></button>)}</div> : <p>No active books yet. The editor is ready when you are.</p>}</section></div>;
}

function Library({ archive, onNewBook, onEditBook }: { archive: V2ArchiveState; onNewBook: () => Promise<void>; onEditBook: (id: string) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<CardSize>('medium');
  const books = useMemo(() => archive.books.filter((book) => !book.archived && `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(query.toLowerCase())), [archive.books, query]);
  return <div className="v2-library"><header><div><h2>Book Library</h2><p>The same renderer used in the editor powers every saved card.</p></div><button onClick={() => onNewBook()}>Add Book</button></header><div className="v2-library-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search books" /><select value={size} onChange={(event) => setSize(event.target.value as CardSize)}><option value="small">Small cards</option><option value="medium">Medium cards</option><option value="large">Large cards</option></select></div>{books.length ? <div className={`v2-library-grid is-${size}`}>{books.map((book) => <article key={book.id}><CardRenderer book={book} design={book.design} size={size} /><footer><strong>{book.title}</strong><button onClick={() => onEditBook(book.id)}>Edit</button></footer></article>)}</div> : <div className="v2-empty-state"><span>▤</span><h3>No books found</h3><p>Create your first book in the V2 workspace.</p><button onClick={() => onNewBook()}>Open Workspace</button></div>}</div>;
}

function Profile({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => void }) {
  const [name, setName] = useState(archive.profile.displayName);
  return <div className="v2-profile"><section><p>Profile</p><h2>Your archive identity</h2><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label><button onClick={() => onSave({ ...archive, profile: { ...archive.profile, displayName: name } })}>Save Profile</button></section><section><span>Current path</span><strong>{archive.profile.path}</strong><small>{archive.profile.points.toLocaleString()} points</small></section></div>;
}

function ComingSoon({ title, body }: { title: string; body: string }) {
  return <div className="v2-coming-soon"><span>✦</span><h2>{title}</h2><p>{body}</p></div>;
}
