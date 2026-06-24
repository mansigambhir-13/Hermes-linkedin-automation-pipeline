import type { PublishRequest, PublishResult, PublisherAdapter } from '../types.js';
import { PublishPreconditionError } from '../types.js';
import { assertPublicUrls, assertUniformAspectRatio } from '../preconditions.js';

/**
 * Instagram publisher — real 2-step Graph API flow, verified against the content-publishing docs (v25.0).
 * GO-LIVE: needs IG_USER_ID + META_ACCESS_TOKEN, an IG Professional account, and **Meta app review PASSED**.
 * NOT yet tested against a live token — verify on first real post.
 *
 *  - single:   POST /{ig-user}/media {image_url, caption} -> creation_id; poll status; POST /media_publish
 *  - carousel: per slide POST /media {image_url, is_carousel_item} -> child ids;
 *              POST /media {media_type:CAROUSEL, children, caption} -> parent; poll; POST /media_publish
 */
function graphBase(): string {
  return process.env.META_GRAPH_BASE ?? 'https://graph.facebook.com/v25.0';
}

interface GraphResponse {
  id?: string;
  status_code?: string;
  error?: { message?: string };
}

export class InstagramPublisher implements PublisherAdapter {
  async publish(req: PublishRequest): Promise<PublishResult> {
    const igUser = process.env.IG_USER_ID;
    const token = process.env.META_ACCESS_TOKEN;
    if (!igUser || !token) {
      throw new PublishPreconditionError(
        'Instagram not configured: set IG_USER_ID + META_ACCESS_TOKEN, and Meta app review must be PASSED — doc 05.',
      );
    }
    assertPublicUrls(req.mediaUrls);
    const isCarousel = req.mediaUrls.length > 1;
    if (isCarousel) assertUniformAspectRatio(req.aspectRatios);

    let creationId: string;
    if (isCarousel) {
      const children: string[] = [];
      for (const url of req.mediaUrls) {
        children.push(await this.createContainer(igUser, token, { image_url: url, is_carousel_item: 'true' }));
      }
      creationId = await this.createContainer(igUser, token, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: req.caption,
      });
    } else {
      creationId = await this.createContainer(igUser, token, { image_url: req.mediaUrls[0]!, caption: req.caption });
    }

    await this.pollFinished(creationId, token);

    const pubRes = await fetch(`${graphBase()}/${igUser}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    const pub = (await pubRes.json()) as GraphResponse;
    if (!pubRes.ok || !pub.id) throw new Error(`Instagram media_publish failed (${pubRes.status}): ${pub.error?.message ?? JSON.stringify(pub)}`);
    return { externalId: pub.id };
  }

  private async createContainer(igUser: string, token: string, params: Record<string, string>): Promise<string> {
    const res = await fetch(`${graphBase()}/${igUser}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, access_token: token }),
    });
    const data = (await res.json()) as GraphResponse;
    if (!res.ok || !data.id) throw new Error(`Instagram create container failed (${res.status}): ${data.error?.message ?? JSON.stringify(data)}`);
    return data.id;
  }

  /** Poll the container until FINISHED (doc: once/min up to 5 min; we do bounded short polls). */
  private async pollFinished(containerId: string, token: string): Promise<void> {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${graphBase()}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
      const data = (await res.json()) as GraphResponse;
      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        throw new Error(`Instagram container ${containerId} status: ${data.status_code}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error(`Instagram container ${containerId} did not reach FINISHED within the poll window`);
  }
}
