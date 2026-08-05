import { useEffect, useMemo, useRef, useState } from 'react';
import type { V2ArchiveState } from './archive';
import './mind-map.css';

type NodeType = 'book' | 'theory' | 'suspicion' | 'dossier' | 'custom';
type LayoutMode = 'force' | 'radial' | 'tree' | 'flow';
type ScopeMode = 'archive' | 'books' | 'investigations' | 'dossiers' | 'wall';

type GraphNode = {
  id: string;
  recordId: string;
  type: NodeType;
  category: string;
  title: string;
  summary: string;
  status?: string;
  confidence?: number;
  bookIds: string[];
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  explanation?: string;
};

type Point = { x: number; y: number };
type Viewport = { x: number; y: number; zoom: number };

type PersistedMindMap = {
  kind: 'v2-mind-map';
  id: string;
  title: string;
  layout: LayoutMode;
  scope: ScopeMode;
  wallId: string;
  query: string;
  typeFilter: NodeType | '';
  bookId: string;
  status: string;
  hideIsolates: boolean;
  showLabels: boolean;
  hiddenIds: string[];
  positions: Record<string, Point>;
  customNodes: Array<{ id: string; title: string; summary: string; color: string }>;
  customEdges: GraphEdge[];
  viewport: Viewport;
  updatedAt: string;
};

const DEFAULT_MAP: PersistedMindMap = {
  kind: 'v2-mind-map',
  id: 'primary-mind-map',
  title: 'Mind Map',
  layout: 'force',
  scope: 'archive',
  wallId: '',
  query: '',
  typeFilter: '',
  bookId: '',
  status: '',
  hideIsolates: false,
  showLabels: true,
  hiddenIds: [],
  positions: {},
  customNodes: [],
  customEdges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  updatedAt: new Date().toISOString(),
};

const NODE_WIDTH = 184;
const NODE_HEIGHT = 98;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readPersistedMap(archive: V2ArchiveState): PersistedMindMap {
  const candidate = archive.mindMapNodes.find((entry) => entry && typeof entry === 'object' && (entry as { kind?: string }).kind === 'v2-mind-map') as Partial<PersistedMindMap> | undefined;
  if (!candidate) return structuredClone(DEFAULT_MAP);
  return {
    ...structuredClone(DEFAULT_MAP),
    ...candidate,
    positions: candidate.positions && typeof candidate.positions === 'object' ? candidate.positions : {},
    customNodes: Array.isArray(candidate.customNodes) ? candidate.customNodes : [],
    customEdges: Array.isArray(candidate.customEdges) ? candidate.customEdges : [],
    hiddenIds: Array.isArray(candidate.hiddenIds) ? candidate.hiddenIds : [],
    viewport: { ...DEFAULT_MAP.viewport, ...(candidate.viewport || {}) },
  };
}

