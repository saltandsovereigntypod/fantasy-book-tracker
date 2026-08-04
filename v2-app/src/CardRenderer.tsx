import { useRef } from 'react';
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
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type Interaction =
  | { kind: 'move'; pointerId: number; startClientX: number; startClientY: number; element: DesignElement }
  | { kind: 'resize'; pointerId: number; startClientX: number; startClientY: number; element: DesignElement; handle: ResizeHandle }
  | { kind: 'rotate'; pointerId: number; centerClientX: number; centerClientY: number; startAngle: number; rotation: number; element: DesignElement };

function boundValue(book: BookRecord, element: DesignElement): string | number {
  if (!element.binding) return element.type === 'text' ? element.text ?? '' : '';
  const value = book[element.binding];
  if (element.binding === 'status') {
    return ({ want: 'Want to read', reading: 'Currently reading', paused: 'Paused', completed: 'Completed', dnf: 'DNF' } as const)[book.status];
  }
  if (element.binding === 'progress' && element.type === 'text') return `${book.progress}%`;
  return Array.isArray(value) ? value.join(', ') : value;
}

function RatingGlyphs({ value, icon, emptyIcon }: { value: number; icon: string; emptyIcon: string }) {
  const safeValue = Math.max(0, Math.min(5, value));
  return (
    <span className="rating-glyph-row" aria-label={`${safeValue} of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, safeValue - index));
        return (
          <span className="rating-glyph-slot" key={index}>
            <span className="rating-glyph-empty">{emptyIcon}</span>
            {fill > 0 && (
              <span className="rating-glyph-fill" style={{ width: `${fill * 100}%` }}>
                <span>{icon}</span>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function elementStyle(element: DesignElement, scale: number): React.CSSProperties {
  return {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: 'center',
    opacity: element.opacity ?? 1,
  };
}

function textStyle(element: TextElement, scale: number): React.CSSProperties {
  return {
    fontFamily: element.fontFamily,
    fontSize: element.fontSize * scale,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    color: element.color,
    textAlign: element.textAlign,
    lineHeight: element.lineHeight,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  };
}

function angleFromPoint(clientX: number, clientY: number, centerX: number, centerY: number) {
  return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
}

function normalizeRotation(value: number) {
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return Math.round(next * 10) / 10;
}

function snapValue(value: number, grid = 2) {
  return Math.round(value / grid) * grid;
}

export function CardRenderer({
  book,
  design,
  size,
  mode = 'library',
  selectedElementId,
  onSelectElement,
  onChangeElement,
}: CardRendererProps) {
  const outputWidth = CARD_WIDTHS[size];
  const scale = outputWidth / design.width;
  const outputHeight = design.height * scale;
  const interaction = useRef<Interaction | null>(null);

  function beginMove(event: React.PointerEvent<HTMLDivElement>, element: DesignElement) {
    if (mode !== 'editor' || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectElement?.(element.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = {
      kind: 'move',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      element: { ...element },
    };
  }

  function beginResize(event: React.PointerEvent<HTMLButtonElement>, element: DesignElement, handle: ResizeHandle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      element: { ...element },
      handle,
    };
  }

  function beginRotate(event: React.PointerEvent<HTMLButtonElement>, element: DesignElement) {
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget.closest('.card-renderer')?.getBoundingClientRect();
    if (!card) return;
    const centerClientX = card.left + (element.x + element.width / 2) * scale;
    const centerClientY = card.top + (element.y + element.height / 2) * scale;
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = {
      kind: 'rotate',
      pointerId: event.pointerId,
      centerClientX,
      centerClientY,
      startAngle: angleFromPoint(event.clientX, event.clientY, centerClientX, centerClientY),
      rotation: element.rotation ?? 0,
      element: { ...element },
    };
  }

  function continueInteraction(event: React.PointerEvent<HTMLElement>) {
    const active = interaction.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    if (active.kind === 'move') {
      const dx = (event.clientX - active.startClientX) / scale;
      const dy = (event.clientY - active.startClientY) / scale;
      const x = Math.max(0, Math.min(design.width - active.element.width, active.element.x + dx));
      const y = Math.max(0, Math.min(design.height - active.element.height, active.element.y + dy));
      onChangeElement?.(active.element.id, { x: snapValue(x), y: snapValue(y) });
      return;
    }

    if (active.kind === 'rotate') {
      const currentAngle = angleFromPoint(event.clientX, event.clientY, active.centerClientX, active.centerClientY);
      const rotation = normalizeRotation(active.rotation + currentAngle - active.startAngle);
      onChangeElement?.(active.element.id, { rotation });
      return;
    }

    const dx = (event.clientX - active.startClientX) / scale;
    const dy = (event.clientY - active.startClientY) / scale;
    const start = active.element;
    let x = start.x;
    let y = start.y;
    let width = start.width;
    let height = start.height;

    if (active.handle.includes('e')) width = start.width + dx;
    if (active.handle.includes('s')) height = start.height + dy;
    if (active.handle.includes('w')) { width = start.width - dx; x = start.x + dx; }
    if (active.handle.includes('n')) { height = start.height - dy; y = start.y + dy; }

    const minimumWidth = 18;
    const minimumHeight = 12;
    if (width < minimumWidth) {
      if (active.handle.includes('w')) x -= minimumWidth - width;
      width = minimumWidth;
    }
    if (height < minimumHeight) {
      if (active.handle.includes('n')) y -= minimumHeight - height;
      height = minimumHeight;
    }

    x = Math.max(0, Math.min(design.width - minimumWidth, x));
    y = Math.max(0, Math.min(design.height - minimumHeight, y));
    width = Math.min(design.width - x, width);
    height = Math.min(design.height - y, height);

    onChangeElement?.(start.id, {
      x: snapValue(x),
      y: snapValue(y),
      width: snapValue(width),
      height: snapValue(height),
    });
  }

  function endInteraction(event: React.PointerEvent<HTMLElement>) {
    if (interaction.current?.pointerId !== event.pointerId) return;
    interaction.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  }

  function renderContent(element: DesignElement) {
    if (element.type === 'shape') {
      return <div className="design-element-content" style={{ background: element.fill, border: element.stroke ? `${(element.strokeWidth ?? 1) * scale}px solid ${element.stroke}` : undefined, borderRadius: (element.borderRadius ?? 0) * scale }} />;
    }

    if (element.type === 'image') {
      const source = element.binding ? String(boundValue(book, element) || '') : element.src || '';
      return source ? (
        <img className="design-element-content" src={source} alt="" draggable={false} style={{ objectFit: element.fit ?? 'cover', borderRadius: (element.borderRadius ?? 0) * scale }} />
      ) : (
        <div className="design-element-content design-element-placeholder" style={{ borderRadius: (element.borderRadius ?? 0) * scale, borderWidth: scale, fontSize: 12 * scale }}>Cover</div>
      );
    }

    if (element.type === 'text') {
      return <div className="design-element-content" style={textStyle(element, scale)}>{String(boundValue(book, element))}</div>;
    }

    if (element.type === 'progress') {
      const value = Number(boundValue(book, element)) || 0;
      return (
        <div className="design-element-content" style={{ background: element.trackColor, borderRadius: (element.borderRadius ?? 0) * scale, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: element.fillColor, borderRadius: 'inherit' }} />
        </div>
      );
    }

    const value = Number(book[element.metric]) || 0;
    return (
      <div className="design-element-content" style={{ color: element.color, fontFamily: element.fontFamily, fontSize: element.fontSize * scale, fontWeight: 700, lineHeight: 1.35 }}>
        <strong>{element.label}</strong>
        <RatingGlyphs value={value} icon={element.icon} emptyIcon={element.emptyIcon} />
        <small>{value} of 5</small>
      </div>
    );
  }

  return (
    <div
      className={`card-renderer card-renderer--${mode}`}
      style={{ width: outputWidth, height: outputHeight, background: design.background }}
      data-card-size={size}
    >
      {design.elements.map((element) => {
        const selected = mode === 'editor' && selectedElementId === element.id;
        return (
          <div
            key={element.id}
            className={`design-element design-element--${element.type}${selected ? ' is-selected' : ''}${element.locked ? ' is-locked' : ''}`}
            style={elementStyle(element, scale)}
            onPointerDown={mode === 'editor' ? (event) => beginMove(event, element) : undefined}
            onPointerMove={mode === 'editor' ? continueInteraction : undefined}
            onPointerUp={mode === 'editor' ? endInteraction : undefined}
            onPointerCancel={mode === 'editor' ? endInteraction : undefined}
          >
            {renderContent(element)}
            {selected && !element.locked && (
              <div className="selection-controls" aria-hidden="true">
                <button className="rotation-handle" tabIndex={-1} onPointerDown={(event) => beginRotate(event, element)} onPointerMove={continueInteraction} onPointerUp={endInteraction} onPointerCancel={endInteraction} />
                {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => (
                  <button
                    key={handle}
                    className={`resize-handle resize-handle--${handle}`}
                    tabIndex={-1}
                    onPointerDown={(event) => beginResize(event, element, handle)}
                    onPointerMove={continueInteraction}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
