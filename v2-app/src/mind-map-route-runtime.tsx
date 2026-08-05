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

let mountedTarget: HTMLElement | null = null;
let mountedRoot: Root | null = null;
let scheduled = false;

function syncMindMapRoute() {
  scheduled = false;
  const target = document.querySelector<HTMLElement>('.v2-view--mindmap');
  if (!target) {
    if (mountedRoot) mountedRoot.unmount();
    mountedRoot = null;
    mountedTarget = null;
    return;
  }
  if (mountedTarget === target && mountedRoot) return;
  if (mountedRoot) mountedRoot.unmount();
  target.replaceChildren();
  const host = document.createElement('div');
  host.className = 'v2-mind-map-route-root';
  target.appendChild(host);
  mountedTarget = target;
  mountedRoot = createRoot(host);
  mountedRoot.render(<StrictMode><MindMapRoute /></StrictMode>);
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(syncMindMapRoute);
}

function mutationTouchesMindMap(mutation: MutationRecord): boolean {
  if (mountedTarget && !mountedTarget.isConnected) return true;
  const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
  return nodes.some((node) => node instanceof Element && (node.matches('.v2-view--mindmap') || Boolean(node.querySelector('.v2-view--mindmap'))));
}

const observer = new MutationObserver((mutations) => {
  if (mutations.some(mutationTouchesMindMap)) scheduleSync();
});

function startMindMapRoute() {
  scheduleSync();
  const root = document.getElementById('root');
  if (root) observer.observe(root, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMindMapRoute, { once: true });
else startMindMapRoute();
