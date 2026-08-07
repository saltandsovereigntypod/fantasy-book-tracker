import { useMemo, useState } from 'react';
import type { V2ArchiveState, V2BookRecord } from './archive';
import type {
  EvidenceNote,
  InvestigationChange,
  InvestigationHistoryAction,
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

type Mode = 'theories' | 'suspicions' | 'archive';
type EvidenceTarget = { id: string; title: string } | null;
type SignalTarget = { id: string; subject: string } | null;

const SEVERITY_CONFIDENCE: Record<SuspicionSeverity, number> = { low: 25, guarded: 50, high: 75, critical: 100 };
const SIGNAL_LABELS: Record<SuspicionSignalKind, string> = { clue: 'Clue', behavior: 'Behavior', contradiction: 'Contradiction', pattern: 'Pattern' };
const ACTION_LABELS: Record<InvestigationHistoryAction, string> = {
  created: 'Created',
  updated: 'Updated',
  'evidence-added': 'Evidence added',
  'signal-added': 'Signal added',
  archived: 'Archived',
  restored: 'Restored to active',
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
function plainEvidence(signals: SuspicionSignal[]): EvidenceNote[] { return signals.map(({ kind: _kind, ...entry }) => entry); }
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry)).join(', ') : 'None';
  if (value == null || value === '') return 'None';
  return String(value);
}
function changesBetween(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]): InvestigationChange[] {
  return fields.flatMap((field) => same(before[field], after[field]) ? [] : [{ field, before: valueText(before[field]), after: valueText(after[field]) }]);
}
function theoryRevision(item: TheoryRecord, action: InvestigationHistoryAction, reason: string, changes: InvestigationChange[] = []): InvestigationRevision {
  return { id: crypto.randomUUID(), editedAt: now(), title: item.title, body: item.statement, confidence: item.confidence, status: item.status, bookIds: [...item.bookIds], action, reason: reason.trim(), changes, archived: Boolean(item.archived) };
}
function suspicionRevision(item: SuspicionRecord, action: InvestigationHistoryAction, reason: string, changes: InvestigationChange[] = []): InvestigationRevision {
  const severity = suspicionSeverity(item);
  return { id: crypto.randomUUID(), editedAt: now(), title: suspicionSubject(item), body: suspicionConcern(item), confidence: SEVERITY_CONFIDENCE[severity], status: item.status, bookIds: [...item.bookIds], severity, action, reason: reason.trim(), changes, archived: Boolean(item.archived) };
}
function synchronizedSuspicion(item: SuspicionRecord, changes: Partial<SuspicionRecord>): SuspicionRecord {
  const merged = { ...item, ...changes };
  const subject = String(changes.subject ?? merged.subject ?? merged.title ?? '').trim();
  const concern = String(changes.concern ?? merged.concern ?? merged.details ?? '').trim();
  const severity = changes.severity ?? suspicionSeverity(merged);
  const signals = changes.signals ? changes.signals.map((signal) => ({ ...signal })) : suspicionSignals(merged);
  return { ...merged, subject, concern, severity, signals, title: subject, details: concern, confidence: SEVERITY_CONFIDENCE[severity], evidence: plainEvidence(signals) };
}
function requestReason(label: string): string | null {
  const reason = window.prompt(`Why are you ${label}?`);
  if (reason == null) return null;
  const trimmed = reason.trim();
  if (!trimmed) { window.alert('Please add a reason so this change is preserved in the investigation timeline.'); return null; }
  return trimmed;
}

