const DATABASE_NAME = 'empyrean-v2-library';

interface StoredFont {
  family: string;
  name: string;
}

function loadStoredFonts(): Promise<StoredFont[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('fonts')) {
        database.close();
        resolve([]);
        return;
      }
      const transaction = database.transaction('fonts', 'readonly');
      const fontsRequest = transaction.objectStore('fonts').getAll();
      fontsRequest.onerror = () => resolve([]);
      fontsRequest.onsuccess = () => resolve((fontsRequest.result ?? []) as StoredFont[]);
      transaction.oncomplete = () => database.close();
    };
  });
}

function installPanelToggle(panel: HTMLElement, side: 'left' | 'right') {
  if (panel.querySelector('.panel-collapse-button')) return;
  const heading = panel.querySelector<HTMLElement>('.panel-heading');
  if (!heading) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'panel-collapse-button';
  button.dataset.side = side;
  button.setAttribute('aria-label', `Collapse ${side} panel`);
  button.setAttribute('aria-expanded', 'true');
  button.textContent = side === 'left' ? '‹' : '›';

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const collapsed = panel.classList.toggle('is-collapsed');
    const workspace = panel.closest('.workspace-grid');
    workspace?.classList.toggle(`workspace-${side}-collapsed`, collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${side} panel`);
    button.textContent = collapsed
      ? (side === 'left' ? '›' : '‹')
      : (side === 'left' ? '‹' : '›');
  });

  heading.append(button);
}

function installAlignmentButtons(select: HTMLSelectElement) {
  if (select.dataset.enhancedAlignment === 'true') return;
  select.dataset.enhancedAlignment = 'true';
  select.classList.add('toolbar-alignment-select-fallback');

  const group = document.createElement('div');
  group.className = 'toolbar-alignment-buttons';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Text alignment');

  const options = [
    { value: 'left', label: 'Align left' },
    { value: 'center', label: 'Align center' },
    { value: 'right', label: 'Align right' },
  ];

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-alignment-button';
    button.dataset.align = option.value;
    button.title = option.label;
    button.setAttribute('aria-label', option.label);
    button.innerHTML = '<span></span><span></span><span></span>';
    button.classList.toggle('is-active', select.value === option.value);
    button.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      group.querySelectorAll('.toolbar-alignment-button').forEach((item) => {
        item.classList.toggle('is-active', (item as HTMLElement).dataset.align === option.value);
      });
    });
    group.append(button);
  }

  select.insertAdjacentElement('afterend', group);
}

async function relabelFontOptions() {
  const storedFonts = await loadStoredFonts();
  const labels = new Map(storedFonts.map((font) => [font.family, font.name]));
  document.querySelectorAll<HTMLSelectElement>('.toolbar-font-select').forEach((select) => {
    Array.from(select.options).forEach((option) => {
      const label = labels.get(option.value);
      if (label) option.textContent = label;
    });
  });
}

function enhanceEditor() {
  const leftPanel = document.querySelector<HTMLElement>('.book-panel');
  const rightPanel = document.querySelector<HTMLElement>('.inspector-panel');
  if (leftPanel) installPanelToggle(leftPanel, 'left');
  if (rightPanel) installPanelToggle(rightPanel, 'right');

  document.querySelectorAll<HTMLSelectElement>('select[aria-label="Text alignment"]').forEach(installAlignmentButtons);
  void relabelFontOptions();
}

let scheduled = false;
function scheduleEnhancement() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceEditor();
  });
}

const observer = new MutationObserver(scheduleEnhancement);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('empyrean-font-library-changed', scheduleEnhancement);
window.addEventListener('DOMContentLoaded', scheduleEnhancement);
scheduleEnhancement();
