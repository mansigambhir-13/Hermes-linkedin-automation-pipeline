import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import type { DraftRequest } from './app.js';
import { onShutdown } from '@rss/core';
import type { PostFormat, PublishPlatform } from '@rss/core';

/**
 * Web intake — a tiny HTTP server run INSIDE the bot process so web-submitted drafts share the in-memory
 * session map (the review buttons work). Serves the form at / and accepts POST /api/posts.
 * v1 normalisation: platform 'both' → linkedin, format 'auto' → single_image (one draft per submission).
 */
type IntakeHandler = (req: DraftRequest) => Promise<{ postIds: string[]; channel: string }>;

const FORM_PATH = 'apps/web/index.html'; // cwd is the repo root (the start script cd's there)

type Normalized = DraftRequest | { error: string };
function normalize(body: Record<string, unknown>): Normalized {
  const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
  if (!idea) return { error: 'idea is required' };
  const raw = String(body.platform);
  const platforms: PublishPlatform[] = raw === 'both' ? ['linkedin', 'instagram'] : raw === 'instagram' ? ['instagram'] : ['linkedin'];
  const format: PostFormat = String(body.format) === 'carousel' ? 'carousel' : 'single_image';
  const createdBy = typeof body.created_by === 'string' && body.created_by ? body.created_by : 'web';
  return { idea, format, createdBy, platforms };
}

export function startIntakeServer(handleIntake: IntakeHandler): void {
  const port = Number(process.env.SLACK_INTAKE_PORT || 3002);
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    const json = (code: number, obj: unknown): void => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };

    if (req.method === 'GET' && (url === '/' || url.startsWith('/index.html'))) {
      if (!existsSync(FORM_PATH)) return json(500, { ok: false, error: 'intake form not found' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(FORM_PATH));
      return;
    }
    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    if (req.method === 'POST' && (url === '/api/posts' || url === '/intake')) {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 1_000_000) req.destroy();
      });
      req.on('end', () => {
        let body: Record<string, unknown>;
        try {
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          return json(400, { ok: false, error: 'invalid JSON body' });
        }
        const norm = normalize(body);
        if ('error' in norm) return json(400, { ok: false, error: norm.error });
        handleIntake(norm)
          .then(({ postIds, channel }) => json(200, { ok: true, postIds, channel, message: `${postIds.length} draft(s) created — review in Slack.` }))
          .catch((e: unknown) => json(500, { ok: false, error: e instanceof Error ? e.message : String(e) }));
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  // Never let a port clash (or any listen error) crash the whole bot — the Slack socket works without intake.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️  Web intake port ${port} already in use — skipping intake server (Slack bot continues normally).`);
    } else {
      console.error('⚠️  Web intake server error (non-fatal):', err.message);
    }
  });
  server.listen(port, () => console.log(`🌐 Web intake on http://localhost:${port} — form at /, POST /api/posts, GET /health.`));
  onShutdown(() => new Promise<void>((resolve) => server.close(() => resolve())));
}
