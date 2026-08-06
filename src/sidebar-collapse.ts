const SIDEBAR_KEY = 'empyrean-v2-sidebar-collapsed';

function readCollapsedState(): boolean {
  try { return localStorage.getItem(SIDEBAR_KEY) === '1'; }
  catch { return false; }
}

function applySidebarState(app: HTMLElement, collapsed: boolean, persist = true) {
  app.classList.toggle('is-sidebar-collapsed', collapsed);
  const button = app.querySelector<HTMLButtonElement>('.v2-sidebar-toggle');
  if (button) {
    const label = collapsed ? 'Expand navigation' : 'Collapse navigation';
    const glyph = collapsed ? '›' : '‹';
    if (button.textContent !== glyph) button.textContent = glyph;
    if (button.title !== label) button.title = label;
    if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
    const expanded = String(!collapsed);
    if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
  }
  if (persist) {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); }
    catch { /* storage unavailable */ }
  }
}

function ensureSidebarToggle() {
  const app = document.querySelector<HTMLElement>('.v2-full-app');
  const sidebar = app?.querySelector<HTMLElement>('.v2-app-sidebar');
  if (!app || !sidebar) return;

  let button = sidebar.querySelector<HTMLButtonElement>('.v2-sidebar-toggle');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'v2-sidebar-toggle';
    button.addEventListener('click', () => {
      applySidebarState(app, !app.classList.contains('is-sidebar-collapsed'));
    });
    sidebar.appendChild(button);
  }

  applySidebarState(app, readCollapsedState(), false);
}

let scheduled = false;
const sidebarObserver = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    ensureSidebarToggle();
  });
});

function startSidebarCollapse() {
  ensureSidebarToggle();
  const root = document.getElementById('root');
  if (root) sidebarObserver.observe(root, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSidebarCollapse, { once: true });
else startSidebarCollapse();
