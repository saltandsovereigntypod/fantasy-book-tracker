import { useMemo, useState } from 'react';
import type { V2ArchiveState } from './archive';
import type { SuspicionRecord, SuspicionStatus, TheoryRecord, TheoryStatus } from './domain';
import './investigation-module.css';

type Mode = 'theories' | 'suspicions';

function now() { return new Date().toISOString(); }

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
      const theory: TheoryRecord = { id: crypto.randomUUID(), title: title.trim(), statement: body.trim(), status: 'open', confidence, bookIds, evidence: [], createdAt: timestamp, updatedAt: timestamp };
      await onSave({ ...archive, theories: [theory, ...archive.theories] });
    } else {
      const suspicion: SuspicionRecord = { id: crypto.randomUUID(), title: title.trim(), details: body.trim(), status: 'open', confidence, bookIds, evidence: [], createdAt: timestamp, updatedAt: timestamp };
      await onSave({ ...archive, suspicions: [suspicion, ...archive.suspicions] });
    }
    resetForm();
  }

  async function updateTheory(id: string, changes: Partial<TheoryRecord>) {
    await onSave({ ...archive, theories: archive.theories.map((item) => item.id === id ? { ...item, ...changes, updatedAt: now() } : item) });
  }

  async function updateSuspicion(id: string, changes: Partial<SuspicionRecord>) {
    await onSave({ ...archive, suspicions: archive.suspicions.map((item) => item.id === id ? { ...item, ...changes, updatedAt: now() } : item) });
  }

  async function addEvidence(kind: Mode, id: string) {
    const text = window.prompt('Add evidence or a supporting note');
    if (!text?.trim()) return;
    const evidence = { id: crypto.randomUUID(), text: text.trim(), createdAt: now() };
    if (kind === 'theories') {
      const item = archive.theories.find((record) => record.id === id);
      if (item) await updateTheory(id, { evidence: [...item.evidence, evidence] });
    } else {
      const item = archive.suspicions.find((record) => record.id === id);
      if (item) await updateSuspicion(id, { evidence: [...item.evidence, evidence] });
    }
  }

  async function removeRecord(kind: Mode, id: string, label: string) {
    if (!window.confirm(`Delete “${label}”?`)) return;
    if (kind === 'theories') await onSave({ ...archive, theories: archive.theories.filter((item) => item.id !== id) });
    else await onSave({ ...archive, suspicions: archive.suspicions.filter((item) => item.id !== id) });
  }

  const items = mode === 'theories' ? theoryItems : suspicionItems;

  return <div className="investigation-module">
    <header className="investigation-header">
      <div><p>Investigation Desk</p><h2>Theories & Suspicions</h2><span>Track ideas, connect books, and preserve the evidence before the plot proves you right.</span></div>
      <div className="investigation-tabs"><button className={mode === 'theories' ? 'is-active' : ''} onClick={() => setMode('theories')}>Theories <strong>{archive.theories.length}</strong></button><button className={mode === 'suspicions' ? 'is-active' : ''} onClick={() => setMode('suspicions')}>Suspicions <strong>{archive.suspicions.length}</strong></button></div>
    </header>

    <div className="investigation-layout">
      <form className="investigation-form" onSubmit={createRecord}>
        <h3>New {mode === 'theories' ? 'theory' : 'suspicion'}</h3>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === 'theories' ? 'Violet’s second signet is…' : 'Something is wrong with…'} required /></label>
        <label>{mode === 'theories' ? 'Theory' : 'Details'}<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} /></label>
        <label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
        <fieldset><legend>Linked books</legend>{archive.books.length ? archive.books.map((book) => <label key={book.id} className="investigation-book-option"><input type="checkbox" checked={bookIds.includes(book.id)} onChange={() => setBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} />{book.title}</label>) : <p>Add books to the Library before linking them.</p>}</fieldset>
        <button type="submit">Create {mode === 'theories' ? 'Theory' : 'Suspicion'}</button>
      </form>

      <section className="investigation-list">
        <div className="investigation-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${mode}`} /><span>{items.length} shown</span></div>
        {mode === 'theories' ? theoryItems.map((item) => <TheoryCard key={item.id} item={item} archive={archive} onUpdate={updateTheory} onEvidence={() => addEvidence('theories', item.id)} onDelete={() => removeRecord('theories', item.id, item.title)} />) : suspicionItems.map((item) => <SuspicionCard key={item.id} item={item} archive={archive} onUpdate={updateSuspicion} onEvidence={() => addEvidence('suspicions', item.id)} onDelete={() => removeRecord('suspicions', item.id, item.title)} />)}
        {!items.length && <div className="investigation-empty"><span>⌁</span><h3>No {mode} yet</h3><p>Start with the thought you cannot stop circling back to.</p></div>}
      </section>
    </div>
  </div>;
}

function TheoryCard({ item, archive, onUpdate, onEvidence, onDelete }: { item: TheoryRecord; archive: V2ArchiveState; onUpdate: (id: string, changes: Partial<TheoryRecord>) => Promise<void>; onEvidence: () => void; onDelete: () => void }) {
  return <article className="investigation-card"><header><div><span>Theory</span><h3>{item.title}</h3></div><select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as TheoryStatus })}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></select></header><p>{item.statement || 'No theory statement added yet.'}</p><Confidence value={item.confidence} onChange={(value) => onUpdate(item.id, { confidence: value })} /><LinkedBooks ids={item.bookIds} archive={archive} /><EvidenceList evidence={item.evidence} /><footer><button onClick={onEvidence}>Add Evidence</button><button className="is-danger" onClick={onDelete}>Delete</button></footer></article>;
}

function SuspicionCard({ item, archive, onUpdate, onEvidence, onDelete }: { item: SuspicionRecord; archive: V2ArchiveState; onUpdate: (id: string, changes: Partial<SuspicionRecord>) => Promise<void>; onEvidence: () => void; onDelete: () => void }) {
  return <article className="investigation-card"><header><div><span>Suspicion</span><h3>{item.title}</h3></div><select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as SuspicionStatus })}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></header><p>{item.details || 'No details added yet.'}</p><Confidence value={item.confidence} onChange={(value) => onUpdate(item.id, { confidence: value })} /><LinkedBooks ids={item.bookIds} archive={archive} /><EvidenceList evidence={item.evidence} /><footer><button onClick={onEvidence}>Add Evidence</button><button className="is-danger" onClick={onDelete}>Delete</button></footer></article>;
}

function Confidence({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <label className="investigation-confidence"><span>Confidence</span><input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} /><strong>{value}%</strong></label>; }
function LinkedBooks({ ids, archive }: { ids: string[]; archive: V2ArchiveState }) { const books = ids.map((id) => archive.books.find((book) => book.id === id)).filter(Boolean); return books.length ? <div className="investigation-links">{books.map((book) => <span key={book!.id}>{book!.title}</span>)}</div> : null; }
function EvidenceList({ evidence }: { evidence: Array<{ id: string; text: string }> }) { return evidence.length ? <div className="investigation-evidence"><strong>Evidence</strong>{evidence.map((item) => <p key={item.id}>{item.text}</p>)}</div> : null; }
