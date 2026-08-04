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

const SYSTEM_FONTS = ['Inter', 'Libre Baskerville', 'Georgia', 'Arial', 'Trebuchet MS', 'Courier New'];
const RATING_PRESETS = [
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
  return { fontFamily: element.fontFamily, fontSize: element.fontSize * scale, fontWeight: element.fontWeight, fontStyle: element.fontStyle, textDecoration: element.textDecoration, color: element.color, textAlign: element.textAlign, lineHeight: element.lineHeight, overflow: 'hidden', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' };
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
  const [availableFonts, setAvailableFonts] = useState<string[]>(SYSTEM_FONTS);
  const frame = design.elements.find((element) => element.id === 'card-frame');
  const frameFill = frame?.type === 'shape' ? frame.fill : design.background;
  const visibleBackground = frameFill === '#2b160d' && design.background !== '#2b160d' ? design.background : frameFill;
  const selectedElements = useMemo(() => design.elements.filter((element) => selectedIds.includes(element.id)), [design.elements, selectedIds]);
  const primaryElement = selectedElements.find((element) => element.id === selectedElementId) ?? selectedElements[0];
  const activeGroupId = selectedElements.length > 1 && selectedElements.every((element) => element.groupId && element.groupId === selectedElements[0].groupId) ? selectedElements[0].groupId : undefined;

  useEffect(() => {
    const refreshFonts = () => {
      const families = new Set(SYSTEM_FONTS);
      document.fonts.forEach((font) => families.add(font.family.replace(/^['"]|['"]$/g, '')));
      setAvailableFonts(Array.from(families));
    };
    refreshFonts();
    document.fonts.ready.then(refreshFonts).catch(() => undefined);
    document.fonts.addEventListener('loadingdone', refreshFonts);
    window.addEventListener('empyrean-font-library-changed', refreshFonts);
    return () => {
      document.fonts.removeEventListener('loadingdone', refreshFonts);
      window.removeEventListener('empyrean-font-library-changed', refreshFonts);
    };
  }, []);

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
  function commitPrimary(changes: Partial<DesignElement>) { if (primaryElement) commitToolbarChanges([{ id: primaryElement.id, changes }]); }

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
    if (mode !== 'editor' || element.id === 'card-frame') return;
    event.preventDefault(); event.stopPropagation();
    if (event.shiftKey) { selectElement(element, true); return; }
    selectElement(element, false);
    if (element.locked) return;
    startInteraction();
    event.currentTarget.setPointerCapture(event.pointerId);
    const ids = element.groupId ? design.elements.filter((item) => item.groupId === element.groupId).map((item) => item.id) : selectedIds.includes(element.id) && selectedIds.length > 1 ? selectedIds : [element.id];
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
      const movingIds = active.members.map((member) => member.id);
      const others = design.elements.filter((element) => !movingIds.includes(element.id) && element.id !== 'card-frame');
      const xTargets = [0, design.width / 2, design.width, ...others.flatMap((element) => [element.x, element.x + element.width / 2, element.x + element.width])];
      const yTargets = [0, design.height / 2, design.height, ...others.flatMap((element) => [element.y, element.y + element.height / 2, element.y + element.height])];
      const snappedX = snapAxis(primary.x + dx, active.element.width, xTargets);
      const snappedY = snapAxis(primary.y + dy, active.element.height, yTargets);
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

  function duplicatePrimary() {
    if (!primaryElement || primaryElement.id === 'card-frame') return;
    startInteraction();
    const duplicate = { ...primaryElement, id: `element-${crypto.randomUUID()}`, x: primaryElement.x + 16, y: primaryElement.y + 16, locked: false, groupId: undefined } as DesignElement;
    design.elements.push(duplicate);
    onChangeElement?.(duplicate.id, {});
    onSelectElement?.(duplicate.id);
    setSelectedIds([duplicate.id]);
    finishToolbarInteraction();
  }

  function deleteSelection() {
    const removable = selectedIds.filter((id) => id !== 'card-frame');
    if (!removable.length) return;
    startInteraction();
    design.elements.splice(0, design.elements.length, ...design.elements.filter((element) => !removable.includes(element.id)));
    onChangeElement?.('card-frame', {});
    setSelectedIds([]);
    finishToolbarInteraction();
  }

  function replacePrimaryImage(file: File | undefined) {
    if (!file || !file.type.startsWith('image/') || primaryElement?.type !== 'image' || primaryElement.binding) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') commitPrimary({ src: reader.result } as Partial<DesignElement>); };
    reader.readAsDataURL(file);
  }

  function renderSingleToolbar() {
    if (!primaryElement) return null;
    return <div className="object-toolbar-group">
      {primaryElement.type === 'text' && <>
        <select className="toolbar-font-select" aria-label="Font" value={primaryElement.fontFamily} onChange={(event) => commitPrimary({ fontFamily: event.target.value } as Partial<DesignElement>)}>{availableFonts.map((font) => <option key={font} value={font}>{font}</option>)}</select>
        <label className="toolbar-number-control" title="Font size"><button type="button" onClick={() => commitPrimary({ fontSize: Math.max(8, primaryElement.fontSize - 1) } as Partial<DesignElement>)}>−</button><input type="number" min="8" max="160" value={primaryElement.fontSize} onChange={(event) => commitPrimary({ fontSize: Number(event.target.value) } as Partial<DesignElement>)} /><button type="button" onClick={() => commitPrimary({ fontSize: primaryElement.fontSize + 1 } as Partial<DesignElement>)}>+</button></label>
        <label className="toolbar-color" title="Text color"><span>A</span><input type="color" value={primaryElement.color} onChange={(event) => commitPrimary({ color: event.target.value } as Partial<DesignElement>)} /></label>
        <button type="button" className={primaryElement.fontWeight === 700 ? 'is-active' : ''} onClick={() => commitPrimary({ fontWeight: primaryElement.fontWeight === 700 ? 400 : 700 } as Partial<DesignElement>)}><b>B</b></button>
        <button type="button" className={primaryElement.fontStyle === 'italic' ? 'is-active' : ''} onClick={() => commitPrimary({ fontStyle: primaryElement.fontStyle === 'italic' ? 'normal' : 'italic' } as Partial<DesignElement>)}><i>I</i></button>
        <button type="button" className={primaryElement.textDecoration === 'underline' ? 'is-active' : ''} onClick={() => commitPrimary({ textDecoration: primaryElement.textDecoration === 'underline' ? 'none' : 'underline' } as Partial<DesignElement>)}><u>U</u></button>
        <button type="button" className={primaryElement.textDecoration === 'line-through' ? 'is-active' : ''} onClick={() => commitPrimary({ textDecoration: primaryElement.textDecoration === 'line-through' ? 'none' : 'line-through' } as Partial<DesignElement>)}><s>S</s></button>
        <select aria-label="Text alignment" value={primaryElement.textAlign ?? 'left'} onChange={(event) => commitPrimary({ textAlign: event.target.value as 'left' | 'center' | 'right' } as Partial<DesignElement>)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
      </>}
      {primaryElement.type === 'image' && <>
        {!primaryElement.binding && <label className="toolbar-upload-button">Replace<input type="file" accept="image/*" onChange={(event) => { replacePrimaryImage(event.target.files?.[0]); event.target.value = ''; }} /></label>}
        <select aria-label="Image fit" value={primaryElement.fit ?? 'cover'} onChange={(event) => commitPrimary({ fit: event.target.value as 'cover' | 'contain' } as Partial<DesignElement>)}><option value="cover">Crop to fill</option><option value="contain">Fit inside</option></select>
        <label className="toolbar-compact-number">Radius<input type="number" min="0" max="999" value={primaryElement.borderRadius ?? 0} onChange={(event) => commitPrimary({ borderRadius: Number(event.target.value) } as Partial<DesignElement>)} /></label>
      </>}
      {primaryElement.type === 'shape' && <>
        <label className="toolbar-color"><span>Fill</span><input type="color" value={primaryElement.fill === 'transparent' ? '#000000' : primaryElement.fill} onChange={(event) => commitPrimary({ fill: event.target.value } as Partial<DesignElement>)} /></label>
        <label className="toolbar-color"><span>Border</span><input type="color" value={primaryElement.stroke ?? '#75451f'} onChange={(event) => commitPrimary({ stroke: event.target.value } as Partial<DesignElement>)} /></label>
        <label className="toolbar-compact-number">Width<input type="number" min="0" max="30" value={primaryElement.strokeWidth ?? 0} onChange={(event) => commitPrimary({ strokeWidth: Number(event.target.value) } as Partial<DesignElement>)} /></label>
        <label className="toolbar-compact-number">Radius<input type="number" min="0" max="999" value={primaryElement.borderRadius ?? 0} onChange={(event) => commitPrimary({ borderRadius: Number(event.target.value) } as Partial<DesignElement>)} /></label>
      </>}
      {primaryElement.type === 'rating' && <>
        <select aria-label="Rating symbols" value={`${primaryElement.icon}|${primaryElement.emptyIcon}`} onChange={(event) => { const preset = RATING_PRESETS.find((item) => `${item.icon}|${item.emptyIcon}` === event.target.value); if (preset) commitPrimary({ icon: preset.icon, emptyIcon: preset.emptyIcon } as Partial<DesignElement>); }}>{RATING_PRESETS.map((preset) => <option key={preset.label} value={`${preset.icon}|${preset.emptyIcon}`}>{preset.icon}{preset.emptyIcon} {preset.label}</option>)}</select>
        <label className="toolbar-color"><span>Color</span><input type="color" value={primaryElement.color} onChange={(event) => commitPrimary({ color: event.target.value } as Partial<DesignElement>)} /></label>
        <label className="toolbar-compact-number">Size<input type="number" min="8" max="80" value={primaryElement.fontSize} onChange={(event) => commitPrimary({ fontSize: Number(event.target.value) } as Partial<DesignElement>)} /></label>
      </>}
      {primaryElement.type === 'progress' && <>
        <label className="toolbar-color"><span>Track</span><input type="color" value={primaryElement.trackColor} onChange={(event) => commitPrimary({ trackColor: event.target.value } as Partial<DesignElement>)} /></label>
        <label className="toolbar-color"><span>Fill</span><input type="color" value={primaryElement.fillColor} onChange={(event) => commitPrimary({ fillColor: event.target.value } as Partial<DesignElement>)} /></label>
      </>}
      <label className="toolbar-opacity"><span>Opacity</span><input type="range" min="0" max="1" step="0.05" value={primaryElement.opacity ?? 1} onPointerDown={startInteraction} onPointerUp={finishToolbarInteraction} onPointerCancel={finishToolbarInteraction} onChange={(event) => onChangeElement?.(primaryElement.id, { opacity: Number(event.target.value) })} /></label>
      <button type="button" className={primaryElement.locked ? 'is-active' : ''} onClick={() => commitPrimary({ locked: !primaryElement.locked })}>{primaryElement.locked ? 'Unlock' : 'Lock'}</button>
      <button type="button" className={primaryElement.flipX ? 'is-active' : ''} onClick={() => commitPrimary({ flipX: !primaryElement.flipX })}>Flip H</button>
      <button type="button" className={primaryElement.flipY ? 'is-active' : ''} onClick={() => commitPrimary({ flipY: !primaryElement.flipY })}>Flip V</button>
      <button type="button" onClick={duplicatePrimary}>Duplicate</button>
      <button type="button" className="toolbar-danger" onClick={deleteSelection}>Delete</button>
    </div>;
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

  const toolbar = mode === 'editor' ? <div className="card-inline-tools" onPointerDown={(event) => event.stopPropagation()}>
    {selectedIds.length === 0 && <div className="card-style-group"><strong>Card style</strong><label>Background<input type="color" value={visibleBackground} onFocus={startInteraction} onBlur={finishToolbarInteraction} onPointerDown={startInteraction} onPointerUp={finishToolbarInteraction} onChange={(event) => onChangeElement?.('card-frame', { fill: event.target.value })} /></label><label>Border<input type="color" value={frame?.type === 'shape' ? frame.stroke ?? '#75451f' : '#75451f'} onFocus={startInteraction} onBlur={finishToolbarInteraction} onPointerDown={startInteraction} onPointerUp={finishToolbarInteraction} onChange={(event) => onChangeElement?.('card-frame', { stroke: event.target.value })} /></label></div>}
    {selectedIds.length === 1 && renderSingleToolbar()}
    {selectedIds.length > 1 && <div className="selection-toolbar-group"><strong>{selectedIds.length} selected</strong><button type="button" onClick={activeGroupId ? ungroupSelection : groupSelection}>{activeGroupId ? 'Ungroup' : 'Group'}</button><button type="button" title="Align left" onClick={() => alignSelection('left')}>⇤</button><button type="button" title="Align horizontal centers" onClick={() => alignSelection('center-x')}>↔</button><button type="button" title="Align right" onClick={() => alignSelection('right')}>⇥</button><button type="button" title="Align top" onClick={() => alignSelection('top')}>↥</button><button type="button" title="Align vertical centers" onClick={() => alignSelection('center-y')}>↕</button><button type="button" title="Align bottom" onClick={() => alignSelection('bottom')}>↧</button><button type="button" title="Distribute horizontally" disabled={selectedIds.length < 3} onClick={() => alignSelection('distribute-x')}>H</button><button type="button" title="Distribute vertically" disabled={selectedIds.length < 3} onClick={() => alignSelection('distribute-y')}>V</button><button type="button" className="toolbar-danger" onClick={deleteSelection}>Delete</button></div>}
  </div> : null;

  return <div className="card-editor-shell" style={{ width: outputWidth }}>
    {toolbar}
    <div className={`card-renderer card-renderer--${mode}`} style={{ width: outputWidth, height: outputHeight, background: visibleBackground }} data-card-size={size}>
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
    </div>
  </div>;
}