export function InvestigationModule({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('theories');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const [confidence, setConfidence] = useState(50);
  const [severity, setSeverity] = useState<SuspicionSeverity>('guarded');
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceTarget>(null);
  const [signalTarget, setSignalTarget] = useState<SignalTarget>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const activeTheories = useMemo(() => archive.theories.filter((item) => !item.archived), [archive.theories]);
  const activeSuspicions = useMemo(() => archive.suspicions.filter((item) => !item.archived), [archive.suspicions]);
  const archivedTheories = useMemo(() => archive.theories.filter((item) => item.archived), [archive.theories]);
  const archivedSuspicions = useMemo(() => archive.suspicions.filter((item) => item.archived), [archive.suspicions]);
  const filterTheory = (item: TheoryRecord) => !normalizedQuery || `${item.title} ${item.statement} ${(item.evidence ?? []).map((entry) => entry.text).join(' ')}`.toLowerCase().includes(normalizedQuery);
  const filterSuspicion = (item: SuspicionRecord) => !normalizedQuery || `${suspicionSubject(item)} ${suspicionConcern(item)} ${suspicionSignals(item).map((signal) => signal.text).join(' ')}`.toLowerCase().includes(normalizedQuery);
  const theoryItems = activeTheories.filter(filterTheory);
  const suspicionItems = activeSuspicions.filter(filterSuspicion);
  const archivedTheoryItems = archivedTheories.filter(filterTheory);
  const archivedSuspicionItems = archivedSuspicions.filter(filterSuspicion);
  const archiveCount = archivedTheories.length + archivedSuspicions.length;

  function resetForm() { setTitle(''); setBody(''); setReason(''); setConfidence(50); setSeverity('guarded'); setBookIds([]); }

  async function createRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !reason.trim() || mode === 'archive') return;
    const timestamp = now();
    if (mode === 'theories') {
      let theory: TheoryRecord = { id: crypto.randomUUID(), title: title.trim(), statement: body.trim(), status: 'open', confidence, bookIds, evidence: [], history: [], createdAt: timestamp, updatedAt: timestamp, archived: false };
      theory = { ...theory, history: [theoryRevision(theory, 'created', reason, [{ field: 'theory', before: 'None', after: theory.statement || theory.title }])] };
      await onSave({ ...archive, theories: [theory, ...archive.theories] });
    } else {
      const subject = title.trim();
      const concern = body.trim();
      let suspicion: SuspicionRecord = { id: crypto.randomUUID(), subject, concern, severity, signals: [], status: 'open', bookIds, history: [], createdAt: timestamp, updatedAt: timestamp, archived: false, title: subject, details: concern, confidence: SEVERITY_CONFIDENCE[severity], evidence: [] };
      suspicion = { ...suspicion, history: [suspicionRevision(suspicion, 'created', reason, [{ field: 'concern', before: 'None', after: concern || subject }])] };
      await onSave({ ...archive, suspicions: [suspicion, ...archive.suspicions] });
    }
    resetForm();
  }

  async function saveTheory(original: TheoryRecord, changes: Partial<TheoryRecord>, updateReason: string, action: InvestigationHistoryAction = 'updated') {
    const next = { ...original, ...changes, updatedAt: now() };
    const diff = changesBetween(original as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>, ['title', 'statement', 'confidence', 'status', 'bookIds', 'evidence', 'archived']);
    const revised = { ...next, history: [theoryRevision(next, action, updateReason, diff), ...(original.history ?? [])] };
    await onSave({ ...archive, theories: archive.theories.map((item) => item.id === original.id ? revised : item) });
  }
  async function saveSuspicion(original: SuspicionRecord, changes: Partial<SuspicionRecord>, updateReason: string, action: InvestigationHistoryAction = 'updated') {
    const next = { ...synchronizedSuspicion(original, changes), updatedAt: now() };
    const diff = changesBetween(original as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>, ['subject', 'concern', 'severity', 'status', 'bookIds', 'signals', 'archived']);
    const revised = { ...next, history: [suspicionRevision(next, action, updateReason, diff), ...(original.history ?? [])] };
    await onSave({ ...archive, suspicions: archive.suspicions.map((item) => item.id === original.id ? revised : item) });
  }
  async function addEvidence(target: NonNullable<EvidenceTarget>, text: string, updateReason: string) {
    const item = archive.theories.find((record) => record.id === target.id);
    if (item) {
      const evidence: EvidenceNote = { id: crypto.randomUUID(), text: text.trim(), createdAt: now() };
      await saveTheory(item, { evidence: [...(item.evidence ?? []), evidence] }, updateReason, 'evidence-added');
    }
    setEvidenceTarget(null);
  }
  async function addSignal(target: NonNullable<SignalTarget>, kind: SuspicionSignalKind, text: string, updateReason: string) {
    const item = archive.suspicions.find((record) => record.id === target.id);
    if (item) {
      const signal: SuspicionSignal = { id: crypto.randomUUID(), kind, text: text.trim(), createdAt: now() };
      await saveSuspicion(item, { signals: [...suspicionSignals(item), signal] }, updateReason, 'signal-added');
    }
    setSignalTarget(null);
  }
  async function archiveTheory(item: TheoryRecord) { const why = requestReason('archiving this theory'); if (why) await saveTheory(item, { archived: true, archivedAt: now() }, why, 'archived'); }
  async function restoreTheory(item: TheoryRecord) { const why = requestReason('restoring this theory'); if (why) await saveTheory(item, { archived: false, archivedAt: undefined }, why, 'restored'); }
  async function archiveSuspicion(item: SuspicionRecord) { const why = requestReason('archiving this suspicion'); if (why) await saveSuspicion(item, { archived: true, archivedAt: now() }, why, 'archived'); }
  async function restoreSuspicion(item: SuspicionRecord) { const why = requestReason('restoring this suspicion'); if (why) await saveSuspicion(item, { archived: false, archivedAt: undefined }, why, 'restored'); }
  async function removeRecord(kind: 'theories' | 'suspicions', id: string, label: string) {
    if (!window.confirm(`Permanently delete “${label}”? Its complete history will be lost. Archive it instead if you want to preserve the record.`)) return;
    if (kind === 'theories') await onSave({ ...archive, theories: archive.theories.filter((item) => item.id !== id) });
    else await onSave({ ...archive, suspicions: archive.suspicions.filter((item) => item.id !== id) });
  }

  const shownCount = mode === 'theories' ? theoryItems.length : mode === 'suspicions' ? suspicionItems.length : archivedTheoryItems.length + archivedSuspicionItems.length;
  return <div className="investigation-module">
    <header className="investigation-header"><div><p>Investigation Desk</p><h2>Theories & Suspicions</h2><span>Theories explain what you think is true. Suspicions flag what may be false, hidden, deceptive, or not what it appears to be.</span></div><div className="investigation-tabs"><button className={mode === 'theories' ? 'is-active' : ''} onClick={() => setMode('theories')}>Theories <strong>{activeTheories.length}</strong></button><button className={mode === 'suspicions' ? 'is-active' : ''} onClick={() => setMode('suspicions')}>Suspicions <strong>{activeSuspicions.length}</strong></button><button className={mode === 'archive' ? 'is-active' : ''} onClick={() => setMode('archive')}>Archive <strong>{archiveCount}</strong></button></div></header>
    <div className={`investigation-layout${mode === 'archive' ? ' is-archive' : ''}`}>
      {mode !== 'archive' && <form className="investigation-form" onSubmit={createRecord}>
        <h3>New {mode === 'theories' ? 'theory' : 'suspicion'}</h3>
        <label>{mode === 'theories' ? 'Title' : 'Subject'}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={mode === 'theories' ? 'Violet’s second signet is…' : 'Person, faction, object, claim, or event…'} required /></label>
        <label>{mode === 'theories' ? 'Theory' : 'What feels off?'}<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder={mode === 'theories' ? 'State the explanation or prediction you think the story will prove.' : 'What seems false, hidden, deceptive, or not what it appears to be?'} /></label>
        {mode === 'theories' ? <label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label> : null}
        <BookPicker books={archive.books} selectedIds={bookIds} onChange={setBookIds} />
        <label>Why are you adding this?<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="What happened in the story that made you start tracking this?" required /></label>
        <button type="submit">Create {mode === 'theories' ? 'Theory' : 'Suspicion'}</button>
      </form>}
      <section className="investigation-list">
        <div className="investigation-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === 'archive' ? 'Search archived investigations' : `Search ${mode}`} /><span>{shownCount} shown</span></div>
        {mode === 'theories' && theoryItems.map((item) => <TheoryCard key={item.id} item={item} books={archive.books} onSave={(changes, why) => saveTheory(item, changes, why)} onEvidence={() => setEvidenceTarget({ id: item.id, title: item.title })} onArchive={() => archiveTheory(item)} onDelete={() => removeRecord('theories', item.id, item.title)} />)}
        {mode === 'suspicions' && suspicionItems.map((item) => <SuspicionCard key={item.id} item={item} books={archive.books} onSave={(changes, why) => saveSuspicion(item, changes, why)} onSignal={() => setSignalTarget({ id: item.id, subject: suspicionSubject(item) })} onArchive={() => archiveSuspicion(item)} onDelete={() => removeRecord('suspicions', item.id, suspicionSubject(item))} />)}
        {mode === 'archive' && <><ArchiveHeading label="Theories" count={archivedTheoryItems.length} />{archivedTheoryItems.map((item) => <TheoryCard key={item.id} item={item} books={archive.books} onSave={(changes, why) => saveTheory(item, changes, why)} onEvidence={() => setEvidenceTarget({ id: item.id, title: item.title })} onRestore={() => restoreTheory(item)} onDelete={() => removeRecord('theories', item.id, item.title)} archived />)}<ArchiveHeading label="Suspicions" count={archivedSuspicionItems.length} />{archivedSuspicionItems.map((item) => <SuspicionCard key={item.id} item={item} books={archive.books} onSave={(changes, why) => saveSuspicion(item, changes, why)} onSignal={() => setSignalTarget({ id: item.id, subject: suspicionSubject(item) })} onRestore={() => restoreSuspicion(item)} onDelete={() => removeRecord('suspicions', item.id, suspicionSubject(item))} archived />)}</>}
        {!shownCount && <div className="investigation-empty"><span>⌁</span><h3>{mode === 'archive' ? 'Archive is empty' : `No ${mode} yet`}</h3><p>{mode === 'archive' ? 'Disproven, cleared, confirmed, or otherwise inactive investigations can live here without losing their timelines.' : mode === 'theories' ? 'Start with the explanation or prediction you cannot stop circling back to.' : 'Flag the person, claim, object, or event that does not add up.'}</p></div>}
      </section>
    </div>
    {evidenceTarget && <EvidenceModal target={evidenceTarget} onClose={() => setEvidenceTarget(null)} onSave={(text, why) => addEvidence(evidenceTarget, text, why)} />}
    {signalTarget && <SignalModal target={signalTarget} onClose={() => setSignalTarget(null)} onSave={(kind, text, why) => addSignal(signalTarget, kind, text, why)} />}
  </div>;
}

