import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardAction, CardActionType, CardDesign, CardSize } from './domain';
import { CARD_WIDTHS } from './domain';
import { loadWorkspaceDraft, saveWorkspaceDraft } from './library';
import './card-actions.css';

const ACTION_OPTIONS: Array<{ action: CardActionType; label: string; icon: string; variant: CardAction['variant'] }> = [
  { action: 'profile', label: 'Profile', icon: '◫', variant: 'primary' },
  { action: 'edit', label: 'Edit', icon: '✦', variant: 'secondary' },
  { action: 'favorite', label: 'Favorite', icon: '☆', variant: 'ghost' },
  { action: 'progress', label: 'Update Progress', icon: '↗', variant: 'secondary' },
  { action: 'add-note', label: 'Add Note', icon: '+', variant: 'secondary' },
  { action: 'start-reading', label: 'Start Reading', icon: '▶', variant: 'primary' },
  { action: 'finish-reading', label: 'Finish Reading', icon: '✓', variant: 'primary' },
  { action: 'archive', label: 'Archive', icon: '◇', variant: 'ghost' },
  { action: 'delete', label: 'Delete', icon: '×', variant: 'danger' },
];

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragState =
  | { kind: 'move'; pointerId: number; startX: number; startY: number; action: CardAction }
  | { kind: 'resize'; pointerId: number; startX: number; startY: number; action: CardAction; handle: ResizeHandle };

type CardBox = { left: number; top: number; width: number; height: number };

function newAction(action: CardActionType, index: number): CardAction {
  const option = ACTION_OPTIONS.find((item) => item.action === action) ?? ACTION_OPTIONS[0];
  const danger = option.variant === 'danger';
  const primary = option.variant === 'primary';
  return {
    id: `action-${crypto.randomUUID()}`,
    action,
    label: option.label,
    icon: option.icon,
    variant: option.variant,
    x: 18 + (index % 3) * 126,
    y: 346 - Math.floor(index / 3) * 34,
    width: 112,
    height: 28,
    background: danger ? '#351411' : primary ? '#a64f24' : option.variant === 'ghost' ? 'transparent' : '#2b160d',
    color: danger ? '#ffd0c9' : '#f7ead2',
    borderColor: danger ? '#7f352f' : primary ? '#d0783c' : '#75451f',
    borderRadius: 9,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    visibleOn: ['small', 'medium', 'large'],
  };
}

async function persistActionDesign(actions: CardAction[]) {
  const draft = await loadWorkspaceDraft();
  if (!draft) return;
  draft.design.actions = structuredClone(actions);
  await saveWorkspaceDraft(draft.book, draft.design);
}

function notifyActionChange(actions: CardAction[]) {
  window.dispatchEvent(new CustomEvent('empyrean-action-design-change', { detail: actions }));
}

function measureCard(host: HTMLElement | null): CardBox | null {
  if (!host) return null;
  const card = host.querySelector<HTMLElement>('.card-renderer');
  if (!card) return null;
  const hostRect = host.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  return {
    left: cardRect.left - hostRect.left + host.scrollLeft,
    top: cardRect.top - hostRect.top + host.scrollTop,
    width: cardRect.width,
    height: cardRect.height,
  };
}

function dockEditorToolbars(host: HTMLElement | null, actionSelected: boolean) {
  const header = document.querySelector<HTMLElement>('.v2-view--editor .app-header');
  if (!header || !host) return () => undefined;
  header.classList.add('is-editor-toolbar-host');
  header.dataset.actionSelected = actionSelected ? 'true' : 'false';
  let dock = header.querySelector<HTMLElement>('.editor-context-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'editor-context-dock';
    header.prepend(dock);
  }
  const moveToolbars = () => {
    host.querySelectorAll<HTMLElement>('.card-inline-tools').forEach((toolbar) => {
      if (toolbar.parentElement !== dock) dock?.appendChild(toolbar);
    });
  };
  moveToolbars();
  const observer = new MutationObserver(moveToolbars);
  observer.observe(host, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    header.classList.remove('is-editor-toolbar-host');
    delete header.dataset.actionSelected;
    dock?.remove();
  };
}

