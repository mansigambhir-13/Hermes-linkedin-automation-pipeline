import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import type { PublishPlatform } from './schemas.js';

/**
 * Locked config = team-supplied CTA + per-platform hashtag sets. It is DATA, appended by code —
 * never produced or altered by the model (03 §5.3, 06 §B3). See config/locked-config.example.json.
 */
export const lockedConfigSchema = z.object({
  cta: z.object({ linkedin: z.string(), instagram: z.string(), x: z.string().optional() }),
  hashtags: z.object({ linkedin: z.array(z.string()), instagram: z.array(z.string()), x: z.array(z.string()).optional() }),
});
export type LockedConfig = z.infer<typeof lockedConfigSchema>;

const PLACEHOLDER = /<<\s*TEAM/i;

export class LockedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockedConfigError';
  }
}

export function loadLockedConfig(
  path: string = process.env.LOCKED_CONFIG_PATH ?? 'config/locked-config.json',
): LockedConfig {
  if (!existsSync(path)) {
    throw new LockedConfigError(
      `BLOCKER: locked config not found at "${path}". Copy config/locked-config.example.json -> config/locked-config.json and fill the team-supplied CTA + hashtag sets. The agent must never invent these (03-agent-instructions §5).`,
    );
  }
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = lockedConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LockedConfigError(`BLOCKER: locked config at "${path}" is malformed: ${parsed.error.message}`);
  }
  assertNoPlaceholders(parsed.data);
  return parsed.data;
}

/** Guards against shipping the example placeholders (the Phase-1 gate can't close until real values land). */
export function assertNoPlaceholders(cfg: LockedConfig): void {
  const blobs = [cfg.cta.linkedin, cfg.cta.instagram, ...cfg.hashtags.linkedin, ...cfg.hashtags.instagram];
  if (blobs.some((s) => PLACEHOLDER.test(s))) {
    throw new LockedConfigError(
      'BLOCKER: locked config still contains <<TEAM ...>> placeholders. The Phase-1 caption gate cannot close until real CTA + hashtag values are supplied.',
    );
  }
}

/**
 * Compose the final caption: editable body + locked CTA + hashtags. The model never produces the
 * locked tail; an edit can only touch `body` (06 §B1/§B2/§B3). Re-run this at render/publish time.
 */
export function composeCaption(platform: PublishPlatform, body: string, cfg: LockedConfig): string {
  // X falls back to the LinkedIn CTA/hashtags until the team supplies X-specific ones.
  const cta = cfg.cta[platform] ?? cfg.cta.linkedin;
  const tags = cfg.hashtags[platform] ?? cfg.hashtags.linkedin;
  return [body.trim(), cta.trim(), tags.join(' ').trim()].filter((p) => p.length > 0).join('\n\n');
}
