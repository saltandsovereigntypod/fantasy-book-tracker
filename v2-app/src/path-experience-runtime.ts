import { chooseAbility, createCreatureAssignment, type CreatureAssignment } from './assignments';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS, PATH_IDS, pathFor, rankIndexForPoints, type PathId } from './paths';
import type { TraitScores } from './questionnaire';
import { getAuthSnapshot, supabase } from './supabase';
import './onboarding-runtime.css';

type AssignmentProfile = V2ArchiveState['profile'] & {
  abilityId?: string;
  abilityName?: string;
  abilityDescription?: string;
  creature?: CreatureAssignment;
  traitScores?: TraitScores;
  onboardingVersion?: number;
};

let archive: V2ArchiveState | null = null;
let queued = false;
let changing = false;

function setVariables(profile: AssignmentProfile) {
  const path = pathFor(profile.path);
  const root = document.documentElement;
  const vars: Record<string, string> = {
    '--path-background': path.theme.background,
    '--path-panel': path.theme.panel,
    '--path-panel-alt': path.theme.panelAlt,
    '--path-surface': path.theme.surface,
    '--path-text': path.theme.text,
    '--path-muted': path.theme.muted,
    '--path-accent': path.theme.accent,
    '--path-accent-soft': path.theme.accentSoft,
    '--path-border': path.theme.border,
    '--path-paper': path.theme.paper,
    '--v2-bg': path.theme.background,
    '--v2-panel': path.theme.panel,
    '--v2-panel-raised': path.theme.panelAlt,
    '--v2-border': path.theme.border,
    '--v2-border-strong': path.theme.accent,
    '--v2-text': path.theme.text,
    '--v2-muted': path.theme.muted,
    '--v2-accent': path.theme.accent,
    '--v2-accent-bright': path.theme.accent,
    '--ink': path.theme.background,
    '--panel': path.theme.panel,
    '--paper': path.theme.paper,
    '--accent': path.theme.accent,
  };
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  document.body.dataset.path = path.id;
}

function activeView() {
  return document.querySelector<HTMLElement>('.v2-view');
}

function setText(selector: string, value: string) {
  const node = document.querySelector<HTMLElement>(selector);
  if (node && node.textContent !== value) node.textContent = value;
}

function applyCopy(profile: AssignmentProfile) {
  const path = pathFor(profile.path);
  const navCopy: Record<string, string> = {
    dashboard: path.copy.navDashboard,
    library: path.copy.navLibrary,
    theories: path.copy.navTheories,
    wall: path.copy.navWall,
    mindmap: 'Mind Map',
    profile: path.copy.navProfile,
  };
  document.querySelectorAll<HTMLButtonElement>('.v2-app-sidebar nav button').forEach((button) => {
    const view = ['dashboard', 'library', 'theories', 'wall', 'mindmap', 'profile'].find((id) => button.classList.contains(`nav-${id}`));
    const base = button.dataset.viewId || view || '';
    if (!button.dataset.viewId) {
      const labels: Record<string, string> = { 'Command Hall': 'dashboard', Library: 'library', Theories: 'theories', 'Conspiracy Wall': 'wall', 'Mind Map': 'mindmap', Profile: 'profile' };
      const match = Object.entries(labels).find(([label]) => button.textContent?.trim().endsWith(label));
      if (match) button.dataset.viewId = match[1];
    }
    const id = button.dataset.viewId || base;
    if (!id || !navCopy[id]) return;
    const icon = button.querySelector('span')?.outerHTML || '';
    button.innerHTML = `${icon}${navCopy[id]}`;
  });

  const view = activeView();
  const id = view ? [...view.classList].find((name) => name.startsWith('v2-view--'))?.replace('v2-view--', '') : '';
  if (id && navCopy[id]) setText('.v2-topbar p', navCopy[id]);
  const rank = path.ranks[rankIndexForPoints(path.id, profile.points || 0)] || path.ranks[0];
  setText('.v2-sidebar-footer small', rank);

  if (id === 'dashboard') {
    setText('.v2-hero p', path.short);
    setText('.v2-hero h2', path.copy.heroTitle);
    setText('.v2-hero div > span', path.copy.heroBody);
    const buttons = document.querySelectorAll<HTMLButtonElement>('.v2-hero button');
    if (buttons[0]) buttons[0].textContent = path.copy.addBook;
    if (buttons[1]) buttons[1].textContent = `Open ${path.copy.navLibrary}`;
  }
  if (id === 'library') {
    setText('.v2-library > header h2', path.copy.navLibrary);
    const add = document.querySelector<HTMLButtonElement>('.v2-library > header button');
    if (add) add.textContent = path.copy.addBook;
  }
}

function rankLadder(profile: AssignmentProfile) {
  const path = pathFor(profile.path);
  const current = rankIndexForPoints(path.id, profile.points || 0);
  return path.ranks.map((rank, index) => {
    const state = index < current ? 'is-unlocked' : index === current ? 'is-current' : 'is-locked';
    const label = index < current ? 'Unlocked' : index === current ? 'Current' : 'Locked';
    return `<li class="${state}"><span>${index + 1}</span><div><strong>${rank}</strong><small>${(path.thresholds[index] || 0).toLocaleString()} points</small></div><em>${label}</em></li>`;
  }).join('');
}

