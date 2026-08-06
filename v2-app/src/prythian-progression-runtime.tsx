import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import {
  PRYTHIAN_COURTS,
  PRYTHIAN_RANKS,
  PRYTHIAN_THRESHOLDS,
  freshUniverseProfiles,
  prythianRankIndex,
  type PrythianCourtId,
  type UniverseProfiles,
} from './universes';
import './prythian-progression-runtime.css';

type ArchiveWithUniverses = V2ArchiveState & { universes?: UniverseProfiles };
type EventAnswer = { label: string; tone: 'mercy' | 'strategy' | 'power' };
type EventQuestion = { prompt: string; answers: EventAnswer[] };

const ROLE_NAMES = {
  'high-fae': 'High Fae',
  'lesser-fae': 'Lesser Fae',
  illyrian: 'Illyrian Warrior',
} as const;

const EVENT_QUESTIONS: Record<number, EventQuestion[]> = {
  1: [
    { prompt: 'A visiting court insults one of your people during a public audience. How do you answer?', answers: [
      { label: 'Defend them openly and demand a public apology.', tone: 'power' },
      { label: 'Turn the insult back through careful diplomacy.', tone: 'strategy' },
      { label: 'Remove your courtier from the spectacle and address the harm first.', tone: 'mercy' },
    ] },
    { prompt: 'You are trusted with a message that could destabilize an alliance.', answers: [
      { label: 'Deliver it exactly as written. The truth belongs in the open.', tone: 'power' },
      { label: 'Verify its source and timing before anyone acts.', tone: 'strategy' },
      { label: 'Warn those most likely to be harmed before the court responds.', tone: 'mercy' },
    ] },
    { prompt: 'What should your new standing represent?', answers: [
      { label: 'The strength to make the court impossible to threaten.', tone: 'power' },
      { label: 'The judgment to see danger before it reaches the court.', tone: 'strategy' },
      { label: 'The trust of the people whose lives the court shapes.', tone: 'mercy' },
    ] },
  ],
  2: [
    { prompt: 'Two allied courts demand opposite concessions from your ruler.', answers: [
      { label: 'Choose the alliance that offers the greatest protection.', tone: 'power' },
      { label: 'Find the hidden interest both courts share and build around it.', tone: 'strategy' },
      { label: 'Refuse any agreement that treats ordinary faeries as expendable.', tone: 'mercy' },
    ] },
    { prompt: 'A spy is discovered inside the palace.', answers: [
      { label: 'Make an example of them before the entire court.', tone: 'power' },
      { label: 'Feed them controlled information and trace their network.', tone: 'strategy' },
      { label: 'Learn what forced them into service before passing judgment.', tone: 'mercy' },
    ] },
    { prompt: 'Which duty defines an emissary?', answers: [
      { label: 'Projecting the court’s strength beyond its borders.', tone: 'power' },
      { label: 'Understanding every room before making a move.', tone: 'strategy' },
      { label: 'Ensuring peace has meaning for more than rulers.', tone: 'mercy' },
    ] },
  ],
  3: [
    { prompt: 'A noble house openly challenges your authority.', answers: [
      { label: 'Meet the challenge directly and decisively.', tone: 'power' },
      { label: 'Expose the alliances supporting them before responding.', tone: 'strategy' },
      { label: 'Offer a path back into good standing before conflict begins.', tone: 'mercy' },
    ] },
    { prompt: 'The court must choose where to rebuild after an attack.', answers: [
      { label: 'Fortify the border first.', tone: 'power' },
      { label: 'Restore the intelligence and communication network first.', tone: 'strategy' },
      { label: 'Rebuild homes and healing centers first.', tone: 'mercy' },
    ] },
    { prompt: 'What makes nobility legitimate?', answers: [
      { label: 'The power to hold territory and defend it.', tone: 'power' },
      { label: 'The wisdom to guide the court through uncertainty.', tone: 'strategy' },
      { label: 'Service to the people beneath the title.', tone: 'mercy' },
    ] },
  ],
  4: [
    { prompt: 'Your ruler asks for advice that may cost lives either way.', answers: [
      { label: 'Recommend the action that ends the threat fastest.', tone: 'power' },
      { label: 'Delay until every hidden consequence is understood.', tone: 'strategy' },
      { label: 'Choose the path that protects the most vulnerable first.', tone: 'mercy' },
    ] },
    { prompt: 'A member of the Inner Circle breaks faith with the court.', answers: [
      { label: 'Remove them immediately.', tone: 'power' },
      { label: 'Determine whether the betrayal is part of a larger threat.', tone: 'strategy' },
      { label: 'Hear their reasons before deciding whether trust can be repaired.', tone: 'mercy' },
    ] },
    { prompt: 'What should the Inner Circle demand of you?', answers: [
      { label: 'Unshakable resolve.', tone: 'power' },
      { label: 'Clear sight and disciplined judgment.', tone: 'strategy' },
      { label: 'Loyalty that does not lose its compassion.', tone: 'mercy' },
    ] },
  ],
  5: [
    { prompt: 'The magic of the land answers you during a moment of crisis.', answers: [
      { label: 'Command it and end the threat.', tone: 'power' },
      { label: 'Listen for what the land is trying to reveal.', tone: 'strategy' },
      { label: 'Use it to shield every life within reach.', tone: 'mercy' },
    ] },
    { prompt: 'Your first decree will define your rule.', answers: [
      { label: 'Strengthen the court’s defenses and military command.', tone: 'power' },
      { label: 'Open the archives, intelligence network, and councils to reform.', tone: 'strategy' },
      { label: 'Guarantee sanctuary, healing, and protection to every class of faerie.', tone: 'mercy' },
    ] },
    { prompt: 'What kind of High Lord or High Lady will you become?', answers: [
      { label: 'A ruler no enemy dares challenge.', tone: 'power' },
      { label: 'A ruler who sees the whole board before anyone else.', tone: 'strategy' },
      { label: 'A ruler whose people never doubt they matter.', tone: 'mercy' },
    ] },
  ],
};

