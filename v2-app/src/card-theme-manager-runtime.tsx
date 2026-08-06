import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CardDesign } from './domain';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft, WORKSPACE_DRAFT_EVENT } from './library';
import { getAuthSnapshot } from './supabase';
import './card-theme-manager-runtime.css';

type CardThemePreset = {
  id: string;
  name: string;
  design: CardDesign;
  createdAt: string;
  updatedAt: string;
};

type ArchiveWithThemes = V2ArchiveState & { cardThemes?: CardThemePreset[] };
type ThemeView = 'hidden' | 'editor' | 'library';

function cloneDesign(design: CardDesign): CardDesign {
  return structuredClone(design);
}

function designForBook(theme: CardThemePreset, book: V2BookRecord): CardDesign {
  return {
    ...cloneDesign(theme.design),
    id: book.design.id || crypto.randomUUID(),
    width: 420,
    height: 380,
    version: Math.max(4, Number(theme.design.version) || 1),
  };
}

function publishBookDesign(book: V2BookRecord) {
  const { design, createdAt: _createdAt, updatedAt: _updatedAt, favorite: _favorite, archived: _archived, ...bookRecord } = book;
  window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFT_EVENT, {
    detail: { book: bookRecord, design: cloneDesign(design) },
  }));
}

function CardThemeManager() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ThemeView>('hidden');
  const [archive, setArchive] = useState<ArchiveWithThemes | null>(null);
  const [name, setName] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const syncView = () => {
      if (document.querySelector('.v2-view--editor')) setView('editor');
      else if (document.querySelector('.v2-view--library')) setView('library');
      else setView('hidden');
    };
    syncView();
    const observer = new MutationObserver(syncView);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const next = await loadCloudArchive(user) as ArchiveWithThemes;
      if (!active) return;
      setArchive(next);
      setSelectedThemeId(next.cardThemes?.[0]?.id || '');
    }).catch(() => undefined);
    return () => { active = false; observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!open || view !== 'editor') return;
    window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [open, view]);

  const themes = archive?.cardThemes || [];
  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === selectedThemeId) || null, [themes, selectedThemeId]);

  async function persist(next: ArchiveWithThemes, message: string) {
    setArchive(next);
    saveLocalArchive(next);
    setStatus('Saving…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudArchive(user, next);
      setStatus(message);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Save failed.');
    }
  }

  async function saveCurrentDesign() {
    const cleanName = name.trim();
    if (!archive || !cleanName) return;
    setStatus('Reading the current editor design…');
    const draft = await loadWorkspaceDraft();
    if (!draft?.design) {
      setStatus('No editor design is available yet. Open a book, make a design change, and try again.');
      return;
    }
    const now = new Date().toISOString();
    const existing = themes.find((theme) => theme.name.toLowerCase() === cleanName.toLowerCase());
    const preset: CardThemePreset = existing
      ? { ...existing, design: cloneDesign(draft.design), updatedAt: now }
      : { id: crypto.randomUUID(), name: cleanName, design: cloneDesign(draft.design), createdAt: now, updatedAt: now };
    const nextThemes = existing ? themes.map((theme) => theme.id === existing.id ? preset : theme) : [...themes, preset];
    const next = { ...archive, cardThemes: nextThemes, updatedAt: now };
    setSelectedThemeId(preset.id);
    setName('');
    await persist(next, existing ? `Updated “${preset.name}”.` : `Saved “${preset.name}” as a reusable card theme.`);
  }

  async function applyTo(ids: string[]) {
    if (!archive || !selectedTheme || !ids.length) return;
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const books = archive.books.map((book) => idSet.has(book.id) ? { ...book, design: designForBook(selectedTheme, book), updatedAt: now } : book);
    const next = { ...archive, books, updatedAt: now };
    await persist(next, `Applied “${selectedTheme.name}” to ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}.`);
    books.filter((book) => idSet.has(book.id)).forEach(publishBookDesign);
  }

  async function removeTheme(themeId: string) {
    if (!archive) return;
    const target = themes.find((theme) => theme.id === themeId);
    if (!target || !window.confirm(`Delete the card theme “${target.name}”? Existing cards will keep their current design.`)) return;
    const nextThemes = themes.filter((theme) => theme.id !== themeId);
    setSelectedThemeId(nextThemes[0]?.id || '');
    await persist({ ...archive, cardThemes: nextThemes, updatedAt: new Date().toISOString() }, 'Theme deleted.');
  }

  if (view === 'hidden' || !archive) return null;

  return <>
    <button className={`card-theme-launcher is-${view}`} type="button" onClick={() => { setStatus(''); setOpen(true); }}>
      {view === 'editor' ? 'Save Design as Theme' : 'Card Themes'}
    </button>
    {open && <div className="card-theme-backdrop" role="dialog" aria-modal="true" aria-label="Card theme manager">
      <section className="card-theme-modal">
        <header><div><p>{view === 'editor' ? 'Current card design' : 'Design library'}</p><h2>{view === 'editor' ? 'Save Design as a Theme' : 'Custom Card Themes'}</h2><span>{view === 'editor' ? 'Name this exact layout and save it for reuse on other book cards.' : 'Choose a saved design and apply it without changing book data.'}</span></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        <div className={`card-theme-grid is-${view}`}>
          <section className="card-theme-create">
            <h3>{view === 'editor' ? 'Save this design' : 'Save current editor design'}</h3>
            <p>The theme includes the card background, layout, typography, shapes, images, colors, ratings, progress bar, and bound fields.</p>
            <label>Theme name<input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Midnight parchment" onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { event.preventDefault(); void saveCurrentDesign(); } }} /></label>
            <button type="button" className="is-primary card-theme-save-button" disabled={!name.trim()} onClick={() => void saveCurrentDesign()}>Save This Design as a Theme</button>
            <h3>Saved themes</h3>
            {themes.length ? <div className="card-theme-list">{themes.map((theme) => <article key={theme.id} className={selectedThemeId === theme.id ? 'is-selected' : ''}><button type="button" onClick={() => setSelectedThemeId(theme.id)}><span style={{ background: theme.design.background }} /><strong>{theme.name}</strong><small>{theme.design.elements.length} elements</small></button><button type="button" className="is-danger" onClick={() => void removeTheme(theme.id)}>Delete</button></article>)}</div> : <p className="card-theme-empty">No custom themes saved yet.</p>}
          </section>
          <section className="card-theme-apply">
            <h3>Apply a saved theme</h3>
            <label>Theme<select value={selectedThemeId} onChange={(event) => setSelectedThemeId(event.target.value)}><option value="">Choose a theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
            <div className="card-theme-book-actions"><button type="button" onClick={() => setSelectedBookIds(archive.books.filter((book) => !book.archived).map((book) => book.id))}>Select active</button><button type="button" onClick={() => setSelectedBookIds(archive.books.map((book) => book.id))}>Select all</button><button type="button" onClick={() => setSelectedBookIds([])}>Clear</button></div>
            <div className="card-theme-books">{archive.books.length ? archive.books.map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((ids) => ids.includes(book.id) ? ids.filter((id) => id !== book.id) : [...ids, book.id])} /><span><strong>{book.title}</strong><small>{book.author || 'Unknown author'}{book.archived ? ' · Archived' : ''}</small></span></label>) : <p>No books are available yet.</p>}</div>
            <div className="card-theme-apply-actions"><button type="button" className="is-primary" disabled={!selectedTheme || !selectedBookIds.length} onClick={() => void applyTo(selectedBookIds)}>Apply to Selected ({selectedBookIds.length})</button><button type="button" disabled={!selectedTheme || !archive.books.length} onClick={() => void applyTo(archive.books.map((book) => book.id))}>Apply to Every Card</button></div>
          </section>
        </div>
        {status && <footer>{status}</footer>}
      </section>
    </div>}
  </>;
}

function start() {
  const host = document.createElement('div');
  host.id = 'card-theme-manager-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><CardThemeManager /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
