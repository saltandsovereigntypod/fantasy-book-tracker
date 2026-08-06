import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chooseAbility, createCreatureAssignment } from './assignments';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS, rankIndexForPoints, type PathId } from './paths';
import { QUESTIONNAIRE, scoreQuestionnaire, type TraitScores } from './questionnaire';
import { getAuthSnapshot, supabase } from './supabase';
import './onboarding-runtime.css';

type RiderUnit = { wing: number; section: 'Flame' | 'Claw' | 'Tail'; squad: 1 | 2 | 3 };
type FlierServiceWing = 'Summit Wing' | 'Nightwing Drift' | 'Seawing Drift';
type AssignmentReveal = { path: PathId; riderUnit?: RiderUnit; flierServiceWing?: FlierServiceWing };

function stable(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function organizationAssignment(path: PathId, seed: string): { riderUnit?: RiderUnit; flierServiceWing?: FlierServiceWing } {
  const value = stable(`${seed}:service-assignment`);
  if (path === 'rider') {
    return {
      riderUnit: {
        wing: (value % 4) + 1,
        section: (['Flame', 'Claw', 'Tail'] as const)[Math.floor(value / 4) % 3],
        squad: ((Math.floor(value / 12) % 3) + 1) as 1 | 2 | 3,
      },
    };
  }
  if (path === 'gryphon') {
    return { flierServiceWing: (['Summit Wing', 'Nightwing Drift', 'Seawing Drift'] as const)[value % 3] };
  }
  return {};
}

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

function Gate() {
  const [archive, setArchive] = useState<V2ArchiveState | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reveal, setReveal] = useState<AssignmentReveal | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { user } = await getAuthSnapshot();
      if (!user || !active) return;
      const next = await loadCloudArchive(user);
      if (active) setArchive(next);
    };
    void load();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) setArchive(null);
      else window.setTimeout(() => void load(), 0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const question = QUESTIONNAIRE[step];
  const progress = useMemo(() => Math.round(((step + 1) / QUESTIONNAIRE.length) * 100), [step]);
  if (!archive || (archive.profile.onboarded && !reveal)) return null;

  async function select(answerId: string) {
    const selected = [...answers, answerId];
    if (step < QUESTIONNAIRE.length - 1) {
      setAnswers(selected);
      setStep((value) => value + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired. Please sign in again.');
      const scores = scoreQuestionnaire(selected);
      const path = assignedPath(scores);
      const seed = `${user.id}:${selected.join(':')}`;
      const ability = chooseAbility(path, scores, seed);
      const definition = PATHS[path];
      const creature = definition.creatureKind ? createCreatureAssignment(definition.creatureKind, [], seed) : undefined;
      const organization = organizationAssignment(path, seed);
      const progression = {
        ...((archive.profile as V2ArchiveState['profile'] & { progression?: object }).progression || {}),
        ...organization,
      };
      const profile = {
        ...archive.profile,
        path,
        rankIndex: rankIndexForPoints(path, archive.profile.points || 0),
        onboarded: true,
        traitScores: scores,
        onboardingVersion: 2,
        progression,
        ...(ability ? {
          abilityId: ability.id,
          abilityName: ability.name,
          abilityDescription: ability.description,
        } : {}),
        ...(creature ? { creature } : {}),
      } as V2ArchiveState['profile'];
      const next: V2ArchiveState = { ...archive, profile, updatedAt: new Date().toISOString() };
      saveLocalArchive(next);
      await saveCloudArchive(user, next);
      setArchive(next);
      setReveal({ path, ...organization });
      setSaving(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your assignment could not be saved.');
      setSaving(false);
    }
  }

  if (reveal) {
    const path = PATHS[reveal.path];
    return <div className="v2-onboarding-gate" role="dialog" aria-modal="true"><section className="v2-onboarding-card"><header><div><p>Assignment Recorded</p><h1>{path.glyph} {path.name}</h1></div></header><main><p className="v2-question-context">Your path and service placement are now part of your permanent record.</p>{reveal.riderUnit && <div className="assignment-card"><h2>{reveal.riderUnit.wing} Wing</h2><p><strong>{reveal.riderUnit.section} Section</strong> · Squad {reveal.riderUnit.squad}</p><p>Your dragon assignment remains sealed until Threshing.</p></div>}{reveal.flierServiceWing && <div className="assignment-card"><h2>{reveal.flierServiceWing}</h2><p>Your gryphon assignment remains sealed until The Harvest.</p></div>}{reveal.path === 'dark' && <div className="assignment-card"><h2>The source has already answered.</h2><p>Your wyvern and signet are available in your record immediately.</p></div>}<button className="primary-button full-width" onClick={() => window.location.reload()}>Enter the Archive</button></main></section></div>;
  }

  return <div className="v2-onboarding-gate" role="dialog" aria-modal="true"><section className="v2-onboarding-card"><header><div><p>Quadrant Assessment</p><h1>Where do you belong?</h1></div><strong>{step + 1} / {QUESTIONNAIRE.length}</strong></header><div className="v2-onboarding-progress"><span style={{ width: `${progress}%` }} /></div><main><p className="v2-question-context">Answer instinctively. Your result comes from the pattern across every choice.</p><h2>{question.prompt}</h2><div className="v2-answer-list">{question.answers.map((answer) => <button key={answer.id} disabled={saving} onClick={() => select(answer.id)}>{answer.text}</button>)}</div>{error && <p className="v2-onboarding-error">{error}</p>}</main></section></div>;
}

function start() {
  const host = document.createElement('div');
  host.id = 'v2-questionnaire-gate';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><Gate /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();