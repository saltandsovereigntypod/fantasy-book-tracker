import { useMemo, useState } from 'react';
import { CardRenderer } from './CardRenderer';
import { defaultBook, defaultDesign } from './defaults';
import type { BookFieldPath, BookRecord, CardDesign, CardSize, DesignElement } from './domain';
import { FIELD_LABELS } from './domain';
import './styles.css';

const fieldOrder: BookFieldPath[] = ['title', 'author', 'series', 'coverUrl', 'status', 'progress', 'rating', 'spice', 'impact', 'reaction'];

function hasBinding(design: CardDesign, path: BookFieldPath) {
  return design.elements.some((element) => element.binding === path);
}

function createBoundElement(path: BookFieldPath, index: number): DesignElement {
  const y = 40 + (index % 8) * 38;
  if (path === 'coverUrl') {
    return { id: `element-${crypto.randomUUID()}`, type: 'image', binding: path, x: 24, y, width: 100, height: 140, fit: 'cover', borderRadius: 10 };
  }
  if (path === 'progress') {
    return { id: `element-${crypto.randomUUID()}`, type: 'progress', binding: path, x: 150, y, width: 220, height: 9, trackColor: '#75451f', fillColor: '#bd662f', borderRadius: 999 };
  }
  if (path === 'rating' || path === 'spice' || path === 'impact') {
    return {
      id: `element-${crypto.randomUUID()}`,
      type: 'rating',
      binding: path,
      metric: path,
      label: FIELD_LABELS[path],
      icon: path === 'rating' ? '★' : path === 'spice' ? '🔥' : '♥',
      emptyIcon: path === 'rating' ? '☆' : path === 'spice' ? '·' : '♡',
      x: 150,
      y,
      width: 150,
      height: 64,
      color: '#bd662f',
      fontFamily: 'Inter',
      fontSize: 13,
    };
  }
  return {
    id: `element-${crypto.randomUUID()}`,
    type: 'text',
    binding: path,
    x: 150,
    y,
    width: 220,
    height: path === 'title' ? 58 : 34,
    fontFamily: path === 'title' || path === 'reaction' ? 'Libre Baskerville' : 'Inter',
    fontSize: path === 'title' ? 26 : 14,
    fontWeight: path === 'title' ? 700 : 600,
    fontStyle: path === 'reaction' ? 'italic' : 'normal',
    color: path === 'series' || path === 'reaction' ? '#c8a878' : '#f7ead2',
  };
}

