/**
 * Refresh LinkedIn + Meta access tokens and write the new values into root `.env` in place (no token echoed
 * in stdout). Run periodically — e.g. weekly via cron — to keep publishing alive:
 *   pnpm --filter @rss/publisher refresh-tokens              # both
 *   pnpm --filter @rss/publisher refresh-tokens linkedin     # one
 *   pnpm --filter @rss/publisher refresh-tokens meta
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { refreshLinkedInToken, refreshMetaToken } from '../src/tokens.js';

const ENV_PATH = '.env'; // cwd is the repo root (the package script cd's there)

function upsertEnv(key: string, value: string): void {
  const text = readFileSync(ENV_PATH, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  writeFileSync(ENV_PATH, next);
}

const target = process.argv[2] ?? 'all';
const ran: string[] = [];

if (target === 'linkedin' || target === 'all') {
  try {
    const li = await refreshLinkedInToken();
    upsertEnv('LINKEDIN_ACCESS_TOKEN', li.access_token);
    if (li.refresh_token) upsertEnv('LINKEDIN_REFRESH_TOKEN', li.refresh_token);
    ran.push(`LinkedIn: access (${li.access_token.length} chars, expires in ${li.expires_in}s)${li.refresh_token ? ` + new refresh (${li.refresh_token.length} chars)` : ''}`);
  } catch (e) {
    console.error('❌ LinkedIn refresh failed:', e instanceof Error ? e.message : e);
    if (target === 'linkedin') process.exit(1);
  }
}

if (target === 'meta' || target === 'all') {
  try {
    const m = await refreshMetaToken();
    upsertEnv('META_ACCESS_TOKEN', m.access_token);
    ran.push(`Meta: long-lived access (${m.access_token.length} chars${m.expires_in ? `, expires in ${m.expires_in}s` : ''})`);
  } catch (e) {
    console.error('❌ Meta refresh failed:', e instanceof Error ? e.message : e);
    if (target === 'meta') process.exit(1);
  }
}

if (ran.length) {
  console.log(`✅ refreshed → wrote to .env:\n  - ${ran.join('\n  - ')}`);
  console.log('Restart the bot + worker to pick up the new tokens.');
} else {
  process.exit(1);
}