export function CardActionsPreview({ actions = [], size, interactive = false, onAction }: { actions: CardAction[] | undefined; size: CardSize; interactive?: boolean; onAction?: (action: CardAction) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardBox, setCardBox] = useState<CardBox | null>(null);
  const editorMode = !interactive;
  const outputWidth = CARD_WIDTHS[size];
  const scale = outputWidth / 420;
  const visible = useMemo(() => actions.filter((action) => action.visibleOn.includes(size)), [actions, size]);
  const selected = actions.find((action) => action.id === selectedId) ?? null;

  useEffect(() => {
    const host = rootRef.current?.parentElement ?? null;
    const refresh = () => setCardBox(measureCard(host));
    refresh();
    const observer = new ResizeObserver(refresh);
    const card = host?.querySelector<HTMLElement>('.card-renderer');
    if (host) observer.observe(host);
    if (card) observer.observe(card);
    window.addEventListener('resize', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, [size]);

  useEffect(() => {
    if (!editorMode) return;
    const host = rootRef.current?.parentElement ?? null;
    return dockEditorToolbars(host, Boolean(selected));
  }, [editorMode, selectedId]);

  useEffect(() => {
    if (!editorMode) return;
    const deselect = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.v2-runtime-actions--overlay, .card-action-inline-tools, .card-actions-designer')) setSelectedId(null);
    };
    document.addEventListener('pointerdown', deselect);
    return () => document.removeEventListener('pointerdown', deselect);
  }, [editorMode]);

  function replaceActions(next: CardAction[], persist = true) {
    actions.splice(0, actions.length, ...next);
    setRevision((value) => value + 1);
    notifyActionChange(actions);
    if (persist) persistActionDesign(actions).catch(console.error);
  }

  function updateAction(id: string, changes: Partial<CardAction>, persist = true) {
    replaceActions(actions.map((action) => action.id === id ? { ...action, ...changes } : action), persist);
  }

  function beginMove(event: React.PointerEvent<HTMLButtonElement>, action: CardAction) {
    if (!editorMode) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(action.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind: 'move', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, action: { ...action } };
  }

  function beginResize(event: React.PointerEvent<HTMLButtonElement>, action: CardAction, handle: ResizeHandle) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(action.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind: 'resize', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, action: { ...action }, handle };
  }

  function continueDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    if (drag.kind === 'move') {
      updateAction(drag.action.id, { x: Math.round(drag.action.x + dx), y: Math.round(drag.action.y + dy) }, false);
      return;
    }
    let x = drag.action.x;
    let y = drag.action.y;
    let width = drag.action.width;
    let height = drag.action.height;
    if (drag.handle.includes('e')) width = drag.action.width + dx;
    if (drag.handle.includes('s')) height = drag.action.height + dy;
    if (drag.handle.includes('w')) { width = drag.action.width - dx; x = drag.action.x + dx; }
    if (drag.handle.includes('n')) { height = drag.action.height - dy; y = drag.action.y + dy; }
    if (width < 28) { if (drag.handle.includes('w')) x -= 28 - width; width = 28; }
    if (height < 18) { if (drag.handle.includes('n')) y -= 18 - height; height = 18; }
    updateAction(drag.action.id, { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }, false);
  }

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    persistActionDesign(actions).catch(console.error);
  }

  function duplicateSelected() {
    if (!selected) return;
    const duplicate = { ...selected, id: `action-${crypto.randomUUID()}`, x: selected.x + 12, y: selected.y + 12 };
    replaceActions([...actions, duplicate]);
    setSelectedId(duplicate.id);
  }

  function deleteSelected() {
    if (!selected) return;
    replaceActions(actions.filter((action) => action.id !== selected.id));
    setSelectedId(null);
  }

  const actionToolbar = editorMode && selected ? <div className="card-inline-tools card-action-inline-tools" onPointerDown={(event) => event.stopPropagation()}>
    <div className="object-toolbar-group">
      <input className="toolbar-action-label" aria-label="Action label" value={selected.label} onChange={(event) => updateAction(selected.id, { label: event.target.value })} />
      <input className="toolbar-action-icon" aria-label="Action icon" value={selected.icon ?? ''} maxLength={4} onChange={(event) => updateAction(selected.id, { icon: event.target.value })} />
      <select className="toolbar-font-select" aria-label="Font" value={selected.fontFamily} onChange={(event) => updateAction(selected.id, { fontFamily: event.target.value })}><option>Inter</option><option>Libre Baskerville</option><option>Georgia</option><option>Arial</option><option>Trebuchet MS</option><option>Courier New</option></select>
      <label className="toolbar-number-control" title="Font size"><button type="button" onClick={() => updateAction(selected.id, { fontSize: Math.max(8, selected.fontSize - 1) })}>−</button><input type="number" min="8" max="80" value={selected.fontSize} onChange={(event) => updateAction(selected.id, { fontSize: Number(event.target.value) || 12 })} /><button type="button" onClick={() => updateAction(selected.id, { fontSize: selected.fontSize + 1 })}>+</button></label>
      <label className="toolbar-color" title="Text color"><span>A</span><input type="color" value={selected.color} onChange={(event) => updateAction(selected.id, { color: event.target.value })} /></label>
      <label className="toolbar-color" title="Background"><span>Fill</span><input type="color" value={selected.background === 'transparent' ? '#100906' : selected.background} onChange={(event) => updateAction(selected.id, { background: event.target.value })} /></label>
      <label className="toolbar-color" title="Border"><span>Border</span><input type="color" value={selected.borderColor} onChange={(event) => updateAction(selected.id, { borderColor: event.target.value })} /></label>
      <button type="button" className={selected.fontWeight >= 700 ? 'is-active' : ''} onClick={() => updateAction(selected.id, { fontWeight: selected.fontWeight >= 700 ? 400 : 700 })}><b>B</b></button>
      <button type="button" className={selected.textAlign === 'left' ? 'is-active' : ''} title="Align left" onClick={() => updateAction(selected.id, { textAlign: 'left' })}>☰</button>
      <button type="button" className={selected.textAlign === 'center' ? 'is-active' : ''} title="Align center" onClick={() => updateAction(selected.id, { textAlign: 'center' })}>≡</button>
      <button type="button" className={selected.textAlign === 'right' ? 'is-active' : ''} title="Align right" onClick={() => updateAction(selected.id, { textAlign: 'right' })}>☷</button>
      <label className="toolbar-compact-number">Radius<input type="number" min="0" max="999" value={selected.borderRadius} onChange={(event) => updateAction(selected.id, { borderRadius: Number(event.target.value) || 0 })} /></label>
      <button type="button" onClick={duplicateSelected}>Duplicate</button>
      <button type="button" className="toolbar-danger" onClick={deleteSelected}>Delete</button>
    </div>
  </div> : null;

  return <div className="card-actions-layer-root" ref={rootRef}>
    {actionToolbar}
    {cardBox && <div className={`v2-runtime-actions v2-runtime-actions--overlay${editorMode ? ' is-editor' : ''}${selected ? ' has-selection' : ''}`} style={{ left: cardBox.left, top: cardBox.top, width: cardBox.width, height: cardBox.height }} aria-label="Card actions">
      {visible.map((action) => {
        const isSelected = editorMode && selectedId === action.id;
        return <div key={action.id} className={`card-action-canvas-item${isSelected ? ' is-selected' : ''}`} style={{ left: action.x * scale, top: action.y * scale, width: action.width * scale, height: action.height * scale }}>
          <button type="button" data-action-type={action.action} onClick={(event) => { event.stopPropagation(); if (interactive) onAction?.(action); else setSelectedId(action.id); }} onPointerDown={(event) => beginMove(event, action)} onPointerMove={continueDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{ background: action.background, color: action.color, border: `${Math.max(1, scale)}px solid ${action.borderColor}`, borderRadius: action.borderRadius * scale, fontFamily: action.fontFamily, fontSize: action.fontSize * scale, fontWeight: action.fontWeight, textAlign: action.textAlign, justifyContent: action.textAlign === 'left' ? 'flex-start' : action.textAlign === 'right' ? 'flex-end' : 'center', padding: `${4 * scale}px ${7 * scale}px` }}>{action.icon && <span aria-hidden="true">{action.icon}</span>}{action.label}</button>
          {isSelected && <div className="selection-controls" aria-hidden="true">{(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => <button key={handle} className={`resize-handle resize-handle--${handle}`} tabIndex={-1} onPointerDown={(event) => beginResize(event, action, handle)} onPointerMove={continueDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />)}</div>}
        </div>;
      })}
    </div>}
  </div>;
}

