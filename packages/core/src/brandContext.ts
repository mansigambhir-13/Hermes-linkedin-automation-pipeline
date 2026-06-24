import { existsSync, readFileSync } from 'node:fs';

/**
 * Single canonical brand-voice doc — the Rehearsal Social Media Production Brief lives at brand/brief.md.
 * (Previously three files: 01-brand-and-voice-spec / 02-image-generation-method / 03-agent-instructions.
 * Consolidated 2026-05-27 into one authoritative doc; override path via BRAND_BRIEF_PATH.)
 */
const DEFAULT_BRIEF_PATH = 'brand/brief.md';

export interface BrandContext {
  brief: string;
}

export function loadBrandContext(path: string = process.env.BRAND_BRIEF_PATH ?? DEFAULT_BRIEF_PATH): BrandContext {
  if (!existsSync(path)) {
    throw new Error(
      `Brand brief not found: ${path}. Place the Rehearsal Social Production Brief at brand/brief.md (override with BRAND_BRIEF_PATH).`,
    );
  }
  return { brief: readFileSync(path, 'utf8') };
}

/** The block injected into any LLM system prompt that produces brand content. Quoted whole — the brief is authoritative. */
export function assembleBrandContextBlock(ctx: BrandContext): string {
  return ['# BRAND & VOICE — Rehearsal Social Media Production Brief (authoritative; judge every word against this)', '', ctx.brief].join('\n');
}
