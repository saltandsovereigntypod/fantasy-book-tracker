import { loadLocalArchive } from './archive';

/**
 * Apply the persisted universe identity before React mounts so the first painted
 * frame, global atmosphere selectors, and portal-based tools all agree on the
 * same universe. CoreFullApp remains the owner after mount.
 */
export function bootstrapUniverse(): void {
  const archive = loadLocalArchive();
  const universe = archive.universes.activeUniverse;
  const court = archive.universes.prythian.court || 'night';
  const path = archive.universes.empyrean.path || archive.profile.path || 'rider';

  document.documentElement.dataset.universe = universe;
  document.body.dataset.universe = universe;

  if (universe === 'prythian') {
    document.documentElement.dataset.court = court;
    document.body.dataset.court = court;
    delete document.documentElement.dataset.path;
    delete document.body.dataset.path;
  } else {
    document.documentElement.dataset.path = path;
    document.body.dataset.path = path;
    delete document.documentElement.dataset.court;
    delete document.body.dataset.court;
  }
}
