const SIZE_KEY = 'empyrean-v2-library-size';

function librarySizeSelect(): HTMLSelectElement | null {
  return [...document.querySelectorAll<HTMLSelectElement>('.v2-library-controls select')]
    .find((select) => [...select.options].some((option) => option.value === 'medium' && /medium cards/i.test(option.textContent || ''))) ?? null;
}

function installExtraSmallOption() {
  const select = librarySizeSelect();
  if (!select) return;

  if (![...select.options].some((option) => option.value === 'extra-small')) {
    const option = document.createElement('option');
    option.value = 'extra-small';
    option.textContent = 'Extra small cards';
    select.insertBefore(option, select.firstElementChild);
  }

  const stored = localStorage.getItem(SIZE_KEY);
  if (stored === 'extra-small' && select.value !== 'extra-small') {
    select.value = 'extra-small';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

const observer = new MutationObserver(installExtraSmallOption);
observer.observe(document.body, { childList: true, subtree: true });
installExtraSmallOption();

export {};
