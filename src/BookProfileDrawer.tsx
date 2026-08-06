import { useEffect, useState } from 'react';
import type { V2ArchiveState, V2BookRecord } from './archive';
import type { ReadingStatus } from './domain';
import './book-profile-editor.css';

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export function BookProfileDrawer({
  book,
  archive,
  onClose,
  onEdit,
  onDelete,
  onSave,
}: {
  book: V2BookRecord;
  archive: V2ArchiveState;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (book: V2BookRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState(book);
  const [editingDetails, setEditingDetails] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(book); }, [book]);

  const relationshipNames = draft.relationships.map((relationship) => archive.books.find((item) => item.id === relationship.targetBookId)?.title || 'Missing book');

  async function commit(next: V2BookRecord) {
    setSaving(true);
    try {
      const stamped = { ...next, updatedAt: new Date().toISOString() };
      setDraft(stamped);
      await onSave(stamped);
    } finally {
      setSaving(false);
    }
  }

  async function saveDetails() {
    await commit(draft);
    setEditingDetails(false);
  }

  async function addNote() {
    const text = noteText.trim();
    if (!text) return;
    const now = new Date().toISOString();
    await commit({ ...draft, notes: [...draft.notes, { id: crypto.randomUUID(), text, createdAt: now, updatedAt: now }] });
    setNoteText('');
  }

  async function deleteNote(id: string) {
    await commit({ ...draft, notes: draft.notes.filter((note) => note.id !== id) });
  }

  async function startSession() {
    const now = new Date().toISOString();
    await commit({
      ...draft,
      status: 'reading',
      readingSessions: [...draft.readingSessions, { id: crypto.randomUUID(), startedAt: now, startProgress: draft.progress, endProgress: draft.progress, notes: sessionNotes.trim() || undefined }],
    });
    setSessionNotes('');
  }

  async function completeCurrentSession() {
    const current = [...draft.readingSessions].reverse().find((session) => !session.completedAt);
    if (!current) return;
    const now = new Date().toISOString();
    await commit({
      ...draft,
      status: draft.progress >= 100 ? 'completed' : draft.status,
      readingSessions: draft.readingSessions.map((session) => session.id === current.id ? { ...session, completedAt: now, endProgress: draft.progress } : session),
    });
  }

  async function toggleFavorite() { await commit({ ...draft, favorite: !draft.favorite }); }
  async function toggleArchive() { await commit({ ...draft, archived: !draft.archived }); }

  return <div className="v2-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="v2-book-drawer" aria-label={`${draft.title} profile`}>
      <header><div><p>Book Profile</p><h2>{draft.title}</h2><span>{draft.author || 'Unknown author'}{draft.series ? ` · ${draft.series}` : ''}</span></div><button onClick={onClose} aria-label="Close profile">×</button></header>
      <div className="v2-book-drawer__actions">
        <button onClick={onEdit}>Edit Book & Card</button>
        <button onClick={toggleFavorite}>{draft.favorite ? '★ Favorited' : '☆ Favorite'}</button>
        <button onClick={toggleArchive}>{draft.archived ? 'Restore' : 'Archive'}</button>
        <button className="is-danger" onClick={onDelete}>Delete</button>
      </div>

      <section className="v2-book-drawer__metrics">
        <span><small>Status</small><strong>{draft.status}</strong></span><span><small>Progress</small><strong>{draft.progress}%</strong></span><span><small>Overall</small><strong>{draft.rating} / 5</strong></span><span><small>Spice</small><strong>{draft.spice} / 5</strong></span><span><small>Impact</small><strong>{draft.impact} / 5</strong></span>
      </section>

      <section>
        <div className="v2-section-heading"><h3>Book Details</h3><button onClick={() => setEditingDetails((value) => !value)}>{editingDetails ? 'Cancel' : 'Edit'}</button></div>
        {editingDetails ? <div className="v2-profile-form">
          <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReadingStatus })}><option value="want">Want to read</option><option value="reading">Currently reading</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="dnf">DNF</option></select></label>
          <label>Progress<input type="number" min="0" max="100" value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></label>
          <label>About<textarea value={draft.about} onChange={(event) => setDraft({ ...draft, about: event.target.value })} /></label>
          <label>Summary<textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
          <label>Genres<input value={draft.genres.join(', ')} onChange={(event) => setDraft({ ...draft, genres: splitList(event.target.value) })} placeholder="Fantasy, Romance" /></label>
          <label>Tags<input value={draft.tags.join(', ')} onChange={(event) => setDraft({ ...draft, tags: splitList(event.target.value) })} placeholder="dragons, enemies to lovers" /></label>
          <button onClick={saveDetails} disabled={saving}>{saving ? 'Saving…' : 'Save Details'}</button>
        </div> : <><h4>About</h4><p>{draft.about || 'No about section has been added yet.'}</p><h4>Summary</h4><p>{draft.summary || 'No summary has been added yet.'}</p><div className="v2-profile-chips">{[...draft.genres, ...draft.tags].map((value) => <span key={value}>{value}</span>)}{!draft.genres.length && !draft.tags.length && <p>No genres or tags yet.</p>}</div></>}
      </section>

      <section>
        <div className="v2-section-heading"><h3>Reading History</h3><span>{draft.readingSessions.length} sessions</span></div>
        <div className="v2-inline-form"><input value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} placeholder="Optional session note" /><button onClick={startSession}>Start Session</button><button onClick={completeCurrentSession}>Complete Current</button></div>
        {draft.readingSessions.length ? [...draft.readingSessions].reverse().map((session) => <article key={session.id}><strong>{new Date(session.startedAt).toLocaleString()}</strong><p>{session.startProgress}% → {session.endProgress}%{session.completedAt ? ` · completed ${new Date(session.completedAt).toLocaleString()}` : ' · active'}</p>{session.notes && <small>{session.notes}</small>}</article>) : <p>No reading sessions recorded yet.</p>}
      </section>

      <section>
        <div className="v2-section-heading"><h3>Notes</h3><span>{draft.notes.length}</span></div>
        <div className="v2-inline-form"><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a personal note" /><button onClick={addNote}>Add Note</button></div>
        {draft.notes.length ? draft.notes.map((note) => <article key={note.id}><p>{note.text}</p><small>{new Date(note.updatedAt).toLocaleString()}</small><button className="v2-note-delete" onClick={() => deleteNote(note.id)}>Delete</button></article>) : <p>No personal notes yet.</p>}
      </section>

      <section><h3>Investigation Connections</h3><ul><li>{draft.theoryIds.length} linked theories</li><li>{draft.suspicionIds.length} linked suspicions</li><li>{draft.wallCardIds.length} Wall connections</li><li>{draft.mindMapNodeIds.length} Mind Map nodes</li><li>{relationshipNames.length} book relationships{relationshipNames.length ? `: ${relationshipNames.join(', ')}` : ''}</li></ul></section>
    </aside>
  </div>;
}
