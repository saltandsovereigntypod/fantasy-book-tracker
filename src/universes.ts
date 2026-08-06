export const UNIVERSE_IDS = ['empyrean', 'prythian'] as const;
export type UniverseId = typeof UNIVERSE_IDS[number];

export const PRYTHIAN_COURT_IDS = ['night', 'spring', 'summer', 'autumn', 'winter', 'day', 'dawn'] as const;
export type PrythianCourtId = typeof PRYTHIAN_COURT_IDS[number];

export interface UniverseProgressProfile {
  onboarded: boolean;
  points: number;
  rankIndex: number;
  completedEvents: string[];
  stories: Array<{ key: string; title: string; story: string; completedAt: string; answers: string[] }>;
}

export interface EmpyreanUniverseProfile extends UniverseProgressProfile {
  universe: 'empyrean';
  path: string;
}

export interface PrythianUniverseProfile extends UniverseProgressProfile {
  universe: 'prythian';
  court?: PrythianCourtId;
  primaryPowerId?: string;
  primaryPowerName?: string;
  primaryPowerDescription?: string;
  rareAffinityId?: string;
  rareAffinityName?: string;
  role?: 'high-fae' | 'lesser-fae' | 'illyrian';
  distinctions: string[];
}

export interface UniverseProfiles {
  activeUniverse: UniverseId;
  empyrean: EmpyreanUniverseProfile;
  prythian: PrythianUniverseProfile;
}

export interface CourtTheme {
  background: string;
  panel: string;
  panelAlt: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentContrast: string;
  accentSoft: string;
  border: string;
  paper: string;
}

export interface CourtPower {
  id: string;
  name: string;
  description: string;
}

export interface PrythianCourtDefinition {
  id: PrythianCourtId;
  name: string;
  family: 'solar' | 'seasonal';
  ruler: string;
  glyph: string;
  theme: CourtTheme;
  powers: readonly CourtPower[];
}

export const PRYTHIAN_RANKS = ['Court Initiate', 'Sworn Courtier', 'Court Emissary', 'Court Noble', 'Inner Circle', 'High Lord / High Lady'] as const;
export const PRYTHIAN_THRESHOLDS = [0, 5000, 20000, 50000, 100000, 200000] as const;

export const GENERAL_FAE_POWERS: readonly CourtPower[] = [
  { id: 'winnowing', name: 'Winnowing', description: 'Teleport across distance by folding through the space between places.' },
  { id: 'glamouring', name: 'Glamouring', description: 'Shape perception through magical illusions and concealment.' },
  { id: 'telekinesis', name: 'Telekinesis', description: 'Move and manipulate objects through focused magical force.' },
];

export const RARE_PRYTHIAN_AFFINITIES: readonly CourtPower[] = [
  { id: 'seer', name: 'Seer', description: 'Receive visions connected to the past, present, or possible futures.' },
  { id: 'silver-flame', name: 'Silver Flame', description: 'Wield raw death-touched power drawn from the Cauldron.' },
  { id: 'all-court', name: 'All-Court Affinity', description: 'Carry traces of fire, ice, water, air, light, darkness, shapeshifting, and healing.' },
  { id: 'siphon-power', name: 'Siphon Power', description: 'Channel immense raw force through disciplined warrior magic.' },
];

