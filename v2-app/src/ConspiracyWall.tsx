import { useMemo, useRef, useState } from 'react';
import type { V2ArchiveState } from './archive';
import type { WallCardRecord, WallRecord, WallRegionRecord, WallRegionRule, WallSourceType } from './domain';
import './conspiracy-wall.css';

type Interaction =
  | { kind: 'card-move'; id: string; startX: number; startY: number; x: number; y: number }
  | { kind: 'card-resize'; id: string; startX: number; startY: number; width: number; height: number }
  | { kind: 'region-move'; id: string; startX: number; startY: number; x: number; y: number }
  | { kind: 'region-resize'; id: string; startX: number; startY: number; width: number; height: number };

type WallSource = { type: WallSourceType; id: string; title: string; subtitle: string; status?: string };

const WALL_KEY = 'empyrean-v2-active-wall';
const RULE_LABELS: Record<WallRegionRule, string> = {
  manual: 'Manual only', any: 'Any unassigned card', book: 'Books', theory: 'Theories', suspicion: 'Suspicions',
  'open-investigation': 'Open investigations', 'resolved-investigation': 'Resolved investigations',
};

function timestamp() { return new Date().toISOString(); }
function readActiveWall() { try { return localStorage.getItem(WALL_KEY) || ''; } catch { return ''; } }
function alphaColor(color: string, alpha = '2e') { return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : '#a64f242e'; }
function defaultWall(title = 'Primary Conspiracy Wall'): WallRecord {
  const now = timestamp();
  return { id: crypto.randomUUID(), title, cards: [], regions: [], canvasWidth: 1800, canvasHeight: 1100, createdAt: now, updatedAt: now };
}

