import { pathFor } from './paths';

let queued = false;

function setText(selector: string, value: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (element && element.textContent !== value) element.textContent = value;
}

function activeViewId(): string {
  const view = document.querySelector<HTMLElement>('.v2-view');
  if (!view) return '';
  return [...view.classList].find((name) => name.startsWith('v2-view--'))?.replace('v2-view--', '') || '';
}

function applyPathCopy() {
  queued = false;
  const path = pathFor(document.body.dataset.path);
  const view = activeViewId();
  const topbar: Record<string, string> = {
    dashboard: path.copy.navDashboard,
    library: path.copy.navLibrary,
    theories: path.copy.navTheories,
    wall: path.copy.navWall,
    mindmap: 'Mind Map',
    profile: path.copy.navProfile,
  };
  if (topbar[view]) setText('.v2-topbar p', topbar[view]);

  if (view === 'dashboard') {
    setText('.v2-hero p', path.short);
    setText('.v2-hero h2', path.copy.heroTitle);
    setText('.v2-hero div > span', path.copy.heroBody);
    const buttons = document.querySelectorAll<HTMLButtonElement>('.v2-hero button');
    if (buttons[0]) buttons[0].textContent = path.copy.addBook;
    if (buttons[1]) buttons[1].textContent = `Open ${path.copy.navLibrary}`;
  }

  if (view === 'library') {
    setText('.v2-library > header h2', path.copy.navLibrary);
    const add = document.querySelector<HTMLButtonElement>('.v2-library > header button');
    if (add) add.textContent = path.copy.addBook;
  }

  if (view === 'theories') {
    setText('.investigation-module > header p', path.copy.navTheories);
    const submit = document.querySelector<HTMLButtonElement>('.investigation-form button[type="submit"]');
    if (submit) submit.textContent = path.copy.addTheory;
  }

  if (view === 'wall') {
    setText('.wall-page-header p', path.copy.navWall);
  }
}

function schedulePathCopy() {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(applyPathCopy);
}

function startPathCopyRuntime() {
  schedulePathCopy();
  const root = document.getElementById('root');
  if (root) new MutationObserver(schedulePathCopy).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  new MutationObserver(schedulePathCopy).observe(document.body, { attributes: true, attributeFilter: ['data-path'] });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPathCopyRuntime, { once: true });
else startPathCopyRuntime();