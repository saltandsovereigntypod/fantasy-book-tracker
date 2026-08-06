const ARCHIVE_KEY = 'empyrean-v2-archive';
const originalFetch = window.fetch.bind(window);

function isArchiveRead(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  return method === 'GET' && url.includes('/rest/v1/archive_states') && url.includes('select=');
}

function localArchiveResponse(input: RequestInfo | URL): Response {
  let archive: unknown = null;
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    archive = raw ? JSON.parse(raw) : null;
  } catch {
    archive = null;
  }

  const request = input instanceof Request ? input : null;
  const accept = request?.headers.get('accept') || '';
  const state = archive ? { v2Archive: archive } : null;
  const body = accept.includes('application/vnd.pgrst.object')
    ? JSON.stringify({ state })
    : JSON.stringify([{ state }]);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': '0-0/1',
    },
  });
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (isArchiveRead(input, init)) return localArchiveResponse(input);
  return originalFetch(input, init);
};
