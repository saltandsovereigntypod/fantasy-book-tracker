import type { User } from '@supabase/supabase-js';
import type {
  BookRecord,
  CardDesign,
  SuspicionRecord,
  TheoryRecord,
  WallDossierRecord,
  WallRecord,
} from './domain';
import { defaultDesign } from './defaults';
import { supabase } from './supabase';
import {
  PRYTHIAN_COURT_IDS,
  freshUniverseProfiles,
  prythianRankIndex,
  type PrythianCourtId,
  type UniverseProfiles,
} from './universes';

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
  abilityId?: string;
  abilityName?: string;
  abilityDescription?: string;
  creature?: { kind: 'dragon' | 'gryphon' | 'wyvern'; name: string; color: string; tail?: string };
  primaryPowerId?: string;
  primaryPowerName?: string;
  primaryPowerDescription?: string;
  rareAffinityId?: string;
  rareAffinityName?: string;
  role?: 'high-fae' | 'lesser-fae' | 'illyrian';
  court?: PrythianCourtId;
}

export interface V2ArchiveState {
  version: 1;
  profile: V2Profile;
  universes: UniverseProfiles;
  books: V2BookRecord[];
  theories: TheoryRecord[];
  suspicions: SuspicionRecord[];
  dossiers: WallDossierRecord[];
  walls: WallRecord[];
  mindMapNodes: unknown[];
  updatedAt: string;
}

const LOCAL_KEY = 'empyrean-v2-archive';
const CLOUD_READ_TIMEOUT_MS = 5000;

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
}

function validCourt(value: unknown): PrythianCourtId | undefined {
  return PRYTHIAN_COURT_IDS.includes(value as PrythianCourtId)
    ? value as PrythianCourtId
    : undefined;
}

function hasLegacyPrythianIdentity(profile: Record<string, unknown>, source: Record<string, unknown>): boolean {
  return Boolean(
    validCourt(profile.court)
    || validCourt(source.court)
    || profile.primaryPowerId
    || profile.primaryPowerName
    || profile.primaryPowerDescription
    || profile.rareAffinityId
    || profile.rareAffinityName
    || profile.role
  );
}

