import { PRYTHIAN_RANKS, prythianRankIndex, type UniverseProfiles } from './universes';

const LOCAL_KEY = 'empyrean-v2-archive';

type StoredArchive = {
  profile?: { points?: number };
  universes?: UniverseProfiles;
};

function readArchive(): StoredArchive | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) as StoredArchive : null;
  } catch {
    return null;
  }
}

function lockedCard(article: HTMLElement, label: string, revealRank: number) {
  article.classList.add('is-reveal-locked');
  article.innerHTML = `<span>${label}</span><strong>Sealed</strong><small>Reveals at ${PRYTHIAN_RANKS[revealRank]}.</small>`;
}

function setAssessmentMessage(rankIndex: number, onboarded: boolean) {
  const heading = document.querySelector<HTMLElement>('.prythian-court-heading aside strong');
  const detail = document.querySelector<HTMLElement>('.prythian-court-heading aside small');
  if (!heading || !detail) return;

  if (!onboarded) {
    heading.textContent = 'Court placement complete';
    detail.textContent = 'Complete the court assessment now. Its results will remain sealed until each court standing is earned.';
    return;
  }

  if (rankIndex < 1) {
    heading.textContent = 'Court placement revealed';
    detail.textContent = `Your Fae role remains sealed until ${PRYTHIAN_RANKS[1]}.`;
  } else if (rankIndex < 2) {
    heading.textContent = 'Fae role revealed';
    detail.textContent = `Your primary gift remains sealed until ${PRYTHIAN_RANKS[2]}.`;
  } else if (rankIndex < 3) {
    heading.textContent = 'Primary gift revealed';
    detail.textContent = `Your rare affinity remains sealed until ${PRYTHIAN_RANKS[3]}.`;
  } else {
    heading.textContent = 'Power assessment fully revealed';
    detail.textContent = 'Your Fae role, primary gift, and rare affinity have all been recognized by the court.';
  }
}

function applyRevealGates() {
  const archive = readArchive();
  const universes = archive?.universes;
  if (!universes || universes.activeUniverse !== 'prythian') return;

  const prythian = universes.prythian;
  const points = Number(archive?.profile?.points ?? prythian.points ?? 0);
  const rankIndex = prythianRankIndex(points);
  const onboarded = Boolean(prythian.onboarded);
  setAssessmentMessage(rankIndex, onboarded);

  const summary = document.querySelector<HTMLElement>('.prythian-power-summary');
  if (!summary) return;

  const articles = Array.from(summary.querySelectorAll<HTMLElement>('article'));
  if (!articles.length) return;

  articles.forEach((article) => article.classList.remove('is-reveal-locked'));

  const role = articles[0];
  const gift = articles[1];
  let affinity = articles[2];

  if ((!onboarded || rankIndex < 1) && role) lockedCard(role, 'Fae role', 1);
  if ((!onboarded || rankIndex < 2) && gift) lockedCard(gift, 'Primary gift', 2);

  if (!affinity) {
    affinity = document.createElement('article');
    summary.appendChild(affinity);
  }

  if (!onboarded || rankIndex < 3) {
    lockedCard(affinity, 'Rare affinity', 3);
  } else if (prythian.rareAffinityName) {
    affinity.classList.remove('is-reveal-locked');
    affinity.innerHTML = `<span>Rare affinity</span><strong>${prythian.rareAffinityName}</strong>`;
  } else {
    affinity.classList.remove('is-reveal-locked');
    affinity.innerHTML = '<span>Rare affinity</span><strong>None revealed</strong><small>Your magic follows its primary court gift without a rare secondary affinity.</small>';
  }
}

let queued = false;
const schedule = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyRevealGates();
  });
};

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('storage', schedule);
window.addEventListener('prythian-assessment-complete', schedule);
schedule();
