import { getDb } from './db.js';
import type { Platform, PostFormat, PostStatus, PublishPlatform, PublishStatus } from './schemas.js';

/**
 * Data access for posts. Supabase is the system of record (06 §B1) — these are the only
 * writers/readers of post state. Requires DATABASE_URL (see getDb).
 */
export interface DraftInput {
  source: string; // ui | slack | auto_idea
  created_by: string;
  platform: Platform;
  format: PostFormat;
  caption_body_linkedin?: string;
  caption_body_instagram?: string;
  visual_concept?: string;
  rationale?: string;
  aspect_ratio?: string;
}

export async function insertDraft(d: DraftInput): Promise<{ post_id: string }> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    insert into posts
      (source, created_by, platform, format, caption_body_linkedin, caption_body_instagram,
       visual_concept, rationale, aspect_ratio, status)
    values
      (${d.source}, ${d.created_by}, ${d.platform}, ${d.format},
       ${d.caption_body_linkedin ?? null}, ${d.caption_body_instagram ?? null},
       ${d.visual_concept ?? null}, ${d.rationale ?? null}, ${d.aspect_ratio ?? null}, 'drafting')
    returning id`;
  const first = rows[0];
  if (!first) throw new Error('insertDraft: no row returned');
  return { post_id: first.id };
}

export interface PostWithImages {
  post: Record<string, unknown>;
  images: Record<string, unknown>[];
}

export async function getPost(postId: string): Promise<PostWithImages | null> {
  const sql = getDb();
  const posts = await sql<Record<string, unknown>[]>`select * from posts where id = ${postId}`;
  const post = posts[0];
  if (!post) return null;
  const images = await sql<Record<string, unknown>[]>`
    select * from post_images where post_id = ${postId} order by slide_index asc`;
  return { post, images: [...images] };
}

export async function updatePostStatus(postId: string, status: PostStatus): Promise<{ updated: boolean }> {
  const sql = getDb();
  const rows = await sql`update posts set status = ${status} where id = ${postId} returning id`;
  return { updated: rows.length > 0 };
}

/** Idempotency: the external_id of a prior SUCCESSFUL publish for (post, platform), or null. */
export async function findSuccessfulPublish(
  postId: string,
  platform: PublishPlatform,
): Promise<string | null> {
  const sql = getDb();
  const rows = await sql<{ external_id: string | null }[]>`
    select external_id from publish_log
    where post_id = ${postId} and platform = ${platform} and status = 'success'
    order by attempted_at desc limit 1`;
  const row = rows[0];
  return row ? row.external_id : null;
}

export interface PublishLogEntry {
  postId: string;
  platform: PublishPlatform;
  externalId: string | null;
  status: PublishStatus;
  error?: string;
}

export async function insertPublishLog(entry: PublishLogEntry): Promise<void> {
  const sql = getDb();
  await sql`
    insert into publish_log (post_id, platform, external_id, status, error)
    values (${entry.postId}, ${entry.platform}, ${entry.externalId ?? null}, ${entry.status}, ${entry.error ?? null})`;
}

/** Idea inbox (Phase 6 auto-ideas). Always status='proposed' — a human selects before drafting (never auto-publish). */
export async function insertIdea(entry: { idea: string; angle?: string; source: 'auto' | 'human' }): Promise<{ id: string }> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    insert into idea_inbox (idea, angle, source)
    values (${entry.idea}, ${entry.angle ?? null}, ${entry.source})
    returning id`;
  const row = rows[0];
  if (!row) throw new Error('insertIdea: no row returned');
  return { id: row.id };
}
