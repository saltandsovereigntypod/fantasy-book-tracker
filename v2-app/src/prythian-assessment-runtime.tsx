import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import {
  GENERAL_FAE_POWERS,
  PRYTHIAN_COURTS,
  RARE_PRYTHIAN_AFFINITIES,
  freshUniverseProfiles,
  type CourtPower,
  type PrythianCourtId,
  type UniverseProfiles,
} from './universes';
import './prythian-assessment-runtime.css';

type ArchiveWithUniverses = V2ArchiveState & { universes?: UniverseProfiles };
type Role = 'high-fae' | 'lesser-fae' | 'illyrian';
type Trait = 'force' | 'insight' | 'adaptation' | 'mercy' | 'discipline' | 'secrecy';

type Answer = {
  label: string;
  traits: Partial<Record<Trait, number>>;
  powerIndex: number;
  rare?: 'seer' | 'silver-flame' | 'all-court' | 'siphon-power';
  role?: Role;
};

type Question = { prompt: string; context: string; answers: Answer[] };

const QUESTIONS: Question[] = [
  {
    prompt: 'A ward around your court begins to fracture during a diplomatic gathering. What do you do first?',
    context: 'No one else has noticed yet, and exposing the weakness could create panic.',
    answers: [
      { label: 'Quietly trace the fault and identify who touched it.', traits: { insight: 3, secrecy: 2 }, powerIndex: 1, rare: 'seer' },
      { label: 'Reinforce the ward with raw power before anyone is endangered.', traits: { force: 3, discipline: 2 }, powerIndex: 0, rare: 'siphon-power', role: 'illyrian' },
      { label: 'Move the vulnerable guests to safety without revealing the threat.', traits: { mercy: 3, adaptation: 2 }, powerIndex: 2 },
    ],
  },
  {
    prompt: 'A rival court offers information in exchange for a secret your ruler trusts you to protect.',
    context: 'The information could prevent bloodshed, but the rival may be manipulating you.',
    answers: [
      { label: 'Read the room, test the story, and reveal nothing until it is verified.', traits: { insight: 3, secrecy: 3 }, powerIndex: 1 },
      { label: 'Refuse the bargain and prepare for the conflict directly.', traits: { force: 3, discipline: 2 }, powerIndex: 0 },
      { label: 'Offer a different truth that satisfies the bargain without betraying the court.', traits: { adaptation: 3, mercy: 1, secrecy: 2 }, powerIndex: 2 },
    ],
  },
  {
    prompt: 'You discover a frightened lesser faerie using forbidden magic to protect their family.',
    context: 'Court law demands punishment, but their intent was not malicious.',
    answers: [
      { label: 'Hide them long enough to find a lawful path that keeps the family safe.', traits: { mercy: 3, secrecy: 2, adaptation: 2 }, powerIndex: 2, role: 'lesser-fae' },
      { label: 'Bring them in, but argue their case before judgment is passed.', traits: { discipline: 3, mercy: 2 }, powerIndex: 0, role: 'high-fae' },
      { label: 'Investigate who forced them into desperation before deciding.', traits: { insight: 3, mercy: 1 }, powerIndex: 1, rare: 'seer' },
    ],
  },
  {
    prompt: 'Your magic surges beyond your control in front of the Inner Circle.',
    context: 'The power feels ancient, unfamiliar, and far stronger than expected.',
    answers: [
      { label: 'Anchor yourself through training and force it into a controlled channel.', traits: { discipline: 3, force: 2 }, powerIndex: 0, rare: 'siphon-power', role: 'illyrian' },
      { label: 'Let the magic speak long enough to understand what it is showing you.', traits: { insight: 3, adaptation: 1 }, powerIndex: 1, rare: 'all-court' },
      { label: 'Contain it so no one else is harmed, even if it hurts you.', traits: { mercy: 3, discipline: 2 }, powerIndex: 2, rare: 'silver-flame' },
    ],
  },
  {
    prompt: 'An enemy commander asks for sanctuary after betraying their own side.',
    context: 'They may possess vital intelligence, but accepting them could endanger your court.',
    answers: [
      { label: 'Grant temporary sanctuary under strict guard and question them personally.', traits: { discipline: 3, insight: 2 }, powerIndex: 1 },
      { label: 'Refuse entry and prepare for the consequences.', traits: { force: 3, secrecy: 1 }, powerIndex: 0 },
      { label: 'Create a hidden refuge outside the court while their claims are tested.', traits: { adaptation: 3, mercy: 2, secrecy: 2 }, powerIndex: 2 },
    ],
  },
  {
    prompt: 'During battle, you can pursue the enemy leader or save a group of trapped civilians.',
    context: 'You cannot do both, and the enemy leader may escape for good.',
    answers: [
      { label: 'Save the civilians. Victory means nothing if the court abandons its people.', traits: { mercy: 4, discipline: 1 }, powerIndex: 2 },
      { label: 'Pursue the leader. Ending the war now saves more lives later.', traits: { force: 3, insight: 1 }, powerIndex: 0 },
      { label: 'Use the terrain and misdirection to attempt both.', traits: { adaptation: 4, secrecy: 1 }, powerIndex: 1, rare: 'all-court' },
    ],
  },
  {
    prompt: 'At the end of the trial, the court asks what you believe power is for.',
    context: 'Your answer will shape how the court sees you.',
    answers: [
      { label: 'To protect those who cannot protect themselves.', traits: { mercy: 4, discipline: 1 }, powerIndex: 2 },
      { label: 'To understand what others overlook and prevent what they cannot see.', traits: { insight: 4, secrecy: 1 }, powerIndex: 1, rare: 'seer' },
      { label: 'To act decisively when hesitation would cost everything.', traits: { force: 4, discipline: 2 }, powerIndex: 0, role: 'illyrian' },
    ],
  },
];

