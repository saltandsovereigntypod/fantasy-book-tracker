function ensureToolbarDock() {
  const header = document.querySelector<HTMLElement>('.app-header');
  const headerActions = header?.querySelector<HTMLElement>('.header-actions');
  if (!header || !headerActions) return;

  header.classList.add('is-context-header');
  let dock = headerActions.querySelector<HTMLElement>('.editor-context-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'editor-context-dock';
    dock.setAttribute('aria-label', 'Contextual editor controls');
    headerActions.prepend(dock);
  }

  document.querySelectorAll<HTMLElement>('.card-inline-tools').forEach((toolbar) => {
    if (!dock?.contains(toolbar)) dock?.appendChild(toolbar);
  });

  const actionToolbar = dock.querySelector('.card-action-inline-tools');
  document.body.classList.toggle('has-action-context-toolbar', Boolean(actionToolbar));

  dock.querySelectorAll<HTMLElement>('.card-inline-tools').forEach((toolbar) => {
    const isActionToolbar = toolbar.classList.contains('card-action-inline-tools');
    toolbar.hidden = Boolean(actionToolbar) && !isActionToolbar;
  });
}

const observer = new MutationObserver(() => ensureToolbarDock());

function startToolbarDock() {
  ensureToolbarDock();
  const root = document.getElementById('root');
  if (root) observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', ensureToolbarDock);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startToolbarDock, { once: true });
else startToolbarDock();
