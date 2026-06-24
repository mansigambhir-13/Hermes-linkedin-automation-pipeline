import type { JobType } from './schemas.js';

export interface Job<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  idempotencyKey?: string;
  attempts: number;
}

export type JobHandler = (job: Job) => Promise<void>;

/**
 * Pluggable job queue (06 §B6). Dev impl is in-process; SQS + DLQ lands in Phase 5.
 * The abstraction exists from Phase 0 so the async contract holds throughout.
 */
export interface Queue {
  enqueue(type: JobType, payload: unknown, idempotencyKey?: string): Promise<string>;
  process(handler: JobHandler): void;
}

/** Dev queue: in-process microtask dispatch, idempotency by key. Not durable — fine for dev/tests. */
export class InMemoryQueue implements Queue {
  private handler: JobHandler | null = null;
  private readonly seen = new Set<string>();
  private seq = 0;

  async enqueue(type: JobType, payload: unknown, idempotencyKey?: string): Promise<string> {
    if (idempotencyKey && this.seen.has(idempotencyKey)) return idempotencyKey;
    if (idempotencyKey) this.seen.add(idempotencyKey);

    const job: Job = { id: `job_${++this.seq}`, type, payload, attempts: 0 };
    if (idempotencyKey) job.idempotencyKey = idempotencyKey;

    const handler = this.handler;
    if (handler) queueMicrotask(() => void handler(job));
    return job.id;
  }

  process(handler: JobHandler): void {
    this.handler = handler;
  }
}
