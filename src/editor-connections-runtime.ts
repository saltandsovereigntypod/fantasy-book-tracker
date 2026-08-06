import { loadLocalArchive } from './archive';
import { loadWorkspaceDraft, saveWorkspaceDraft } from './library';
import type { BookRecord } from './domain';

type ConnectionKind = 'mindMapNodeIds' | 'wallCardIds' | 'theoryIds' | 'suspicionIds';
type Option = { id: string; title: string; detail: string };

type UnknownRecord = Record<string, unknown>;

const CONFIG: Array<{ title: string; action: string; field: ConnectionKind }> = [
  { title: 'Mind Map', action: 'Link nodes', field: 'mindMapNodeIds' },
  { title: 'Conspiracy Wall', action: 'Link cards', field: 'wallCardIds' },
  { title: 'Theories', action: 'Link theories', field: 'theoryIds' },
  { title: 'Suspicions', action: 'Link suspicions', field: 'suspicionIds' },
];

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function recordId(value: unknown): string {
  return isRecord(value) ? text(value.id) : '';
}

function recordTitle(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  return text(value.title) || text(value.label) || text(value.name) || text(value.shortSummary) || fallback;
}

function resolveWallCardTitle(card: UnknownRecord, archive: ReturnType<typeof loadLocalArchive>): Option {
  const sourceType = text(card.sourceType, 'record');
  const sourceId = text(card.sourceId);
  const collections: Record<string, Array<UnknownRecord>> = {
    book: archive.books as unknown as Array<UnknownRecord>,
    theory: archive.theories as unknown as Array<UnknownRecord>,
    suspicion: archive.suspicions as unknown as Array<UnknownRecord>,
    dossier: archive.dossiers as unknown as Array<UnknownRecord>,
  };
  const source = collections[sourceType]?.find((item) => recordId(item) === sourceId);
  return {
    id: text(card.id),
    title: source ? recordTitle(source, `${sourceType} card`) : recordTitle(card, `${sourceType} card`),
    detail: `Conspiracy Wall · ${sourceType}`,
  };
}

function optionsFor(field: ConnectionKind): Option[] {
  const archive = loadLocalArchive();
  if (field === 'theoryIds') return archive.theories.map((item) => ({ id: item.id, title: item.title, detail: `Theory · ${item.status}` }));
  if (field === 'suspicionIds') return archive.suspicions.map((item) => ({ id: item.id, title: item.title, detail: `Suspicion · ${item.status}` }));
  if (field === 'wallCardIds') {
    const seen = new Set<string>();
    return archive.walls.flatMap((wall) => wall.cards.map((card) => resolveWallCardTitle(card as unknown as UnknownRecord, archive)))
      .filter((item) => item.id && !seen.has(item.id) && Boolean(seen.add(item.id)));
  }
  const seen = new Set<string>();
  return archive.mindMapNodes
    .filter(isRecord)
    .map((item) => ({
      id: text(item.id),
      title: recordTitle(item, 'Mind map node'),
      detail: `Mind Map${text(item.type) ? ` · ${text(item.type)}` : ''}`,
    }))
    .filter((item) => item.id && !seen.has(item.id) && Boolean(seen.add(item.id)));
}

function selectedIds(book: BookRecord, field: ConnectionKind): string[] {
  const value = book[field];
  return Array.isArray(value) ? value : [];
}

function updateCardCounts(book: BookRecord): void {
  const stack = document.querySelector<HTMLElement>('.connection-stack');
  if (!stack) return;
  CONFIG.forEach((config) => {
    const card = [...stack.querySelectorAll<HTMLElement>('.connection-card')]
      .find((item) => item.querySelector('strong')?.textContent?.trim() === config.title);
    const count = card?.querySelector('span');
    if (count) count.textContent = `${selectedIds(book, config.field).length} linked`;
  });
}

function closeDialog(): void {
  document.querySelector('#book-connection-dialog')?.remove();
}

async function openDialog(config: typeof CONFIG[number]): Promise<void> {
  closeDialog();
  const draft = await loadWorkspaceDraft();
  if (!draft) return;
  const options = optionsFor(config.field);
  const chosen = new Set(selectedIds(draft.book, config.field));

  const backdrop = document.createElement('div');
  backdrop.id = 'book-connection-dialog';
  backdrop.className = 'book-connection-backdrop';
  backdrop.innerHTML = `
    <section class="book-connection-dialog" role="dialog" aria-modal="true" aria-labelledby="book-connection-title">
      <header>
        <div><p>Book connections</p><h2 id="book-connection-title">${config.title}</h2></div>
        <button type="button" data-close aria-label="Close">×</button>
      </header>
      <input class="book-connection-search" type="search" placeholder="Search available records" />
      <div class="book-connection-options"></div>
      <footer><span>${chosen.size} selected</span><button type="button" data-save>Save connections</button></footer>
    </section>`;

  const list = backdrop.querySelector<HTMLElement>('.book-connection-options')!;
  const search = backdrop.querySelector<HTMLInputElement>('.book-connection-search')!;
  const selectedLabel = backdrop.querySelector<HTMLElement>('footer span')!;

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const visible = options.filter((item) => !query || `${item.title} ${item.detail}`.toLowerCase().includes(query));
    list.innerHTML = '';
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'book-connection-empty';
      empty.textContent = options.length ? 'No matching records.' : `No ${config.title.toLowerCase()} records exist yet.`;
      list.append(empty);
      return;
    }
    visible.forEach((item) => {
      const label = document.createElement('label');
      label.className = 'book-connection-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = chosen.has(item.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) chosen.add(item.id); else chosen.delete(item.id);
        selectedLabel.textContent = `${chosen.size} selected`;
      });
      const copy = document.createElement('span');
      copy.innerHTML = `<strong></strong><small></small>`;
      copy.querySelector('strong')!.textContent = item.title;
      copy.querySelector('small')!.textContent = item.detail;
      label.append(checkbox, copy);
      list.append(label);
    });
  };

  search.addEventListener('input', render);
  backdrop.querySelector('[data-close]')?.addEventListener('click', closeDialog);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeDialog(); });
  backdrop.querySelector('[data-save]')?.addEventListener('click', async () => {
    const nextBook = { ...draft.book, [config.field]: [...chosen] } as BookRecord;
    await saveWorkspaceDraft(nextBook, draft.design);
    updateCardCounts(nextBook);
    closeDialog();
  });

  document.body.append(backdrop);
  render();
  search.focus();
}

function ensureCards(): void {
  const stack = document.querySelector<HTMLElement>('.connection-stack');
  if (!stack) return;
  const existingTitles = new Set([...stack.querySelectorAll('strong')].map((item) => item.textContent?.trim()));
  if (!existingTitles.has('Suspicions')) {
    const section = document.createElement('section');
    section.className = 'connection-card';
    section.innerHTML = '<div><strong>Suspicions</strong><span>0 linked</span></div><button type="button">Link suspicions</button>';
    stack.append(section);
  }
  CONFIG.forEach((config) => {
    const card = [...stack.querySelectorAll<HTMLElement>('.connection-card')]
      .find((item) => item.querySelector('strong')?.textContent?.trim() === config.title);
    const button = card?.querySelector<HTMLButtonElement>('button');
    if (!button || button.dataset.connectionsReady === 'true') return;
    button.type = 'button';
    button.dataset.connectionsReady = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openDialog(config);
    });
  });
  void loadWorkspaceDraft().then((draft) => { if (draft) updateCardCounts(draft.book); });
}

const observer = new MutationObserver(ensureCards);
observer.observe(document.body, { childList: true, subtree: true });
ensureCards();
