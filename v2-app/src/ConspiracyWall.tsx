import { useMemo, useRef, useState } from 'react';
import type { V2ArchiveState } from './archive';
import type { WallCardRecord, WallRecord, WallSourceType } from './domain';
import './conspiracy-wall.css';

type DragState = { id: string; startX: number; startY: number; x: number; y: number };

export function ConspiracyWall({ archive, onSave }: { archive: V2ArchiveState; onSave: (next: V2ArchiveState) => Promise<void> }) {
  const [search, setSearch] = useState('');
  const dragRef = useRef<DragState | null>(null);
  const wall = archive.walls[0] ?? { id: crypto.randomUUID(), title: 'Primary Conspiracy Wall', cards: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  const sources = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = [
      ...archive.books.map((book) => ({ type: 'book' as const, id: book.id, title: book.title, subtitle: book.author || book.series || 'Book' })),
      ...archive.theories.map((item) => ({ type: 'theory' as const, id: item.id, title: item.title, subtitle: `${item.confidence}% confidence` })),
      ...archive.suspicions.map((item) => ({ type: 'suspicion' as const, id: item.id, title: item.title, subtitle: `${item.confidence}% confidence` })),
    ];
    return items.filter((item) => !wall.cards.some((card) => card.sourceType === item.type && card.sourceId === item.id) && (!query || `${item.title} ${item.subtitle}`.toLowerCase().includes(query))).slice(0, 20);
  }, [archive.books, archive.theories, archive.suspicions, search, wall.cards]);

  async function saveWall(nextWall: WallRecord) {
    await onSave({ ...archive, walls: archive.walls.length ? archive.walls.map((item, index) => index === 0 ? nextWall : item) : [nextWall] });
  }
  async function addCard(sourceType: WallSourceType, sourceId: string) {
    const index = wall.cards.length;
    const timestamp = new Date().toISOString();
    const card: WallCardRecord = { id: crypto.randomUUID(), sourceType, sourceId, x: 60 + (index % 4) * 230, y: 70 + Math.floor(index / 4) * 170, createdAt: timestamp, updatedAt: timestamp };
    await saveWall({ ...wall, cards: [...wall.cards, card], updatedAt: timestamp });
    setSearch('');
  }
  async function updateCard(id: string, changes: Partial<WallCardRecord>) {
    await saveWall({ ...wall, cards: wall.cards.map((card) => card.id === id ? { ...card, ...changes, updatedAt: new Date().toISOString() } : card), updatedAt: new Date().toISOString() });
  }
  async function removeCard(id: string) {
    await saveWall({ ...wall, cards: wall.cards.filter((card) => card.id !== id), updatedAt: new Date().toISOString() });
  }
  function sourceFor(card: WallCardRecord) {
    if (card.sourceType === 'book') return archive.books.find((item) => item.id === card.sourceId);
    if (card.sourceType === 'theory') return archive.theories.find((item) => item.id === card.sourceId);
    return archive.suspicions.find((item) => item.id === card.sourceId);
  }
  function pointerDown(event: React.PointerEvent<HTMLElement>, card: WallCardRecord) {
    if ((event.target as HTMLElement).closest('button, textarea')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: card.id, startX: event.clientX, startY: event.clientY, x: card.x, y: card.y };
  }
  function pointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const element = event.currentTarget as HTMLElement;
    element.style.left = `${Math.max(0, drag.x + event.clientX - drag.startX)}px`;
    element.style.top = `${Math.max(0, drag.y + event.clientY - drag.startY)}px`;
  }
  function pointerUp(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const x = Math.max(0, drag.x + event.clientX - drag.startX);
    const y = Math.max(0, drag.y + event.clientY - drag.startY);
    updateCard(drag.id, { x: Math.round(x), y: Math.round(y) }).catch(console.error);
  }

  return <div className="wall-module">
    <header><div><p>Investigation Board</p><h2>Conspiracy Wall</h2><span>Pin books, theories, and suspicions into one visual evidence field.</span></div><label>Wall title<input value={wall.title} onChange={(event) => saveWall({ ...wall, title: event.target.value, updatedAt: new Date().toISOString() })} /></label></header>
    <section className="wall-source-panel"><label>Add to wall<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search books, theories, or suspicions…" /></label>{search && <div className="wall-source-results">{sources.length ? sources.map((source) => <button key={`${source.type}-${source.id}`} onClick={() => addCard(source.type, source.id)}><strong>{source.title}</strong><span>{source.type} · {source.subtitle}</span></button>) : <p>No matching items available.</p>}</div>}</section>
    <section className="wall-canvas">
      {wall.cards.map((card) => {
        const source = sourceFor(card);
        const title = source && 'title' in source ? source.title : 'Missing source';
        const body = card.sourceType === 'book' ? (source && 'author' in source ? source.author || source.series : '') : card.sourceType === 'theory' ? (source && 'statement' in source ? source.statement : '') : (source && 'details' in source ? source.details : '');
        return <article key={card.id} className={`wall-card is-${card.sourceType}`} style={{ left: card.x, top: card.y, borderColor: card.color }} onPointerDown={(event) => pointerDown(event, card)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <header><span>{card.sourceType}</span><button onClick={() => removeCard(card.id)}>×</button></header><h3>{title}</h3>{body && <p>{body}</p>}<textarea placeholder="Wall note…" value={card.note ?? ''} onChange={(event) => updateCard(card.id, { note: event.target.value })} /><label>Pin color<input type="color" value={card.color || '#a64f24'} onChange={(event) => updateCard(card.id, { color: event.target.value })} /></label>
        </article>;
      })}
      {!wall.cards.length && <div className="wall-empty"><span>✣</span><h3>Your wall is empty</h3><p>Search above to pin a book, theory, or suspicion.</p></div>}
    </section>
  </div>;
}