export default function App() {
  const [book, setBook] = useState<BookRecord>(defaultBook);
  const [design, setDesign] = useState<CardDesign>(defaultDesign);
  const [selectedElementId, setSelectedElementId] = useState<string | null>('title');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [activeBookSection, setActiveBookSection] = useState<'details' | 'ratings' | 'connections'>('details');

  const selectedElement = useMemo(
    () => design.elements.find((element) => element.id === selectedElementId) ?? null,
    [design.elements, selectedElementId],
  );

  function updateBook<K extends keyof BookRecord>(key: K, value: BookRecord[K]) {
    setBook((current) => ({ ...current, [key]: value }));
  }

  function addField(path: BookFieldPath) {
    const existing = design.elements.find((element) => element.binding === path);
    if (existing) {
      setSelectedElementId(existing.id);
      return;
    }
    const element = createBoundElement(path, design.elements.length);
    setDesign((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedElementId(element.id);
  }

  function updateSelected(changes: Partial<DesignElement>) {
    if (!selectedElementId) return;
    setDesign((current) => ({
      ...current,
      elements: current.elements.map((element) => element.id === selectedElementId ? { ...element, ...changes } as DesignElement : element),
    }));
  }

  function removeSelected() {
    if (!selectedElementId) return;
    setDesign((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selectedElementId) }));
    setSelectedElementId(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">The Empyrean Tracker · V2</p>
          <h1>Book Workspace</h1>
        </div>
        <div className="header-actions">
          <div className="size-switcher" aria-label="Card output size">
            {(['small', 'medium', 'large'] as CardSize[]).map((size) => (
              <button key={size} className={cardSize === size ? 'is-active' : ''} onClick={() => setCardSize(size)}>{size}</button>
            ))}
          </div>
          <button className="primary-button">Save Book</button>
        </div>
      </header>

      <main className="workspace-grid">
        <aside className="panel book-panel">
          <div className="panel-heading">
            <p className="eyebrow">Book</p>
            <h2>Entry and connections</h2>
          </div>
          <nav className="section-tabs">
            <button className={activeBookSection === 'details' ? 'is-active' : ''} onClick={() => setActiveBookSection('details')}>Details</button>
            <button className={activeBookSection === 'ratings' ? 'is-active' : ''} onClick={() => setActiveBookSection('ratings')}>Ratings</button>
            <button className={activeBookSection === 'connections' ? 'is-active' : ''} onClick={() => setActiveBookSection('connections')}>Connections</button>
          </nav>

          {activeBookSection === 'details' && (
            <div className="field-stack">
              <FieldRow label="Title" onAdd={() => addField('title')} included={hasBinding(design, 'title')}><input value={book.title} onChange={(event) => updateBook('title', event.target.value)} /></FieldRow>
              <FieldRow label="Author" onAdd={() => addField('author')} included={hasBinding(design, 'author')}><input value={book.author} onChange={(event) => updateBook('author', event.target.value)} /></FieldRow>
              <FieldRow label="Series" onAdd={() => addField('series')} included={hasBinding(design, 'series')}><input value={book.series} onChange={(event) => updateBook('series', event.target.value)} /></FieldRow>
              <FieldRow label="Cover image URL" onAdd={() => addField('coverUrl')} included={hasBinding(design, 'coverUrl')}><input value={book.coverUrl} onChange={(event) => updateBook('coverUrl', event.target.value)} placeholder="Paste an image URL" /></FieldRow>
              <FieldRow label="Status" onAdd={() => addField('status')} included={hasBinding(design, 'status')}>
                <select value={book.status} onChange={(event) => updateBook('status', event.target.value as BookRecord['status'])}>
                  <option value="want">Want to read</option><option value="reading">Currently reading</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="dnf">DNF</option>
                </select>
              </FieldRow>
              <FieldRow label={`Progress · ${book.progress}%`} onAdd={() => addField('progress')} included={hasBinding(design, 'progress')}><input type="range" min="0" max="100" value={book.progress} onChange={(event) => updateBook('progress', Number(event.target.value))} /></FieldRow>
              <FieldRow label="Reaction" onAdd={() => addField('reaction')} included={hasBinding(design, 'reaction')}><textarea value={book.reaction} onChange={(event) => updateBook('reaction', event.target.value)} /></FieldRow>
            </div>
          )}

          {activeBookSection === 'ratings' && (
            <div className="field-stack">
              {(['rating', 'spice', 'impact'] as const).map((path) => (
                <FieldRow key={path} label={`${FIELD_LABELS[path]} · ${book[path]}`} onAdd={() => addField(path)} included={hasBinding(design, path)}>
                  <input type="range" min="0" max="5" step="0.5" value={book[path]} onChange={(event) => updateBook(path, Number(event.target.value))} />
                </FieldRow>
              ))}
            </div>
          )}

          {activeBookSection === 'connections' && (
            <div className="connection-stack">
              <ConnectionCard title="Mind Map" count={book.mindMapNodeIds.length} action="Link nodes" />
              <ConnectionCard title="Conspiracy Wall" count={book.wallCardIds.length} action="Link cards" />
              <ConnectionCard title="Theories" count={book.theoryIds.length} action="Link theories" />
            </div>
          )}
        </aside>

        <section className="design-stage" onPointerDown={() => setSelectedElementId(null)}>
          <div className="stage-heading">
            <div><p className="eyebrow">Design</p><h2>Live card</h2></div>
            <span>{cardSize} output · browser-native text</span>
          </div>
          <div className="stage-canvas">
            <CardRenderer book={book} design={design} size={cardSize} mode="editor" selectedElementId={selectedElementId} onSelectElement={setSelectedElementId} />
          </div>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading"><p className="eyebrow">Inspector</p><h2>{selectedElement ? selectedElement.id : 'Nothing selected'}</h2></div>
          {selectedElement ? (
            <div className="field-stack">
              <label>X<input type="number" value={selectedElement.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })} /></label>
              <label>Y<input type="number" value={selectedElement.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })} /></label>
              <label>Width<input type="number" value={selectedElement.width} onChange={(event) => updateSelected({ width: Number(event.target.value) })} /></label>
              <label>Height<input type="number" value={selectedElement.height} onChange={(event) => updateSelected({ height: Number(event.target.value) })} /></label>
              <label>Rotation<input type="range" min="-180" max="180" value={selectedElement.rotation ?? 0} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} /></label>
              <label>Opacity<input type="range" min="0" max="1" step="0.05" value={selectedElement.opacity ?? 1} onChange={(event) => updateSelected({ opacity: Number(event.target.value) })} /></label>
              {'fontSize' in selectedElement && <label>Font size<input type="range" min="8" max="72" value={selectedElement.fontSize} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) } as Partial<DesignElement>)} /></label>}
              <button className="danger-button" onClick={removeSelected}>Remove from design</button>
            </div>
          ) : <p className="muted-copy">Select an element on the card or use an “On card” button in the Book panel.</p>}
        </aside>
      </main>
    </div>
  );
}

function FieldRow({ label, onAdd, included, children }: { label: string; onAdd: () => void; included: boolean; children: React.ReactNode }) {
  return <section className="field-row"><div className="field-row-heading"><label>{label}</label><button type="button" onClick={onAdd}>{included ? 'On card ✓' : '+'}</button></div>{children}</section>;
}

function ConnectionCard({ title, count, action }: { title: string; count: number; action: string }) {
  return <section className="connection-card"><div><strong>{title}</strong><span>{count} linked</span></div><button>{action}</button></section>;
}
