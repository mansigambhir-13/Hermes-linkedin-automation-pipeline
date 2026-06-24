import { loadImageRouting, routeFor } from '@rss/core';
import type { ImageJobType } from '@rss/core';

/** Resolve the gateway model id for a job type from config/image_routing.json (no vendor hardcoded). */
export function modelForJob(jobType: ImageJobType): string {
  return routeFor(loadImageRouting(), jobType).model;
}
