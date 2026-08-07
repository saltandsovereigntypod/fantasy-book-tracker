import './recent-colors-runtime.css';

const STORAGE_KEY = 'empyrean-v2-recent-colors';
const MAX_COLORS = 12;

function normalizeColor(value: string): string | null {
  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}

function readColors(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).map(normalizeColor).filter((value): value is string => Boolean(value)).slice(0, MAX_COLORS) : [];
  } catch {
    return [];
  }
}

function writeColors(colors: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors.slice(0, MAX_COLORS)));
}

function rememberColor(value: string) {
  const color = normalizeColor(value);
  if (!color) return;
  const next = [color, ...readColors().filter((item) => item !== color)].slice(0, MAX_COLORS);
  writeColors(next);
  renderAll();
}

function applyColor(input: HTMLInputElement, color: string) {
  input.value = color;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  rememberColor(color);
}

function makeRecentRow(input: HTMLInputElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'recent-colors-row';
  row.dataset.recentColorsFor = input.id || input.name || 'color';

  const label = document.createElement('span');
  label.textContent = 'Recently used';
  row.appendChild(label);

  const swatches = document.createElement('div');
  swatches.className = 'recent-colors-swatches';
  const colors = readColors();
  colors.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-color-swatch';
    button.title = color;
    button.setAttribute('aria-label', `Use recent color ${color}`);
    button.style.background = color;
    button.addEventListener('click', () => applyColor(input, color));
    swatches.appendChild(button);
  });

  if (!colors.length) {
    const empty = document.createElement('small');
    empty.textContent = 'Colors you choose will appear here.';
    swatches.appendChild(empty);
  }

  row.appendChild(swatches);
  return row;
}

function enhanceInput(input: HTMLInputElement) {
  if (input.dataset.recentColorsReady === 'true') return;
  input.dataset.recentColorsReady = 'true';
  input.addEventListener('input', () => rememberColor(input.value));
  input.addEventListener('change', () => rememberColor(input.value));

  const parent = input.closest('label') || input.parentElement;
  if (!parent) return;
  parent.appendChild(makeRecentRow(input));
}

function renderAll() {
  document.querySelectorAll<HTMLElement>('.recent-colors-row').forEach((row) => row.remove());
  document.querySelectorAll<HTMLInputElement>('.v2-view--editor input[type="color"], .app-shell input[type="color"]').forEach((input) => {
    input.dataset.recentColorsReady = 'false';
    enhanceInput(input);
  });
}

let queued = false;
function scheduleRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    document.querySelectorAll<HTMLInputElement>('.v2-view--editor input[type="color"], .app-shell input[type="color"]').forEach(enhanceInput);
  });
}

function start() {
  scheduleRender();
  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
