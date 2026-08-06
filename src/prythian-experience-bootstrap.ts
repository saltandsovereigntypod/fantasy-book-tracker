import { PRYTHIAN_COURTS, type PrythianCourtId, type UniverseProfiles } from './universes';

const LOCAL_KEY = 'empyrean-v2-archive';
const COURT_ASSET_BASE = `${import.meta.env.BASE_URL}court-assets/`;

type StoredArchive = {
  universes?: UniverseProfiles;
};

function readStoredExperience(): UniverseProfiles | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const archive = JSON.parse(raw) as StoredArchive;
    return archive.universes || null;
  } catch {
    return null;
  }
}

function setCourtVariables(app: HTMLElement, courtId: PrythianCourtId) {
  const court = PRYTHIAN_COURTS[courtId];
  const values: Record<string, string> = {
    '--v2-bg': court.theme.background,
    '--v2-panel': court.theme.panel,
    '--v2-panel-raised': court.theme.panelAlt,
    '--v2-border': court.theme.border,
    '--v2-border-strong': court.theme.accent,
    '--v2-text': court.theme.text,
    '--v2-muted': court.theme.muted,
    '--v2-accent': court.theme.accent,
    '--v2-accent-bright': court.theme.accent,
    '--path-background': court.theme.background,
    '--path-panel': court.theme.panel,
    '--path-panel-alt': court.theme.panelAlt,
    '--path-surface': court.theme.surface,
    '--path-text': court.theme.text,
    '--path-muted': court.theme.muted,
    '--path-accent': court.theme.accent,
    '--path-accent-soft': court.theme.accentSoft,
    '--path-border': court.theme.border,
    '--path-paper': court.theme.paper,
  };

  Object.entries(values).forEach(([key, value]) => app.style.setProperty(key, value));
  delete app.dataset.path;
  delete document.documentElement.dataset.path;
  delete document.body.dataset.path;
}

function setDatasets(courtId: PrythianCourtId) {
  document.documentElement.dataset.universe = 'prythian';
  document.body.dataset.universe = 'prythian';
  document.documentElement.dataset.court = courtId;
  document.body.dataset.court = courtId;
}

function ensureNightCourtIdentity(sidebar: HTMLElement) {
  const brand = sidebar.querySelector<HTMLElement>('.v2-brand');
  if (brand) {
    brand.classList.add('court-brand');
    const existingImage = brand.querySelector<HTMLImageElement>('.court-profile-image');
    if (!existingImage) {
      const image = document.createElement('img');
      image.className = 'court-profile-image';
      image.src = `${COURT_ASSET_BASE}night-court-profile.png`;
      image.alt = 'Night Court mountain emblem';
      image.addEventListener('error', () => image.remove(), { once: true });
      brand.prepend(image);
    }

    const small = brand.querySelector<HTMLElement>('small');
    const strong = brand.querySelector<HTMLElement>('strong');
    if (small) small.textContent = 'The Prythian Archive';
    if (strong) strong.textContent = '✦ Night Court';
  }

  if (!sidebar.querySelector('.night-court-quotes')) {
    const quotes = document.createElement('aside');
    quotes.className = 'night-court-quotes';
    quotes.innerHTML = '<blockquote>“To the stars who listen and the dreams that are answered.”</blockquote><blockquote>“I am the rock against which the surf crashes. Nothing can break me.”</blockquote>';
    const footer = sidebar.querySelector('.v2-sidebar-footer');
    if (footer) footer.prepend(quotes);
    else sidebar.append(quotes);
  }
}

function updatePrythianCopy(courtId: PrythianCourtId) {
  const court = PRYTHIAN_COURTS[courtId];
  const brand = document.querySelector<HTMLElement>('.v2-brand strong');
  if (brand) brand.textContent = `${court.glyph} ${court.name}`;

  const small = document.querySelector<HTMLElement>('.v2-brand small');
  if (small) small.textContent = 'The Prythian Archive';

  const labels = ['Court Hall', 'Chronicles', 'Whispers & Prophecies', 'Court Intrigue', 'Mind Map', 'Court Record'];
  document.querySelectorAll<HTMLButtonElement>('.v2-app-sidebar nav button').forEach((button, index) => {
    const icon = button.querySelector('span')?.textContent || '';
    const desired = labels[index];
    if (!desired || button.textContent?.includes(desired)) return;
    button.textContent = '';
    const span = document.createElement('span');
    span.textContent = icon;
    button.append(span, document.createTextNode(desired));
  });

  const heading = document.querySelector<HTMLElement>('.prythian-court-heading aside strong');
  const detail = document.querySelector<HTMLElement>('.prythian-court-heading aside small');
  const profiles = readStoredExperience();
  const complete = Boolean(profiles?.prythian?.onboarded || profiles?.prythian?.primaryPowerName || profiles?.prythian?.rareAffinityName);
  if (heading && detail) {
    heading.textContent = complete ? 'Power assessment complete' : 'Power assessment awaiting you';
    detail.textContent = complete
      ? 'Your Fae role, primary gift, and any rare affinity have been revealed below.'
      : 'Complete the court questionnaire to reveal your Fae role, primary gift, and rare affinity.';
  }

  const sidebar = document.querySelector<HTMLElement>('.v2-app-sidebar');
  if (courtId === 'night' && sidebar) ensureNightCourtIdentity(sidebar);
  else document.querySelector('.night-court-quotes')?.remove();
}

function applyStoredExperience() {
  const profiles = readStoredExperience();
  if (!profiles || profiles.activeUniverse !== 'prythian') return;
  const courtId = profiles.prythian.court || 'night';
  setDatasets(courtId);

  const app = document.querySelector<HTMLElement>('.core-path-app');
  if (app) setCourtVariables(app, courtId);
  updatePrythianCopy(courtId);
}

const initial = readStoredExperience();
if (initial?.activeUniverse === 'prythian') {
  setDatasets(initial.prythian.court || 'night');
}

let queued = false;
const refresh = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyStoredExperience();
  });
};

const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('storage', refresh);
window.addEventListener('empyrean-universe-changed', refresh as EventListener);
refresh();
