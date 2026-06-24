import { PublishPreconditionError } from './types.js';

/** Instagram carousels must share one aspect ratio across all slides (02 §5, 06 §B5). */
export function assertUniformAspectRatio(ratios: string[]): void {
  const unique = new Set(ratios);
  if (unique.size > 1) {
    throw new PublishPreconditionError(
      `Instagram carousel slides must share one aspect ratio; found: ${[...unique].join(', ')}.`,
    );
  }
}

/** All media must be reachable at a PUBLIC url at publish time (IG requirement, 06 §B5). */
export function assertPublicUrls(urls: string[]): void {
  if (urls.length === 0) throw new PublishPreconditionError('No media to publish.');
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u)) {
      throw new PublishPreconditionError(`Media URL is not publicly reachable (needs http/https): ${u}`);
    }
  }
}
