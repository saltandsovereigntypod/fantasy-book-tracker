import { useEffect, useMemo, useRef, useState } from 'react';
import type { V2ArchiveState } from './archive';
import { MindMapEnhanced } from './MindMapEnhanced';
import './mind-map-workspace.css';

type Point = { x: number; y: number };
type Viewport = { x: number; y: number; zoom: number };
type MapEdge = { id: string; from: string; to: string; label: string; explanation?: string };
type MapNode = { id: string; title: string; category: string; summary: string };
type SavedMap = {
  kind: 'v2-mind-map';
  id: string;
  title: string;
  layout?: string;
  scope?: string;
  wallId?: string;
  query?: string;
  typeFilter?: string;
  bookId?: string;
  status?: string;
  hideIsolates?: boolean;
  showLabels?: boolean;
  hiddenIds?: string[];
  positions?: Record<string, Point>;
  customNodes?: Array<{ id: string; title: string; summary?: string; color?: string }>;
  customEdges?: MapEdge[];
  viewport?: Viewport;
  updatedAt?: string;
};

type HistoryEntry = { map: SavedMap; label: string };

const ACTIVE_MAP_KEY = 'empyrean-v2-active-mind-map';
const MAX_HISTORY = 40;

function isSavedMap(value: unknown): value is SavedMap {
  return Boolean(value && typeof value === 'object' && (value as { kind?: string }).kind === 'v2-mind-map');
}

function cloneMap(map: SavedMap): SavedMap {
  return structuredClone(map);
}

function mapsFromArchive(archive: V2ArchiveState): SavedMap[] {
  const maps = archive.mindMapNodes.filter(isSavedMap);
  if (maps.length) return maps;
  return [{
    kind: 'v2-mind-map', id: 'primary-mind-map', title: 'Mind Map', layout: 'force', scope: 'archive', wallId: '', query: '',
    typeFilter: '', bookId: '', status: '', hideIsolates: false, showLabels: true, hiddenIds: [], positions: {}, customNodes: [], customEdges: [],
    viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: new Date().toISOString(),
  }];
}

function graphNodes(archive: V2ArchiveState, map: SavedMap): MapNode[] {
  return [
    ...archive.books.map((book) => ({ id: `book:${book.id}`, title: book.title, category: 'Book', summary: book.summary || book.about || book.reaction || '' })),
    ...archive.theories.map((item) => ({ id: `theory:${item.id}`, title: item.title, category: 'Theory', summary: item.statement || '' })),
    ...archive.suspicions.map((item) => ({ id: `suspicion:${item.id}`, title: item.title, category: 'Suspicion', summary: item.details || '' })),
    ...archive.dossiers.map((item) => ({ id: `dossier:${item.id}`, title: item.title, category: item.category || 'Dossier', summary: item.shortSummary || item.overview || '' })),
    ...(map.customNodes || []).map((item) => ({ id: `custom:${item.id}`, title: item.title, category: 'Note', summary: item.summary || '' })),
  ];
}

function graphEdges(archive: V2ArchiveState, map: SavedMap): MapEdge[] {
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string, label: string) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: key, from, to, label });
  };
  archive.books.forEach((book) => {
    (book.relationships || []).forEach((rel) => add(`book:${book.id}`, `book:${rel.targetBookId}`, rel.type || 'related to'));
    (book.theoryIds || []).forEach((id) => add(`book:${book.id}`, `theory:${id}`, 'supports'));
    (book.suspicionIds || []).forEach((id) => add(`book:${book.id}`, `suspicion:${id}`, 'contains'));
  });
  archive.theories.forEach((item) => item.bookIds.forEach((id) => add(`theory:${item.id}`, `book:${id}`, 'linked book')));
  archive.suspicions.forEach((item) => item.bookIds.forEach((id) => add(`suspicion:${item.id}`, `book:${id}`, 'linked book')));
  archive.dossiers.forEach((item) => {
    item.bookIds.forEach((id) => add(`dossier:${item.id}`, `book:${id}`, 'appears in'));
    item.theoryIds.forEach((id) => add(`dossier:${item.id}`, `theory:${id}`, 'theory'));
    item.suspicionIds.forEach((id) => add(`dossier:${item.id}`, `suspicion:${id}`, 'suspicion'));
    item.dossierIds.forEach((id) => add(`dossier:${item.id}`, `dossier:${id}`, 'related to'));
  });
  (map.customEdges || []).forEach((edge) => add(edge.from, edge.to, edge.label));
  return edges;
}

