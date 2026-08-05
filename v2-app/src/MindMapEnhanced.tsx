import { useEffect, useMemo, useRef, useState } from 'react';
import type { V2ArchiveState } from './archive';
import './mind-map.css';
import './mind-map-enhanced.css';

type NodeType = 'book' | 'theory' | 'suspicion' | 'dossier' | 'custom';
type LayoutMode = 'force' | 'radial' | 'tree' | 'flow';
type ScopeMode = 'archive' | 'books' | 'investigations' | 'dossiers' | 'wall';
type Point = { x: number; y: number };
type Viewport = { x: number; y: number; zoom: number };
type GraphNode = { id: string; recordId: string; type: NodeType; category: string; title: string; summary: string; status?: string; confidence?: number; bookIds: string[]; color?: string };
type GraphEdge = { id: string; from: string; to: string; label: string; explanation?: string; source: 'canonical' | 'map' };
type DragState = { kind: 'pan' | 'node'; id?: string; pointerId: number; x: number; y: number; start: Point; moved: boolean };
type CustomNode = { id: string; title: string; summary: string; color: string };
type CustomEdge = { id: string; from: string; to: string; label: string; explanation?: string };
type PersistedMindMap = {
  kind: 'v2-mind-map'; id: string; title: string; layout: LayoutMode; scope: ScopeMode; wallId: string; query: string;
  typeFilter: NodeType | ''; bookId: string; status: string; hideIsolates: boolean; showLabels: boolean; hiddenIds: string[];
  positions: Record<string, Point>; customNodes: CustomNode[]; customEdges: CustomEdge[]; viewport: Viewport; updatedAt: string;
};

const NODE_WIDTH = 184;
const NODE_HEIGHT = 98;
const DRAG_THRESHOLD = 6;
const DEFAULT_MAP: PersistedMindMap = { kind: 'v2-mind-map', id: 'primary-mind-map', title: 'Mind Map', layout: 'force', scope: 'archive', wallId: '', query: '', typeFilter: '', bookId: '', status: '', hideIsolates: false, showLabels: true, hiddenIds: [], positions: {}, customNodes: [], customEdges: [], viewport: { x: 0, y: 0, zoom: 1 }, updatedAt: new Date().toISOString() };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readMap(archive: V2ArchiveState): PersistedMindMap {
  const candidate = archive.mindMapNodes.find((entry) => entry && typeof entry === 'object' && (entry as { kind?: string }).kind === 'v2-mind-map') as Partial<PersistedMindMap> | undefined;
  if (!candidate) return structuredClone(DEFAULT_MAP);
  return { ...structuredClone(DEFAULT_MAP), ...candidate, positions: candidate.positions && typeof candidate.positions === 'object' ? candidate.positions : {}, customNodes: Array.isArray(candidate.customNodes) ? candidate.customNodes : [], customEdges: Array.isArray(candidate.customEdges) ? candidate.customEdges : [], hiddenIds: Array.isArray(candidate.hiddenIds) ? candidate.hiddenIds : [], viewport: { ...DEFAULT_MAP.viewport, ...(candidate.viewport || {}) } };
}