export const PRYTHIAN_COURTS: Record<PrythianCourtId, PrythianCourtDefinition> = {
  night: {
    id: 'night', name: 'Night Court', family: 'solar', ruler: 'Rhysand and Feyre Archeron', glyph: '✦',
    theme: { background: '#070812', panel: '#101225', panelAlt: '#171a33', surface: '#202444', text: '#f1efff', muted: '#aaa8c9', accent: '#7872b9', accentContrast: '#ffffff', accentSoft: 'rgba(120,114,185,.18)', border: '#30365a', paper: '#d8d2f0' },
    powers: [
      { id: 'darkness', name: 'Darkness Manipulation', description: 'Gather, shape, and command living darkness.' },
      { id: 'shadow-weaving', name: 'Shadow-Weaving', description: 'Create concealment, forms, and pathways from shadow.' },
      { id: 'daemati', name: 'Daemati', description: 'Read, enter, influence, or defend minds.' },
    ],
  },
  spring: {
    id: 'spring', name: 'Spring Court', family: 'seasonal', ruler: 'Tamlin', glyph: '❀',
    theme: { background: '#10170f', panel: '#182219', panelAlt: '#213023', surface: '#2b3d2e', text: '#eff3e7', muted: '#abb89f', accent: '#8b9f62', accentContrast: '#10170f', accentSoft: 'rgba(139,159,98,.18)', border: '#3a4e37', paper: '#e3ddbd' },
    powers: [
      { id: 'shapeshifting', name: 'Beast Shapeshifting', description: 'Transform into a powerful beast form.' },
      { id: 'wind', name: 'Wind Manipulation', description: 'Command breezes, gusts, and cutting currents of air.' },
      { id: 'thorns', name: 'Thorncraft', description: 'Summon and shape living thorns and defensive growth.' },
    ],
  },
  summer: {
    id: 'summer', name: 'Summer Court', family: 'seasonal', ruler: 'Tarquin', glyph: '≈',
    theme: { background: '#07161a', panel: '#0e2228', panelAlt: '#143039', surface: '#1a414c', text: '#e8f7f6', muted: '#9ec5c7', accent: '#4ea5ad', accentContrast: '#061417', accentSoft: 'rgba(78,165,173,.18)', border: '#28535c', paper: '#d9e6d9' },
    powers: [{ id: 'water', name: 'Water Manipulation', description: 'Control water, oceanic currents, and tides.' }],
  },
  autumn: {
    id: 'autumn', name: 'Autumn Court', family: 'seasonal', ruler: 'Beron Vanserra', glyph: '❧',
    theme: { background: '#170c08', panel: '#24120c', panelAlt: '#321a10', surface: '#442418', text: '#f4e5d8', muted: '#c0a28c', accent: '#a0522d', accentContrast: '#fff7ef', accentSoft: 'rgba(160,82,45,.2)', border: '#57301f', paper: '#e5c9a9' },
    powers: [{ id: 'fire', name: 'Fire and Heat', description: 'Generate and control destructive flame and searing heat.' }],
  },
  winter: {
    id: 'winter', name: 'Winter Court', family: 'seasonal', ruler: 'Kallias', glyph: '❄',
    theme: { background: '#091218', panel: '#101e28', panelAlt: '#172b38', surface: '#1f3a4a', text: '#edf6fa', muted: '#a8bec8', accent: '#83b6cf', accentContrast: '#071116', accentSoft: 'rgba(131,182,207,.18)', border: '#2d4d5e', paper: '#e2ebed' },
    powers: [{ id: 'ice', name: 'Ice and Absolute Cold', description: 'Create and command ice, frost, and lethal cold.' }],
  },
  day: {
    id: 'day', name: 'Day Court', family: 'solar', ruler: 'Helion', glyph: '☀',
    theme: { background: '#171207', panel: '#241d0c', panelAlt: '#322813', surface: '#46381b', text: '#fff2cc', muted: '#cbb98a', accent: '#d0a84f', accentContrast: '#171207', accentSoft: 'rgba(208,168,79,.18)', border: '#5a4823', paper: '#f0dfad' },
    powers: [
      { id: 'light', name: 'Light Manipulation', description: 'Shape and weaponize brilliant magical light.' },
      { id: 'spell-cleaving', name: 'Spell-Cleaving', description: 'Break enchantments, wards, and bound magic.' },
      { id: 'burning-heat', name: 'Burning Heat', description: 'Command concentrated solar heat.' },
    ],
  },
  dawn: {
    id: 'dawn', name: 'Dawn Court', family: 'solar', ruler: 'Thesan', glyph: '☼',
    theme: { background: '#171014', panel: '#241920', panelAlt: '#32232d', surface: '#45313d', text: '#f8eaef', muted: '#c5abb5', accent: '#c9879a', accentContrast: '#1a0f14', accentSoft: 'rgba(201,135,154,.18)', border: '#5a3d4a', paper: '#ecd6d4' },
    powers: [{ id: 'healing', name: 'Potent Healing Magic', description: 'Repair wounds, stabilize life, and accelerate recovery.' }],
  },
};

export function freshUniverseProfiles(path = 'rider'): UniverseProfiles {
  return {
    activeUniverse: 'empyrean',
    empyrean: { universe: 'empyrean', path, onboarded: false, points: 0, rankIndex: 0, completedEvents: [], stories: [] },
    prythian: { universe: 'prythian', onboarded: false, points: 0, rankIndex: 0, completedEvents: [], stories: [], distinctions: [] },
  };
}

export function prythianRankIndex(points: number): number {
  let index = 0;
  PRYTHIAN_THRESHOLDS.forEach((threshold, candidate) => { if (points >= threshold) index = candidate; });
  return index;
}
