import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageJobType } from './schemas.js';

const CONFIG_DIR = process.env.CONFIG_DIR ?? 'config';

const routeSchema = z.object({
  provider: z.string(),
  model: z.string(),
  alternates: z.array(z.string()).default([]),
  note: z.string().optional(),
});
export type ImageRoute = z.infer<typeof routeSchema>;

/** Per-job-type image routing (02 §2/§6). `.passthrough()` tolerates the `_comment` key. */
export const imageRoutingSchema = z
  .object({
    hero: routeSchema,
    statement: routeSchema,
    carousel_slide: routeSchema,
  })
  .passthrough();
export type ImageRouting = z.infer<typeof imageRoutingSchema>;

export function loadImageRouting(): ImageRouting {
  const raw: unknown = JSON.parse(readFileSync(join(CONFIG_DIR, 'image_routing.json'), 'utf8'));
  return imageRoutingSchema.parse(raw);
}

export function routeFor(routing: ImageRouting, jobType: ImageJobType): ImageRoute {
  return routing[jobType];
}

export function loadJsonConfig(file: string): unknown {
  return JSON.parse(readFileSync(join(CONFIG_DIR, file), 'utf8'));
}
