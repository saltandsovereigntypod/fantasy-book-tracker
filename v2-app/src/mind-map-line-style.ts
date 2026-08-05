import './mind-map-line-style.css';

type MindMapLineStyle = 'solid' | 'dashed' | 'dotted' | 'arrow-forward' | 'arrow-backward' | 'arrow-both';
type LineRules = Record<string, MindMapLineStyle>;

const STORAGE_KEY = 'empyrean-v2-mind-map-line-rules';
const SVG_NS = 'http://www.w3.org/2000/svg';
const validStyles = new Set<MindMapLineStyle>(['solid', 'dashed', 'dotted', 'arrow-forward', 'arrow-backward', 'arrow-both']);
const styleOptions: Array<[MindMapLineStyle, string]> = [
  ['solid', 'Solid'],
  ['dashed', 'Dashed'],
  ['dotted', 'Dotted'],
  ['arrow-forward', 'Arrow →'],
  ['arrow-backward', 'Arrow ←'],
  ['arrow-both', 'Arrows ↔'],
];
let rules: LineRules = readRules();
let scheduled = false;

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function readRules(): LineRules {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, MindMapLineStyle] => typeof entry[1] === 'string' && validStyles.has(entry[1] as MindMapLineStyle)));
  } catch {
    return {};
  }
}

function saveRule(label: string, style: MindMapLineStyle) {
  const key = normalizeLabel(label);
  if (!key) return;
  if (style === 'solid') delete rules[key];
  else rules[key] = style;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)); } catch { /* storage unavailable */ }
  scheduleApply();
}

function createMarker(id: string, orient: string) {
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.id = id;
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', orient);
  marker.setAttribute('markerUnits', 'strokeWidth');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill', 'context-stroke');
  marker.appendChild(path);
  return marker;
}

function ensureMarkers(svg: SVGSVGElement) {
  let defs = svg.querySelector<SVGDefsElement>('defs[data-mind-map-line-markers]');
  if (defs) return;
  defs = document.createElementNS(SVG_NS, 'defs');
  defs.dataset.mindMapLineMarkers = 'true';
  defs.append(createMarker('mind-map-arrow-end', 'auto'));
  defs.append(createMarker('mind-map-arrow-start', 'auto-start-reverse'));
  svg.prepend(defs);
}

function visibleLabels(page: HTMLElement) {
  const labels = new Map<string, string>();
  page.querySelectorAll<SVGGElement>('.mind-map-edge').forEach((group) => {
    const display = group.querySelector('text')?.textContent?.trim() || '';
    const key = normalizeLabel(display);
    if (key && !labels.has(key)) labels.set(key, display);
  });
  return [...labels.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function makeSelect(label: string) {
  const select = document.createElement('select');
  styleOptions.forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });
  select.value = rules[normalizeLabel(label)] || 'solid';
  select.setAttribute('aria-label', `Line style for ${label}`);
  select.addEventListener('change', () => saveRule(label, select.value as MindMapLineStyle));
  return select;
}

function ensureControl(page: HTMLElement) {
  const toolbar = page.querySelector<HTMLElement>('.mind-map-toolbar');
  if (!toolbar) return;
  let details = toolbar.querySelector<HTMLDetailsElement>('[data-mind-map-line-rules]');
  if (!details) {
    details = document.createElement('details');
    details.className = 'mind-map-line-rules';
    details.dataset.mindMapLineRules = 'true';
    const summary = document.createElement('summary');
    summary.textContent = 'Line rules';
    details.appendChild(summary);
    const panel = document.createElement('div');
    panel.className = 'mind-map-line-rules-panel';
    details.appendChild(panel);
    toolbar.appendChild(details);
  }

  const panel = details.querySelector<HTMLElement>('.mind-map-line-rules-panel');
  if (!panel) return;
  const labels = visibleLabels(page);
  const signature = labels.map(([key]) => key).join('|');
  if (panel.dataset.signature === signature) {
    panel.querySelectorAll<HTMLSelectElement>('select[data-label-key]').forEach((select) => {
      select.value = rules[select.dataset.labelKey || ''] || 'solid';
    });
    return;
  }

  const wasOpen = details.open;
  panel.dataset.signature = signature;
  panel.replaceChildren();
  const intro = document.createElement('p');
  intro.textContent = 'Assign one style to every visible connection with the same label.';
  panel.appendChild(intro);
  if (!labels.length) {
    const empty = document.createElement('span');
    empty.textContent = 'No visible connection labels.';
    panel.appendChild(empty);
  }
  labels.forEach(([key, display]) => {
    const row = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = display;
    const select = makeSelect(display);
    select.dataset.labelKey = key;
    row.append(text, select);
    panel.appendChild(row);
  });
  details.open = wasOpen;
}

function applyGroupStyle(group: SVGGElement) {
  const label = group.querySelector('text')?.textContent || '';
  const style = rules[normalizeLabel(label)] || 'solid';
  group.dataset.lineStyle = style;
  const line = group.querySelector<SVGLineElement>('line:not(.mind-map-edge-hit)');
  if (!line) return;
  line.removeAttribute('marker-start');
  line.removeAttribute('marker-end');
  if (style === 'arrow-forward' || style === 'arrow-both') line.setAttribute('marker-end', 'url(#mind-map-arrow-end)');
  if (style === 'arrow-backward' || style === 'arrow-both') line.setAttribute('marker-start', 'url(#mind-map-arrow-start)');
}

function applyLineRules() {
  scheduled = false;
  const page = document.querySelector<HTMLElement>('.mind-map-page--enhanced');
  if (!page) return;
  ensureControl(page);
  page.querySelectorAll<SVGSVGElement>('svg.mind-map-edges').forEach((svg) => {
    ensureMarkers(svg);
    svg.querySelectorAll<SVGGElement>('.mind-map-edge').forEach(applyGroupStyle);
  });
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(applyLineRules);
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node instanceof Element && (node.matches('.mind-map-page--enhanced, .mind-map-edge, .mind-map-toolbar, .mind-map-inspector') || Boolean(node.querySelector('.mind-map-page--enhanced, .mind-map-edge, .mind-map-toolbar, .mind-map-inspector')))));
  if (relevant) scheduleApply();
});

function start() {
  scheduleApply();
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    rules = readRules();
    scheduleApply();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
