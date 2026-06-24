import { hasUnfilledDataSlot, type ComposedDraft } from '@rss/agent';

/**
 * Block Kit for the review message. Typed loosely (any[]) on purpose — this is a presentation/transport layer;
 * the pipeline (@rss/agent) carries the real types. Generated images are uploaded as files separately (local
 * artifacts have no public URL, so we can't use image blocks).
 */
const trunc = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface DraftMeta {
  edited?: boolean;
  scheduledAt?: string;
  /** Pre-made post chosen from the content library — hide Regenerate/Refine (nothing is generated). */
  library?: boolean;
  /** Public (https) URL of the attached image — rendered as an inline preview block on the card. */
  imageUrl?: string;
}

/** Platform caption limits — used to flag a too-long draft in the review card. */
const CAPTION_LIMIT: Record<string, number> = { linkedin: 3000, instagram: 2200, x: 280 };

export function draftBlocks(draft: ComposedDraft, meta: DraftMeta = {}): any[] {
  const len = draft.caption.length;
  const limit = CAPTION_LIMIT[draft.platform] ?? 3000;
  const lenText = `✍️ ${len.toLocaleString()} chars${len > limit ? ` ⚠️ over ${draft.platform} limit (${limit.toLocaleString()})` : ''}`;
  const context: any[] = [
    { type: 'mrkdwn', text: `🆔 \`${draft.postId}\`` },
    { type: 'mrkdwn', text: `📐 ${draft.aspectRatio} · ${draft.images.length} image(s) · ${draft.images[0]?.modelUsed ?? '—'}` },
    { type: 'mrkdwn', text: lenText },
    { type: 'mrkdwn', text: draft.ctaApplied ? '✅ CTA/hashtags applied' : '⚠️ CTA/hashtags stubbed (provisional)' },
  ];
  if (meta.edited) context.push({ type: 'mrkdwn', text: '✏️ manually edited' });
  if (meta.scheduledAt) context.push({ type: 'mrkdwn', text: `🗓️ scheduled ${meta.scheduledAt}` });
  if (meta.library) context.push({ type: 'mrkdwn', text: '📚 from content library (pre-made)' });
  if (draft.thread?.length) context.push({ type: 'mrkdwn', text: `🧵 X thread — ${draft.thread.length} tweets (publishes in full)` });
  if (draft.banned.length) context.push({ type: 'mrkdwn', text: `🚫 banned: ${draft.banned.join(', ')}` });

  // Review actions — generation buttons (Refine/Regenerate) only make sense for AI-authored drafts.
  const reviewActions: any[] = [
    { type: 'button', style: 'primary', text: { type: 'plain_text', text: '✅ Approve', emoji: true }, action_id: 'approve', value: draft.postId },
    { type: 'button', text: { type: 'plain_text', text: '✏️ Edit', emoji: true }, action_id: 'edit', value: draft.postId },
    { type: 'button', text: { type: 'plain_text', text: '🔎 Re-evaluate', emoji: true }, action_id: 'reevaluate', value: draft.postId },
    // ✨ Make brand-ideal — Anthropic refine to the pillar checklist (voice/CTA/hashtags/evidence). Works for library posts too.
    { type: 'button', text: { type: 'plain_text', text: '✨ Make brand-ideal', emoji: true }, action_id: 'make_ideal', value: draft.postId },
  ];
  if (!meta.library) {
    reviewActions.push(
      { type: 'button', text: { type: 'plain_text', text: '💬 Refine', emoji: true }, action_id: 'refine', value: draft.postId },
      { type: 'button', text: { type: 'plain_text', text: '🔄 Regenerate', emoji: true }, action_id: 'regenerate', value: draft.postId },
    );
  }

  // Platform-aware publish: only offer the button that matches THIS post's platform — a structural guard
  // against cross-posting X copy to LinkedIn (or vice versa). Cross-posting is a deliberate, separate action.
  const PUBLISH: Record<string, { label: string; action: string }> = {
    linkedin: { label: 'Publish → LinkedIn', action: 'publish_linkedin' },
    x: { label: 'Publish → X', action: 'publish_x' },
    instagram: { label: 'Publish → Instagram', action: 'publish_instagram' },
  };
  const publishActions: any[] = [{ type: 'button', text: { type: 'plain_text', text: '🗓️ Schedule', emoji: true }, action_id: 'schedule', value: draft.postId }];
  const target = PUBLISH[draft.platform];
  const needsImage = !!draft.mediaRequired && draft.images.length === 0; // IG always; image-essential cards
  const needsData = hasUnfilledDataSlot(draft.caption); // a refine left a [[DATA: …]] slot — must be filled first
  if (needsData) context.push({ type: 'mrkdwn', text: '🔢 Has an unfilled `[[DATA: …]]` slot — fill it with a real figure (or cut it) before publishing.' });
  if (target) {
    if (needsImage) {
      const why = draft.platform === 'instagram' ? 'Instagram requires media' : 'this is an image-essential post';
      context.push({ type: 'mrkdwn', text: `🖼️ Needs an image to publish (${why}) — Schedule only until media is added.` });
    } else if (!needsData) {
      publishActions.push({ type: 'button', style: 'primary', text: { type: 'plain_text', text: target.label, emoji: true }, action_id: target.action, value: draft.postId });
    }
  }
  // Cross-post adaptation: deliberately reshape this post for the other main platform (never a raw copy).
  const CROSS: Record<string, string> = { x: 'LinkedIn', linkedin: 'X', instagram: 'LinkedIn' };
  const other = CROSS[draft.platform];
  if (other) {
    publishActions.push({ type: 'button', text: { type: 'plain_text', text: `🔁 Adapt for ${other}`, emoji: true }, action_id: 'adapt', value: draft.postId });
  }

  return [
    { type: 'header', text: { type: 'plain_text', text: `🎬 ${draft.platform} · ${draft.format}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Hook:* ${trunc(draft.hook, 280)}` } },
    { type: 'section', text: { type: 'mrkdwn', text: trunc(draft.caption, 2900) } },
    // Inline image preview when the post has an attached image with a public URL (library/DB-backed posts).
    ...(meta.imageUrl ? [{ type: 'image', image_url: meta.imageUrl, alt_text: draft.images[0]?.altText ?? draft.idea }] : []),
    { type: 'context', elements: [{ type: 'mrkdwn', text: `💡 _${trunc(draft.visualConcept, 150)}_` }] },
    { type: 'context', elements: context },
    {
      type: 'actions',
      block_id: `review_${draft.postId}`,
      elements: reviewActions,
    },
    {
      type: 'actions',
      block_id: `publish_${draft.postId}`,
      elements: publishActions,
    },
  ];
}

