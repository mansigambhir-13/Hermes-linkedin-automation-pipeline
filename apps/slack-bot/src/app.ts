import pkg from '@slack/bolt';
import { existsSync, readFileSync } from 'node:fs';
import { composeDraft, createDraftStore, respondToMessage, validatePost, adaptCaption, refineForBrand, hasUnfilledDataSlot, findPriorPublish, type ComposeInput, type ComposedDraft, type DraftRecord } from '@rss/agent';
import { publishPost, makeInMemoryPublishDeps } from '@rss/publisher';
import type { ResolvedPost } from '@rss/publisher';
import type { PublishPlatform, PostFormat } from '@rss/core';
import { toSlackPlain, createContentLibrary, createObjectStore, type LibraryPost } from '@rss/core';
import { draftBlocks, inputModal, scheduleModal } from './blocks.js';

const { App, LogLevel } = pkg;

/**
 * Durable draft store (file-backed by default → survives restarts; shared with the scheduling worker;
 * swappable to Supabase in Phase 2 behind the same interface). Records are persisted on every mutation
 * via store.put — handlers must call it after changing a record.
 */
const store = createDraftStore();
const library = createContentLibrary(); // folder (default) or supabase — the pre-made post source for /posts
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Build an in-review DraftRecord from a pre-made library post (no generation; caption/image are final). */
function draftFromLibrary(post: LibraryPost, channel: string): DraftRecord {
  const img = post.imagePath ?? post.imageKey ?? '';
  const draft: ComposedDraft = {
    postId: `lib-${post.id}-${Date.now().toString(36)}`,
    idea: post.title,
    platform: post.platform,
    format: 'single_image',
    hook: post.caption.split('\n').find((l) => l.trim()) ?? post.title,
    captionBody: post.caption,
    caption: post.caption, // already final (CTA/hashtags inside, em-dash sanitized by the library)
    ctaApplied: true,
    visualConcept: post.pillar ? `${post.pillar} · pre-made image` : 'pre-made image',
    rationale: `Chosen from the content library: ${post.title}`,
    banned: [],
    aspectRatio: post.platform === 'instagram' ? '4:5' : '1.91:1',
    images: img ? [{ slideIndex: 0, storageKey: img, localPath: img, modelUsed: 'pre-made', altText: post.altText }] : [],
    thread: post.thread,
    mediaRequired: post.mediaRequired,
  };
  return { postId: draft.postId, input: { idea: post.title, platform: post.platform, format: 'single_image', createdBy: 'library' }, draft, channel, status: 'in_review', librarySourceId: post.id, updatedAt: Date.now() };
}

