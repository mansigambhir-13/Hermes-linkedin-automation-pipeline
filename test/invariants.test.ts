/**
 * Unit tests for the system's non-negotiables — pure logic, no network/DB. Run: pnpm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeCaption, assertNoPlaceholders, LockedConfigError, findBannedPhrases, type LockedConfig } from '@rss/core';
import { publishPost, ApprovalRequiredError, type PublishDeps, type PublishRequest, type ResolvedPost } from '@rss/publisher';
import { createDraftStore, findPriorPublish, type DraftRecord } from '@rss/agent';

const cfg: LockedConfig = {
  cta: { linkedin: 'Try Rehearsal.', instagram: 'Link in bio.' },
  hashtags: { linkedin: ['#MBA', '#Placements'], instagram: ['#MBA', '#CAT'] },
};

// ── Locked CTA/hashtags are appended by code (the model never writes them) ──
test('composeCaption appends the locked CTA + hashtags after the body', () => {
  assert.equal(composeCaption('linkedin', 'Hook then body.', cfg), 'Hook then body.\n\nTry Rehearsal.\n\n#MBA #Placements');
});

test('assertNoPlaceholders rejects example placeholders (gate stays closed until real values land)', () => {
  const bad: LockedConfig = { cta: { linkedin: '<<TEAM cta>>', instagram: 'x' }, hashtags: { linkedin: ['#a'], instagram: ['#b'] } };
  assert.throws(() => assertNoPlaceholders(bad), LockedConfigError);
});

// ── Banned-phrase lint ──
test('findBannedPhrases flags banned language and passes clean copy', () => {
  assert.equal(findBannedPhrases('This is a game-changer that will supercharge you').length, 2);
  assert.equal(findBannedPhrases('A specific, grounded, on-brand line.').length, 0);
});

// ── Publish state machine: approval gate + idempotency + status transitions ──
interface Calls {
  publish: number;
  recordPublish: { status: string }[];
  status: string[];
  lastReq?: PublishRequest;
}
function fakeDeps(over: Partial<PublishDeps> = {}): PublishDeps & { calls: Calls } {
  const calls: Calls = { publish: 0, recordPublish: [], status: [] };
  const base: PublishDeps = {
    resolvePost: async () => ({ caption: 'c', mediaKeys: ['k'], aspectRatios: ['1:1'] }) as ResolvedPost,
    mintUrl: async (k) => `https://example/${k}`,
    findSuccessfulPublish: async () => null,
    recordPublish: async (e) => {
      calls.recordPublish.push({ status: e.status });
    },
    setStatus: async (_id, s) => {
      calls.status.push(s);
    },
    adapter: {
      publish: async (req) => {
        calls.publish++;
        calls.lastReq = req;
        return { externalId: 'ext-new' };
      },
    },
  };
  return Object.assign(base, over, { calls });
}

test('publishPost refuses without an approver (approval gate)', async () => {
  await assert.rejects(() => publishPost({ postId: 'p', platform: 'linkedin', format: 'single' }, fakeDeps()), ApprovalRequiredError);
});

test('publishPost is idempotent — a prior success is skipped without calling the adapter', async () => {
  const deps = fakeDeps({ findSuccessfulPublish: async () => 'ext-old' });
  const out = await publishPost({ postId: 'p', platform: 'linkedin', format: 'single', approvedBy: 'u' }, deps);
  assert.equal(out.skipped, true);
  assert.equal(out.externalId, 'ext-old');
  assert.equal(deps.calls.publish, 0);
});

test('publishPost happy path: publishes, records success, sets published', async () => {
  const deps = fakeDeps();
  const out = await publishPost({ postId: 'p', platform: 'linkedin', format: 'single', approvedBy: 'u' }, deps);
  assert.equal(out.skipped, false);
  assert.equal(out.externalId, 'ext-new');
  assert.equal(deps.calls.publish, 1);
  assert.deepEqual(deps.calls.status, ['publishing', 'published']);
  assert.equal(deps.calls.recordPublish[0]?.status, 'success');
});

// ── Durability: the draft store round-trips + the worker's due-filter picks the right records ──
test('draft store round-trips a record and dueScheduled selects approved, due, scheduled posts', async () => {
  process.env.DRAFT_STORE = 'memory';
  const store = createDraftStore();
  const base = {
    input: { idea: 'i', platform: 'linkedin', format: 'single_image', createdBy: 'u' },
    draft: { postId: 'p', images: [], caption: 'c', aspectRatio: '1:1' },
    channel: 'C1',
    status: 'scheduled',
    approvedBy: 'u',
    updatedAt: Date.now(),
  };
  await store.put({ ...base, postId: 'past', scheduledAtMs: Date.now() - 1000 } as unknown as DraftRecord);
  await store.put({ ...base, postId: 'future', scheduledAtMs: Date.now() + 60_000 } as unknown as DraftRecord);
  await store.put({ ...base, postId: 'unapproved', approvedBy: undefined, scheduledAtMs: Date.now() - 1000 } as unknown as DraftRecord);

  assert.equal((await store.get('past'))?.status, 'scheduled');
  const due = await store.dueScheduled(Date.now());
  assert.deepEqual(
    due.map((r) => r.postId),
    ['past'],
  );
});

test('publishPost threads altTexts from ResolvedPost into the adapter request', async () => {
  const deps = fakeDeps({
    resolvePost: async () =>
      ({ caption: 'c', mediaKeys: ['k1', 'k2'], aspectRatios: ['1:1', '1:1'], altTexts: ['slide 1 alt', 'slide 2 alt'] }) as ResolvedPost,
  });
  await publishPost({ postId: 'p', platform: 'linkedin', format: 'carousel', approvedBy: 'u' }, deps);
  assert.deepEqual(deps.calls.lastReq?.altTexts, ['slide 1 alt', 'slide 2 alt']);
  assert.deepEqual(deps.calls.lastReq?.mediaUrls, ['https://example/k1', 'https://example/k2']);
});

test('publishPost failure: records failed, sets failed, rethrows', async () => {
  const deps = fakeDeps({
    adapter: {
      publish: async () => {
        throw new Error('boom');
      },
    },
  });
  await assert.rejects(() => publishPost({ postId: 'p', platform: 'linkedin', format: 'single', approvedBy: 'u' }, deps));
  assert.deepEqual(deps.calls.status, ['publishing', 'failed']);
  assert.equal(deps.calls.recordPublish[0]?.status, 'failed');
});

// ── Content-level double-post guard: a re-picked library post can't duplicate to the same platform ──
test('findPriorPublish detects same library post already published to a platform', async () => {
  process.env.DRAFT_STORE = 'memory';
  const store = createDraftStore();
  const rec = (postId: string, src: string, ext?: Record<string, string>): DraftRecord => ({
    postId,
    librarySourceId: src,
    externalIds: ext,
    input: { idea: 't', platform: 'linkedin', format: 'single_image', createdBy: 'library' } as never,
    draft: { caption: 'c' } as never,
    channel: 'C',
    status: 'in_review',
    updatedAt: Date.now(),
  });
  await store.put(rec('lib-anchoring-aaa', 'anchoring', { linkedin: 'urn:1' })); // first pick, published to LinkedIn
  await store.put(rec('lib-anchoring-bbb', 'anchoring')); // a fresh re-pick of the SAME post

  assert.equal(await findPriorPublish(store, 'anchoring', 'linkedin', 'lib-anchoring-bbb'), 'urn:1'); // blocked
  assert.equal(await findPriorPublish(store, 'anchoring', 'x', 'lib-anchoring-bbb'), null); // other platform = fine
  assert.equal(await findPriorPublish(store, 'other', 'linkedin', 'lib-other-bbb'), null); // different post = fine
  assert.equal(await findPriorPublish(store, 'anchoring', 'linkedin', 'lib-anchoring-aaa'), null); // self excluded (re-click handled elsewhere)
});

// ── Worker retry policy: transient scheduled-publish failures back off 2m → 5m → 15m, then give up ──
test('retryDelayMs backs off then exhausts; readyForAttempt gates the backoff window', async () => {
  const { retryDelayMs, readyForAttempt, hasUnfilledDataSlot } = await import('@rss/agent');

  assert.equal(retryDelayMs(1), 120_000); // after 1st failure → retry in 2 min
  assert.equal(retryDelayMs(2), 300_000); // after 2nd → 5 min
  assert.equal(retryDelayMs(3), 900_000); // after 3rd → 15 min
  assert.equal(retryDelayMs(4), null); // exhausted → mark failed + alert

  const now = 1_000_000;
  assert.equal(readyForAttempt({}, now), true); // no backoff window → attempt
  assert.equal(readyForAttempt({ nextAttemptAtMs: now - 1 }, now), true); // window elapsed → attempt
  assert.equal(readyForAttempt({ nextAttemptAtMs: now + 1 }, now), false); // window open → skip this tick

  // The unfilled-data publish guard recognises the refine marker (and nothing else).
  assert.equal(hasUnfilledDataSlot('body [[DATA: real graded N]] tail'), true);
  assert.equal(hasUnfilledDataSlot('clean caption, no slot'), false);
});
