import type { User } from '@supabase/supabase-js';
import type { BookNote, BookRecord, BookRelationship, CardDesign, EvidenceNote, InvestigationRevision, ReadingSession, SuspicionRecord, TheoryRecord } from './domain';
import { defaultDesign } from './defaults';
import { supabase } from './supabase';

export interface V2BookRecord extends BookRecord {
  design: CardDesign;
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
  archived?: boolean;
}

export interface V2Profile { displayName: string; path: string; points: number; rankIndex: number; onboarded: boolean; }
export interface V2ArchiveState {
  version: 1;
  profile: V2Profile;
  books: V2BookRecord[];
  theories: TheoryRecord[];
  suspicions: SuspicionRecord[];
  walls: unknown[];
  mindMapNodes: unknown[];
  updatedAt: string;
}

const LOCAL_KEY = 'empyrean-v2-archive';

export function freshArchive(user?: User | null): V2ArchiveState {
  return { version: 1, profile: { displayName: String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Reader'), path: 'rider', points: 0, rankIndex: 0, onboarded: false }, books: [], theories: [], suspicions: [], walls: [], mindMapNodes: [], updatedAt: new Date().toISOString() };
}

function normalizeStrings(values: unknown): string[] { return Array.isArray(values) ? [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))] : []; }
function normalizeNotes(values: unknown): BookNote[] { const now = new Date().toISOString(); return Array.isArray(values) ? values.map((value) => { const note = value && typeof value === 'object' ? value as Partial<BookNote> : {}; return { id: String(note.id || crypto.randomUUID()), text: String(note.text || ''), createdAt: String(note.createdAt || now), updatedAt: String(note.updatedAt || note.createdAt || now) }; }).filter((note) => note.text) : []; }
function normalizeSessions(values: unknown): ReadingSession[] { const now = new Date().toISOString(); return Array.isArray(values) ? values.map((value) => { const session = value && typeof value === 'object' ? value as Partial<ReadingSession> : {}; return { id: String(session.id || crypto.randomUUID()), startedAt: String(session.startedAt || now), completedAt: session.completedAt ? String(session.completedAt) : undefined, startProgress: Number(session.startProgress) || 0, endProgress: Number(session.endProgress) || 0, pagesRead: session.pagesRead == null ? undefined : Number(session.pagesRead) || 0, minutesRead: session.minutesRead == null ? undefined : Number(session.minutesRead) || 0, notes: session.notes ? String(session.notes) : undefined }; }) : []; }
function normalizeRelationships(values: unknown): BookRelationship[] { const now = new Date().toISOString(); return Array.isArray(values) ? values.map((value) => { const relationship = value && typeof value === 'object' ? value as Partial<BookRelationship> : {}; return { id: String(relationship.id || crypto.randomUUID()), targetBookId: String(relationship.targetBookId || ''), type: String(relationship.type || ''), explanation: relationship.explanation ? String(relationship.explanation) : undefined, notes: relationship.notes ? String(relationship.notes) : undefined, createdAt: String(relationship.createdAt || now), updatedAt: String(relationship.updatedAt || relationship.createdAt || now) }; }).filter((relationship) => relationship.targetBookId && relationship.type) : []; }
function normalizeEvidence(values: unknown): EvidenceNote[] { const now = new Date().toISOString(); return Array.isArray(values) ? values.map((value) => { const evidence = value && typeof value === 'object' ? value as Partial<EvidenceNote> : {}; return { id: String(evidence.id || crypto.randomUUID()), text: String(evidence.text || ''), createdAt: String(evidence.createdAt || now) }; }).filter((item) => item.text) : []; }
function normalizeHistory(values: unknown): InvestigationRevision[] {
  return Array.isArray(values) ? values.map((value) => {
    const revision = value && typeof value === 'object' ? value as Partial<InvestigationRevision> : {};
    const status = revision.status === 'confirmed' || revision.status === 'disproven' || revision.status === 'dormant' || revision.status === 'resolved' || revision.status === 'dismissed' ? revision.status : 'open';
    return { id: String(revision.id || crypto.randomUUID()), editedAt: String(revision.editedAt || new Date().toISOString()), title: String(revision.title || ''), body: String(revision.body || ''), confidence: Math.max(0, Math.min(100, Number(revision.confidence) || 0)), status, bookIds: normalizeStrings(revision.bookIds) };
  }) : [];
}
function normalizeTheories(values: unknown): TheoryRecord[] {
  const now = new Date().toISOString();
  return Array.isArray(values) ? values.map((value) => { const theory = value && typeof value === 'object' ? value as Partial<TheoryRecord> : {}; const status = theory.status === 'confirmed' || theory.status === 'disproven' || theory.status === 'dormant' ? theory.status : 'open'; return { id: String(theory.id || crypto.randomUUID()), title: String(theory.title || 'Untitled theory'), statement: String(theory.statement || ''), status, confidence: Math.max(0, Math.min(100, Number(theory.confidence) || 0)), bookIds: normalizeStrings(theory.bookIds), evidence: normalizeEvidence(theory.evidence), history: normalizeHistory(theory.history), createdAt: String(theory.createdAt || now), updatedAt: String(theory.updatedAt || theory.createdAt || now) }; }) : [];
}
function normalizeSuspicions(values: unknown): SuspicionRecord[] {
  const now = new Date().toISOString();
  return Array.isArray(values) ? values.map((value) => { const suspicion = value && typeof value === 'object' ? value as Partial<SuspicionRecord> : {}; const status = suspicion.status === 'resolved' || suspicion.status === 'dismissed' ? suspicion.status : 'open'; return { id: String(suspicion.id || crypto.randomUUID()), title: String(suspicion.title || 'Untitled suspicion'), details: String(suspicion.details || ''), status, confidence: Math.max(0, Math.min(100, Number(suspicion.confidence) || 0)), bookIds: normalizeStrings(suspicion.bookIds), evidence: normalizeEvidence(suspicion.evidence), history: normalizeHistory(suspicion.history), createdAt: String(suspicion.createdAt || now), updatedAt: String(suspicion.updatedAt || suspicion.createdAt || now) }; }) : [];
}
function normalizeDesign(value: Partial<CardDesign> | undefined): CardDesign { const source = value || defaultDesign; const { actions: _actions, ...cleanSource } = source as Partial<CardDesign> & { actions?: unknown }; return { ...structuredClone(defaultDesign), ...structuredClone(cleanSource), width: 420, height: 380, elements: Array.isArray(source.elements) ? structuredClone(source.elements) : structuredClone(defaultDesign.elements), version: Math.max(4, Number(source.version) || 1) }; }
function normalizeBook(book: Partial<V2BookRecord>): V2BookRecord {
  const now = new Date().toISOString();
  return { id: String(book.id || crypto.randomUUID()), title: String(book.title || 'Untitled Book'), author: String(book.author || ''), series: String(book.series || ''), status: book.status || 'want', progress: Number(book.progress) || 0, rating: Number(book.rating) || 0, spice: Number(book.spice) || 0, impact: Number(book.impact) || 0, reaction: String(book.reaction || ''), coverUrl: String(book.coverUrl || ''), summary: String(book.summary || ''), about: String(book.about || ''), genres: normalizeStrings(book.genres), tags: normalizeStrings(book.tags), notes: normalizeNotes(book.notes), readingSessions: normalizeSessions(book.readingSessions), relationships: normalizeRelationships(book.relationships), mindMapNodeIds: normalizeStrings(book.mindMapNodeIds), wallCardIds: normalizeStrings(book.wallCardIds), theoryIds: normalizeStrings(book.theoryIds), suspicionIds: normalizeStrings(book.suspicionIds), design: normalizeDesign(book.design), createdAt: String(book.createdAt || now), updatedAt: String(book.updatedAt || now), favorite: Boolean(book.favorite), archived: Boolean(book.archived) };
}