/** Governance: if SLACK_APPROVERS is set (comma-separated Slack user IDs), only those users may Approve/Publish. */
const APPROVERS = (process.env.SLACK_APPROVERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const canApprove = (userId: string | undefined): boolean => APPROVERS.length === 0 || (!!userId && APPROVERS.includes(userId));

/** Optional ops channel — publish failures are mirrored here for visibility. */
const OPS_CHANNEL = process.env.SLACK_OPS_CHANNEL;

/** Remembers the last channel a /draft ran in, used as the web-intake target when SLACK_INTAKE_CHANNEL isn't set. */
let lastChannel: string | undefined;

/**
 * Per-user sliding-window rate limiter (protects fal/Bedrock spend). Returns true if ALLOWED.
 * maxPerHour <= 0 disables it. In-memory (per process) — fine for v1.
 */
export function createRateLimiter(maxPerHour: number, nowFn: () => number = Date.now): (user: string) => boolean {
  const hits = new Map<string, number[]>();
  return (user: string): boolean => {
    if (maxPerHour <= 0) return true;
    const cutoff = nowFn() - 3_600_000;
    const times = (hits.get(user) ?? []).filter((t) => t > cutoff);
    if (times.length >= maxPerHour) {
      hits.set(user, times);
      return false;
    }
    times.push(nowFn());
    hits.set(user, times);
    return true;
  };
}

/** Parse "/draft [linkedin|instagram] [single|carousel] <idea>" — platform/format optional, idea is the rest. */
export interface DraftRequest {
  idea: string;
  format: PostFormat;
  createdBy: string;
  platforms: PublishPlatform[]; // 'both'/'all' → [linkedin, x] (one tailored draft each)
}

export function parseCommand(text: string, user: string): DraftRequest {
  const lower = text.toLowerCase();
  const platforms: PublishPlatform[] = /\b(both|all)\b/.test(lower)
    ? ['linkedin', 'x']
    : /\b(x|twitter|tweet)\b/.test(lower)
      ? ['x']
      : /\b(ig|insta|instagram)\b/.test(lower)
        ? ['instagram']
        : ['linkedin'];
  const format: PostFormat = /\bcarousel\b/.test(lower) ? 'carousel' : 'single_image';
  const idea =
    text
      .replace(/\b(both|all|li|linkedin|x|twitter|tweet|ig|insta|instagram|single_image|single|carousel)\b/gi, '')
      .replace(/^[\s:,-]+/, '')
      .trim() || text.trim();
  return { idea, format, createdBy: user, platforms };
}

/** Resolve a publishable view of a draft from its in-memory session (no DB). */
function resolvedFromDraft(draft: ComposedDraft): ResolvedPost {
  return {
    caption: draft.caption,
    mediaKeys: draft.images.map((i) => i.storageKey),
    aspectRatios: draft.images.map(() => draft.aspectRatio),
    altTexts: draft.images.map((i) => i.altText ?? ''),
    thread: draft.thread,
  };
}

export function createApp() {
  const token = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN; // xapp-… ⇒ Socket Mode (no public URL needed)
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!token) throw new Error('Slack not configured: set SLACK_BOT_TOKEN in .env.');
  const socketMode = !!appToken;
  if (!socketMode && !signingSecret) {
    throw new Error('Set SLACK_APP_TOKEN (Socket Mode) or SLACK_SIGNING_SECRET (HTTP mode) in .env.');
  }
  // deferInitialization: don't auth.test at construction (so tests/tools can build the app offline);
  // start() authenticates before listening. Socket Mode connects outbound — no Request URL / tunnel.
  const app = new App({
    token,
    logLevel: LogLevel.INFO,
    deferInitialization: true,
    ...(socketMode ? { socketMode: true, appToken } : { signingSecret }),
  });

  const allowDraft = createRateLimiter(Number(process.env.DRAFT_RATE_LIMIT_PER_HOUR ?? '20'));

  // Compose a draft, remember it, post the review card + upload the generated image(s) into the thread.
  async function runAndPost(client: any, channel: string, threadTs: string | undefined, input: ComposeInput): Promise<ComposedDraft> {
    const draft = await composeDraft(input, {
      // Live-update the "Drafting…" message so a 60–180s generation never looks hung.
      onProgress: (m) => {
        if (threadTs) void client.chat.update({ channel, ts: threadTs, text: m }).catch(() => {});
      },
    });
    await store.put({ postId: draft.postId, input, draft, channel, status: 'in_review', updatedAt: Date.now() });
    // Images first, then the card — so the actionable review card (buttons) is the most recent message.
    for (const img of draft.images) {
      await client.files.uploadV2({
        channel_id: channel,
        thread_ts: threadTs,
        filename: `${draft.postId}-${img.slideIndex}.png`,
        title: img.headline ?? `slide ${img.slideIndex + 1}`,
        file: await imageBytes(img),
      });
    }
    await client.chat.postMessage({ channel, thread_ts: threadTs, text: `Draft ${draft.postId} ready for review`, blocks: draftBlocks(draft) });
    return draft;
  }

  // Public https URL for the post's image, when one exists (library/DB posts → Supabase Storage public URL).
  // Local artifacts (AI drafts) aren't publicly addressable → undefined, and we fall back to a thread upload.
  const objectStore = createObjectStore();

  // Image bytes for a Slack upload, store-agnostic: read the local file if it exists (local store / dev),
  // otherwise fetch the bytes from the store URL (Supabase/S3 in prod, where localPath doesn't exist).
  async function imageBytes(img: ComposedDraft['images'][number]): Promise<Buffer> {
    try {
      return readFileSync(img.localPath);
    } catch {
      const url = await objectStore.url(img.storageKey);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`could not fetch image ${img.storageKey} (${resp.status})`);
      return Buffer.from(await resp.arrayBuffer());
    }
  }

  async function cardImageUrl(draft: ComposedDraft): Promise<string | undefined> {
    const key = draft.images[0]?.storageKey;
    if (!key) return undefined;
    if (/^https?:\/\//i.test(key)) return key; // already a URL
    if (key.startsWith('/') || key.startsWith('file://')) return undefined; // local file, not publicly addressable
    try {
      return await objectStore.url(key); // storage key → permanent public URL
    } catch {
      return undefined;
    }
  }

  const repost = async (client: any, s: DraftRecord): Promise<unknown> =>
    client.chat.postMessage({
      channel: s.channel,
      text: `Draft ${s.draft.postId}`,
      blocks: draftBlocks(s.draft, { edited: s.edited, scheduledAt: s.scheduledAt, library: s.draft.images[0]?.modelUsed === 'pre-made', imageUrl: await cardImageUrl(s.draft) }),
    });

  // Post a review card for a pre-made library post. The image shows INLINE on the card via its public URL
  // (Supabase Storage); only if there's no public URL but a real local file do we fall back to a thread upload.
  async function postLibraryCard(client: any, rec: DraftRecord): Promise<void> {
    const imageUrl = await cardImageUrl(rec.draft);
    const card = await client.chat.postMessage({ channel: rec.channel, text: `Library post ${rec.draft.postId}`, blocks: draftBlocks(rec.draft, { library: true, imageUrl }) });
    const localPath = rec.draft.images[0]?.localPath;
    if (!imageUrl && localPath && existsSync(localPath)) {
      try {
        await client.files.uploadV2({ channel_id: rec.channel, thread_ts: card.ts, file: readFileSync(localPath), filename: `${rec.draft.postId}.png`, title: rec.draft.idea });
      } catch (e) {
        await client.chat.postMessage({ channel: rec.channel, thread_ts: card.ts, text: `(image preview unavailable: ${msg(e)})` }).catch(() => {});
      }
    }
  }

  // /posts — list the pre-made content library and let the user pick one (no generation).
  app.command('/posts', async ({ command, ack, respond, client }) => {
    await ack();
    lastChannel = command.channel_id;
    let posts: LibraryPost[];
    try {
      posts = await library.list();
      console.log(`[posts] <@${command.user_id}> listed library → ${posts.length} posts`);
    } catch (e) {
      console.error('[posts] library load failed:', msg(e));
      await respond(`⛔ Couldn't load the content library: ${msg(e)}`);
      return;
    }
    if (!posts.length) {
      await respond('No posts in the content library yet. Add finished posts to the content folder, or seed the DB (`pnpm --filter @rss/core seed-library`).');
      return;
    }
    const PLATFORM_LABEL: Record<string, string> = { linkedin: '🔗 LinkedIn', x: '✖️ X', instagram: '📸 Instagram' };
    const shown = posts.slice(0, 30); // Slack message block cap; pagination is a later concern
    const needsImage = (p: LibraryPost): boolean => !!p.mediaRequired && !p.imagePath && !p.imageKey;
    const flags = (p: LibraryPost): string =>
      `${p.thread?.length ? ` · 🧵 ${p.thread.length}-tweet thread` : ''}${needsImage(p) ? ' · ⚠️ needs image to publish' : ''}`;
    const rows: any[] = shown.map((p) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${p.title}*\n${PLATFORM_LABEL[p.platform] ?? p.platform}${p.pillar ? ` · ${p.pillar}` : ''}${p.slot ? ` · 🗓️ ${p.slot}` : ''}${flags(p)}`,
      },
      accessory: { type: 'button', text: { type: 'plain_text', text: 'Select' }, action_id: 'pick_post', value: p.id },
    }));
    const header = `*📚 Content library* — ${posts.length} ready-made post(s)${posts.length > shown.length ? ` (showing ${shown.length})` : ''}. Pick one to send to review:`;
    await client.chat.postMessage({
      channel: command.channel_id,
      text: `📚 ${posts.length} posts available — pick one to review.`,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: header } }, { type: 'divider' }, ...rows],
    });
  });

  // A post was picked from the library dropdown → create the review card (Edit / Re-evaluate / Approve / Schedule / Publish).
  app.action('pick_post', async ({ ack, body, action, client }) => {
    await ack();
    const id = ((action as any).selected_option?.value ?? (action as any).value) as string | undefined; // button or select
    const channel = (body as any).channel?.id as string | undefined;
    if (!id || !channel) return;
    console.log(`[posts] pick_post → ${id}`);
    const post = await library.get(id);
    if (!post) {
      await client.chat.postMessage({ channel, text: `⚠️ Post \`${id}\` not found in the library.` });
      return;
    }
    const rec = draftFromLibrary(post, channel);
    await store.put(rec);
    await postLibraryCard(client, rec);
    console.log(`[posts] card posted for ${rec.draft.postId} (${post.platform})`);
  });

  // /draft <idea> — kick off the GENERATION pipeline (caption via Anthropic + image via fal).
  app.command('/draft', async ({ command, ack, respond, client }) => {
    await ack();
    // v1 is distribution-only: /draft needs an image model (fal). If it's not configured, fail clearly
    // instead of erroring mid-render — point the user at the picker.
    if (!process.env.FAL_API_KEY) {
      await respond('⚠️ `/draft` (AI generation) isn’t enabled in this deployment — no image model (FAL_API_KEY) is configured. Use `/posts` to pick and publish a ready-made post.');
      return;
    }
    if (!command.text?.trim()) {
      await respond('Usage: `/draft [linkedin|x|both] [single|carousel] <your idea>`');
      return;
    }
    if (!allowDraft(command.user_id)) {
      await respond('⛔ You’ve hit the drafting rate limit for this hour — try again shortly.');
      return;
    }
    const req = parseCommand(command.text, command.user_id);
    lastChannel = command.channel_id; // seed the web-intake fallback channel
    const thinking = await client.chat.postMessage({
      channel: command.channel_id,
      text: `🛠️ Drafting *${req.platforms.join(' + ')} ${req.format}* for: _${req.idea}_ … (caption + image, ~30–90s${req.platforms.length > 1 ? ' each' : ''})`,
    });
    try {
      // 'both' → one tailored draft per platform (different caption shaping + aspect ratio), each its own card.
      for (const platform of req.platforms) {
        await runAndPost(client, command.channel_id, thinking.ts, { idea: req.idea, platform, format: req.format, createdBy: req.createdBy });
      }
    } catch (e) {
      await client.chat.postMessage({ channel: command.channel_id, thread_ts: thinking.ts, text: `❌ Draft failed: ${msg(e)}` });
    }
  });

  // 🔄 Regenerate — re-run the same idea for a fresh take.
  app.action('regenerate', async ({ ack, client, action }) => {
    await ack();
    const session = await store.get((action as any).value as string);
    if (!session) return;
    const thinking = await client.chat.postMessage({ channel: session.channel, text: `🔄 Regenerating _${session.input.idea}_ …` });
    try {
      await runAndPost(client, session.channel, thinking.ts, { ...session.input, instruction: undefined });
    } catch (e) {
      await client.chat.postMessage({ channel: session.channel, thread_ts: thinking.ts, text: `❌ ${msg(e)}` });
    }
  });

  // ✏️ Edit / 💬 Refine / 🗓️ Schedule — open a modal carrying the postId.
  app.action('edit', async ({ ack, body, client, action }) => {
    await ack();
    const postId = (action as any).value as string;
    const session = await store.get(postId);
    if (!session) return;
    // X THREAD guard (same as make_ideal): publish ships draft.thread, so a caption-only edit would be
    // silently ignored at publish time. Refuse rather than let an edited card publish unedited tweets.
    if (session.draft.thread?.length) {
      await client.chat.postMessage({
        channel: session.channel,
        text: `⚠️ \`${postId}\` is a ${session.draft.thread.length}-tweet thread — X publishes the tweets, not the caption, so a caption edit here would NOT change what ships. Edit the thread in the source library post and re-pick it.`,
      });
      return;
    }
    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: inputModal({ callbackId: 'edit_submit', postId, title: 'Edit caption', label: 'Caption', actionId: 'edit_input', multiline: true, initialValue: session.draft.caption, submit: 'Save' }),
    });
  });

  app.action('refine', async ({ ack, body, client, action }) => {
    await ack();
    const postId = (action as any).value as string;
    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: inputModal({ callbackId: 'refine_submit', postId, title: 'Refine draft', label: 'How should I change it?', actionId: 'refine_input', multiline: true, placeholder: 'punchier; lead with the CV angle; cut the metaphor…', submit: 'Re-draft' }),
    });
  });

  // ✨ Make brand-ideal — Hermes (Anthropic) refines the CURRENT caption to pass the pillar checklist
  // (voice, locked CTA, approved hashtags, evidence) in place. Works for library posts too. Never invents
  // data: a missing figure becomes a [[DATA: …]] slot that blocks publish until a human fills it.
  app.action('make_ideal', async ({ ack, client, action }) => {
    await ack();
    const postId = (action as any).value as string;
    const session = await store.get(postId);
    if (!session) return;
    // X THREAD guard: publishing ships draft.thread (the per-tweet array), not the caption — refining only
    // the caption would show polished text on the card but publish the ORIGINAL tweets. Refuse until
    // per-tweet refine exists rather than ship a silent mismatch.
    if (session.draft.thread?.length) {
      await client.chat.postMessage({
        channel: session.channel,
        text: `⚠️ \`${postId}\` is a ${session.draft.thread.length}-tweet thread — X publishes the tweets, not the caption, so a caption-only refine would be silently ignored at publish. Per-tweet refine isn't built yet; fix the thread in the source library post and re-pick it.`,
      });
      return;
    }
    // Pillar hint for hashtag selection — library cards encode it in visualConcept ("<pillar> · pre-made image").
    const pillar = session.draft.visualConcept.includes('·') ? session.draft.visualConcept.split('·')[0]?.trim() : undefined;
    const thinking = await client.chat.postMessage({ channel: session.channel, text: '✨ Refining for brand — voice, locked CTA, approved hashtags, evidence …' });
    try {
      const refined = await refineForBrand(session.draft.caption, session.draft.platform, pillar);
      session.draft.caption = refined;
      session.draft.captionBody = refined;
      session.edited = true;
      session.updatedAt = Date.now();
      await store.put(session);
      await client.chat.postMessage({
        channel: session.channel,
        thread_ts: thinking.ts,
        text: hasUnfilledDataSlot(refined)
          ? '✨ Refined. ⚠️ It contains a `[[DATA: …]]` slot — replace it with a REAL figure (or cut that line) before publishing. Publish is blocked until you do.'
          : '✨ Refined for brand. Review the changes on the updated card before approving.',
      });
      await repost(client, session);
    } catch (e) {
      await client.chat.postMessage({ channel: session.channel, thread_ts: thinking.ts, text: `❌ Refine failed: ${msg(e)}` });
    }
  });

  app.action('schedule', async ({ ack, body, client, action }) => {
    await ack();
    const postId = (action as any).value as string;
    await client.views.open({ trigger_id: (body as any).trigger_id, view: scheduleModal(postId) });
  });

  // Modal submissions.
  const fieldValue = (view: any, actionId: string): string => view.state?.values?.field?.[actionId]?.value ?? '';

  app.view('edit_submit', async ({ ack, view, client }) => {
    await ack();
    const session = await store.get(view.private_metadata);
    if (!session) return;
    session.draft.caption = fieldValue(view, 'edit_input');
    session.edited = true;
    session.updatedAt = Date.now();
    await store.put(session);
    await repost(client, session);
  });

  app.view('refine_submit', async ({ ack, view, client }) => {
    await ack();
    const session = await store.get(view.private_metadata);
    if (!session) return;
    const instruction = fieldValue(view, 'refine_input');
    const thinking = await client.chat.postMessage({ channel: session.channel, text: `💬 Refining (_${instruction}_) …` });
    try {
      await runAndPost(client, session.channel, thinking.ts, { ...session.input, instruction });
    } catch (e) {
      await client.chat.postMessage({ channel: session.channel, thread_ts: thinking.ts, text: `❌ ${msg(e)}` });
    }
  });

  app.view('schedule_submit', async ({ ack, view, client, body }) => {
    await ack();
    const session = await store.get(view.private_metadata);
    if (!session) return;
    const user = (body as any).user?.id as string | undefined;
    if (!canApprove(user)) {
      await client.chat.postMessage({ channel: session.channel, text: `⛔ <@${user}> isn't on the approver allowlist — scheduling requires an approver.` });
      return;
    }
    const ts = (view as any).state?.values?.when?.when_input?.selected_date_time as number | undefined; // unix seconds
    if (!ts) {
      await client.chat.postMessage({ channel: session.channel, text: '⛔ No time selected — schedule cancelled.' });
      return;
    }
    session.scheduledAtMs = ts * 1000;
    session.scheduledAt = new Date(ts * 1000).toISOString();
    session.status = 'scheduled';
    session.approvedBy = user; // scheduling implies approval by the (allowlisted) scheduler
    session.updatedAt = Date.now();
    await store.put(session);
    await client.chat.postMessage({
      channel: session.channel,
      text: `🗓️ \`${session.draft.postId}\` scheduled for <!date^${ts}^{date_short_pretty} at {time}|${session.scheduledAt}> by <@${user}>. The worker publishes it when due (\`pnpm --filter @rss/worker start\`).`,
    });
  });

  // ✅ Approve — record approval (DB persistence is the next step; publishing is a separate, gated action).
  app.action('approve', async ({ ack, body, client, action }) => {
    await ack();
    const session = await store.get((action as any).value as string);
    const user = (body as any).user?.id as string | undefined;
    if (!session) return;
    if (!canApprove(user)) {
      await client.chat.postMessage({ channel: session.channel, text: `⛔ <@${user}> isn't on the approver allowlist — ask an approver to sign off.` });
      return;
    }
    session.approvedBy = user;
    session.updatedAt = Date.now();
    await store.put(session);
    await client.chat.postMessage({
      channel: session.channel,
      text: `✅ <@${user}> approved \`${session.draft.postId}\`. Use a *Publish* button to push it live (gated on LinkedIn OAuth / Meta review), or *Schedule* it.`,
    });
  });

  // 🔎 Re-evaluate — re-run the Anthropic brand-voice validator against the current draft caption.
  app.action('reevaluate', async ({ ack, action, client }) => {
    await ack();
    const session = await store.get((action as any).value as string);
    if (!session) return;
    const thinking = await client.chat.postMessage({ channel: session.channel, text: `🔎 Re-evaluating \`${session.draft.postId}\` against brand voice…` });
    const ts = thinking.ts as string;
    try {
      const v = await validatePost({
        platform: session.draft.platform,
        caption: session.draft.caption,
        altText: session.draft.images?.[0]?.altText,
      });
      const icon = v.decision === 'approve' ? '✅' : v.decision === 'hold' ? '⏸️' : '🚩';
      const c = v.voiceChecks;
      const mk = (b: boolean): string => (b ? '✓' : '✗');
      const checks = `3rd ${mk(c.thirdPerson)} · no-! ${mk(c.noExclamation)} · no-emdash ${mk(c.noEmDashes)} · no-banned ${mk(c.noBannedPhrases)} · numbers ${mk(c.specificNumbers)} · no-coaching ${mk(c.noMotivationalCoaching)} · no-dunk ${mk(c.noCompetitorDunking)}`;
      const fitIcon = v.platformFit.verdict === 'fits' ? '✅' : v.platformFit.verdict === 'marginal' ? '⚠️' : '🚩';
      const fit = `${fitIcon} *Platform fit (${session.draft.platform}):* ${v.platformFit.verdict} — ${v.platformFit.reason}`;
      const why = v.reasons.map((r) => `• ${r}`).join('\n'); // one bullet per reason — scannable, never a wall of text
      const edits = v.suggestedEdits?.length ? `\n*Fix:* ${v.suggestedEdits.join('; ')}` : '';
      await client.chat.update({
        channel: session.channel,
        ts,
        text: `${icon} *${v.decision.toUpperCase()}* — \`${session.draft.postId}\`\n${why}\n${fit}\n*Voice:* ${checks}${edits}`,
      });
    } catch (e) {
      await client.chat.update({ channel: session.channel, ts, text: `❌ re-evaluate failed: ${msg(e)}` });
    }
  });

  // 🔁 Adapt — reshape this post for the OTHER platform (cross-post done right: rewritten, not copied).
  app.action('adapt', async ({ ack, body, action, client }) => {
    await ack();
    const session = await store.get((action as any).value as string);
    const channel = ((body as any).channel?.id as string | undefined) ?? session?.channel;
    if (!session || !channel) return;
    const TARGET: Record<string, PublishPlatform> = { x: 'linkedin', linkedin: 'x', instagram: 'linkedin' };
    const target = TARGET[session.draft.platform];
    if (!target) return;
    const thinking = await client.chat.postMessage({ channel, text: `🔁 Adapting \`${session.draft.postId}\` for ${target}…` });
    const tts = thinking.ts as string;
    try {
      const adapted = await adaptCaption(session.draft.caption, session.draft.platform, target);
      const newId = `adapt-${target}-${Date.now().toString(36)}`;
      const rec: DraftRecord = {
        postId: newId,
        input: { idea: session.input.idea, platform: target, format: 'single_image', createdBy: 'adapt' },
        draft: {
          ...session.draft,
          postId: newId,
          platform: target,
          caption: adapted,
          captionBody: adapted,
          hook: adapted.split('\n').find((l) => l.trim()) ?? session.draft.hook,
          aspectRatio: target === 'instagram' ? '4:5' : '1.91:1',
          images: session.draft.images.map((i) => ({ ...i, modelUsed: 'pre-made' })), // carry image; 'pre-made' hides Regenerate/Refine
          // The adaptation is a fresh single-body post for the TARGET platform: never inherit the source's
          // X thread (publishing would ship the stale original tweets) or its media-required flag (that
          // verdict belongs to the source platform's format — e.g. an IG caption adapted to LinkedIn is a
          // valid text post).
          thread: undefined,
          mediaRequired: undefined,
        },
        channel,
        status: 'in_review',
        updatedAt: Date.now(),
      };
      await store.put(rec);
      await client.chat.update({ channel, ts: tts, text: `🔁 Adapted \`${session.draft.postId}\` (${session.draft.platform}) → ${target}. New card below for review.` });
      await postLibraryCard(client, rec);
    } catch (e) {
      await client.chat.update({ channel, ts: tts, text: `❌ adapt failed: ${msg(e)}` });
    }
  });

  // 🚀 Publish — approval-gated + idempotent; session-backed (no DB). Fail-safe: no creds/public URLs ⇒ a clear refusal.
  const publishTargets: [string, PublishPlatform][] = [
    ['publish_linkedin', 'linkedin'],
    ['publish_x', 'x'],
    ['publish_instagram', 'instagram'], // IG channel is connected; the card only shows this button when the post has an image (IG requires media)
  ];
  for (const [actionId, platform] of publishTargets) {
    app.action(actionId, async ({ ack, body, client, action }) => {
      await ack();
      const postId = (action as any).value as string;
      const user = (body as any).user?.id as string | undefined;
      const session = await store.get(postId);
      if (!session) {
        const channel = (body as any).channel?.id as string | undefined;
        if (channel) await client.chat.postMessage({ channel, text: `⚠️ Draft \`${postId}\` not found in the draft store. Re-draft first.` });
        return;
      }
      if (!canApprove(user)) {
        await client.chat.postMessage({ channel: session.channel, text: `⛔ <@${user}> isn't on the approver allowlist — publishing requires an approver.` });
        return;
      }
      // Media-required guard: image-essential posts (IG always; transcript/quote/data cards) must have an image.
      if (session.draft.mediaRequired && session.draft.images.length === 0) {
        await client.chat.postMessage({
          channel: session.channel,
          text: `🛑 \`${session.librarySourceId ?? postId}\` needs an image (it's an image-essential post) and has none. Not publishing an incomplete post — add the image, then publish.`,
        });
        return;
      }
      // Unfilled-data guard: a refined post must not ship with a [[DATA: …]] placeholder (no fabricated/empty evidence).
      if (hasUnfilledDataSlot(session.draft.caption)) {
        await client.chat.postMessage({
          channel: session.channel,
          text: `🛑 \`${postId}\` still has an unfilled \`[[DATA: …]]\` slot. Replace it with a real figure (✏️ Edit) or remove that line before publishing — never ship a placeholder.`,
        });
        return;
      }
      // Content-level double-post guard: this exact library post already live on this platform? Refuse.
      const prior = await findPriorPublish(store, session.librarySourceId, platform, postId);
      if (prior) {
        await client.chat.postMessage({
          channel: session.channel,
          text: `🛑 \`${session.librarySourceId}\` was already published to *${platform}* (external id \`${prior}\`). Not re-publishing to avoid a duplicate. Pick a different post, or delete that one on ${platform} first if this is intentional.`,
        });
        return;
      }
      // LinkedIn carousels now use the MultiImage API (adapter branches on media count), so 'carousel' for both.
      const format: 'single' | 'carousel' = session.draft.format === 'carousel' ? 'carousel' : 'single';
      const deps = makeInMemoryPublishDeps(platform, {
        resolve: async (id) => {
          const s = await store.get(id);
          return s ? resolvedFromDraft(s.draft) : null;
        },
        setStatus: async (id, status) => {
          const s = await store.get(id);
          if (s) {
            s.status = status;
            s.updatedAt = Date.now();
            await store.put(s);
          }
        },
        // Durable idempotency: a prior success is recorded on the draft record, so a re-click after a
        // restart is a no-op rather than a double-post.
        findSuccessfulPublish: async (id, p) => (await store.get(id))?.externalIds?.[p] ?? null,
        recordPublish: async (entry) => {
          if (entry.status !== 'success' || !entry.externalId) return;
          const s = await store.get(entry.postId);
          if (s) {
            s.externalIds = { ...(s.externalIds ?? {}), [entry.platform]: entry.externalId };
            s.updatedAt = Date.now();
            await store.put(s);
          }
        },
        onFailure: (m) => {
          console.error('[publish:failure]', m);
          if (OPS_CHANNEL) void client.chat.postMessage({ channel: OPS_CHANNEL, text: `⛔ Publish failed: ${m}` }).catch(() => {});
        },
      });
      try {
        const out = await publishPost({ postId, platform, format: format as any, approvedBy: user ?? 'slack' }, deps);
        await client.chat.postMessage({ channel: session.channel, text: `🚀 Published \`${postId}\` to ${platform}. external id: ${out.externalId ?? '(skipped/idempotent)'}` });
      } catch (e) {
        const text = `⛔ Publish to ${platform} blocked for \`${postId}\`: ${msg(e)}`;
        await client.chat.postMessage({ channel: session.channel, text });
        if (OPS_CHANNEL && OPS_CHANNEL !== session.channel) await client.chat.postMessage({ channel: OPS_CHANNEL, text }).catch(() => {});
      }
    });
  }

  // ── Anthropic decision agent — chat (no generation) ─────────────────────────────────────────
  // Responds on @mention and in DMs. Uses the brand voice docs + a short summary of the draft queue.
  async function summarizeQueue(): Promise<string> {
    const all = await store.all();
    if (!all.length) return 'queue is empty.';
    const lines = all.slice(0, 12).map((r) => {
      const sched = r.scheduledAt ? ` · scheduled ${r.scheduledAt}` : '';
      const apr = r.approvedBy ? ` · approved by <@${r.approvedBy}>` : '';
      return `- \`${r.postId}\` · ${r.input.platform}/${r.input.format} · status=${r.status}${sched}${apr}`;
    });
    return `${all.length} draft(s) in store (showing ${Math.min(all.length, 12)}):\n${lines.join('\n')}`;
  }

  async function chat(channel: string, threadTs: string | undefined, userId: string | undefined, body: string): Promise<void> {
    if (!body.trim()) return;
    try {
      const queueSummary = await summarizeQueue();
      const reply = await respondToMessage(body, { queueSummary, userId });
      await app.client.chat.postMessage({ channel, ...(threadTs ? { thread_ts: threadTs } : {}), text: toSlackPlain(reply) });
    } catch (e) {
      await app.client.chat
        .postMessage({ channel, ...(threadTs ? { thread_ts: threadTs } : {}), text: `⛔ chat failed: ${msg(e)}` })
        .catch(() => {});
    }
  }

  // Threads where Hermes is "live" — once you @mention it, keep chatting in that thread tag-free.
  // In-memory (re-mention to re-activate after a restart); a stateless fallback re-detects participation.
  const activeThreads = new Set<string>();
  const threadKey = (channel: string, ts: string): string => `${channel}:${ts}`;

  // @mention in any channel — strip the mention, reply in-thread, and mark the thread live.
  app.event('app_mention', async ({ event }) => {
    const e = event as any;
    const thread = e.thread_ts ?? e.ts;
    activeThreads.add(threadKey(e.channel, thread));
    const text = String(e.text ?? '').replace(/<@[^>]+>/g, '').trim();
    await chat(e.channel, thread, e.user, text);
  });

  // DMs (no tag needed) + tag-free follow-ups in a live Hermes thread.
  app.message(async ({ message, context }) => {
    const m = message as any;
    const botId = context.botUserId;
    if (m.bot_id || m.subtype === 'bot_message') return; // ignore bots (incl. our own replies)
    if (botId && m.user === botId) return;
    if (typeof m.text !== 'string') return;

    // 1) DMs: every message is a conversation turn.
    if (m.channel_type === 'im') {
      await chat(m.channel, undefined, m.user, m.text);
      return;
    }

    // 2) Channel messages: only thread replies, and only in a thread Hermes is part of.
    const thread = m.thread_ts;
    if (!thread) return; // top-level channel chatter needs an @mention to start
    if (botId && m.text.includes(`<@${botId}>`)) return; // a fresh @mention → handled by app_mention (avoid double reply)

    const key = threadKey(m.channel, thread);
    let live = activeThreads.has(key);
    if (!live) {
      // Stateless fallback (survives restarts): did Hermes already speak in this thread?
      try {
        const r = await app.client.conversations.replies({ channel: m.channel, ts: thread, limit: 50 });
        live = !!r.messages?.some((mm: any) => mm.bot_id || (botId && mm.user === botId));
        if (live) activeThreads.add(key);
      } catch {
        /* not in channel / no history scope — ignore */
      }
    }
    if (live) await chat(m.channel, thread, m.user, m.text);
  });

  // Web intake: same-process handler so web-submitted drafts share the same durable store (the buttons work).
  async function handleIntake(req: DraftRequest): Promise<{ postIds: string[]; channel: string }> {
    const channel = process.env.SLACK_INTAKE_CHANNEL || lastChannel;
    if (!channel) {
      throw new Error('No intake channel yet — either set SLACK_INTAKE_CHANNEL, or just run /draft once in your review channel so the bot learns it, then submit again.');
    }
    const thinking = await app.client.chat.postMessage({
      channel,
      text: `🛠️ Web intake: drafting *${req.platforms.join(' + ')} ${req.format}* for: _${req.idea}_ …`,
    });
    const postIds: string[] = [];
    for (const platform of req.platforms) {
      const draft = await runAndPost(app.client, channel, thinking.ts, { idea: req.idea, platform, format: req.format, createdBy: req.createdBy });
      postIds.push(draft.postId);
    }
    return { postIds, channel };
  }

  return { app, handleIntake };
}
