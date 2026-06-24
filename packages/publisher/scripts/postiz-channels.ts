/**
 * Lists the connected Postiz integrations (channels) so you can copy the right id into .env.
 * Run: pnpm --filter @rss/publisher postiz-channels
 * Prints only id / platform / name — no secrets. Use the LinkedIn id for POSTIZ_INTEGRATION_LINKEDIN.
 */
import { PostizClient } from '../src/postiz.js';

const client = new PostizClient(); // throws a clear error if POSTIZ_API_KEY is unset
const integrations = await client.listIntegrations();

if (integrations.length === 0) {
  console.log('No connected channels found. Connect LinkedIn in the Postiz UI first, then re-run.');
} else {
  console.log(`Connected Postiz channels (${integrations.length}):\n`);
  for (const i of integrations) {
    const platform = i.identifier ?? i.providerIdentifier ?? '?';
    const flags = i.disabled ? ' [disabled]' : '';
    console.log(`  ${platform.padEnd(12)} id=${i.id}  name=${i.name}${flags}`);
  }
  console.log('\nSet the LinkedIn one into .env as:  POSTIZ_INTEGRATION_LINKEDIN=<id>');
}
