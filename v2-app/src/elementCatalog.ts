import type { DesignElement } from './domain';

export type ElementCategory = 'shapes' | 'dividers' | 'symbols' | 'emoji' | 'badges';

export interface ElementCatalogItem {
  id: string;
  name: string;
  category: ElementCategory;
  tags: string[];
  preview: string;
  create: () => DesignElement;
}

const elementId = () => `element-${crypto.randomUUID()}`;

function symbolElement(symbol: string, fontSize = 34, color = '#f7ead2'): DesignElement {
  return {
    id: elementId(),
    type: 'text',
    text: symbol,
    x: 170,
    y: 145,
    width: 80,
    height: 70,
    fontFamily: 'Georgia',
    fontSize,
    fontWeight: 700,
    color,
    textAlign: 'center',
    lineHeight: 1,
  };
}

function shapeElement(width: number, height: number, borderRadius: number, fill = '#75451f'): DesignElement {
  return {
    id: elementId(),
    type: 'shape',
    x: Math.round((420 - width) / 2),
    y: Math.round((380 - height) / 2),
    width,
    height,
    fill,
    stroke: '#bd662f',
    strokeWidth: 2,
    borderRadius,
  };
}

function dividerElement(style: 'solid' | 'double' | 'dots' | 'diamond' | 'stars'): DesignElement {
  if (style === 'solid') return { id: elementId(), type: 'shape', x: 70, y: 188, width: 280, height: 4, fill: '#bd662f', borderRadius: 999 };
  if (style === 'double') return { id: elementId(), type: 'text', text: '════════════', x: 70, y: 170, width: 280, height: 36, fontFamily: 'Georgia', fontSize: 20, color: '#bd662f', textAlign: 'center' };
  if (style === 'dots') return { id: elementId(), type: 'text', text: '•  •  •  •  •  •  •', x: 70, y: 174, width: 280, height: 32, fontFamily: 'Georgia', fontSize: 20, color: '#bd662f', textAlign: 'center' };
  if (style === 'diamond') return { id: elementId(), type: 'text', text: '────── ◆ ──────', x: 55, y: 170, width: 310, height: 36, fontFamily: 'Georgia', fontSize: 18, color: '#bd662f', textAlign: 'center' };
  return { id: elementId(), type: 'text', text: '✦ ───── ✦ ───── ✦', x: 55, y: 170, width: 310, height: 38, fontFamily: 'Georgia', fontSize: 18, color: '#f4b942', textAlign: 'center' };
}

export const ELEMENT_CATEGORIES: Array<{ id: 'all' | ElementCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'dividers', label: 'Dividers' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'badges', label: 'Badges' },
];

