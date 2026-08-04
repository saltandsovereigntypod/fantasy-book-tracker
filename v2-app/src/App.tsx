import { useEffect, useMemo, useRef, useState } from 'react';
import { CardRenderer } from './CardRenderer';
import { defaultBook, defaultDesign } from './defaults';
import type { BookFieldPath, BookRecord, CardDesign, CardSize, DesignElement } from './domain';
import { FIELD_LABELS } from './domain';
import './styles.css';

const RATING_ICON_PRESETS = [
  { label: 'Stars', icon: '★', emptyIcon: '☆' },
  { label: 'Hearts', icon: '♥', emptyIcon: '♡' },
  { label: 'Diamonds', icon: '◆', emptyIcon: '◇' },
  { label: 'Circles', icon: '●', emptyIcon: '○' },
  { label: 'Squares', icon: '■', emptyIcon: '□' },
  { label: 'Triangles', icon: '▲', emptyIcon: '△' },
  { label: 'Sparkles', icon: '✦', emptyIcon: '✧' },
  { label: 'Spades', icon: '♠', emptyIcon: '♤' },
  { label: 'Clubs', icon: '♣', emptyIcon: '♧' },
] as const;

type BookSection = 'details' | 'ratings' | 'elements' | 'connections';
type ElementKind = 'text' | 'rectangle' | 'rounded' | 'circle' | 'divider' | 'image';

function cloneDesign(design: CardDesign): CardDesign {
  return structuredClone(design);
}

function hasBinding(design: CardDesign, path: BookFieldPath) {
  return design.elements.some((element) => element.binding === path);
}

function createBoundElement(path: BookFieldPath, index: number): DesignElement {
  const y = 40 + (index % 8) * 38;
  if (path === 'coverUrl') return { id: `element-${crypto.randomUUID()}`, type: 'image', binding: path, x: 24, y, width: 100, height: 140, fit: 'cover', borderRadius: 10 };
  if (path === 'progress') return { id: `element-${crypto.randomUUID()}`, type: 'progress', binding: path, x: 150, y, width: 220, height: 9, trackColor: '#75451f', fillColor: '#bd662f', borderRadius: 999 };
  if (path === 'rating' || path === 'spice' || path === 'impact') {
    const preset = path === 'rating' ? RATING_ICON_PRESETS[0] : path === 'spice' ? RATING_ICON_PRESETS[5] : RATING_ICON_PRESETS[1];
    return { id: `element-${crypto.randomUUID()}`, type: 'rating', binding: path, metric: path, label: FIELD_LABELS[path], icon: preset.icon, emptyIcon: preset.emptyIcon, x: 150, y, width: 150, height: 64, color: '#bd662f', fontFamily: 'Inter', fontSize: 13 };
  }
  return {
    id: `element-${crypto.randomUUID()}`, type: 'text', binding: path, x: 150, y, width: 220,
    height: path === 'title' ? 58 : 34,
    fontFamily: path === 'title' || path === 'reaction' ? 'Libre Baskerville' : 'Inter',
    fontSize: path === 'title' ? 26 : 14,
    fontWeight: path === 'title' ? 700 : 600,
    fontStyle: path === 'reaction' ? 'italic' : 'normal',
    color: path === 'series' || path === 'reaction' ? '#c8a878' : '#f7ead2',
  };
}

function createFreeElement(kind: ElementKind): DesignElement {
  const id = `element-${crypto.randomUUID()}`;
  if (kind === 'text') return { id, type: 'text', text: 'Custom text', x: 110, y: 100, width: 200, height: 52, fontFamily: 'Libre Baskerville', fontSize: 24, fontWeight: 700, color: '#f7ead2', textAlign: 'center', lineHeight: 1.15 };
  if (kind === 'image') return { id, type: 'image', src: '', x: 120, y: 72, width: 180, height: 220, fit: 'contain', borderRadius: 12 };
  if (kind === 'divider') return { id, type: 'shape', x: 80, y: 188, width: 260, height: 4, fill: '#bd662f', borderRadius: 999 };
  if (kind === 'circle') return { id, type: 'shape', x: 150, y: 110, width: 120, height: 120, fill: '#75451f', stroke: '#bd662f', strokeWidth: 2, borderRadius: 999 };
  if (kind === 'rounded') return { id, type: 'shape', x: 110, y: 120, width: 200, height: 100, fill: '#75451f', stroke: '#bd662f', strokeWidth: 2, borderRadius: 20 };
  return { id, type: 'shape', x: 110, y: 120, width: 200, height: 100, fill: '#75451f', stroke: '#bd662f', strokeWidth: 2, borderRadius: 0 };
}

