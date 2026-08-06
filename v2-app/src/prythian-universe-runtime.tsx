import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import { PATH_IDS, PATHS, rankIndexForPoints, type PathId } from './paths';
import { PRYTHIAN_COURT_IDS, PRYTHIAN_COURTS, freshUniverseProfiles, type PrythianCourtId, type UniverseId, type UniverseProfiles } from './universes';
import './prythian-universe-runtime.css';

type ArchiveWithUniverses = V2ArchiveState & { universes?: UniverseProfiles };

const THEME_KEYS = ['--v2-bg','--v2-panel','--v2-panel-raised','--v2-border','--v2-border-strong','--v2-text','--v2-muted','--v2-accent','--v2-accent-bright','--path-background','--path-panel','--path-panel-alt','--path-surface','--path-text','--path-muted','--path-accent','--path-accent-soft','--path-border','--path-paper'] as const;
const originalTheme = new Map<string, string>();
let originalsCaptured = false;

function profilesFor(archive: ArchiveWithUniverses): UniverseProfiles {
  if (archive.universes?.empyrean && archive.universes?.prythian) return archive.universes;
  const fresh = freshUniverseProfiles(String(archive.profile.path || 'rider'));
  fresh.empyrean.onboarded = Boolean(archive.profile.onboarded);
  fresh.empyrean.points = Number(archive.profile.points) || 0;
  fresh.empyrean.rankIndex = Number(archive.profile.rankIndex) || 0;
  return fresh;
}

function captureTheme(app: HTMLElement) {
  if (originalsCaptured) return;
  THEME_KEYS.forEach((key) => originalTheme.set(key, app.style.getPropertyValue(key)));
  originalsCaptured = true;
}

function restoreEmpyrean(pathId: PathId) {
  const app = document.querySelector<HTMLElement>('.core-path-app');
  if (!app) return;
  THEME_KEYS.forEach((key) => {
    const value = originalTheme.get(key) || '';
    if (value) app.style.setProperty(key, value);
    else app.style.removeProperty(key);
  });
  app.dataset.path = pathId;
  document.documentElement.dataset.path = pathId;
  document.body.dataset.path = pathId;
  document.documentElement.dataset.universe = 'empyrean';
  document.body.dataset.universe = 'empyrean';
  delete document.documentElement.dataset.court;
  delete document.body.dataset.court;
}

function applyCourt(courtId: PrythianCourtId) {
  const app = document.querySelector<HTMLElement>('.core-path-app');
  if (!app) return;
  captureTheme(app);
  const court = PRYTHIAN_COURTS[courtId];
  const values: Record<string, string> = {
    '--v2-bg': court.theme.background, '--v2-panel': court.theme.panel, '--v2-panel-raised': court.theme.panelAlt,
    '--v2-border': court.theme.border, '--v2-border-strong': court.theme.accent, '--v2-text': court.theme.text,
    '--v2-muted': court.theme.muted, '--v2-accent': court.theme.accent, '--v2-accent-bright': court.theme.accent,
    '--path-background': court.theme.background, '--path-panel': court.theme.panel, '--path-panel-alt': court.theme.panelAlt,
    '--path-surface': court.theme.surface, '--path-text': court.theme.text, '--path-muted': court.theme.muted,
    '--path-accent': court.theme.accent, '--path-accent-soft': court.theme.accentSoft, '--path-border': court.theme.border,
    '--path-paper': court.theme.paper,
  };
  Object.entries(values).forEach(([key, value]) => app.style.setProperty(key, value));
  document.documentElement.dataset.universe = 'prythian';
  document.body.dataset.universe = 'prythian';
  document.documentElement.dataset.court = courtId;
  document.body.dataset.court = courtId;
}

function updateCopy(universe: UniverseId, courtId?: PrythianCourtId) {
  if (universe !== 'prythian' || !courtId) return;
  const court = PRYTHIAN_COURTS[courtId];
  const brand = document.querySelector<HTMLElement>('.v2-brand strong');
  if (brand) brand.textContent = `${court.glyph} ${court.name}`;
  const labels = ['Court Hall', 'Chronicles', 'Whispers & Prophecies', 'Court Intrigue', 'Mind Map', 'Court Record'];
  [...document.querySelectorAll<HTMLButtonElement>('.v2-app-sidebar nav button')].forEach((button, index) => {
    const icon = button.querySelector('span')?.textContent || '';
    button.textContent = '';
    const span = document.createElement('span');
    span.textContent = icon;
    button.append(span, document.createTextNode(labels[index] || ''));
  });
}