function ArchiveHeading({ label, count }: { label: string; count: number }) { return <div className="investigation-archive-heading"><strong>{label}</strong><span>{count}</span></div>; }

function EvidenceModal({ target, onClose, onSave }: { target: NonNullable<EvidenceTarget>; onClose: () => void; onSave: (text: string, reason: string) => Promise<void> }) {
  const [text, setText] = useState(''); const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!text.trim() || !reason.trim()) return; setSaving(true); try { await onSave(text, reason); } finally { setSaving(false); } }
  return <div className="investigation-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="investigation-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title"><header><div><p>Evidence entry</p><h3 id="evidence-modal-title">Add evidence</h3><span>{target.title}</span></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><label>Evidence or supporting note<textarea autoFocus rows={5} value={text} onChange={(event) => setText(event.target.value)} placeholder="Record the quote, clue, page reference, or reasoning that supports this theory…" /></label><label>Why does this matter?<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this changed or strengthened your thinking." /></label><footer><button type="button" onClick={onClose}>Cancel</button><button className="is-primary" disabled={!text.trim() || !reason.trim() || saving}>{saving ? 'Saving…' : 'Add evidence'}</button></footer></form></div>;
}

function SignalModal({ target, onClose, onSave }: { target: NonNullable<SignalTarget>; onClose: () => void; onSave: (kind: SuspicionSignalKind, text: string, reason: string) => Promise<void> }) {
  const [kind, setKind] = useState<SuspicionSignalKind>('clue'); const [text, setText] = useState(''); const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!text.trim() || !reason.trim()) return; setSaving(true); try { await onSave(kind, text, reason); } finally { setSaving(false); } }
  return <div className="investigation-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="investigation-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="signal-modal-title"><header><div><p>Suspicion signal</p><h3 id="signal-modal-title">Add a signal</h3><span>{target.subject}</span></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><label>Signal type<select value={kind} onChange={(event) => setKind(event.target.value as SuspicionSignalKind)}>{Object.entries(SIGNAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>What raised the flag?<textarea autoFocus rows={5} value={text} onChange={(event) => setText(event.target.value)} placeholder="Record the clue, behavior, contradiction, or recurring pattern…" /></label><label>Why does this matter?<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this changed or strengthened your suspicion." /></label><footer><button type="button" onClick={onClose}>Cancel</button><button className="is-primary" disabled={!text.trim() || !reason.trim() || saving}>{saving ? 'Saving…' : 'Add signal'}</button></footer></form></div>;
}

function BookPicker({ books, selectedIds, onChange }: { books: V2BookRecord[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState(''); const [open, setOpen] = useState(false);
  const matches = books.filter((book) => !selectedIds.includes(book.id) && `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12);
  return <div className="investigation-book-picker"><label>Linked books<input value={search} onFocus={() => setOpen(true)} onChange={(event) => { setSearch(event.target.value); setOpen(true); }} placeholder="Search your library…" /></label>{open && <div className="investigation-book-menu">{matches.length ? matches.map((book) => <button type="button" key={book.id} onClick={() => { onChange([...selectedIds, book.id]); setSearch(''); setOpen(false); }}><strong>{book.title}</strong><span>{book.author || book.series || 'Book'}</span></button>) : <p>No matching books</p>}</div>}<div className="investigation-selected-books">{selectedIds.map((id) => { const book = books.find((item) => item.id === id); return book ? <button type="button" key={id} onClick={() => onChange(selectedIds.filter((item) => item !== id))}>{book.title} ×</button> : null; })}</div></div>;
}

function TheoryCard({ item, books, onSave, onEvidence, onArchive, onRestore, onDelete, archived = false }: { item: TheoryRecord; books: V2BookRecord[]; onSave: (changes: Partial<TheoryRecord>, reason: string) => Promise<void>; onEvidence: () => void; onArchive?: () => void; onRestore?: () => void; onDelete: () => void; archived?: boolean }) {
  const [editing, setEditing] = useState(false); const [showHistory, setShowHistory] = useState(false); const [title, setTitle] = useState(item.title); const [statement, setStatement] = useState(item.statement); const [confidence, setConfidence] = useState(item.confidence); const [status, setStatus] = useState<TheoryStatus>(item.status); const [bookIds, setBookIds] = useState([...item.bookIds]); const [evidence, setEvidence] = useState<EvidenceNote[]>(() => (item.evidence ?? []).map((entry) => ({ ...entry }))); const [reason, setReason] = useState('');
  function reset() { setTitle(item.title); setStatement(item.statement); setConfidence(item.confidence); setStatus(item.status); setBookIds([...item.bookIds]); setEvidence((item.evidence ?? []).map((entry) => ({ ...entry }))); setReason(''); setEditing(false); }
  async function commit() { if (!reason.trim()) return; await onSave({ title: title.trim(), statement: statement.trim(), confidence, status, bookIds, evidence }, reason); setEditing(false); setReason(''); }
  async function quickStatus(nextStatus: TheoryStatus) { const why = requestReason(`changing this theory to ${nextStatus}`); if (why) await onSave({ status: nextStatus }, why); }
  function addEvidenceRow() { setEvidence((current) => [...current, { id: crypto.randomUUID(), text: '', createdAt: now() }]); }
  return <article className={`investigation-card investigation-card--theory${archived ? ' is-archived' : ''}`}>{editing ? <div className="investigation-edit-form"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Theory<textarea rows={5} value={statement} onChange={(event) => setStatement(event.target.value)} /></label><label>Confidence · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as TheoryStatus)}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></select></label><BookPicker books={books} selectedIds={bookIds} onChange={setBookIds} /><section className="investigation-evidence-editor"><header><div><strong>Evidence</strong><span>Edit supporting evidence for this theory.</span></div><button type="button" onClick={addEvidenceRow}>+ Add evidence</button></header>{evidence.length ? evidence.map((entry) => <div className="investigation-evidence-row" key={entry.id}><textarea rows={3} value={entry.text} onChange={(event) => setEvidence((current) => current.map((value) => value.id === entry.id ? { ...value, text: event.target.value } : value))} placeholder="Evidence, quote, clue, or supporting note…" /><button type="button" className="is-danger" onClick={() => setEvidence((current) => current.filter((value) => value.id !== entry.id))}>Remove</button></div>) : <p>No evidence yet.</p>}</section><label>Reason for this update<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What changed in the story or in your thinking?" /></label><div className="investigation-edit-actions"><button disabled={!reason.trim()} onClick={commit}>Save changes</button><button onClick={reset}>Cancel</button></div></div> : <><header><div><span>Theory{archived ? ' · Archived' : ''}</span><h3>{item.title}</h3></div><select value={item.status} disabled={archived} onChange={(event) => quickStatus(event.target.value as TheoryStatus)}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="disproven">Disproven</option><option value="dormant">Dormant</option></select></header><p>{item.statement || 'No theory statement added yet.'}</p><label className="investigation-confidence"><span>Confidence</span><input type="range" min="0" max="100" value={item.confidence} disabled={archived} onChange={async (event) => { const next = Number(event.target.value); const why = requestReason(`changing confidence to ${next}%`); if (why) await onSave({ confidence: next }, why); }} /><strong>{item.confidence}%</strong></label><LinkedBooks ids={item.bookIds} books={books} /><EvidenceList evidence={item.evidence ?? []} /><footer>{!archived && <><button onClick={() => setEditing(true)}>Edit</button><button onClick={onEvidence}>Add Evidence</button><button onClick={onArchive}>Archive</button></>}{archived && <button onClick={onRestore}>Restore to Active</button>}<button onClick={() => setShowHistory((value) => !value)}>History ({(item.history ?? []).length})</button><button className="is-danger" onClick={onDelete}>Delete</button></footer>{showHistory && <HistoryList history={item.history ?? []} />}</>}</article>;
}

function SuspicionCard({ item, books, onSave, onSignal, onArchive, onRestore, onDelete, archived = false }: { item: SuspicionRecord; books: V2BookRecord[]; onSave: (changes: Partial<SuspicionRecord>, reason: string) => Promise<void>; onSignal: () => void; onArchive?: () => void; onRestore?: () => void; onDelete: () => void; archived?: boolean }) {
  const [editing, setEditing] = useState(false); const [showHistory, setShowHistory] = useState(false); const [subject, setSubject] = useState(suspicionSubject(item)); const [concern, setConcern] = useState(suspicionConcern(item)); const [status, setStatus] = useState<SuspicionStatus>(item.status); const [bookIds, setBookIds] = useState([...item.bookIds]); const [signals, setSignals] = useState<SuspicionSignal[]>(() => suspicionSignals(item)); const [reason, setReason] = useState('');
  function reset() { setSubject(suspicionSubject(item)); setConcern(suspicionConcern(item)); setStatus(item.status); setBookIds([...item.bookIds]); setSignals(suspicionSignals(item)); setReason(''); setEditing(false); }
  async function commit() { if (!reason.trim()) return; await onSave({ subject: subject.trim(), concern: concern.trim(), status, bookIds, signals }, reason); setEditing(false); setReason(''); }
  async function quickStatus(nextStatus: SuspicionStatus) { const why = requestReason(`changing this suspicion to ${nextStatus}`); if (why) await onSave({ status: nextStatus }, why); }
  function addSignalRow() { setSignals((current) => [...current, { id: crypto.randomUUID(), kind: 'clue', text: '', createdAt: now() }]); }
  const currentSignals = suspicionSignals(item);
  return <article className={`investigation-card investigation-card--suspicion${archived ? ' is-archived' : ''}`}>{editing ? <div className="investigation-edit-form"><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>What feels off?<textarea rows={5} value={concern} onChange={(event) => setConcern(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as SuspicionStatus)}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="cleared">Cleared</option><option value="resolved">Resolved (legacy)</option><option value="dismissed">Dismissed (legacy)</option></select></label><BookPicker books={books} selectedIds={bookIds} onChange={setBookIds} /><section className="investigation-evidence-editor investigation-signal-editor"><header><div><strong>Signals</strong><span>Track clues, behavior, contradictions, and patterns that raised the flag.</span></div><button type="button" onClick={addSignalRow}>+ Add signal</button></header>{signals.length ? signals.map((signal) => <div className="investigation-evidence-row investigation-signal-row" key={signal.id}><select value={signal.kind} onChange={(event) => setSignals((current) => current.map((value) => value.id === signal.id ? { ...value, kind: event.target.value as SuspicionSignalKind } : value))}>{Object.entries(SIGNAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea rows={3} value={signal.text} onChange={(event) => setSignals((current) => current.map((value) => value.id === signal.id ? { ...value, text: event.target.value } : value))} placeholder="What raised the flag?" /><button type="button" className="is-danger" onClick={() => setSignals((current) => current.filter((value) => value.id !== signal.id))}>Remove</button></div>) : <p>No signals yet.</p>}</section><label>Reason for this update<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What changed in the story or in your thinking?" /></label><div className="investigation-edit-actions"><button disabled={!reason.trim()} onClick={commit}>Save changes</button><button onClick={reset}>Cancel</button></div></div> : <><header><div><span>Suspicion{archived ? ' · Archived' : ''}</span><h3>{suspicionSubject(item) || 'Unnamed subject'}</h3></div><select value={item.status} disabled={archived} onChange={(event) => quickStatus(event.target.value as SuspicionStatus)}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="cleared">Cleared</option>{item.status === 'resolved' && <option value="resolved">Resolved (legacy)</option>}{item.status === 'dismissed' && <option value="dismissed">Dismissed (legacy)</option>}</select></header><p>{suspicionConcern(item) || 'No concern recorded yet.'}</p><LinkedBooks ids={item.bookIds} books={books} /><SignalList signals={currentSignals} /><footer>{!archived && <><button onClick={() => setEditing(true)}>Edit</button><button onClick={onSignal}>Add Signal</button><button onClick={onArchive}>Archive</button></>}{archived && <button onClick={onRestore}>Restore to Active</button>}<button onClick={() => setShowHistory((value) => !value)}>History ({(item.history ?? []).length})</button><button className="is-danger" onClick={onDelete}>Delete</button></footer>{showHistory && <HistoryList history={item.history ?? []} />}</>}</article>;
}

function LinkedBooks({ ids, books }: { ids: string[]; books: V2BookRecord[] }) { const linked = ids.map((id) => books.find((book) => book.id === id)).filter(Boolean); return linked.length ? <div className="investigation-links">{linked.map((book) => <span key={book!.id}>{book!.title}</span>)}</div> : null; }
function EvidenceList({ evidence }: { evidence: Array<{ id: string; text: string }> }) { return evidence.length ? <div className="investigation-evidence"><strong>Evidence</strong>{evidence.map((item) => <p key={item.id}>{item.text}</p>)}</div> : null; }
function SignalList({ signals }: { signals: SuspicionSignal[] }) { return signals.length ? <div className="investigation-evidence investigation-signals"><strong>Signals</strong>{signals.map((signal) => <p key={signal.id}><span className="investigation-signal-kind">{SIGNAL_LABELS[signal.kind]}</span>{signal.text}</p>)}</div> : null; }
function HistoryList({ history }: { history: InvestigationRevision[] }) {
  return <div className="investigation-history"><strong>Investigation timeline</strong>{history.length ? history.map((revision) => <details key={revision.id}><summary>{new Date(revision.editedAt).toLocaleString()} · {revision.action ? ACTION_LABELS[revision.action] : 'Previous version'}</summary><div className="investigation-history-entry"><p>{revision.body || 'No body text'}</p>{revision.reason && <p className="investigation-history-reason"><strong>Reason:</strong> {revision.reason}</p>}{revision.changes?.length ? <ul>{revision.changes.map((change, index) => <li key={`${revision.id}-${change.field}-${index}`}><strong>{change.field}:</strong> {change.before} → {change.after}</li>)}</ul> : null}<small>{revision.severity ? `${revision.severity} legacy severity · ` : `${revision.confidence}% confidence · `}{revision.status} · {revision.bookIds.length} linked books{revision.archived ? ' · archived' : ''}</small></div></details>) : <p>No previous versions yet.</p>}</div>;
}
