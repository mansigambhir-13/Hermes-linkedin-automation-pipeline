import { z } from 'zod';

/**
 * Domain enums + contract schemas — the single source of truth for shapes used across phases.
 * Mirrors 06-system-design §B1 (enums), §B2 (API), §B3 (agent tool I/O).
 */

// ── B1 enums ──
export const postStatusSchema = z.enum([
  'drafting',
  'generating',
  'in_review',
  'scheduled',
  'publishing',
  'published',
  'failed',
]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const platformSchema = z.enum(['linkedin', 'instagram', 'x', 'both']);
export type Platform = z.infer<typeof platformSchema>;

/** Platforms a post can actually be published to (no 'both'). */
export const publishPlatformSchema = z.enum(['linkedin', 'instagram', 'x']);
export type PublishPlatform = z.infer<typeof publishPlatformSchema>;

export const postFormatSchema = z.enum(['single_image', 'carousel']);
export type PostFormat = z.infer<typeof postFormatSchema>;

export const imageStatusSchema = z.enum(['queued', 'rendering', 'rendered', 'failed']);
export type ImageStatus = z.infer<typeof imageStatusSchema>;

export const imageJobTypeSchema = z.enum(['hero', 'statement', 'carousel_slide']);
export type ImageJobType = z.infer<typeof imageJobTypeSchema>;

export const ideaStatusSchema = z.enum(['proposed', 'drafted', 'dismissed']);
export type IdeaStatus = z.infer<typeof ideaStatusSchema>;

export const jobTypeSchema = z.enum(['generate', 'render', 'revise', 'publish', 'auto_ideas']);
export type JobType = z.infer<typeof jobTypeSchema>;

export const publishStatusSchema = z.enum(['pending', 'success', 'failed']);
export type PublishStatus = z.infer<typeof publishStatusSchema>;

export const aspectRatioSchema = z.enum(['1:1', '4:5', '9:16', '1.91:1']);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

// ── B3 agent tool I/O ──
/**
 * `draft_caption` output. NOTE: there are deliberately NO cta/hashtags fields — locked
 * config is appended deterministically by code, never produced by the model (03 §5.3, 06 §B3).
 */
export const draftCaptionOutputSchema = z.object({
  caption_body_linkedin: z.string().optional(),
  caption_body_instagram: z.string().optional(),
  hook: z.string(),
  rationale: z.string(),
});
export type DraftCaptionOutput = z.infer<typeof draftCaptionOutputSchema>;

export const imagePromptSchema = z.object({
  slide_index: z.number().int().nonnegative(),
  job_type: imageJobTypeSchema,
  prompt: z.string(),
  aspect_ratio: aspectRatioSchema,
});
export type ImagePrompt = z.infer<typeof imagePromptSchema>;

/** Locked style spec for a carousel — identical across every slide (02 §4). */
export const styleSpecSchema = z
  .object({
    palette: z.array(z.string()),
    type_treatment: z.string(),
    layout_grammar: z.string(),
    illustration_style: z.string(),
  })
  .passthrough();
export type StyleSpec = z.infer<typeof styleSpecSchema>;

export const buildImagePromptsOutputSchema = z.object({
  prompts: z.array(imagePromptSchema).min(1),
  style_spec: styleSpecSchema.optional(),
  seed: z.string().optional(),
});
export type BuildImagePromptsOutput = z.infer<typeof buildImagePromptsOutputSchema>;

// ── B2 intake ──
export const intakeRequestSchema = z.object({
  platform: platformSchema,
  format: z.union([postFormatSchema, z.literal('auto')]).optional(),
  idea: z.string().min(1),
  prompt: z.string().optional(),
  created_by: z.string().min(1),
  source: z.enum(['ui', 'slack', 'auto_idea']).default('ui'),
});
export type IntakeRequest = z.infer<typeof intakeRequestSchema>;
