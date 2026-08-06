import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chooseAbility, createCreatureAssignment, type CreatureAssignment } from './assignments';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS, PATH_IDS, pathFor, rankIndexForPoints, type PathId } from './paths';
import { QUESTIONNAIRE, scoreQuestionnaire, type TraitScores } from './questionnaire';
import { getAuthSnapshot } from './supabase';
import './onboarding-runtime.css';

type AssignmentProfile = V2ArchiveState['profile'] & {
  abilityId?: string;
  abilityName?: string;
  abilityDescription?: string;
  creature?: CreatureAssignment;
  traitScores?: TraitScores;
  onboardingVersion?: number;
};

let currentArchive: V2ArchiveState | null = null;
let presentationQueued = false;
let pathChangeRunning = false;

function assignedPath(scores: TraitScores): PathId {
  const totals: Record<PathId, number> = {
    rider: scores.courage + scores.protection + scores.decisiveness + scores.power,
    scribe: scores.curiosity + scores.perception + scores.precision + scores.strategy,
    gryphon: scores.independence + scores.adaptability + scores.intuition + scores.empathy,
    dark: scores.power + scores.cunning + scores.independence + scores.intuition,
    infantry: scores.resilience + scores.discipline + scores.loyalty + scores.courage,
    healer: scores.empathy + scores.protection + scores.perception + scores.loyalty,
  };
  return (Object.entries(totals) as Array<[PathId, number]>).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function applyPathPresentation(profile: AssignmentProfile) {
  const path = pathFor(profile.path);
  const root = document.documentElement;
  Object.entries(path.theme).forEach(([key, value]) => root.style.setProperty(`--path-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value));

  root.style.setProperty('--v2-bg', path.theme.background);
  root.style.setProperty('--v2-panel', path.theme.panel);
  root.style.setProperty('--v2-panel-raised', path.theme.panelAlt);
  root.style.setProperty('--v2-border', path.theme.border);
  root.style.setProperty('--v2-border-strong', path.theme.accent);
  root.style.setProperty('--v2-text', path.theme.text);
  root.style.setProperty('--v2-muted', path.theme.muted);
  root.style.setProperty('--v2-accent', path.theme.accent);
  root.style.setProperty('--v2-accent-bright', path.theme.accent);
  root.style.setProperty('--ink', path.theme.background);
  root.style.setProperty('--panel', path.theme.panel);
  root.style.setProperty('--paper', path.theme.paper);
  root.style.setProperty('--accent', path.theme.accent);
  document.body.dataset.path = path.id;

  const replacements: Record<string, string> = {
    'Command Hall': path.copy.navDashboard,
    Library: path.copy.navLibrary,
    Theories: path.copy.navTheories,
    'Conspiracy Wall': path.copy.navWall,
    Profile: path.copy.navProfile,
  };
  document.querySelectorAll<HTMLButtonElement>('.v2-app-sidebar nav button').forEach((button) => {
    const original = button.dataset.baseLabel || button.textContent?.trim() || '';
    if (!button.dataset.baseLabel) button.dataset.baseLabel = original;
    const match = Object.keys(replacements).find((label) => original.endsWith(label));
    if (!match) return;
    const replacement = replacements[match];
    if (button.textContent?.trim().endsWith(replacement)) return;
    const icon = button.querySelector('span')?.outerHTML || '';
    button.innerHTML = `${icon}${replacement}`;
  });

  const footerSmall = document.querySelector<HTMLElement>('.v2-sidebar-footer small');
  const rank = path.ranks[rankIndexForPoints(path.id, profile.points || 0)] || path.name;
  if (footerSmall && footerSmall.textContent !== rank) footerSmall.textContent = rank;
}

function assignmentDetails(profile: AssignmentProfile) {
  const path = pathFor(profile.path);
  const rankIndex = rankIndexForPoints(path.id, profile.points || 0);
  const rank = path.ranks[rankIndex] || path.ranks[0];
  return { path, rankIndex, rank, creature: profile.creature };
}

function removeAssignmentCardsOutside(activeView: HTMLElement | null) {
  document.querySelectorAll<HTMLElement>('.v2-assignment-card').forEach((card) => {
    if (!activeView || !activeView.contains(card)) card.remove();
  });
}

function renderDashboardAssignment(profile: AssignmentProfile, view: HTMLElement) {
  let card = view.querySelector<HTMLElement>('.v2-assignment-card--dashboard');
  if (!card) {
    card = document.createElement('section');
    card.className = 'v2-assignment-card v2-assignment-card--dashboard';
    const dashboard = view.querySelector('.v2-dashboard');
    dashboard?.prepend(card);
  }
  if (!card) return;
  const { path, rank } = assignmentDetails(profile);
  const signature = JSON.stringify([path.id, rank, profile.points]);
  if (card.dataset.signature === signature) return;
  card.dataset.signature = signature;
  card.innerHTML = `<div><p>Your assignment</p><h2>${path.glyph} ${path.name}</h2></div><div class="v2-dashboard-rank"><span>${path.copy.currentRank}</span><strong>${rank}</strong><small>${profile.points || 0} points</small></div>`;
}

function rankLadderHtml(profile: AssignmentProfile) {
  const { path, rankIndex } = assignmentDetails(profile);
  return path.ranks.map((rank, index) => {
    const threshold = path.thresholds[index] || 0;
    const state = index < rankIndex ? 'is-unlocked' : index === rankIndex ? 'is-current' : 'is-locked';
    return `<li class="${state}"><span>${index + 1}</span><div><strong>${rank}</strong><small>${threshold.toLocaleString()} points</small></div><em>${index < rankIndex ? 'Unlocked' : index === rankIndex ? 'Current' : 'Locked'}</em></li>`;
  }).join('');
}

function pathSwitcherHtml(profile: AssignmentProfile) {
  return PATH_IDS.map((id) => {
    const option = PATHS[id];
    const active = id === profile.path;
    const unlockedIndex = rankIndexForPoints(id, profile.points || 0);
    return `<button type="button" data-path-choice="${id}" class="${active ? 'is-active' : ''}" ${active ? 'aria-current="true"' : ''}><span>${option.glyph}</span><strong>${option.name}</strong><small>${option.ranks[unlockedIndex]}</small></button>`;
  }).join('');
}

async function changePath(nextPath: PathId) {
  if (pathChangeRunning || !currentArchive || currentArchive.profile.path === nextPath) return;
  pathChangeRunning = true;
  document.querySelectorAll<HTMLButtonElement>('[data-path-choice]').forEach((button) => { button.disabled = true; });
  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('Your session expired. Please sign in again.');
    const currentProfile = currentArchive.profile as AssignmentProfile;
    const scores = currentProfile.traitScores;
    const seed = `${user.id}:path:${nextPath}`;
    const ability = scores ? chooseAbility(nextPath, scores, seed) : null;
    const definition = PATHS[nextPath];
    const creature = definition.creatureKind ? createCreatureAssignment(definition.creatureKind, [], seed) : undefined;
    const profile: AssignmentProfile = {
      ...currentProfile,
      path: nextPath,
      rankIndex: rankIndexForPoints(nextPath, currentProfile.points || 0),
      abilityId: ability?.id,
      abilityName: ability?.name,
      abilityDescription: ability?.description,
      creature,
    };
    const nextArchive: V2ArchiveState = { ...currentArchive, profile, updatedAt: new Date().toISOString() };
    saveLocalArchive(nextArchive);
    await saveCloudArchive(user, nextArchive);
    currentArchive = nextArchive;
    window.location.reload();
  } catch (reason) {
    pathChangeRunning = false;
    document.querySelectorAll<HTMLButtonElement>('[data-path-choice]').forEach((button) => { button.disabled = false; });
    window.alert(reason instanceof Error ? reason.message : 'Your path could not be changed.');
  }
}

function bindPathSwitcher(view: HTMLElement) {
  view.querySelectorAll<HTMLButtonElement>('[data-path-choice]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const nextPath = button.dataset.pathChoice;
      if (nextPath && PATH_IDS.includes(nextPath as PathId)) void changePath(nextPath as PathId);
    });
  });
}

function renderProfileAssignment(profile: AssignmentProfile, view: HTMLElement) {
  let card = view.querySelector<HTMLElement>('.v2-assignment-card--profile');
  if (!card) {
    card = document.createElement('section');
    card.className = 'v2-assignment-card v2-assignment-card--profile';
    view.prepend(card);
  }
  const { path, rank, creature } = assignmentDetails(profile);
  const signature = JSON.stringify([path.id, rank, profile.points, profile.abilityName, profile.abilityDescription, creature]);
  if (card.dataset.signature !== signature) {
    card.dataset.signature = signature;
    card.innerHTML = `<header><div><p>Your assignment</p><h2>${path.glyph} ${path.name}</h2></div><div class="v2-profile-rank"><span>${path.copy.currentRank}</span><strong>${rank}</strong><small>${profile.points || 0} points</small></div></header><div class="v2-assignment-grid">${profile.abilityName ? `<article><span>${path.id === 'gryphon' ? 'Mindwork gift' : 'Signet'}</span><strong>${profile.abilityName}</strong><small>${profile.abilityDescription || ''}</small></article>` : ''}${creature ? `<article><span>${creature.kind === 'dragon' ? 'Bonded dragon' : creature.kind === 'gryphon' ? 'Bonded gryphon' : 'Wyvern'}</span><strong>${creature.name}</strong><small>${creature.color}${creature.tail ? ` ${creature.tail}` : ''}</small></article>` : ''}</div><section class="v2-path-settings"><div><p>Choose your active path</p><span>Changing paths updates the theme, wording, rank display, and assignment. Your points, unlocked levels, books, theories, walls, and reading history stay untouched.</span></div><div class="v2-path-choice-grid">${pathSwitcherHtml(profile)}</div></section><section class="v2-rank-ladder"><div><p>${path.progressName} levels</p><span>Your total score unlocks ranks independently for every path.</span></div><ol>${rankLadderHtml(profile)}</ol></section>`;
  }
  bindPathSwitcher(view);
}

function renderAssignmentForCurrentView(profile: AssignmentProfile) {
  const view = document.querySelector<HTMLElement>('.v2-view');
  if (!view) return;
  const isDashboard = view.classList.contains('v2-view--dashboard');
  const isProfile = view.classList.contains('v2-view--profile');
  if (!isDashboard && !isProfile) {
    removeAssignmentCardsOutside(null);
    return;
  }
  removeAssignmentCardsOutside(view);
  if (isDashboard) renderDashboardAssignment(profile, view);
  if (isProfile) renderProfileAssignment(profile, view);
}

function syncPresentation() {
  if (!currentArchive) return;
  const profile = currentArchive.profile as AssignmentProfile;
  if (!profile.onboarded) return;
  applyPathPresentation(profile);
  renderAssignmentForCurrentView(profile);
}

function schedulePresentation() {
  if (presentationQueued) return;
  presentationQueued = true;
  window.requestAnimationFrame(() => {
    presentationQueued = false;
    syncPresentation();
  });
}

function Onboarding() {
  const [archive, setArchive] = useState<V2ArchiveState | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getAuthSnapshot().then(async ({ user }) => {
      if (!user) return;
      const next = await loadCloudArchive(user);
      currentArchive = next;
      setArchive(next);
      schedulePresentation();
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'The quadrant assessment could not load.'));
  }, []);

  const question = QUESTIONNAIRE[step];
  const progress = useMemo(() => Math.round(((step + 1) / QUESTIONNAIRE.length) * 100), [step]);
  if (!archive || archive.profile.onboarded) return null;

  async function select(answerId: string) {
    const nextAnswers = [...answers, answerId];
    if (step < QUESTIONNAIRE.length - 1) {
      setAnswers(nextAnswers);
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired. Please sign in again.');
      const scores = scoreQuestionnaire(nextAnswers);
      const path = assignedPath(scores);
      const seed = `${user.id}:${nextAnswers.join(':')}`;
      const ability = chooseAbility(path, scores, seed);
      const definition = PATHS[path];
      const creature = definition.creatureKind ? createCreatureAssignment(definition.creatureKind, [], seed) : undefined;
      const profile: AssignmentProfile = {
        ...archive.profile,
        path,
        rankIndex: rankIndexForPoints(path, archive.profile.points || 0),
        onboarded: true,
        abilityId: ability?.id,
        abilityName: ability?.name,
        abilityDescription: ability?.description,
        creature,
        traitScores: scores,
        onboardingVersion: 2,
      };
      const nextArchive: V2ArchiveState = { ...archive, profile, updatedAt: new Date().toISOString() };
      saveLocalArchive(nextArchive);
      await saveCloudArchive(user, nextArchive);
      currentArchive = nextArchive;
      setArchive(nextArchive);
      schedulePresentation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="v2-onboarding-gate" role="dialog" aria-modal="true" aria-labelledby="v2-assessment-title"><section className="v2-onboarding-card"><header><div><p>Quadrant Assessment</p><h1 id="v2-assessment-title">Where do you belong?</h1></div><strong>{step + 1} / {QUESTIONNAIRE.length}</strong></header><div className="v2-onboarding-progress"><span style={{ width: `${progress}%` }} /></div><main><p className="v2-question-context">Answer instinctively. Your result is calculated from the pattern across all twelve choices.</p><h2>{question.prompt}</h2><div className="v2-answer-list">{question.answers.map((answer) => <button key={answer.id} disabled={saving} onClick={() => select(answer.id)}>{answer.text}</button>)}</div>{error && <p className="v2-onboarding-error" role="alert">{error}</p>}</main></section></div>;
}

function startOnboardingRuntime() {
  const host = document.createElement('div');
  host.id = 'v2-onboarding-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><Onboarding /></StrictMode>);
  const observer = new MutationObserver(schedulePresentation);
  const appRoot = document.getElementById('root');
  if (appRoot) observer.observe(appRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('focus', schedulePresentation);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startOnboardingRuntime, { once: true });
else startOnboardingRuntime();