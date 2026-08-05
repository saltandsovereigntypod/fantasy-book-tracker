import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { MindMap } from './MindMap';
import { getAuthSnapshot } from './supabase';

function MindMapRoute() {
  const [archive, setArchive] = useState<V2ArchiveState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAuthSnapshot().then(async ({ user }) => {
      const next = user ? await loadCloudArchive(user) : loadLocalArchive();
      if (active) setArchive(next);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'The mind map could not load.'); });
    return () => { active = false; };
  }, []);

  async function save(next: V2ArchiveState) {
    setArchive(next);
    saveLocalArchive(next);
    const { user } = await getAuthSnapshot();
    if (user) await saveCloudArchive(user, next);
  }

  if (error) return <div className="v2-app-error" role="alert">{error}</div>;
  if (!archive) return <div className="v2-boot-screen"><span>✦</span><strong>Mapping the archive…</strong></div>;
  return <MindMap archive={archive} onSave={save} />;
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

const observer = new MutationObserver(scheduleSync);
function startMindMapRoute() {
  scheduleSync();
  const root = document.getElementById('root');
  if (root) observer.observe(root, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMindMapRoute, { once: true });
else startMindMapRoute();