export function normalizeArchive(value: unknown, user?: User | null): V2ArchiveState { const source = value && typeof value === 'object' ? value as Partial<V2ArchiveState> : {}; const base = freshArchive(user); return { ...base, ...source, version: 1, profile: { ...base.profile, ...(source.profile || {}) }, books: Array.isArray(source.books) ? source.books.map(normalizeBook) : [], theories: normalizeTheories(source.theories), suspicions: normalizeSuspicions(source.suspicions), walls: Array.isArray(source.walls) ? source.walls : [], mindMapNodes: Array.isArray(source.mindMapNodes) ? source.mindMapNodes : [], updatedAt: String(source.updatedAt || base.updatedAt) }; }
export function loadLocalArchive(user?: User | null): V2ArchiveState { try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? normalizeArchive(JSON.parse(raw), user) : freshArchive(user); } catch { return freshArchive(user); } }
export function saveLocalArchive(state: V2ArchiveState): void { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); }
export async function loadCloudArchive(user: User): Promise<V2ArchiveState> { const { data, error } = await supabase.from('archive_states').select('state').eq('user_id', user.id).maybeSingle(); if (error) throw error; if (!data?.state) return loadLocalArchive(user); const raw = data.state as Record<string, unknown>; if (raw.v2Archive && typeof raw.v2Archive === 'object') return normalizeArchive(raw.v2Archive, user); return loadLocalArchive(user); }
export async function saveCloudArchive(user: User, state: V2ArchiveState): Promise<void> { const next = { ...state, updatedAt: new Date().toISOString() }; saveLocalArchive(next); const { data: existing, error: readError } = await supabase.from('archive_states').select('state').eq('user_id', user.id).maybeSingle(); if (readError) throw readError; const legacyState = existing?.state && typeof existing.state === 'object' ? existing.state as Record<string, unknown> : {}; const { error } = await supabase.from('archive_states').upsert({ user_id: user.id, state: { ...legacyState, v2Archive: next }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); if (error) throw error; }
