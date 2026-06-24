import { PublishPreconditionError } from './types.js';

/**
 * Thin client for the Postiz public API (https://docs.postiz.com/public-api/introduction).
 *
 * Auth: the API key goes in the `Authorization` header verbatim — no `Bearer` prefix.
 * Cloud base = https://api.postiz.com/public/v1 ; self-hosted = {BACKEND_URL}/public/v1.
 *
 * Used for one-click posting: upload media → create a post on a connected integration (channel).
 * Postiz owns the per-platform OAuth, media handling, and publishing, so this stays small.
 */
const DEFAULT_BASE = 'https://api.postiz.com/public/v1';

/** Per-call timeouts (ms) — a hung fetch must never stall a worker tick or a Slack handler. */
const TIMEOUT = { list: 15_000, fetchMedia: 30_000, upload: 60_000, createPost: 45_000 } as const;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Error carrying the HTTP status, so the retry policy can tell 4xx (don't retry) from 5xx/network (retry). */
function httpError(label: string, status: number, body: string): Error & { status: number } {
  return Object.assign(new Error(`${label} failed (${status}): ${body}`), { status });
}

/**
 * Retry an IDEMPOTENT operation on transient failure — network error/timeout (no .status) or 5xx.
 * 3 attempts total (1s, 3s backoff). 4xx and precondition errors are NOT retried (they won't heal).
 * NEVER wrap createPost in this: re-sending a create could double-post.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1_000, 3_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number }).status;
      const retryable = !(e instanceof PublishPreconditionError) && (status === undefined || status >= 500);
      if (!retryable || attempt >= delays.length) throw e;
      await sleep(delays[attempt]!);
    }
  }
}

export interface PostizIntegration {
  id: string;
  name: string;
  /** Platform slug, e.g. 'linkedin', 'instagram', 'x'. Postiz also returns this as `providerIdentifier`. */
  identifier?: string;
  providerIdentifier?: string;
  picture?: string;
  disabled?: boolean;
}

export interface PostizUpload {
  id: string;
  path: string;
}

export interface PostizPostValue {
  content: string;
  image?: PostizUpload[];
}

export interface PostizCreatePostBody {
  /** 'now' publishes immediately; 'schedule' uses `date`; 'draft' stores without publishing. */
  type: 'now' | 'schedule' | 'draft';
  date: string; // ISO 8601
  shortLink?: boolean;
  tags?: string[];
  posts: Array<{
    integration: { id: string };
    value: PostizPostValue[];
    settings: { __type: string } & Record<string, unknown>;
  }>;
}

export class PostizClient {
  private readonly base: string;
  private readonly key: string;

  constructor(opts: { apiKey?: string; baseUrl?: string } = {}) {
    this.key = opts.apiKey ?? process.env.POSTIZ_API_KEY ?? '';
    this.base = (opts.baseUrl ?? process.env.POSTIZ_API_URL ?? DEFAULT_BASE).replace(/\/+$/, '');
    if (!this.key) {
      throw new PublishPreconditionError(
        'Postiz not configured: set POSTIZ_API_KEY (Postiz → Settings → Developers → Public API).',
      );
    }
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: this.key, ...extra };
  }

  /** GET /integrations — the connected channels (LinkedIn, IG, …) and their ids. Idempotent → retried. */
  async listIntegrations(): Promise<PostizIntegration[]> {
    return withRetry(async () => {
      const res = await fetch(`${this.base}/integrations`, { headers: this.headers(), signal: AbortSignal.timeout(TIMEOUT.list) });
      if (!res.ok) throw httpError('Postiz GET /integrations', res.status, await res.text());
      const data = (await res.json()) as unknown;
      // Postiz has returned either a bare array or { integrations: [...] } across versions; handle both.
      const list = Array.isArray(data) ? data : ((data as { integrations?: unknown[] }).integrations ?? []);
      return list as PostizIntegration[];
    });
  }

  /** POST /upload — multipart; fetches `sourceUrl` bytes and forwards them. Idempotent (an orphan upload is harmless) → retried. */
  async uploadFromUrl(sourceUrl: string, filename: string): Promise<PostizUpload> {
    const { bytes, type } = await withRetry(async () => {
      const bytesRes = await fetch(sourceUrl, { signal: AbortSignal.timeout(TIMEOUT.fetchMedia) });
      if (!bytesRes.ok) throw httpError(`Postiz upload: fetch media ${sourceUrl}`, bytesRes.status, '');
      return { bytes: new Uint8Array(await bytesRes.arrayBuffer()), type: bytesRes.headers.get('content-type') ?? 'application/octet-stream' };
    });
    return this.uploadBytes(bytes, filename, type);
  }

  /** POST /upload — multipart from a local file (for media not yet on object storage). Returns { id, path }. */
  async uploadFromFile(bytes: Uint8Array, filename: string, contentType = 'image/png'): Promise<PostizUpload> {
    return this.uploadBytes(bytes, filename, contentType);
  }

  private async uploadBytes(bytes: Uint8Array, filename: string, contentType: string): Promise<PostizUpload> {
    return withRetry(async () => {
      const form = new FormData(); // rebuilt per attempt — a consumed FormData can't be re-sent
      form.append('file', new Blob([bytes], { type: contentType }), filename);
      const res = await fetch(`${this.base}/upload`, { method: 'POST', headers: this.headers(), body: form, signal: AbortSignal.timeout(TIMEOUT.upload) });
      if (!res.ok) throw httpError('Postiz POST /upload', res.status, await res.text());
      const out = (await res.json()) as PostizUpload | PostizUpload[];
      const up = Array.isArray(out) ? out[0] : out;
      if (!up?.id || !up?.path) throw httpError('Postiz upload: response missing id/path', 502, '');
      return { id: up.id, path: up.path };
    });
  }

  /**
   * POST /posts — create/schedule/publish. NOT idempotent, therefore NEVER auto-retried (a re-send could
   * double-post); timeout only. Callers (worker backoff / a human re-click) own any retry, both protected
   * by the externalIds idempotency guard.
   */
  async createPost(body: PostizCreatePostBody): Promise<unknown> {
    const res = await fetch(`${this.base}/posts`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT.createPost),
    });
    if (!res.ok) throw httpError('Postiz POST /posts', res.status, await res.text());
    return res.json();
  }
}

/**
 * Per-platform `settings` object for a Postiz post. Some providers require extra fields:
 *   - x (Twitter): `who_can_reply_post` is mandatory (everyone | following | mentionedUsers | subscribers | verified).
 */
export function postizSettings(type: string): { __type: string } & Record<string, unknown> {
  const s: { __type: string } & Record<string, unknown> = { __type: type };
  if (type === 'x') s.who_can_reply_post = 'everyone';
  if (type.startsWith('instagram')) s.post_type = 'post'; // Instagram requires post_type: post | story
  return s;
}

/** Best-effort extraction of a stable post id from the (loosely-typed) create-post response. */
export function extractPostId(resp: unknown): string {
  const pick = (o: unknown): string | undefined => {
    if (!o || typeof o !== 'object') return undefined;
    const r = o as Record<string, unknown>;
    for (const k of ['postId', 'id', 'releaseId']) if (typeof r[k] === 'string') return r[k] as string;
    return undefined;
  };
  if (Array.isArray(resp)) {
    for (const item of resp) {
      const id = pick(item);
      if (id) return id;
    }
  }
  return pick(resp) ?? `postiz-${Date.now()}`;
}
