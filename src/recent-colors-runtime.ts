import './recent-colors-runtime.css';

const STORAGE_KEY = 'empyrean-v2-recent-colors';
const MAX_COLORS = 12;

type HSV = { h: number; s: number; v: number };

function normalizeColor(value: string): string | null {
  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}

function readColors(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.map(String).map(normalizeColor).filter((value): value is string => Boolean(value)).slice(0, MAX_COLORS)
      : [];
  } catch {
    return [];
  }
}

function rememberColor(value: string): void {
  const color = normalizeColor(value);
  if (!color) return;
  const next = [color, ...readColors().filter((item) => item !== color)].slice(0, MAX_COLORS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function hexToRgb(hex: string): [number, number, number] {
  const color = normalizeColor(hex) || '#000000';
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb({ h, s, v }: HSV): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0; let gp = 0; let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

function hsvToHex(hsv: HSV): string {
  return rgbToHex(...hsvToRgb(hsv));
}

const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

function setReactColor(input: HTMLInputElement, color: string, commit: boolean): void {
  const normalized = normalizeColor(color);
  if (!normalized) return;
  if (nativeValueSetter) nativeValueSetter.call(input, normalized);
  else input.value = normalized;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (commit) input.dispatchEvent(new Event('change', { bubbles: true }));
}

let activeInput: HTMLInputElement | null = null;
let popover: HTMLElement | null = null;
let hsv: HSV = { h: 0, s: 0, v: 0 };
let liveFrame = 0;
let pendingColor = '';

function closePicker(): void {
  if (liveFrame) cancelAnimationFrame(liveFrame);
  liveFrame = 0;
  pendingColor = '';
  popover?.remove();
  popover = null;
  activeInput = null;
}

function scheduleLiveColor(color: string): void {
  if (!activeInput) return;
  pendingColor = color;
  if (liveFrame) return;
  liveFrame = requestAnimationFrame(() => {
    liveFrame = 0;
    if (activeInput && pendingColor) setReactColor(activeInput, pendingColor, false);
  });
}

function commitColor(color: string): void {
  if (!activeInput) return;
  const normalized = normalizeColor(color);
  if (!normalized) return;
  setReactColor(activeInput, normalized, true);
  rememberColor(normalized);
  renderPickerContents();
}

function positionPicker(): void {
  if (!popover || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();
  const width = Math.min(330, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
  const preferredTop = rect.bottom + 8;
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.min(preferredTop, window.innerHeight - 430)}px`;
}

function renderPickerContents(): void {
  if (!popover || !activeInput) return;
  const current = hsvToHex(hsv);
  popover.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'custom-color-picker__header';
  const title = document.createElement('strong');
  title.textContent = 'Color';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close color picker');
  close.addEventListener('click', closePicker);
  header.append(title, close);
  popover.appendChild(header);

  const sv = document.createElement('div');
  sv.className = 'custom-color-picker__sv';
  sv.style.setProperty('--picker-hue', String(hsv.h));
  const marker = document.createElement('span');
  marker.className = 'custom-color-picker__marker';
  marker.style.left = `${hsv.s * 100}%`;
  marker.style.top = `${(1 - hsv.v) * 100}%`;
  sv.appendChild(marker);

  const updateFromPointer = (event: PointerEvent, commit: boolean) => {
    const rect = sv.getBoundingClientRect();
    hsv.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    hsv.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    marker.style.left = `${hsv.s * 100}%`;
    marker.style.top = `${(1 - hsv.v) * 100}%`;
    const color = hsvToHex(hsv);
    updatePreview(color);
    if (commit) commitColor(color); else scheduleLiveColor(color);
  };

  sv.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sv.setPointerCapture(event.pointerId);
    updateFromPointer(event, false);
  });
  sv.addEventListener('pointermove', (event) => {
    if (sv.hasPointerCapture(event.pointerId)) updateFromPointer(event, false);
  });
  sv.addEventListener('pointerup', (event) => {
    if (!sv.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event, true);
    sv.releasePointerCapture(event.pointerId);
  });
  sv.addEventListener('pointercancel', (event) => {
    if (sv.hasPointerCapture(event.pointerId)) sv.releasePointerCapture(event.pointerId);
  });
  popover.appendChild(sv);

  const hue = document.createElement('input');
  hue.type = 'range';
  hue.min = '0';
  hue.max = '359';
  hue.value = String(Math.round(hsv.h));
  hue.className = 'custom-color-picker__hue';
  hue.setAttribute('aria-label', 'Hue');
  hue.addEventListener('input', () => {
    hsv.h = Number(hue.value);
    sv.style.setProperty('--picker-hue', String(hsv.h));
    const color = hsvToHex(hsv);
    updatePreview(color);
    scheduleLiveColor(color);
  });
  hue.addEventListener('change', () => commitColor(hsvToHex(hsv)));
  popover.appendChild(hue);

  const valueRow = document.createElement('div');
  valueRow.className = 'custom-color-picker__value';
  const preview = document.createElement('span');
  preview.dataset.colorPreview = 'true';
  preview.style.background = current;
  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.value = current;
  hexInput.maxLength = 7;
  hexInput.setAttribute('aria-label', 'Hex color');
  hexInput.addEventListener('change', () => {
    const normalized = normalizeColor(hexInput.value);
    if (!normalized) { hexInput.value = hsvToHex(hsv); return; }
    hsv = rgbToHsv(...hexToRgb(normalized));
    commitColor(normalized);
  });
  valueRow.append(preview, hexInput);
  popover.appendChild(valueRow);

  const recentTitle = document.createElement('strong');
  recentTitle.className = 'custom-color-picker__recent-title';
  recentTitle.textContent = 'Recently used';
  popover.appendChild(recentTitle);

  const recent = document.createElement('div');
  recent.className = 'custom-color-picker__recent';
  const colors = readColors();
  colors.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'custom-color-picker__swatch';
    button.style.background = color;
    button.title = color;
    button.setAttribute('aria-label', `Use recent color ${color}`);
    button.addEventListener('click', () => {
      hsv = rgbToHsv(...hexToRgb(color));
      commitColor(color);
    });
    recent.appendChild(button);
  });
  if (!colors.length) {
    const empty = document.createElement('small');
    empty.textContent = 'Colors you finish choosing will appear here.';
    recent.appendChild(empty);
  }
  popover.appendChild(recent);

  function updatePreview(color: string): void {
    preview.style.background = color;
    hexInput.value = color;
  }
}

function openPicker(input: HTMLInputElement): void {
  closePicker();
  activeInput = input;
  hsv = rgbToHsv(...hexToRgb(input.value));
  popover = document.createElement('section');
  popover.className = 'custom-color-picker';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Color picker');
  document.body.appendChild(popover);
  renderPickerContents();
  positionPicker();
}

function enhanceInput(input: HTMLInputElement): void {
  if (input.dataset.customColorPicker === 'true') return;
  input.dataset.customColorPicker = 'true';
  input.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPicker(input);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker(input);
    }
  });
}

function scan(): void {
  document.querySelectorAll<HTMLInputElement>('.v2-view--editor input[type="color"], .app-shell input[type="color"]').forEach(enhanceInput);
}

let scanQueued = false;
function scheduleScan(): void {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

function start(): void {
  scan();
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerdown', (event) => {
    if (!popover) return;
    const target = event.target as Node | null;
    if (target && (popover.contains(target) || activeInput?.contains(target))) return;
    closePicker();
  }, true);
  window.addEventListener('resize', positionPicker);
  window.addEventListener('scroll', positionPicker, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
