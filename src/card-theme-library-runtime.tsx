import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CardDesign } from './domain';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft } from './library';
import { getAuthSnapshot, supabase } from './supabase';
import './card-theme-library-runtime.css';

type CardThemePreset = { id: string; name: string; design: CardDesign; createdAt: string; updatedAt: string };
type View = 'hidden' | 'editor' | 'library';
const THEME_KEY = 'empyrean-v2-card-themes';

function loadThemes(): CardThemePreset[] {
  try { const value = JSON.parse(localStorage.getItem(THEME_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function storeThemes(themes: CardThemePreset[]) { localStorage.setItem(THEME_KEY, JSON.stringify(themes)); }
function cloneDesign(design: CardDesign): CardDesign { return structuredClone(design); }
function themedDesign(theme: CardThemePreset, book: V2BookRecord): CardDesign {
  return {
    ...cloneDesign(theme.design),
    id: book.design.id || crypto.randomUUID(),
    width: Number(theme.design.width) || 420,
    height: Number(theme.design.height) || 380,
    version: Math.max(4, Number(theme.design.version) || 1),
  };
}

function validTheme(value: unknown): value is CardThemePreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<CardThemePreset>;
  return Boolean(source.id && source.name && source.design && source.createdAt && source.updatedAt);
}

function normalizeThemes(value: unknown): CardThemePreset[] {
  return Array.isArray(value) ? value.filter(validTheme).map((theme) => ({ ...theme, design: cloneDesign(theme.design) })) : [];
}

function mergeThemes(localThemes: CardThemePreset[], cloudThemes: CardThemePreset[]): CardThemePreset[] {
  const merged = new Map<string, CardThemePreset>();
  [...localThemes, ...cloudThemes].forEach((theme) => {
    const key = theme.id || theme.name.toLocaleLowerCase();
    const existing = merged.get(key);
    if (!existing || String(theme.updatedAt).localeCompare(String(existing.updatedAt)) >= 0) merged.set(key, theme);
  });
  return [...merged.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function loadCloudThemes(userId: string): Promise<CardThemePreset[]> {
  const { data, error } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : undefined;
  const state = row?.state && typeof row.state === 'object' ? row.state as Record<string, unknown> : {};
  return normalizeThemes(state.cardThemes);
}

async function saveCloudThemes(userId: string, themes: CardThemePreset[]): Promise<void> {
  const { data, error: readError } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (readError) throw readError;

  const existing = Array.isArray(data) ? data[0] : undefined;
  const state = existing?.state && typeof existing.state === 'object' ? existing.state as Record<string, unknown> : {};
  const timestamp = new Date().toISOString();
  const payload = { state: { ...state, cardThemes: themes }, updated_at: timestamp };

  if (existing) {
    const { error } = await supabase.from('archive_states').update(payload).eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('archive_states').insert({ user_id: userId, ...payload });
  if (error) throw error;
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
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const sync = () => setView(document.querySelector('.v2-view--editor') ? 'editor' : document.querySelector('.v2-view--library') ? 'library' : 'hidden');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (view === 'hidden') return;
    let active = true;
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const [nextArchive, cloudThemes] = await Promise.all([loadCloudArchive(user), loadCloudThemes(user.id)]);
      if (!active) return;
      setArchive(nextArchive);
      const localThemes = loadThemes();
      const merged = mergeThemes(localThemes, cloudThemes);
      setThemes(merged);
      storeThemes(merged);
      if (JSON.stringify(merged) !== JSON.stringify(cloudThemes)) await saveCloudThemes(user.id, merged);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [view, open]);

  useEffect(() => { if (!selectedThemeId && themes.length) setSelectedThemeId(themes[0].id); }, [themes, selectedThemeId]);

  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === selectedThemeId) || null, [themes, selectedThemeId]);
  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (archive?.books || []).filter((book) => !needle || `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(needle));
  }, [archive?.books, query]);

  async function persistThemes(next: CardThemePreset[]) {
    setThemes(next);
    storeThemes(next);
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('Your session expired.');
    await saveCloudThemes(user.id, next);
  }

  async function saveCurrentDesign() {
    const cleanName = name.trim();
    if (!cleanName) return;
    const draft = await loadWorkspaceDraft();
    if (!draft?.design) { setStatus('No current design was found. Open a book and edit its card first.'); return; }
    const timestamp = new Date().toISOString();
    const existing = themes.find((theme) => theme.name.toLowerCase() === cleanName.toLowerCase());
    const preset: CardThemePreset = existing
      ? { ...existing, design: cloneDesign(draft.design), updatedAt: timestamp }
      : { id: crypto.randomUUID(), name: cleanName, design: cloneDesign(draft.design), createdAt: timestamp, updatedAt: timestamp };
    const next = existing ? themes.map((theme) => theme.id === existing.id ? preset : theme) : [preset, ...themes];
    setSelectedThemeId(preset.id);
    setName('');
    setStatus('Saving theme to your account…');
    try {
      await persistThemes(next);
      setStatus(existing ? `Updated “${preset.name}” and synced it across devices.` : `Saved “${preset.name}” and synced it across devices.`);
    } catch (reason) {
      setThemes(next);
      storeThemes(next);
      setStatus(reason instanceof Error ? `${reason.message} The theme is still saved on this device.` : 'Theme saved on this device, but cloud sync failed.');
    }
  }

  async function deleteTheme(id: string) {
    const target = themes.find((theme) => theme.id === id);
    if (!target || !window.confirm(`Delete the card theme “${target.name}”? This removes it from every synced device.`)) return;
    const next = themes.filter((theme) => theme.id !== id);
    setSelectedThemeId(next[0]?.id || '');
    setStatus('Removing theme from your account…');
    try {
      await persistThemes(next);
      setStatus(`Deleted “${target.name}” from your synced theme library.`);
    } catch (reason) {
      setThemes(next);
      storeThemes(next);
      setStatus(reason instanceof Error ? `${reason.message} The local copy was removed.` : 'Local theme removed, but cloud sync failed.');
    }
  }

  async function applySelected() {
    if (!archive || !selectedTheme || !selectedBookIds.length || applying) return;
    setApplying(true);
    const ids = new Set(selectedBookIds);
    const timestamp = new Date().toISOString();
    const next: V2ArchiveState = {
      ...archive,
      books: archive.books.map((book) => ids.has(book.id) ? { ...book, design: themedDesign(selectedTheme, book), updatedAt: timestamp } : book),
      updatedAt: timestamp,
    };
    setArchive(next);
    saveLocalArchive(next);
    setStatus('Saving applied theme…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudArchive(user, next);
      setStatus(`Applied “${selectedTheme.name}” to ${selectedBookIds.length} ${selectedBookIds.length === 1 ? 'card' : 'cards'}. Refreshing library…`);
      setOpen(false);
      window.setTimeout(() => window.location.reload(), 120);
    } catch (reason) {
      setApplying(false);
      setStatus(reason instanceof Error ? reason.message : 'Saved locally, but cloud save failed.');
    }
  }

  if (view === 'hidden') return null;
  return <>
    <button className={`card-theme-library-launcher is-${view}`} type="button" onClick={() => { setOpen(true); setStatus(''); }}>{view === 'editor' ? 'Save Design as Theme' : 'Card Themes'}</button>
    {open && <div className="card-theme-library-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !applying) setOpen(false); }}>
      <section className="card-theme-library-dialog" role="dialog" aria-modal="true">
        <header><div><p>Reusable card designs</p><h2>Card Theme Library</h2></div><button type="button" disabled={applying} onClick={() => setOpen(false)}>×</button></header>
        <div className="card-theme-library-columns">
          <section><h3>Save current design</h3><label>Theme name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Midnight parchment" /></label><button className="is-primary" type="button" disabled={!name.trim()} onClick={() => void saveCurrentDesign()}>Save This Design</button><h3>Saved themes</h3><div className="card-theme-library-list">{themes.map((theme) => <article key={theme.id} className={selectedThemeId === theme.id ? 'is-selected' : ''}><button type="button" onClick={() => setSelectedThemeId(theme.id)}><span style={{ background: theme.design.background }} /><strong>{theme.name}</strong><small>{theme.design.elements.length} elements</small></button><button type="button" className="is-danger" onClick={() => void deleteTheme(theme.id)}>Delete</button></article>)}{!themes.length && <p>No themes saved yet.</p>}</div></section>
          <section><h3>Apply to library cards</h3><label>Theme<select value={selectedThemeId} onChange={(event) => setSelectedThemeId(event.target.value)}><option value="">Choose a theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><label>Search books<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, or series" /></label><div className="card-theme-library-select-actions"><button type="button" onClick={() => setSelectedBookIds(filteredBooks.map((book) => book.id))}>Select shown</button><button type="button" onClick={() => setSelectedBookIds([])}>Clear</button></div><div className="card-theme-library-books">{filteredBooks.map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author || 'Unknown author'}{book.series ? ` · ${book.series}` : ''}</small></span></label>)}{!filteredBooks.length && <p>No books match this search.</p>}</div><button type="button" className="is-primary" disabled={!selectedTheme || !selectedBookIds.length || applying} onClick={() => void applySelected()}>{applying ? 'Applying…' : `Apply to Selected (${selectedBookIds.length})`}</button></section>
        </div>{status && <footer>{status}</footer>}
      </section>
    </div>}
  </>;
}

function start() {
  document.getElementById('card-theme-manager-runtime')?.remove();
  document.getElementById('card-theme-library-runtime')?.remove();
  const host = document.createElement('div');
  host.id = 'card-theme-library-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><CardThemeLibrary /></StrictMode>);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
