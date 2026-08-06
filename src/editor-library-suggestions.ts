type LibraryBook = { author?: string; series?: string };

const ARCHIVE_KEY = 'empyrean-v2-archive';
const AUTHOR_LIST_ID = 'editor-author-suggestions';
const SERIES_LIST_ID = 'editor-series-suggestions';

function readBooks(): LibraryBook[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { books?: LibraryBook[]; v2Archive?: { books?: LibraryBook[] } };
    const books = parsed.v2Archive?.books ?? parsed.books;
    return Array.isArray(books) ? books : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function ensureList(id: string): HTMLDataListElement {
  let list = document.getElementById(id) as HTMLDataListElement | null;
  if (!list) {
    list = document.createElement('datalist');
    list.id = id;
    document.body.appendChild(list);
  }
  return list;
}

function fillList(list: HTMLDataListElement, values: string[]) {
  list.replaceChildren(...values.map((value) => {
    const option = document.createElement('option');
    option.value = value;
    return option;
  }));
}

function inputForLabel(labelText: string): HTMLInputElement | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.field-row'));
  const row = rows.find((item) => item.querySelector('label')?.textContent?.trim().toLowerCase() === labelText.toLowerCase());
  return row?.querySelector<HTMLInputElement>('input') ?? null;
}

function applySuggestions() {
  const authorInput = inputForLabel('Author');
  const seriesInput = inputForLabel('Series');
  if (!authorInput || !seriesInput) return;

  const books = readBooks();
  const authors = unique(books.map((book) => book.author || ''));
  const allSeries = unique(books.map((book) => book.series || ''));
  const authorList = ensureList(AUTHOR_LIST_ID);
  const seriesList = ensureList(SERIES_LIST_ID);

  fillList(authorList, authors);
  authorInput.setAttribute('list', AUTHOR_LIST_ID);
  seriesInput.setAttribute('list', SERIES_LIST_ID);

  const refreshSeries = () => {
    const author = authorInput.value.trim().toLowerCase();
    const matching = author
      ? unique(books.filter((book) => (book.author || '').trim().toLowerCase() === author).map((book) => book.series || ''))
      : allSeries;
    fillList(seriesList, matching.length ? matching : allSeries);

    if (!seriesInput.value.trim() && matching.length === 1) {
      seriesInput.value = matching[0];
      seriesInput.dispatchEvent(new Event('input', { bubbles: true }));
      seriesInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  if (authorInput.dataset.librarySuggestionsBound !== 'true') {
    authorInput.dataset.librarySuggestionsBound = 'true';
    authorInput.addEventListener('input', refreshSeries);
    authorInput.addEventListener('change', refreshSeries);
    authorInput.addEventListener('blur', refreshSeries);
  }

  refreshSeries();
}

let scheduled = false;
function scheduleSuggestions() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    applySuggestions();
  });
}

const observer = new MutationObserver(scheduleSuggestions);

function start() {
  scheduleSuggestions();
  const root = document.getElementById('root');
  if (root) observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('storage', scheduleSuggestions);
  window.addEventListener('empyrean-v2-workspace-draft', scheduleSuggestions);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
