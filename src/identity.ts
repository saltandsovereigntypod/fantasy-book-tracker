import { SIGNETS, createCreatureAssignment, stableNumber, type CreatureAssignment } from './assignments';

export type RiderSection = 'Flame' | 'Claw' | 'Tail';
export type FlierDrift = 'Summit Wing' | 'Nightwing Drift' | 'Seawing Drift';
export type FaeRole = 'high-fae' | 'lesser-fae' | 'illyrian';

export interface AbilityIdentity {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface IdentityAssignments {
  rider: {
    wing: number;
    section: RiderSection;
    squad: 1 | 2 | 3;
    signet?: AbilityIdentity;
    dragon?: CreatureAssignment;
  };
  gryphon: {
    drift: FlierDrift;
    gift?: AbilityIdentity;
    gryphon?: CreatureAssignment;
  };
  dark: {
    signet: AbilityIdentity;
    wyvern: CreatureAssignment;
  };
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function creature(value: unknown, kind: CreatureAssignment['kind']): CreatureAssignment | undefined {
  if (!isRecord(value) || value.kind !== kind || !value.name) return undefined;
  return {
    kind,
    name: String(value.name),
    color: String(value.color || (kind === 'wyvern' ? 'Grey' : '')),
    tail: value.tail ? String(value.tail) : undefined,
    flameColor: value.flameColor === 'Red' || value.flameColor === 'Green' || value.flameColor === 'Blue' ? value.flameColor : undefined,
    strength: Number.isFinite(Number(value.strength)) ? Number(value.strength) : undefined,
  };
}

function ability(value: unknown): AbilityIdentity | undefined {
  if (!isRecord(value) || !value.id || !value.name) return undefined;
  const definition = SIGNETS.find((item) => item.id === String(value.id));
  return {
    id: String(value.id),
    name: String(value.name),
    description: String(value.description || definition?.description || ''),
    category: String(value.category || definition?.category || 'Unknown'),
  };
}

function legacyAbility(source: RecordLike): AbilityIdentity | undefined {
  if (!source.abilityId || !source.abilityName) return undefined;
  const definition = SIGNETS.find((item) => item.id === String(source.abilityId));
  return {
    id: String(source.abilityId),
    name: String(source.abilityName),
    description: String(source.abilityDescription || definition?.description || ''),
    category: definition?.category || 'Unknown',
  };
}

function chooseDarkSignet(seed: string, riderSignet?: AbilityIdentity): AbilityIdentity {
  let pool = SIGNETS.filter((item) => item.paths.includes('dark'));
  if (riderSignet) {
    pool = pool.filter((item) => item.id !== riderSignet.id && item.category !== riderSignet.category);
  }
  if (!pool.length) pool = SIGNETS.filter((item) => item.paths.includes('dark') && item.id !== riderSignet?.id);
  const selected = pool[stableNumber(`${seed}:dark-signet`) % pool.length] || SIGNETS[0];
  return { id: selected.id, name: selected.name, description: selected.description, category: selected.category };
}

export function stableFaeRole(seed: string): FaeRole {
  return (['high-fae', 'lesser-fae', 'illyrian'] as const)[stableNumber(`${seed}:fae-role`) % 3];
}

export function normalizeIdentityAssignments(value: unknown, profileSource: RecordLike, seed: string): IdentityAssignments {
  const raw = isRecord(value) ? value : {};
  const rawRider = isRecord(raw.rider) ? raw.rider : {};
  const rawGryphon = isRecord(raw.gryphon) ? raw.gryphon : {};
  const rawDark = isRecord(raw.dark) ? raw.dark : {};
  const progression = isRecord(profileSource.progression) ? profileSource.progression : {};
  const legacyRiderUnit = isRecord(progression.riderUnit) ? progression.riderUnit : {};
  const path = String(profileSource.path || 'rider');
  const sharedAbility = legacyAbility(profileSource);
  const sharedCreature = creature(profileSource.creature, profileSource.creature && isRecord(profileSource.creature) && profileSource.creature.kind === 'gryphon' ? 'gryphon' : profileSource.creature && isRecord(profileSource.creature) && profileSource.creature.kind === 'wyvern' ? 'wyvern' : 'dragon');

  const valueNumber = stableNumber(`${seed}:service-assignment`);
  const riderSignet = ability(rawRider.signet) || (path === 'rider' ? sharedAbility : undefined);
  const riderDragon = creature(rawRider.dragon, 'dragon') || (path === 'rider' && sharedCreature?.kind === 'dragon' ? sharedCreature : undefined);
  const gryphonGift = ability(rawGryphon.gift) || (path === 'gryphon' ? sharedAbility : undefined);
  const gryphonCreature = creature(rawGryphon.gryphon, 'gryphon') || (path === 'gryphon' && sharedCreature?.kind === 'gryphon' ? sharedCreature : undefined);

  let darkSignet = ability(rawDark.signet) || (path === 'dark' ? sharedAbility : undefined);
  if (!darkSignet || (riderSignet && (darkSignet.id === riderSignet.id || darkSignet.category === riderSignet.category))) {
    darkSignet = chooseDarkSignet(seed, riderSignet);
  }

  const usedNames = [riderDragon?.name, gryphonCreature?.name].filter((name): name is string => Boolean(name));
  let darkWyvern = creature(rawDark.wyvern, 'wyvern') || (path === 'dark' && sharedCreature?.kind === 'wyvern' ? sharedCreature : undefined);
  if (!darkWyvern || usedNames.some((name) => name.toLocaleLowerCase() === darkWyvern?.name.toLocaleLowerCase())) {
    darkWyvern = createCreatureAssignment('wyvern', usedNames, `${seed}:dark-wyvern`);
  }

  const wing = Number(rawRider.wing || legacyRiderUnit.wing || ((valueNumber % 4) + 1));
  const sectionValue = String(rawRider.section || legacyRiderUnit.section || (['Flame', 'Claw', 'Tail'] as const)[Math.floor(valueNumber / 4) % 3]);
  const squadValue = Number(rawRider.squad || legacyRiderUnit.squad || ((Math.floor(valueNumber / 12) % 3) + 1));
  const driftValue = String(rawGryphon.drift || progression.flierServiceWing || (['Summit Wing', 'Nightwing Drift', 'Seawing Drift'] as const)[valueNumber % 3]);

  return {
    rider: {
      wing: Math.min(4, Math.max(1, Math.round(wing))),
      section: sectionValue === 'Claw' || sectionValue === 'Tail' ? sectionValue : 'Flame',
      squad: (squadValue === 2 || squadValue === 3 ? squadValue : 1) as 1 | 2 | 3,
      signet: riderSignet,
      dragon: riderDragon,
    },
    gryphon: {
      drift: driftValue === 'Nightwing Drift' || driftValue === 'Seawing Drift' ? driftValue : 'Summit Wing',
      gift: gryphonGift,
      gryphon: gryphonCreature,
    },
    dark: {
      signet: darkSignet,
      wyvern: darkWyvern,
    },
  };
}
