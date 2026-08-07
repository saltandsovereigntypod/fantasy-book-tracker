import { loadLocalArchive } from './archive';

function faeRoleName(role: 'high-fae' | 'lesser-fae' | 'illyrian' | undefined): string {
  if (role === 'illyrian') return 'Illyrian';
  if (role === 'lesser-fae') return 'Lesser Fae';
  return 'High Fae';
}

function makeCard(label: string, title: string, detail?: string, description?: string): HTMLElement {
  const article = document.createElement('article');
  article.className = 'core-identity-reveal-card';
  const labelNode = document.createElement('span');
  labelNode.textContent = label;
  const titleNode = document.createElement('strong');
  titleNode.textContent = title;
  article.append(labelNode, titleNode);
  if (detail) {
    const small = document.createElement('small');
    small.textContent = detail;
    article.appendChild(small);
  }
  if (description) {
    const paragraph = document.createElement('p');
    paragraph.textContent = description;
    article.appendChild(paragraph);
  }
  return article;
}

function renderIdentity(): void {
  const profile = document.querySelector<HTMLElement>('.v2-profile.core-profile');
  if (!profile) return;
  const assignment = profile.querySelector<HTMLElement>('.core-profile-assignment');
  if (!assignment) return;

  const archive = loadLocalArchive();
  const identity = archive.profile.identityAssignments;
  if (!identity) return;

  let section = assignment.querySelector<HTMLElement>('[data-core-identity-reveals]');
  if (!section) {
    section = document.createElement('section');
    section.dataset.coreIdentityReveals = 'true';
    section.className = 'core-identity-reveals';
    const heading = document.createElement('header');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'Known from the beginning';
    const title = document.createElement('h3');
    title.textContent = 'Your identity';
    heading.append(eyebrow, title);
    section.appendChild(heading);
    const selectors = assignment.querySelector('.prythian-core-selectors');
    if (selectors?.nextSibling) assignment.insertBefore(section, selectors.nextSibling);
    else assignment.prepend(section);
  }

  const root = document.querySelector<HTMLElement>('.core-path-app');
  const universe = root?.dataset.universe || archive.universes.activeUniverse;
  const path = root?.dataset.path || archive.universes.empyrean.path || archive.profile.path;
  const court = root?.dataset.court || archive.universes.prythian.court || 'night';
  const prythianRole = archive.universes.prythian.role;
  const signature = JSON.stringify({ universe, path, court, identity, prythianRole });
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;

  section.querySelectorAll('.core-identity-reveal-grid').forEach((node) => node.remove());
  const grid = document.createElement('div');
  grid.className = 'core-identity-reveal-grid';

  if (universe === 'prythian') {
    grid.appendChild(makeCard('Fae identity', faeRoleName(prythianRole), `${court.charAt(0).toUpperCase()}${court.slice(1)} Court`));
  } else if (path === 'rider') {
    grid.appendChild(makeCard('Wing assignment', `${identity.rider.wing} Wing`, `${identity.rider.section} Section · Squad ${identity.rider.squad}`));
    if (identity.rider.dragon) {
      const dragon = identity.rider.dragon;
      grid.appendChild(makeCard('Bonded dragon', dragon.name, `${dragon.color}${dragon.tail ? ` · ${dragon.tail}` : ''}`));
    }
    if (identity.rider.signet) {
      grid.appendChild(makeCard('Signet', identity.rider.signet.name, identity.rider.signet.category, identity.rider.signet.description));
    }
  } else if (path === 'gryphon') {
    grid.appendChild(makeCard('Drift assignment', identity.gryphon.drift));
    if (identity.gryphon.gryphon) {
      grid.appendChild(makeCard('Bonded gryphon', identity.gryphon.gryphon.name, identity.gryphon.gryphon.color));
    }
    if (identity.gryphon.gift) {
      grid.appendChild(makeCard('Mindwork gift', identity.gryphon.gift.name, identity.gryphon.gift.category, identity.gryphon.gift.description));
    }
  } else if (path === 'dark') {
    const wyvern = identity.dark.wyvern;
    grid.appendChild(makeCard('Bound wyvern', wyvern.name, `${wyvern.color}${wyvern.flameColor ? ` · ${wyvern.flameColor} flame` : ''}`));
    grid.appendChild(makeCard('Dark Wielder signet', identity.dark.signet.name, identity.dark.signet.category, identity.dark.signet.description));
  } else {
    grid.appendChild(makeCard('Assignment', archive.profile.path === path ? 'Recorded' : path));
  }

  section.appendChild(grid);
}

let queued = false;
function scheduleRender(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    renderIdentity();
  });
}

function start(): void {
  scheduleRender();
  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-path', 'data-universe', 'data-court'] });
  window.addEventListener('storage', scheduleRender);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