function buildGraph(archive: V2ArchiveState, map: PersistedMindMap) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const keys = new Set<string>();
  const addEdge = (from: string, to: string, label: string, explanation = '', source: 'canonical' | 'map' = 'canonical', id?: string) => {
    if (!from || !to || from === to) return;
    const key = source === 'map' ? `map:${id || `${from}:${to}:${label}`}` : `canonical:${[from, to].sort().join('|')}:${label}`;
    if (keys.has(key)) return;
    keys.add(key);
    edges.push({ id: id || key, from, to, label: label || 'related to', explanation, source });
  };
  archive.books.forEach((book) => {
    nodes.push({ id: `book:${book.id}`, recordId: book.id, type: 'book', category: 'Book', title: book.title, summary: book.summary || book.about || book.reaction || '', status: book.status, bookIds: [book.id] });
    (book.relationships || []).forEach((rel) => addEdge(`book:${book.id}`, `book:${rel.targetBookId}`, rel.type || 'related to', rel.explanation || rel.notes || ''));
    (book.theoryIds || []).forEach((id) => addEdge(`book:${book.id}`, `theory:${id}`, 'supports'));
    (book.suspicionIds || []).forEach((id) => addEdge(`book:${book.id}`, `suspicion:${id}`, 'contains'));
  });
  archive.theories.forEach((theory) => {
    nodes.push({ id: `theory:${theory.id}`, recordId: theory.id, type: 'theory', category: 'Theory', title: theory.title, summary: theory.statement, status: theory.status, confidence: theory.confidence, bookIds: theory.bookIds });
    theory.bookIds.forEach((id) => addEdge(`theory:${theory.id}`, `book:${id}`, 'linked book'));
  });
  archive.suspicions.forEach((item) => {
    nodes.push({ id: `suspicion:${item.id}`, recordId: item.id, type: 'suspicion', category: 'Suspicion', title: item.title, summary: item.details, status: item.status, confidence: item.confidence, bookIds: item.bookIds });
    item.bookIds.forEach((id) => addEdge(`suspicion:${item.id}`, `book:${id}`, 'linked book'));
  });
  archive.dossiers.forEach((dossier) => {
    nodes.push({ id: `dossier:${dossier.id}`, recordId: dossier.id, type: 'dossier', category: dossier.category, title: dossier.title, summary: dossier.shortSummary || dossier.overview, bookIds: dossier.bookIds });
    dossier.bookIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `book:${id}`, 'appears in'));
    dossier.theoryIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `theory:${id}`, 'theory'));
    dossier.suspicionIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `suspicion:${id}`, 'suspicion'));
    dossier.dossierIds.forEach((id) => addEdge(`dossier:${dossier.id}`, `dossier:${id}`, 'related to'));
  });
  map.customNodes.forEach((node) => nodes.push({ id: `custom:${node.id}`, recordId: node.id, type: 'custom', category: 'Note', title: node.title, summary: node.summary, bookIds: [], color: node.color }));
  map.customEdges.forEach((edge) => addEdge(edge.from, edge.to, edge.label, edge.explanation || '', 'map', edge.id));
  return { nodes, edges };
}

function initialPositions(nodes: GraphNode[]) {
  const result: Record<string, Point> = {};
  const rx = Math.max(260, nodes.length * 18); const ry = Math.max(210, nodes.length * 14);
  nodes.forEach((node, index) => { const angle = index / Math.max(1, nodes.length) * Math.PI * 2; result[node.id] = { x: 760 + Math.cos(angle) * rx, y: 480 + Math.sin(angle) * ry }; });
  return result;
}

function layout(nodes: GraphNode[], edges: GraphEdge[], mode: LayoutMode, existing: Record<string, Point>, selectedId = '') {
  const positions = { ...initialPositions(nodes), ...existing };
  if (!nodes.length) return positions;
  if (mode === 'radial') {
    const root = selectedId && nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0].id;
    const levels = new Map<string, number>([[root, 0]]); const queue = [root];
    while (queue.length) { const id = queue.shift()!; edges.filter((edge) => edge.from === id || edge.to === id).forEach((edge) => { const next = edge.from === id ? edge.to : edge.from; if (!levels.has(next)) { levels.set(next, (levels.get(id) || 0) + 1); queue.push(next); } }); }
    const groups = new Map<number, GraphNode[]>(); nodes.forEach((node) => { const level = levels.get(node.id) ?? 2; groups.set(level, [...(groups.get(level) || []), node]); });
    groups.forEach((group, level) => group.forEach((node, index) => { if (!level) positions[node.id] = { x: 760, y: 480 }; else { const angle = index / Math.max(1, group.length) * Math.PI * 2; positions[node.id] = { x: 760 + Math.cos(angle) * level * 250, y: 480 + Math.sin(angle) * level * 190 }; } }));
  } else if (mode === 'tree' || mode === 'flow') {
    const incoming = new Map(nodes.map((node) => [node.id, 0])); edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1));
    const roots = nodes.filter((node) => !incoming.get(node.id)); const levels = new Map<string, number>(roots.map((node) => [node.id, 0])); const queue = roots.map((node) => node.id);
    while (queue.length) { const id = queue.shift()!; edges.filter((edge) => edge.from === id).forEach((edge) => { if (!levels.has(edge.to)) { levels.set(edge.to, (levels.get(id) || 0) + 1); queue.push(edge.to); } }); }
    const groups = new Map<number, GraphNode[]>(); nodes.forEach((node) => { const level = levels.get(node.id) || 0; groups.set(level, [...(groups.get(level) || []), node]); });
    groups.forEach((group, level) => group.forEach((node, index) => { positions[node.id] = mode === 'flow' ? { x: 130 + level * 310, y: 100 + index * 150 } : { x: 120 + index * 250, y: 90 + level * 180 }; }));
  } else {
    for (let step = 0; step < 70; step += 1) {
      const delta = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]));
      for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) { const a = positions[nodes[i].id], b = positions[nodes[j].id]; const dx = a.x - b.x, dy = a.y - b.y, d = Math.max(35, Math.hypot(dx, dy)), f = 5600 / (d * d); delta.get(nodes[i].id)!.x += dx / d * f; delta.get(nodes[i].id)!.y += dy / d * f; delta.get(nodes[j].id)!.x -= dx / d * f; delta.get(nodes[j].id)!.y -= dy / d * f; }
      edges.forEach((edge) => { const a = positions[edge.from], b = positions[edge.to]; if (!a || !b) return; const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), f = (d - 245) * .011; delta.get(edge.from)!.x += dx / d * f; delta.get(edge.from)!.y += dy / d * f; delta.get(edge.to)!.x -= dx / d * f; delta.get(edge.to)!.y -= dy / d * f; });
      nodes.forEach((node) => { const move = delta.get(node.id)!; positions[node.id] = { x: positions[node.id].x + clamp(move.x, -9, 9), y: positions[node.id].y + clamp(move.y, -9, 9) }; });
    }
  }
  return positions;
}

