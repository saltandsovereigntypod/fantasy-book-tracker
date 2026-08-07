import { useMemo, useState } from 'react';
import type { V2ArchiveState, V2BookRecord } from './archive';
import type {
  EvidenceNote,
  InvestigationRevision,
  SuspicionRecord,
  SuspicionSeverity,
  SuspicionSignal,
  SuspicionSignalKind,
  SuspicionStatus,
  TheoryRecord,
  TheoryStatus,
} from './domain';
import './investigation-module.css';

type Mode = 'theories' | 'suspicions';
type EvidenceTarget = { id: string; title: string } | null;
type SignalTarget = { id: string; subject: string } | null;

const SEVERITY_CONFIDENCE: Record<SuspicionSeverity, number> = {
  low: 25,
  guarded: 50,
  high: 75,
  critical: 100,
};

const SIGNAL_LABELS: Record<SuspicionSignalKind, string> = {
  clue: 'Clue',
  behavior: 'Behavior',
  contradiction: 'Contradiction',
  pattern: 'Pattern',
};

function now() { return new Date().toISOString(); }
function suspicionSubject(item: SuspicionRecord) { return String(item.subject || item.title || '').trim(); }
function suspicionConcern(item: SuspicionRecord) { return String(item.concern || item.details || '').trim(); }
function suspicionSeverity(item: SuspicionRecord): SuspicionSeverity {
  if (item.severity === 'low' || item.severity === 'guarded' || item.severity === 'high' || item.severity === 'critical') return item.severity;
  const confidence = Number(item.confidence) || 0;
  if (confidence >= 88) return 'critical';
  if (confidence >= 63) return 'high';
  if (confidence >= 38) return 'guarded';
  return 'low';
}
function suspicionSignals(item: SuspicionRecord): SuspicionSignal[] {
  if (Array.isArray(item.signals) && item.signals.length) return item.signals.map((signal) => ({ ...signal }));
  return (item.evidence ?? []).map((entry) => ({ ...entry, kind: 'clue' as const }));
}
function plainEvidence(signals: SuspicionSignal[]): EvidenceNote[] {
  return signals.map(({ kind: _kind, ...entry }) => entry);
}
function revisionOfTheory(item: TheoryRecord): InvestigationRevision {
  return { id: crypto.randomUUID(), editedAt: now(), title: item.title, body: item.statement, confidence: item.confidence, status: item.status, bookIds: [...item.bookIds] };
}
function revisionOfSuspicion(item: SuspicionRecord): InvestigationRevision {
  const severity = suspicionSeverity(item);
  return { id: crypto.randomUUID(), editedAt: now(), title: suspicionSubject(item), body: suspicionConcern(item), confidence: SEVERITY_CONFIDENCE[severity], status: item.status, bookIds: [...item.bookIds], severity };
}
function synchronizedSuspicion(item: SuspicionRecord, changes: Partial<SuspicionRecord>): SuspicionRecord {
  const merged = { ...item, ...changes };
  const subject = String(changes.subject ?? merged.subject ?? merged.title ?? '').trim();
  const concern = String(changes.concern ?? merged.concern ?? merged.details ?? '').trim();
  const severity = changes.severity ?? suspicionSeverity(merged);
  const signals = changes.signals ? changes.signals.map((signal) => ({ ...signal })) : suspicionSignals(merged);
  return {
    ...merged,
    subject,
    concern,
    severity,
    signals,
    title: subject,
    details: concern,
    confidence: SEVERITY_CONFIDENCE[severity],
    evidence: plainEvidence(signals),
  };
}

