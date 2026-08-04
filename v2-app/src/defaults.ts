import type { BookRecord, CardDesign } from './domain';

export const defaultBook: BookRecord = {
  id: 'draft-book',
  title: 'Fourth Wing',
  author: 'Rebecca Yarros',
  series: 'The Empyrean · Book 1',
  status: 'reading',
  progress: 64,
  rating: 4.5,
  spice: 3,
  impact: 4,
  reaction: 'I am emotionally compromised.',
  coverUrl: '',
  mindMapNodeIds: [],
  wallCardIds: [],
  theoryIds: [],
};

export const defaultDesign: CardDesign = {
  id: 'standard-book-card-v2',
  width: 420,
  height: 380,
  background: '#2b160d',
  version: 1,
  elements: [
    { id: 'card-frame', type: 'shape', x: 0, y: 0, width: 420, height: 380, fill: '#2b160d', stroke: '#75451f', strokeWidth: 2, borderRadius: 22, locked: true },
    { id: 'cover', type: 'image', binding: 'coverUrl', x: 18, y: 24, width: 112, height: 164, fit: 'cover', borderRadius: 12 },
    { id: 'title', type: 'text', binding: 'title', x: 144, y: 22, width: 252, height: 62, fontFamily: 'Libre Baskerville', fontSize: 28, fontWeight: 700, color: '#f7ead2', lineHeight: 1.08 },
    { id: 'author', type: 'text', binding: 'author', x: 144, y: 94, width: 120, height: 44, fontFamily: 'Inter', fontSize: 14, fontWeight: 700, color: '#f7ead2' },
    { id: 'series', type: 'text', binding: 'series', x: 276, y: 94, width: 120, height: 44, fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#c8a878' },
    { id: 'status', type: 'text', binding: 'status', x: 18, y: 204, width: 112, height: 48, fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: '#f7ead2' },
    { id: 'progress-label', type: 'text', binding: 'progress', x: 144, y: 198, width: 252, height: 32, fontFamily: 'Inter', fontSize: 16, fontWeight: 700, color: '#f7ead2' },
    { id: 'progress', type: 'progress', binding: 'progress', x: 144, y: 240, width: 252, height: 8, trackColor: '#75451f', fillColor: '#bd662f', borderRadius: 999 },
    { id: 'rating', type: 'rating', binding: 'rating', metric: 'rating', label: 'Overall', icon: '★', emptyIcon: '☆', x: 18, y: 274, width: 112, height: 70, color: '#bd662f', fontFamily: 'Inter', fontSize: 13 },
    { id: 'spice', type: 'rating', binding: 'spice', metric: 'spice', label: 'Spice', icon: '🔥', emptyIcon: '·', x: 152, y: 274, width: 112, height: 70, color: '#bd662f', fontFamily: 'Inter', fontSize: 13 },
    { id: 'impact', type: 'rating', binding: 'impact', metric: 'impact', label: 'Impact', icon: '♥', emptyIcon: '♡', x: 286, y: 274, width: 112, height: 70, color: '#bd662f', fontFamily: 'Inter', fontSize: 13 },
    { id: 'reaction', type: 'text', binding: 'reaction', x: 144, y: 253, width: 252, height: 20, fontFamily: 'Libre Baskerville', fontSize: 10, fontStyle: 'italic', color: '#c8a878', textAlign: 'right' },
  ],
};
