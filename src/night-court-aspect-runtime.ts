import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import { prythianRankIndex, type UniverseProfiles } from './universes';

type NightAspect = 'dreams' | 'nightmares';
type PrythianWithAspect = UniverseProfiles['prythian'] & { nightAspect?: NightAspect };
type ArchiveWithUniverses = V2ArchiveState & { universes?: UniverseProfiles & { prythian: PrythianWithAspect } };

const HOST_ID = 'night-court-aspect-runtime';
const INNER_CIRCLE_INDEX = 4;
let currentArchive: ArchiveWithUniverses | null = null;
let queued = false;

function applyAspect(aspect: NightAspect) {
  document.documentElement.dataset.nightAspect = aspect;
  document.body.dataset.nightAspect = aspect;
}

function clearAspect() {
  delete document.documentElement.dataset.nightAspect;
  delete document.body.dataset.nightAspect;
}

function readLocal(): ArchiveWithUniverses | null {
  try {
    const raw = localStorage.getItem('empyrean-v2-archive');
    return raw ? JSON.parse(raw) as ArchiveWithUniverses : null;
  } catch {
    return null;
  }
}

async function loadArchive() {
  const local = readLocal();
  if (local) currentArchive = local;
  try {
    const { user } = await getAuthSnapshot();
    if (user) currentArchive = await loadCloudArchive(user) as ArchiveWithUniverses;
  } catch {
    // Local state remains authoritative until cloud access returns.
  }
  render();
}

async function saveAspect(aspect: NightAspect) {
  if (!currentArchive?.universes) return;
  const next: ArchiveWithUniverses = {
    ...currentArchive,
    universes: {
      ...currentArchive.universes,
      prythian: { ...currentArchive.universes.prythian, nightAspect: aspect },
    },
    updatedAt: new Date().toISOString(),
  };
  currentArchive = next;
  saveLocalArchive(next);
  applyAspect(aspect);
  try {
    const { user } = await getAuthSnapshot();
    if (user) await saveCloudArchive(user, next);
  } catch {
    // The local selection is preserved and will sync on the next archive save.
  }
  render();
}

function ensureHost(profile: HTMLElement): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('section');
    host.id = HOST_ID;
    host.className = 'night-court-aspect-panel';
  }
  if (host.parentElement !== profile) {
    const universePanel = profile.querySelector('#prythian-universe-runtime');
    universePanel?.insertAdjacentElement('afterend', host);
    if (!host.parentElement) profile.prepend(host);
  }
  return host;
}

function render() {
  const archive = currentArchive ?? readLocal();
  const universes = archive?.universes;
  const profile = document.querySelector<HTMLElement>('.v2-view--profile');
  const isNightCourt = universes?.activeUniverse === 'prythian' && universes.prythian.court === 'night';

  if (!isNightCourt) {
    clearAspect();
    document.getElementById(HOST_ID)?.remove();
    return;
  }

  const points = Number(archive?.profile?.points ?? universes.prythian.points ?? 0);
  const rankIndex = prythianRankIndex(points);
  const unlocked = rankIndex >= INNER_CIRCLE_INDEX;
  const selected: NightAspect = unlocked && universes.prythian.nightAspect === 'nightmares' ? 'nightmares' : 'dreams';
  applyAspect(selected);

  if (!profile) return;
  const host = ensureHost(profile);
  host.innerHTML = unlocked
    ? `<div><p>Night Court aspect</p><h2>Choose the face of the Night Court</h2><span>Your standing, gifts, books, and progress remain unchanged.</span></div><label>Aspect<select aria-label="Night Court aspect"><option value="dreams"${selected === 'dreams' ? ' selected' : ''}>Court of Dreams</option><option value="nightmares"${selected === 'nightmares' ? ' selected' : ''}>Court of Nightmares</option></select></label>`
    : `<div><p>Night Court prestige</p><h2>Court of Nightmares</h2><span>Reach Inner Circle to unlock the Night Court's public-facing court and its darker ceremonial atmosphere.</span></div><strong>Locked until Inner Circle</strong>`;

  const select = host.querySelector<HTMLSelectElement>('select');
  if (select) select.onchange = () => void saveAspect(select.value as NightAspect);
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render();
  });
}

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-universe', 'data-court'] });
window.addEventListener('storage', () => { currentArchive = readLocal(); schedule(); });
window.addEventListener('prythian-assessment-complete', () => void loadArchive());
void loadArchive();