function archiveGraph(archive: V2ArchiveState, map: PersistedMindMap): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (from: string, to: string, label: string, explanation?: string) => {
    if (!from || !to || from === to) return;
    const key = [from, to].sort().join('|') + `|${label}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id: `edge:${key}`, from, to, label, explanation });
  };

  archive.books.forEach((book) => {
    nodes.push({ id: `book:${book.id}`, recordId: book.id, type: 'book', category: 'Book', title: book.title, summary: book.summary || book.about || book.reaction || '', status: book.status, bookIds: [book.id] });
    (book.relationships || []).forEach((relationship) => addEdge(`book:${book.id}`, `book:${relationship.targetBookId}`, relationship.type || 'related', relationship.explanation || relationship.notes));
    (book.theoryIds || []).forEach((id) => addEdge(`book:${book.id}`, `theory:${id}`, 'supports'));
    (book.suspicionIds || []).forEach((id) => addEdge(`book:${book.id}`, `suspicion:${id}`, 'contains'));
  });

  archive.theories.forEach((theory) => {
    nodes.push({ id: `theory:${theory.id}`, recordId: theory.id, type: 'theory', category: 'Theory', title: theory.title, summary: theory.statement, status: theory.status, confidence: theory.confidence, bookIds: theory.bookIds });
    theory.bookIds.forEach((id) => addEdge(`theory:${theory.id}`, `book:${id}`, 'linked book'));
  });

  archive.suspicions.forEach((suspicion) => {
    nodes.push({ id: `suspicion:${suspicion.id}`, recordId: suspicion.id, type: 'suspicion', category: 'Suspicion', title: suspicion.title, summary: suspicion.details, status: suspicion.status, confidence: suspicion.confidence, bookIds: suspicion.bookIds });
    suspicion.bookIds.forEach((id) => addEdge(`suspicion:${suspicion.id}`, `book:${id}`, 'linked book'));
  });

  archive.dossiers.forEach((dossier) => {
    nodes.push({ id: `dossier:${dossier.id}`, recordId: dossier.id, type: 'dossier', category: dossier.category, title: dossier.title, summary: dossier.shortSummary || dossier.overview, bookIds: dossier.bookIds });
    dossier.bookIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `book:${id}`, 'appears in'));
    dossier.theoryIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `theory:${id}`, 'theory'));
    dossier.suspicionIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `suspicion:${id}`, 'suspicion'));
    dossier.dossierIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `dossier:${id}`, 'related to'));
  });

  map.customNodes.forEach((node) => nodes.push({ id: `custom:${node.id}`, recordId: node.id, type: 'custom', category: 'Note', title: node.title, summary: node.summary, bookIds: [] }));
  map.customEdges.forEach((edge) => addEdge(edge.from, edge.to, edge.label, edge.explanation));

  return { nodes, edges };
}

function initialCircle(nodes: GraphNode[]): Record<string, Point> {
  const result: Record<string, Point> = {};
  const radiusX = Math.max(260, nodes.length * 18);
  const radiusY = Math.max(210, nodes.length * 14);
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    result[node.id] = { x: 760 + Math.cos(angle) * radiusX, y: 480 + Math.sin(angle) * radiusY };
  });
  return result;
}

function applyLayout(nodes: GraphNode[], edges: GraphEdge[], mode: LayoutMode, existing: Record<string, Point>, selectedId = ''): Record<string, Point> {
  const positions = { ...initialCircle(nodes), ...existing };
  if (!nodes.length) return positions;
  if (mode === 'radial') {
    const root = selectedId && nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0].id;
    const levels = new Map<string, number>([[root, 0]]);
    const queue = [root];
    while (queue.length) {
      const id = queue.shift()!;
      edges.filter((edge) => edge.from === id || edge.to === id).forEach((edge) => {
        const next = edge.from === id ? edge.to : edge.from;
        if (!levels.has(next)) { levels.set(next, (levels.get(id) || 0) + 1); queue.push(next); }
      });
    }
    const groups = new Map<number, GraphNode[]>();
    nodes.forEach((node) => { const level = levels.get(node.id) ?? 2; groups.set(level, [...(groups.get(level) || []), node]); });
    groups.forEach((group, level) => group.forEach((node, index) => {
      if (level === 0) positions[node.id] = { x: 760, y: 480 };
      else { const angle = (index / Math.max(1, group.length)) * Math.PI * 2; positions[node.id] = { x: 760 + Math.cos(angle) * level * 250, y: 480 + Math.sin(angle) * level * 190 }; }
    }));
  } else if (mode === 'tree' || mode === 'flow') {
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1));
    const roots = nodes.filter((node) => !incoming.get(node.id));
    const levels = new Map<string, number>(roots.map((node) => [node.id, 0]));
    const queue = roots.map((node) => node.id);
    while (queue.length) {
      const id = queue.shift()!;
      edges.filter((edge) => edge.from === id).forEach((edge) => { if (!levels.has(edge.to)) { levels.set(edge.to, (levels.get(id) || 0) + 1); queue.push(edge.to); } });
    }
    const groups = new Map<number, GraphNode[]>();
    nodes.forEach((node) => { const level = levels.get(node.id) || 0; groups.set(level, [...(groups.get(level) || []), node]); });
    groups.forEach((group, level) => group.forEach((node, index) => {
      positions[node.id] = mode === 'flow' ? { x: 130 + level * 310, y: 100 + index * 150 } : { x: 120 + index * 250, y: 90 + level * 180 };
    }));
  } else {
    for (let step = 0; step < 70; step += 1) {
      const delta = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]));
      for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
        const a = positions[nodes[i].id]; const b = positions[nodes[j].id];
        const dx = a.x - b.x; const dy = a.y - b.y; const distance = Math.max(35, Math.hypot(dx, dy)); const force = 5600 / (distance * distance);
        delta.get(nodes[i].id)!.x += dx / distance * force; delta.get(nodes[i].id)!.y += dy / distance * force;
        delta.get(nodes[j].id)!.x -= dx / distance * force; delta.get(nodes[j].id)!.y -= dy / distance * force;
      }
      edges.forEach((edge) => {
        const a = positions[edge.from]; const b = positions[edge.to]; if (!a || !b) return;
        const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.max(1, Math.hypot(dx, dy)); const force = (distance - 245) * .011;
        delta.get(edge.from)!.x += dx / distance * force; delta.get(edge.from)!.y += dy / distance * force;
        delta.get(edge.to)!.x -= dx / distance * force; delta.get(edge.to)!.y -= dy / distance * force;
      });
      nodes.forEach((node) => { const movement = delta.get(node.id)!; positions[node.id] = { x: positions[node.id].x + clamp(movement.x, -9, 9), y: positions[node.id].y + clamp(movement.y, -9, 9) }; });
    }
  }
  return positions;
}

export function MindMap({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const [map, setMap] = useState(() => readPersistedMap(archive));
  const [selectedId, setSelectedId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [draftNote, setDraftNote] = useState({ title: '', summary: '' });
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [viewport, setViewport] = useState<Viewport>(map.viewport);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ kind: 'pan' | 'node'; id?: string; pointerId: number; x: number; y: number; start: Point } | null>(null);
  const saveTimer = useRef<number | null>(null);

  const rawGraph = useMemo(() => archiveGraph(archive, map), [archive, map.customNodes, map.customEdges]);
  const filtered = useMemo(() => {
    let nodes = rawGraph.nodes.filter((node) => !map.hiddenIds.includes(node.id));
    if (map.scope === 'books') nodes = nodes.filter((node) => node.type === 'book');
    if (map.scope === 'investigations') nodes = nodes.filter((node) => node.type === 'theory' || node.type === 'suspicion');
    if (map.scope === 'dossiers') nodes = nodes.filter((node) => node.type === 'dossier');
    if (map.scope === 'wall') {
      const wall = archive.walls.find((item) => item.id === map.wallId) || archive.walls[0];
      const ids = new Set((wall?.cards || []).map((card) => `${card.sourceType}:${card.sourceId}`));
      nodes = nodes.filter((node) => ids.has(node.id));
    }
    if (map.query.trim()) { const q = map.query.toLowerCase(); nodes = nodes.filter((node) => `${node.title} ${node.summary} ${node.category}`.toLowerCase().includes(q)); }
    if (map.typeFilter) nodes = nodes.filter((node) => node.type === map.typeFilter);
    if (map.bookId) nodes = nodes.filter((node) => node.bookIds.includes(map.bookId) || node.id === `book:${map.bookId}`);
    if (map.status.trim()) nodes = nodes.filter((node) => (node.status || '').toLowerCase().includes(map.status.toLowerCase()));
    let ids = new Set(nodes.map((node) => node.id));
    let edges = rawGraph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
    if (map.hideIsolates) { const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to])); nodes = nodes.filter((node) => connected.has(node.id)); ids = new Set(nodes.map((node) => node.id)); edges = edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)); }
    return { nodes, edges };
  }, [rawGraph, map.scope, map.wallId, map.query, map.typeFilter, map.bookId, map.status, map.hideIsolates, map.hiddenIds, archive.walls]);

  useEffect(() => {
    setPositions((current) => applyLayout(filtered.nodes, filtered.edges, map.layout, { ...map.positions, ...current }, selectedId));
  }, [map.layout, filtered.nodes.map((node) => node.id).join('|'), filtered.edges.map((edge) => edge.id).join('|')]);

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  function persist(nextMap: PersistedMindMap) {
    setMap(nextMap);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const nextEntry = { ...nextMap, positions, viewport, updatedAt: new Date().toISOString() };
      const rest = archive.mindMapNodes.filter((entry) => !(entry && typeof entry === 'object' && (entry as { kind?: string }).kind === 'v2-mind-map'));
      onSave({ ...archive, mindMapNodes: [...rest, nextEntry] }).catch(() => undefined);
    }, 350);
  }

  function updateMap(changes: Partial<PersistedMindMap>) { persist({ ...map, ...changes, updatedAt: new Date().toISOString() }); }

  function applyViewport(next: Viewport) { setViewport({ x: next.x, y: next.y, zoom: clamp(next.zoom, .25, 2.5) }); }
  function resetLayout() { const next = applyLayout(filtered.nodes, filtered.edges, map.layout, {}, selectedId); setPositions(next); updateMap({ positions: next }); }
  function fitAll() {
    const canvas = canvasRef.current; if (!canvas || !filtered.nodes.length) return;
    const points = filtered.nodes.map((node) => positions[node.id]).filter(Boolean);
    const minX = Math.min(...points.map((point) => point.x)); const maxX = Math.max(...points.map((point) => point.x + NODE_WIDTH));
    const minY = Math.min(...points.map((point) => point.y)); const maxY = Math.max(...points.map((point) => point.y + NODE_HEIGHT));
    const zoom = clamp(Math.min((canvas.clientWidth - 90) / Math.max(1, maxX - minX), (canvas.clientHeight - 90) / Math.max(1, maxY - minY)), .25, 1.4);
    applyViewport({ x: (canvas.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom, y: (canvas.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom, zoom });
  }
  function centerSelected() { const point = positions[selectedId]; const canvas = canvasRef.current; if (!point || !canvas) return; applyViewport({ ...viewport, x: canvas.clientWidth / 2 - (point.x + NODE_WIDTH / 2) * viewport.zoom, y: canvas.clientHeight / 2 - (point.y + NODE_HEIGHT / 2) * viewport.zoom }); }

  function pointerDownCanvas(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains('mind-map-world')) return;
    dragRef.current = { kind: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: { x: viewport.x, y: viewport.y } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'pan') applyViewport({ ...viewport, x: drag.start.x + event.clientX - drag.x, y: drag.start.y + event.clientY - drag.y });
    else if (drag.id) setPositions((current) => ({ ...current, [drag.id!]: { x: drag.start.x + (event.clientX - drag.x) / viewport.zoom, y: drag.start.y + (event.clientY - drag.y) / viewport.zoom } }));
  }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'node' && drag.id) updateMap({ positions: { ...map.positions, [drag.id]: positions[drag.id] } });
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* released */ }
  }
  function startNodeDrag(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation(); const point = positions[id] || { x: 0, y: 0 };
    dragRef.current = { kind: 'node', id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: point };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  const selected = filtered.nodes.find((node) => node.id === selectedId) || rawGraph.nodes.find((node) => node.id === selectedId);
  const selectedEdges = selected ? rawGraph.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];

  function addCustomNote() {
    const title = draftNote.title.trim(); if (!title) return;
    const id = crypto.randomUUID();
    const customNodes = [...map.customNodes, { id, title, summary: draftNote.summary.trim(), color: '#b55d2e' }];
    setDraftNote({ title: '', summary: '' });
    updateMap({ customNodes });
    setSelectedId(`custom:${id}`); setInspectorOpen(true);
  }

  return <div className="mind-map-page">
    <header className="mind-map-header">
      <div><p>Canonical Relationship Explorer</p><h2>Mind Map</h2><strong>{filtered.nodes.length} nodes · {filtered.edges.length} relationships</strong></div>
      <div className="mind-map-view-controls"><button onClick={fitAll}>Fit all</button><button onClick={resetLayout}>Reset</button><button onClick={centerSelected} disabled={!selectedId}>Center selected</button><button onClick={() => applyViewport({ ...viewport, zoom: viewport.zoom / 1.18 })}>−</button><output>{Math.round(viewport.zoom * 100)}%</output><button onClick={() => applyViewport({ ...viewport, zoom: viewport.zoom * 1.18 })}>+</button></div>
    </header>

    <div className="mind-map-toolbar">
      <label>Scope<select value={map.scope} onChange={(event) => updateMap({ scope: event.target.value as ScopeMode })}><option value="archive">Archive · everything</option><option value="books">Books</option><option value="investigations">Theories & suspicions</option><option value="dossiers">Dossiers</option><option value="wall">Conspiracy wall</option></select></label>
      <label>Layout<select value={map.layout} onChange={(event) => updateMap({ layout: event.target.value as LayoutMode })}><option value="force">Force-directed</option><option value="radial">Radial</option><option value="tree">Hierarchical tree</option><option value="flow">Left-to-right flow</option></select></label>
      <label className="mind-map-search">Search<input value={map.query} onChange={(event) => updateMap({ query: event.target.value })} placeholder="Find a record" /></label>
      <button onClick={() => setFiltersOpen((open) => !open)}>Filters{(map.typeFilter || map.bookId || map.status || map.hideIsolates) ? ' •' : ''}</button>
      <button onClick={() => setInspectorOpen(true)}>+ Note</button>
    </div>

    {filtersOpen && <section className="mind-map-filters">
      <header><div><strong>Mind-map filters</strong><span>Refine records without changing the archive.</span></div><button onClick={() => setFiltersOpen(false)}>Close</button></header>
      <label>Record type<select value={map.typeFilter} onChange={(event) => updateMap({ typeFilter: event.target.value as NodeType | '' })}><option value="">All</option><option value="book">Books</option><option value="theory">Theories</option><option value="suspicion">Suspicions</option><option value="dossier">Dossiers</option><option value="custom">Notes</option></select></label>
      <label>Book<select value={map.bookId} onChange={(event) => updateMap({ bookId: event.target.value })}><option value="">All books</option>{archive.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
      {map.scope === 'wall' && <label>Wall<select value={map.wallId} onChange={(event) => updateMap({ wallId: event.target.value })}>{archive.walls.map((wall) => <option key={wall.id} value={wall.id}>{wall.title}</option>)}</select></label>}
      <label>Status<input value={map.status} onChange={(event) => updateMap({ status: event.target.value })} placeholder="open, active, completed…" /></label>
      <label className="mind-map-check"><input type="checkbox" checked={map.hideIsolates} onChange={(event) => updateMap({ hideIsolates: event.target.checked })} />Hide isolated nodes</label>
      <label className="mind-map-check"><input type="checkbox" checked={map.showLabels} onChange={(event) => updateMap({ showLabels: event.target.checked })} />Show relationship labels</label>
      <button onClick={() => updateMap({ query: '', typeFilter: '', bookId: '', status: '', hideIsolates: false, hiddenIds: [] })}>Clear filters and hidden nodes</button>
    </section>}

    <div className="mind-map-canvas" ref={canvasRef} onPointerDown={pointerDownCanvas} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const nextZoom = clamp(viewport.zoom * Math.exp(-event.deltaY * .001), .25, 2.5); const worldX = (event.clientX - rect.left - viewport.x) / viewport.zoom; const worldY = (event.clientY - rect.top - viewport.y) / viewport.zoom; applyViewport({ zoom: nextZoom, x: event.clientX - rect.left - worldX * nextZoom, y: event.clientY - rect.top - worldY * nextZoom }); }}>
      <div className="mind-map-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        <svg className="mind-map-edges">
          {filtered.edges.map((edge) => { const from = positions[edge.from]; const to = positions[edge.to]; if (!from || !to) return null; const x1 = from.x + NODE_WIDTH / 2; const y1 = from.y + NODE_HEIGHT / 2; const x2 = to.x + NODE_WIDTH / 2; const y2 = to.y + NODE_HEIGHT / 2; return <g key={edge.id}><line x1={x1} y1={y1} x2={x2} y2={y2} />{map.showLabels && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 7}>{edge.label}</text>}</g>; })}
        </svg>
        {filtered.nodes.map((node) => { const point = positions[node.id] || { x: 0, y: 0 }; const connectionCount = filtered.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length; return <button key={node.id} className={`mind-map-node is-${node.type} ${selectedId === node.id ? 'is-selected' : ''}`} style={{ left: point.x, top: point.y }} onPointerDown={(event) => startNodeDrag(event, node.id)} onClick={() => { setSelectedId(node.id); setInspectorOpen(true); }}><small>{node.category}</small><strong>{node.title}</strong><span>{node.status || node.summary || 'No summary recorded.'}</span><footer>{connectionCount} connection{connectionCount === 1 ? '' : 's'}{node.confidence == null ? '' : ` · ${node.confidence}%`}</footer></button>; })}
      </div>
      {!filtered.nodes.length && <div className="mind-map-empty"><strong>No records match this view.</strong><span>Clear filters, choose a broader scope, or add a custom note.</span></div>}
    </div>

    {inspectorOpen && <aside className="mind-map-inspector">
      <header><div><p>{selected?.category || 'Map note'}</p><h3>{selected?.title || 'Add custom note'}</h3></div><button onClick={() => setInspectorOpen(false)}>×</button></header>
      <div className="mind-map-inspector-body">
        {!selected && <section className="mind-map-note-form"><label>Title<input value={draftNote.title} onChange={(event) => setDraftNote((current) => ({ ...current, title: event.target.value }))} /></label><label>Summary<textarea value={draftNote.summary} onChange={(event) => setDraftNote((current) => ({ ...current, summary: event.target.value }))} /></label><button onClick={addCustomNote} disabled={!draftNote.title.trim()}>Add note to map</button></section>}
        {selected && <><section><h4>Overview</h4><p>{selected.summary || 'No summary recorded.'}</p>{selected.status && <span className="mind-map-pill">{selected.status}</span>}{selected.confidence != null && <span className="mind-map-pill">{selected.confidence}% confidence</span>}</section><section><h4>Connections</h4>{selectedEdges.length ? selectedEdges.map((edge) => { const otherId = edge.from === selected.id ? edge.to : edge.from; const other = rawGraph.nodes.find((node) => node.id === otherId); return <button className="mind-map-connection" key={edge.id} onClick={() => setSelectedId(otherId)}><span>{edge.label}</span><strong>{other?.title || 'Missing record'}</strong></button>; }) : <p>No connections yet.</p>}</section><section className="mind-map-inspector-actions"><button onClick={centerSelected}>Center node</button><button onClick={() => { const neighborIds = new Set(selectedEdges.flatMap((edge) => [edge.from, edge.to])); updateMap({ hiddenIds: rawGraph.nodes.filter((node) => node.id !== selected.id && !neighborIds.has(node.id)).map((node) => node.id) }); }}>Focus neighborhood</button><button onClick={() => updateMap({ hiddenIds: [...new Set([...map.hiddenIds, selected.id])] })}>Hide node</button><button onClick={() => updateMap({ hiddenIds: [] })}>Show all nodes</button></section></>}
      </div>
    </aside>}
  </div>;
}