function profilesFor(archive: ArchiveWithUniverses): UniverseProfiles {
  if (archive.universes?.empyrean && archive.universes?.prythian) return archive.universes;
  return freshUniverseProfiles(String(archive.profile.path || 'rider'));
}

function roleName(role: Role): string {
  return role === 'illyrian' ? 'Illyrian Warrior' : role === 'lesser-fae' ? 'Lesser Fae' : 'High Fae';
}

function chooseRole(answers: Answer[], totals: Record<Trait, number>): Role {
  const explicit = answers.map((answer) => answer.role).filter(Boolean) as Role[];
  const counts = explicit.reduce<Record<Role, number>>((map, role) => ({ ...map, [role]: map[role] + 1 }), { 'high-fae': 0, 'lesser-fae': 0, illyrian: 0 });
  if (counts.illyrian >= 2 || totals.force + totals.discipline >= totals.mercy + totals.insight + 5) return 'illyrian';
  if (counts['lesser-fae'] >= 1 && totals.adaptation + totals.mercy > totals.force + totals.discipline) return 'lesser-fae';
  return 'high-fae';
}

function chooseRare(answers: Answer[], totals: Record<Trait, number>): CourtPower | undefined {
  const ids = answers.map((answer) => answer.rare).filter(Boolean) as Array<NonNullable<Answer['rare']>>;
  const counts = ids.reduce<Record<string, number>>((map, id) => ({ ...map, [id]: (map[id] || 0) + 1 }), {});
  let winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!winner || winner[1] < 2) {
    if (totals.insight >= 11) winner = ['seer', 2];
    else if (totals.force >= 12 && totals.discipline >= 8) winner = ['siphon-power', 2];
    else if (totals.adaptation >= 11) winner = ['all-court', 2];
    else if (totals.mercy >= 12 && totals.force >= 6) winner = ['silver-flame', 2];
  }
  return winner ? RARE_PRYTHIAN_AFFINITIES.find((item) => item.id === winner[0]) : undefined;
}

