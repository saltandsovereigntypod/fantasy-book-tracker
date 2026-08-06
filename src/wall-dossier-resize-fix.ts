import { loadCloudArchive, saveCloudArchive, saveLocalArchive } from './archive';
import { getAuthSnapshot } from './supabase';

const MIN_WIDTH = 160;
const MIN_HEIGHT = 110;
const CLICK_SUPPRESSION_MS = 350;

type ActiveResize = {
  pointerId: number;
  card: HTMLElement;
  cardId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  zoom: number;
};

let active: ActiveResize | null = null;
let suppressCardId = '';
let suppressUntil = 0;

function currentZoom(card: HTMLElement): number {
  const canvas = card.closest<HTMLElement>('.wall-canvas');
  if (!canvas) return 1;
  const transform = getComputedStyle(canvas).transform;
  if (!transform || transform === 'none') return 1;
  const match = transform.match(/^matrix\(([^,]+)/);
  const scale = match ? Number(match[1]) : 1;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function applySize(clientX: number, clientY: number) {
  if (!active) return;
  const width = Math.max(MIN_WIDTH, Math.round(active.startWidth + (clientX - active.startX) / active.zoom));
  const height = Math.max(MIN_HEIGHT, Math.round(active.startHeight + (clientY - active.startY) / active.zoom));
  active.card.style.width = `${width}px`;
  active.card.style.height = `${height}px`;
}

async function persistSize(cardId: string, width: number, height: number) {
  const { user } = await getAuthSnapshot();
  if (!user) return;
  const archive = await loadCloudArchive(user);
  let changed = false;
  const walls = archive.walls.map((wall) => {
    if (!wall.cards.some((card) => card.id === cardId)) return wall;
    changed = true;
    return {
      ...wall,
      updatedAt: new Date().toISOString(),
      cards: wall.cards.map((card) => card.id === cardId
        ? { ...card, width, height, updatedAt: new Date().toISOString() }
        : card),
    };
  });
  if (!changed) return;
  const next = { ...archive, walls, updatedAt: new Date().toISOString() };
  saveLocalArchive(next);
  await saveCloudArchive(user, next);
}

function finish(event: PointerEvent) {
  if (!active || event.pointerId !== active.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applySize(event.clientX, event.clientY);
  const { card, cardId } = active;
  const width = Math.max(MIN_WIDTH, Math.round(card.offsetWidth));
  const height = Math.max(MIN_HEIGHT, Math.round(card.offsetHeight));
  suppressCardId = cardId;
  suppressUntil = performance.now() + CLICK_SUPPRESSION_MS;
  try { card.releasePointerCapture(event.pointerId); } catch { /* capture already released */ }
  active = null;
  document.removeEventListener('pointermove', move, true);
  document.removeEventListener('pointerup', finish, true);
  document.removeEventListener('pointercancel', finish, true);
  void persistSize(cardId, width, height).catch((reason) => console.error('Dossier size save failed', reason));
}

function move(event: PointerEvent) {
  if (!active || event.pointerId !== active.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applySize(event.clientX, event.clientY);
}

document.addEventListener('click', (event) => {
  if (performance.now() > suppressUntil) return;
  const target = event.target as Element | null;
  const card = target?.closest<HTMLElement>('.wall-card[data-wall-card-id]');
  if (!card || card.dataset.wallCardId !== suppressCardId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  suppressCardId = '';
  suppressUntil = 0;
}, true);

document.addEventListener('pointerdown', (event) => {
  const target = event.target as Element | null;
  const handle = target?.closest<HTMLElement>('.wall-card .wall-resize-handle');
  const card = handle?.closest<HTMLElement>('.wall-card[data-wall-card-id]');
  const cardId = card?.dataset.wallCardId;
  if (!handle || !card || !cardId) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const zoom = currentZoom(card);
  active = {
    pointerId: event.pointerId,
    card,
    cardId,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: card.offsetWidth,
    startHeight: card.offsetHeight,
    zoom,
  };
  try { card.setPointerCapture(event.pointerId); } catch { /* unsupported */ }
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', finish, true);
  document.addEventListener('pointercancel', finish, true);
}, true);

export {};
