/**
 * Scheduling worker — polls the shared draft store for approved, due scheduled posts and publishes them.
 * Runs as a long-lived process (separate from the bot). Reads the SAME store (file in dev / Supabase in
 * Phase 2), so it sees what the Slack bot scheduled. Notifies the review channel + an optional ops channel.
 * Run: pnpm --filter @rss/worker start
 */
import { WebClient } from '@slack/web-api';
import { installProcessGuards, requireEnv, onShutdown } from '@rss/core';
import { createDraftStore, findPriorPublish, hasUnfilledDataSlot, retryDelayMs, readyForAttempt, type DraftRecord } from '@rss/agent';
import { publishPost, makeInMemoryPublishDeps, ApprovalRequiredError, PublishPreconditionError, type ResolvedPost } from '@rss/publisher';

installProcessGuards('worker');
// DATABASE_URL is required when the draft store is Supabase (the worker reads due posts from it).
const needsDb = process.env.DRAFT_STORE === 'supabase';
requireEnv('worker', {
  required: ['SLACK_BOT_TOKEN', ...(needsDb ? ['DATABASE_URL'] : [])],
  optional: ['POSTIZ_API_KEY', 'POSTIZ_INTEGRATION_LINKEDIN', 'POSTIZ_INTEGRATION_X', 'DRAFT_STORE', 'SLACK_OPS_CHANNEL', 'WORKER_INTERVAL_MS'],
});

const store = createDraftStore();
const token = process.env.SLACK_BOT_TOKEN;
const web = token ? new WebClient(token) : null;
const opsChannel = process.env.SLACK_OPS_CHANNEL;
const INTERVAL = Number(process.env.WORKER_INTERVAL_MS || 30000);

async function notify(channel: string | undefined, text: string, isFailure = false): Promise<void> {
  const targets = new Set<string>();
  if (channel) targets.add(channel);
  if (isFailure && opsChannel) targets.add(opsChannel);
  for (const c of targets) {
    if (!web) {
      console.log(`[worker] (no SLACK_BOT_TOKEN) would notify ${c}: ${text}`);
      continue;
    }
    try {
      await web.chat.postMessage({ channel: c, text });
    } catch (e) {
      console.error('[worker] notify failed:', e);
    }
  }
}

function resolved(rec: DraftRecord): ResolvedPost {
  return {
    caption: rec.draft.caption,
    mediaKeys: rec.draft.images.map((i) => i.storageKey),
    aspectRatios: rec.draft.images.map(() => rec.draft.aspectRatio),
    altTexts: rec.draft.images.map((i) => i.altText ?? ''),
    thread: rec.draft.thread,
  };
}