function normalizeProfile(value: unknown, user?: User | null): V2Profile {
  const source = isRecord(value) ? value : {};
  return {
    displayName: String(source.displayName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Reader'),
    path: String(source.path || 'rider'),
    points: numberOr(source.points),
    rankIndex: numberOr(source.rankIndex),
    onboarded: Boolean(source.onboarded),
    abilityId: source.abilityId ? String(source.abilityId) : undefined,
    abilityName: source.abilityName ? String(source.abilityName) : undefined,
    abilityDescription: source.abilityDescription ? String(source.abilityDescription) : undefined,
    creature: isRecord(source.creature) && source.creature.name
      ? {
          kind: source.creature.kind === 'gryphon' || source.creature.kind === 'wyvern' ? source.creature.kind : 'dragon',
          name: String(source.creature.name),
          color: String(source.creature.color || ''),
          tail: source.creature.tail ? String(source.creature.tail) : undefined,
        }
      : undefined,
    primaryPowerId: source.primaryPowerId ? String(source.primaryPowerId) : undefined,
    primaryPowerName: source.primaryPowerName ? String(source.primaryPowerName) : undefined,
    primaryPowerDescription: source.primaryPowerDescription ? String(source.primaryPowerDescription) : undefined,
    rareAffinityId: source.rareAffinityId ? String(source.rareAffinityId) : undefined,
    rareAffinityName: source.rareAffinityName ? String(source.rareAffinityName) : undefined,
    role: source.role === 'lesser-fae' || source.role === 'illyrian' ? source.role : source.role === 'high-fae' ? 'high-fae' : undefined,
    court: validCourt(source.court),
  };
}

function normalizeUniverses(value: unknown, profile: V2Profile, archiveSource: Record<string, unknown>): UniverseProfiles {
  const raw = isRecord(value) ? value : {};
  const rawEmpyrean = isRecord(raw.empyrean) ? raw.empyrean : {};
  const rawPrythian = isRecord(raw.prythian) ? raw.prythian : {};
  const base = freshUniverseProfiles(profile.path);
  const migratedPrythian = hasLegacyPrythianIdentity(profile as unknown as Record<string, unknown>, archiveSource);
  const activeUniverse = raw.activeUniverse === 'prythian' || raw.activeUniverse === 'empyrean'
    ? raw.activeUniverse
    : migratedPrythian
      ? 'prythian'
      : 'empyrean';
  const sharedPoints = numberOr(profile.points);
  const court = validCourt(rawPrythian.court) || profile.court || validCourt(archiveSource.court) || (migratedPrythian ? 'night' : undefined);
  const prythianPoints = numberOr(rawPrythian.points, migratedPrythian ? sharedPoints : 0);
  const empyreanPoints = numberOr(rawEmpyrean.points, activeUniverse === 'empyrean' ? sharedPoints : 0);

  return {
    activeUniverse,
    empyrean: {
      ...base.empyrean,
      path: String(rawEmpyrean.path || profile.path || 'rider'),
      onboarded: rawEmpyrean.onboarded == null ? Boolean(profile.onboarded && activeUniverse === 'empyrean') : Boolean(rawEmpyrean.onboarded),
      points: empyreanPoints,
      rankIndex: numberOr(rawEmpyrean.rankIndex, profile.rankIndex),
      completedEvents: strings(rawEmpyrean.completedEvents),
      stories: Array.isArray(rawEmpyrean.stories) ? rawEmpyrean.stories as UniverseProfiles['empyrean']['stories'] : [],
    },
    prythian: {
      ...base.prythian,
      court,
      onboarded: rawPrythian.onboarded == null ? Boolean(migratedPrythian || activeUniverse === 'prythian') : Boolean(rawPrythian.onboarded),
      points: prythianPoints,
      rankIndex: numberOr(rawPrythian.rankIndex, prythianRankIndex(prythianPoints)),
      completedEvents: strings(rawPrythian.completedEvents),
      stories: Array.isArray(rawPrythian.stories) ? rawPrythian.stories as UniverseProfiles['prythian']['stories'] : [],
      primaryPowerId: rawPrythian.primaryPowerId ? String(rawPrythian.primaryPowerId) : profile.primaryPowerId,
      primaryPowerName: rawPrythian.primaryPowerName ? String(rawPrythian.primaryPowerName) : profile.primaryPowerName,
      primaryPowerDescription: rawPrythian.primaryPowerDescription ? String(rawPrythian.primaryPowerDescription) : profile.primaryPowerDescription,
      rareAffinityId: rawPrythian.rareAffinityId ? String(rawPrythian.rareAffinityId) : profile.rareAffinityId,
      rareAffinityName: rawPrythian.rareAffinityName ? String(rawPrythian.rareAffinityName) : profile.rareAffinityName,
      role: rawPrythian.role === 'lesser-fae' || rawPrythian.role === 'illyrian' || rawPrythian.role === 'high-fae'
        ? rawPrythian.role
        : profile.role,
      distinctions: strings(rawPrythian.distinctions),
    },
  };
}

function normalizeDesign(value: unknown): CardDesign {
  const source = isRecord(value) ? value as Partial<CardDesign> : {};
  const { actions: _actions, ...cleanSource } = source as Partial<CardDesign> & { actions?: unknown };
  return {
    ...structuredClone(defaultDesign),
    ...cleanSource,
    width: numberOr(source.width, 420),
    height: numberOr(source.height, 380),
    elements: Array.isArray(source.elements) ? structuredClone(source.elements) : structuredClone(defaultDesign.elements),
    version: Math.max(4, numberOr(source.version, 1)),
  };
}

function normalizeBook(value: unknown): V2BookRecord {
  const book = isRecord(value) ? value as Partial<V2BookRecord> : {};
  const timestamp = now();
  return {
    ...(book as BookRecord),
    id: String(book.id || crypto.randomUUID()),
    title: String(book.title || 'Untitled Book'),
    author: String(book.author || ''),
    series: String(book.series || ''),
    status: book.status || 'want',
    progress: numberOr(book.progress),
    rating: numberOr(book.rating),
    spice: numberOr(book.spice),
    impact: numberOr(book.impact),
    reaction: String(book.reaction || ''),
    coverUrl: String(book.coverUrl || ''),
    genres: strings(book.genres),
    tags: strings(book.tags),
    about: String(book.about || ''),
    summary: String(book.summary || ''),
    notes: Array.isArray(book.notes) ? book.notes : [],
    readingSessions: Array.isArray(book.readingSessions) ? book.readingSessions : [],
    relationships: Array.isArray(book.relationships) ? book.relationships : [],
    theoryIds: strings(book.theoryIds),
    suspicionIds: strings(book.suspicionIds),
    wallCardIds: strings(book.wallCardIds),
    mindMapNodeIds: strings(book.mindMapNodeIds),
    customRatings: Array.isArray(book.customRatings) ? book.customRatings : [],
    design: normalizeDesign(book.design),
    createdAt: String(book.createdAt || timestamp),
    updatedAt: String(book.updatedAt || timestamp),
    favorite: Boolean(book.favorite),
    archived: Boolean(book.archived),
  };
}

export function freshArchive(user?: User | null): V2ArchiveState {
  const profile = normalizeProfile({}, user);
  return {
    version: 1,
    profile,
    universes: freshUniverseProfiles(profile.path),
    books: [],
    theories: [],
    suspicions: [],
    dossiers: [],
    walls: [],
    mindMapNodes: [],
    updatedAt: now(),
  };
}

export function normalizeArchive(value: unknown, user?: User | null): V2ArchiveState {
  const source = isRecord(value) ? value : {};
  const profile = normalizeProfile(source.profile, user);
  const universes = normalizeUniverses(source.universes, profile, source);
  const activePoints = universes.activeUniverse === 'prythian' ? universes.prythian.points : universes.empyrean.points;
  const activeRank = universes.activeUniverse === 'prythian' ? universes.prythian.rankIndex : universes.empyrean.rankIndex;
  const synchronizedProfile: V2Profile = {
    ...profile,
    path: universes.empyrean.path,
    points: activePoints,
    rankIndex: activeRank,
    onboarded: universes.activeUniverse === 'prythian' ? universes.prythian.onboarded : universes.empyrean.onboarded,
  };

  return {
    version: 1,
    profile: synchronizedProfile,
    universes,
    books: Array.isArray(source.books) ? source.books.map(normalizeBook) : [],
    theories: Array.isArray(source.theories) ? source.theories as TheoryRecord[] : [],
    suspicions: Array.isArray(source.suspicions) ? source.suspicions as SuspicionRecord[] : [],
    dossiers: Array.isArray(source.dossiers) ? source.dossiers as WallDossierRecord[] : [],
    walls: Array.isArray(source.walls) ? source.walls as WallRecord[] : [],
    mindMapNodes: Array.isArray(source.mindMapNodes) ? source.mindMapNodes : [],
    updatedAt: String(source.updatedAt || now()),
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
  localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeArchive(state)));
}

