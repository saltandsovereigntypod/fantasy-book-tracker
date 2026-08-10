const STYLE_ID = 'harvest-ui-authority-style';

function installStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .core-path-app[data-universe="empyrean"][data-path="gryphon"]
      .rider-threshing-event[data-empyrean-bonding-event="gryphon"]:not([data-harvest-runtime="true"]) {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installStyle, { once: true });
else installStyle();