export default function App() {
  const [book, setBook] = useState<BookRecord>(defaultBook);
  const [design, setDesign] = useState<CardDesign>(defaultDesign);
  const [past, setPast] = useState<CardDesign[]>([]);
  const [future, setFuture] = useState<CardDesign[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>('title');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [activeBookSection, setActiveBookSection] = useState<BookSection>('details');
  const designRef = useRef(design);
  const interactionStartRef = useRef<CardDesign | null>(null);

  useEffect(() => { designRef.current = design; }, [design]);

  const selectedElement = useMemo(() => design.elements.find((element) => element.id === selectedElementId) ?? null, [design.elements, selectedElementId]);

  function recordDesign(updater: (current: CardDesign) => CardDesign) {
    setDesign((current) => {
      const next = updater(current);
      if (next === current || JSON.stringify(next) === JSON.stringify(current)) return current;
      setPast((items) => [...items, cloneDesign(current)].slice(-100));
      setFuture([]);
      designRef.current = next;
      return next;
    });
  }

  function updateBook<K extends keyof BookRecord>(key: K, value: BookRecord[K]) {
    setBook((current) => ({ ...current, [key]: value }));
  }

  function addField(path: BookFieldPath) {
    const existing = design.elements.find((element) => element.binding === path);
    if (existing) { setSelectedElementId(existing.id); return; }
    const element = createBoundElement(path, design.elements.length);
    recordDesign((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedElementId(element.id);
  }

  function addFreeElement(kind: ElementKind) {
    const element = createFreeElement(kind);
    recordDesign((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedElementId(element.id);
  }

  function updateElement(id: string, changes: Partial<DesignElement>, record = false) {
    const apply = (current: CardDesign) => ({ ...current, elements: current.elements.map((element) => element.id === id ? { ...element, ...changes } as DesignElement : element) });
    if (record) recordDesign(apply);
    else setDesign((current) => {
      const next = apply(current);
      designRef.current = next;
      return next;
    });
  }

  function updateSelected(changes: Partial<DesignElement>) {
    if (selectedElementId) updateElement(selectedElementId, changes, true);
  }

  function updateSelectedLive(changes: Partial<DesignElement>) {
    if (selectedElementId) updateElement(selectedElementId, changes, false);
  }

  function beginInteraction() {
    if (!interactionStartRef.current) interactionStartRef.current = cloneDesign(designRef.current);
  }

  function endInteraction() {
    const start = interactionStartRef.current;
    interactionStartRef.current = null;
    if (!start || JSON.stringify(start) === JSON.stringify(designRef.current)) return;
    setPast((items) => [...items, start].slice(-100));
    setFuture([]);
  }

  function undo() {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((futureItems) => [cloneDesign(designRef.current), ...futureItems].slice(0, 100));
      const next = cloneDesign(previous);
      designRef.current = next;
      setDesign(next);
      return items.slice(0, -1);
    });
  }

  function redo() {
    setFuture((items) => {
      if (!items.length) return items;
      const next = cloneDesign(items[0]);
      setPast((pastItems) => [...pastItems, cloneDesign(designRef.current)].slice(-100));
      designRef.current = next;
      setDesign(next);
      return items.slice(1);
    });
  }

  function removeSelected() {
    if (!selectedElementId) return;
    recordDesign((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selectedElementId) }));
    setSelectedElementId(null);
  }

  function duplicateSelected() {
    if (!selectedElement) return;
    const duplicate = { ...selectedElement, id: `element-${crypto.randomUUID()}`, x: Math.min(design.width - selectedElement.width, selectedElement.x + 16), y: Math.min(design.height - selectedElement.height, selectedElement.y + 16), locked: false } as DesignElement;
    recordDesign((current) => ({ ...current, elements: [...current.elements, duplicate] }));
    setSelectedElementId(duplicate.id);
  }

  function moveSelectedLayer(direction: 'forward' | 'backward' | 'front' | 'back') {
    if (!selectedElementId) return;
    recordDesign((current) => {
      const protectedBase = current.elements.filter((element) => element.id === 'card-frame');
      const movable = current.elements.filter((element) => element.id !== 'card-frame');
      const index = movable.findIndex((element) => element.id === selectedElementId);
      if (index < 0) return current;
      const [element] = movable.splice(index, 1);
      const nextIndex = direction === 'front' ? movable.length : direction === 'back' ? 0 : direction === 'forward' ? Math.min(movable.length, index + 1) : Math.max(0, index - 1);
      movable.splice(nextIndex, 0, element);
      return { ...current, elements: [...protectedBase, ...movable] };
    });
  }

  function alignSelected(alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') {
    if (!selectedElement) return;
    const changes: Partial<DesignElement> = alignment === 'left' ? { x: 0 }
      : alignment === 'center-x' ? { x: Math.round((design.width - selectedElement.width) / 2) }
      : alignment === 'right' ? { x: design.width - selectedElement.width }
      : alignment === 'top' ? { y: 0 }
      : alignment === 'center-y' ? { y: Math.round((design.height - selectedElement.height) / 2) }
      : { y: design.height - selectedElement.height };
    updateSelected(changes);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (!selectedElement || selectedElement.locked || !event.key.startsWith('Arrow')) return;
      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      const x = Math.max(0, Math.min(design.width - selectedElement.width, selectedElement.x + (event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0)));
      const y = Math.max(0, Math.min(design.height - selectedElement.height, selectedElement.y + (event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0)));
      updateElement(selectedElement.id, { x, y }, true);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, design.width, design.height, past.length, future.length]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">The Empyrean Tracker · V2</p><h1>Book Workspace</h1></div>
        <div className="header-actions">
          <div className="history-controls" aria-label="Design history"><button onClick={undo} disabled={!past.length} title="Undo (Ctrl/Cmd+Z)">↶ Undo</button><button onClick={redo} disabled={!future.length} title="Redo (Ctrl/Cmd+Shift+Z)">↷ Redo</button></div>
          <div className="size-switcher" aria-label="Card output size">{(['small', 'medium', 'large'] as CardSize[]).map((size) => <button key={size} className={cardSize === size ? 'is-active' : ''} onClick={() => setCardSize(size)}>{size}</button>)}</div>
          <button className="primary-button">Save Book</button>
        </div>
      </header>

      <main className="workspace-grid">
        <aside className="panel book-panel">
          <div className="panel-heading"><p className="eyebrow">Book</p><h2>Entry and connections</h2></div>
          <nav className="section-tabs">
            {(['details', 'ratings', 'elements', 'connections'] as BookSection[]).map((section) => <button key={section} className={activeBookSection === section ? 'is-active' : ''} onClick={() => setActiveBookSection(section)}>{section}</button>)}
          </nav>
          {activeBookSection === 'details' && <div className="field-stack">
            <FieldRow label="Title" onAdd={() => addField('title')} included={hasBinding(design, 'title')}><input value={book.title} onChange={(event) => updateBook('title', event.target.value)} /></FieldRow>
            <FieldRow label="Author" onAdd={() => addField('author')} included={hasBinding(design, 'author')}><input value={book.author} onChange={(event) => updateBook('author', event.target.value)} /></FieldRow>
            <FieldRow label="Series" onAdd={() => addField('series')} included={hasBinding(design, 'series')}><input value={book.series} onChange={(event) => updateBook('series', event.target.value)} /></FieldRow>
            <FieldRow label="Cover image URL" onAdd={() => addField('coverUrl')} included={hasBinding(design, 'coverUrl')}><input value={book.coverUrl} onChange={(event) => updateBook('coverUrl', event.target.value)} placeholder="Paste an image URL" /></FieldRow>
            <FieldRow label="Status" onAdd={() => addField('status')} included={hasBinding(design, 'status')}><select value={book.status} onChange={(event) => updateBook('status', event.target.value as BookRecord['status'])}><option value="want">Want to read</option><option value="reading">Currently reading</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="dnf">DNF</option></select></FieldRow>
            <FieldRow label={`Progress · ${book.progress}%`} onAdd={() => addField('progress')} included={hasBinding(design, 'progress')}><input type="range" min="0" max="100" value={book.progress} onChange={(event) => updateBook('progress', Number(event.target.value))} /></FieldRow>
            <FieldRow label="Reaction" onAdd={() => addField('reaction')} included={hasBinding(design, 'reaction')}><textarea value={book.reaction} onChange={(event) => updateBook('reaction', event.target.value)} /></FieldRow>
          </div>}
          {activeBookSection === 'ratings' && <div className="field-stack">{(['rating', 'spice', 'impact'] as const).map((path) => <FieldRow key={path} label={`${FIELD_LABELS[path]} · ${book[path]}`} onAdd={() => addField(path)} included={hasBinding(design, path)}><input type="range" min="0" max="5" step="0.5" value={book[path]} onChange={(event) => updateBook(path, Number(event.target.value))} /></FieldRow>)}</div>}
          {activeBookSection === 'elements' && <div className="element-tool-grid">
            <ElementTool icon="T" title="Custom text" detail="Add an unbound text box" onClick={() => addFreeElement('text')} />
            <ElementTool icon="▭" title="Rectangle" detail="Square-cornered shape" onClick={() => addFreeElement('rectangle')} />
            <ElementTool icon="▢" title="Rounded box" detail="Rounded shape or panel" onClick={() => addFreeElement('rounded')} />
            <ElementTool icon="●" title="Circle" detail="Circular shape or badge" onClick={() => addFreeElement('circle')} />
            <ElementTool icon="—" title="Divider" detail="Thin decorative line" onClick={() => addFreeElement('divider')} />
            <ElementTool icon="▧" title="Image" detail="Add an image by URL" onClick={() => addFreeElement('image')} />
          </div>}
          {activeBookSection === 'connections' && <div className="connection-stack"><ConnectionCard title="Mind Map" count={book.mindMapNodeIds.length} action="Link nodes" /><ConnectionCard title="Conspiracy Wall" count={book.wallCardIds.length} action="Link cards" /><ConnectionCard title="Theories" count={book.theoryIds.length} action="Link theories" /></div>}
        </aside>

        <section className="design-stage" onPointerDown={() => setSelectedElementId(null)}>
          <div className="stage-heading"><div><p className="eyebrow">Design</p><h2>Live card</h2></div><span>{cardSize} output · browser-native text</span></div>
          <div className="stage-canvas"><CardRenderer book={book} design={design} size={cardSize} mode="editor" selectedElementId={selectedElementId} onSelectElement={setSelectedElementId} onChangeElement={(id, changes) => updateElement(id, changes)} onInteractionStart={beginInteraction} onInteractionEnd={endInteraction} /></div>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading"><p className="eyebrow">Inspector</p><h2>{selectedElement ? selectedElement.id : 'Nothing selected'}</h2></div>
          {selectedElement ? <div className="field-stack inspector-stack">
            <section className="inspector-group">
              <h3>Geometry</h3>
              <div className="two-column-controls">
                <label>X<input type="number" value={selectedElement.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })} /></label>
                <label>Y<input type="number" value={selectedElement.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })} /></label>
                <label>Width<input type="number" value={selectedElement.width} onChange={(event) => updateSelected({ width: Number(event.target.value) })} /></label>
                <label>Height<input type="number" value={selectedElement.height} onChange={(event) => updateSelected({ height: Number(event.target.value) })} /></label>
              </div>
              <TransactionalRange label="Rotation" min={-180} max={180} value={selectedElement.rotation ?? 0} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ rotation: value })} />
              <TransactionalRange label="Opacity" min={0} max={1} step={0.05} value={selectedElement.opacity ?? 1} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ opacity: value })} />
              <div className="alignment-grid"><button onClick={() => alignSelected('left')}>Left</button><button onClick={() => alignSelected('center-x')}>Center X</button><button onClick={() => alignSelected('right')}>Right</button><button onClick={() => alignSelected('top')}>Top</button><button onClick={() => alignSelected('center-y')}>Center Y</button><button onClick={() => alignSelected('bottom')}>Bottom</button></div>
              <p className="shortcut-hint">Arrow keys nudge 1px · Shift + Arrow nudges 10px</p>
            </section>

            <section className="inspector-group"><h3>Appearance</h3>
              {selectedElement.type === 'text' && <>
                {!selectedElement.binding && <label>Text<textarea value={selectedElement.text ?? ''} onChange={(event) => updateSelected({ text: event.target.value } as Partial<DesignElement>)} /></label>}
                <label>Text color<input type="color" value={selectedElement.color} onChange={(event) => updateSelected({ color: event.target.value } as Partial<DesignElement>)} /></label>
                <label>Font family<select value={selectedElement.fontFamily} onChange={(event) => updateSelected({ fontFamily: event.target.value } as Partial<DesignElement>)}><option>Inter</option><option>Libre Baskerville</option><option>Georgia</option><option>Arial</option><option>Trebuchet MS</option><option>Courier New</option></select></label>
                <TransactionalRange label="Font size" min={8} max={72} value={selectedElement.fontSize} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ fontSize: value } as Partial<DesignElement>)} />
                <label>Alignment<select value={selectedElement.textAlign ?? 'left'} onChange={(event) => updateSelected({ textAlign: event.target.value as 'left' | 'center' | 'right' } as Partial<DesignElement>)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                <div className="quick-action-grid"><button className={selectedElement.fontWeight === 700 ? 'is-active' : ''} onClick={() => updateSelected({ fontWeight: selectedElement.fontWeight === 700 ? 400 : 700 } as Partial<DesignElement>)}>Bold</button><button className={selectedElement.fontStyle === 'italic' ? 'is-active' : ''} onClick={() => updateSelected({ fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' } as Partial<DesignElement>)}>Italic</button></div>
              </>}
              {selectedElement.type === 'rating' && <>
                <label>Rating symbols<select value={`${selectedElement.icon}|${selectedElement.emptyIcon}`} onChange={(event) => { const preset = RATING_ICON_PRESETS.find((item) => `${item.icon}|${item.emptyIcon}` === event.target.value); if (preset) updateSelected({ icon: preset.icon, emptyIcon: preset.emptyIcon } as Partial<DesignElement>); }}>{RATING_ICON_PRESETS.map((preset) => <option key={preset.label} value={`${preset.icon}|${preset.emptyIcon}`}>{preset.icon}{preset.emptyIcon} · {preset.label}</option>)}</select></label>
                <label>Rating color<input type="color" value={selectedElement.color} onChange={(event) => updateSelected({ color: event.target.value } as Partial<DesignElement>)} /></label>
                <TransactionalRange label="Font size" min={8} max={36} value={selectedElement.fontSize} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ fontSize: value } as Partial<DesignElement>)} />
              </>}
              {selectedElement.type === 'shape' && <>
                <label>Fill<input type="color" value={selectedElement.fill} onChange={(event) => updateSelected({ fill: event.target.value } as Partial<DesignElement>)} /></label>
                <label>Border<input type="color" value={selectedElement.stroke ?? '#75451f'} onChange={(event) => updateSelected({ stroke: event.target.value } as Partial<DesignElement>)} /></label>
                <TransactionalRange label="Border width" min={0} max={12} value={selectedElement.strokeWidth ?? 0} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ strokeWidth: value } as Partial<DesignElement>)} />
                <TransactionalRange label="Corner radius" min={0} max={999} value={selectedElement.borderRadius ?? 0} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ borderRadius: value } as Partial<DesignElement>)} />
              </>}
              {selectedElement.type === 'progress' && <><label>Track color<input type="color" value={selectedElement.trackColor} onChange={(event) => updateSelected({ trackColor: event.target.value } as Partial<DesignElement>)} /></label><label>Fill color<input type="color" value={selectedElement.fillColor} onChange={(event) => updateSelected({ fillColor: event.target.value } as Partial<DesignElement>)} /></label></>}
              {selectedElement.type === 'image' && <>
                {!selectedElement.binding && <label>Image URL<input value={selectedElement.src ?? ''} placeholder="Paste an image URL" onChange={(event) => updateSelected({ src: event.target.value } as Partial<DesignElement>)} /></label>}
                <label>Image fit<select value={selectedElement.fit ?? 'cover'} onChange={(event) => updateSelected({ fit: event.target.value as 'cover' | 'contain' } as Partial<DesignElement>)}><option value="cover">Crop to fill</option><option value="contain">Fit inside</option></select></label>
                <TransactionalRange label="Corner radius" min={0} max={100} value={selectedElement.borderRadius ?? 0} onStart={beginInteraction} onEnd={endInteraction} onChange={(value) => updateSelectedLive({ borderRadius: value } as Partial<DesignElement>)} />
              </>}
            </section>

            <section className="inspector-group"><h3>Layers and object</h3><div className="quick-action-grid">
              <button onClick={() => moveSelectedLayer('back')}>To back</button><button onClick={() => moveSelectedLayer('backward')}>Backward</button><button onClick={() => moveSelectedLayer('forward')}>Forward</button><button onClick={() => moveSelectedLayer('front')}>To front</button>
              <button onClick={duplicateSelected}>Duplicate</button><button className={selectedElement.locked ? 'is-active' : ''} onClick={() => updateSelected({ locked: !selectedElement.locked })}>{selectedElement.locked ? 'Unlock' : 'Lock'}</button>
              <button className={selectedElement.flipX ? 'is-active' : ''} onClick={() => updateSelected({ flipX: !selectedElement.flipX })}>Flip horizontal</button><button className={selectedElement.flipY ? 'is-active' : ''} onClick={() => updateSelected({ flipY: !selectedElement.flipY })}>Flip vertical</button>
            </div></section>
            <button className="danger-button" onClick={removeSelected}>Remove from design</button>
          </div> : <p className="muted-copy">Select an element on the card or add one from the Book or Elements panel.</p>}
        </aside>
      </main>
    </div>
  );
}

function TransactionalRange({ label, min, max, step, value, onChange, onStart, onEnd }: { label: string; min: number; max: number; step?: number; value: number; onChange: (value: number) => void; onStart: () => void; onEnd: () => void }) {
  return <label>{label}<input type="range" min={min} max={max} step={step} value={value} onFocus={onStart} onBlur={onEnd} onPointerDown={onStart} onPointerUp={onEnd} onPointerCancel={onEnd} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FieldRow({ label, onAdd, included, children }: { label: string; onAdd: () => void; included: boolean; children: React.ReactNode }) {
  return <section className="field-row"><div className="field-row-heading"><label>{label}</label><button type="button" onClick={onAdd}>{included ? 'On card ✓' : '+'}</button></div>{children}</section>;
}

function ElementTool({ icon, title, detail, onClick }: { icon: string; title: string; detail: string; onClick: () => void }) {
  return <button type="button" className="element-tool" onClick={onClick}><span>{icon}</span><strong>{title}</strong><small>{detail}</small></button>;
}

function ConnectionCard({ title, count, action }: { title: string; count: number; action: string }) {
  return <section className="connection-card"><div><strong>{title}</strong><span>{count} linked</span></div><button>{action}</button></section>;
}