function pathChoices(profile: AssignmentProfile) {
  return PATH_IDS.map((id) => {
    const path = PATHS[id];
    const currentRank = path.ranks[rankIndexForPoints(id, profile.points || 0)];
    return `<button type="button" data-v2-path="${id}" class="${id === profile.path ? 'is-active' : ''}" ${id === profile.path ? 'aria-current="true"' : ''}><span>${path.glyph}</span><strong>${path.name}</strong><small>${currentRank}</small></button>`;
  }).join('');
}

function assignmentBody(profile: AssignmentProfile, compact: boolean) {
  const path = pathFor(profile.path);
  const rank = path.ranks[rankIndexForPoints(path.id, profile.points || 0)] || path.ranks[0];
  if (compact) return `<div><p>Your assignment</p><h2>${path.glyph} ${path.name}</h2></div><div class="v2-dashboard-rank"><span>${path.copy.currentRank}</span><strong>${rank}</strong><small>${profile.points || 0} points</small></div>`;
  const creature = profile.creature;
  return `<header><div><p>Your assignment</p><h2>${path.glyph} ${path.name}</h2></div><div class="v2-profile-rank"><span>${path.copy.currentRank}</span><strong>${rank}</strong><small>${profile.points || 0} points</small></div></header><div class="v2-assignment-grid">${profile.abilityName ? `<article><span>${path.id === 'gryphon' ? 'Mindwork gift' : 'Signet'}</span><strong>${profile.abilityName}</strong><small>${profile.abilityDescription || ''}</small></article>` : ''}${creature ? `<article><span>${creature.kind === 'dragon' ? 'Bonded dragon' : creature.kind === 'gryphon' ? 'Bonded gryphon' : 'Wyvern'}</span><strong>${creature.name}</strong><small>${creature.color}${creature.tail ? ` ${creature.tail}` : ''}</small></article>` : ''}</div><section class="v2-path-settings"><div><p>Choose your active path</p><span>Your points, unlocked ranks, books, theories, walls, and reading history remain unchanged.</span></div><div class="v2-path-choice-grid">${pathChoices(profile)}</div></section><section class="v2-rank-ladder"><div><p>${path.progressName} levels</p><span>${profile.points || 0} total points</span></div><ol>${rankLadder(profile)}</ol></section>`;
}

async function changePath(nextPath: PathId) {
  if (!archive || changing || archive.profile.path === nextPath) return;
  changing = true;
  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('Your session expired. Please sign in again.');
    const current = archive.profile as AssignmentProfile;
    const seed = `${user.id}:path:${nextPath}`;
    const ability = current.traitScores ? chooseAbility(nextPath, current.traitScores, seed) : null;
    const definition = PATHS[nextPath];
    const creature = definition.creatureKind ? createCreatureAssignment(definition.creatureKind, [], seed) : undefined;
    const profile: AssignmentProfile = { ...current, path: nextPath, rankIndex: rankIndexForPoints(nextPath, current.points || 0), abilityId: ability?.id, abilityName: ability?.name, abilityDescription: ability?.description, creature };
    const next: V2ArchiveState = { ...archive, profile, updatedAt: new Date().toISOString() };
    saveLocalArchive(next);
    await saveCloudArchive(user, next);
    archive = next;
    render();
    window.location.reload();
  } catch (error) {
    changing = false;
    window.alert(error instanceof Error ? error.message : 'Your path could not be changed.');
  }
}

function bindChoices(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('[data-v2-path]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const value = button.dataset.v2Path as PathId | undefined;
      if (value && PATH_IDS.includes(value)) void changePath(value);
    });
  });
}

function renderCards(profile: AssignmentProfile) {
  document.querySelectorAll('.v2-assignment-card').forEach((card) => card.remove());
  const view = activeView();
  if (!view) return;
  if (view.classList.contains('v2-view--dashboard')) {
    const dashboard = view.querySelector('.v2-dashboard');
    if (!dashboard) return;
    const card = document.createElement('section');
    card.className = 'v2-assignment-card v2-assignment-card--dashboard';
    card.innerHTML = assignmentBody(profile, true);
    dashboard.prepend(card);
  }
  if (view.classList.contains('v2-view--profile')) {
    const card = document.createElement('section');
    card.className = 'v2-assignment-card v2-assignment-card--profile';
    card.innerHTML = assignmentBody(profile, false);
    view.prepend(card);
    bindChoices(card);
  }
}

function render() {
  queued = false;
  if (!archive || !archive.profile.onboarded) return;
  const profile = archive.profile as AssignmentProfile;
  setVariables(profile);
  applyCopy(profile);
  renderCards(profile);
}

function schedule() {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(render);
}

async function hydrate() {
  const { user } = await getAuthSnapshot();
  if (!user) {
    archive = null;
    return;
  }
  archive = await loadCloudArchive(user);
  schedule();
}

function start() {
  void hydrate();
  const root = document.getElementById('root');
  if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      archive = null;
      return;
    }
    window.setTimeout(() => void hydrate(), 0);
  });
  window.addEventListener('focus', () => void hydrate());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
