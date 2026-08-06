function placeProgressionHost() {
  const host = document.getElementById('prythian-progression-runtime');
  if (!host) return;

  const profile = document.querySelector<HTMLElement>('.v2-profile.core-profile');
  if (profile) {
    const universeHost = document.getElementById('prythian-universe-runtime');
    if (universeHost?.parentElement === profile) {
      universeHost.insertAdjacentElement('afterend', host);
    } else if (host.parentElement !== profile) {
      profile.prepend(host);
    }
    host.hidden = false;
    return;
  }

  host.hidden = true;
  if (host.parentElement !== document.body) document.body.appendChild(host);
}

const observer = new MutationObserver(placeProgressionHost);
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
window.addEventListener('prythian-assessment-complete', placeProgressionHost);
window.addEventListener('prythian-universe-changed', placeProgressionHost);
placeProgressionHost();

export {};
