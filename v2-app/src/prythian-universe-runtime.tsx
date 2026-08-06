import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import { PRYTHIAN_COURT_IDS, PRYTHIAN_COURTS, freshUniverseProfiles, type PrythianCourtId, type UniverseId, type UniverseProfiles } from './universes';
import './prythian-universe-runtime.css';

type ArchiveWithUniverses = V2ArchiveState & { universes?: UniverseProfiles };

const THEME_KEYS = ['--v2-bg','--v2-panel','--v2-panel-raised','--v2-border','--v2-border-strong','--v2-text','--v2-muted','--v2-accent','--v2-accent-bright','--path-background','--path-panel','--path-panel-alt','--path-surface','--path-text','--path-muted','--path-accent','--path-accent-soft','--path-border','--path-paper'] as const;
const originalTheme = new Map<string, string>();
let originalsCaptured = false;

function profilesFor(archive: ArchiveWithUniverses): UniverseProfiles {
  const existing = archive.universes;
  if (existing?.empyrean && existing?.prythian) return existing;
  const fresh = freshUniverseProfiles(String(archive.profile.path || 'rider'));
  fresh.empyrean.onboarded = Boolean(archive.profile.onboarded);
  fresh.empyrean.points = Number(archive.profile.points) || 0;
  fresh.empyrean.rankIndex = Number(archive.profile.rankIndex) || 0;
  return fresh;
}

function captureOriginalTheme(app: HTMLElement) {
  if (originalsCaptured) return;
  THEME_KEYS.forEach((key) => originalTheme.set(key, app.style.getPropertyValue(key)));
  originalsCaptured = true;
}

function restoreEmpyreanTheme() {
  const app = document.querySelector<HTMLElement>('.core-path-app');
  if (!app) return;
  THEME_KEYS.forEach((key) => {
    const value = originalTheme.get(key) || '';
    if (value) app.style.setProperty(key, value);
    else app.style.removeProperty(key);
  });
  document.documentElement.dataset.universe = 'empyrean';
  document.body.dataset.universe = 'empyrean';
  delete document.documentElement.dataset.court;
  delete document.body.dataset.court;
}

function applyCourtTheme(courtId: PrythianCourtId) {
  const app = document.querySelector<HTMLElement>('.core-path-app');
  if (!app) return;
  captureOriginalTheme(app);
  const court = PRYTHIAN_COURTS[courtId];
  const values: Record<string, string> = {
    '--v2-bg': court.theme.background,
    '--v2-panel': court.theme.panel,
    '--v2-panel-raised': court.theme.panelAlt,
    '--v2-border': court.theme.border,
    '--v2-border-strong': court.theme.accent,
    '--v2-text': court.theme.text,
    '--v2-muted': court.theme.muted,
    '--v2-accent': court.theme.accent,
    '--v2-accent-bright': court.theme.accent,
    '--path-background': court.theme.background,
    '--path-panel': court.theme.panel,
    '--path-panel-alt': court.theme.panelAlt,
    '--path-surface': court.theme.surface,
    '--path-text': court.theme.text,
    '--path-muted': court.theme.muted,
    '--path-accent': court.theme.accent,
    '--path-accent-soft': court.theme.accentSoft,
    '--path-border': court.theme.border,
    '--path-paper': court.theme.paper,
  };
  Object.entries(values).forEach(([key, value]) => app.style.setProperty(key, value));
  document.documentElement.dataset.universe = 'prythian';
  document.body.dataset.universe = 'prythian';
  document.documentElement.dataset.court = courtId;
  document.body.dataset.court = courtId;
}

function replaceVisibleCopy(universe: UniverseId, courtId?: PrythianCourtId) {
  const court = courtId ? PRYTHIAN_COURTS[courtId] : null;
  const brand = document.querySelector<HTMLElement>('.v2-brand strong');
  const nav = [...document.querySelectorAll<HTMLButtonElement>('.v2-app-sidebar nav button')];
  if (universe === 'prythian' && court) {
    if (brand) brand.textContent = `${court.glyph} ${court.name}`;
    const labels = ['Court Hall', 'Chronicles', 'Whispers & Prophecies', 'Court Intrigue', 'Mind Map', 'Court Record'];
    nav.forEach((button, index) => {
      const icon = button.querySelector('span')?.textContent || '';
      button.textContent = '';
      const span = document.createElement('span'); span.textContent = icon;
      button.append(span, document.createTextNode(labels[index] || button.textContent || ''));
    });
  }
}

