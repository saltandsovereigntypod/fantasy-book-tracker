import type { BookRecord, CardDesign, CardSize, DesignElement, TextElement } from './domain';
import { CARD_WIDTHS } from './domain';

interface CardRendererProps {
  book: BookRecord;
  design: CardDesign;
  size: CardSize;
  mode?: 'editor' | 'library';
  selectedElementId?: string | null;
  onSelectElement?: (id: string) => void;
}

function boundValue(book: BookRecord, element: DesignElement): string | number {
  if (!element.binding) return element.type === 'text' ? element.text ?? '' : '';
  const value = book[element.binding];
  if (element.binding === 'status') {
    return ({ want: 'Want to read', reading: 'Currently reading', paused: 'Paused', completed: 'Completed', dnf: 'DNF' } as const)[book.status];
  }
  if (element.binding === 'progress' && element.type === 'text') return `${book.progress}%`;
  return Array.isArray(value) ? value.join(', ') : value;
}

function ratingGlyphs(value: number, icon: string, emptyIcon: string): string {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${icon.repeat(rounded)}${emptyIcon.repeat(5 - rounded)}`;
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

export function CardRenderer({ book, design, size, mode = 'library', selectedElementId, onSelectElement }: CardRendererProps) {
  const outputWidth = CARD_WIDTHS[size];
  const scale = outputWidth / design.width;
  const outputHeight = design.height * scale;

  return (
    <div
      className={`card-renderer card-renderer--${mode}`}
      style={{ width: outputWidth, height: outputHeight, background: design.background }}
      data-card-size={size}
    >
      {design.elements.map((element) => {
        const selected = mode === 'editor' && selectedElementId === element.id;
        const common = {
          key: element.id,
          className: `design-element design-element--${element.type}${selected ? ' is-selected' : ''}`,
          style: elementStyle(element, scale),
          onPointerDown: mode === 'editor' ? (event: React.PointerEvent) => {
            event.stopPropagation();
            onSelectElement?.(element.id);
          } : undefined,
        };

        if (element.type === 'shape') {
          return <div {...common} style={{ ...common.style, background: element.fill, border: element.stroke ? `${(element.strokeWidth ?? 1) * scale}px solid ${element.stroke}` : undefined, borderRadius: (element.borderRadius ?? 0) * scale }} />;
        }

        if (element.type === 'image') {
          const source = element.binding ? String(boundValue(book, element) || '') : element.src || '';
          return source ? (
            <img {...common} src={source} alt="" style={{ ...common.style, objectFit: element.fit ?? 'cover', borderRadius: (element.borderRadius ?? 0) * scale }} />
          ) : (
            <div {...common} style={{ ...common.style, display: 'grid', placeItems: 'center', borderRadius: (element.borderRadius ?? 0) * scale, border: `${scale}px solid #75451f`, color: '#c8a878', background: '#1b100a', fontFamily: 'Inter', fontSize: 12 * scale }}>Cover</div>
          );
        }

        if (element.type === 'text') {
          return <div {...common} style={{ ...common.style, ...textStyle(element, scale) }}>{String(boundValue(book, element))}</div>;
        }

        if (element.type === 'progress') {
          const value = Number(boundValue(book, element)) || 0;
          return (
            <div {...common} style={{ ...common.style, background: element.trackColor, borderRadius: (element.borderRadius ?? 0) * scale, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: element.fillColor, borderRadius: 'inherit' }} />
            </div>
          );
        }

        const value = Number(book[element.metric]) || 0;
        return (
          <div {...common} style={{ ...common.style, color: element.color, fontFamily: element.fontFamily, fontSize: element.fontSize * scale, fontWeight: 700, lineHeight: 1.35 }}>
            <strong>{element.label}</strong>
            <div>{ratingGlyphs(value, element.icon, element.emptyIcon)}</div>
            <small>{value} of 5</small>
          </div>
        );
      })}
    </div>
  );
}
