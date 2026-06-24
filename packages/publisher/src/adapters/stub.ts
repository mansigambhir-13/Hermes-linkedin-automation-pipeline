import type { PublishRequest, PublishResult, PublisherAdapter } from '../types.js';

/** Simulates a successful publish — verifies the orchestration without real platform creds. */
export class StubPublisher implements PublisherAdapter {
  async publish(req: PublishRequest): Promise<PublishResult> {
    return { externalId: `stub-${req.platform}-${req.format}-${req.postId.slice(0, 8)}-${Date.now()}` };
  }
}
