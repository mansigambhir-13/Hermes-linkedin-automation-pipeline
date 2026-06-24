/**
 * Drive the Slack pipeline WITHOUT Slack — verifies idea → caption → image(s) end to end.
 * Run from repo root (cwd matters for caption-gate/artifact paths):
 *   node --env-file=.env --import tsx apps/slack-bot/scripts/compose.ts "your idea here"
 *   PLATFORM=instagram FORMAT=carousel node --env-file=.env --import tsx apps/slack-bot/scripts/compose.ts "idea"
 */
import { composeDraft } from '@rss/agent';
import type { PostFormat, PublishPlatform } from '@rss/core';

const idea = process.argv.slice(2).join(' ') || 'Why mock interviews beat re-reading your notes the night before';
const platform = (process.env.PLATFORM as PublishPlatform) || 'linkedin';
const format = (process.env.FORMAT as PostFormat) || 'single_image';

const draft = await composeDraft({ idea, platform, format, createdBy: 'cli' });
console.log(
  JSON.stringify(
    {
      postId: draft.postId,
      platform: draft.platform,
      format: draft.format,
      hook: draft.hook,
      ctaApplied: draft.ctaApplied,
      banned: draft.banned,
      caption: draft.caption,
      images: draft.images.map((i) => ({ slide: i.slideIndex, model: i.modelUsed, path: i.localPath, headline: i.headline })),
    },
    null,
    2,
  ),
);
