const ADD_LABELS = new Set([
  'Add New Chronicle',
  'Assign New Campaign',
  'Catalogue New Volume',
  'Seize Another Story',
  'Choose Another World',
  'Assign Objective',
  'Open New Case',
]);

function findExistingAddButton(): HTMLButtonElement | null {
  const library = document.querySelector('.v2-view--library');
  if (!library) return null;
  return Array.from(library.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => ADD_LABELS.has((button.textContent || '').trim())) ?? null;
}

function syncQuickAdd(): void {
  const launcher = document.querySelector<HTMLButtonElement>('.card-theme-library-launcher.is-library');
  let button = document.querySelector<HTMLButtonElement>('[data-library-quick-add]');

  if (!launcher) {
    button?.remove();
    return;
  }

  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.libraryQuickAdd = 'true';
    button.className = 'library-quick-add-button';
    button.textContent = '+';
    button.title = 'Add a new book or card';
    button.setAttribute('aria-label', 'Add a new book or card');
    button.addEventListener('click', () => {
      const existing = findExistingAddButton();
      if (existing) {
        existing.click();
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(button);
  }

  const rect = launcher.getBoundingClientRect();
  const right = Math.max(12, window.innerWidth - rect.left + 8);
  button.style.right = `${right}px`;
  button.style.bottom = `${Math.max(12, window.innerHeight - rect.bottom)}px`;
}

let frame = 0;
function scheduleSync(): void {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    syncQuickAdd();
  });
}

function start(): void {
  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', scheduleSync);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();