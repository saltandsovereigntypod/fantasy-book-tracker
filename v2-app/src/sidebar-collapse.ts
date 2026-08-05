const SIDEBAR_KEY = 'empyrean-v2-sidebar-collapsed';

function applySidebarState(app: HTMLElement, collapsed: boolean) {
  app.classList.toggle('is-sidebar-collapsed', collapsed);
  const button = app.querySelector<HTMLButtonElement>('.v2-sidebar-toggle');
  if (button) {
    button.textContent = collapsed ? '›' : '‹';
    button.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-expanded', String(!collapsed));
  }
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* storage unavailable */ }
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
    button.addEventListener('click', () => applySidebarState(app, !app.classList.contains('is-sidebar-collapsed')));
    sidebar.appendChild(button);
  }

  let collapsed = false;
  try { collapsed = localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { /* storage unavailable */ }
  applySidebarState(app, collapsed);
}

const sidebarObserver = new MutationObserver(() => ensureSidebarToggle());

function startSidebarCollapse() {
  ensureSidebarToggle();
  const root = document.getElementById('root');
  if (root) sidebarObserver.observe(root, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSidebarCollapse, { once: true });
else startSidebarCollapse();
