import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getDb } from '@rss/core/db';
import type { PostStatus } from '@rss/core';
import type { ComposeInput, ComposedDraft } from './pipeline.js';

/**
 * A persisted draft + its review state. Stored by the Slack bot and read by the scheduling worker, so the
 * store must be shared across processes. Two backends behind one async interface:
 *  - file  (dev default): a JSON file both processes read (durable across restarts).
 *  - supabase (prod):     a `draft_records` table (jsonb doc + indexed status/scheduled_at_ms) — the SoR.
 *  - memory (tests).
 * Async so the Supabase backend (Postgres) fits; the bot/worker handlers are already async.
 */
export interface DraftRecord {
  postId: string;
  input: ComposeInput;
  draft: ComposedDraft;
  channel: string; // Slack channel for review + notifications
  status: PostStatus;
  approvedBy?: string;
  edited?: boolean;
  scheduledAt?: string; // human-readable label
  scheduledAtMs?: number; // when to publish (epoch ms) — the worker compares against now
  /** Per-platform external post ids of SUCCESSFUL publishes — durable idempotency (survives restarts). */
  externalIds?: Record<string, string>;
  /** The content-library post this draft was picked from (for content-level double-post prevention). */
  librarySourceId?: string;
  /** How many scheduled-publish attempts have failed transiently (worker retry bookkeeping, jsonb-only). */
  retryCount?: number;
  /** Epoch ms before which the worker must not re-attempt this scheduled publish (exponential backoff). */
  nextAttemptAtMs?: number;
  updatedAt: number;
}

/** Backoff schedule for transient scheduled-publish failures: 2 min → 5 min → 15 min, then give up. */
export const RETRY_BACKOFF_MS = [120_000, 300_000, 900_000] as const;

/**
 * Delay before the next retry given how many attempts have already failed.
 * Returns null when retries are exhausted (the worker should mark the record failed + alert).
 */
export function retryDelayMs(failedAttempts: number): number | null {
  return RETRY_BACKOFF_MS[failedAttempts - 1] ?? null;
}

/** Is this due record actually ready to attempt now? (false while a retry backoff window is still open) */
export function readyForAttempt(rec: Pick<DraftRecord, 'nextAttemptAtMs'>, nowMs: number): boolean {
  return rec.nextAttemptAtMs === undefined || rec.nextAttemptAtMs <= nowMs;
}

export interface DraftStore {
  get(postId: string): Promise<DraftRecord | undefined>;
  put(record: DraftRecord): Promise<void>;
  all(): Promise<DraftRecord[]>;
  /** Approved, scheduled, and due (scheduledAtMs <= nowMs) — what the worker publishes. */
  dueScheduled(nowMs: number): Promise<DraftRecord[]>;
}

/**
 * Content-level double-post guard: has the SAME library post already been published to this platform
 * (by any other draft record)? Returns the prior external id if so. Prevents an accidental re-pick of the
 * same post from publishing a duplicate (per-card idempotency only covers re-clicking the same card).
 */
export async function findPriorPublish(
  store: DraftStore,
  librarySourceId: string | undefined,
  platform: string,
  excludePostId: string,
): Promise<string | null> {
  if (!librarySourceId) return null;
  for (const r of await store.all()) {
    if (r.postId === excludePostId) continue;
    if (r.librarySourceId === librarySourceId && r.externalIds?.[platform]) return r.externalIds[platform]!;
  }
  return null;
}

const isDue = (r: DraftRecord, nowMs: number): boolean =>
  r.status === 'scheduled' && typeof r.scheduledAtMs === 'number' && r.scheduledAtMs <= nowMs && !!r.approvedBy;

class MemoryDraftStore implements DraftStore {
  private readonly m = new Map<string, DraftRecord>();
  async get(id: string): Promise<DraftRecord | undefined> {
    return this.m.get(id);
  }
  async put(r: DraftRecord): Promise<void> {
    this.m.set(r.postId, r);
  }
  async all(): Promise<DraftRecord[]> {
    return [...this.m.values()];
  }
  async dueScheduled(nowMs: number): Promise<DraftRecord[]> {
    return [...this.m.values()].filter((r) => isDue(r, nowMs));
  }
}

/** Durable across restarts + shared between bot and worker via a single JSON file. Fine for v1 volume. */
class FileDraftStore implements DraftStore {
  constructor(private readonly path: string) {}
  private read(): Record<string, DraftRecord> {
    if (!existsSync(this.path)) return {};
    try {
      return JSON.parse(readFileSync(this.path, 'utf8')) as Record<string, DraftRecord>;
    } catch {
      return {};
    }
  }
  private write(data: Record<string, DraftRecord>): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(data, null, 2));
  }
  async get(id: string): Promise<DraftRecord | undefined> {
    return this.read()[id];
  }
  async put(r: DraftRecord): Promise<void> {
    const data = this.read();
    data[r.postId] = r;
    this.write(data);
  }
  async all(): Promise<DraftRecord[]> {
    return Object.values(this.read());
  }
  async dueScheduled(nowMs: number): Promise<DraftRecord[]> {
    return Object.values(this.read()).filter((r) => isDue(r, nowMs));
  }
}

/** Supabase/Postgres backend — the production system of record (table `draft_records`, migration 0002). */
class SupabaseDraftStore implements DraftStore {
  async get(id: string): Promise<DraftRecord | undefined> {
    const rows = await getDb()<{ record: DraftRecord }[]>`select record from draft_records where post_id = ${id}`;
    return rows[0]?.record;
  }
  async put(r: DraftRecord): Promise<void> {
    const sql = getDb();
    await sql`
      insert into draft_records (post_id, record, status, platform, scheduled_at_ms, approved_by, updated_at)
      values (${r.postId}, ${sql.json(r as unknown as Parameters<typeof sql.json>[0])}, ${r.status}, ${r.input.platform}, ${r.scheduledAtMs ?? null}, ${r.approvedBy ?? null}, now())
      on conflict (post_id) do update set
        record = excluded.record, status = excluded.status, platform = excluded.platform,
        scheduled_at_ms = excluded.scheduled_at_ms, approved_by = excluded.approved_by, updated_at = now()`;
  }
  async all(): Promise<DraftRecord[]> {
    const rows = await getDb()<{ record: DraftRecord }[]>`select record from draft_records`;
    return rows.map((x) => x.record);
  }
  async dueScheduled(nowMs: number): Promise<DraftRecord[]> {
    const rows = await getDb()<{ record: DraftRecord }[]>`
      select record from draft_records
      where status = 'scheduled' and approved_by is not null and scheduled_at_ms is not null and scheduled_at_ms <= ${nowMs}`;
    return rows.map((x) => x.record);
  }
}

/**
 * Select the store: DRAFT_STORE = memory (tests) | file (default) | supabase (prod — needs DATABASE_URL).
 * File path via DRAFT_STORE_PATH (default .data/drafts.json).
 */
export function createDraftStore(): DraftStore {
  const kind = process.env.DRAFT_STORE ?? 'file';
  if (kind === 'memory') return new MemoryDraftStore();
  if (kind === 'supabase') return new SupabaseDraftStore();
  return new FileDraftStore(process.env.DRAFT_STORE_PATH ?? '.data/drafts.json');
}
