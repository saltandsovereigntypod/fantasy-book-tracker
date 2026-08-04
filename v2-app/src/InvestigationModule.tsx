import { useMemo, useState } from 'react';
import type { V2ArchiveState, V2BookRecord } from './archive';
import type { InvestigationRevision, SuspicionRecord, SuspicionStatus, TheoryRecord, TheoryStatus } from './domain';
import './investigation-module.css';

type Mode = 'theories' | 'suspicions';
type RecordItem = TheoryRecord | SuspicionRecord;
type RecordStatus = TheoryStatus | SuspicionStatus;

function now() { return new Date().toISOString(); }
function bodyOf(item: RecordItem) { return 'statement' in item ? item.statement : item.details; }
function revisionOf(item: RecordItem): InvestigationRevision {
  return { id: crypto.randomUUID(), editedAt: now(), title: item.title, body: bodyOf(item), confidence: item.confidence, status: item.status, bookIds: [...item.bookIds] };
}

export function InvestigationModule({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('theories');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confidence, setConfidence] = useState(50);
  const [bookIds, setBookIds] = useState<string[]>([]);

  const normalizedQuery = query.trim().toLowerCase();
  const theoryItems = useMemo(() => archive.theories.filter((item) => !normalizedQuery || `${item.title} ${item.statement}`.toLowerCase().includes(normalizedQuery)), [archive.theories, normalizedQuery]);
  const suspicionItems = useMemo(() => archive.suspicions.filter((item) => !normalizedQuery || `${item.title} ${item.details}`.toLowerCase().includes(normalizedQuery)), [archive.suspicions, normalizedQuery]);

  function resetForm() { setTitle(''); setBody(''); setConfidence(50); setBookIds([]); }

  async function createRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const timestamp = now();
    if (mode === 'theories') {
      const theory: TheoryRecord = { id: crypto.randomUUID(), title: title.trim(), statement: body.trim(), status: 'open', confidence, bookIds, evidence: [], history: [], createdAt: timestamp, updatedAt: timestamp };
      await onSave({ ...archive, theories: [theory, ...archive.theories] });
    } else {
      const suspicion: SuspicionRecord = { id: crypto.randomUUID(), title: title.trim(), details: body.trim(), status: 'open', confidence, bookIds, evidence: [], history: [], createdAt: timestamp, updatedAt: timestamp };
      await onSave({ ...archive, suspicions: [suspicion, ...archive.suspicions] });
    }
    resetForm();
  }

  async function saveTheory(original: TheoryRecord, changes: Partial<TheoryRecord>) {
    await onSave({ ...archive, theories: archive.theories.map((item) => item.id === original.id ? { ...item, ...changes, history: [revisionOf(original), ...(item.history ?? [])], updatedAt: now() } : item) });
  }
  async function saveSuspicion(original: SuspicionRecord, changes: Partial<SuspicionRecord>) {
    await onSave({ ...archive, suspicions: archive.suspicions.map((item) => item.id === original.id ? { ...item, ...changes, history: [revisionOf(original), ...(item.history ?? [])], updatedAt: now() } : item) });
  }
  async function addEvidence(kind: Mode, id: string) {
    const text = window.prompt('Add evidence or a supporting note');
    if (!text?.trim()) return;
    const evidence = { id: crypto.randomUUID(), text: text.trim(), createdAt: now() };
    if (kind === 'theories') {
      const item = archive.theories.find((record) => record.id === id);
      if (item) await saveTheory(item, { evidence: [...item.evidence, evidence] });
    } else {
      const item = archive.suspicions.find((record) => record.id === id);
      if (item) await saveSuspicion(item, { evidence: [...item.evidence, evidence] });
    }
  }
  async function removeRecord(kind: Mode, id: string, label: string) {
    if (!window.confirm(`Delete “${label}”?`)) return;
    if (kind === 'theories') await onSave({ ...archive, theories: archive.theories.filter((item) => item.id !== id) });
    else await onSave({ ...archive, suspicions: archive.suspicions.filter((item) => item.id !== id) });
  }

  const items = mode === 'theories' ? theoryItems : suspicionItems;
  return <div className="investigation-module">
    <header className="investigation-header"><div><p>Investigation Desk</p><h2>Theories & Suspicions</h2><span>Track ideas, connect books, and preserve the evidence before the plot proves you right.</span></div><div className="investigation-tabs"><button className={mode === 'theories' ? 'is-active' : ''} onClick={() => setMode('theories')}>Theories <strong>{archive.theories.length}</strong></button><button className={mode === 'suspicions' ? 'is-active' : ''} onClick={() => setMode('suspicions')}>Suspicions <strong>{archive.suspicions.length}</strong></button></div></header>
    <div className="investigation-layout">
      <form className="investigation-form" onSubmit={createRecord}>
        <h3>New {mode === 'theories' ? 'theory' : 'suspicion'}</h3>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === 'theories' ? 'Violet’s second signet is…' : 'Something is wrong with…'} required /></label>
        <label>{mode === 'theories' ? 'Theory' : 'Details'}<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} /></label>
        <label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
        <BookPicker books={archive.books} selectedIds={bookIds} onChange={setBookIds} />
        <button type="submit">Create {mode === 'theories' ? 'Theory' : 'Suspicion'}</button>
      </form>
      <section className="investigation-list">
        <div className="investigation-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${mode}`} /><span>{items.length} shown</span></div>
        {mode === 'theories' ? theoryItems.map((item) => <InvestigationCard key={item.id} kind="theories" item={item} books={archive.books} onSave={(changes) => saveTheory(item, changes as Partial<TheoryRecord>)} onEvidence={() => addEvidence('theories', item.id)} onDelete={() => removeRecord('theories', item.id, item.title)} />) : suspicionItems.map((item) => <InvestigationCard key={item.id} kind="suspicions" item={item} books={archive.books} onSave={(changes) => saveSuspicion(item, changes as Partial<SuspicionRecord>)} onEvidence={() => addEvidence('suspicions', item.id)} onDelete={() => removeRecord('suspicions', item.id, item.title)} />)}
        {!items.length && <div className="investigation-empty"><span>⌁</span><h3>No {mode} yet</h3><p>Start with the thought you cannot stop circling back to.</p></div>}
      </section>
    </div>
  </div>;
}

