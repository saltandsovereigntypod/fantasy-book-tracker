const PATH_ORDER = ['rider', 'scribe', 'gryphon', 'dark', 'infantry', 'healer'] as const;

type PathId = typeof PATH_ORDER[number];

function previewPath(path: PathId) {
  document.documentElement.dataset.path = path;
  document.body.dataset.path = path;
  document.querySelector<HTMLElement>('.core-path-app')?.setAttribute('data-path', path);
}

function pathFromButton(button: HTMLButtonElement): PathId | null {
  const picker = button.closest('.core-path-picker');
  if (!picker) return null;
  const buttons = [...picker.querySelectorAll<HTMLButtonElement>('button')];
  const index = buttons.indexOf(button);
  return PATH_ORDER[index] ?? null;
}

// React remains the source of truth for the archive. This capture-phase preview
// only changes the document palette immediately, while the normal click handler
// updates React state and persists the selected path to Supabase.
document.addEventListener('pointerdown', (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('.core-path-picker button');
  if (!button || button.disabled) return;
  const path = pathFromButton(button);
  if (path) previewPath(path);
}, true);
