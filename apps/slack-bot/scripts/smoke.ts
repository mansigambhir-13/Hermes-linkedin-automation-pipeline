/**
 * No-network smoke for the Slack bot wiring: command parsing, Block Kit shape, modal shape, and that the
 * Bolt app constructs. Does NOT contact Slack or any model. Run: pnpm --filter @rss/slack-bot smoke
 */
import assert from 'node:assert/strict';
import { parseCommand, createApp, createRateLimiter } from '../src/app.js';
import { draftBlocks, inputModal } from '../src/blocks.js';
import type { ComposedDraft } from '@rss/agent';

// 1. command parsing (platforms; 'both' → two)
const ig = parseCommand('ig carousel summer placement nerves', 'U1');
assert.deepEqual(ig.platforms, ['instagram']);
assert.equal(ig.format, 'carousel');
assert.ok(ig.idea.toLowerCase().includes('summer placement nerves'));

const li = parseCommand('a fresh take on GD-PI', 'U2');
assert.deepEqual(li.platforms, ['linkedin']);
assert.equal(li.format, 'single_image');
assert.ok(li.idea.length > 0);

const both = parseCommand('both: why mock interviews beat cramming', 'U3');
assert.deepEqual(both.platforms, ['linkedin', 'x']);

const x = parseCommand('twitter: the one-number negotiation tell', 'U4');
assert.deepEqual(x.platforms, ['x']);
assert.ok(!both.idea.toLowerCase().includes('both'));

// 1b. per-user rate limiter (fixed clock → all hits in one window)
const allow = createRateLimiter(2, () => 1000);
assert.equal(allow('u'), true);
assert.equal(allow('u'), true);
assert.equal(allow('u'), false, 'third draft in the window is denied');
assert.equal(allow('other'), true, 'limit is per-user');

// 2. review card + modal shape
const fake: ComposedDraft = {
  postId: 'slack-test',
  idea: 'idea',
  platform: 'linkedin',
  format: 'single_image',
  hook: 'hook',
  captionBody: 'body',
  caption: 'caption body + cta',
  ctaApplied: false,
  visualConcept: 'a metaphor',
  rationale: 'why',
  banned: [],
  aspectRatio: '1.91:1',
  images: [{ slideIndex: 0, storageKey: 'posts/slack-test/0.png', localPath: '.artifacts/posts/slack-test/0.png', modelUsed: 'fal-ai/imagen4/preview/ultra' }],
};
const blocks = draftBlocks(fake, { edited: true, scheduledAt: '2026-05-28 09:00 IST' });
const actionBlocks = blocks.filter((b) => b.type === 'actions');
assert.equal(actionBlocks.length, 2, 'expected two action rows (review + publish)');
const actionIds = actionBlocks.flatMap((b) => b.elements.map((e: any) => e.action_id));
for (const id of ['approve', 'edit', 'reevaluate', 'refine', 'regenerate', 'schedule', 'publish_linkedin']) {
  assert.ok(actionIds.includes(id), `missing action: ${id}`);
}
// platform-aware: a linkedin draft must NOT offer the X publish button
assert.ok(!actionIds.includes('publish_x'), 'linkedin card should not show Publish → X');

const modal = inputModal({ callbackId: 'edit_submit', postId: 'slack-test', title: 'Edit', label: 'Caption', actionId: 'edit_input', multiline: true, initialValue: fake.caption });
assert.equal(modal.callback_id, 'edit_submit');
assert.equal(modal.private_metadata, 'slack-test');
assert.equal(modal.blocks[0].element.action_id, 'edit_input');

// 3. the Bolt app constructs (no network) with dummy creds
process.env.SLACK_BOT_TOKEN ??= 'xoxb-smoke';
process.env.SLACK_SIGNING_SECRET ??= 'smoke-secret';
process.env.DRAFT_STORE = 'memory'; // don't write a drafts file during the smoke
const { app, handleIntake } = createApp();
assert.ok(app, 'createApp returned an app');
assert.equal(typeof handleIntake, 'function', 'createApp exposes handleIntake');

console.log('✅ slack-bot smoke OK — parsing (linkedin/x/both), 8 actions, modal, app construct');
