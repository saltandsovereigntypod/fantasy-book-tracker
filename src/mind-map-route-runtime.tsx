import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { MindMapWorkspace } from './MindMapWorkspace';
import { getAuthSnapshot } from './supabase';
import './mind-map-line-style';

let cachedArchive: V2ArchiveState | null = null;
let cachedUserId = '';
let archiveLoad: Promise<V2ArchiveState> | null = null;
let pendingCloudArchive: V2ArchiveState | null = null;
let cloudSaveTimer: number | null = null;
let cloudSaveRunning = false;

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

async function flushCloudSave() {
  if (cloudSaveRunning || !pendingCloudArchive) return;
  cloudSaveRunning = true;
  const next = pendingCloudArchive;
  pendingCloudArchive = null;
  try {
    const { user } = await getAuthSnapshot();
    cachedUserId = user?.id || 'local';
    if (user) await saveCloudArchive(user, next);
  } catch (reason) {
    console.warn('Mind Map cloud save deferred after an error.', reason);
    pendingCloudArchive = cachedArchive;
  } finally {
    cloudSaveRunning = false;
    if (pendingCloudArchive) {
      if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = window.setTimeout(flushCloudSave, 2500);
    }
  }
}

function queueCloudSave(next: V2ArchiveState) {
  pendingCloudArchive = next;
  if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(flushCloudSave, 1400);
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
    queueCloudSave(next);
  }

  if (error) return <div className="v2-app-error" role="alert">{error}</div>;
  if (!archive) return <div className="v2-boot-screen"><span>✦</span><strong>Mapping the archive…</strong></div>;
  return <MindMapWorkspace archive={archive} onSave={save} />;
}

let overlayHost: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;
let activeTarget: HTMLElement | null = null;
let scheduled = false;
let targetResizeObserver: ResizeObserver | null = null;
let wheelFrame = 0;
let wheelDelta = 0;

function ensureOverlayRoot() {
  if (overlayHost && overlayRoot) return;
  overlayHost = document.createElement('div');
  overlayHost.className = 'v2-mind-map-route-root v2-mind-map-route-overlay';
  overlayHost.hidden = true;
  Object.assign(overlayHost.style, {
    position: 'fixed', zIndex: '2147483000', overflow: 'auto', background: 'var(--ink, #160b08)', contain: 'layout paint', isolation: 'isolate',
  });
  document.body.appendChild(overlayHost);
  overlayRoot = createRoot(overlayHost);
  overlayRoot.render(<StrictMode><MindMapRoute /></StrictMode>);
}

function isVisibleView(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 20 && rect.height > 20;
}

function findVisibleMindMapTarget() {
  return [...document.querySelectorAll<HTMLElement>('.v2-view--mindmap')].find(isVisibleView) || null;
}

function positionOverlay() {
  if (!overlayHost || !activeTarget || !activeTarget.isConnected || !isVisibleView(activeTarget)) return;
  const rect = activeTarget.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const availableWidth = Math.max(0, window.innerWidth - left);
  const availableHeight = Math.max(0, window.innerHeight - top);
  overlayHost.style.left = `${left}px`;
  overlayHost.style.top = `${top}px`;
  overlayHost.style.width = `${Math.max(280, Math.min(rect.width || availableWidth, availableWidth))}px`;
  overlayHost.style.height = `${Math.max(240, Math.min(rect.height || availableHeight, availableHeight))}px`;
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
  const target = findVisibleMindMapTarget();
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
  if (target.style.minHeight !== 'calc(100vh - 150px)') target.style.minHeight = 'calc(100vh - 150px)';
  if (overlayHost) overlayHost.hidden = false;
  positionOverlay();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(syncMindMapRoute);
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    if (mutation.type === 'attributes') {
      if (!(mutation.target instanceof Element)) return false;
      const wasMindMap = String(mutation.oldValue || '').includes('v2-view--mindmap');
      const isAppView = mutation.target.matches('.v2-view') || Boolean(mutation.target.closest('.v2-view'));
      return wasMindMap || isAppView;
    }
    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node instanceof Element
      && (node.matches('.v2-view, .v2-view--mindmap') || Boolean(node.querySelector('.v2-view, .v2-view--mindmap'))));
  });
  if (relevant) scheduleSync();
});

function performWheelZoom() {
  wheelFrame = 0;
  const direction = wheelDelta > 0 ? '−' : '+';
  wheelDelta = 0;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mind-map-page--enhanced .mind-map-view-controls button')];
  buttons.find((item) => item.textContent?.trim() === direction)?.click();
}

function handleMindMapWheel(event: WheelEvent) {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('.mind-map-canvas')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  wheelDelta += event.deltaY;
  if (!wheelFrame) wheelFrame = window.requestAnimationFrame(performWheelZoom);
}

function startMindMapRoute() {
  scheduleSync();
  const root = document.getElementById('root');
  if (root) observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
  });
  window.addEventListener('resize', scheduleSync);
  window.addEventListener('scroll', positionOverlay, true);
  document.addEventListener('wheel', handleMindMapWheel, { passive: false, capture: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMindMapRoute, { once: true });
else startMindMapRoute();
