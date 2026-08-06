import type { PathId } from './paths';
import type { TraitId, TraitScores } from './questionnaire';

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  traits: readonly TraitId[];
  category: string;
  paths: readonly PathId[];
}

export interface CreatureAssignment {
  kind: 'dragon' | 'gryphon' | 'wyvern';
  name: string;
  color: string;
  tail?: string;
  flameColor?: 'Red' | 'Green' | 'Blue';
  strength?: number;
}

// Riders and Dark Wielders intentionally draw from the same complete signet pool.
export const SIGNETS: readonly AbilityDefinition[] = [
  { id: 'storm-wielding', name: 'Storm Wielding', description: 'Shapes wind, rain, pressure, and broader weather patterns.', traits: ['power', 'discipline'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'ward-manifestation', name: 'Ward Manifestation', description: 'Creates and reinforces protective magical boundaries.', traits: ['protection', 'discipline'], category: 'Wardcraft', paths: ['rider', 'dark'] },
  { id: 'memory-reading', name: 'Memory Reading', description: 'Perceives memories through direct contact.', traits: ['perception', 'empathy'], category: 'Psychic', paths: ['rider', 'dark'] },
  { id: 'battle-foresight', name: 'Battle Foresight', description: 'Perceives likely tactical outcomes during conflict.', traits: ['strategy', 'intuition'], category: 'Tactical', paths: ['rider', 'dark'] },
  { id: 'shadow-wielding', name: 'Shadow Wielding', description: 'Creates, shapes, and moves through shadow.', traits: ['cunning', 'independence'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'inntinnsic', name: 'Inntinnsic', description: 'Reads thoughts, intentions, or mental impressions.', traits: ['intuition', 'perception'], category: 'Psychic', paths: ['rider', 'dark'] },
  { id: 'siphoning', name: 'Siphoning', description: 'Draws power from one source and redirects it elsewhere.', traits: ['power', 'adaptability'], category: 'Utility', paths: ['rider', 'dark'] },
  { id: 'lightning-wielding', name: 'Lightning Wielding', description: 'Creates and directs lightning and electrical force.', traits: ['power', 'decisiveness'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'summoning', name: 'Summoning', description: 'Calls known or marked objects directly to the wielder.', traits: ['precision', 'independence'], category: 'Utility', paths: ['rider', 'dark'] },
  { id: 'ice-wielding', name: 'Ice Wielding', description: 'Removes heat and shapes frost or ice.', traits: ['discipline', 'precision'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'metallurgy', name: 'Metallurgy', description: 'Manipulates the shape, movement, and structure of metal.', traits: ['precision', 'power'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'air-wielding', name: 'Air Wielding', description: 'Controls wind, air pressure, and currents.', traits: ['adaptability', 'discipline'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'mind-projection', name: 'Mind Projection', description: 'Projects thoughts, images, or sensory impressions into another mind.', traits: ['empathy', 'power'], category: 'Mental', paths: ['rider', 'dark'] },
  { id: 'farsight', name: 'Farsight', description: 'Sees distant people, places, or events beyond normal vision.', traits: ['perception', 'intuition'], category: 'Perception', paths: ['rider', 'dark'] },
  { id: 'memory-erasure', name: 'Memory Erasure', description: 'Removes or obscures selected recent memories.', traits: ['cunning', 'precision'], category: 'Mental', paths: ['rider', 'dark'] },
  { id: 'earth-wielding', name: 'Earth Wielding', description: 'Manipulates soil, stone, and natural earth materials.', traits: ['resilience', 'power'], category: 'Elemental', paths: ['rider', 'dark'] },
  { id: 'underwater-breathing', name: 'Underwater Breathing', description: 'Allows normal breathing beneath water.', traits: ['adaptability', 'resilience'], category: 'Physical', paths: ['rider', 'dark'] },
  { id: 'astral-projection', name: 'Astral Projection', description: 'Separates consciousness from the body to observe remotely.', traits: ['curiosity', 'independence'], category: 'Psychic', paths: ['rider', 'dark'] },
  { id: 'ward-unweaving', name: 'Ward Unweaving', description: 'Perceives and dismantles woven magical protections.', traits: ['curiosity', 'precision'], category: 'Wardcraft', paths: ['rider', 'dark'] },
  { id: 'mending', name: 'Mending', description: 'Repairs physical injuries and damaged bodies.', traits: ['empathy', 'protection'], category: 'Healing', paths: ['rider', 'dark'] },
  { id: 'weakness-detection', name: 'Weakness Detection', description: 'Perceives vulnerabilities in people, plans, defenses, or structures.', traits: ['strategy', 'perception'], category: 'Tactical', paths: ['rider', 'dark'] },
  { id: 'signet-countering', name: 'Signet Countering', description: 'Disrupts, suppresses, or neutralizes another signet.', traits: ['protection', 'adaptability'], category: 'Defensive', paths: ['rider', 'dark'] },
  { id: 'precognition', name: 'Precognition', description: 'Perceives possible future events before they occur.', traits: ['intuition', 'strategy'], category: 'Psychic', paths: ['rider', 'dark'] },
  { id: 'fire-wielding', name: 'Fire Wielding', description: 'Creates and directs flame and heat.', traits: ['courage', 'power'], category: 'Elemental', paths: ['rider', 'dark'] }
];

export const GRYPHON_GIFTS: readonly AbilityDefinition[] = [
  { id: 'emotion-heightening', name: 'Emotion Heightening', description: 'Intensifies an emotion already present in another person.', traits: ['empathy', 'power'], category: 'Emotion', paths: ['gryphon'] },
  { id: 'desire-detection', name: 'Desire Detection', description: 'Perceives a person’s strongest current desire.', traits: ['intuition', 'empathy'], category: 'Perception', paths: ['gryphon'] },
  { id: 'emotion-sensing', name: 'Emotion Sensing', description: 'Perceives another person’s current emotional state.', traits: ['empathy', 'perception'], category: 'Emotion', paths: ['gryphon'] },
  { id: 'truth-sensing', name: 'Truth Sensing', description: 'Recognizes deliberate deception.', traits: ['intuition', 'precision'], category: 'Perception', paths: ['gryphon'] },
  { id: 'emotion-siphoning', name: 'Emotion Siphoning', description: 'Draws emotional intensity away from another person.', traits: ['protection', 'empathy'], category: 'Emotion', paths: ['gryphon'] }
];

export const RESERVED_CREATURE_NAMES = new Set([
  'Aimsir', 'Teine', 'Cath', 'Codagh', 'Sgaeyl', 'Tairn', 'Andarna', 'Baide', 'Feirge', 'Aotrom', 'Sliseag', 'Smachd', 'Deigh', 'Claidh', 'Glane', 'Cruth', 'Fuil', 'Chradh', 'Marbh', 'Solas', 'Breugan', 'Cuir', 'Thoirt',
  'Kiralair', 'Dajalair', 'Cibbelair', 'Sila'
].map((name) => name.toLocaleLowerCase()));

const CREATURE_NAME_PARTS = {
  dragon: { starts: ['Ail', 'Brae', 'Caer', 'Dra', 'Eir', 'Fae', 'Glen', 'Ior', 'Mael', 'Nair', 'Rhi', 'Sio', 'Tav', 'Vey'], ends: ['ach', 'airn', 'eth', 'ion', 'och', 'ryn', 'var', 'wen', 'yth'] },
  gryphon: { starts: ['Aera', 'Cira', 'Daja', 'Eila', 'Fira', 'Kira', 'Luma', 'Mara', 'Niva', 'Sela', 'Tira', 'Vela'], ends: ['lair', 'ra', 'riel', 'sa', 'vain', 'wyn'] },
  wyvern: { starts: ['Ash', 'Dreth', 'Kael', 'Mord', 'Neth', 'Rav', 'Serr', 'Thyr', 'Vael', 'Vor'], ends: ['ak', 'eth', 'ir', 'oth', 'rax', 'ul', 'yr'] }
} as const;

const DRAGON_COLORS = ['Black', 'Blue', 'Brown', 'Green', 'Orange', 'Red'] as const;
const GRYPHON_COLORS = ['Warm brown and gold', 'Tawny brown and cream', 'White and pale gold', 'Chestnut and ivory', 'Sand, bronze, and white', 'Deep brown and copper'] as const;
const WYVERN_FLAMES = ['Red', 'Green', 'Blue'] as const;
const DRAGON_TAILS = ['swordtail', 'daggertail', 'morningstartail', 'scorpiontail', 'clubtail', 'feathertail'] as const;

export function stableNumber(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function weightedAbility(pool: readonly AbilityDefinition[], scores: TraitScores, seed: string): AbilityDefinition {
  const ranked = pool.map((ability) => ({ ability, score: ability.traits.reduce((total, trait) => total + (scores[trait] || 0), 0) }))
    .sort((a, b) => b.score - a.score || a.ability.id.localeCompare(b.ability.id));
  const topScore = ranked[0]?.score ?? 0;
  const finalists = ranked.filter((entry) => entry.score >= topScore - 2).slice(0, 5);
  return finalists[stableNumber(seed) % finalists.length].ability;
}

export function chooseAbility(path: PathId, scores: TraitScores, seed: string): AbilityDefinition | null {
  if (path === 'rider' || path === 'dark') return weightedAbility(SIGNETS, scores, seed);
  if (path === 'gryphon') return weightedAbility(GRYPHON_GIFTS, scores, seed);
  return null;
}

export function generateUniqueCreatureName(kind: CreatureAssignment['kind'], usedNames: Iterable<string>, seed: string): string {
  const used = new Set([...usedNames].map((name) => name.trim().toLocaleLowerCase()));
  const parts = CREATURE_NAME_PARTS[kind];
  const offset = stableNumber(seed);
  const total = parts.starts.length * parts.ends.length;
  for (let attempt = 0; attempt < total; attempt += 1) {
    const index = (offset + attempt) % total;
    const start = parts.starts[index % parts.starts.length];
    const end = parts.ends[Math.floor(index / parts.starts.length) % parts.ends.length];
    const candidate = `${start}${end}`;
    const key = candidate.toLocaleLowerCase();
    if (!used.has(key) && !RESERVED_CREATURE_NAMES.has(key)) return candidate;
  }
  return `${parts.starts[offset % parts.starts.length]}${parts.ends[offset % parts.ends.length]}${offset % 997}`;
}

export function createCreatureAssignment(kind: CreatureAssignment['kind'], usedNames: Iterable<string>, seed: string): CreatureAssignment {
  const number = stableNumber(seed);
  if (kind === 'dragon') return { kind, name: generateUniqueCreatureName(kind, usedNames, seed), color: DRAGON_COLORS[number % DRAGON_COLORS.length], tail: DRAGON_TAILS[Math.floor(number / 7) % DRAGON_TAILS.length] };
  if (kind === 'gryphon') return { kind, name: generateUniqueCreatureName(kind, usedNames, seed), color: GRYPHON_COLORS[number % GRYPHON_COLORS.length] };
  return { kind, name: generateUniqueCreatureName(kind, usedNames, seed), color: 'Grey', flameColor: WYVERN_FLAMES[number % WYVERN_FLAMES.length], strength: 1 };
}
