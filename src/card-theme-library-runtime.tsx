import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createPortal, createRoot } from 'react-dom/client';
import type { CardDesign } from './domain';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft } from './library';
import { getAuthSnapshot } from './supabase';
import './card-theme-library-runtime.css';

type CardThemePreset = {
  id: string;
  name: string;
  design: CardDesign;
  createdAt: string;
  updatedAt: string;
};

type View = 'hidden' | 'editor' | 'library';
const THEME_KEY = 'empyrean-v2-card-themes';

function loadThemes(): CardThemePreset[] {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveThemes(themes: CardThemePreset[]) {
  localStorage.setItem(THEME_KEY, JSON.stringify(themes));
}

function cloneDesign(design: CardDesign): CardDesign {
  return structuredClone(design);
}

function applyTheme(theme: CardThemePreset, book: V2BookRecord): CardDesign {
  return {
    ...cloneDesign(theme.design),
    id: book.design.id || crypto.randomUUID(),
    width: Number(theme.design.width) || 420,
    height: Number(theme.design.height) || 380,
    version: Math.max(4, Number(theme.design.version) || 1),
  };
}

function CardThemeLibrary() {
  const [view, setView] = useState<View>('hidden');
  const [open, setOpen] = useState(false);
  const [themes, setThemes] = useState<CardThemePreset[]>(loadThemes);
  const [archive, setArchive] = useState<V2ArchiveState | null>(null);
  const [name, setName] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const syncView = () => {
      if (document.querySelector('.v2-view--editor')) setView('editor');
      else if (document.querySelector('.v2-view--library')) setView('library');
      else setView('hidden');
    };
    syncView();
    const observer = new MutationObserver(syncView);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (view === 'hidden') return;
    let active = true;
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const next = await loadCloudArchive(user);
      if (active) setArchive(next);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [view, open]);

  useEffect(() => {
    if (!selectedThemeId && themes.length) setSelectedThemeId(themes[0].id);
  }, [themes, selectedThemeId]);

  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === selectedThemeId) || null, [themes, selectedThemeId]);
  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (archive?.books || []).filter((book) => !needle || `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(needle));
  }, [archive?.books, query]);

  async function saveCurrentDesign() {
    const cleanName = name.trim();
    if (!cleanName) return;
    setStatus('Reading current design…');
    const draft = await loadWorkspaceDraft();
    if (!draft?.design) {
      setStatus('No current card design was found. Open a book and make a design change first.');
      return;
    }
    const timestamp = new Date().toISOString();
    const existing = themes.find((theme) => theme.name.toLowerCase() === cleanName.toLowerCase());
    const preset: CardThemePreset = existing
      ? { ...existing, design: cloneDesign(draft.design), updatedAt: timestamp }
      : { id: crypto.randomUUID(), name: cleanName, design: cloneDesign(draft.design), createdAt: timestamp, updatedAt: timestamp };
    const next = existing ? themes.map((theme) => theme.id === existing.id ? preset : theme) : [preset, ...themes];
    setThemes(next);
    saveThemes(next);
    setSelectedThemeId(preset.id);
    setName('');
    setStatus(existing ? `Updated “${preset.name}”.` : `Saved “${preset.name}”.`);
  }

  async function deleteTheme(id: string) {
    const theme = themes.find((item) => item.id === id);
    if (!theme || !window.confirm(`Delete the card theme “${theme.name}”?`)) return;
    const next = themes.filter((item) => item.id !== id);
    setThemes(next);
    saveThemes(next);
    setSelectedThemeId(next[0]?.id || '');
  }

  async function applySelected() {
    if (!archive || !selectedTheme || !selectedBookIds.length) return;
    const ids = new Set(selectedBookIds);
    const timestamp = new Date().toISOString();
    const next: V2ArchiveState = {
      ...archive,
      books: archive.books.map((book) => ids.has(book.id) ? { ...book, design: applyTheme(selectedTheme, book), updatedAt: timestamp } : book),
      updatedAt: timestamp,
    };
    setArchive(next);
    saveLocalArchive(next);
    setStatus('Saving applied theme…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudArchive(user, next);
      setStatus(`Applied “${selectedTheme.name}” to ${selectedBookIds.length} ${selectedBookIds.length === 1 ? 'card' : 'cards'}.`);
      window.dispatchEvent(new CustomEvent('empyrean-card-themes-applied', { detail: { archive: next, ids: selectedBookIds } }));
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Theme was saved locally, but cloud save failed.');
    }
  }

  if (view === 'hidden') return null;

  return <>
    <button className={`card-theme-library-launcher is-${view}`} type="button" onClick={() => { setOpen(true); setStatus(''); }}>
      {view === 'editor' ? 'Save Design as Theme' : 'Card Themes'}
    </button>
    {open && createPortal(
      <div className="card-theme-library-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section className="card-theme-library-dialog" role="dialog" aria-modal="true">
          <header><div><p>Reusable card designs</p><h2>Card Theme Library</h2></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
          <div className="card-theme-library-columns">
            <section>
              <h3>Save current design</h3>
              <label>Theme name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Midnight parchment" /></label>
              <button type="button" className="is-primary" disabled={!name.trim()} onClick={() => void saveCurrentDesign()}>Save This Design</button>
              <h3>Saved themes</h3>
              <div className="card-theme-library-list">
                {themes.map((theme) => <article key={theme.id} className={selectedThemeId === theme.id ? 'is-selected' : ''}>
                  <button type="button" onClick={() => setSelectedThemeId(theme.id)}><span style={{ background: theme.design.background }} /><strong>{theme.name}</strong><small>{theme.design.elements.length} elements</small></button>
                  <button type="button" className="is-danger" onClick={() => void deleteTheme(theme.id)}>Delete</button>
                </article>)}
                {!themes.length && <p>No themes saved yet.</p>}
              </div>
            </section>
            <section>
              <h3>Apply to library cards</h3>
              <label>Theme<select value={selectedThemeId} onChange={(event) => setSelectedThemeId(event.target.value)}><option value="">Choose a theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
              <label>Search books<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, or series" /></label>
              <div className="card-theme-library-select-actions"><button type="button" onClick={() => setSelectedBookIds(filteredBooks.map((book) => book.id))}>Select shown</button><button type="button" onClick={() => setSelectedBookIds([])}>Clear</button></div>
              <div className="card-theme-library-books">
                {filteredBooks.map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author || 'Unknown author'}{book.series ? ` · ${book.series}` : ''}</small></span></label>)}
                {!filteredBooks.length && <p>No books match this search.</p>}
              </div>
              <button type="button" className="is-primary" disabled={!selectedTheme || !selectedBookIds.length} onClick={() => void applySelected()}>Apply to Selected ({selectedBookIds.length})</button>
            </section>
          </div>
          {status && <footer>{status}</footer>}
        </section>
      </div>,
      document.body,
    )}
  </>;
}

function start() {
  document.getElementById('card-theme-manager-runtime')?.remove();
  const host = document.createElement('div');
  host.id = 'card-theme-library-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><CardThemeLibrary /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