export function InvestigationModule({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('theories');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confidence, setConfidence] = useState(50);
  const [severity, setSeverity] = useState<SuspicionSeverity>('guarded');
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceTarget>(null);
  const [signalTarget, setSignalTarget] = useState<SignalTarget>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const theoryItems = useMemo(() => archive.theories.filter((item) => !normalizedQuery || `${item.title} ${item.statement} ${(item.evidence ?? []).map((entry) => entry.text).join(' ')}`.toLowerCase().includes(normalizedQuery)), [archive.theories, normalizedQuery]);
  const suspicionItems = useMemo(() => archive.suspicions.filter((item) => !normalizedQuery || `${suspicionSubject(item)} ${suspicionConcern(item)} ${suspicionSignals(item).map((signal) => signal.text).join(' ')}`.toLowerCase().includes(normalizedQuery)), [archive.suspicions, normalizedQuery]);

  function resetForm() { setTitle(''); setBody(''); setConfidence(50); setSeverity('guarded'); setBookIds([]); }

  async function createRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const timestamp = now();
    if (mode === 'theories') {
      const theory: TheoryRecord = { id: crypto.randomUUID(), title: title.trim(), statement: body.trim(), status: 'open', confidence, bookIds, evidence: [], history: [], createdAt: timestamp, updatedAt: timestamp };
      await onSave({ ...archive, theories: [theory, ...archive.theories] });
    } else {
      const subject = title.trim();
      const concern = body.trim();
      const suspicion: SuspicionRecord = {
        id: crypto.randomUUID(),
        subject,
        concern,
        severity,
        signals: [],
        status: 'open',
        bookIds,
        history: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        title: subject,
        details: concern,
        confidence: SEVERITY_CONFIDENCE[severity],
        evidence: [],
      };
      await onSave({ ...archive, suspicions: [suspicion, ...archive.suspicions] });
    }
    resetForm();
  }

  async function saveTheory(original: TheoryRecord, changes: Partial<TheoryRecord>) {
    await onSave({ ...archive, theories: archive.theories.map((item) => item.id === original.id ? { ...item, ...changes, history: [revisionOfTheory(original), ...(item.history ?? [])], updatedAt: now() } : item) });
  }
  async function saveSuspicion(original: SuspicionRecord, changes: Partial<SuspicionRecord>) {
    const next = synchronizedSuspicion(original, changes);
    await onSave({ ...archive, suspicions: archive.suspicions.map((item) => item.id === original.id ? { ...next, history: [revisionOfSuspicion(original), ...(item.history ?? [])], updatedAt: now() } : item) });
  }
  async function addEvidence(target: NonNullable<EvidenceTarget>, text: string) {
    const item = archive.theories.find((record) => record.id === target.id);
    if (item) {
      const evidence: EvidenceNote = { id: crypto.randomUUID(), text: text.trim(), createdAt: now() };
      await saveTheory(item, { evidence: [...(item.evidence ?? []), evidence] });
    }
    setEvidenceTarget(null);
  }
  async function addSignal(target: NonNullable<SignalTarget>, kind: SuspicionSignalKind, text: string) {
    const item = archive.suspicions.find((record) => record.id === target.id);
    if (item) {
      const signal: SuspicionSignal = { id: crypto.randomUUID(), kind, text: text.trim(), createdAt: now() };
      await saveSuspicion(item, { signals: [...suspicionSignals(item), signal] });
    }
    setSignalTarget(null);
  }
  async function removeRecord(kind: Mode, id: string, label: string) {
    if (!window.confirm(`Delete “${label}”?`)) return;
    if (kind === 'theories') await onSave({ ...archive, theories: archive.theories.filter((item) => item.id !== id) });
    else await onSave({ ...archive, suspicions: archive.suspicions.filter((item) => item.id !== id) });
  }

  const items = mode === 'theories' ? theoryItems : suspicionItems;
  return <div className="investigation-module">
    <header className="investigation-header"><div><p>Investigation Desk</p><h2>Theories & Suspicions</h2><span>Theories explain what you think is true. Suspicions flag who or what deserves scrutiny.</span></div><div className="investigation-tabs"><button className={mode === 'theories' ? 'is-active' : ''} onClick={() => setMode('theories')}>Theories <strong>{archive.theories.length}</strong></button><button className={mode === 'suspicions' ? 'is-active' : ''} onClick={() => setMode('suspicions')}>Suspicions <strong>{archive.suspicions.length}</strong></button></div></header>
    <div className="investigation-layout">
      <form className="investigation-form" onSubmit={createRecord}>
        <h3>New {mode === 'theories' ? 'theory' : 'suspicion'}</h3>
        <label>{mode === 'theories' ? 'Title' : 'Subject'}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === 'theories' ? 'Violet’s second signet is…' : 'Person, faction, object, or event…'} required /></label>
        <label>{mode === 'theories' ? 'Theory' : 'Concern'}<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder={mode === 'theories' ? 'State the explanation you think the story will prove.' : 'What feels wrong, risky, deceptive, or unresolved?'} /></label>
        {mode === 'theories' ? <label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label> : <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as SuspicionSeverity)}><option value="low">Low</option><option value="guarded">Guarded</option><option value="high">High</option><option value="critical">Critical</option></select></label>}
        <BookPicker books={archive.books} selectedIds={bookIds} onChange={setBookIds} />
        <button type="submit">Create {mode === 'theories' ? 'Theory' : 'Suspicion'}</button>
      </form>
      <section className="investigation-list">
        <div className="investigation-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${mode}`} /><span>{items.length} shown</span></div>
        {mode === 'theories' ? theoryItems.map((item) => <TheoryCard key={item.id} item={item} books={archive.books} onSave={(changes) => saveTheory(item, changes)} onEvidence={() => setEvidenceTarget({ id: item.id, title: item.title })} onDelete={() => removeRecord('theories', item.id, item.title)} />) : suspicionItems.map((item) => <SuspicionCard key={item.id} item={item} books={archive.books} onSave={(changes) => saveSuspicion(item, changes)} onSignal={() => setSignalTarget({ id: item.id, subject: suspicionSubject(item) })} onDelete={() => removeRecord('suspicions', item.id, suspicionSubject(item))} />)}
        {!items.length && <div className="investigation-empty"><span>⌁</span><h3>No {mode} yet</h3><p>{mode === 'theories' ? 'Start with the explanation you cannot stop circling back to.' : 'Flag the person, place, object, or event that deserves a closer look.'}</p></div>}
      </section>
    </div>
    {evidenceTarget && <EvidenceModal target={evidenceTarget} onClose={() => setEvidenceTarget(null)} onSave={(text) => addEvidence(evidenceTarget, text)} />}
    {signalTarget && <SignalModal target={signalTarget} onClose={() => setSignalTarget(null)} onSave={(kind, text) => addSignal(signalTarget, kind, text)} />}
  </div>;
}