function filteredNodeIds(archive: V2ArchiveState, map: SavedMap, nodes: MapNode[], edges: MapEdge[]): string[] {
  let result = nodes.filter((node) => !(map.hiddenIds || []).includes(node.id));
  if (map.scope === 'books') result = result.filter((node) => node.id.startsWith('book:'));
  if (map.scope === 'investigations') result = result.filter((node) => node.id.startsWith('theory:') || node.id.startsWith('suspicion:'));
  if (map.scope === 'dossiers') result = result.filter((node) => node.id.startsWith('dossier:'));
  if (map.scope === 'wall') {
    const wall = archive.walls.find((item) => item.id === map.wallId) || archive.walls[0];
    const ids = new Set((wall?.cards || []).map((card) => `${card.sourceType}:${card.sourceId}`));
    result = result.filter((node) => ids.has(node.id));
  }
  if (map.query?.trim()) {
    const query = map.query.toLowerCase();
    result = result.filter((node) => `${node.title} ${node.category} ${node.summary}`.toLowerCase().includes(query));
  }
  if (map.typeFilter) result = result.filter((node) => node.id.startsWith(`${map.typeFilter}:`));
  if (map.hideIsolates) {
    const visible = new Set(result.map((node) => node.id));
    const connected = new Set(edges.flatMap((edge) => visible.has(edge.from) && visible.has(edge.to) ? [edge.from, edge.to] : []));
    result = result.filter((node) => connected.has(node.id));
  }
  return result.map((node) => node.id);
}

