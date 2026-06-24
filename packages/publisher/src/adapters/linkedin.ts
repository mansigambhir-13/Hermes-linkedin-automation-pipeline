import type { PublishRequest, PublishResult, PublisherAdapter } from '../types.js';
import { PublishPreconditionError } from '../types.js';

/**
 * LinkedIn publisher — real flow, verified against the LinkedIn Posts + Images API docs (2026-05).
 * GO-LIVE: needs LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN (the org/person posting target) + scopes
 * (w_organization_social / w_member_social). NOT yet tested against a live token — verify on first real post.
 *
 *  - single image:  rest/images initializeUpload -> PUT bytes -> rest/posts content.media (+ altText)
 *  - carousel (>1): upload each slide -> rest/posts content.multiImage.images[] (+ per-image altText)
 *  - document:      rest/documents initializeUpload -> PUT bytes -> rest/posts content.media (explicit PDF-style)
 */
const LI_BASE = 'https://api.linkedin.com/rest';

function liHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': process.env.LINKEDIN_VERSION ?? '202605',
  };
}

interface LiInitResponse {
  value?: { uploadUrl?: string; image?: string; document?: string };
}

export class LinkedInPublisher implements PublisherAdapter {
  async publish(req: PublishRequest): Promise<PublishResult> {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const author = process.env.LINKEDIN_AUTHOR_URN;
    if (!token || !author) {
      throw new PublishPreconditionError(
        'LinkedIn not configured: set LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN (posting target) — doc 05.',
      );
    }
    if (req.mediaUrls.length === 0) throw new PublishPreconditionError('LinkedIn: no media to publish.');
    const alt = (i: number): string | undefined => req.altTexts?.[i];

    // Explicit PDF-style document carousel (uploads the first asset as a document).
    if (req.format === 'document') {
      const documentUrn = await this.uploadAsset('documents', author, token, req.mediaUrls[0]!);
      return { externalId: await this.createPost(author, token, req.caption, { media: { id: documentUrn, title: 'Rehearsal' } }) };
    }

    // Multi-image carousel — upload every slide, then one post referencing all of them (MultiImage API).
    if (req.mediaUrls.length > 1) {
      const images: { id: string; altText?: string }[] = [];
      for (let i = 0; i < req.mediaUrls.length; i++) {
        const id = await this.uploadAsset('images', author, token, req.mediaUrls[i]!);
        const a = alt(i);
        images.push(a ? { id, altText: a } : { id });
      }
      return { externalId: await this.createPost(author, token, req.caption, { multiImage: { images } }) };
    }

    // Single image.
    const imageUrn = await this.uploadAsset('images', author, token, req.mediaUrls[0]!);
    const a = alt(0);
    return { externalId: await this.createPost(author, token, req.caption, { media: a ? { id: imageUrn, altText: a } : { id: imageUrn } }) };
  }

  /** initializeUpload -> fetch our public asset -> PUT bytes to LinkedIn's uploadUrl -> return the asset URN. */
  private async uploadAsset(kind: 'images' | 'documents', owner: string, token: string, sourceUrl: string): Promise<string> {
    const initRes = await fetch(`${LI_BASE}/${kind}?action=initializeUpload`, {
      method: 'POST',
      headers: { ...liHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    });
    if (!initRes.ok) throw new Error(`LinkedIn ${kind} initializeUpload failed (${initRes.status}): ${await initRes.text()}`);
    const init = (await initRes.json()) as LiInitResponse;
    const uploadUrl = init.value?.uploadUrl;
    const urn = init.value?.image ?? init.value?.document;
    if (!uploadUrl || !urn) throw new Error(`LinkedIn ${kind} init: missing uploadUrl/urn`);

    const bytesRes = await fetch(sourceUrl);
    if (!bytesRes.ok) throw new Error(`LinkedIn: failed to fetch media from ${sourceUrl} (${bytesRes.status})`);
    const bytes = new Uint8Array(await bytesRes.arrayBuffer());
    const up = await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: bytes });
    if (!up.ok) throw new Error(`LinkedIn ${kind} upload failed (${up.status})`);
    return urn;
  }

  /** rest/posts — organic post; `content` is { media: {...} } (single/document) or { multiImage: { images } }. Returns the post URN. */
  private async createPost(author: string, token: string, caption: string, content: object): Promise<string> {
    const res = await fetch(`${LI_BASE}/posts`, {
      method: 'POST',
      headers: { ...liHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author,
        commentary: caption,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content,
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn create post failed (${res.status}): ${await res.text()}`);
    const id = res.headers.get('x-restli-id');
    if (!id) throw new Error('LinkedIn: no x-restli-id (post URN) in response');
    return id;
  }
}
