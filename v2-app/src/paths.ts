export const PATH_IDS = ['rider', 'scribe', 'gryphon', 'dark', 'infantry', 'healer'] as const;
export type PathId = typeof PATH_IDS[number];

export interface PathTheme {
  background: string;
  panel: string;
  panelAlt: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  border: string;
  paper: string;
}

export interface PathCopy {
  navDashboard: string;
  navLibrary: string;
  navSession: string;
  navTheories: string;
  navWall: string;
  navProfile: string;
  currentRank: string;
  heroTitle: string;
  heroBody: string;
  addBook: string;
  addTheory: string;
  startSession: string;
  completeBook: string;
  saveTheory: string;
  noBooks: string;
  noTheories: string;
  success: string;
}

export interface PathDefinition {
  id: PathId;
  name: string;
  short: string;
  glyph: string;
  creatureKind?: 'dragon' | 'gryphon' | 'wyvern';
  ranks: readonly string[];
  thresholds: readonly number[];
  progressName: string;
  event: string | null;
  bondedRank: number | null;
  copy: PathCopy;
  theme: PathTheme;
}

export const PATHS: Record<PathId, PathDefinition> = {
  rider: {
    id: 'rider', name: 'Dragon Rider', short: 'Riders Quadrant', glyph: '🐉', creatureKind: 'dragon',
    ranks: ['Candidate', 'Rider Cadet', 'Bonded Rider', 'Squad Leader', 'Section Leader', 'Wingleader'],
    thresholds: [0, 1000, 5000, 15000, 35000, 70000], progressName: 'Command', event: 'Threshing', bondedRank: 2,
    copy: { navDashboard: 'Command Hall', navLibrary: 'Campaigns', navSession: 'Reading Deployment', navTheories: 'Intelligence Ledger', navWall: 'Conspiracy Wall', navProfile: 'Service Record', currentRank: 'Current Rank', heroTitle: 'Every chapter is a battlefield. Read like your squad depends on it.', heroBody: 'Track the campaign, secure intelligence, and record every suspicion before it gets someone killed.', addBook: 'Assign New Campaign', addTheory: 'Record a Suspicion', startSession: 'Begin Deployment', completeBook: 'You survived the campaign.', saveTheory: 'Secure this intelligence', noBooks: 'No active campaigns are currently assigned.', noTheories: 'No suspicions have been entered. Dangerous.', success: 'Intelligence secured.' },
    theme: { background: '#0c0c0d', panel: '#141416', panelAlt: '#1a1a1d', surface: '#202024', text: '#f5f2ea', muted: '#aaa59b', accent: '#8f1f2f', accentSoft: 'rgba(143,31,47,.18)', border: '#343238', paper: '#d8c4a4' }
  },
  scribe: {
    id: 'scribe', name: 'Scribe', short: 'Scribe Quadrant', glyph: '🪶',
    ranks: ['Scribe Candidate', 'Scribe Cadet', 'Archivist', 'Senior Archivist', 'Royal Archivist', 'Curator'],
    thresholds: [0, 1000, 4500, 14000, 32000, 65000], progressName: 'Scholarly Standing', event: null, bondedRank: null,
    copy: { navDashboard: 'Central Archive', navLibrary: 'Catalogued Volumes', navSession: 'Text Examination', navTheories: 'Hypothesis Register', navWall: 'Evidence Map', navProfile: 'Archival Record', currentRank: 'Current Appointment', heroTitle: 'Preserve the record. Separate testimony from truth.', heroBody: 'Catalog each volume, document every contradiction, and allow no unsupported claim to pass into history.', addBook: 'Catalogue New Volume', addTheory: 'Enter Working Hypothesis', startSession: 'Resume Examination', completeBook: 'This volume has been fully documented.', saveTheory: 'Enter into the archive', noBooks: 'No volumes have been entered into the catalogue.', noTheories: 'No supporting record currently exists.', success: 'Historical record amended.' },
    theme: { background: '#100e0b', panel: '#1b1711', panelAlt: '#241e16', surface: '#2d261d', text: '#f4ead7', muted: '#b8aa91', accent: '#b8863b', accentSoft: 'rgba(184,134,59,.18)', border: '#423725', paper: '#dbcaa8' }
  },
  gryphon: {
    id: 'gryphon', name: 'Gryphon Flier', short: 'Poromiel Drift', glyph: '🦅', creatureKind: 'gryphon',
    ranks: ['Flier Candidate', 'Flier Cadet', 'Bonded Flier', 'Driftleader', 'Wing Captain', 'Flight Commander'],
    thresholds: [0, 1000, 5000, 15000, 35000, 70000], progressName: 'Defiance', event: 'The Leap', bondedRank: 2,
    copy: { navDashboard: 'Rebel Command', navLibrary: 'Liberated Stories', navSession: 'Field Reading', navTheories: 'Counter-Narratives', navWall: 'The Real Story', navProfile: 'Rebel Record', currentRank: 'Current Standing', heroTitle: 'Question the official story. Someone is always lying.', heroBody: 'Read between sanctioned lines, dismantle convenient narratives, and preserve the evidence they hoped you would miss.', addBook: 'Seize Another Story', addTheory: 'Challenge the Record', startSession: 'Return to the Field', completeBook: 'Another sanctioned narrative dismantled.', saveTheory: 'Add it to the real story', noBooks: 'No stories have been liberated yet.', noTheories: 'No one has challenged the official version. Suspicious.', success: 'The real story has been updated.' },
    theme: { background: '#0b1012', panel: '#121b1f', panelAlt: '#182329', surface: '#213037', text: '#eef4f2', muted: '#9dafad', accent: '#3c9a91', accentSoft: 'rgba(60,154,145,.18)', border: '#2e4247', paper: '#d2c8ad' }
  },
  dark: {
    id: 'dark', name: 'Dark Wielder', short: 'The Source Below', glyph: '🐲', creatureKind: 'wyvern',
    ranks: ['Initiate', 'Asim', 'Sage', 'Maven'], thresholds: [0, 20000, 75000, 200000], progressName: 'Power', event: 'First Channeling', bondedRank: 0,
    copy: { navDashboard: 'The Hollow', navLibrary: 'Worlds Consumed', navSession: 'Feeding', navTheories: 'Whispered Truths', navWall: 'The Web', navProfile: 'Corruption Record', currentRank: 'Current Ascension', heroTitle: 'Feed the suspicion. Let the story show you where it bleeds.', heroBody: 'Consume worlds, bind contradictions, and follow every delicious fracture in the truth.', addBook: 'Choose Another World', addTheory: 'Feed the Suspicion', startSession: 'Begin Feeding', completeBook: 'Delicious. Another world consumed.', saveTheory: 'Bind it to the web', noBooks: 'No worlds have been offered to the hunger.', noTheories: 'The silence has not begun whispering yet.', success: 'The web tightens.' },
    theme: { background: '#09080c', panel: '#141019', panelAlt: '#1c1523', surface: '#271c30', text: '#f1eaf4', muted: '#aa9caf', accent: '#7d4aa0', accentSoft: 'rgba(125,74,160,.2)', border: '#3e2b49', paper: '#cbbbc8' }
  },
  infantry: {
    id: 'infantry', name: 'Infantry', short: 'Infantry Quadrant', glyph: '🛡️',
    ranks: ['Infantry Recruit', 'Infantry Cadet', 'Squad Corporal', 'Squad Sergeant', 'Company Captain', 'Battalion Commander'],
    thresholds: [0, 1000, 4500, 14000, 32000, 65000], progressName: 'Merit', event: null, bondedRank: null,
    copy: { navDashboard: 'Field Command', navLibrary: 'Campaign Log', navSession: 'Active Deployment', navTheories: 'Field Intelligence', navWall: 'Tactical Board', navProfile: 'Service Record', currentRank: 'Current Rank', heroTitle: 'Hold the line. Slow progress is still ground taken.', heroBody: 'Advance one page at a time, log field intelligence, and return to formation whenever life interrupts the campaign.', addBook: 'Assign Objective', addTheory: 'Log Field Intelligence', startSession: 'Begin Deployment', completeBook: 'Objective secured.', saveTheory: 'Submit field intelligence', noBooks: 'No objectives are currently assigned.', noTheories: 'No field intelligence has been logged.', success: 'Transmission secured.' },
    theme: { background: '#0c100d', panel: '#151b16', panelAlt: '#1d251f', surface: '#273129', text: '#eef1e8', muted: '#a4ad9d', accent: '#6f8755', accentSoft: 'rgba(111,135,85,.19)', border: '#384438', paper: '#d1c7aa' }
  },
  healer: {
    id: 'healer', name: 'Healer', short: 'Healer Quadrant', glyph: '⚕️',
    ranks: ['Healer Candidate', 'Healer Cadet', 'Field Healer', 'Senior Healer', 'Master Healer', 'Chief Healer'],
    thresholds: [0, 1000, 4500, 14000, 32000, 65000], progressName: 'Mastery', event: null, bondedRank: null,
    copy: { navDashboard: 'Healer Station', navLibrary: 'Case Records', navSession: 'Active Assessment', navTheories: 'Diagnostic Notes', navWall: 'Diagnostic Board', navProfile: 'Clinical Record', currentRank: 'Current Appointment', heroTitle: 'Observe carefully. What others dismiss may reveal the entire wound.', heroBody: 'Track every symptom, contradiction, recovery, and emotional consequence without mistaking urgency for understanding.', addBook: 'Open New Case', addTheory: 'Record Possible Cause', startSession: 'Resume Assessment', completeBook: 'Assessment complete. Emotional condition pending.', saveTheory: 'Add to the assessment', noBooks: 'No active cases are currently open.', noTheories: 'No possible causes have been recorded.', success: 'Assessment updated.' },
    theme: { background: '#0b1010', panel: '#121b1a', panelAlt: '#182422', surface: '#21302d', text: '#edf4f1', muted: '#9eafaa', accent: '#4c9a82', accentSoft: 'rgba(76,154,130,.18)', border: '#30443e', paper: '#d3cbb7' }
  }
};

export function isPathId(value: unknown): value is PathId { return typeof value === 'string' && PATH_IDS.includes(value as PathId); }
export function pathFor(value: unknown): PathDefinition { return PATHS[isPathId(value) ? value : 'rider']; }
export function rankIndexForPoints(path: PathId, points: number): number {
  const thresholds = PATHS[path].thresholds;
  let index = 0;
  thresholds.forEach((threshold, candidate) => { if (points >= threshold) index = candidate; });
  return index;
}
export function unlockedRankIndexes(points: number): Record<PathId, number> {
  return Object.fromEntries(PATH_IDS.map((path) => [path, rankIndexForPoints(path, points)])) as Record<PathId, number>;
}
