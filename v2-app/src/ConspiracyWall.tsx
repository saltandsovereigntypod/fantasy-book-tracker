import { useEffect, useMemo, useRef, useState } from 'react';
import type { V2ArchiveState } from './archive';
import type { WallCardRecord, WallRecord, WallRegionLayout, WallRegionRecord, WallRegionRule, WallRegionSort, WallSourceType } from './domain';
import './conspiracy-wall.css';

type Interaction =
  | { kind: 'card-move'; id: string; startX: number; startY: number; x: number; y: number }
  | { kind: 'card-resize'; id: string; startX: number; startY: number; width: number; height: number }
  | { kind: 'region-move'; id: string; startX: number; startY: number; x: number; y: number; children: Array<{ id: string; x: number; y: number }> }
  | { kind: 'region-resize'; id: string; startX: number; startY: number; width: number; height: number };

type WallSource = {
  type: WallSourceType;
  id: string;
  title: string;
  subtitle: string;
  body: string;
  status?: string;
  confidence?: number;
  bookIds: string[];
  updatedAt?: string;
};

type TypeFilter = 'all' | WallSourceType;
type StatusFilter = 'all' | 'open' | 'resolved';

const WALL_KEY = 'empyrean-v2-active-wall';
const ZOOM_KEY = 'empyrean-v2-wall-zoom';
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const REGION_HEADER_HEIGHT = 56;
const RULE_LABELS: Record<WallRegionRule, string> = {
  manual: 'Manual placement',
  any: 'Any unassigned card',
  book: 'Books',
  theory: 'Theories',
  suspicion: 'Suspicions',
  'open-investigation': 'Open investigations',
  'resolved-investigation': 'Resolved investigations',
};

