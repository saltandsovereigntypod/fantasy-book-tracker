import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { MindMapEnhanced } from './MindMapEnhanced';
import { getAuthSnapshot } from './supabase';
import './mind-map-line-style';

let cachedArchive: V2ArchiveState | null = null;
let cachedUserId = '';
let archiveLoad: Promise<V2ArchiveState> | null = null;

async function resolveArchive(): Promise<V2ArchiveState> {
  const { user } = await getAuthSnapshot();
  const userId = user?.id || 'local';
  if (cachedArchive && cachedUserId === userId) return cachedArchive;
  if (archiveLoad) return archiveLoad;
  archiveLoad = (user ? loadCloudArchive(user) : Promise.resolve(loadLocalArchive()))
    .then((next) => {
      cachedArchive = next;
      cachedUserId = userId;
      return next;
    })
    .finally(() => { archiveLoad = null; });
  return archiveLoad;
}

function MindMapRoute() {
  const [archive, setArchive] = useState<V2ArchiveState | null>(() => cachedArchive);
  const [error, setError] = useState('');

  useEffect(() => {
    if (archive) return;
    let active = true;
    resolveArchive()
      .then((next) => { if (active) setArchive(next); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'The mind map could not load.'); });
    return () => { active = false; };
  }, [archive]);

  async function save(next: V2ArchiveState) {
    cachedArchive = next;
    setArchive(next);
    saveLocalArchive(next);
    const { user } = await getAuthSnapshot();
    cachedUserId = user?.id || 'local';
    if (user) await saveCloudArchive(user, next);
  }

  if (error) return <div className="v2-app-error" role="alert">{error}</div>;
  if (!archive) return <div className="v2-boot-screen"><span>✦</span><strong>Mapping the archive…</strong></div>;
  return <MindMapEnhanced archive={archive} onSave={save} />;
}

let overlayHost: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;
let activeTarget: HTMLElement | null = null;
let scheduled = false;
let targetResizeObserver: ResizeObserver | null = null;

function ensureOverlayRoot() {
  if (overlayHost && overlayRoot) return;
  overlayHost = document.createElement('div');
  overlayHost.className = 'v2-mind-map-route-root v2-mind-map-route-overlay';
  overlayHost.hidden = true;
  Object.assign(overlayHost.style, {
    position: 'fixed',
    zIndex: '30',
    overflow: 'auto',
    background: 'var(--ink, #160b08)',
    contain: 'layout paint',
  });
  document.body.appendChild(overlayHost);
  overlayRoot = createRoot(overlayHost);
  overlayRoot.render(<StrictMode><MindMapRoute /></StrictMode>);
}

function positionOverlay() {
  if (!overlayHost || !activeTarget || !activeTarget.isConnected) return;
  const rect = activeTarget.getBoundingClientRect();
  overlayHost.style.left = `${Math.max(0, rect.left)}px`;
  overlayHost.style.top = `${Math.max(0, rect.top)}px`;
  overlayHost.style.width = `${Math.max(320, rect.width)}px`;
  overlayHost.style.height = `${Math.max(480, Math.min(rect.height || window.innerHeight - rect.top, window.innerHeight - Math.max(0, rect.top)))}px`;
}

function watchTarget(target: HTMLElement | null) {
  targetResizeObserver?.disconnect();
  targetResizeObserver = null;
  if (!target || typeof ResizeObserver === 'undefined') return;
  targetResizeObserver = new ResizeObserver(positionOverlay);
  targetResizeObserver.observe(target);
}

function syncMindMapRoute() {
  scheduled = false;
  const target = document.querySelector<HTMLElement>('.v2-view--mindmap');
  if (!target) {
    activeTarget = null;
    watchTarget(null);
    if (overlayHost) overlayHost.hidden = true;
    return;
  }

  ensureOverlayRoot();
  if (activeTarget !== target) {
    activeTarget = target;
    watchTarget(target);
  }
  target.style.minHeight = 'calc(100vh - 150px)';
  if (overlayHost) overlayHost.hidden = false;
  positionOverlay();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(syncMindMapRoute);
}

function mutationTouchesMindMap(mutation: MutationRecord): boolean {
  if (activeTarget && !activeTarget.isConnected) return true;
  const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
  return nodes.some((node) => node instanceof Element && (node.matches('.v2-view--mindmap') || Boolean(node.querySelector('.v2-view--mindmap'))));
}

const observer = new MutationObserver((mutations) => {
  if (mutations.some(mutationTouchesMindMap)) scheduleSync();
});

function blockPassiveMindMapWheel(event: WheelEvent) {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('.mind-map-canvas')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function startMindMapRoute() {
  scheduleSync();
  const root = document.getElementById('root');
  if (root) observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', positionOverlay);
  window.addEventListener('scroll', positionOverlay, true);
  document.addEventListener('wheel', blockPassiveMindMapWheel, { passive: false, capture: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMindMapRoute, { once: true });
else startMindMapRoute();