function hasLocalArchive(): boolean {
  try {
    return Boolean(localStorage.getItem(LOCAL_KEY));
  } catch {
    return false;
  }
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => window.setTimeout(() => reject(new Error('Cloud archive request timed out.')), ms));
}

export async function loadCloudArchive(user: User): Promise<V2ArchiveState> {
  const local = loadLocalArchive(user);
  if (hasLocalArchive()) return local;

  try {
    const request = supabase
      .from('archive_states')
      .select('state')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    const { data, error } = await Promise.race([request, timeoutAfter(CLOUD_READ_TIMEOUT_MS)]);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row?.state) return local;
    const raw = row.state as Record<string, unknown>;
    const candidate = raw.v2Archive && typeof raw.v2Archive === 'object' ? raw.v2Archive : raw;
    const cloud = normalizeArchive(candidate, user);
    saveLocalArchive(cloud);
    return cloud;
  } catch {
    return local;
  }
}

export async function saveCloudArchive(user: User, state: V2ArchiveState): Promise<void> {
  const next = normalizeArchive({ ...state, updatedAt: now() }, user);
  saveLocalArchive(next);

  const { data: rows, error: readError } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (readError) throw readError;

  const existing = Array.isArray(rows) ? rows[0] : undefined;
  const legacyState = existing?.state && typeof existing.state === 'object'
    ? existing.state as Record<string, unknown>
    : {};
  const payload = { state: { ...legacyState, v2Archive: next }, updated_at: now() };

  if (existing) {
    const { error: updateError } = await supabase
      .from('archive_states')
      .update(payload)
      .eq('user_id', user.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from('archive_states')
    .insert({ user_id: user.id, ...payload });
  if (insertError) throw insertError;
}