export function ConspiracyWall({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const fallbackRef = useRef<WallRecord>(defaultWall());
  const initialId = readActiveWall();
  const [activeWallId, setActiveWallId] = useState(initialId);
  const [search, setSearch] = useState('');
  const [noteCardId, setNoteCardId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showRegions, setShowRegions] = useState(true);
  const interactionRef = useRef<Interaction | null>(null);

  const wall = archive.walls.find((item) => item.id === activeWallId) ?? archive.walls[0] ?? fallbackRef.current;
  const noteCard = wall.cards.find((card) => card.id === noteCardId) ?? null;

  const allSources = useMemo<WallSource[]>(() => [
    ...archive.books.map((book) => ({ type: 'book' as const, id: book.id, title: book.title, subtitle: book.author || book.series || 'Book', status: book.status })),
    ...archive.theories.map((item) => ({ type: 'theory' as const, id: item.id, title: item.title, subtitle: `${item.confidence}% confidence · ${item.status}`, status: item.status })),
    ...archive.suspicions.map((item) => ({ type: 'suspicion' as const, id: item.id, title: item.title, subtitle: `${item.confidence}% confidence · ${item.status}`, status: item.status })),
  ], [archive.books, archive.theories, archive.suspicions]);

  const sources = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allSources.filter((item) => !wall.cards.some((card) => card.sourceType === item.type && card.sourceId === item.id) && (!query || `${item.title} ${item.subtitle} ${item.type}`.toLowerCase().includes(query))).slice(0, 30);
  }, [allSources, search, wall.cards]);

  function sourceFor(card: WallCardRecord) { return allSources.find((item) => item.type === card.sourceType && item.id === card.sourceId); }
  function setActive(id: string) { setActiveWallId(id); try { localStorage.setItem(WALL_KEY, id); } catch { /* storage unavailable */ } }

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
    const next: WallRecord = {
      ...structuredClone(wall), id: crypto.randomUUID(), title: `${wall.title} Copy`, createdAt: now, updatedAt: now,
      cards: wall.cards.map((card) => ({ ...card, id: crypto.randomUUID(), createdAt: now, updatedAt: now })),
      regions: wall.regions.map((region) => ({ ...region, id: crypto.randomUUID(), createdAt: now, updatedAt: now })),
    };
    await saveWalls([...archive.walls, next]);
    setActive(next.id);
  }
  async function deleteBoard() {
    if (!archive.walls.some((item) => item.id === wall.id)) return;
    if (!window.confirm(`Delete “${wall.title}” and all of its pins and regions?`)) return;
    const remaining = archive.walls.filter((item) => item.id !== wall.id);
    await saveWalls(remaining);
    setActive(remaining[0]?.id || '');
  }

  function matchesRegion(source: WallSource | undefined, rule: WallRegionRule) {
    if (!source || rule === 'manual') return false;
    if (rule === 'any') return true;
    if (rule === 'book' || rule === 'theory' || rule === 'suspicion') return source.type === rule;
    if (source.type === 'book') return false;
    if (rule === 'open-investigation') return source.status === 'open';
    return source.status === 'confirmed' || source.status === 'disproven' || source.status === 'resolved' || source.status === 'dismissed';
  }

  function sortedWall(input: WallRecord) {
    const autoRegions = input.regions.filter((region) => region.autoSort && region.rule !== 'manual');
    if (!autoRegions.length) return input;
    const counts = new Map<string, number>();
    const cards = input.cards.map((card) => {
      const source = allSources.find((item) => item.type === card.sourceType && item.id === card.sourceId);
      const region = autoRegions.find((candidate) => matchesRegion(source, candidate.rule));
      if (!region) return card.regionId && autoRegions.some((item) => item.id === card.regionId) ? { ...card, regionId: undefined } : card;
      const index = counts.get(region.id) ?? 0;
      counts.set(region.id, index + 1);
      const columns = Math.max(1, Math.floor((region.width - 36) / 220));
      const column = index % columns;
      const row = Math.floor(index / columns);
      return { ...card, regionId: region.id, x: region.x + 18 + column * 220, y: region.y + 48 + row * 210, width: Math.min(card.width, 200), height: Math.min(card.height, 190), updatedAt: timestamp() };
    });
    return { ...input, cards };
  }

  async function addCard(sourceType: WallSourceType, sourceId: string) {
    const index = wall.cards.length;
    const now = timestamp();
    const card: WallCardRecord = { id: crypto.randomUUID(), sourceType, sourceId, x: 60 + (index % 5) * 245, y: 80 + Math.floor(index / 5) * 280, width: 230, height: 260, color: sourceType === 'suspicion' ? '#9b4f72' : sourceType === 'theory' ? '#b55b2a' : '#6b7f9d', createdAt: now, updatedAt: now };
    await saveWall(sortedWall({ ...wall, cards: [...wall.cards, card] }));
    setSearch('');
  }
  async function updateCard(id: string, changes: Partial<WallCardRecord>) { await saveWall({ ...wall, cards: wall.cards.map((card) => card.id === id ? { ...card, ...changes, updatedAt: timestamp() } : card) }); }
  async function removeCard(id: string) { await saveWall({ ...wall, cards: wall.cards.filter((card) => card.id !== id) }); }

  async function addRegion() {
    const index = wall.regions.length;
    const now = timestamp();
    const region: WallRegionRecord = { id: crypto.randomUUID(), title: `Region ${index + 1}`, x: 40 + (index % 2) * 620, y: 40 + Math.floor(index / 2) * 440, width: 570, height: 390, color: '#6f4427', rule: 'manual', autoSort: false, createdAt: now, updatedAt: now };
    await saveWall({ ...wall, regions: [...wall.regions, region] });
    setShowRegions(true);
  }
  async function updateRegion(id: string, changes: Partial<WallRegionRecord>, shouldSort = false) {
    const next = { ...wall, regions: wall.regions.map((region) => region.id === id ? { ...region, ...changes, updatedAt: timestamp() } : region) };
    await saveWall(shouldSort ? sortedWall(next) : next);
  }
  async function removeRegion(id: string) {
    await saveWall({ ...wall, regions: wall.regions.filter((region) => region.id !== id), cards: wall.cards.map((card) => card.regionId === id ? { ...card, regionId: undefined } : card) });
  }
  async function autoSort() { await saveWall(sortedWall(wall)); }

  function beginInteraction(event: React.PointerEvent<HTMLElement>, interaction: Interaction) {
    if ((event.target as HTMLElement).closest('button, input, textarea, select')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = interaction;
  }
  function moveInteraction(event: React.PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    const element = event.currentTarget as HTMLElement;
    if (interaction.kind.endsWith('move')) {
      element.style.left = `${Math.max(0, interaction.x + dx)}px`;
      element.style.top = `${Math.max(0, interaction.y + dy)}px`;
    } else {
      element.style.width = `${Math.max(interaction.kind === 'card-resize' ? 170 : 260, interaction.width + dx)}px`;
      element.style.height = `${Math.max(interaction.kind === 'card-resize' ? 150 : 220, interaction.height + dy)}px`;
    }
  }
  function endInteraction(event: React.PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    interactionRef.current = null;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    if (interaction.kind === 'card-move') updateCard(interaction.id, { x: Math.max(0, Math.round(interaction.x + dx)), y: Math.max(0, Math.round(interaction.y + dy)), regionId: undefined }).catch(console.error);
    if (interaction.kind === 'card-resize') updateCard(interaction.id, { width: Math.max(170, Math.round(interaction.width + dx)), height: Math.max(150, Math.round(interaction.height + dy)) }).catch(console.error);
    if (interaction.kind === 'region-move') updateRegion(interaction.id, { x: Math.max(0, Math.round(interaction.x + dx)), y: Math.max(0, Math.round(interaction.y + dy)) }).catch(console.error);
    if (interaction.kind === 'region-resize') updateRegion(interaction.id, { width: Math.max(260, Math.round(interaction.width + dx)), height: Math.max(220, Math.round(interaction.height + dy)) }).catch(console.error);
  }

  function openNote(card: WallCardRecord) { setNoteCardId(card.id); setNoteText(card.note ?? ''); }
  async function saveNote() { if (!noteCard) return; await updateCard(noteCard.id, { note: noteText.trim() || undefined }); setNoteCardId(null); }

  return <div className="wall-module">
    <header className="wall-main-header">
      <div><p>Investigation Board</p><h2>Conspiracy Wall</h2><span>Build multiple boards, organize evidence into regions, and follow every thread.</span></div>
      <div className="wall-board-actions"><button onClick={createBoard}>+ New Board</button><button onClick={duplicateBoard}>Duplicate</button><button className="is-danger" disabled={!archive.walls.some((item) => item.id === wall.id)} onClick={deleteBoard}>Delete Board</button></div>
    </header>

    <section className="wall-board-bar">
      <label>Board<select value={wall.id} onChange={(event) => setActive(event.target.value)}>{archive.walls.length ? archive.walls.map((item) => <option key={item.id} value={item.id}>{item.title}</option>) : <option value={wall.id}>{wall.title}</option>}</select></label>
      <label className="wall-title-field">Board title<input value={wall.title} onChange={(event) => saveWall({ ...wall, title: event.target.value })} /></label>
      <button onClick={addRegion}>+ Add Region</button><button disabled={!wall.regions.some((region) => region.autoSort)} onClick={autoSort}>Auto-sort Board</button><button onClick={() => setShowRegions((value) => !value)}>{showRegions ? 'Hide' : 'Show'} Regions</button>
    </section>

    {showRegions && <section className="wall-region-manager">
      {wall.regions.length ? wall.regions.map((region) => <article key={region.id}>
        <input aria-label="Region title" value={region.title} onChange={(event) => updateRegion(region.id, { title: event.target.value })} />
        <select value={region.rule} onChange={(event) => updateRegion(region.id, { rule: event.target.value as WallRegionRule }, region.autoSort)}>{Object.entries(RULE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label><input type="checkbox" checked={region.autoSort} onChange={(event) => updateRegion(region.id, { autoSort: event.target.checked }, event.target.checked)} />Auto-sort</label>
        <input aria-label="Region color" type="color" value={region.color} onChange={(event) => updateRegion(region.id, { color: event.target.value })} />
        <button className="is-danger" onClick={() => removeRegion(region.id)}>Remove</button>
      </article>) : <p>No regions yet. Add one to group and optionally auto-sort evidence.</p>}
    </section>}

    <section className="wall-source-panel"><label>Add to wall<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search books, theories, or suspicions…" /></label>{search && <div className="wall-source-results">{sources.length ? sources.map((source) => <button key={`${source.type}-${source.id}`} onClick={() => addCard(source.type, source.id)}><strong>{source.title}</strong><span>{source.type} · {source.subtitle}</span></button>) : <p>No matching items available.</p>}</div>}</section>

    <div className="wall-viewport"><section className="wall-canvas" style={{ width: wall.canvasWidth, height: wall.canvasHeight }}>
      {showRegions && wall.regions.map((region) => <article key={region.id} className="wall-region" style={{ left: region.x, top: region.y, width: region.width, height: region.height, borderColor: region.color, backgroundColor: alphaColor(region.color, '12') }} onPointerDown={(event) => beginInteraction(event, { kind: 'region-move', id: region.id, startX: event.clientX, startY: event.clientY, x: region.x, y: region.y })} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction}>
        <header><strong>{region.title}</strong><span>{RULE_LABELS[region.rule]}{region.autoSort ? ' · auto' : ''}</span></header><button className="wall-resize-handle" aria-label={`Resize ${region.title}`} onPointerDown={(event) => { event.stopPropagation(); beginInteraction(event, { kind: 'region-resize', id: region.id, startX: event.clientX, startY: event.clientY, width: region.width, height: region.height }); }} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />
      </article>)}

      {wall.cards.map((card) => {
        const source = sourceFor(card);
        const body = card.sourceType === 'book' ? archive.books.find((item) => item.id === card.sourceId)?.summary || source?.subtitle : card.sourceType === 'theory' ? archive.theories.find((item) => item.id === card.sourceId)?.statement : archive.suspicions.find((item) => item.id === card.sourceId)?.details;
        const color = card.color || '#a64f24';
        return <article key={card.id} className={`wall-card is-${card.sourceType}`} style={{ left: card.x, top: card.y, width: card.width, height: card.height, borderColor: color, backgroundColor: alphaColor(color, '38') }} onPointerDown={(event) => beginInteraction(event, { kind: 'card-move', id: card.id, startX: event.clientX, startY: event.clientY, x: card.x, y: card.y })} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction}>
          <header><span>{card.sourceType}</span><div><button title="Edit wall note" onClick={() => openNote(card)}>✎</button><button title="Remove from wall" onClick={() => removeCard(card.id)}>×</button></div></header>
          <h3>{source?.title || 'Missing source'}</h3>{body && <p className="wall-card-body">{body}</p>}{card.note && <blockquote>{card.note}</blockquote>}
          <footer><label>Card color<input type="color" value={color} onChange={(event) => updateCard(card.id, { color: event.target.value })} /></label><small>{source?.subtitle}</small></footer>
          <button className="wall-resize-handle" aria-label={`Resize ${source?.title || 'card'}`} onPointerDown={(event) => { event.stopPropagation(); beginInteraction(event, { kind: 'card-resize', id: card.id, startX: event.clientX, startY: event.clientY, width: card.width, height: card.height }); }} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />
        </article>;
      })}
      {!wall.cards.length && <div className="wall-empty"><span>✣</span><h3>Your wall is empty</h3><p>Search above to pin a book, theory, or suspicion.</p></div>}
    </section></div>

    {noteCard && <div className="wall-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteCardId(null); }}><section className="wall-note-modal" role="dialog" aria-modal="true"><header><div><p>Wall Note</p><h3>{sourceFor(noteCard)?.title}</h3></div><button onClick={() => setNoteCardId(null)}>×</button></header><textarea autoFocus rows={8} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Record the thread, clue, contradiction, or question this pin represents…" /><footer><button onClick={() => setNoteCardId(null)}>Cancel</button><button className="is-primary" onClick={saveNote}>Save Note</button></footer></section></div>}
  </div>;
}