function Assessment() {
  const [archive, setArchive] = useState<ArchiveWithUniverses | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      const { user } = await getAuthSnapshot();
      if (!user || !mounted) return;
      const next = await loadCloudArchive(user) as ArchiveWithUniverses;
      if (!mounted) return;
      setArchive(next);
      const profiles = profilesFor(next);
      setVisible(profiles.activeUniverse === 'prythian' && Boolean(profiles.prythian.court) && !profiles.prythian.onboarded);
    };
    void sync();
    const observer = new MutationObserver(() => void sync());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-universe', 'data-court'] });
    return () => { mounted = false; observer.disconnect(); };
  }, []);

  const result = useMemo(() => {
    if (!archive || answers.length !== QUESTIONS.length) return null;
    const profiles = profilesFor(archive);
    const courtId = (profiles.prythian.court || 'night') as PrythianCourtId;
    const court = PRYTHIAN_COURTS[courtId];
    const totals: Record<Trait, number> = { force: 0, insight: 0, adaptation: 0, mercy: 0, discipline: 0, secrecy: 0 };
    const powerScores = court.powers.map(() => 0);
    answers.forEach((answer) => {
      Object.entries(answer.traits).forEach(([trait, value]) => { totals[trait as Trait] += value || 0; });
      powerScores[Math.min(answer.powerIndex, court.powers.length - 1)] += 1;
    });
    let power = court.powers[powerScores.indexOf(Math.max(...powerScores))] || court.powers[0];
    if (court.powers.length === 1 && totals.insight > totals.force + 3) power = GENERAL_FAE_POWERS[0];
    return { court, power, role: chooseRole(answers, totals), rare: chooseRare(answers, totals) };
  }, [answers, archive]);

  function answer(value: Answer) {
    const next = [...answers, value];
    setAnswers(next);
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else setShowResult(true);
  }

  async function saveResult() {
    if (!archive || !result) return;
    setSaving(true);
    const profiles = profilesFor(archive);
    const nextProfiles: UniverseProfiles = {
      ...profiles,
      prythian: {
        ...profiles.prythian,
        onboarded: true,
        primaryPowerId: result.power.id,
        primaryPowerName: result.power.name,
        primaryPowerDescription: result.power.description,
        rareAffinityId: result.rare?.id,
        rareAffinityName: result.rare?.name,
        role: result.role,
      },
    };
    const next = { ...archive, universes: nextProfiles, updatedAt: new Date().toISOString() };
    saveLocalArchive(next);
    try {
      const { user } = await getAuthSnapshot();
      if (user) await saveCloudArchive(user, next);
      setArchive(next);
      setVisible(false);
      window.dispatchEvent(new CustomEvent('prythian-assessment-complete', { detail: nextProfiles.prythian }));
    } finally {
      setSaving(false);
    }
  }

  if (!visible || !archive) return null;
  const profiles = profilesFor(archive);
  const court = PRYTHIAN_COURTS[(profiles.prythian.court || 'night') as PrythianCourtId];
  const question = QUESTIONS[step];

  return <div className="prythian-assessment-backdrop">
    <section className="prythian-assessment" aria-modal="true" role="dialog">
      {!showResult ? <>
        <header><div><p>{court.glyph} {court.name} assessment</p><h2>The court is watching</h2><span>Choose the response that feels most natural. The scoring remains hidden.</span></div><strong>{step + 1} / {QUESTIONS.length}</strong></header>
        <div className="prythian-assessment-progress"><span style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
        <article><p>Scenario</p><h3>{question.prompt}</h3><span>{question.context}</span></article>
        <div className="prythian-assessment-answers">{question.answers.map((option) => <button key={option.label} onClick={() => answer(option)}>{option.label}</button>)}</div>
        {step > 0 && <footer><button onClick={() => { setAnswers(answers.slice(0, -1)); setStep(step - 1); }}>Back</button></footer>}
      </> : result && <>
        <header><div><p>{result.court.glyph} Court recognition</p><h2>Your magic has answered</h2><span>The court has recognized the shape of your power.</span></div></header>
        <div className="prythian-assessment-result">
          <article><span>Fae role</span><strong>{roleName(result.role)}</strong><p>{result.role === 'illyrian' ? 'Discipline, combat instinct, and raw power define your place in the court.' : result.role === 'lesser-fae' ? 'Adaptability, instinct, and an unconventional form of magic distinguish you.' : 'Court-born magic and political instinct place you among the High Fae.'}</p></article>
          <article><span>Primary gift</span><strong>{result.power.name}</strong><p>{result.power.description}</p></article>
          <article><span>Rare affinity</span><strong>{result.rare?.name || 'None revealed'}</strong><p>{result.rare?.description || 'Your power is focused rather than divided. Rare affinities may still awaken through later court events.'}</p></article>
        </div>
        <footer><button className="is-primary" disabled={saving} onClick={() => void saveResult()}>{saving ? 'Binding result…' : 'Accept Court Recognition'}</button></footer>
      </>}
    </section>
  </div>;
}

function start() {
  const host = document.createElement('div');
  host.id = 'prythian-assessment-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><Assessment /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