function EvidenceModal({ target, onClose, onSave }: { target: NonNullable<EvidenceTarget>; onClose: () => void; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!text.trim()) return; setSaving(true); try { await onSave(text); } finally { setSaving(false); } }
  return <div className="investigation-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="investigation-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title"><header><div><p>Evidence entry</p><h3 id="evidence-modal-title">Add evidence</h3><span>{target.title}</span></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><label>Evidence or supporting note<textarea autoFocus rows={6} value={text} onChange={(event) => setText(event.target.value)} placeholder="Record the quote, clue, page reference, or reasoning that supports this theory…" /></label><footer><button type="button" onClick={onClose}>Cancel</button><button className="is-primary" disabled={!text.trim() || saving}>{saving ? 'Saving…' : 'Add evidence'}</button></footer></form></div>;
}

function SignalModal({ target, onClose, onSave }: { target: NonNullable<SignalTarget>; onClose: () => void; onSave: (kind: SuspicionSignalKind, text: string) => Promise<void> }) {
  const [kind, setKind] = useState<SuspicionSignalKind>('clue');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!text.trim()) return; setSaving(true); try { await onSave(kind, text); } finally { setSaving(false); } }
  return <div className="investigation-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="investigation-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="signal-modal-title"><header><div><p>Suspicion signal</p><h3 id="signal-modal-title">Add a signal</h3><span>{target.subject}</span></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><label>Signal type<select value={kind} onChange={(event) => setKind(event.target.value as SuspicionSignalKind)}>{Object.entries(SIGNAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>What raised the flag?<textarea autoFocus rows={6} value={text} onChange={(event) => setText(event.target.value)} placeholder="Record the clue, behavior, contradiction, or recurring pattern…" /></label><footer><button type="button" onClick={onClose}>Cancel</button><button className="is-primary" disabled={!text.trim() || saving}>{saving ? 'Saving…' : 'Add signal'}</button></footer></form></div>;
}

function BookPicker({ books, selectedIds, onChange }: { books: V2BookRecord[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const matches = books.filter((book) => !selectedIds.includes(book.id) && `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12);
  return <div className="investigation-book-picker"><label>Linked books<input value={search} onFocus={() => setOpen(true)} onChange={(event) => { setSearch(event.target.value); setOpen(true); }} placeholder="Search your library…" /></label>{open && <div className="investigation-book-menu">{matches.length ? matches.map((book) => <button type="button" key={book.id} onClick={() => { onChange([...selectedIds, book.id]); setSearch(''); setOpen(false); }}><strong>{book.title}</strong><span>{book.author || book.series || 'Book'}</span></button>) : <p>No matching books</p>}</div>}<div className="investigation-selected-books">{selectedIds.map((id) => { const book = books.find((item) => item.id === id); return book ? <button type="button" key={id} onClick={() => onChange(selectedIds.filter((item) => item !== id))}>{book.title} ×</button> : null; })}</div></div>;
}

function TheoryCard({ item, books, onSave, onEvidence, onDelete }: { item: TheoryRecord; books: V2BookRecord[]; onSave: (changes: Partial<TheoryRecord>) => Promise<void>; onEvidence: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [statement, setStatement] = useState(item.statement);
  const [confidence, setConfidence] = useState(item.confidence);
  const [status, setStatus] = useState<TheoryStatus>(item.status);
  const [bookIds, setBookIds] = useState([...item.bookIds]);
  const [evidence, setEvidence] = useState<EvidenceNote[]>(() => (item.evidence ?? []).map((entry) => ({ ...entry })));
  function reset() { setTitle(item.title); setStatement(item.statement); setConfidence(item.confidence); setStatus(item.status); setBookIds([...item.bookIds]); setEvidence((item.evidence ?? []).map((entry) => ({ ...entry }))); setEditing(false); }
  async function commit() { await onSave({ title: title.trim(), statement: statement.trim(), confidence, status, bookIds, evidence }); setEditing(false); }
  function addEvidenceRow() { setEvidence((current) => [...current, { id: crypto.randomUUID(), text: '', createdAt: now() }]); }
  return <article className="investigation-card investigation-card--theory">{editing ? <div className="investigation-edit-form"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Theory<textarea rows={5} value={statement} onChange={(event) => setStatement(event.target.value)} /></label><label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as TheoryStatus)}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></select></label><BookPicker books={books} selectedIds={bookIds} onChange={setBookIds} /><section className="investigation-evidence-editor"><header><div><strong>Evidence</strong><span>Edit supporting evidence for this theory.</span></div><button type="button" onClick={addEvidenceRow}>+ Add evidence</button></header>{evidence.length ? evidence.map((entry) => <div className="investigation-evidence-row" key={entry.id}><textarea rows={3} value={entry.text} onChange={(event) => setEvidence((current) => current.map((value) => value.id === entry.id ? { ...value, text: event.target.value } : value))} placeholder="Evidence, quote, clue, or supporting note…" /><button type="button" className="is-danger" onClick={() => setEvidence((current) => current.filter((value) => value.id !== entry.id))}>Remove</button></div>) : <p>No evidence yet.</p>}</section><div className="investigation-edit-actions"><button onClick={commit}>Save changes</button><button onClick={reset}>Cancel</button></div></div> : <><header><div><span>Theory</span><h3>{item.title}</h3></div><select value={item.status} onChange={(event) => onSave({ status: event.target.value as TheoryStatus })}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></select></header><p>{item.statement || 'No theory statement added yet.'}</p><label className="investigation-confidence"><span>Confidence</span><input type="range" min="0" max="100" value={item.confidence} onChange={(event) => onSave({ confidence: Number(event.target.value) })} /><strong>{item.confidence}%</strong></label><LinkedBooks ids={item.bookIds} books={books} /><EvidenceList evidence={item.evidence ?? []} /><footer><button onClick={() => setEditing(true)}>Edit</button><button onClick={onEvidence}>Add Evidence</button><button onClick={() => setShowHistory((value) => !value)}>History ({(item.history ?? []).length})</button><button className="is-danger" onClick={onDelete}>Delete</button></footer>{showHistory && <HistoryList history={item.history ?? []} />}</>}</article>;
}

function SuspicionCard({ item, books, onSave, onSignal, onDelete }: { item: SuspicionRecord; books: V2BookRecord[]; onSave: (changes: Partial<SuspicionRecord>) => Promise<void>; onSignal: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [subject, setSubject] = useState(suspicionSubject(item));
  const [concern, setConcern] = useState(suspicionConcern(item));
  const [severity, setSeverity] = useState<SuspicionSeverity>(suspicionSeverity(item));
  const [status, setStatus] = useState<SuspicionStatus>(item.status);
  const [bookIds, setBookIds] = useState([...item.bookIds]);
  const [signals, setSignals] = useState<SuspicionSignal[]>(() => suspicionSignals(item));
  function reset() { setSubject(suspicionSubject(item)); setConcern(suspicionConcern(item)); setSeverity(suspicionSeverity(item)); setStatus(item.status); setBookIds([...item.bookIds]); setSignals(suspicionSignals(item)); setEditing(false); }
  async function commit() { await onSave({ subject: subject.trim(), concern: concern.trim(), severity, status, bookIds, signals }); setEditing(false); }
  function addSignalRow() { setSignals((current) => [...current, { id: crypto.randomUUID(), kind: 'clue', text: '', createdAt: now() }]); }
  const currentSeverity = suspicionSeverity(item);
  const currentSignals = suspicionSignals(item);
  return <article className={`investigation-card investigation-card--suspicion is-${currentSeverity}`}>{editing ? <div className="investigation-edit-form"><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>Concern<textarea rows={5} value={concern} onChange={(event) => setConcern(event.target.value)} /></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as SuspicionSeverity)}><option value="low">Low</option><option value="guarded">Guarded</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as SuspicionStatus)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><BookPicker books={books} selectedIds={bookIds} onChange={setBookIds} /><section className="investigation-evidence-editor investigation-signal-editor"><header><div><strong>Signals</strong><span>Track what raised the flag, grouped by signal type.</span></div><button type="button" onClick={addSignalRow}>+ Add signal</button></header>{signals.length ? signals.map((signal) => <div className="investigation-evidence-row investigation-signal-row" key={signal.id}><select value={signal.kind} onChange={(event) => setSignals((current) => current.map((value) => value.id === signal.id ? { ...value, kind: event.target.value as SuspicionSignalKind } : value))}>{Object.entries(SIGNAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea rows={3} value={signal.text} onChange={(event) => setSignals((current) => current.map((value) => value.id === signal.id ? { ...value, text: event.target.value } : value))} placeholder="What raised the flag?" /><button type="button" className="is-danger" onClick={() => setSignals((current) => current.filter((value) => value.id !== signal.id))}>Remove</button></div>) : <p>No signals yet.</p>}</section><div className="investigation-edit-actions"><button onClick={commit}>Save changes</button><button onClick={reset}>Cancel</button></div></div> : <><header><div><span>Suspicion · {currentSeverity}</span><h3>{suspicionSubject(item) || 'Unnamed subject'}</h3></div><select value={item.status} onChange={(event) => onSave({ status: event.target.value as SuspicionStatus })}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></header><p>{suspicionConcern(item) || 'No concern recorded yet.'}</p><div className="investigation-suspicion-severity"><span>Severity</span><strong>{currentSeverity}</strong><select aria-label="Suspicion severity" value={currentSeverity} onChange={(event) => onSave({ severity: event.target.value as SuspicionSeverity })}><option value="low">Low</option><option value="guarded">Guarded</option><option value="high">High</option><option value="critical">Critical</option></select></div><LinkedBooks ids={item.bookIds} books={books} /><SignalList signals={currentSignals} /><footer><button onClick={() => setEditing(true)}>Edit</button><button onClick={onSignal}>Add Signal</button><button onClick={() => setShowHistory((value) => !value)}>History ({(item.history ?? []).length})</button><button className="is-danger" onClick={onDelete}>Delete</button></footer>{showHistory && <HistoryList history={item.history ?? []} />}</>}</article>;
}

function LinkedBooks({ ids, books }: { ids: string[]; books: V2BookRecord[] }) { const linked = ids.map((id) => books.find((book) => book.id === id)).filter(Boolean); return linked.length ? <div className="investigation-links">{linked.map((book) => <span key={book!.id}>{book!.title}</span>)}</div> : null; }
function EvidenceList({ evidence }: { evidence: Array<{ id: string; text: string }> }) { return evidence.length ? <div className="investigation-evidence"><strong>Evidence</strong>{evidence.map((item) => <p key={item.id}>{item.text}</p>)}</div> : null; }
function SignalList({ signals }: { signals: SuspicionSignal[] }) { return signals.length ? <div className="investigation-evidence investigation-signals"><strong>Signals</strong>{signals.map((signal) => <p key={signal.id}><span className="investigation-signal-kind">{SIGNAL_LABELS[signal.kind]}</span>{signal.text}</p>)}</div> : null; }
function HistoryList({ history }: { history: InvestigationRevision[] }) { return <div className="investigation-history"><strong>Edit history</strong>{history.length ? history.map((revision) => <details key={revision.id}><summary>{new Date(revision.editedAt).toLocaleString()} · {revision.title}</summary><p>{revision.body || 'No body text'}</p><small>{revision.severity ? `${revision.severity} severity` : `${revision.confidence}% confidence`} · {revision.status} · {revision.bookIds.length} linked books</small></details>) : <p>No previous versions yet.</p>}</div>; }
