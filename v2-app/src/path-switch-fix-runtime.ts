import { chooseAbility, createCreatureAssignment } from './assignments';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS, PATH_IDS, rankIndexForPoints, type PathId } from './paths';
import type { TraitScores } from './questionnaire';
import { getAuthSnapshot } from './supabase';

type ExtendedProfile = V2ArchiveState['profile'] & {
  abilityId?: string;
  abilityName?: string;
  abilityDescription?: string;
  creature?: ReturnType<typeof createCreatureAssignment>;
  traitScores?: TraitScores;
  onboardingVersion?: number;
};

let switching = false;

async function switchPath(nextPath: PathId): Promise<void> {
  if (switching) return;
  switching = true;
  document.querySelectorAll<HTMLButtonElement>('[data-v2-path]').forEach((button) => { button.disabled = true; });

  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('Your session expired. Please sign in again.');

    const archive = await loadCloudArchive(user);
    if (archive.profile.path === nextPath) return;

    const current = archive.profile as ExtendedProfile;
    const seed = `${user.id}:path:${nextPath}`;
    const ability = current.traitScores ? chooseAbility(nextPath, current.traitScores, seed) : null;
    const definition = PATHS[nextPath];
    const creature = definition.creatureKind
      ? createCreatureAssignment(definition.creatureKind, [], seed)
      : undefined;

    const profile: ExtendedProfile = {
      ...current,
      path: nextPath,
      rankIndex: rankIndexForPoints(nextPath, current.points || 0),
    };

    if (ability) {
      profile.abilityId = ability.id;
      profile.abilityName = ability.name;
      profile.abilityDescription = ability.description;
    } else {
      delete profile.abilityId;
      delete profile.abilityName;
      delete profile.abilityDescription;
    }

    if (creature) profile.creature = creature;
    else delete profile.creature;

    const next: V2ArchiveState = {
      ...archive,
      profile,
      updatedAt: new Date().toISOString(),
    };

    saveLocalArchive(next);
    await saveCloudArchive(user, next);
    window.location.reload();
  } catch (reason) {
    switching = false;
    document.querySelectorAll<HTMLButtonElement>('[data-v2-path]').forEach((button) => { button.disabled = false; });
    window.alert(reason instanceof Error ? reason.message : 'Your path could not be changed.');
  }
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('[data-v2-path]');
  if (!button) return;

  const value = button.dataset.v2Path;
  if (!value || !PATH_IDS.includes(value as PathId)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  void switchPath(value as PathId);
}, true);