/** Schedule modal with a real date-time picker → view_submission yields a unix `selected_date_time`. */
export function scheduleModal(postId: string): any {
  return {
    type: 'modal',
    callback_id: 'schedule_submit',
    private_metadata: postId,
    title: { type: 'plain_text', text: 'Schedule post' },
    submit: { type: 'plain_text', text: 'Schedule' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'when',
        label: { type: 'plain_text', text: 'Publish at' },
        element: { type: 'datetimepicker', action_id: 'when_input' },
      },
    ],
  };
}

/** Simple single-input modal (used by Edit / Refine). */
export function inputModal(opts: {
  callbackId: string;
  postId: string;
  title: string;
  label: string;
  actionId: string;
  multiline?: boolean;
  initialValue?: string;
  submit?: string;
  placeholder?: string;
}): any {
  return {
    type: 'modal',
    callback_id: opts.callbackId,
    private_metadata: opts.postId,
    title: { type: 'plain_text', text: opts.title },
    submit: { type: 'plain_text', text: opts.submit ?? 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'field',
        label: { type: 'plain_text', text: opts.label },
        element: {
          type: 'plain_text_input',
          action_id: opts.actionId,
          multiline: opts.multiline ?? false,
          ...(opts.initialValue ? { initial_value: opts.initialValue } : {}),
          ...(opts.placeholder ? { placeholder: { type: 'plain_text', text: opts.placeholder } } : {}),
        },
      },
    ],
  };
}
