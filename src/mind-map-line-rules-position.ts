let activeDetails: HTMLDetailsElement | null = null;
let scheduled = false;

function positionPanel(details: HTMLDetailsElement) {
  if (!details.open) return;
  const summary = details.querySelector<HTMLElement>('summary');
  const panel = details.querySelector<HTMLElement>('.mind-map-line-rules-panel');
  if (!summary || !panel) return;

  const anchor = summary.getBoundingClientRect();
  const margin = 12;
  const gap = 8;
  const width = Math.min(420, Math.max(280, window.innerWidth - margin * 2));
  const preferredLeft = anchor.right - width;
  const left = Math.min(window.innerWidth - width - margin, Math.max(margin, preferredLeft));
  const spaceBelow = window.innerHeight - anchor.bottom - gap - margin;
  const spaceAbove = anchor.top - gap - margin;
  const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(160, Math.min(460, openAbove ? spaceAbove : spaceBelow));
  const top = openAbove
    ? Math.max(margin, anchor.top - gap - maxHeight)
    : Math.min(window.innerHeight - margin - maxHeight, anchor.bottom + gap);

  panel.style.left = `${left}px`;
  panel.style.top = `${Math.max(margin, top)}px`;
  panel.style.width = `${width}px`;
  panel.style.maxHeight = `${maxHeight}px`;
}

function schedulePosition() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    if (activeDetails?.isConnected && activeDetails.open) positionPanel(activeDetails);
  });
}

function wireDetails(details: HTMLDetailsElement) {
  if (details.dataset.viewportPositioned === 'true') return;
  details.dataset.viewportPositioned = 'true';
  details.addEventListener('toggle', () => {
    if (details.open) {
      if (activeDetails && activeDetails !== details) activeDetails.open = false;
      activeDetails = details;
      schedulePosition();
    } else if (activeDetails === details) {
      activeDetails = null;
    }
  });
}

function scan() {
  document.querySelectorAll<HTMLDetailsElement>('[data-mind-map-line-rules]').forEach(wireDetails);
  schedulePosition();
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
    node instanceof Element && (node.matches('[data-mind-map-line-rules]') || Boolean(node.querySelector('[data-mind-map-line-rules]'))),
  ));
  if (relevant) scan();
});

function start() {
  scan();
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedulePosition);
  window.addEventListener('scroll', schedulePosition, true);
  document.addEventListener('pointerdown', (event) => {
    if (!activeDetails?.open) return;
    const target = event.target;
    if (target instanceof Node && !activeDetails.contains(target)) activeDetails.open = false;
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
