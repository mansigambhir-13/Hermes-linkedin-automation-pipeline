import { installProcessGuards, requireEnv, onShutdown } from '@rss/core';
import { createApp } from './app.js';
import { startIntakeServer } from './intake.js';

installProcessGuards('slack-bot');

// Fail fast at boot if core config is missing (clear report, never prints values).
// DATABASE_URL is required when either backend is Supabase — otherwise the bot would boot "healthy"
// and only fail on the first /posts or draft write.
const needsDb = process.env.CONTENT_LIBRARY === 'supabase' || process.env.DRAFT_STORE === 'supabase';
requireEnv('slack-bot', {
  required: ['SLACK_BOT_TOKEN', 'ANTHROPIC_API_KEY', ...(needsDb ? ['DATABASE_URL'] : [])],
  optional: ['SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET', 'POSTIZ_API_KEY', 'POSTIZ_INTEGRATION_LINKEDIN', 'POSTIZ_INTEGRATION_X', 'CONTENT_LIBRARY', 'DRAFT_STORE', 'OBJECT_STORE', 'SLACK_APPROVERS', 'SLACK_OPS_CHANNEL'],
});

const { app, handleIntake } = createApp();
const socketMode = !!process.env.SLACK_APP_TOKEN;

// Bolt global error handler — a handler throwing must never crash the process.
app.error(async (error) => {
  console.error('[slack-bot] Bolt handler error:', error);
});

await app.init(); // required because the app is constructed with deferInitialization (authenticates here)

if (socketMode) {
  await app.start(); // Socket Mode: opens an outbound WebSocket — no port / Request URL / tunnel needed
  console.log('⚡ Rehearsal Slack bot connected via Socket Mode — listening for /draft, /posts, buttons, chat.');
} else {
  const PORT = Number(process.env.SLACK_PORT || 3001);
  await app.start(PORT);
  console.log(
    `⚡ Rehearsal Slack bot listening on :${PORT} (HTTP mode). ` +
      `Point the Slack app's Request URLs (Events, Interactivity, Slash command) at https://<public-tunnel>/slack/events — see infra/slack-setup.md.`,
  );
}
onShutdown(async () => {
  await app.stop();
});

// Web intake surface (serves the form + accepts submissions → posts the draft into Slack for review).
startIntakeServer(handleIntake);