function BookPicker({ books, selectedIds, onChange }: { books: V2BookRecord[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const matches = books.filter((book) => !selectedIds.includes(book.id) && `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12);
  return <div className="investigation-book-picker"><label>Linked books<input value={search} onFocus={() => setOpen(true)} onChange={(event) => { setSearch(event.target.value); setOpen(true); }} placeholder="Search your library…" /></label>{open && <div className="investigation-book-menu">{matches.length ? matches.map((book) => <button type="button" key={book.id} onClick={() => { onChange([...selectedIds, book.id]); setSearch(''); setOpen(false); }}><strong>{book.title}</strong><span>{book.author || book.series || 'Book'}</span></button>) : <p>No matching books</p>}</div>}<div className="investigation-selected-books">{selectedIds.map((id) => { const book = books.find((item) => item.id === id); return book ? <button type="button" key={id} onClick={() => onChange(selectedIds.filter((item) => item !== id))}>{book.title} ×</button> : null; })}</div></div>;
}

function InvestigationCard({ kind, item, books, onSave, onEvidence, onDelete }: { kind: Mode; item: RecordItem; books: V2BookRecord[]; onSave: (changes: Partial<RecordItem>) => Promise<void>; onEvidence: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(bodyOf(item));
  const [confidence, setConfidence] = useState(item.confidence);
  const [status, setStatus] = useState<RecordStatus>(item.status);
  const [bookIds, setBookIds] = useState([...item.bookIds]);

  function reset() { setTitle(item.title); setBody(bodyOf(item)); setConfidence(item.confidence); setStatus(item.status); setBookIds([...item.bookIds]); setEditing(false); }
  async function commit() {
    const changes = kind === 'theories' ? { title: title.trim(), statement: body.trim(), confidence, status: status as TheoryStatus, bookIds } : { title: title.trim(), details: body.trim(), confidence, status: status as SuspicionStatus, bookIds };
    await onSave(changes);
    setEditing(false);
  }

  return <article className="investigation-card">
    {editing ? <div className="investigation-edit-form"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>{kind === 'theories' ? 'Theory' : 'Details'}<textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} /></label><label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as RecordStatus)}>{kind === 'theories' ? <><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></> : <><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></>}</select></label><BookPicker books={books} selectedIds={bookIds} onChange={setBookIds} /><div className="investigation-edit-actions"><button onClick={commit}>Save changes</button><button onClick={reset}>Cancel</button></div></div> : <><header><div><span>{kind === 'theories' ? 'Theory' : 'Suspicion'}</span><h3>{item.title}</h3></div><select value={item.status} onChange={(event) => onSave({ status: event.target.value as RecordStatus })}>{kind === 'theories' ? <><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></> : <><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></>}</select></header><p>{bodyOf(item) || `No ${kind === 'theories' ? 'theory statement' : 'details'} added yet.`}</p><label className="investigation-confidence"><span>Confidence</span><input type="range" min="0" max="100" value={item.confidence} onChange={(event) => onSave({ confidence: Number(event.target.value) })} /><strong>{item.confidence}%</strong></label><LinkedBooks ids={item.bookIds} books={books} /><EvidenceList evidence={item.evidence} /><footer><button onClick={() => setEditing(true)}>Edit</button><button onClick={onEvidence}>Add Evidence</button><button onClick={() => setShowHistory((value) => !value)}>History ({item.history.length})</button><button className="is-danger" onClick={onDelete}>Delete</button></footer>{showHistory && <HistoryList history={item.history} />}</>}
  </article>;
}

function LinkedBooks({ ids, books }: { ids: string[]; books: V2BookRecord[] }) { const linked = ids.map((id) => books.find((book) => book.id === id)).filter(Boolean); return linked.length ? <div className="investigation-links">{linked.map((book) => <span key={book!.id}>{book!.title}</span>)}</div> : null; }
function EvidenceList({ evidence }: { evidence: Array<{ id: string; text: string }> }) { return evidence.length ? <div className="investigation-evidence"><strong>Evidence</strong>{evidence.map((item) => <p key={item.id}>{item.text}</p>)}</div> : null; }
function HistoryList({ history }: { history: InvestigationRevision[] }) { return <div className="investigation-history"><strong>Edit history</strong>{history.length ? history.map((revision) => <details key={revision.id}><summary>{new Date(revision.editedAt).toLocaleString()} · {revision.title}</summary><p>{revision.body || 'No body text'}</p><small>{revision.confidence}% confidence · {revision.status} · {revision.bookIds.length} linked books</small></details>) : <p>No previous versions yet.</p>}</div>; }
