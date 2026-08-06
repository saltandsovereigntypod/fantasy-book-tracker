import type { PointEvent, V2ArchiveState } from './archive';

const LOCAL_KEY = 'empyrean-v2-archive';

const EMPYREAN_CURRENCIES: Record<string, string> = {
  rider: 'Command Marks',
  scribe: 'Archive Seals',
  gryphon: 'Flight Honors',
  'dark-wielder': 'Shadow Marks',
  infantry: 'Service Marks',
  healer: 'Mending Honors',
};

const PRYTHIAN_CURRENCIES: Record<string, string> = {
  night: 'Starlight',
  dawn: 'Dawnlight',
  day: 'Sunmarks',
  spring: 'Blooms',
  summer: 'Tideglass',
  autumn: 'Embers',
  winter: 'Frostmarks',
};

function currencyName(): string {
  const html = document.documentElement;
  if (html.dataset.universe === 'prythian') return PRYTHIAN_CURRENCIES[html.dataset.court || 'night'] || 'Court Favor';
  return EMPYREAN_CURRENCIES[html.dataset.path || 'rider'] || 'Archive Marks';
}

function readArchive(): V2ArchiveState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) as V2ArchiveState : null;
  } catch {
    return null;
  }
}

function replacePointLanguage(root: ParentNode = document): void {
  const currency = currencyName();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, input, textarea, option, [data-point-ledger]')) return;
    const original = node.nodeValue || '';
    const replaced = original
      .replace(/\baccount points\b/gi, currency)
      .replace(/\bpoints\b/gi, currency);
    if (replaced !== original) node.nodeValue = replaced;
  });
}

function eventLabel(event: PointEvent): string {
  const labels: Record<PointEvent['kind'], string> = {
    'book-added': 'Book added',
    'reading-session-started': 'Reading session started',
    'reading-session-completed': 'Reading session completed',
    'book-first-completion': 'First completion',
    'book-reread-completion': 'Reread completed',
    'theory-created': 'Theory created',
    'suspicion-created': 'Suspicion created',
    'evidence-added': 'Evidence added',
  };
  return labels[event.kind];
}

function renderLedger(): void {
  const profile = document.querySelector<HTMLElement>('.v2-profile');
  if (!profile) return;
  const archive = readArchive();
  if (!archive) return;

  let panel = profile.querySelector<HTMLElement>('[data-point-ledger]');
  if (!panel) {
    panel = document.createElement('section');
    panel.dataset.pointLedger = 'true';
    panel.className = 'point-ledger-panel';
    profile.appendChild(panel);
  }

  const currency = currencyName();
  const events = Array.isArray(archive.pointLog) ? archive.pointLog : [];
  const total = events.reduce((sum, event) => sum + Number(event.amount || 0), 0);
  panel.innerHTML = '';

  const header = document.createElement('header');
  header.innerHTML = `<div><p>Activity ledger</p><h2>${currency}</h2></div><strong>${total.toLocaleString()}</strong>`;
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'point-ledger-list';
  events.slice(0, 30).forEach((event) => {
    const row = document.createElement('article');
    const date = event.occurredAt ? new Date(event.occurredAt).toLocaleDateString() : '';
    row.innerHTML = `<div><strong>${eventLabel(event)}</strong><span>${event.label}</span><small>${date}</small></div><b>+${event.amount.toLocaleString()}</b>`;
    list.appendChild(row);
  });
  if (!events.length) list.innerHTML = '<p>No activity rewards recorded yet.</p>';
  panel.appendChild(list);
}

let queued = false;
function refresh(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    replacePointLanguage();
    renderLedger();
  });
}

const observer = new MutationObserver(refresh);
function start(): void {
  refresh();
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', refresh);
  window.addEventListener('empyrean-v2-workspace-draft', refresh);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