function profilesFor(archive: ArchiveWithUniverses): UniverseProfiles {
  if (archive.universes?.empyrean && archive.universes?.prythian) return archive.universes;
  return freshUniverseProfiles(String(archive.profile.path || 'rider'));
}

function courtStory(courtId: PrythianCourtId, rankIndex: number, answers: EventAnswer[]): string {
  const court = PRYTHIAN_COURTS[courtId];
  const counts = answers.reduce<Record<EventAnswer['tone'], number>>((map, answer) => ({ ...map, [answer.tone]: map[answer.tone] + 1 }), { mercy: 0, strategy: 0, power: 0 });
  const tone = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'strategy') as EventAnswer['tone'];
  const ending = tone === 'power'
    ? 'You answered with force and certainty, making it clear that your court would not be made small.'
    : tone === 'mercy'
      ? 'You chose protection over spectacle, and the court remembered who stood closest to the vulnerable.'
      : 'You moved carefully, reading the motives beneath every demand before committing the court to a path.';
  return `The ${court.name} recognized your rise to ${PRYTHIAN_RANKS[rankIndex]}. ${ending}`;
}

function Progression() {
  const [archive, setArchive] = useState<ArchiveWithUniverses | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [eventRank, setEventRank] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<EventAnswer[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { user } = await getAuthSnapshot();
    if (!user) return;
    const loaded = await loadCloudArchive(user) as ArchiveWithUniverses;
    const profiles = profilesFor(loaded);
    const points = Number(loaded.profile.points) || 0;
    const rankIndex = prythianRankIndex(points);
    const normalized: ArchiveWithUniverses = {
      ...loaded,
      universes: {
        ...profiles,
        prythian: { ...profiles.prythian, points, rankIndex },
      },
    };
    setArchive(normalized);
    if (profiles.activeUniverse === 'prythian' && profiles.prythian.onboarded) {
      const pending = Array.from({ length: rankIndex }, (_, index) => index + 1)
        .find((index) => !profiles.prythian.completedEvents.includes(`court-rank-${index}`));
      setEventRank(pending ?? null);
    } else setEventRank(null);
  }

  useEffect(() => {
    void load();
    const syncProfile = () => setProfileVisible(Boolean(document.querySelector('.v2-view--profile')));
    syncProfile();
    const observer = new MutationObserver(() => { syncProfile(); void load(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-universe', 'data-court'] });
    const refresh = () => void load();
    window.addEventListener('prythian-assessment-complete', refresh);
    return () => { observer.disconnect(); window.removeEventListener('prythian-assessment-complete', refresh); };
  }, []);

  const profiles = useMemo(() => archive ? profilesFor(archive) : null, [archive]);
  if (!archive || !profiles) return null;
  const prythian = profiles.prythian;
  const courtId = (prythian.court || 'night') as PrythianCourtId;
  const court = PRYTHIAN_COURTS[courtId];
  const points = Number(archive.profile.points) || 0;
  const rankIndex = prythianRankIndex(points);
  const nextThreshold = PRYTHIAN_THRESHOLDS[rankIndex + 1];
  const eventQuestions = eventRank == null ? null : EVENT_QUESTIONS[eventRank];

  function chooseAnswer(answer: EventAnswer) {
    const next = [...answers, answer];
    setAnswers(next);
    if (eventQuestions && step < eventQuestions.length - 1) setStep(step + 1);
  }

  async function completeEvent() {
    if (eventRank == null || !eventQuestions || answers.length !== eventQuestions.length) return;
    setSaving(true);
    const key = `court-rank-${eventRank}`;
    const story = {
      key,
      title: `${court.name}: ${PRYTHIAN_RANKS[eventRank]}`,
      story: courtStory(courtId, eventRank, answers),
      completedAt: new Date().toISOString(),
      answers: answers.map((answer) => answer.label),
    };
    const nextProfiles: UniverseProfiles = {
      ...profiles,
      prythian: {
        ...prythian,
        points,
        rankIndex,
        completedEvents: [...prythian.completedEvents.filter((item) => item !== key), key],
        stories: [...prythian.stories.filter((item) => item.key !== key), story],
      },
    };
    const next = { ...archive, universes: nextProfiles, updatedAt: new Date().toISOString() };
    setArchive(next);
    saveLocalArchive(next);
    try {
      const { user } = await getAuthSnapshot();
      if (user) await saveCloudArchive(user, next);
      const pending = Array.from({ length: rankIndex }, (_, index) => index + 1)
        .find((index) => !nextProfiles.prythian.completedEvents.includes(`court-rank-${index}`));
      setEventRank(pending ?? null);
      setStep(0);
      setAnswers([]);
    } finally {
      setSaving(false);
    }
  }

  return <>
    {profileVisible && profiles.activeUniverse === 'prythian' && prythian.onboarded && <section className="prythian-progression-panel">
      <header><div><p>{court.glyph} Court standing</p><h2>{PRYTHIAN_RANKS[rankIndex]}</h2><span>{points.toLocaleString()} account points</span></div><div className="prythian-power-summary"><article><span>Fae role</span><strong>{prythian.role ? ROLE_NAMES[prythian.role] : 'Unrevealed'}</strong></article><article><span>Primary gift</span><strong>{prythian.primaryPowerName || 'Unrevealed'}</strong><small>{prythian.primaryPowerDescription}</small></article>{prythian.rareAffinityName && <article><span>Rare affinity</span><strong>{prythian.rareAffinityName}</strong></article>}</div></header>
      <div className="prythian-standing-progress"><div><span style={{ width: nextThreshold ? `${Math.max(0, Math.min(100, ((points - PRYTHIAN_THRESHOLDS[rankIndex]) / (nextThreshold - PRYTHIAN_THRESHOLDS[rankIndex])) * 100))}%` : '100%' }} /></div><small>{nextThreshold ? `${(nextThreshold - points).toLocaleString()} points to ${PRYTHIAN_RANKS[rankIndex + 1]}` : 'Highest court standing reached'}</small></div>
      <ol>{PRYTHIAN_RANKS.map((rank, index) => <li key={rank} className={index < rankIndex ? 'is-unlocked' : index === rankIndex ? 'is-current' : 'is-locked'}><span>{index + 1}</span><div><strong>{rank}</strong><small>{PRYTHIAN_THRESHOLDS[index].toLocaleString()} points</small></div><em>{index < rankIndex ? 'Unlocked' : index === rankIndex ? 'Current' : 'Locked'}</em></li>)}</ol>
      {prythian.stories.length > 0 && <div className="prythian-chronicles"><h3>Court chronicles</h3>{prythian.stories.slice().reverse().map((story) => <article key={story.key}><strong>{story.title}</strong><p>{story.story}</p><small>{new Date(story.completedAt).toLocaleDateString()}</small></article>)}</div>}
    </section>}
    {eventRank != null && eventQuestions && profiles.activeUniverse === 'prythian' && <div className="prythian-rank-event-backdrop"><section className="prythian-rank-event" role="dialog" aria-modal="true"><header><div><p>{court.glyph} Court advancement</p><h2>Rise to {PRYTHIAN_RANKS[eventRank]}</h2><span>The court requires three decisions before recognizing your new standing.</span></div><strong>{step + 1} / {eventQuestions.length}</strong></header><article><h3>{eventQuestions[step].prompt}</h3><div>{eventQuestions[step].answers.map((answer) => <button key={answer.label} onClick={() => chooseAnswer(answer)}>{answer.label}</button>)}</div></article><footer>{step > 0 && <button onClick={() => { setAnswers(answers.slice(0, -1)); setStep(step - 1); }}>Back</button>}{answers.length === eventQuestions.length && <button className="is-primary" disabled={saving} onClick={() => void completeEvent()}>{saving ? 'Recording chapter…' : 'Accept New Standing'}</button>}</footer></section></div>}
  </>;
}

function start() {
  const host = document.createElement('div');
  host.id = 'prythian-progression-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><Progression /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