export function CardActionsDesigner({ design, onChange }: { design: CardDesign; onChange: (actions: CardAction[]) => void }) {
  const [, setRevision] = useState(0);
  const actions = design.actions ?? [];
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('empyrean-action-design-change', refresh);
    return () => window.removeEventListener('empyrean-action-design-change', refresh);
  }, []);
  function update(id: string, changes: Partial<CardAction>) { onChange(actions.map((action) => action.id === id ? { ...action, ...changes } : action)); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= actions.length) return; const next = [...actions]; [next[index], next[target]] = [next[target], next[index]]; onChange(next); }
  function toggleSize(action: CardAction, size: CardSize) { update(action.id, { visibleOn: action.visibleOn.includes(size) ? action.visibleOn.filter((item) => item !== size) : [...action.visibleOn, size] }); }
  return <div className="card-actions-designer">
    <section className="card-actions-add"><h3>Add an action</h3><div>{ACTION_OPTIONS.map((option) => <button key={option.action} type="button" disabled={actions.some((item) => item.action === option.action)} onClick={() => onChange([...actions, newAction(option.action, actions.length)])}><span>{option.icon}</span>{option.label}</button>)}</div></section>
    <section className="card-actions-list"><h3>On-card actions</h3><p className="card-actions-hint">Select, drag, and resize buttons directly on the card. Use these controls for precise values.</p>{!actions.length && <p>No actions are placed on this card.</p>}{actions.map((action, index) => <article key={action.id}>
      <header><strong>{action.icon} {action.label}</strong><div><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === actions.length - 1} onClick={() => move(index, 1)}>↓</button><button className="is-danger" type="button" onClick={() => onChange(actions.filter((item) => item.id !== action.id))}>Remove</button></div></header>
      <div className="card-action-fields">
        <label>Label<input value={action.label} onChange={(event) => update(action.id, { label: event.target.value })} /></label><label>Icon<input value={action.icon ?? ''} maxLength={4} onChange={(event) => update(action.id, { icon: event.target.value })} /></label>
        <label>X<input type="number" value={action.x} onChange={(event) => update(action.id, { x: Number(event.target.value) || 0 })} /></label><label>Y<input type="number" value={action.y} onChange={(event) => update(action.id, { y: Number(event.target.value) || 0 })} /></label>
        <label>Width<input type="number" min="24" value={action.width} onChange={(event) => update(action.id, { width: Math.max(24, Number(event.target.value) || 24) })} /></label><label>Height<input type="number" min="18" value={action.height} onChange={(event) => update(action.id, { height: Math.max(18, Number(event.target.value) || 18) })} /></label>
        <label>Font<select value={action.fontFamily} onChange={(event) => update(action.id, { fontFamily: event.target.value })}><option>Inter</option><option>Libre Baskerville</option><option>Georgia</option><option>Arial</option><option>Trebuchet MS</option><option>Courier New</option></select></label><label>Font size<input type="number" min="8" max="80" value={action.fontSize} onChange={(event) => update(action.id, { fontSize: Number(event.target.value) || 12 })} /></label>
        <label>Weight<select value={action.fontWeight} onChange={(event) => update(action.id, { fontWeight: Number(event.target.value) })}><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label><label>Align<select value={action.textAlign} onChange={(event) => update(action.id, { textAlign: event.target.value as CardAction['textAlign'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label>Background<input type="color" value={action.background === 'transparent' ? '#100906' : action.background} onChange={(event) => update(action.id, { background: event.target.value })} /></label><label>Text<input type="color" value={action.color} onChange={(event) => update(action.id, { color: event.target.value })} /></label><label>Border<input type="color" value={action.borderColor} onChange={(event) => update(action.id, { borderColor: event.target.value })} /></label><label>Radius<input type="number" min="0" max="999" value={action.borderRadius} onChange={(event) => update(action.id, { borderRadius: Number(event.target.value) || 0 })} /></label>
      </div>
      <div className="card-action-sizes"><span>Visible on</span>{(['small', 'medium', 'large'] as CardSize[]).map((cardSize) => <button key={cardSize} type="button" className={action.visibleOn.includes(cardSize) ? 'is-active' : ''} onClick={() => toggleSize(action, cardSize)}>{cardSize}</button>)}</div>
    </article>)}</section>
  </div>;
}
