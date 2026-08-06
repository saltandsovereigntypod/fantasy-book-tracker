import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chooseAbility, createCreatureAssignment } from './assignments';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS, rankIndexForPoints, type PathId } from './paths';
import { QUESTIONNAIRE, scoreQuestionnaire, type TraitScores } from './questionnaire';
import { getAuthSnapshot, supabase } from './supabase';
import './onboarding-runtime.css';

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
  if (!archive || archive.profile.onboarded) return null;

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
      const next: V2ArchiveState = {
        ...archive,
        profile: {
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
        } as V2ArchiveState['profile'],
        updatedAt: new Date().toISOString(),
      };
      saveLocalArchive(next);
      await saveCloudArchive(user, next);
      setArchive(next);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your assignment could not be saved.');
      setSaving(false);
    }
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
