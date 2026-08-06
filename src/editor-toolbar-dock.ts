type ToolbarSource = HTMLButtonElement | HTMLSelectElement;

function sourceLabel(source: ToolbarSource): string {
  return source.getAttribute('aria-label') || source.getAttribute('title') || source.textContent?.trim() || 'Option';
}

function closeToolbarMenus(except?: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>('.editor-toolbar-menu[open]').forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

function createProxyButton(source: ToolbarSource, menu: HTMLDetailsElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `editor-toolbar-menu-option${source instanceof HTMLButtonElement && source.classList.contains('is-active') ? ' is-active' : ''}`;
  button.disabled = source instanceof HTMLButtonElement && source.disabled;
  button.textContent = sourceLabel(source);
  button.addEventListener('click', () => {
    if (source instanceof HTMLButtonElement) source.click();
    menu.open = false;
  });
  return button;
}

function createSelectOptions(source: HTMLSelectElement, menu: HTMLDetailsElement): HTMLElement[] {
  return Array.from(source.options).map((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `editor-toolbar-menu-option${option.value === source.value ? ' is-active' : ''}`;
    button.textContent = option.textContent || option.value;
    button.addEventListener('click', () => {
      source.value = option.value;
      source.dispatchEvent(new Event('change', { bubbles: true }));
      menu.open = false;
    });
    return button;
  });
}

function createMenu(label: string, sources: ToolbarSource[], className = ''): HTMLDetailsElement | null {
  if (!sources.length) return null;
  const menu = document.createElement('details');
  menu.className = `editor-toolbar-menu ${className}`.trim();
  const summary = document.createElement('summary');
  summary.textContent = label;
  menu.appendChild(summary);
  const panel = document.createElement('div');
  panel.className = 'editor-toolbar-menu-panel';
  sources.forEach((source) => {
    source.classList.add('is-toolbar-source-hidden');
    if (source instanceof HTMLSelectElement) panel.append(...createSelectOptions(source, menu));
    else panel.appendChild(createProxyButton(source, menu));
  });
  menu.appendChild(panel);
  menu.addEventListener('toggle', () => { if (menu.open) closeToolbarMenus(menu); });
  return menu;
}

function buttonByText(root: ParentNode, labels: string[]): HTMLButtonElement[] {
  const wanted = new Set(labels.map((label) => label.toLowerCase()));
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter((button) => wanted.has((button.textContent || '').trim().toLowerCase()));
}

function buildPositionMenu(group: HTMLElement): HTMLDetailsElement | null {
  const sources: HTMLButtonElement[] = [];
  const inspector = document.querySelector<HTMLElement>('.inspector-panel');
  if (inspector) {
    sources.push(...buttonByText(inspector, ['Left', 'Center X', 'Right', 'Top', 'Center Y', 'Bottom', 'To back', 'Backward', 'Forward', 'To front']));
  }
  if (group.classList.contains('selection-toolbar-group')) {
    sources.push(...Array.from(group.querySelectorAll<HTMLButtonElement>('button[title*="Align"], button[title*="Distribute"]')));
  }
  return createMenu('Position & layer', Array.from(new Set(sources)), 'is-position-menu');
}

function compressToolbar(toolbar: HTMLElement) {
  const group = toolbar.querySelector<HTMLElement>('.object-toolbar-group, .selection-toolbar-group');
  if (!group || group.dataset.compressedToolbar === 'true') return;
  group.dataset.compressedToolbar = 'true';

  const menus: HTMLDetailsElement[] = [];
  const textStyleSources = buttonByText(group, ['B', 'I', 'U', 'S']);
  const textStyleMenu = createMenu('Text style', textStyleSources, 'is-text-style-menu');
  if (textStyleMenu) menus.push(textStyleMenu);

  const alignment = group.querySelector<HTMLSelectElement>('select[aria-label="Text alignment"]');
  const alignmentMenu = alignment ? createMenu('Alignment', [alignment], 'is-alignment-menu') : null;
  if (alignmentMenu) menus.push(alignmentMenu);

  const flipMenu = createMenu('Flip', buttonByText(group, ['Flip H', 'Flip V']), 'is-flip-menu');
  if (flipMenu) menus.push(flipMenu);

  const positionMenu = buildPositionMenu(group);
  if (positionMenu) menus.push(positionMenu);

  const firstUtility = Array.from(group.children).find((child) => child instanceof HTMLElement && (child.classList.contains('toolbar-opacity') || child.textContent?.trim() === 'Lock'));
  menus.forEach((menu) => group.insertBefore(menu, firstUtility || null));
}

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
    compressToolbar(toolbar);
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
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node;
    if (!document.querySelector('.editor-toolbar-menu')?.contains(target)) closeToolbarMenus();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startToolbarDock, { once: true });
else startToolbarDock();
