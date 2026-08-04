import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookRecord, CardDesign, CardSize, DesignElement, TextElement } from './domain';
import { CARD_WIDTHS } from './domain';

interface CardRendererProps {
  book: BookRecord;
  design: CardDesign;
  size: CardSize;
  mode?: 'editor' | 'library';
  selectedElementId?: string | null;
  onSelectElement?: (id: string) => void;
  onChangeElement?: (id: string, changes: Partial<DesignElement>) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type MoveMember = { id: string; x: number; y: number };
type AlignmentAction = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'distribute-x' | 'distribute-y';
type Interaction =
  | { kind: 'move'; pointerId: number; startClientX: number; startClientY: number; element: DesignElement; members: MoveMember[] }
  | { kind: 'resize'; pointerId: number; startClientX: number; startClientY: number; element: DesignElement; handle: ResizeHandle }
  | { kind: 'rotate'; pointerId: number; centerClientX: number; centerClientY: number; startAngle: number; rotation: number; element: DesignElement };

interface Guides { vertical: number[]; horizontal: number[]; }

function boundValue(book: BookRecord, element: DesignElement): string | number {
  if (!element.binding) return element.type === 'text' ? element.text ?? '' : '';
  const value = book[element.binding];
  if (element.binding === 'status') return ({ want: 'Want to read', reading: 'Currently reading', paused: 'Paused', completed: 'Completed', dnf: 'DNF' } as const)[book.status];
  if (element.binding === 'progress' && element.type === 'text') return `${book.progress}%`;
  return Array.isArray(value) ? value.join(', ') : value;
}

function RatingGlyphs({ value, icon, emptyIcon }: { value: number; icon: string; emptyIcon: string }) {
  const safeValue = Math.max(0, Math.min(5, value));
  return <span className="rating-glyph-row" aria-label={`${safeValue} of 5`}>{Array.from({ length: 5 }, (_, index) => {
    const fill = Math.max(0, Math.min(1, safeValue - index));
    return <span className="rating-glyph-slot" key={index}><span className="rating-glyph-empty">{emptyIcon}</span>{fill > 0 && <span className="rating-glyph-fill" style={{ width: `${fill * 100}%` }}><span>{icon}</span></span>}</span>;
  })}</span>;
}

function elementStyle(element: DesignElement, scale: number): React.CSSProperties {
  const transforms: string[] = [];
  if (element.rotation) transforms.push(`rotate(${element.rotation}deg)`);
  if (element.flipX) transforms.push('scaleX(-1)');
  if (element.flipY) transforms.push('scaleY(-1)');
  return { position: 'absolute', left: element.x * scale, top: element.y * scale, width: element.width * scale, height: element.height * scale, transform: transforms.length ? transforms.join(' ') : undefined, transformOrigin: 'center', opacity: element.opacity ?? 1 };
}

function textStyle(element: TextElement, scale: number): React.CSSProperties {
  return { fontFamily: element.fontFamily, fontSize: element.fontSize * scale, fontWeight: element.fontWeight, fontStyle: element.fontStyle, color: element.color, textAlign: element.textAlign, lineHeight: element.lineHeight, overflow: 'hidden', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' };
}

function angleFromPoint(clientX: number, clientY: number, centerX: number, centerY: number) { return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI; }
function normalizeRotation(value: number) { let next = value % 360; if (next > 180) next -= 360; if (next < -180) next += 360; return Math.round(next * 10) / 10; }
function snapValue(value: number, grid = 2) { return Math.round(value / grid) * grid; }
function snapAxis(position: number, size: number, targets: number[], threshold = 4) {
  const anchors = [position, position + size / 2, position + size];
  let best: { distance: number; adjustment: number; guide: number } | null = null;
  for (const anchor of anchors) for (const target of targets) {
    const adjustment = target - anchor;
    const distance = Math.abs(adjustment);
    if (distance <= threshold && (!best || distance < best.distance)) best = { distance, adjustment, guide: target };
  }
  return best ? { position: position + best.adjustment, guide: best.guide } : { position, guide: null };
}

export function CardRenderer({ book, design, size, mode = 'library', selectedElementId, onSelectElement, onChangeElement, onInteractionStart, onInteractionEnd }: CardRendererProps) {
  const outputWidth = CARD_WIDTHS[size];
  const scale = outputWidth / design.width;
  const outputHeight = design.height * scale;
  const interaction = useRef<Interaction | null>(null);
  const [guides, setGuides] = useState<Guides>({ vertical: [], horizontal: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedElementId ? [selectedElementId] : []);
  const frame = design.elements.find((element) => element.id === 'card-frame');
  const frameFill = frame?.type === 'shape' ? frame.fill : design.background;
  const visibleBackground = frameFill === '#2b160d' && design.background !== '#2b160d' ? design.background : frameFill;
  const selectedElements = useMemo(() => design.elements.filter((element) => selectedIds.includes(element.id)), [design.elements, selectedIds]);
  const primaryElement = selectedElements.find((element) => element.id === selectedElementId) ?? selectedElements[0];
  const activeGroupId = selectedElements.length > 1 && selectedElements.every((element) => element.groupId && element.groupId === selectedElements[0].groupId) ? selectedElements[0].groupId : undefined;

  useEffect(() => {
    if (frame?.type === 'shape' && frame.fill === '#2b160d' && design.background !== '#2b160d') onChangeElement?.('card-frame', { fill: design.background });
  }, [design.background, frame?.type === 'shape' ? frame.fill : undefined]);

  useEffect(() => {
    if (!selectedElementId) setSelectedIds([]);
    else if (!selectedIds.includes(selectedElementId)) setSelectedIds([selectedElementId]);
  }, [selectedElementId]);

  function startInteraction() { setGuides({ vertical: [], horizontal: [] }); onInteractionStart?.(); }
  function finishToolbarInteraction() { window.setTimeout(() => onInteractionEnd?.(), 0); }
  function commitToolbarChanges(changes: Array<{ id: string; changes: Partial<DesignElement> }>) {
    if (!changes.length) return;
    startInteraction();
    changes.forEach((change) => onChangeElement?.(change.id, change.changes));
    finishToolbarInteraction();
  }

  function selectElement(element: DesignElement, additive: boolean) {
    if (element.id === 'card-frame') return;
    if (additive) {
      setSelectedIds((current) => current.includes(element.id) ? current.filter((id) => id !== element.id) : [...current, element.id]);
      onSelectElement?.(element.id);
      return;
    }
    const ids = element.groupId ? design.elements.filter((item) => item.groupId === element.groupId).map((item) => item.id) : [element.id];
    setSelectedIds(ids);
    onSelectElement?.(element.id);
  }

  function beginMove(event: React.PointerEvent<HTMLDivElement>, element: DesignElement) {
    if (mode !== 'editor' || element.locked || element.id === 'card-frame') return;
    event.preventDefault(); event.stopPropagation();
    if (event.shiftKey) { selectElement(element, true); return; }
    selectElement(element, false);
    startInteraction();
    event.currentTarget.setPointerCapture(event.pointerId);
    const ids = element.groupId
      ? design.elements.filter((item) => item.groupId === element.groupId).map((item) => item.id)
      : selectedIds.includes(element.id) && selectedIds.length > 1 ? selectedIds : [element.id];
    const members = design.elements.filter((item) => ids.includes(item.id)).map((item) => ({ id: item.id, x: item.x, y: item.y }));
    interaction.current = { kind: 'move', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, element: { ...element }, members };
  }

  function beginResize(event: React.PointerEvent<HTMLButtonElement>, element: DesignElement, handle: ResizeHandle) {
    event.preventDefault(); event.stopPropagation(); startInteraction(); event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = { kind: 'resize', pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, element: { ...element }, handle };
  }

  function beginRotate(event: React.PointerEvent<HTMLButtonElement>, element: DesignElement) {
    event.preventDefault(); event.stopPropagation();
    const card = event.currentTarget.closest('.card-renderer')?.getBoundingClientRect(); if (!card) return;
    startInteraction();
    const centerClientX = card.left + (element.x + element.width / 2) * scale;
    const centerClientY = card.top + (element.y + element.height / 2) * scale;
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = { kind: 'rotate', pointerId: event.pointerId, centerClientX, centerClientY, startAngle: angleFromPoint(event.clientX, event.clientY, centerClientX, centerClientY), rotation: element.rotation ?? 0, element: { ...element } };
  }

  function continueInteraction(event: React.PointerEvent<HTMLElement>) {
    const active = interaction.current; if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (active.kind === 'move') {
      const dx = (event.clientX - active.startClientX) / scale;
      const dy = (event.clientY - active.startClientY) / scale;
      const primary = active.members.find((member) => member.id === active.element.id) ?? active.members[0];
      let x = primary.x + dx;
      let y = primary.y + dy;
      const movingIds = active.members.map((member) => member.id);
      const others = design.elements.filter((element) => !movingIds.includes(element.id) && element.id !== 'card-frame');
      const xTargets = [0, design.width / 2, design.width, ...others.flatMap((element) => [element.x, element.x + element.width / 2, element.x + element.width])];
      const yTargets = [0, design.height / 2, design.height, ...others.flatMap((element) => [element.y, element.y + element.height / 2, element.y + element.height])];
      const snappedX = snapAxis(x, active.element.width, xTargets);
      const snappedY = snapAxis(y, active.element.height, yTargets);
      const adjustedDx = snappedX.position - primary.x;
      const adjustedDy = snappedY.position - primary.y;
      setGuides({ vertical: snappedX.guide === null ? [] : [snappedX.guide], horizontal: snappedY.guide === null ? [] : [snappedY.guide] });
      active.members.forEach((member) => onChangeElement?.(member.id, { x: snapValue(member.x + adjustedDx), y: snapValue(member.y + adjustedDy) }));
      return;
    }
    if (active.kind === 'rotate') {
      const currentAngle = angleFromPoint(event.clientX, event.clientY, active.centerClientX, active.centerClientY);
      onChangeElement?.(active.element.id, { rotation: normalizeRotation(active.rotation + currentAngle - active.startAngle) });
      return;
    }
    const dx = (event.clientX - active.startClientX) / scale;
    const dy = (event.clientY - active.startClientY) / scale;
    const start = active.element;
    let x = start.x, y = start.y, width = start.width, height = start.height;
    if (active.handle.includes('e')) width = start.width + dx;
    if (active.handle.includes('s')) height = start.height + dy;
    if (active.handle.includes('w')) { width = start.width - dx; x = start.x + dx; }
    if (active.handle.includes('n')) { height = start.height - dy; y = start.y + dy; }
    const minimumWidth = 18, minimumHeight = 12;
    if (width < minimumWidth) { if (active.handle.includes('w')) x -= minimumWidth - width; width = minimumWidth; }
    if (height < minimumHeight) { if (active.handle.includes('n')) y -= minimumHeight - height; height = minimumHeight; }
    onChangeElement?.(start.id, { x: snapValue(x), y: snapValue(y), width: snapValue(width), height: snapValue(height) });
  }

  function endInteraction(event: React.PointerEvent<HTMLElement>) {
    if (interaction.current?.pointerId !== event.pointerId) return;
    interaction.current = null; setGuides({ vertical: [], horizontal: [] });
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    onInteractionEnd?.();
  }

  function groupSelection() {
    if (selectedIds.length < 2) return;
    const groupId = `group-${crypto.randomUUID()}`;
    commitToolbarChanges(selectedIds.map((id) => ({ id, changes: { groupId } })));
  }

  function ungroupSelection() {
    if (!activeGroupId) return;
    commitToolbarChanges(design.elements.filter((element) => element.groupId === activeGroupId).map((element) => ({ id: element.id, changes: { groupId: undefined } })));
  }

  function alignSelection(action: AlignmentAction) {
    if (selectedElements.length < 2) return;
    const left = Math.min(...selectedElements.map((element) => element.x));
    const right = Math.max(...selectedElements.map((element) => element.x + element.width));
    const top = Math.min(...selectedElements.map((element) => element.y));
    const bottom = Math.max(...selectedElements.map((element) => element.y + element.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const changes: Array<{ id: string; changes: Partial<DesignElement> }> = [];

    if (action === 'distribute-x' && selectedElements.length > 2) {
      const sorted = [...selectedElements].sort((a, b) => a.x - b.x);
      const totalWidth = sorted.reduce((sum, element) => sum + element.width, 0);
      const gap = (right - left - totalWidth) / (sorted.length - 1);
      let cursor = left;
      sorted.forEach((element) => { changes.push({ id: element.id, changes: { x: snapValue(cursor) } }); cursor += element.width + gap; });
    } else if (action === 'distribute-y' && selectedElements.length > 2) {
      const sorted = [...selectedElements].sort((a, b) => a.y - b.y);
      const totalHeight = sorted.reduce((sum, element) => sum + element.height, 0);
      const gap = (bottom - top - totalHeight) / (sorted.length - 1);
      let cursor = top;
      sorted.forEach((element) => { changes.push({ id: element.id, changes: { y: snapValue(cursor) } }); cursor += element.height + gap; });
    } else {
      selectedElements.forEach((element) => {
        if (action === 'left') changes.push({ id: element.id, changes: { x: snapValue(left) } });
        if (action === 'center-x') changes.push({ id: element.id, changes: { x: snapValue(centerX - element.width / 2) } });
        if (action === 'right') changes.push({ id: element.id, changes: { x: snapValue(right - element.width) } });
        if (action === 'top') changes.push({ id: element.id, changes: { y: snapValue(top) } });
        if (action === 'center-y') changes.push({ id: element.id, changes: { y: snapValue(centerY - element.height / 2) } });
        if (action === 'bottom') changes.push({ id: element.id, changes: { y: snapValue(bottom - element.height) } });
      });
    }
    commitToolbarChanges(changes);
  }

  function renderContent(element: DesignElement) {
    if (element.type === 'shape') {
      const fill = element.id === 'card-frame' ? 'transparent' : element.fill;
      return <div className="design-element-content" style={{ background: fill, border: element.stroke ? `${(element.strokeWidth ?? 1) * scale}px solid ${element.stroke}` : undefined, borderRadius: (element.borderRadius ?? 0) * scale }} />;
    }
    if (element.type === 'image') {
      const source = element.binding ? String(boundValue(book, element) || '') : element.src || '';
      return source ? <img className="design-element-content" src={source} alt="" draggable={false} style={{ objectFit: element.fit ?? 'cover', borderRadius: (element.borderRadius ?? 0) * scale }} /> : <div className="design-element-content design-element-placeholder" style={{ borderRadius: (element.borderRadius ?? 0) * scale, borderWidth: scale, fontSize: 12 * scale }}>{element.binding ? 'Cover' : 'Image'}</div>;
    }
    if (element.type === 'text') return <div className="design-element-content" style={textStyle(element, scale)}>{String(boundValue(book, element))}</div>;
    if (element.type === 'progress') { const value = Number(boundValue(book, element)) || 0; return <div className="design-element-content" style={{ background: element.trackColor, borderRadius: (element.borderRadius ?? 0) * scale, overflow: 'hidden' }}><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: element.fillColor, borderRadius: 'inherit' }} /></div>; }
    const value = Number(book[element.metric]) || 0;
    return <div className="design-element-content" style={{ color: element.color, fontFamily: element.fontFamily, fontSize: element.fontSize * scale, fontWeight: 700, lineHeight: 1.35 }}><strong>{element.label}</strong><RatingGlyphs value={value} icon={element.icon} emptyIcon={element.emptyIcon} /><small>{value} of 5</small></div>;
  }

  return <div className={`card-renderer card-renderer--${mode}`} style={{ width: outputWidth, height: outputHeight, background: visibleBackground }} data-card-size={size}>
    {mode === 'editor' && <div className="card-inline-tools" onPointerDown={(event) => event.stopPropagation()}>
      {selectedIds.length === 0 && <div className="card-style-group">
        <strong>Card style</strong>
        <label>Background<input type="color" value={visibleBackground} onFocus={startInteraction} onBlur={onInteractionEnd} onPointerDown={startInteraction} onPointerUp={onInteractionEnd} onChange={(event) => onChangeElement?.('card-frame', { fill: event.target.value })} /></label>
        <label>Border<input type="color" value={frame?.type === 'shape' ? frame.stroke ?? '#75451f' : '#75451f'} onFocus={startInteraction} onBlur={onInteractionEnd} onPointerDown={startInteraction} onPointerUp={onInteractionEnd} onChange={(event) => onChangeElement?.('card-frame', { stroke: event.target.value })} /></label>
      </div>}
      {selectedIds.length === 1 && primaryElement && <div className="object-toolbar-group">
        <strong>{primaryElement.type}</strong>
        <button type="button" className={primaryElement.locked ? 'is-active' : ''} onClick={() => commitToolbarChanges([{ id: primaryElement.id, changes: { locked: !primaryElement.locked } }])}>{primaryElement.locked ? 'Unlock' : 'Lock'}</button>
        <button type="button" className={primaryElement.flipX ? 'is-active' : ''} onClick={() => commitToolbarChanges([{ id: primaryElement.id, changes: { flipX: !primaryElement.flipX } }])}>Flip H</button>
        <button type="button" className={primaryElement.flipY ? 'is-active' : ''} onClick={() => commitToolbarChanges([{ id: primaryElement.id, changes: { flipY: !primaryElement.flipY } }])}>Flip V</button>
      </div>}
      {selectedIds.length > 1 && <div className="selection-toolbar-group">
        <strong>{selectedIds.length} selected</strong>
        <button type="button" onClick={activeGroupId ? ungroupSelection : groupSelection}>{activeGroupId ? 'Ungroup' : 'Group'}</button>
        <button type="button" title="Align left" onClick={() => alignSelection('left')}>⇤</button>
        <button type="button" title="Align horizontal centers" onClick={() => alignSelection('center-x')}>↔</button>
        <button type="button" title="Align right" onClick={() => alignSelection('right')}>⇥</button>
        <button type="button" title="Align top" onClick={() => alignSelection('top')}>↥</button>
        <button type="button" title="Align vertical centers" onClick={() => alignSelection('center-y')}>↕</button>
        <button type="button" title="Align bottom" onClick={() => alignSelection('bottom')}>↧</button>
        <button type="button" title="Distribute horizontally" disabled={selectedIds.length < 3} onClick={() => alignSelection('distribute-x')}>H</button>
        <button type="button" title="Distribute vertically" disabled={selectedIds.length < 3} onClick={() => alignSelection('distribute-y')}>V</button>
      </div>}
    </div>}
    {mode === 'editor' && guides.vertical.map((position) => <div key={`v-${position}`} className="alignment-guide alignment-guide--vertical" style={{ left: position * scale }} />)}
    {mode === 'editor' && guides.horizontal.map((position) => <div key={`h-${position}`} className="alignment-guide alignment-guide--horizontal" style={{ top: position * scale }} />)}
    {design.elements.map((element) => {
      const selected = mode === 'editor' && selectedIds.includes(element.id);
      const primary = selectedElementId === element.id;
      return <div key={element.id} className={`design-element design-element--${element.type}${selected ? ' is-selected' : ''}${selected && !primary ? ' is-secondary-selected' : ''}${element.locked ? ' is-locked' : ''}`} style={elementStyle(element, scale)} onPointerDown={mode === 'editor' ? (event) => beginMove(event, element) : undefined} onPointerMove={mode === 'editor' ? continueInteraction : undefined} onPointerUp={mode === 'editor' ? endInteraction : undefined} onPointerCancel={mode === 'editor' ? endInteraction : undefined}>
        {renderContent(element)}
        {primary && selected && !element.locked && <div className="selection-controls" aria-hidden="true"><button className="rotation-handle" tabIndex={-1} onPointerDown={(event) => beginRotate(event, element)} onPointerMove={continueInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />{(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => <button key={handle} className={`resize-handle resize-handle--${handle}`} tabIndex={-1} onPointerDown={(event) => beginResize(event, element, handle)} onPointerMove={continueInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />)}</div>}
      </div>;
    })}
  </div>;
}
