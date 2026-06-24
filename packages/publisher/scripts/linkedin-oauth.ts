/**
 * One-time LinkedIn OAuth helper — opens the browser to the authorize URL, captures the code on
 * http://localhost:<port>/oauth/callback, exchanges it for tokens, and writes LINKEDIN_ACCESS_TOKEN (+
 * LINKEDIN_REFRESH_TOKEN if issued) into root .env in place. Tokens are NEVER echoed to stdout.
 *
 * Prereqs in .env: LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET (developer.linkedin.com → Auth tab).
 * The Authorized Redirect URL on the LinkedIn app must include  http://localhost:3003/oauth/callback
 * (or set LINKEDIN_OAUTH_PORT and add the matching URL there).
 *
 * Run: pnpm --filter @rss/publisher linkedin-oauth
 *      LINKEDIN_OAUTH_SCOPES='openid profile email w_member_social' pnpm --filter @rss/publisher linkedin-oauth
 */
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const clientId = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('❌ Set LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET in .env first (developer.linkedin.com → your app → Auth tab).');
  process.exit(1);
}

const port = Number(process.env.LINKEDIN_OAUTH_PORT || 3003);
const scopes = (process.env.LINKEDIN_OAUTH_SCOPES || 'openid profile email w_member_social w_organization_social r_organization_social')
  .split(/\s+/)
  .filter(Boolean);
const redirectUri = `http://localhost:${port}/oauth/callback`;
const state = randomBytes(16).toString('hex');
const authUrl =
  'https://www.linkedin.com/oauth/v2/authorization' +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(clientId)}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&scope=${encodeURIComponent(scopes.join(' '))}` +
  `&state=${state}`;

const ENV_PATH = '.env';
function upsertEnv(key: string, value: string): void {
  const text = readFileSync(ENV_PATH, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  writeFileSync(ENV_PATH, next);
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "" "${url}"` :
                                    `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`(Couldn't auto-open the browser — open this URL manually:)\n${url}`);
  });
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname !== '/oauth/callback') {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const reply = (status: number, body: string): void => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><pre style="font:14px/1.4 monospace;padding:32px">${body}</pre>`);
  };
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  if (err) {
    reply(400, `LinkedIn returned an error: ${err} — ${url.searchParams.get('error_description') ?? ''}`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    reply(400, 'No code on the callback.');
    return;
  }
  if (returnedState !== state) {
    reply(400, 'State mismatch — possible CSRF; aborting.');
    server.close();
    process.exit(1);
  }
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) {
      reply(500, `Token exchange failed (${r.status}): ${await r.text()}`);
      server.close();
      process.exit(1);
    }
    const tok = (await r.json()) as TokenResponse;
    upsertEnv('LINKEDIN_ACCESS_TOKEN', tok.access_token);
    if (tok.refresh_token) upsertEnv('LINKEDIN_REFRESH_TOKEN', tok.refresh_token);

    reply(200, `✅ LinkedIn OAuth complete. You can close this tab and return to the terminal.`);
    console.log(
      `✅ wrote to .env:\n  - LINKEDIN_ACCESS_TOKEN (${tok.access_token.length} chars, expires in ${tok.expires_in}s)` +
        (tok.refresh_token
          ? `\n  - LINKEDIN_REFRESH_TOKEN (${tok.refresh_token.length} chars${tok.refresh_token_expires_in ? `, expires in ${tok.refresh_token_expires_in}s` : ''})`
          : `\n  ⚠️ LinkedIn did NOT issue a refresh_token for these scopes — you'll need to re-run this script when the access token expires (~60d).`),
    );
    console.log('Next: get your author URN (GO-LIVE-PLAYBOOK §2 step 6) → paste as LINKEDIN_AUTHOR_URN.');
    server.close();
    process.exit(0);
  } catch (e) {
    reply(500, `Exchange threw: ${e instanceof Error ? e.message : String(e)}`);
    server.close();
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log(`🔐 LinkedIn OAuth helper listening on ${redirectUri}`);
  console.log(`   Scopes: ${scopes.join(' ')}`);
  console.log(`   (Make sure ${redirectUri} is in your LinkedIn app's Authorized Redirect URLs.)`);
  console.log(`   Opening browser… if it doesn't open, paste this URL:\n   ${authUrl}`);
  openBrowser(authUrl);
});

// Safety timeout — if the user abandons the flow, don't hang the process forever.
setTimeout(() => {
  console.error('⏰ No callback within 5 minutes — aborting.');
  server.close();
  process.exit(1);
}, 5 * 60_000).unref();