function timestamp() { return new Date().toISOString(); }
function readActiveWall() { try { return localStorage.getItem(WALL_KEY) || ''; } catch { return ''; } }
function readZoom(wallId: string) {
  try {
    const values = JSON.parse(localStorage.getItem(ZOOM_KEY) || '{}') as Record<string, number>;
    const value = Number(values[wallId]);
    return Number.isFinite(value) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) : 1;
  } catch { return 1; }
}
function saveZoom(wallId: string, zoom: number) {
  try {
    const values = JSON.parse(localStorage.getItem(ZOOM_KEY) || '{}') as Record<string, number>;
    values[wallId] = zoom;
    localStorage.setItem(ZOOM_KEY, JSON.stringify(values));
  } catch { /* storage unavailable */ }
}
function alphaColor(color: string, alpha = '2e') { return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : '#a64f242e'; }
function defaultWall(title = 'Primary Conspiracy Wall'): WallRecord {
  const now = timestamp();
  return { id: crypto.randomUUID(), title, cards: [], regions: [], canvasWidth: 1800, canvasHeight: 1100, createdAt: now, updatedAt: now };
}
function isResolved(status?: string) { return status === 'confirmed' || status === 'disproven' || status === 'resolved' || status === 'dismissed' || status === 'completed'; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

export function ConspiracyWall({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const fallbackRef = useRef<WallRecord>(defaultWall());
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const movedRef = useRef(false);
  const initialId = readActiveWall();
  const [activeWallId, setActiveWallId] = useState(initialId);
  const [sourceSearch, setSourceSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showRegions, setShowRegions] = useState(true);
  const [zoom, setZoom] = useState(() => readZoom(initialId || 'default'));
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [settingsRegionId, setSettingsRegionId] = useState<string | null>(null);
  const [appearanceRegionId, setAppearanceRegionId] = useState('');

  const wall = archive.walls.find((item) => item.id === activeWallId) ?? archive.walls[0] ?? fallbackRef.current;
  const previewCard = wall.cards.find((card) => card.id === previewCardId) ?? null;
  const settingsRegion = wall.regions.find((region) => region.id === settingsRegionId) ?? null;

  useEffect(() => { setZoom(readZoom(wall.id)); }, [wall.id]);

  const allSources = useMemo<WallSource[]>(() => [
    ...archive.books.map((book) => ({
      type: 'book' as const,
      id: book.id,
      title: book.title,
      subtitle: book.author || book.series || 'Book',
      body: book.summary || book.about || book.reaction || 'No book summary has been added yet.',
      status: book.status,
      bookIds: [book.id],
      updatedAt: book.updatedAt,
    })),
    ...archive.theories.map((item) => ({
      type: 'theory' as const,
      id: item.id,
      title: item.title,
      subtitle: `${item.confidence}% confidence · ${item.status}`,
      body: item.statement,
      status: item.status,
      confidence: item.confidence,
      bookIds: item.bookIds,
      updatedAt: item.updatedAt,
    })),
    ...archive.suspicions.map((item) => ({
      type: 'suspicion' as const,
      id: item.id,
      title: item.title,
      subtitle: `${item.confidence}% confidence · ${item.status}`,
      body: item.details,
      status: item.status,
      confidence: item.confidence,
      bookIds: item.bookIds,
      updatedAt: item.updatedAt,
    })),
  ], [archive.books, archive.theories, archive.suspicions]);

  const availableSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    return allSources.filter((source) => {
      const hasHome = wall.cards.some((card) => card.kind === 'home' && card.sourceType === source.type && card.sourceId === source.id);
      return !hasHome && (!query || `${source.title} ${source.subtitle} ${source.type}`.toLowerCase().includes(query));
    }).slice(0, 30);
  }, [allSources, sourceSearch, wall.cards]);

  const filteredCardIds = useMemo(() => {
    const query = cardSearch.trim().toLowerCase();
    return new Set(wall.cards.filter((card) => {
      const source = allSources.find((item) => item.type === card.sourceType && item.id === card.sourceId);
      if (!source) return false;
      if (typeFilter !== 'all' && source.type !== typeFilter) return false;
      if (statusFilter === 'open' && isResolved(source.status)) return false;
      if (statusFilter === 'resolved' && !isResolved(source.status)) return false;
      if (regionFilter !== 'all' && (regionFilter === 'unassigned' ? Boolean(card.regionId) : card.regionId !== regionFilter)) return false;
      return !query || `${source.title} ${source.subtitle} ${source.body} ${card.note || ''}`.toLowerCase().includes(query);
    }).map((card) => card.id));
  }, [allSources, cardSearch, regionFilter, statusFilter, typeFilter, wall.cards]);

  function sourceFor(card: WallCardRecord | null) { return card ? allSources.find((item) => item.type === card.sourceType && item.id === card.sourceId) : undefined; }
  function homeFor(card: WallCardRecord) { return card.kind === 'home' ? card : wall.cards.find((item) => item.id === card.homeCardId) ?? wall.cards.find((item) => item.kind === 'home' && item.sourceType === card.sourceType && item.sourceId === card.sourceId); }
  function setActive(id: string) { setActiveWallId(id); try { localStorage.setItem(WALL_KEY, id); } catch { /* unavailable */ } setShowBoardMenu(false); }
  function changeZoom(next: number) { const value = clamp(Math.round(next * 100) / 100, MIN_ZOOM, MAX_ZOOM); setZoom(value); saveZoom(wall.id, value); }
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)); }

  async function saveWalls(walls: WallRecord[]) { await onSave({ ...archive, walls }); }
  async function saveWall(nextWall: WallRecord) {
    const stamped = { ...nextWall, updatedAt: timestamp() };
    const walls = archive.walls.some((item) => item.id === stamped.id) ? archive.walls.map((item) => item.id === stamped.id ? stamped : item) : [...archive.walls, stamped];
    await saveWalls(walls);
  }

  async function createBoard() {
    const next = defaultWall(`Conspiracy Wall ${archive.walls.length + 1}`);
    await saveWalls([...archive.walls, next]);
    setActive(next.id);
  }
  async function duplicateBoard() {
    const now = timestamp();
    const regionIds = new Map(wall.regions.map((region) => [region.id, crypto.randomUUID()]));
    const homeIds = new Map(wall.cards.filter((card) => card.kind === 'home').map((card) => [card.id, crypto.randomUUID()]));
    const cardIds = new Map(wall.cards.map((card) => [card.id, card.kind === 'home' ? homeIds.get(card.id)! : crypto.randomUUID()]));
    const next: WallRecord = {
      ...structuredClone(wall),
      id: crypto.randomUUID(),
      title: `${wall.title} Copy`,
      createdAt: now,
      updatedAt: now,
      regions: wall.regions.map((region) => ({ ...region, id: regionIds.get(region.id)!, createdAt: now, updatedAt: now })),
      cards: wall.cards.map((card) => ({
        ...card,
        id: cardIds.get(card.id)!,
        homeCardId: card.homeCardId ? homeIds.get(card.homeCardId) : undefined,
        regionId: card.regionId ? regionIds.get(card.regionId) : undefined,
        createdAt: now,
        updatedAt: now,
      })),
    };
    await saveWalls([...archive.walls, next]);
    setActive(next.id);
  }
  async function deleteBoard() {
    if (!archive.walls.some((item) => item.id === wall.id)) return;
    if (!window.confirm(`Delete “${wall.title}” and all of its wall placements?`)) return;
    const remaining = archive.walls.filter((item) => item.id !== wall.id);
    await saveWalls(remaining);
    setActive(remaining[0]?.id || '');
  }

  function matchesRegion(source: WallSource | undefined, rule: WallRegionRule) {
    if (!source || rule === 'manual') return false;
    if (rule === 'any') return true;
    if (rule === 'book' || rule === 'theory' || rule === 'suspicion') return source.type === rule;
    if (source.type === 'book') return false;
    return rule === 'open-investigation' ? !isResolved(source.status) : isResolved(source.status);
  }

  function sortCardsForRegion(cards: WallCardRecord[], region: WallRegionRecord) {
    const sort = region.sort ?? 'manual';
    if (sort === 'manual') return cards;
    return [...cards].sort((a, b) => {
      const sourceA = sourceFor(a);
      const sourceB = sourceFor(b);
      if (sort === 'alphabetical') return (sourceA?.title || '').localeCompare(sourceB?.title || '');
      if (sort === 'confidence') return (sourceB?.confidence || 0) - (sourceA?.confidence || 0);
      return String(sourceB?.updatedAt || '').localeCompare(String(sourceA?.updatedAt || ''));
    });
  }

  function layoutRegionCards(input: WallRecord, region: WallRegionRecord) {
    const cards = sortCardsForRegion(input.cards.filter((card) => card.regionId === region.id && card.kind === 'home'), region);
    if (!cards.length || region.layout === 'free') return input;
    const updates = new Map<string, Partial<WallCardRecord>>();
    if (region.layout === 'list') {
      cards.forEach((card, index) => updates.set(card.id, { x: region.x + 18, y: region.y + REGION_HEADER_HEIGHT + 16 + index * 128, width: Math.max(190, region.width - 36), height: 112 }));
    } else {
      const width = 210;
      const height = 190;
      const columns = Math.max(1, Math.floor((region.width - 36) / (width + 14)));
      cards.forEach((card, index) => updates.set(card.id, { x: region.x + 18 + (index % columns) * (width + 14), y: region.y + REGION_HEADER_HEIGHT + 16 + Math.floor(index / columns) * (height + 14), width, height }));
    }
    return { ...input, cards: input.cards.map((card) => updates.has(card.id) ? { ...card, ...updates.get(card.id), updatedAt: timestamp() } : card) };
  }

  function sortedWall(input: WallRecord) {
    let next = input;
    const autoRegions = input.regions.filter((region) => region.autoSort && region.rule !== 'manual');
    if (autoRegions.length) {
      const counts = new Map<string, number>();
      next = {
        ...next,
        cards: next.cards.map((card) => {
          if (card.kind === 'reference') return card;
          const source = sourceFor(card);
          const region = autoRegions.find((candidate) => matchesRegion(source, candidate.rule));
          if (!region) return card;
          const index = counts.get(region.id) ?? 0;
          counts.set(region.id, index + 1);
          return { ...card, regionId: region.id, x: region.x + 18 + (index % 2) * 224, y: region.y + REGION_HEADER_HEIGHT + 16 + Math.floor(index / 2) * 204, width: 210, height: 190, updatedAt: timestamp() };
        }),
      };
    }
    next.regions.forEach((region) => { next = layoutRegionCards(next, region); });
    return next;
  }

  async function addHomeCard(sourceType: WallSourceType, sourceId: string) {
    const index = wall.cards.length;
    const now = timestamp();
    const card: WallCardRecord = {
      id: crypto.randomUUID(), sourceType, sourceId, kind: 'home',
      x: 70 + (index % 5) * 245, y: 90 + Math.floor(index / 5) * 280,
      width: 230, height: 250,
      color: sourceType === 'suspicion' ? '#9b4f72' : sourceType === 'theory' ? '#b55b2a' : '#6b7f9d',
      createdAt: now, updatedAt: now,
    };
    await saveWall(sortedWall({ ...wall, cards: [...wall.cards, card] }));
    setSourceSearch('');
  }

  async function addAppearance(homeCard: WallCardRecord, regionId: string) {
    const region = wall.regions.find((item) => item.id === regionId);
    if (!region) return;
    const existing = wall.cards.some((card) => card.kind === 'reference' && card.homeCardId === homeCard.id && card.regionId === region.id);
    if (existing) return;
    const appearances = wall.cards.filter((card) => card.regionId === region.id).length;
    const now = timestamp();
    const card: WallCardRecord = {
      id: crypto.randomUUID(), sourceType: homeCard.sourceType, sourceId: homeCard.sourceId, kind: 'reference', homeCardId: homeCard.id,
      regionId: region.id, x: region.x + 20 + (appearances % 3) * 190, y: region.y + REGION_HEADER_HEIGHT + 18 + Math.floor(appearances / 3) * 118,
      width: 176, height: 104, color: homeCard.color, createdAt: now, updatedAt: now,
    };
    await saveWall({ ...wall, cards: [...wall.cards, card] });
    setAppearanceRegionId('');
  }

  async function updateCard(id: string, changes: Partial<WallCardRecord>) { await saveWall({ ...wall, cards: wall.cards.map((card) => card.id === id ? { ...card, ...changes, updatedAt: timestamp() } : card) }); }
  async function removeCard(id: string) {
    const card = wall.cards.find((item) => item.id === id);
    const removedIds = new Set([id]);
    if (card?.kind === 'home') wall.cards.filter((item) => item.homeCardId === id).forEach((item) => removedIds.add(item.id));
    await saveWall({ ...wall, cards: wall.cards.filter((item) => !removedIds.has(item.id)) });
    if (previewCardId && removedIds.has(previewCardId)) setPreviewCardId(null);
  }

  async function addRegion() {
    const index = wall.regions.length;
    const now = timestamp();
    const region: WallRegionRecord = {
      id: crypto.randomUUID(), title: `Region ${index + 1}`, description: '',
      x: 50 + (index % 2) * 620, y: 50 + Math.floor(index / 2) * 450,
      width: 570, height: 390, color: '#76567f', rule: 'manual', autoSort: false,
      collapsed: false, locked: false, layout: 'free', sort: 'manual', createdAt: now, updatedAt: now,
    };
    await saveWall({ ...wall, regions: [...wall.regions, region] });
    setShowRegions(true);
    setSettingsRegionId(region.id);
  }

  async function updateRegion(id: string, changes: Partial<WallRegionRecord>, shouldSort = false) {
    let next: WallRecord = { ...wall, regions: wall.regions.map((region) => region.id === id ? { ...region, ...changes, updatedAt: timestamp() } : region) };
    const region = next.regions.find((item) => item.id === id);
    if (region && shouldSort) next = layoutRegionCards(sortedWall(next), region);
    await saveWall(next);
  }

  async function removeRegion(id: string) {
    await saveWall({ ...wall, regions: wall.regions.filter((region) => region.id !== id), cards: wall.cards.map((card) => card.regionId === id ? { ...card, regionId: undefined } : card) });
    setSettingsRegionId(null);
  }

  async function autoSort() { await saveWall(sortedWall(wall)); }

  function fitBoard() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const content = [...wall.regions.map((region) => ({ x: region.x, y: region.y, width: region.width, height: region.collapsed ? REGION_HEADER_HEIGHT : region.height })), ...wall.cards.filter((card) => !card.regionId || !wall.regions.find((region) => region.id === card.regionId)?.collapsed).map((card) => ({ x: card.x, y: card.y, width: card.width, height: card.height }))];
    const maxX = Math.max(900, ...content.map((item) => item.x + item.width + 80));
    const maxY = Math.max(600, ...content.map((item) => item.y + item.height + 80));
    changeZoom(Math.min(1, (viewport.clientWidth - 32) / maxX, (viewport.clientHeight - 32) / maxY));
    viewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  function focusRegion(region: WallRegionRecord) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = clamp(Math.min((viewport.clientWidth - 80) / region.width, (viewport.clientHeight - 80) / (region.collapsed ? REGION_HEADER_HEIGHT : region.height), 1.35), MIN_ZOOM, MAX_ZOOM);
    changeZoom(nextZoom);
    requestAnimationFrame(() => viewport.scrollTo({ left: Math.max(0, region.x * nextZoom - 36), top: Math.max(0, region.y * nextZoom - 36), behavior: 'smooth' }));
  }

  function regionAt(x: number, y: number, width: number, height: number) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return wall.regions.find((region) => centerX >= region.x && centerX <= region.x + region.width && centerY >= region.y + REGION_HEADER_HEIGHT && centerY <= region.y + region.height);
  }

  function beginInteraction(event: React.PointerEvent<HTMLElement>, interaction: Interaction) {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select') && !target.closest('.wall-resize-handle')) return;
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = interaction;
  }

  function moveInteraction(event: React.PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const dx = (event.clientX - interaction.startX) / zoom;
    const dy = (event.clientY - interaction.startY) / zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
    const element = event.currentTarget as HTMLElement;
    if (interaction.kind.endsWith('move')) {
      element.style.left = `${Math.max(0, interaction.x + dx)}px`;
      element.style.top = `${Math.max(0, interaction.y + dy)}px`;
      if (interaction.kind === 'region-move') {
        interaction.children.forEach((child) => {
          const node = document.querySelector<HTMLElement>(`[data-wall-card-id="${child.id}"]`);
          if (node) { node.style.left = `${Math.max(0, child.x + dx)}px`; node.style.top = `${Math.max(0, child.y + dy)}px`; }
        });
      }
    } else {
      element.style.width = `${Math.max(interaction.kind === 'card-resize' ? 150 : 260, interaction.width + dx)}px`;
      element.style.height = `${Math.max(interaction.kind === 'card-resize' ? 100 : 220, interaction.height + dy)}px`;
    }
  }

  function endInteraction(event: React.PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    interactionRef.current = null;
    const dx = (event.clientX - interaction.startX) / zoom;
    const dy = (event.clientY - interaction.startY) / zoom;
    if (interaction.kind === 'card-move') {
      const card = wall.cards.find((item) => item.id === interaction.id);
      if (!card) return;
      const x = Math.max(0, Math.round(interaction.x + dx));
      const y = Math.max(0, Math.round(interaction.y + dy));
      const region = regionAt(x, y, card.width, card.height);
      updateCard(card.id, { x, y, regionId: region?.id }).catch(console.error);
    }
    if (interaction.kind === 'card-resize') updateCard(interaction.id, { width: Math.max(150, Math.round(interaction.width + dx)), height: Math.max(100, Math.round(interaction.height + dy)) }).catch(console.error);
    if (interaction.kind === 'region-move') {
      const x = Math.max(0, Math.round(interaction.x + dx));
      const y = Math.max(0, Math.round(interaction.y + dy));
      const cards = wall.cards.map((card) => {
        const child = interaction.children.find((item) => item.id === card.id);
        return child ? { ...card, x: Math.max(0, Math.round(child.x + dx)), y: Math.max(0, Math.round(child.y + dy)), updatedAt: timestamp() } : card;
      });
      saveWall({ ...wall, regions: wall.regions.map((region) => region.id === interaction.id ? { ...region, x, y, updatedAt: timestamp() } : region), cards }).catch(console.error);
    }
    if (interaction.kind === 'region-resize') updateRegion(interaction.id, { width: Math.max(260, Math.round(interaction.width + dx)), height: Math.max(220, Math.round(interaction.height + dy)) }).catch(console.error);
  }

  function openPreview(card: WallCardRecord) { if (movedRef.current) return; setPreviewCardId(card.id); setNoteText(homeFor(card)?.note || card.note || ''); setAppearanceRegionId(''); }
  function jumpToHome(card: WallCardRecord) {
    const home = homeFor(card);
    if (!home) return;
    const viewport = viewportRef.current;
    viewport?.scrollTo({ left: Math.max(0, home.x * zoom - 120), top: Math.max(0, home.y * zoom - 120), behavior: 'smooth' });
    setPreviewCardId(home.id);
  }
  async function savePreviewNote() {
    if (!previewCard) return;
    const home = homeFor(previewCard);
    if (!home) return;
    await updateCard(home.id, { note: noteText.trim() || undefined });
  }

  const previewSource = sourceFor(previewCard);
  const previewHome = previewCard ? homeFor(previewCard) : undefined;
  const previewAppearances = previewHome ? wall.cards.filter((card) => card.homeCardId === previewHome.id) : [];

  return <div className="wall-module">
    <header className="wall-main-header">
      <div><p>Investigation Board</p><h2>Conspiracy Wall</h2><span>{wall.cards.filter((card) => card.kind === 'home').length} dossiers · {wall.cards.filter((card) => card.kind === 'reference').length} appearances · {wall.regions.length} regions</span></div>
      <div className="wall-header-actions"><button onClick={createBoard}>+ Board</button><button className="wall-icon-button" aria-label="More board options" onClick={() => setShowBoardMenu((value) => !value)}>☰</button>{showBoardMenu && <div className="wall-popover"><button onClick={duplicateBoard}>Duplicate board</button><button onClick={() => setShowRegions((value) => !value)}>{showRegions ? 'Hide' : 'Show'} regions</button><button className="is-danger" disabled={!archive.walls.some((item) => item.id === wall.id)} onClick={deleteBoard}>Delete board</button></div>}</div>
    </header>

    <section className="wall-compact-toolbar">
      <label className="wall-board-switcher"><span>Wall</span><select value={wall.id} onChange={(event) => setActive(event.target.value)}>{archive.walls.length ? archive.walls.map((item) => <option key={item.id} value={item.id}>{item.title}</option>) : <option value={wall.id}>{wall.title}</option>}</select></label>
      <div className="wall-toolbar-actions"><button onClick={addRegion}>+ Region</button><button onClick={() => setShowFilters((value) => !value)}>⌕ Filters</button><button disabled={!wall.regions.some((region) => region.autoSort)} onClick={autoSort}>Auto-sort</button><div className="wall-zoom-group"><button onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>−</button><strong>{Math.round(zoom * 100)}%</strong><button onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>+</button><button onClick={fitBoard}>Fit</button></div></div>
    </section>

    {showFilters && <section className="wall-filter-drawer">
      <input value={cardSearch} onChange={(event) => setCardSearch(event.target.value)} placeholder="Search cards and notes…" />
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}><option value="all">All types</option><option value="book">Books</option><option value="theory">Theories</option><option value="suspicion">Suspicions</option></select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option></select>
      <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">All regions</option><option value="unassigned">Unassigned</option>{wall.regions.map((region) => <option key={region.id} value={region.id}>{region.title}</option>)}</select>
      <button onClick={() => { setCardSearch(''); setTypeFilter('all'); setStatusFilter('all'); setRegionFilter('all'); }}>Clear</button>
    </section>}

    <section className="wall-add-source"><label>Add dossier<input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Search books, theories, or suspicions…" /></label>{sourceSearch && <div className="wall-source-results">{availableSources.length ? availableSources.map((source) => <button key={`${source.type}-${source.id}`} onClick={() => addHomeCard(source.type, source.id)}><strong>{source.title}</strong><span>{source.type} · {source.subtitle}</span></button>) : <p>No new dossiers match.</p>}</div>}</section>

    <div className="wall-viewport" ref={viewportRef} onWheel={handleWheel}><div className="wall-zoom-surface" style={{ width: wall.canvasWidth * zoom, height: wall.canvasHeight * zoom }}><section className="wall-canvas" style={{ width: wall.canvasWidth, height: wall.canvasHeight, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
      {showRegions && wall.regions.map((region) => {
        const children = wall.cards.filter((card) => card.regionId === region.id);
        return <article key={region.id} className={`wall-region${region.collapsed ? ' is-collapsed' : ''}${region.locked ? ' is-locked' : ''}`} style={{ left: region.x, top: region.y, width: region.width, height: region.collapsed ? REGION_HEADER_HEIGHT : region.height, borderColor: region.color, backgroundColor: alphaColor(region.color, '12') }} onPointerDown={(event) => { if (region.locked) return; beginInteraction(event, { kind: 'region-move', id: region.id, startX: event.clientX, startY: event.clientY, x: region.x, y: region.y, children: children.map((card) => ({ id: card.id, x: card.x, y: card.y })) }); }} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction}>
          <header><div><strong>{region.title}</strong><span>{region.description || `${children.length} placement${children.length === 1 ? '' : 's'}`}</span></div><nav><button onClick={() => focusRegion(region)}>Focus</button><button onClick={() => updateRegion(region.id, { collapsed: !region.collapsed })}>{region.collapsed ? 'Expand' : 'Collapse'}</button><button onClick={() => setSettingsRegionId(region.id)}>•••</button></nav></header>
          {!region.collapsed && !region.locked && <button className="wall-resize-handle" aria-label={`Resize ${region.title}`} onPointerDown={(event) => { event.stopPropagation(); beginInteraction(event, { kind: 'region-resize', id: region.id, startX: event.clientX, startY: event.clientY, width: region.width, height: region.height }); }} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />}
        </article>;
      })}

      {wall.cards.map((card) => {
        const source = sourceFor(card);
        const region = card.regionId ? wall.regions.find((item) => item.id === card.regionId) : undefined;
        if (region?.collapsed || !filteredCardIds.has(card.id)) return null;
        const color = card.color || '#a64f24';
        const home = homeFor(card);
        const appearances = card.kind === 'home' ? wall.cards.filter((item) => item.homeCardId === card.id).length : 0;
        return <article key={card.id} data-wall-card-id={card.id} className={`wall-card is-${card.sourceType} is-${card.kind}`} style={{ left: card.x, top: card.y, width: card.width, height: card.height, borderColor: color, background: `linear-gradient(145deg, ${alphaColor(color, card.kind === 'reference' ? '26' : '42')}, rgba(17,9,6,.96))` }} onClick={() => openPreview(card)} onPointerDown={(event) => beginInteraction(event, { kind: 'card-move', id: card.id, startX: event.clientX, startY: event.clientY, x: card.x, y: card.y })} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction}>
          <header><span>{card.kind === 'reference' ? '↗ Appearance' : source?.type}</span><button title="Remove placement" onClick={(event) => { event.stopPropagation(); removeCard(card.id); }}>×</button></header>
          <h3>{source?.title || 'Missing record'}</h3>
          {card.kind === 'home' ? <><p className="wall-card-body">{source?.body}</p>{home?.note && <blockquote>{home.note}</blockquote>}</> : <p className="wall-reference-copy">Linked to the home dossier{region ? ` · ${region.title}` : ''}</p>}
          <footer><span>{source?.status || source?.subtitle}</span>{card.kind === 'home' && <span>{appearances} appearance{appearances === 1 ? '' : 's'}</span>}{card.kind === 'reference' && <button onClick={(event) => { event.stopPropagation(); jumpToHome(card); }}>Home</button>}</footer>
          <button className="wall-resize-handle" aria-label={`Resize ${source?.title || 'card'}`} onPointerDown={(event) => { event.stopPropagation(); beginInteraction(event, { kind: 'card-resize', id: card.id, startX: event.clientX, startY: event.clientY, width: card.width, height: card.height }); }} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />
        </article>;
      })}
      {!wall.cards.length && <div className="wall-empty"><span>✣</span><h3>Your wall is empty</h3><p>Search above to add the first dossier.</p></div>}
    </section></div></div>

    {settingsRegion && <div className="wall-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsRegionId(null); }}><section className="wall-settings-modal" role="dialog" aria-modal="true"><header><div><p>Canvas Region</p><h3>Edit Region</h3></div><button onClick={() => setSettingsRegionId(null)}>×</button></header><div className="wall-settings-grid">
      <label>Name<input value={settingsRegion.title} onChange={(event) => updateRegion(settingsRegion.id, { title: event.target.value })} /></label>
      <label>Color<input type="color" value={settingsRegion.color} onChange={(event) => updateRegion(settingsRegion.id, { color: event.target.value })} /></label>
      <label className="is-wide">Description<textarea rows={3} value={settingsRegion.description || ''} onChange={(event) => updateRegion(settingsRegion.id, { description: event.target.value })} /></label>
      <label>Layout<select value={settingsRegion.layout || 'free'} onChange={(event) => updateRegion(settingsRegion.id, { layout: event.target.value as WallRegionLayout }, true)}><option value="free">Free</option><option value="grid">Grid</option><option value="list">List</option></select></label>
      <label>Sort<select value={settingsRegion.sort || 'manual'} onChange={(event) => updateRegion(settingsRegion.id, { sort: event.target.value as WallRegionSort }, true)}><option value="manual">Manual</option><option value="alphabetical">Alphabetical</option><option value="updated">Recently updated</option><option value="confidence">Confidence</option></select></label>
      <label>Assignment<select value={settingsRegion.rule} onChange={(event) => updateRegion(settingsRegion.id, { rule: event.target.value as WallRegionRule }, settingsRegion.autoSort)}>{Object.entries(RULE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="wall-check"><input type="checkbox" checked={settingsRegion.autoSort} onChange={(event) => updateRegion(settingsRegion.id, { autoSort: event.target.checked }, event.target.checked)} />Automatic assignment</label>
      <label className="wall-check"><input type="checkbox" checked={Boolean(settingsRegion.locked)} onChange={(event) => updateRegion(settingsRegion.id, { locked: event.target.checked })} />Lock region</label>
    </div><footer><button onClick={() => focusRegion(settingsRegion)}>Focus</button><button onClick={() => updateRegion(settingsRegion.id, { collapsed: !settingsRegion.collapsed })}>{settingsRegion.collapsed ? 'Expand' : 'Collapse'}</button><button className="is-danger" onClick={() => removeRegion(settingsRegion.id)}>Delete Region</button><button className="is-primary" onClick={() => setSettingsRegionId(null)}>Done</button></footer></section></div>}

    {previewCard && previewSource && previewHome && <div className="wall-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewCardId(null); }}><section className="wall-dossier-modal" role="dialog" aria-modal="true"><header className="wall-dossier-hero" style={{ borderTopColor: previewHome.color || '#a64f24' }}><div className="wall-dossier-avatar">{previewSource.title.slice(0, 1).toUpperCase()}</div><div><p>{previewSource.type} Record</p><h3>{previewSource.title}</h3><div className="wall-dossier-tags"><span>{previewSource.status || 'Open'}</span>{previewSource.bookIds.map((bookId) => <span key={bookId}>{archive.books.find((book) => book.id === bookId)?.title || 'Linked book'}</span>)}</div></div><button className="wall-modal-close" onClick={() => setPreviewCardId(null)}>×</button></header><div className="wall-dossier-content">
      <section><h4>Overview</h4><p>{previewSource.body || 'No overview has been added yet.'}</p></section>
      {previewSource.confidence != null && <section><h4>Confidence</h4><div className="wall-confidence"><span style={{ width: `${previewSource.confidence}%` }} /><strong>{previewSource.confidence}%</strong></div></section>}
      <section><div className="wall-section-heading"><h4>Wall Note</h4><span>Shared by every appearance</span></div><textarea rows={5} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Record the clue, contradiction, or thread…" /><button onClick={savePreviewNote}>Save note</button></section>
      <section><div className="wall-section-heading"><h4>Appearances</h4><span>{previewAppearances.length} linked placement{previewAppearances.length === 1 ? '' : 's'}</span></div>{previewAppearances.length ? <div className="wall-appearance-list">{previewAppearances.map((appearance) => <button key={appearance.id} onClick={() => { setPreviewCardId(appearance.id); const region = wall.regions.find((item) => item.id === appearance.regionId); if (region) focusRegion(region); }}>{wall.regions.find((region) => region.id === appearance.regionId)?.title || 'Unassigned appearance'}</button>)}</div> : <p>No reference appearances yet.</p>}
        <div className="wall-add-appearance"><select value={appearanceRegionId} onChange={(event) => setAppearanceRegionId(event.target.value)}><option value="">Choose a region…</option>{wall.regions.filter((region) => region.id !== previewHome.regionId && !wall.cards.some((card) => card.kind === 'reference' && card.homeCardId === previewHome.id && card.regionId === region.id)).map((region) => <option key={region.id} value={region.id}>{region.title}</option>)}</select><button disabled={!appearanceRegionId} onClick={() => addAppearance(previewHome, appearanceRegionId)}>Add appearance</button></div>
      </section>
      <details><summary>Record details</summary><p>{previewSource.subtitle}</p><p>Home region: {wall.regions.find((region) => region.id === previewHome.regionId)?.title || 'Unassigned'}</p></details>
    </div><footer><button onClick={() => jumpToHome(previewCard)}>Jump to home</button><button className="is-primary" onClick={() => setPreviewCardId(null)}>Close</button></footer></section></div>}
  </div>;
}
