import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chooseAbility, createCreatureAssignment, type CreatureAssignment } from './assignments';
import { loadCloudArchive, saveCloudArchive, type V2ArchiveState } from './archive';
import { PATHS, pathFor, rankIndexForPoints, type PathId } from './paths';
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

function renderProfileAssignment(profile: AssignmentProfile) {
  const view = document.querySelector<HTMLElement>('.v2-view--profile');
  if (!view || getComputedStyle(view).display === 'none') return;
  let card = view.querySelector<HTMLElement>('.v2-assignment-card');
  if (!card) {
    card = document.createElement('section');
    card.className = 'v2-assignment-card';
    view.prepend(card);
  }
  const path = pathFor(profile.path);
  const rank = path.ranks[rankIndexForPoints(path.id, profile.points || 0)] || path.ranks[0];
  const creature = profile.creature;
  const signature = JSON.stringify([path.id, rank, profile.abilityName, profile.abilityDescription, creature]);
  if (card.dataset.signature === signature) return;
  card.dataset.signature = signature;
  card.innerHTML = `<p>Your assignment</p><h2>${path.glyph} ${path.name}</h2><div class="v2-assignment-grid"><article><span>${path.copy.currentRank}</span><strong>${rank}</strong></article>${profile.abilityName ? `<article><span>${path.id === 'gryphon' ? 'Mindwork gift' : 'Signet'}</span><strong>${profile.abilityName}</strong><small>${profile.abilityDescription || ''}</small></article>` : ''}${creature ? `<article><span>${creature.kind === 'dragon' ? 'Bonded dragon' : creature.kind === 'gryphon' ? 'Bonded gryphon' : 'Wyvern'}</span><strong>${creature.name}</strong><small>${creature.color}${creature.tail ? ` ${creature.tail}` : ''}</small></article>` : ''}</div>`;
}

function syncPresentation() {
  if (!currentArchive) return;
  const profile = currentArchive.profile as AssignmentProfile;
  if (!profile.onboarded) return;
  applyPathPresentation(profile);
  renderProfileAssignment(profile);
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
      syncPresentation();
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
      await saveCloudArchive(user, nextArchive);
      currentArchive = nextArchive;
      setArchive(nextArchive);
      syncPresentation();
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
  const observer = new MutationObserver(syncPresentation);
  const appRoot = document.getElementById('root');
  if (appRoot) observer.observe(appRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('focus', syncPresentation);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startOnboardingRuntime, { once: true });
else startOnboardingRuntime();