export function MindMapEnhanced({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const [map, setMap] = useState(() => readMap(archive));
  const [selectedId, setSelectedId] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [inspectorMode, setInspectorMode] = useState<'node' | 'edge' | 'note' | 'connect'>('node');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [viewport, setViewport] = useState<Viewport>(map.viewport);
  const [noteDraft, setNoteDraft] = useState({ title: '', summary: '', color: '#b55d2e' });
  const [edgeDraft, setEdgeDraft] = useState({ from: '', to: '', label: 'related to', explanation: '' });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef('');
  const saveTimer = useRef<number | null>(null);

  const graph = useMemo(() => buildGraph(archive, map), [archive, map.customNodes, map.customEdges]);
  const filtered = useMemo(() => {
    let nodes = graph.nodes.filter((node) => !map.hiddenIds.includes(node.id));
    if (map.scope === 'books') nodes = nodes.filter((node) => node.type === 'book');
    if (map.scope === 'investigations') nodes = nodes.filter((node) => node.type === 'theory' || node.type === 'suspicion');
    if (map.scope === 'dossiers') nodes = nodes.filter((node) => node.type === 'dossier');
    if (map.scope === 'wall') { const wall = archive.walls.find((item) => item.id === map.wallId) || archive.walls[0]; const ids = new Set((wall?.cards || []).map((card) => `${card.sourceType}:${card.sourceId}`)); nodes = nodes.filter((node) => ids.has(node.id)); }
    if (map.query.trim()) { const q = map.query.toLowerCase(); nodes = nodes.filter((node) => `${node.title} ${node.summary} ${node.category}`.toLowerCase().includes(q)); }
    if (map.typeFilter) nodes = nodes.filter((node) => node.type === map.typeFilter);
    if (map.bookId) nodes = nodes.filter((node) => node.bookIds.includes(map.bookId) || node.id === `book:${map.bookId}`);
    if (map.status.trim()) nodes = nodes.filter((node) => (node.status || '').toLowerCase().includes(map.status.toLowerCase()));
    let ids = new Set(nodes.map((node) => node.id)); let edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
    if (map.hideIsolates) { const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to])); nodes = nodes.filter((node) => connected.has(node.id)); ids = new Set(nodes.map((node) => node.id)); edges = edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)); }
    return { nodes, edges };
  }, [graph, map.scope, map.wallId, map.query, map.typeFilter, map.bookId, map.status, map.hideIsolates, map.hiddenIds, archive.walls]);

  useEffect(() => { setPositions((current) => layout(filtered.nodes, filtered.edges, map.layout, { ...map.positions, ...current }, selectedId)); }, [map.layout, filtered.nodes.map((node) => node.id).join('|'), filtered.edges.map((edge) => edge.id).join('|')]);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  function persist(nextMap: PersistedMindMap, nextPositions = positions, nextViewport = viewport) {
    setMap(nextMap);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { const nextEntry = { ...nextMap, positions: nextPositions, viewport: nextViewport, updatedAt: new Date().toISOString() }; const rest = archive.mindMapNodes.filter((entry) => !(entry && typeof entry === 'object' && (entry as { kind?: string }).kind === 'v2-mind-map')); onSave({ ...archive, mindMapNodes: [...rest, nextEntry] }).catch(() => undefined); }, 250);
  }
  function updateMap(changes: Partial<PersistedMindMap>) { persist({ ...map, ...changes, updatedAt: new Date().toISOString() }); }
  function applyViewport(next: Viewport) { const safe = { x: next.x, y: next.y, zoom: clamp(next.zoom, .25, 2.5) }; setViewport(safe); persist(map, positions, safe); }
  function openNode(id: string) { setSelectedId(id); setSelectedEdgeId(''); setInspectorMode('node'); setInspectorOpen(true); }
  function openEdge(edge: GraphEdge) { setSelectedEdgeId(edge.id); setSelectedId(''); setEdgeDraft({ from: edge.from, to: edge.to, label: edge.label, explanation: edge.explanation || '' }); setInspectorMode('edge'); setInspectorOpen(true); }
  function startConnect(from = selectedId) { setEdgeDraft({ from, to: '', label: 'related to', explanation: '' }); setInspectorMode('connect'); setInspectorOpen(true); }

  function resetLayout() { const next = layout(filtered.nodes, filtered.edges, map.layout, {}, selectedId); setPositions(next); persist({ ...map, positions: next }, next); }
  function fitAll() { const canvas = canvasRef.current; if (!canvas || !filtered.nodes.length) return; const pts = filtered.nodes.map((node) => positions[node.id]).filter(Boolean); const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x + NODE_WIDTH)), minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y + NODE_HEIGHT)); const zoom = clamp(Math.min((canvas.clientWidth - 90) / Math.max(1, maxX - minX), (canvas.clientHeight - 90) / Math.max(1, maxY - minY)), .25, 1.4); applyViewport({ x: (canvas.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom, y: (canvas.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom, zoom }); }
  function centerSelected() { const p = positions[selectedId], canvas = canvasRef.current; if (!p || !canvas) return; applyViewport({ ...viewport, x: canvas.clientWidth / 2 - (p.x + NODE_WIDTH / 2) * viewport.zoom, y: canvas.clientHeight / 2 - (p.y + NODE_HEIGHT / 2) * viewport.zoom }); }

  function pointerDownCanvas(event: React.PointerEvent<HTMLDivElement>) { if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains('mind-map-world')) return; dragRef.current = { kind: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: { x: viewport.x, y: viewport.y }, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) drag.moved = true; if (drag.kind === 'pan') setViewport({ ...viewport, x: drag.start.x + dx, y: drag.start.y + dy }); else if (drag.id) setPositions((current) => ({ ...current, [drag.id!]: { x: drag.start.x + dx / viewport.zoom, y: drag.start.y + dy / viewport.zoom } })); }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; if (drag.kind === 'node' && drag.id && drag.moved) { suppressClickRef.current = drag.id; const nextPositions = { ...positions, [drag.id]: positions[drag.id] }; persist({ ...map, positions: nextPositions }, nextPositions); window.setTimeout(() => { suppressClickRef.current = ''; }, 0); } else if (drag.kind === 'pan' && drag.moved) persist(map, positions, viewport); dragRef.current = null; try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* released */ } }
  function startNodeDrag(event: React.PointerEvent<HTMLButtonElement>, id: string) { event.stopPropagation(); const point = positions[id] || { x: 0, y: 0 }; dragRef.current = { kind: 'node', id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: point, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }

  const selected = graph.nodes.find((node) => node.id === selectedId);
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId);
  const selectedConnections = selected ? graph.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];
  const selectedCustom = selected?.type === 'custom' ? map.customNodes.find((node) => `custom:${node.id}` === selected.id) : undefined;

  function addNote() { const title = noteDraft.title.trim(); if (!title) return; const id = crypto.randomUUID(); const nextNodes = [...map.customNodes, { id, title, summary: noteDraft.summary.trim(), color: noteDraft.color }]; updateMap({ customNodes: nextNodes }); setNoteDraft({ title: '', summary: '', color: '#b55d2e' }); openNode(`custom:${id}`); }
  function saveCustomNote() { if (!selectedCustom) return; const title = noteDraft.title.trim(); if (!title) return; const next = map.customNodes.map((node) => node.id === selectedCustom.id ? { ...node, title, summary: noteDraft.summary.trim(), color: noteDraft.color } : node); updateMap({ customNodes: next }); openNode(`custom:${selectedCustom.id}`); }
  function deleteCustomNote() { if (!selectedCustom || !window.confirm(`Delete “${selectedCustom.title}” from this map?`)) return; const nodeId = `custom:${selectedCustom.id}`; updateMap({ customNodes: map.customNodes.filter((node) => node.id !== selectedCustom.id), customEdges: map.customEdges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId), hiddenIds: map.hiddenIds.filter((id) => id !== nodeId) }); setInspectorOpen(false); setSelectedId(''); }
  function beginEditCustom() { if (!selectedCustom) return; setNoteDraft({ title: selectedCustom.title, summary: selectedCustom.summary, color: selectedCustom.color }); setInspectorMode('note'); }

  function saveConnection() { const from = edgeDraft.from, to = edgeDraft.to, label = edgeDraft.label.trim(); if (!from || !to || from === to || !label) return; const duplicate = map.customEdges.some((edge) => edge.id !== selectedEdge?.id && edge.from === from && edge.to === to && edge.label.toLowerCase() === label.toLowerCase()); if (duplicate) { window.alert('That map connection already exists.'); return; } if (selectedEdge?.source === 'map') { updateMap({ customEdges: map.customEdges.map((edge) => edge.id === selectedEdge.id ? { ...edge, from, to, label, explanation: edgeDraft.explanation.trim() } : edge) }); } else { updateMap({ customEdges: [...map.customEdges, { id: crypto.randomUUID(), from, to, label, explanation: edgeDraft.explanation.trim() }] }); } setInspectorOpen(false); setSelectedEdgeId(''); }
  function reverseConnection() { setEdgeDraft((current) => ({ ...current, from: current.to, to: current.from })); }
  function deleteConnection() { if (!selectedEdge || selectedEdge.source !== 'map' || !window.confirm(`Delete the “${selectedEdge.label}” map connection?`)) return; updateMap({ customEdges: map.customEdges.filter((edge) => edge.id !== selectedEdge.id) }); setInspectorOpen(false); setSelectedEdgeId(''); }

  return <div className="mind-map-page mind-map-page--enhanced">
    <header className="mind-map-header"><div><p>Canonical Relationship Explorer</p><h2>Mind Map</h2><strong>{filtered.nodes.length} nodes · {filtered.edges.length} relationships</strong></div><div className="mind-map-view-controls"><button onClick={fitAll}>Fit all</button><button onClick={resetLayout}>Reset</button><button onClick={centerSelected} disabled={!selectedId}>Center selected</button><button onClick={() => applyViewport({ ...viewport, zoom: viewport.zoom / 1.18 })}>−</button><output>{Math.round(viewport.zoom * 100)}%</output><button onClick={() => applyViewport({ ...viewport, zoom: viewport.zoom * 1.18 })}>+</button></div></header>
    <div className="mind-map-toolbar"><label>Scope<select value={map.scope} onChange={(event) => updateMap({ scope: event.target.value as ScopeMode })}><option value="archive">Archive · everything</option><option value="books">Books</option><option value="investigations">Theories & suspicions</option><option value="dossiers">Dossiers</option><option value="wall">Conspiracy wall</option></select></label><label>Layout<select value={map.layout} onChange={(event) => updateMap({ layout: event.target.value as LayoutMode })}><option value="force">Force-directed</option><option value="radial">Radial</option><option value="tree">Hierarchical tree</option><option value="flow">Left-to-right flow</option></select></label><label className="mind-map-search">Search<input value={map.query} onChange={(event) => updateMap({ query: event.target.value })} placeholder="Find a record" /></label><button onClick={() => setFiltersOpen((open) => !open)}>Filters{(map.typeFilter || map.bookId || map.status || map.hideIsolates) ? ' •' : ''}</button><button onClick={() => { setSelectedId(''); setNoteDraft({ title: '', summary: '', color: '#b55d2e' }); setInspectorMode('note'); setInspectorOpen(true); }}>+ Note</button><button onClick={() => startConnect()}>+ Connection</button></div>
    {filtersOpen && <section className="mind-map-filters"><header><div><strong>Mind-map filters</strong><span>Refine records without changing the archive.</span></div><button onClick={() => setFiltersOpen(false)}>Close</button></header><label>Record type<select value={map.typeFilter} onChange={(event) => updateMap({ typeFilter: event.target.value as NodeType | '' })}><option value="">All</option><option value="book">Books</option><option value="theory">Theories</option><option value="suspicion">Suspicions</option><option value="dossier">Dossiers</option><option value="custom">Notes</option></select></label><label>Book<select value={map.bookId} onChange={(event) => updateMap({ bookId: event.target.value })}><option value="">All books</option>{archive.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>{map.scope === 'wall' && <label>Wall<select value={map.wallId} onChange={(event) => updateMap({ wallId: event.target.value })}>{archive.walls.map((wall) => <option key={wall.id} value={wall.id}>{wall.title}</option>)}</select></label>}<label>Status<input value={map.status} onChange={(event) => updateMap({ status: event.target.value })} placeholder="open, active, completed…" /></label><label className="mind-map-check"><input type="checkbox" checked={map.hideIsolates} onChange={(event) => updateMap({ hideIsolates: event.target.checked })} />Hide isolated nodes</label><label className="mind-map-check"><input type="checkbox" checked={map.showLabels} onChange={(event) => updateMap({ showLabels: event.target.checked })} />Show relationship labels</label><button onClick={() => updateMap({ query: '', typeFilter: '', bookId: '', status: '', hideIsolates: false, hiddenIds: [] })}>Clear filters and hidden nodes</button></section>}
    <div className="mind-map-canvas" ref={canvasRef} onPointerDown={pointerDownCanvas} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const nextZoom = clamp(viewport.zoom * Math.exp(-event.deltaY * .001), .25, 2.5); const worldX = (event.clientX - rect.left - viewport.x) / viewport.zoom, worldY = (event.clientY - rect.top - viewport.y) / viewport.zoom; applyViewport({ zoom: nextZoom, x: event.clientX - rect.left - worldX * nextZoom, y: event.clientY - rect.top - worldY * nextZoom }); }}>
      <div className="mind-map-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}><svg className="mind-map-edges">{filtered.edges.map((edge) => { const from = positions[edge.from], to = positions[edge.to]; if (!from || !to) return null; const x1 = from.x + NODE_WIDTH / 2, y1 = from.y + NODE_HEIGHT / 2, x2 = to.x + NODE_WIDTH / 2, y2 = to.y + NODE_HEIGHT / 2; return <g key={edge.id} className={`mind-map-edge is-${edge.source}`} role="button" tabIndex={0} onClick={() => openEdge(edge)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openEdge(edge); }}><line className="mind-map-edge-hit" x1={x1} y1={y1} x2={x2} y2={y2} /><line x1={x1} y1={y1} x2={x2} y2={y2} />{map.showLabels && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 7}>{edge.label}</text>}</g>; })}</svg>{filtered.nodes.map((node) => { const p = positions[node.id] || { x: 0, y: 0 }; const count = filtered.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length; return <button key={node.id} className={`mind-map-node is-${node.type} ${selectedId === node.id ? 'is-selected' : ''}`} style={{ left: p.x, top: p.y, ...(node.color ? { borderLeftColor: node.color } : {}) }} aria-pressed={selectedId === node.id} onPointerDown={(event) => startNodeDrag(event, node.id)} onClick={(event) => { if (suppressClickRef.current === node.id) { event.preventDefault(); return; } openNode(node.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNode(node.id); } }}><small>{node.category}</small><strong>{node.title}</strong><span>{node.status || node.summary || 'No summary recorded.'}</span><footer>{count} connection{count === 1 ? '' : 's'}{node.confidence == null ? '' : ` · ${node.confidence}%`}</footer></button>; })}</div>
      {!filtered.nodes.length && <div className="mind-map-empty"><strong>No records match this view.</strong><span>Clear filters, choose a broader scope, or add a custom note.</span></div>}
    </div>
    {inspectorOpen && <aside className="mind-map-inspector mind-map-inspector--enhanced"><header><div><p>{inspectorMode === 'edge' ? (selectedEdge?.source === 'map' ? 'Map-only relationship' : 'Canonical relationship') : inspectorMode === 'connect' ? 'New map connection' : selected?.category || 'Map note'}</p><h3>{inspectorMode === 'edge' ? selectedEdge?.label || 'Relationship' : inspectorMode === 'connect' ? 'Connect records' : selected?.title || (selectedCustom ? 'Edit note' : 'Add custom note')}</h3></div><button onClick={() => setInspectorOpen(false)}>×</button></header><div className="mind-map-inspector-body">
      {inspectorMode === 'note' && <section className="mind-map-note-form"><label>Title<input value={noteDraft.title} onChange={(event) => setNoteDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Summary<textarea value={noteDraft.summary} onChange={(event) => setNoteDraft((current) => ({ ...current, summary: event.target.value }))} /></label><label>Color<input type="color" value={noteDraft.color} onChange={(event) => setNoteDraft((current) => ({ ...current, color: event.target.value }))} /></label><button onClick={selectedCustom ? saveCustomNote : addNote} disabled={!noteDraft.title.trim()}>{selectedCustom ? 'Save note' : 'Add note to map'}</button>{selectedCustom && <button className="danger-button" onClick={deleteCustomNote}>Delete note</button>}</section>}
      {(inspectorMode === 'connect' || inspectorMode === 'edge') && <section className="mind-map-edge-form"><label>From<select value={edgeDraft.from} onChange={(event) => setEdgeDraft((current) => ({ ...current, from: event.target.value }))} disabled={inspectorMode === 'edge' && selectedEdge?.source === 'canonical'}><option value="">Choose record</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.category}</option>)}</select></label><label>To<select value={edgeDraft.to} onChange={(event) => setEdgeDraft((current) => ({ ...current, to: event.target.value }))} disabled={inspectorMode === 'edge' && selectedEdge?.source === 'canonical'}><option value="">Choose record</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.category}</option>)}</select></label><label>Connection label<input value={edgeDraft.label} onChange={(event) => setEdgeDraft((current) => ({ ...current, label: event.target.value }))} disabled={inspectorMode === 'edge' && selectedEdge?.source === 'canonical'} /></label><label>Explanation<textarea value={edgeDraft.explanation} onChange={(event) => setEdgeDraft((current) => ({ ...current, explanation: event.target.value }))} disabled={inspectorMode === 'edge' && selectedEdge?.source === 'canonical'} /></label>{selectedEdge?.source === 'canonical' ? <p className="mind-map-readonly-note">This relationship comes from the archive and is read-only here. Create a map-only relationship when you need a different visual label or explanation.</p> : <><div className="mind-map-edge-actions"><button onClick={reverseConnection}>Reverse direction</button><button onClick={saveConnection} disabled={!edgeDraft.from || !edgeDraft.to || edgeDraft.from === edgeDraft.to || !edgeDraft.label.trim()}>{inspectorMode === 'edge' ? 'Save connection' : 'Add connection'}</button></div>{inspectorMode === 'edge' && <button className="danger-button" onClick={deleteConnection}>Delete map connection</button>}</>}</section>}
      {inspectorMode === 'node' && selected && <><section><h4>Overview</h4><p>{selected.summary || 'No summary recorded.'}</p>{selected.status && <span className="mind-map-pill">{selected.status}</span>}{selected.confidence != null && <span className="mind-map-pill">{selected.confidence}% confidence</span>}</section><section><div className="mind-map-section-title"><h4>Connections</h4><button onClick={() => startConnect(selected.id)}>+ Add</button></div>{selectedConnections.length ? selectedConnections.map((edge) => { const otherId = edge.from === selected.id ? edge.to : edge.from; const other = graph.nodes.find((node) => node.id === otherId); return <div className="mind-map-connection-row" key={edge.id}><button className="mind-map-connection" onClick={() => openNode(otherId)}><span>{edge.label}</span><strong>{other?.title || 'Missing record'}</strong></button><button aria-label={`Inspect ${edge.label}`} onClick={() => openEdge(edge)}>•••</button></div>; }) : <p>No connections yet.</p>}</section><section className="mind-map-inspector-actions"><button onClick={centerSelected}>Center node</button><button onClick={() => { const ids = new Set(selectedConnections.flatMap((edge) => [edge.from, edge.to])); updateMap({ hiddenIds: graph.nodes.filter((node) => node.id !== selected.id && !ids.has(node.id)).map((node) => node.id) }); }}>Focus neighborhood</button><button onClick={() => updateMap({ hiddenIds: [...new Set([...map.hiddenIds, selected.id])] })}>Hide node</button><button onClick={() => updateMap({ hiddenIds: [] })}>Show all nodes</button>{selectedCustom && <button onClick={beginEditCustom}>Edit note</button>}</section></>}
    </div></aside>}
  </div>;
}
