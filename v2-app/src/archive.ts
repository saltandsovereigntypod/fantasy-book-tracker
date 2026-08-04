import type { User } from '@supabase/supabase-js';
import type { BookRecord, CardDesign } from './domain';
import { defaultDesign } from './defaults';
import { supabase } from './supabase';

export interface V2BookRecord extends BookRecord {
  design: CardDesign;
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
  archived?: boolean;
}

export interface V2Profile {
  displayName: string;
  path: string;
  points: number;
  rankIndex: number;
  onboarded: boolean;
}

export interface V2ArchiveState {
  version: 1;
  profile: V2Profile;
  books: V2BookRecord[];
  theories: unknown[];
  suspicions: unknown[];
  walls: unknown[];
  mindMapNodes: unknown[];
  updatedAt: string;
}

const LOCAL_KEY = 'empyrean-v2-archive';

export function freshArchive(user?: User | null): V2ArchiveState {
  return {
    version: 1,
    profile: {
      displayName: String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Reader'),
      path: 'rider',
      points: 0,
      rankIndex: 0,
      onboarded: false,
    },
    books: [],
    theories: [],
    suspicions: [],
    walls: [],
    mindMapNodes: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeBook(book: Partial<V2BookRecord>): V2BookRecord {
  const now = new Date().toISOString();
  return {
    id: String(book.id || crypto.randomUUID()),
    title: String(book.title || 'Untitled Book'),
    author: String(book.author || ''),
    series: String(book.series || ''),
    status: book.status || 'want',
    progress: Number(book.progress) || 0,
    rating: Number(book.rating) || 0,
    spice: Number(book.spice) || 0,
    impact: Number(book.impact) || 0,
    reaction: String(book.reaction || ''),
    coverUrl: String(book.coverUrl || ''),
    mindMapNodeIds: Array.isArray(book.mindMapNodeIds) ? book.mindMapNodeIds : [],
    wallCardIds: Array.isArray(book.wallCardIds) ? book.wallCardIds : [],
    theoryIds: Array.isArray(book.theoryIds) ? book.theoryIds : [],
    design: structuredClone(book.design || defaultDesign),
    createdAt: String(book.createdAt || now),
    updatedAt: String(book.updatedAt || now),
    favorite: Boolean(book.favorite),
    archived: Boolean(book.archived),
  };
}

export function normalizeArchive(value: unknown, user?: User | null): V2ArchiveState {
  const source = value && typeof value === 'object' ? value as Partial<V2ArchiveState> : {};
  const base = freshArchive(user);
  return {
    ...base,
    ...source,
    version: 1,
    profile: { ...base.profile, ...(source.profile || {}) },
    books: Array.isArray(source.books) ? source.books.map(normalizeBook) : [],
    theories: Array.isArray(source.theories) ? source.theories : [],
    suspicions: Array.isArray(source.suspicions) ? source.suspicions : [],
    walls: Array.isArray(source.walls) ? source.walls : [],
    mindMapNodes: Array.isArray(source.mindMapNodes) ? source.mindMapNodes : [],
    updatedAt: String(source.updatedAt || base.updatedAt),
  };
}

export function loadLocalArchive(user?: User | null): V2ArchiveState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalizeArchive(JSON.parse(raw), user) : freshArchive(user);
  } catch {
    return freshArchive(user);
  }
}

export function saveLocalArchive(state: V2ArchiveState): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

export async function loadCloudArchive(user: User): Promise<V2ArchiveState> {
  const { data, error } = await supabase.from('archive_states').select('state').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data?.state) return loadLocalArchive(user);

  const raw = data.state as Record<string, unknown>;
  if (raw.v2Archive && typeof raw.v2Archive === 'object') return normalizeArchive(raw.v2Archive, user);
  return loadLocalArchive(user);
}

export async function saveCloudArchive(user: User, state: V2ArchiveState): Promise<void> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  saveLocalArchive(next);

  const { data: existing, error: readError } = await supabase.from('archive_states').select('state').eq('user_id', user.id).maybeSingle();
  if (readError) throw readError;
  const legacyState = existing?.state && typeof existing.state === 'object' ? existing.state as Record<string, unknown> : {};
  const mergedState = { ...legacyState, v2Archive: next };

  const { error } = await supabase.from('archive_states').upsert(
    { user_id: user.id, state: mergedState, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