function PrythianUniverseManager() {
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
      const next = await loadCloudArchive(user) as ArchiveWithUniverses;
      if (!active) return;
      const universes = profilesFor(next);
      const normalized = { ...next, universes };
      setArchive(normalized);
      if (universes.activeUniverse === 'prythian' && universes.prythian.court) applyCourtTheme(universes.prythian.court);
      else restoreEmpyreanTheme();
      replaceVisibleCopy(universes.activeUniverse, universes.prythian.court);
    }).catch(() => undefined);
    return () => { active = false; observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!archive) return;
    const universes = profilesFor(archive);
    const refresh = () => replaceVisibleCopy(universes.activeUniverse, universes.prythian.court);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [archive]);

  const universes = useMemo(() => archive ? profilesFor(archive) : null, [archive]);

  async function persist(nextUniverses: UniverseProfiles, message: string) {
    if (!archive) return;
    const next = { ...archive, universes: nextUniverses, updatedAt: new Date().toISOString() };
    setArchive(next);
    saveLocalArchive(next);
    setStatus('Saving…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudArchive(user, next);
      setStatus(message);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'The universe profile could not be saved.');
    }
  }

  async function chooseUniverse(universe: UniverseId) {
    if (!universes || universe === universes.activeUniverse) return;
    const next = { ...universes, activeUniverse: universe };
    if (universe === 'prythian' && next.prythian.court) applyCourtTheme(next.prythian.court);
    else restoreEmpyreanTheme();
    replaceVisibleCopy(universe, next.prythian.court);
    await persist(next, universe === 'prythian' ? 'Entered Prythian.' : 'Returned to the Empyrean.');
  }

  async function chooseCourt(courtId: PrythianCourtId) {
    if (!universes) return;
    const court = PRYTHIAN_COURTS[courtId];
    const next: UniverseProfiles = {
      ...universes,
      activeUniverse: 'prythian',
      prythian: { ...universes.prythian, court: courtId },
    };
    applyCourtTheme(courtId);
    replaceVisibleCopy('prythian', courtId);
    await persist(next, `Your allegiance is now with the ${court.name}.`);
  }

  if (!visible || !archive || !universes) return null;
  const activeCourt = universes.prythian.court ? PRYTHIAN_COURTS[universes.prythian.court] : null;

  return <section className="prythian-universe-panel">
    <header><div><p>Story universe</p><h2>Choose the world your story follows</h2><span>Your books, points, theories, walls, and card designs remain account-wide.</span></div></header>
    <div className="prythian-universe-tabs">
      <button className={universes.activeUniverse === 'empyrean' ? 'is-active' : ''} onClick={() => void chooseUniverse('empyrean')}><span>🐉</span><strong>The Empyrean</strong><small>Your existing path, creature, signet, and rank story</small></button>
      <button className={universes.activeUniverse === 'prythian' ? 'is-active' : ''} onClick={() => void chooseUniverse('prythian')}><span>✦</span><strong>Prythian</strong><small>Your court, magic, distinctions, and court story</small></button>
    </div>
    {universes.activeUniverse === 'prythian' && <>
      <div className="prythian-court-heading"><div><p>Court allegiance</p><h3>{activeCourt ? `${activeCourt.glyph} ${activeCourt.name}` : 'Choose your court'}</h3>{activeCourt && <span>{activeCourt.family === 'solar' ? 'Solar Court' : 'Seasonal Court'} · Ruled by {activeCourt.ruler}</span>}</div>{activeCourt && <aside><strong>Power assessment sealed</strong><small>The court questionnaire will determine your primary gift and rare affinity next.</small></aside>}</div>
      <div className="prythian-court-grid">{PRYTHIAN_COURT_IDS.map((id) => { const court = PRYTHIAN_COURTS[id]; return <button key={id} className={activeCourt?.id === id ? 'is-active' : ''} style={{ '--court-accent': court.theme.accent, '--court-soft': court.theme.accentSoft } as React.CSSProperties} onClick={() => void chooseCourt(id)}><span>{court.glyph}</span><strong>{court.name}</strong><small>{court.family === 'solar' ? 'Solar' : 'Seasonal'} · {court.ruler}</small><em>{court.powers.map((power) => power.name).join(' · ')}</em></button>; })}</div>
    </>}
    {status && <footer>{status}</footer>}
  </section>;
}

function start() {
  const host = document.createElement('div');
  host.id = 'prythian-universe-runtime';
  document.querySelector('.v2-view--profile')?.prepend(host);
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><PrythianUniverseManager /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
