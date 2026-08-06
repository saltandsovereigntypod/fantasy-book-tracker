type WallCardDisplayPreferences = {
  category: boolean;
  summary: boolean;
  counts: boolean;
  footer: boolean;
};

const STORAGE_KEY = 'empyrean-v2-wall-card-display';
const DEFAULTS: WallCardDisplayPreferences = {
  category: true,
  summary: true,
  counts: true,
  footer: true,
};

let activeCardId = '';

function readPreferences(): Record<string, WallCardDisplayPreferences> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePreferences(cardId: string, preferences: WallCardDisplayPreferences) {
  try {
    const all = readPreferences();
    all[cardId] = preferences;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Local storage can be unavailable in hardened browsing modes.
  }
}

function preferencesFor(cardId: string): WallCardDisplayPreferences {
  return { ...DEFAULTS, ...(readPreferences()[cardId] || {}) };
}

function applyPreferences(card: HTMLElement) {
  const cardId = card.dataset.wallCardId;
  if (!cardId) return;
  const preferences = preferencesFor(cardId);
  card.classList.toggle('wall-card-hide-category', !preferences.category);
  card.classList.toggle('wall-card-hide-summary', !preferences.summary);
  card.classList.toggle('wall-card-hide-counts', !preferences.counts);
  card.classList.toggle('wall-card-hide-footer', !preferences.footer);
}

function applyAllPreferences() {
  document.querySelectorAll<HTMLElement>('[data-wall-card-id]').forEach(applyPreferences);
}

function createToggle(
  label: string,
  key: keyof WallCardDisplayPreferences,
  preferences: WallCardDisplayPreferences,
  cardId: string,
) {
  const wrapper = document.createElement('label');
  wrapper.className = 'wall-display-toggle';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = preferences[key];
  checkbox.addEventListener('change', () => {
    const next = { ...preferencesFor(cardId), [key]: checkbox.checked };
    writePreferences(cardId, next);
    document
      .querySelectorAll<HTMLElement>(`[data-wall-card-id="${CSS.escape(cardId)}"]`)
      .forEach(applyPreferences);
  });

  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(checkbox, text);
  return wrapper;
}

function enhanceInspector() {
  const modal = document.querySelector<HTMLElement>('.wall-modal-backdrop > .wall-dossier-modal');
  if (!modal || !activeCardId) return;

  const backdrop = modal.parentElement;
  backdrop?.classList.add('wall-side-inspector-backdrop');
  modal.classList.add('wall-side-inspector');

  let settings = modal.querySelector<HTMLElement>('.wall-card-display-settings');
  if (!settings) {
    settings = document.createElement('section');
    settings.className = 'wall-card-display-settings';
    const content = modal.querySelector<HTMLElement>('.wall-dossier-content');
    content?.appendChild(settings);
  }

  if (!settings || settings.dataset.cardId === activeCardId) return;
  settings.dataset.cardId = activeCardId;
  settings.replaceChildren();

  const heading = document.createElement('div');
  heading.className = 'wall-card-display-heading';
  heading.innerHTML = '<div><strong>Card display</strong><span>Choose what this placement shows on the Wall. The title always remains visible.</span></div>';

  const controls = document.createElement('div');
  controls.className = 'wall-card-display-controls';
  const preferences = preferencesFor(activeCardId);
  controls.append(
    createToggle('Category', 'category', preferences, activeCardId),
    createToggle('One-line summary', 'summary', preferences, activeCardId),
    createToggle('Connection counts', 'counts', preferences, activeCardId),
    createToggle('Status footer', 'footer', preferences, activeCardId),
  );

  settings.append(heading, controls);
}

function handleCardPointer(event: Event) {
  const target = event.target as HTMLElement | null;
  const card = target?.closest<HTMLElement>('[data-wall-card-id]');
  if (!card?.dataset.wallCardId) return;
  activeCardId = card.dataset.wallCardId;
}

function refreshEnhancements() {
  applyAllPreferences();
  enhanceInspector();
}

document.addEventListener('pointerdown', handleCardPointer, true);
document.addEventListener('click', handleCardPointer, true);

const observer = new MutationObserver(refreshEnhancements);
observer.observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refreshEnhancements, { once: true });
} else {
  refreshEnhancements();
}
