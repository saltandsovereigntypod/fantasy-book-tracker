export const TRAIT_IDS = ['strategy', 'courage', 'loyalty', 'empathy', 'perception', 'curiosity', 'discipline', 'adaptability', 'independence', 'precision', 'resilience', 'protection', 'intuition', 'decisiveness', 'power', 'cunning'] as const;
export type TraitId = typeof TRAIT_IDS[number];
export type TraitScores = Record<TraitId, number>;

export interface QuestionnaireAnswer {
  id: string;
  text: string;
  scores: Partial<TraitScores>;
}

export interface QuestionnaireQuestion {
  id: string;
  prompt: string;
  context?: string;
  answers: readonly QuestionnaireAnswer[];
}

export const QUESTIONNAIRE: readonly QuestionnaireQuestion[] = [
  {
    id: 'failed-expedition',
    prompt: 'A carefully planned expedition goes wrong, and your group has only minutes to respond. What do you do first?',
    answers: [
      { id: 'people', text: 'Make sure no one is injured or left behind before deciding the next move.', scores: { empathy: 3, protection: 3, loyalty: 2 } },
      { id: 'facts', text: 'Work out exactly what changed and which parts of the original plan are still usable.', scores: { strategy: 3, perception: 2, discipline: 2 } },
      { id: 'route', text: 'Choose the safest workable route and get everyone moving before the situation worsens.', scores: { decisiveness: 3, protection: 2, courage: 2 } },
      { id: 'improvise', text: 'Abandon the old plan and build a new one from whatever resources are available.', scores: { adaptability: 4, independence: 2, curiosity: 1 } }
    ]
  },
  {
    id: 'withheld-information',
    prompt: 'A close friend admits they withheld information that affects the entire group. They insist they had a good reason. What do you do first?',
    answers: [
      { id: 'hear-them', text: 'Ask them to explain everything before deciding whether they were wrong.', scores: { empathy: 3, loyalty: 2, intuition: 2 } },
      { id: 'verify', text: 'Check the information independently before confronting anyone else.', scores: { perception: 3, precision: 2, strategy: 2 } },
      { id: 'confront', text: 'Tell them plainly that trust requires the full truth, even when it is uncomfortable.', scores: { courage: 3, decisiveness: 2, loyalty: 2 } },
      { id: 'contain', text: 'Decide who actually needs to know and prevent the situation from spreading further.', scores: { discipline: 3, cunning: 2, protection: 2 } }
    ]
  },
  {
    id: 'unequal-challenge',
    prompt: 'Another team has more people, better equipment, and a large head start. Your group looks to you for a plan.',
    answers: [
      { id: 'study', text: 'Observe how they work and exploit the first weakness in their routine.', scores: { strategy: 4, perception: 2, precision: 1 } },
      { id: 'endure', text: 'Set a pace your group can sustain and trust that consistency will close the gap.', scores: { resilience: 4, discipline: 2, loyalty: 1 } },
      { id: 'change-game', text: 'Find a different route to the goal instead of competing on their terms.', scores: { adaptability: 3, independence: 3, curiosity: 1 } },
      { id: 'rally', text: 'Give everyone a clear role and push hard before doubt has time to settle in.', scores: { decisiveness: 3, courage: 3, protection: 1 } }
    ]
  },
  {
    id: 'dangerous-knowledge',
    prompt: 'You discover a sealed record that may answer an important question, but opening it could put you or someone else at risk.',
    answers: [
      { id: 'open', text: 'Open it. Some answers are worth accepting personal risk for.', scores: { curiosity: 4, courage: 2, power: 1 } },
      { id: 'prepare', text: 'Learn everything possible about the danger before deciding whether to open it.', scores: { strategy: 3, discipline: 3, perception: 1 } },
      { id: 'protect', text: 'Leave it sealed if the risk could fall on someone who did not choose it.', scores: { empathy: 3, protection: 3, loyalty: 1 } },
      { id: 'workaround', text: 'Find a way to learn what it contains without opening it in the expected way.', scores: { cunning: 4, precision: 2, independence: 1 } }
    ]
  },
  {
    id: 'public-disagreement',
    prompt: 'A respected leader makes a decision you believe will cause real harm. The room is waiting to see whether anyone objects.',
    answers: [
      { id: 'speak', text: 'Challenge the decision immediately and explain the harm as clearly as possible.', scores: { courage: 4, decisiveness: 2, protection: 1 } },
      { id: 'evidence', text: 'Ask precise questions that reveal the flaws without turning the room into a fight.', scores: { precision: 3, strategy: 3, discipline: 1 } },
      { id: 'private', text: 'Speak to the leader privately first, unless the danger is immediate.', scores: { empathy: 2, loyalty: 2, discipline: 3 } },
      { id: 'redirect', text: 'Quietly organize a safer alternative so the harmful decision cannot succeed.', scores: { cunning: 3, independence: 3, adaptability: 1 } }
    ]
  },
  {
    id: 'missing-person',
    prompt: 'Someone from your group does not return at the agreed time, and conditions are getting worse.',
    answers: [
      { id: 'go', text: 'Go after them immediately, even if you have to leave the safer route.', scores: { loyalty: 4, courage: 3 } },
      { id: 'organize', text: 'Organize a search with checkpoints, signals, and a firm return time.', scores: { protection: 3, strategy: 3, discipline: 2 } },
      { id: 'trace', text: 'Reconstruct their likely choices from the last place anyone saw them.', scores: { perception: 4, intuition: 2, precision: 1 } },
      { id: 'signal', text: 'Create the strongest possible signal and make the group easier for them to find.', scores: { adaptability: 3, empathy: 2, resilience: 2 } }
    ]
  },
  {
    id: 'conflict-role',
    prompt: 'During a tense argument, which role do you naturally take?',
    answers: [
      { id: 'translate', text: 'I help people understand what the other person is actually trying to say.', scores: { empathy: 4, intuition: 2 } },
      { id: 'facts', text: 'I separate what is known from what everyone is assuming.', scores: { perception: 3, precision: 3 } },
      { id: 'boundary', text: 'I set a boundary when the argument becomes harmful or unproductive.', scores: { protection: 3, decisiveness: 3 } },
      { id: 'silence', text: 'I listen until I know which detail will change the entire conversation.', scores: { cunning: 3, strategy: 2, intuition: 2 } }
    ]
  },
  {
    id: 'new-skill',
    prompt: 'You must learn a difficult skill quickly. Which approach feels most natural?',
    answers: [
      { id: 'practice', text: 'Repeat the fundamentals until I can rely on them under pressure.', scores: { discipline: 4, resilience: 2, precision: 1 } },
      { id: 'understand', text: 'Understand why it works before trying to perform it quickly.', scores: { curiosity: 3, strategy: 2, perception: 2 } },
      { id: 'experiment', text: 'Try several methods and keep the one that works best for me.', scores: { adaptability: 4, independence: 2 } },
      { id: 'mentor', text: 'Find someone skilled, study how they think, and ask direct questions.', scores: { loyalty: 2, curiosity: 2, empathy: 2, precision: 1 } }
    ]
  },
  {
    id: 'responsibility',
    prompt: 'You are given authority over a decision that will affect many people. What matters most?',
    answers: [
      { id: 'protect', text: 'The people with the least power should not carry the greatest cost.', scores: { protection: 4, empathy: 3 } },
      { id: 'effective', text: 'The decision must actually solve the problem, not merely look compassionate.', scores: { strategy: 3, decisiveness: 3, power: 1 } },
      { id: 'transparent', text: 'People deserve to know the reasoning and the risks before the decision is final.', scores: { loyalty: 2, precision: 2, courage: 2 } },
      { id: 'freedom', text: 'People should retain as much choice as the situation safely allows.', scores: { independence: 4, empathy: 2, adaptability: 1 } }
    ]
  },
  {
    id: 'uncertain-threat',
    prompt: 'You sense that something is wrong, but you cannot yet prove it. What do you do?',
    answers: [
      { id: 'watch', text: 'Watch quietly and record patterns until the evidence is undeniable.', scores: { perception: 4, discipline: 2, cunning: 1 } },
      { id: 'warn', text: 'Warn the people who could be harmed, while being honest about what I do not know.', scores: { protection: 3, courage: 2, empathy: 2 } },
      { id: 'test', text: 'Create a controlled test that forces the hidden problem to reveal itself.', scores: { strategy: 3, precision: 2, curiosity: 2 } },
      { id: 'trust', text: 'Trust my instincts and change course before certainty arrives.', scores: { intuition: 4, decisiveness: 2, independence: 1 } }
    ]
  },
  {
    id: 'personal-failure',
    prompt: 'You make a mistake that costs the group time and creates more work for everyone.',
    answers: [
      { id: 'own-it', text: 'Take responsibility immediately and ask what needs to be repaired first.', scores: { courage: 3, empathy: 2, discipline: 2 } },
      { id: 'fix-it', text: 'Start correcting it before explaining, so the damage does not keep growing.', scores: { decisiveness: 3, resilience: 2, protection: 2 } },
      { id: 'analyze', text: 'Work out exactly why it happened so the same failure cannot repeat.', scores: { strategy: 3, precision: 3, curiosity: 1 } },
      { id: 'adapt', text: 'Change the process rather than forcing everyone back into the original plan.', scores: { adaptability: 4, independence: 2 } }
    ]
  },
  {
    id: 'power-offer',
    prompt: 'You are offered an unusual ability that could make you extremely effective, but it would also make some people fear you.',
    answers: [
      { id: 'accept', text: 'Accept it. Being feared is manageable if the ability can protect people.', scores: { power: 3, protection: 3, courage: 1 } },
      { id: 'conditions', text: 'Accept only after understanding its limits and deciding when it should never be used.', scores: { discipline: 3, strategy: 2, precision: 2 } },
      { id: 'decline', text: 'Decline if using it would damage the trust of the people closest to me.', scores: { loyalty: 3, empathy: 3, power: -1 } },
      { id: 'conceal', text: 'Accept it, but reveal as little as possible until I understand who can be trusted.', scores: { cunning: 3, independence: 2, intuition: 2 } }
    ]
  }
];

export function emptyTraitScores(): TraitScores {
  return Object.fromEntries(TRAIT_IDS.map((trait) => [trait, 0])) as TraitScores;
}

export function scoreQuestionnaire(answerIds: readonly string[]): TraitScores {
  const scores = emptyTraitScores();
  const selected = new Set(answerIds);
  QUESTIONNAIRE.forEach((question) => question.answers.forEach((answer) => {
    if (!selected.has(answer.id)) return;
    Object.entries(answer.scores).forEach(([trait, value]) => { scores[trait as TraitId] += value || 0; });
  }));
  return scores;
}
