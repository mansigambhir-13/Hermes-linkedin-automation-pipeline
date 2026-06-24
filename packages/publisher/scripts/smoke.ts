/**
 * Phase 5 smoke — proves the publish state machine WITHOUT a DB or platform creds, via dependency
 * injection + the StubPublisher: the approval gate, status transitions, publish_log, and idempotency.
 * Run: pnpm --filter @rss/publisher smoke
 */
import { publishPost, ApprovalRequiredError, StubPublisher } from '../src/index.js';
import type { PublishDeps, ResolvedPost } from '../src/index.js';

function fakeDeps(over: Partial<PublishDeps> = {}): { deps: PublishDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: PublishDeps = {
    async resolvePost(): Promise<ResolvedPost> {
      return { caption: 'body\n\nCTA\n\n#a #b', mediaKeys: ['posts/p/0.png'], aspectRatios: ['1:1'] };
    },
    async mintUrl(k) {
      return `https://example.com/${k}`;
    },
    async findSuccessfulPublish() {
      return null;
    },
    async recordPublish(e) {
      calls.push(`log:${e.status}:${e.externalId ?? 'none'}`);
    },
    async setStatus(_id, s) {
      calls.push(`status:${s}`);
    },
    adapter: new StubPublisher(),
    ...over,
  };
  return { deps, calls };
}

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean): void => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
};

// 1) Approval gate — refuses before any side effect.
{
  const { deps, calls } = fakeDeps();
  let threw = false;
  try {
    await publishPost({ postId: 'p', platform: 'linkedin', format: 'single' }, deps);
  } catch (e) {
    threw = e instanceof ApprovalRequiredError;
  }
  check('approval gate refuses without approved_by (no side effects)', threw && calls.length === 0);
}

// 2) Success path — external_id returned, status publishing→published, publish_log success.
{
  const { deps, calls } = fakeDeps();
  const out = await publishPost({ postId: 'p', platform: 'linkedin', format: 'single', approvedBy: 'U123' }, deps);
  check('success returns external_id (not skipped)', !out.skipped && out.externalId.startsWith('stub-linkedin'));
  check('success records publishing→published', calls.includes('status:publishing') && calls.includes('status:published'));
  check('success records publish_log success', calls.some((c) => c.startsWith('log:success')));
}

// 3) Idempotency — prior success short-circuits; adapter NOT called.
{
  let adapterCalled = false;
  const { deps } = fakeDeps({
    findSuccessfulPublish: async () => 'existing-123',
    adapter: {
      publish: async () => {
        adapterCalled = true;
        return { externalId: 'should-not-happen' };
      },
    },
  });
  const out = await publishPost({ postId: 'p', platform: 'instagram', format: 'carousel', approvedBy: 'U123' }, deps);
  check('idempotency: returns existing id, skipped, adapter NOT called', out.skipped && out.externalId === 'existing-123' && !adapterCalled);
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} ok, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
