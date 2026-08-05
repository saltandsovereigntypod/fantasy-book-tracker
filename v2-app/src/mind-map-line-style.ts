type MindMapLineStyle = 'solid' | 'dashed' | 'dotted' | 'arrow-forward' | 'arrow-backward' | 'arrow-both';

const STORAGE_KEY = 'empyrean-v2-mind-map-line-style';
const SVG_NS = 'http://www.w3.org/2000/svg';
const validStyles = new Set<MindMapLineStyle>(['solid', 'dashed', 'dotted', 'arrow-forward', 'arrow-backward', 'arrow-both']);
let style: MindMapLineStyle = readStyle();
let scheduled = false;

function readStyle(): MindMapLineStyle {
  try {
    const value = localStorage.getItem(STORAGE_KEY) as MindMapLineStyle | null;
    return value && validStyles.has(value) ? value : 'solid';
  } catch {
    return 'solid';
  }
}

function saveStyle(next: MindMapLineStyle) {
  style = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
  applyLineStyle();
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

function ensureControl(page: HTMLElement) {
  const toolbar = page.querySelector<HTMLElement>('.mind-map-toolbar');
  if (!toolbar || toolbar.querySelector('[data-mind-map-line-style-control]')) return;
  const label = document.createElement('label');
  label.className = 'mind-map-line-style-control';
  label.dataset.mindMapLineStyleControl = 'true';
  label.append('Map lines');
  const select = document.createElement('select');
  const options: Array<[MindMapLineStyle, string]> = [
    ['solid', 'Solid'],
    ['dashed', 'Dashed'],
    ['dotted', 'Dotted'],
    ['arrow-forward', 'Arrow →'],
    ['arrow-backward', 'Arrow ←'],
    ['arrow-both', 'Arrows ↔'],
  ];
  options.forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });
  select.value = style;
  select.addEventListener('change', () => saveStyle(select.value as MindMapLineStyle));
  label.appendChild(select);
  toolbar.appendChild(label);
}

function applyLineStyle() {
  scheduled = false;
  const page = document.querySelector<HTMLElement>('.mind-map-page--enhanced');
  if (!page) return;
  page.dataset.mapLineStyle = style;
  ensureControl(page);
  page.querySelectorAll<SVGSVGElement>('svg.mind-map-edges').forEach((svg) => {
    ensureMarkers(svg);
    svg.querySelectorAll<SVGGElement>('.mind-map-edge.is-map').forEach((group) => {
      const line = group.querySelector<SVGLineElement>('line:not(.mind-map-edge-hit)');
      if (!line) return;
      line.removeAttribute('marker-start');
      line.removeAttribute('marker-end');
      if (style === 'arrow-forward' || style === 'arrow-both') line.setAttribute('marker-end', 'url(#mind-map-arrow-end)');
      if (style === 'arrow-backward' || style === 'arrow-both') line.setAttribute('marker-start', 'url(#mind-map-arrow-start)');
    });
  });
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(applyLineStyle);
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node instanceof Element && (node.matches('.mind-map-page--enhanced, .mind-map-edge, .mind-map-toolbar') || Boolean(node.querySelector('.mind-map-page--enhanced, .mind-map-edge, .mind-map-toolbar')))));
  if (relevant) scheduleApply();
});

function start() {
  scheduleApply();
  const root = document.getElementById('root');
  if (root) observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    style = readStyle();
    scheduleApply();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
