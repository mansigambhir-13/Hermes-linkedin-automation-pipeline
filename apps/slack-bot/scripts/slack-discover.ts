/**
 * Read-only Slack connectivity + channel discovery (no posting). Confirms the bot token works and lists the
 * channels the bot can post into, so we know where to send a test draft.
 * Run from repo root: node --env-file=.env --import tsx apps/slack-bot/scripts/slack-discover.ts
 */
const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error('SLACK_BOT_TOKEN missing in .env');
  process.exit(1);
}
const H = { Authorization: `Bearer ${token}` };

const auth = (await (await fetch('https://slack.com/api/auth.test', { method: 'POST', headers: H })).json()) as any;
if (!auth.ok) {
  console.error('❌ auth.test failed:', auth.error);
  process.exit(1);
}
console.log(`✅ auth.test OK — team "${auth.team}" · bot @${auth.user} (id ${auth.user_id}) · ${auth.url}`);

const conv = (await (
  await fetch(
    'https://slack.com/api/users.conversations?types=public_channel,private_channel&exclude_archived=true&limit=200',
    { headers: H },
  )
).json()) as any;
if (!conv.ok) {
  console.error(`⚠️ users.conversations failed: ${conv.error} (the token may lack channels:read / groups:read)`);
  process.exit(0);
}
const chans = (conv.channels || []).map((c: any) => `#${c.name} (${c.id})${c.is_private ? ' [private]' : ''}`);
console.log(`\nBot is a member of ${chans.length} channel(s):`);
if (chans.length) chans.forEach((c: string) => console.log('  - ' + c));
else console.log('  (none — in Slack, run `/invite @' + auth.user + '` in a channel, then re-run)');