export const ELEMENT_CATALOG: ElementCatalogItem[] = [
  { id: 'rectangle', name: 'Rectangle', category: 'shapes', tags: ['box', 'panel', 'background'], preview: '▭', create: () => shapeElement(210, 110, 0) },
  { id: 'rounded-box', name: 'Rounded box', category: 'shapes', tags: ['box', 'panel', 'soft'], preview: '▢', create: () => shapeElement(210, 110, 22) },
  { id: 'circle', name: 'Circle', category: 'shapes', tags: ['round', 'orb', 'badge'], preview: '●', create: () => shapeElement(125, 125, 999) },
  { id: 'pill', name: 'Pill', category: 'shapes', tags: ['label', 'tag', 'rounded'], preview: '▬', create: () => shapeElement(210, 52, 999) },
  { id: 'square', name: 'Square', category: 'shapes', tags: ['box', 'tile'], preview: '■', create: () => shapeElement(120, 120, 0) },
  { id: 'soft-square', name: 'Soft square', category: 'shapes', tags: ['box', 'tile', 'rounded'], preview: '▣', create: () => shapeElement(120, 120, 18) },
  { id: 'solid-divider', name: 'Solid divider', category: 'dividers', tags: ['line', 'simple'], preview: '━━━━', create: () => dividerElement('solid') },
  { id: 'double-divider', name: 'Double divider', category: 'dividers', tags: ['line', 'double'], preview: '════', create: () => dividerElement('double') },
  { id: 'dot-divider', name: 'Dot divider', category: 'dividers', tags: ['dots', 'line'], preview: '• • •', create: () => dividerElement('dots') },
  { id: 'diamond-divider', name: 'Diamond divider', category: 'dividers', tags: ['diamond', 'ornament'], preview: '─ ◆ ─', create: () => dividerElement('diamond') },
  { id: 'star-divider', name: 'Star divider', category: 'dividers', tags: ['star', 'sparkle', 'ornament'], preview: '✦ ─ ✦', create: () => dividerElement('stars') },
  { id: 'sparkle', name: 'Sparkle', category: 'symbols', tags: ['star', 'magic', 'shine'], preview: '✦', create: () => symbolElement('✦', 42, '#f4b942') },
  { id: 'outlined-sparkle', name: 'Outlined sparkle', category: 'symbols', tags: ['star', 'magic'], preview: '✧', create: () => symbolElement('✧', 42, '#f4b942') },
  { id: 'heart', name: 'Heart', category: 'symbols', tags: ['love', 'romance'], preview: '♥', create: () => symbolElement('♥', 42, '#bd662f') },
  { id: 'diamond', name: 'Diamond', category: 'symbols', tags: ['gem', 'shape'], preview: '◆', create: () => symbolElement('◆', 42, '#bd662f') },
  { id: 'moon', name: 'Crescent moon', category: 'symbols', tags: ['night', 'witchy', 'celestial'], preview: '☾', create: () => symbolElement('☾', 46, '#f4b942') },
  { id: 'sun', name: 'Sun', category: 'symbols', tags: ['celestial', 'light'], preview: '☀', create: () => symbolElement('☀', 44, '#f4b942') },
  { id: 'key', name: 'Key', category: 'symbols', tags: ['mystery', 'secret'], preview: '⚿', create: () => symbolElement('⚿', 44, '#c8a878') },
  { id: 'sword', name: 'Sword', category: 'symbols', tags: ['weapon', 'fantasy'], preview: '⚔', create: () => symbolElement('⚔', 42, '#c8a878') },
  { id: 'crown', name: 'Crown', category: 'symbols', tags: ['royal', 'king', 'queen'], preview: '♛', create: () => symbolElement('♛', 44, '#f4b942') },
  { id: 'dragon', name: 'Dragon emoji', category: 'emoji', tags: ['fantasy', 'dragon'], preview: '🐉', create: () => symbolElement('🐉', 42) },
  { id: 'flame', name: 'Flame emoji', category: 'emoji', tags: ['fire', 'spice'], preview: '🔥', create: () => symbolElement('🔥', 42) },
  { id: 'book', name: 'Book emoji', category: 'emoji', tags: ['reading', 'novel'], preview: '📖', create: () => symbolElement('📖', 42) },
  { id: 'dagger', name: 'Dagger emoji', category: 'emoji', tags: ['weapon', 'fantasy'], preview: '🗡️', create: () => symbolElement('🗡️', 42) },
  { id: 'crystal', name: 'Crystal emoji', category: 'emoji', tags: ['magic', 'gem'], preview: '🔮', create: () => symbolElement('🔮', 42) },
  { id: 'lightning', name: 'Lightning emoji', category: 'emoji', tags: ['storm', 'power'], preview: '⚡', create: () => symbolElement('⚡', 42) },
  { id: 'round-badge', name: 'Round badge', category: 'badges', tags: ['label', 'seal'], preview: '◉', create: () => shapeElement(110, 110, 999, '#2b160d') },
  { id: 'label-badge', name: 'Label badge', category: 'badges', tags: ['label', 'tag'], preview: '▰', create: () => shapeElement(190, 58, 16, '#2b160d') },
  { id: 'outline-badge', name: 'Outline badge', category: 'badges', tags: ['label', 'outline'], preview: '◎', create: () => ({ ...shapeElement(120, 120, 999, 'transparent'), strokeWidth: 4 }) },
];