async function publishDue(rec: DraftRecord): Promise<void> {
  const platform = rec.input.platform;
  // LinkedIn carousels go through the MultiImage API (adapter branches on media count).
  const format = rec.draft.format === 'carousel' ? 'carousel' : 'single';
  const deps = makeInMemoryPublishDeps(platform, {
    resolve: async (id) => {
      const r = await store.get(id);
      return r ? resolved(r) : null;
    },
    setStatus: async (id, status) => {
      const r = await store.get(id);
      if (r) {
        r.status = status;
        r.updatedAt = Date.now();
        await store.put(r);
      }
    },
    // Durable idempotency — a prior success on this record short-circuits, so a worker restart mid-run
    // (or an overlapping tick) can never double-post a scheduled item.
    findSuccessfulPublish: async (id, p) => (await store.get(id))?.externalIds?.[p] ?? null,
    recordPublish: async (entry) => {
      if (entry.status !== 'success' || !entry.externalId) return;
      const r = await store.get(entry.postId);
      if (r) {
        r.externalIds = { ...(r.externalIds ?? {}), [entry.platform]: entry.externalId };
        r.updatedAt = Date.now();
        await store.put(r);
      }
    },
    onFailure: (m) => void notify(rec.channel, `⛔ Scheduled publish failed for \`${rec.postId}\`: ${m}`, true),
  });
  // Media-required guard: image-essential scheduled posts must have an image — never auto-publish incomplete.
  if (rec.draft.mediaRequired && rec.draft.images.length === 0) {
    rec.status = 'failed';
    rec.updatedAt = Date.now();
    await store.put(rec);
    await notify(rec.channel, `🛑 Scheduled \`${rec.postId}\` not published — it needs an image (image-essential) and has none. Add the image and reschedule.`, true);
    return;
  }
  // Unfilled-data guard: never auto-publish a refined post that still has a [[DATA: …]] placeholder.
  if (hasUnfilledDataSlot(rec.draft.caption)) {
    rec.status = 'failed';
    rec.updatedAt = Date.now();
    await store.put(rec);
    await notify(rec.channel, `🛑 Scheduled \`${rec.postId}\` not published — it still has an unfilled [[DATA: …]] slot. Fill the real figure (or cut it) and reschedule.`, true);
    return;
  }
  // Content-level double-post guard: same library post already live on this platform? Skip + mark published.
  const prior = await findPriorPublish(store, rec.librarySourceId, platform, rec.postId);
  if (prior) {
    rec.status = 'published';
    rec.externalIds = { ...(rec.externalIds ?? {}), [platform]: prior };
    rec.updatedAt = Date.now();
    await store.put(rec);
    await notify(rec.channel, `🛑 Scheduled \`${rec.postId}\` skipped — \`${rec.librarySourceId}\` already published to ${platform} (id \`${prior}\`). No duplicate.`, true);
    return;
  }
  try {
    const out = await publishPost({ postId: rec.postId, platform, format: format as never, approvedBy: rec.approvedBy }, deps);
    await notify(rec.channel, `🚀 Scheduled post \`${rec.postId}\` published to ${platform}. external id: ${out.externalId ?? '(skipped/idempotent)'}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Permanent failures (missing config / approval) won't heal by retrying — leave the record failed.
    const permanent = e instanceof PublishPreconditionError || e instanceof ApprovalRequiredError;
    // publishPost already flipped the STORE record to 'failed'; re-read it so we don't clobber externalIds.
    const fresh = (await store.get(rec.postId)) ?? rec;
    const failedAttempts = (fresh.retryCount ?? 0) + 1;
    const delay = permanent ? null : retryDelayMs(failedAttempts);
    if (delay !== null) {
      // Transient (e.g. a Postiz timeout): restore 'scheduled' with backoff so a blip never silently kills a post.
      fresh.status = 'scheduled';
      fresh.retryCount = failedAttempts;
      fresh.nextAttemptAtMs = Date.now() + delay;
      fresh.updatedAt = Date.now();
      await store.put(fresh);
      await notify(rec.channel, `⚠️ Scheduled publish of \`${rec.postId}\` to ${platform} failed (attempt ${failedAttempts}): ${message}. Retrying in ~${Math.round(delay / 60000)} min.`, true);
    } else {
      await notify(
        rec.channel,
        permanent
          ? `⛔ Scheduled publish of \`${rec.postId}\` to ${platform} blocked (won't retry — fix config/approval and reschedule): ${message}`
          : `⛔ Scheduled publish of \`${rec.postId}\` to ${platform} failed after ${failedAttempts} attempts — giving up: ${message}. Fix the cause and reschedule.`,
        true,
      );
    }
  }
}

async function tick(): Promise<void> {
  // Only approved, due, still-scheduled posts (status flips to published/failed after, preventing re-publish).
  const now = Date.now();
  const due = await store.dueScheduled(now);
  for (const rec of due) {
    // Respect an open retry-backoff window (transient failure waiting for its next attempt).
    if (!readyForAttempt(rec, now)) continue;
    console.log(`[worker] due: ${rec.postId} (scheduled ${rec.scheduledAt}${rec.retryCount ? `, retry ${rec.retryCount}` : ''}) → publishing to ${rec.input.platform}`);
    await publishDue(rec);
  }
}

console.log(`⏱️  Rehearsal worker started — polling every ${INTERVAL / 1000}s. Ops channel: ${opsChannel ?? '(review channel only)'}.`);
// Wrap every poll so a transient store/DB error never kills the loop.
async function safeTick(): Promise<void> {
  try {
    await tick();
  } catch (e) {
    console.error('[worker] tick failed (will retry next interval):', e instanceof Error ? e.message : e);
  }
}

// Self-scheduling loop (NOT setInterval): the next poll is armed only after the current one fully finishes,
// so a slow publish can never overlap with the next tick and double-process a due record.
let timer: ReturnType<typeof setTimeout> | undefined;
let stopping = false;
async function loop(): Promise<void> {
  await safeTick();
  if (!stopping) timer = setTimeout(() => void loop(), INTERVAL);
}
onShutdown(() => {
  stopping = true;
  if (timer) clearTimeout(timer);
});
await loop();
