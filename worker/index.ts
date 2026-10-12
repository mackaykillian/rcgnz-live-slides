import type { SyncResponse } from '../shared/types';
import { readImageSources, readSnapshot, syncFromAirtable } from './sync';

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  });

async function handleSnapshot(env: Env): Promise<Response> {
  const snapshot = (await readSnapshot(env)) ?? (await syncFromAirtable(env, { force: true }));
  return json(snapshot);
}

async function handleSync(env: Env): Promise<Response> {
  try {
    const snapshot = await syncFromAirtable(env);
    return json({ ok: true, snapshot } satisfies SyncResponse);
  } catch (err) {
    console.error('Manual sync failed', err);
    return json({ ok: false, error: String((err as Error).message ?? err) } satisfies SyncResponse, {
      status: 502,
    });
  }
}

/**
 * Serve a headshot from KV. On a cache miss, fetch it from its (short-lived)
 * Airtable URL recorded by the last sync and store it, so every image is
 * fetched from Airtable at most once.
 */
async function handleImage(id: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  const key = `images/${id}`;
  const headers = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  };

  const cached = await env.STORE.getWithMetadata<{ contentType: string }>(key, 'arrayBuffer');
  if (cached.value) {
    return new Response(cached.value, {
      headers: { ...headers, 'Content-Type': cached.metadata?.contentType ?? 'image/png' },
    });
  }

  const source = (await readImageSources(env))[id];
  if (!source) return new Response('Unknown image', { status: 404 });

  const upstream = await fetch(source);
  if (!upstream.ok) {
    // Airtable URLs expire after ~2h; the next sync records fresh ones.
    return new Response('Image source unavailable — sync and retry', { status: 502 });
  }
  const contentType = upstream.headers.get('Content-Type') ?? 'image/png';
  const bytes = await upstream.arrayBuffer();
  ctx.waitUntil(env.STORE.put(key, bytes, { metadata: { contentType } }));
  return new Response(bytes, { headers: { ...headers, 'Content-Type': contentType } });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/snapshot' && request.method === 'GET') return handleSnapshot(env);
    if (pathname === '/api/sync' && request.method === 'POST') return handleSync(env);

    const image = pathname.match(/^\/api\/images\/([^/]+)$/);
    if (image && request.method === 'GET') return handleImage(decodeURIComponent(image[1]), env, ctx);

    return json({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      syncFromAirtable(env, { force: true }).catch((err) => console.error('Scheduled sync failed', err)),
    );
  },
} satisfies ExportedHandler<Env>;