function UniverseManager() {
  const [archive, setArchive] = useState<ArchiveWithUniverses | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    const syncVisible = () => setVisible(Boolean(document.querySelector('.v2-view--profile')));
    syncVisible();
    const observer = new MutationObserver(syncVisible);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const loaded = await loadCloudArchive(user) as ArchiveWithUniverses;
      if (!active) return;
      const universes = profilesFor(loaded);
      const normalized = { ...loaded, universes };
      setArchive(normalized);
      if (universes.activeUniverse === 'prythian' && universes.prythian.court) applyCourt(universes.prythian.court);
      else restoreEmpyrean((loaded.profile.path || universes.empyrean.path || 'rider') as PathId);
      updateCopy(universes.activeUniverse, universes.prythian.court);
    }).catch(() => undefined);
    return () => { active = false; observer.disconnect(); };
  }, []);

  const universes = useMemo(() => archive ? profilesFor(archive) : null, [archive]);

  async function persist(nextUniverses: UniverseProfiles, message: string, profileChanges?: Partial<V2ArchiveState['profile']>) {
    if (!archive) return;
    const next = {
      ...archive,
      profile: profileChanges ? { ...archive.profile, ...profileChanges } : archive.profile,
      universes: nextUniverses,
      updatedAt: new Date().toISOString(),
    };
    setArchive(next);
    saveLocalArchive(next);
    setStatus(message);
    try {
      const { user } = await getAuthSnapshot();
      if (user) await saveCloudArchive(user, next);
    } catch {
      setStatus(`${message} Cloud sync is still pending.`);
    }
  }

  async function chooseUniverse(universe: UniverseId) {
    if (!universes || !archive) return;
    const next = { ...universes, activeUniverse: universe };
    if (universe === 'prythian') {
      const courtId = next.prythian.court || 'night';
      next.prythian = { ...next.prythian, court: courtId };
      applyCourt(courtId);
      updateCopy('prythian', courtId);
      await persist(next, `Entered ${PRYTHIAN_COURTS[courtId].name}.`);
    } else {
      const pathId = (archive.profile.path || next.empyrean.path || 'rider') as PathId;
      restoreEmpyrean(pathId);
      await persist(next, `Returned to ${PATHS[pathId].name}.`);
    }
  }

  async function choosePath(pathId: PathId) {
    if (!universes || !archive) return;
    const points = Number(archive.profile.points) || 0;
    const rankIndex = rankIndexForPoints(pathId, points);
    const next: UniverseProfiles = {
      ...universes,
      activeUniverse: 'empyrean',
      empyrean: { ...universes.empyrean, path: pathId, points, rankIndex },
    };
    restoreEmpyrean(pathId);
    await persist(next, `Your Empyrean path is now ${PATHS[pathId].name}.`, { path: pathId, rankIndex });
  }

  async function chooseCourt(courtId: PrythianCourtId) {
    if (!universes) return;
    const next: UniverseProfiles = {
      ...universes,
      activeUniverse: 'prythian',
      prythian: { ...universes.prythian, court: courtId },
    };
    applyCourt(courtId);
    updateCopy('prythian', courtId);
    await persist(next, `Your allegiance is now with the ${PRYTHIAN_COURTS[courtId].name}.`);
  }

  if (!visible || !archive || !universes) return null;

  const activePathId = (archive.profile.path || universes.empyrean.path || 'rider') as PathId;
  const activeCourtId = universes.prythian.court || 'night';
  const activePath = PATHS[activePathId];
  const activeCourt = PRYTHIAN_COURTS[activeCourtId];

  return <section className="prythian-universe-panel">
    <header><div><p>Story universe</p><h2>Choose the world your story follows</h2><span>Your books, points, theories, walls, and card designs remain account-wide.</span></div></header>
    <div className="universe-selector-grid">
      <label>Universe
        <select value={universes.activeUniverse} onChange={(event) => void chooseUniverse(event.target.value as UniverseId)}>
          <option value="empyrean">The Empyrean</option>
          <option value="prythian">Prythian</option>
        </select>
      </label>
      {universes.activeUniverse === 'empyrean' ? <label>Path
        <select value={activePathId} onChange={(event) => void choosePath(event.target.value as PathId)}>
          {PATH_IDS.map((id) => <option key={id} value={id}>{PATHS[id].name}</option>)}
        </select>
      </label> : <label>Court
        <select value={activeCourtId} onChange={(event) => void chooseCourt(event.target.value as PrythianCourtId)}>
          {PRYTHIAN_COURT_IDS.map((id) => <option key={id} value={id}>{PRYTHIAN_COURTS[id].name}</option>)}
        </select>
      </label>}
    </div>
    {universes.activeUniverse === 'empyrean' ? <div className="prythian-court-heading"><div><p>Current path</p><h3>{activePath.glyph} {activePath.name}</h3><span>{activePath.short} · {activePath.progressName} progression</span></div><aside><strong>Your assignment remains intact</strong><small>Changing paths preserves your books, points, stories, and saved assignment data.</small></aside></div> : <div className="prythian-court-heading"><div><p>Current court</p><h3>{activeCourt.glyph} {activeCourt.name}</h3><span>{activeCourt.family === 'solar' ? 'Solar Court' : 'Seasonal Court'} · Ruled by {activeCourt.ruler}</span></div><aside><strong>Power assessment sealed</strong><small>The court questionnaire will determine your primary gift and rare affinity next.</small></aside></div>}
    {status && <footer>{status}</footer>}
  </section>;
}

function start() {
  const host = document.createElement('div');
  host.id = 'prythian-universe-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><UniverseManager /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
