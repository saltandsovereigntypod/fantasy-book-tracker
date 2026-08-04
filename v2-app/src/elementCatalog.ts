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

function symbolElement(symbol: string, fontSize = 34, color = '#f7ead2', width = 100, height = 76): DesignElement {
  return { id: elementId(), type: 'text', text: symbol, x: Math.round((420 - width) / 2), y: Math.round((380 - height) / 2), width, height, fontFamily: 'Georgia', fontSize, fontWeight: 700, color, textAlign: 'center', lineHeight: 1 };
}

function shapeElement(width: number, height: number, borderRadius: number, fill = '#75451f', stroke = '#bd662f', strokeWidth = 2): DesignElement {
  return { id: elementId(), type: 'shape', x: Math.round((420 - width) / 2), y: Math.round((380 - height) / 2), width, height, fill, stroke, strokeWidth, borderRadius };
}

function textDivider(text: string, fontSize = 18, color = '#bd662f'): DesignElement {
  return { id: elementId(), type: 'text', text, x: 45, y: 170, width: 330, height: 42, fontFamily: 'Georgia', fontSize, fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2 };
}

function outlineFrame(width: number, height: number, radius = 0, strokeWidth = 3): DesignElement {
  return shapeElement(width, height, radius, 'transparent', '#bd662f', strokeWidth);
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
  { id: 'wide-rectangle', name: 'Wide rectangle', category: 'shapes', tags: ['box', 'banner', 'panel'], preview: '▬', create: () => shapeElement(300, 86, 0) },
  { id: 'tall-rectangle', name: 'Tall rectangle', category: 'shapes', tags: ['box', 'column', 'panel'], preview: '▯', create: () => shapeElement(120, 240, 0) },
  { id: 'rounded-box', name: 'Rounded box', category: 'shapes', tags: ['box', 'panel', 'soft'], preview: '▢', create: () => shapeElement(210, 110, 22) },
  { id: 'soft-panel', name: 'Soft panel', category: 'shapes', tags: ['box', 'panel', 'rounded'], preview: '▣', create: () => shapeElement(300, 150, 34) },
  { id: 'circle', name: 'Circle', category: 'shapes', tags: ['round', 'orb', 'badge'], preview: '●', create: () => shapeElement(125, 125, 999) },
  { id: 'oval', name: 'Oval', category: 'shapes', tags: ['round', 'ellipse', 'frame'], preview: '⬭', create: () => shapeElement(210, 110, 999) },
  { id: 'pill', name: 'Pill', category: 'shapes', tags: ['label', 'tag', 'rounded'], preview: '▬', create: () => shapeElement(210, 52, 999) },
  { id: 'square', name: 'Square', category: 'shapes', tags: ['box', 'tile'], preview: '■', create: () => shapeElement(120, 120, 0) },
  { id: 'soft-square', name: 'Soft square', category: 'shapes', tags: ['box', 'tile', 'rounded'], preview: '▣', create: () => shapeElement(120, 120, 18) },
  { id: 'diamond-shape', name: 'Diamond panel', category: 'shapes', tags: ['diamond', 'gem', 'rotated'], preview: '◆', create: () => ({ ...shapeElement(120, 120, 8), rotation: 45 }) },
  { id: 'triangle-up', name: 'Triangle', category: 'shapes', tags: ['triangle', 'arrow', 'point'], preview: '▲', create: () => symbolElement('▲', 90, '#75451f', 130, 120) },
  { id: 'hexagon', name: 'Hexagon', category: 'shapes', tags: ['hexagon', 'geometric', 'badge'], preview: '⬢', create: () => symbolElement('⬢', 100, '#75451f', 140, 130) },
  { id: 'octagon', name: 'Octagon', category: 'shapes', tags: ['octagon', 'geometric', 'badge'], preview: '⯃', create: () => symbolElement('⯃', 96, '#75451f', 140, 130) },
  { id: 'arch', name: 'Arch panel', category: 'shapes', tags: ['arch', 'window', 'gothic'], preview: '⌒', create: () => shapeElement(180, 220, 90) },
  { id: 'small-frame', name: 'Small outline frame', category: 'shapes', tags: ['frame', 'border', 'outline'], preview: '□', create: () => outlineFrame(150, 150, 0) },
  { id: 'rounded-frame', name: 'Rounded outline frame', category: 'shapes', tags: ['frame', 'border', 'rounded'], preview: '▢', create: () => outlineFrame(240, 150, 28) },
  { id: 'oval-frame', name: 'Oval outline frame', category: 'shapes', tags: ['frame', 'border', 'oval'], preview: '○', create: () => outlineFrame(220, 140, 999) },
  { id: 'full-frame', name: 'Full card frame', category: 'shapes', tags: ['frame', 'border', 'card'], preview: '▣', create: () => ({ ...outlineFrame(380, 340, 24, 3), x: 20, y: 20 }) },
  { id: 'underline-block', name: 'Underline block', category: 'shapes', tags: ['underline', 'highlight', 'line'], preview: '▂', create: () => shapeElement(240, 10, 999, '#bd662f', '#bd662f', 0) },

  { id: 'solid-divider', name: 'Solid divider', category: 'dividers', tags: ['line', 'simple'], preview: '━━━━', create: () => shapeElement(280, 4, 999, '#bd662f', '#bd662f', 0) },
  { id: 'thin-divider', name: 'Thin divider', category: 'dividers', tags: ['line', 'thin', 'simple'], preview: '────', create: () => shapeElement(290, 2, 999, '#c8a878', '#c8a878', 0) },
  { id: 'short-divider', name: 'Short divider', category: 'dividers', tags: ['line', 'short'], preview: '━━', create: () => shapeElement(130, 5, 999, '#bd662f', '#bd662f', 0) },
  { id: 'double-divider', name: 'Double divider', category: 'dividers', tags: ['line', 'double'], preview: '════', create: () => textDivider('════════════', 20) },
  { id: 'triple-divider', name: 'Triple divider', category: 'dividers', tags: ['line', 'triple'], preview: '≡≡≡', create: () => textDivider('≡ ≡ ≡ ≡ ≡ ≡', 21) },
  { id: 'dot-divider', name: 'Dot divider', category: 'dividers', tags: ['dots', 'line'], preview: '• • •', create: () => textDivider('•  •  •  •  •  •  •', 20) },
  { id: 'small-dot-divider', name: 'Fine dot divider', category: 'dividers', tags: ['dots', 'fine', 'line'], preview: '· · ·', create: () => textDivider('· · · · · · · · · · · ·', 18) },
  { id: 'diamond-divider', name: 'Diamond divider', category: 'dividers', tags: ['diamond', 'ornament'], preview: '─ ◆ ─', create: () => textDivider('────── ◆ ──────', 18) },
  { id: 'open-diamond-divider', name: 'Open diamond divider', category: 'dividers', tags: ['diamond', 'outline', 'ornament'], preview: '─ ◇ ─', create: () => textDivider('────── ◇ ──────', 18) },
  { id: 'star-divider', name: 'Star divider', category: 'dividers', tags: ['star', 'sparkle', 'ornament'], preview: '✦ ─ ✦', create: () => textDivider('✦ ───── ✦ ───── ✦', 18, '#f4b942') },
  { id: 'moon-divider', name: 'Moon divider', category: 'dividers', tags: ['moon', 'celestial', 'witchy'], preview: '☾ ─ ☽', create: () => textDivider('☾ ───── ✦ ───── ☽', 20, '#f4b942') },
  { id: 'sun-divider', name: 'Sun divider', category: 'dividers', tags: ['sun', 'celestial', 'light'], preview: '─ ☀ ─', create: () => textDivider('───── ☀ ─────', 21, '#f4b942') },
  { id: 'heart-divider', name: 'Heart divider', category: 'dividers', tags: ['heart', 'romance', 'love'], preview: '─ ♥ ─', create: () => textDivider('───── ♥ ─────', 19, '#bd662f') },
  { id: 'sword-divider', name: 'Sword divider', category: 'dividers', tags: ['sword', 'fantasy', 'weapon'], preview: '─ ⚔ ─', create: () => textDivider('──── ⚔ ────', 21, '#c8a878') },
  { id: 'key-divider', name: 'Key divider', category: 'dividers', tags: ['key', 'mystery', 'secret'], preview: '─ ⚿ ─', create: () => textDivider('──── ⚿ ────', 22, '#c8a878') },
  { id: 'leaf-divider', name: 'Leaf divider', category: 'dividers', tags: ['leaf', 'botanical', 'nature'], preview: '❧ ─ ❧', create: () => textDivider('❧ ───── ❧ ───── ❧', 20, '#c8a878') },
  { id: 'flourish-divider', name: 'Flourish divider', category: 'dividers', tags: ['flourish', 'ornate', 'vintage'], preview: '❦', create: () => textDivider('━━━━ ❦ ━━━━', 22, '#c8a878') },
  { id: 'curly-divider', name: 'Curly divider', category: 'dividers', tags: ['curly', 'ornate', 'swirl'], preview: '༺༻', create: () => textDivider('༺━━━━━━༻', 22, '#c8a878') },
  { id: 'cross-divider', name: 'Cross divider', category: 'dividers', tags: ['cross', 'gothic', 'ornate'], preview: '─ ✚ ─', create: () => textDivider('──── ✚ ────', 19, '#c8a878') },
  { id: 'arrow-divider', name: 'Arrow divider', category: 'dividers', tags: ['arrow', 'direction', 'line'], preview: '→ → →', create: () => textDivider('➳ ───────── ➳', 18, '#bd662f') },

  { id: 'sparkle', name: 'Sparkle', category: 'symbols', tags: ['star', 'magic', 'shine'], preview: '✦', create: () => symbolElement('✦', 42, '#f4b942') },
  { id: 'outlined-sparkle', name: 'Outlined sparkle', category: 'symbols', tags: ['star', 'magic'], preview: '✧', create: () => symbolElement('✧', 42, '#f4b942') },
  { id: 'four-star', name: 'Four point star', category: 'symbols', tags: ['star', 'sparkle', 'celestial'], preview: '✣', create: () => symbolElement('✣', 42, '#f4b942') },
  { id: 'burst', name: 'Star burst', category: 'symbols', tags: ['star', 'burst', 'magic'], preview: '✺', create: () => symbolElement('✺', 46, '#f4b942') },
  { id: 'heart', name: 'Heart', category: 'symbols', tags: ['love', 'romance'], preview: '♥', create: () => symbolElement('♥', 42, '#bd662f') },
  { id: 'open-heart', name: 'Open heart', category: 'symbols', tags: ['love', 'romance', 'outline'], preview: '♡', create: () => symbolElement('♡', 42, '#bd662f') },
  { id: 'diamond', name: 'Diamond', category: 'symbols', tags: ['gem', 'shape'], preview: '◆', create: () => symbolElement('◆', 42, '#bd662f') },
  { id: 'open-diamond', name: 'Open diamond', category: 'symbols', tags: ['gem', 'shape', 'outline'], preview: '◇', create: () => symbolElement('◇', 42, '#bd662f') },
  { id: 'moon', name: 'Crescent moon', category: 'symbols', tags: ['night', 'witchy', 'celestial'], preview: '☾', create: () => symbolElement('☾', 46, '#f4b942') },
  { id: 'reverse-moon', name: 'Reverse crescent', category: 'symbols', tags: ['night', 'witchy', 'celestial'], preview: '☽', create: () => symbolElement('☽', 46, '#f4b942') },
  { id: 'moon-phase', name: 'Moon phases', category: 'symbols', tags: ['moon', 'phases', 'witchy', 'celestial'], preview: '◐ ● ◑', create: () => symbolElement('◐  ●  ◑', 28, '#f4b942', 210, 70) },
  { id: 'sun', name: 'Sun', category: 'symbols', tags: ['celestial', 'light'], preview: '☀', create: () => symbolElement('☀', 44, '#f4b942') },
  { id: 'astrological-sun', name: 'Solar symbol', category: 'symbols', tags: ['sun', 'astrology', 'celestial'], preview: '☉', create: () => symbolElement('☉', 46, '#f4b942') },
  { id: 'star-symbol', name: 'Five point star', category: 'symbols', tags: ['star', 'celestial'], preview: '★', create: () => symbolElement('★', 44, '#f4b942') },
  { id: 'open-star', name: 'Open star', category: 'symbols', tags: ['star', 'outline', 'celestial'], preview: '☆', create: () => symbolElement('☆', 44, '#f4b942') },
  { id: 'key', name: 'Key', category: 'symbols', tags: ['mystery', 'secret'], preview: '⚿', create: () => symbolElement('⚿', 44, '#c8a878') },
  { id: 'skeleton-key', name: 'Skeleton key', category: 'symbols', tags: ['key', 'mystery', 'secret'], preview: '🗝', create: () => symbolElement('🗝', 42, '#c8a878') },
  { id: 'sword', name: 'Crossed swords', category: 'symbols', tags: ['weapon', 'fantasy'], preview: '⚔', create: () => symbolElement('⚔', 42, '#c8a878') },
  { id: 'dagger-symbol', name: 'Dagger', category: 'symbols', tags: ['weapon', 'fantasy', 'gothic'], preview: '†', create: () => symbolElement('†', 52, '#c8a878') },
  { id: 'crown', name: 'Crown', category: 'symbols', tags: ['royal', 'king', 'queen'], preview: '♛', create: () => symbolElement('♛', 44, '#f4b942') },
  { id: 'open-crown', name: 'Royal crown', category: 'symbols', tags: ['royal', 'king', 'queen'], preview: '♕', create: () => symbolElement('♕', 44, '#f4b942') },
  { id: 'arrow-right', name: 'Right arrow', category: 'symbols', tags: ['arrow', 'direction'], preview: '➜', create: () => symbolElement('➜', 48, '#bd662f') },
  { id: 'arrow-left', name: 'Left arrow', category: 'symbols', tags: ['arrow', 'direction'], preview: '⬅', create: () => symbolElement('⬅', 44, '#bd662f') },
  { id: 'curved-arrow', name: 'Curved arrow', category: 'symbols', tags: ['arrow', 'curve', 'direction'], preview: '➶', create: () => symbolElement('➶', 48, '#bd662f') },
  { id: 'feather', name: 'Feather', category: 'symbols', tags: ['feather', 'writing', 'nature'], preview: '❧', create: () => symbolElement('❧', 48, '#c8a878') },
  { id: 'fleur', name: 'Fleur-de-lis', category: 'symbols', tags: ['royal', 'ornate', 'floral'], preview: '⚜', create: () => symbolElement('⚜', 48, '#f4b942') },
  { id: 'infinity', name: 'Infinity', category: 'symbols', tags: ['infinity', 'eternal', 'bond'], preview: '∞', create: () => symbolElement('∞', 52, '#c8a878') },
  { id: 'ankh', name: 'Ankh', category: 'symbols', tags: ['ankh', 'ancient', 'life'], preview: '☥', create: () => symbolElement('☥', 50, '#c8a878') },
  { id: 'alchemy', name: 'Alchemy symbol', category: 'symbols', tags: ['alchemy', 'magic', 'element'], preview: '🜁', create: () => symbolElement('🜁', 50, '#c8a878') },
  { id: 'warning', name: 'Warning mark', category: 'symbols', tags: ['warning', 'danger', 'attention'], preview: '⚠', create: () => symbolElement('⚠', 46, '#f4b942') },
  { id: 'check', name: 'Check mark', category: 'symbols', tags: ['check', 'complete', 'yes'], preview: '✓', create: () => symbolElement('✓', 50, '#f7ead2') },
  { id: 'cross', name: 'Cross mark', category: 'symbols', tags: ['cross', 'no', 'remove'], preview: '✕', create: () => symbolElement('✕', 48, '#bd662f') },
  { id: 'music', name: 'Music note', category: 'symbols', tags: ['music', 'song', 'sound'], preview: '♫', create: () => symbolElement('♫', 48, '#c8a878') },
  { id: 'flower', name: 'Floral mark', category: 'symbols', tags: ['flower', 'botanical', 'nature'], preview: '❀', create: () => symbolElement('❀', 48, '#c8a878') },
  { id: 'leaf', name: 'Leaf mark', category: 'symbols', tags: ['leaf', 'botanical', 'nature'], preview: '❦', create: () => symbolElement('❦', 48, '#c8a878') },

  { id: 'dragon', name: 'Dragon emoji', category: 'emoji', tags: ['fantasy', 'dragon'], preview: '🐉', create: () => symbolElement('🐉', 42) },
  { id: 'dragon-face', name: 'Dragon face', category: 'emoji', tags: ['fantasy', 'dragon', 'face'], preview: '🐲', create: () => symbolElement('🐲', 42) },
  { id: 'flame', name: 'Flame emoji', category: 'emoji', tags: ['fire', 'spice'], preview: '🔥', create: () => symbolElement('🔥', 42) },
  { id: 'book', name: 'Open book', category: 'emoji', tags: ['reading', 'novel'], preview: '📖', create: () => symbolElement('📖', 42) },
  { id: 'books', name: 'Book stack', category: 'emoji', tags: ['reading', 'library', 'novel'], preview: '📚', create: () => symbolElement('📚', 42) },
  { id: 'dagger', name: 'Dagger emoji', category: 'emoji', tags: ['weapon', 'fantasy'], preview: '🗡️', create: () => symbolElement('🗡️', 42) },
  { id: 'crystal', name: 'Crystal ball', category: 'emoji', tags: ['magic', 'gem', 'witchy'], preview: '🔮', create: () => symbolElement('🔮', 42) },
  { id: 'lightning', name: 'Lightning', category: 'emoji', tags: ['storm', 'power'], preview: '⚡', create: () => symbolElement('⚡', 42) },
  { id: 'rose', name: 'Rose', category: 'emoji', tags: ['flower', 'romance', 'love'], preview: '🌹', create: () => symbolElement('🌹', 42) },
  { id: 'black-heart', name: 'Black heart', category: 'emoji', tags: ['heart', 'romance', 'dark'], preview: '🖤', create: () => symbolElement('🖤', 42) },
  { id: 'broken-heart', name: 'Broken heart', category: 'emoji', tags: ['heart', 'romance', 'sad'], preview: '💔', create: () => symbolElement('💔', 42) },
  { id: 'skull', name: 'Skull', category: 'emoji', tags: ['death', 'dark', 'gothic'], preview: '💀', create: () => symbolElement('💀', 42) },
  { id: 'ghost', name: 'Ghost', category: 'emoji', tags: ['ghost', 'spirit', 'supernatural'], preview: '👻', create: () => symbolElement('👻', 42) },
  { id: 'sparkles-emoji', name: 'Sparkles emoji', category: 'emoji', tags: ['magic', 'shine', 'sparkle'], preview: '✨', create: () => symbolElement('✨', 42) },
  { id: 'moon-emoji', name: 'Crescent moon emoji', category: 'emoji', tags: ['moon', 'night', 'celestial'], preview: '🌙', create: () => symbolElement('🌙', 42) },
  { id: 'sun-emoji', name: 'Sun emoji', category: 'emoji', tags: ['sun', 'light', 'celestial'], preview: '☀️', create: () => symbolElement('☀️', 42) },
  { id: 'star-emoji', name: 'Star emoji', category: 'emoji', tags: ['star', 'celestial', 'favorite'], preview: '⭐', create: () => symbolElement('⭐', 42) },
  { id: 'crown-emoji', name: 'Crown emoji', category: 'emoji', tags: ['crown', 'royal', 'queen'], preview: '👑', create: () => symbolElement('👑', 42) },
  { id: 'lock', name: 'Lock', category: 'emoji', tags: ['lock', 'secret', 'protected'], preview: '🔒', create: () => symbolElement('🔒', 42) },
  { id: 'key-emoji', name: 'Key emoji', category: 'emoji', tags: ['key', 'secret', 'unlock'], preview: '🔑', create: () => symbolElement('🔑', 42) },
  { id: 'eye', name: 'Eye', category: 'emoji', tags: ['eye', 'vision', 'watching'], preview: '👁️', create: () => symbolElement('👁️', 42) },
  { id: 'hourglass', name: 'Hourglass', category: 'emoji', tags: ['time', 'hourglass', 'waiting'], preview: '⌛', create: () => symbolElement('⌛', 42) },
  { id: 'scroll', name: 'Scroll', category: 'emoji', tags: ['scroll', 'writing', 'ancient'], preview: '📜', create: () => symbolElement('📜', 42) },
  { id: 'quill', name: 'Quill', category: 'emoji', tags: ['quill', 'writing', 'author'], preview: '🪶', create: () => symbolElement('🪶', 42) },

  { id: 'round-badge', name: 'Round badge', category: 'badges', tags: ['label', 'seal'], preview: '◉', create: () => shapeElement(110, 110, 999, '#2b160d') },
  { id: 'label-badge', name: 'Label badge', category: 'badges', tags: ['label', 'tag'], preview: '▰', create: () => shapeElement(190, 58, 16, '#2b160d') },
  { id: 'outline-badge', name: 'Outline badge', category: 'badges', tags: ['label', 'outline'], preview: '◎', create: () => outlineFrame(120, 120, 999, 4) },
  { id: 'diamond-badge', name: 'Diamond badge', category: 'badges', tags: ['diamond', 'label', 'seal'], preview: '◆', create: () => ({ ...shapeElement(105, 105, 8, '#2b160d'), rotation: 45 }) },
  { id: 'oval-badge', name: 'Oval badge', category: 'badges', tags: ['oval', 'label', 'seal'], preview: '⬭', create: () => shapeElement(180, 90, 999, '#2b160d') },
  { id: 'banner-badge', name: 'Banner badge', category: 'badges', tags: ['banner', 'label', 'title'], preview: '▰', create: () => shapeElement(250, 70, 8, '#2b160d') },
  { id: 'small-pill-badge', name: 'Small pill badge', category: 'badges', tags: ['pill', 'tag', 'label'], preview: '▬', create: () => shapeElement(145, 42, 999, '#2b160d') },
  { id: 'square-badge', name: 'Square badge', category: 'badges', tags: ['square', 'label', 'seal'], preview: '▣', create: () => shapeElement(105, 105, 12, '#2b160d') },
  { id: 'double-ring-badge', name: 'Double ring badge', category: 'badges', tags: ['round', 'ring', 'seal'], preview: '◎', create: () => outlineFrame(130, 130, 999, 7) },
  { id: 'full-width-label', name: 'Full width label', category: 'badges', tags: ['wide', 'label', 'banner'], preview: '━━', create: () => shapeElement(330, 64, 14, '#2b160d') },
  { id: 'corner-label', name: 'Corner label', category: 'badges', tags: ['corner', 'label', 'tag'], preview: '◩', create: () => ({ ...shapeElement(145, 52, 10, '#2b160d'), x: 18, y: 18 }) },
  { id: 'seal-badge', name: 'Wax seal badge', category: 'badges', tags: ['seal', 'wax', 'royal'], preview: '✹', create: () => symbolElement('✹', 94, '#75451f', 130, 120) },
];