export function MindMapWorkspace({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const maps = useMemo(() => mapsFromArchive(archive), [archive.mindMapNodes]);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_MAP_KEY) || maps[0].id; } catch { return maps[0].id; }
  });
  const [revision, setRevision] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [liveMessage, setLiveMessage] = useState('');
  const childRoot = useRef<HTMLDivElement | null>(null);
  const historyLock = useRef(false);
  const lastHistoryAt = useRef(0);

  const activeMap = maps.find((map) => map.id === activeId) || maps[0];
  const nodes = useMemo(() => graphNodes(archive, activeMap), [archive.books, archive.theories, archive.suspicions, archive.dossiers, activeMap.customNodes]);
  const edges = useMemo(() => graphEdges(archive, activeMap), [archive.books, archive.theories, archive.suspicions, archive.dossiers, activeMap.customEdges]);
  const visibleIds = useMemo(() => filteredNodeIds(archive, activeMap, nodes, edges), [archive.walls, activeMap, nodes, edges]);
  const visibleNodes = useMemo(() => visibleIds.map((id) => nodes.find((node) => node.id === id)).filter(Boolean) as MapNode[], [visibleIds, nodes]);
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return nodes.filter((node) => `${node.title} ${node.category} ${node.summary}`.toLowerCase().includes(query)).slice(0, 20);
  }, [search, nodes]);

  useEffect(() => {
    if (maps.some((map) => map.id === activeId)) return;
    setActiveId(maps[0].id);
  }, [maps, activeId]);

  useEffect(() => {
    try { localStorage.setItem(ACTIVE_MAP_KEY, activeMap.id); } catch { /* storage unavailable */ }
    setSelectedIds([]);
    setUndoStack([]);
    setRedoStack([]);
  }, [activeMap.id]);

  function mergeMap(nextMap: SavedMap): V2ArchiveState {
    const nonMaps = archive.mindMapNodes.filter((entry) => !isSavedMap(entry));
    const nextMaps = maps.map((map) => map.id === nextMap.id ? nextMap : map);
    if (!nextMaps.some((map) => map.id === nextMap.id)) nextMaps.push(nextMap);
    return { ...archive, mindMapNodes: [...nonMaps, ...nextMaps] };
  }

  async function saveMap(nextMap: SavedMap, label: string, pushHistory = true) {
    if (pushHistory && !historyLock.current) {
      const now = Date.now();
      setUndoStack((stack) => {
        const entry = { map: cloneMap(activeMap), label };
        if (now - lastHistoryAt.current < 650 && stack.length) return [...stack.slice(0, -1), entry].slice(-MAX_HISTORY);
        return [...stack, entry].slice(-MAX_HISTORY);
      });
      lastHistoryAt.current = now;
      setRedoStack([]);
    }
    await onSave(mergeMap({ ...nextMap, updatedAt: new Date().toISOString() }));
  }

  async function childSave(nextArchive: V2ArchiveState) {
    const nextMap = nextArchive.mindMapNodes.find(isSavedMap);
    if (!nextMap) return;
    await saveMap({ ...nextMap, id: activeMap.id, title: activeMap.title }, 'Map change');
  }

  async function undo() {
    const entry = undoStack.at(-1);
    if (!entry) return;
    historyLock.current = true;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, { map: cloneMap(activeMap), label: entry.label }].slice(-MAX_HISTORY));
    await onSave(mergeMap(entry.map));
    setRevision((value) => value + 1);
    historyLock.current = false;
    setLiveMessage(`Undid ${entry.label}.`);
  }

  async function redo() {
    const entry = redoStack.at(-1);
    if (!entry) return;
    historyLock.current = true;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, { map: cloneMap(activeMap), label: entry.label }].slice(-MAX_HISTORY));
    await onSave(mergeMap(entry.map));
    setRevision((value) => value + 1);
    historyLock.current = false;
    setLiveMessage(`Redid ${entry.label}.`);
  }

  async function createMap(duplicate = false) {
    const title = window.prompt(duplicate ? 'Name the duplicated map:' : 'Name the new map:', duplicate ? `${activeMap.title} copy` : 'New Mind Map')?.trim();
    if (!title) return;
    const id = crypto.randomUUID();
    const next: SavedMap = duplicate
      ? { ...cloneMap(activeMap), id, title, updatedAt: new Date().toISOString() }
      : { ...cloneMap(activeMap), id, title, positions: {}, customNodes: [], customEdges: [], hiddenIds: [], viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: new Date().toISOString() };
    const nonMaps = archive.mindMapNodes.filter((entry) => !isSavedMap(entry));
    await onSave({ ...archive, mindMapNodes: [...nonMaps, ...maps, next] });
    setActiveId(id);
    setRevision((value) => value + 1);
  }

  async function renameMap() {
    const title = window.prompt('Rename this map:', activeMap.title)?.trim();
    if (!title || title === activeMap.title) return;
    await saveMap({ ...activeMap, title }, 'Rename map');
  }

  async function deleteMap() {
    if (maps.length <= 1) return;
    if (!window.confirm(`Delete “${activeMap.title}”? This removes only this saved map, not archive records.`)) return;
    const nonMaps = archive.mindMapNodes.filter((entry) => !isSavedMap(entry));
    const nextMaps = maps.filter((map) => map.id !== activeMap.id);
    await onSave({ ...archive, mindMapNodes: [...nonMaps, ...nextMaps] });
    setActiveId(nextMaps[0].id);
  }

  function centerNode(id: string) {
    const point = activeMap.positions?.[id];
    if (!point) {
      setLiveMessage('That node has no saved position yet. Reset or fit the layout first.');
      return;
    }
    const canvas = childRoot.current?.querySelector<HTMLElement>('.mind-map-canvas');
    const width = canvas?.clientWidth || 1000;
    const height = canvas?.clientHeight || 650;
    const zoom = activeMap.viewport?.zoom || 1;
    saveMap({ ...activeMap, viewport: { zoom, x: width / 2 - (point.x + 92) * zoom, y: height / 2 - (point.y + 49) * zoom } }, 'Center node').then(() => setRevision((value) => value + 1));
    setLiveMessage(`Centered ${nodes.find((node) => node.id === id)?.title || 'node'}.`);
  }

  function adjacency(levels: number) {
    const seen = new Set(selectedIds);
    let frontier = new Set(selectedIds);
    for (let level = 0; level < levels; level += 1) {
      const next = new Set<string>();
      edges.forEach((edge) => {
        if (frontier.has(edge.from) && !seen.has(edge.to)) next.add(edge.to);
        if (frontier.has(edge.to) && !seen.has(edge.from)) next.add(edge.from);
      });
      next.forEach((id) => seen.add(id));
      frontier = next;
    }
    return seen;
  }

  async function focusSelection(levels: number) {
    if (!selectedIds.length) return;
    const keep = adjacency(levels);
    await saveMap({ ...activeMap, hiddenIds: nodes.filter((node) => !keep.has(node.id)).map((node) => node.id) }, `Focus ${levels}-hop neighborhood`);
    setRevision((value) => value + 1);
  }

  async function collapseBranch() {
    const root = selectedIds[0];
    if (!root) return;
    const descendants = new Set<string>();
    const queue = [root];
    while (queue.length) {
      const current = queue.shift()!;
      edges.filter((edge) => edge.from === current).forEach((edge) => {
        if (edge.to !== root && !descendants.has(edge.to)) { descendants.add(edge.to); queue.push(edge.to); }
      });
    }
    await saveMap({ ...activeMap, hiddenIds: [...new Set([...(activeMap.hiddenIds || []), ...descendants])] }, 'Collapse branch');
    setRevision((value) => value + 1);
  }

  async function hideSelected() {
    if (!selectedIds.length) return;
    await saveMap({ ...activeMap, hiddenIds: [...new Set([...(activeMap.hiddenIds || []), ...selectedIds])] }, 'Hide selected nodes');
    setSelectedIds([]);
    setRevision((value) => value + 1);
  }

  async function showAll() {
    await saveMap({ ...activeMap, hiddenIds: [] }, 'Show all nodes');
    setRevision((value) => value + 1);
  }

  async function connectSelected() {
    if (selectedIds.length !== 2) return;
    const label = window.prompt('Connection label:', 'related to')?.trim();
    if (!label) return;
    const explanation = window.prompt('Optional explanation:', '')?.trim() || '';
    const duplicate = (activeMap.customEdges || []).some((edge) => edge.from === selectedIds[0] && edge.to === selectedIds[1] && edge.label.toLowerCase() === label.toLowerCase());
    if (duplicate) { window.alert('That map-only connection already exists.'); return; }
    await saveMap({ ...activeMap, customEdges: [...(activeMap.customEdges || []), { id: crypto.randomUUID(), from: selectedIds[0], to: selectedIds[1], label, explanation }] }, 'Connect selected nodes');
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    const root = childRoot.current;
    if (!root) return;
    const syncButtons = () => {
      const buttons = [...root.querySelectorAll<HTMLElement>('.mind-map-node')];
      buttons.forEach((button, index) => {
        const id = visibleIds[index] || '';
        button.dataset.nodeId = id;
        button.classList.toggle('is-multi-selected', selectedIds.includes(id));
        button.setAttribute('aria-checked', selectedIds.includes(id) ? 'true' : 'false');
      });
    };
    const click = (event: Event) => {
      if (event.defaultPrevented) return;
      const mouse = event as MouseEvent;
      const button = (event.target as Element | null)?.closest<HTMLElement>('.mind-map-node');
      const id = button?.dataset.nodeId;
      if (!id) return;
      if (mouse.shiftKey || mouse.metaKey || mouse.ctrlKey) {
        mouse.preventDefault();
        mouse.stopPropagation();
        setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
      } else {
        setSelectedIds([id]);
      }
    };
    const observer = new MutationObserver(syncButtons);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('click', click);
    syncButtons();
    return () => { observer.disconnect(); root.removeEventListener('click', click); };
  }, [visibleIds.join('|'), selectedIds.join('|'), revision]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (event.key === 'Escape') setSelectedIds([]);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const scopedArchive = useMemo(() => ({ ...archive, mindMapNodes: [activeMap, ...archive.mindMapNodes.filter((entry) => !isSavedMap(entry))] }), [archive, activeMap]);
  const minimapPoints = visibleNodes.map((node) => ({ node, point: activeMap.positions?.[node.id] })).filter((item): item is { node: MapNode; point: Point } => Boolean(item.point));
  const bounds = minimapPoints.length ? {
    minX: Math.min(...minimapPoints.map((item) => item.point.x)), maxX: Math.max(...minimapPoints.map((item) => item.point.x)),
    minY: Math.min(...minimapPoints.map((item) => item.point.y)), maxY: Math.max(...minimapPoints.map((item) => item.point.y)),
  } : null;

  return <div className="mind-map-workspace" ref={childRoot}>
    <nav className="mind-map-suite-bar" aria-label="Mind map management and history">
      <label>Map<select value={activeMap.id} onChange={(event) => { setActiveId(event.target.value); setRevision((value) => value + 1); }}>{maps.map((map) => <option key={map.id} value={map.id}>{map.title}</option>)}</select></label>
      <button onClick={() => createMap(false)}>New</button><button onClick={() => createMap(true)}>Duplicate</button><button onClick={renameMap}>Rename</button><button onClick={deleteMap} disabled={maps.length <= 1}>Delete</button>
      <span className="mind-map-suite-divider" />
      <button onClick={undo} disabled={!undoStack.length} title={undoStack.at(-1)?.label}>↶ Undo</button><button onClick={redo} disabled={!redoStack.length} title={redoStack.at(-1)?.label}>↷ Redo</button>
      <label className="mind-map-jump-search">Jump to<input value={search} onChange={(event) => { setSearch(event.target.value); setSearchIndex(0); }} placeholder="Search all map records" /></label>
      {searchResults.length > 0 && <div className="mind-map-jump-results" role="listbox">{searchResults.map((node, index) => <button key={node.id} className={index === searchIndex ? 'is-current' : ''} onMouseEnter={() => setSearchIndex(index)} onClick={() => { centerNode(node.id); setSearch(''); }}><strong>{node.title}</strong><span>{node.category}</span></button>)}</div>}
    </nav>

    {selectedIds.length > 0 && <div className="mind-map-selection-bar" role="toolbar" aria-label="Selected node actions"><strong>{selectedIds.length} selected</strong><button onClick={() => focusSelection(1)}>1-hop focus</button><button onClick={() => focusSelection(2)}>2-hop focus</button><button onClick={collapseBranch}>Collapse branch</button><button onClick={hideSelected}>Hide selected</button><button onClick={showAll}>Show all</button><button onClick={connectSelected} disabled={selectedIds.length !== 2}>Connect selected</button><button onClick={() => setSelectedIds([])}>Clear</button></div>}

    <div className="mind-map-enhanced-host"><MindMapEnhanced key={`${activeMap.id}:${revision}`} archive={scopedArchive} onSave={childSave} /></div>

    {bounds && <aside className="mind-map-minimap" aria-label="Mind map overview"><header><strong>Overview</strong><span>{minimapPoints.length} visible</span></header><svg viewBox="0 0 180 120" role="img" aria-label="Clickable minimap of visible nodes">{minimapPoints.map(({ node, point }) => {
      const x = 8 + ((point.x - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX)) * 164;
      const y = 8 + ((point.y - bounds.minY) / Math.max(1, bounds.maxY - bounds.minY)) * 104;
      return <circle key={node.id} cx={x} cy={y} r={selectedIds.includes(node.id) ? 5 : 3.5} tabIndex={0} role="button" aria-label={`Center ${node.title}`} onClick={() => centerNode(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') centerNode(node.id); }} />;
    })}</svg></aside>}
    <div className="sr-only" aria-live="polite">{liveMessage}</div>
  </div>;
}
