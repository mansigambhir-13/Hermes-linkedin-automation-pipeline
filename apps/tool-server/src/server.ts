import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  loadLockedConfig,
  composeCaption,
  insertDraft,
  insertIdea,
  getPost,
  updatePostStatus,
  publishPlatformSchema,
  platformSchema,
  postFormatSchema,
  postStatusSchema,
  aspectRatioSchema,
  imageJobTypeSchema,
  styleSpecSchema,
  createObjectStore,
} from '@rss/core';
import { ImageEngine } from '@rss/image';
import { RenderEngine } from '@rss/render';
import { renderHybridCard, renderHybridCarousel, type HybridDeps } from '@rss/agent';
import { publishPost, makePublishDeps } from '@rss/publisher';

/**
 * RSS Tool Server (Phase T) — the MCP seam Hermes calls for side-effecting operations.
 * Reasoning stays in Hermes; these tools render/persist/compose only. Image + publish tools
 * (Phase 2 / Phase 5) register here too as they're built.
 *
 * Non-negotiables enforced here, not just in prose:
 *  - compose_caption appends the locked CTA/hashtags — the model never writes them.
 *  - Supabase is the system of record — save_draft/get_post/update_post_status are the only writers/readers.
 */
/** Guards against re-registering process signal handlers when buildServer is called more than once (tests). */
let shutdownWired = false;

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'rss-tool-server', version: '0.1.0' });

  server.registerTool(
    'compose_caption',
    {
      title: 'Compose caption',
      description:
        'Append the locked CTA + hashtags (team config) to a caption BODY for the given platform. ' +
        'The model must NEVER write the CTA/hashtags itself — always call this. Returns the final caption.',
      inputSchema: { platform: publishPlatformSchema, body: z.string().min(1) },
    },
    async ({ platform, body }) => {
      const cfg = loadLockedConfig();
      return { content: [{ type: 'text', text: composeCaption(platform, body, cfg) }] };
    },
  );

  server.registerTool(
    'save_draft',
    {
      title: 'Save draft',
      description: 'Persist a new post draft to the database (status=drafting). Returns { post_id }.',
      inputSchema: {
        source: z.enum(['ui', 'slack', 'auto_idea']),
        created_by: z.string().min(1),
        platform: platformSchema,
        format: postFormatSchema,
        caption_body_linkedin: z.string().optional(),
        caption_body_instagram: z.string().optional(),
        visual_concept: z.string().optional(),
        rationale: z.string().optional(),
        aspect_ratio: z.string().optional(),
      },
    },
    async (args) => {
      const result = await insertDraft(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_post',
    {
      title: 'Get post',
      description: 'Fetch a post + its images from the database (the system of record). Returns JSON.',
      inputSchema: { post_id: z.string().uuid() },
    },
    async ({ post_id }) => {
      const result = await getPost(post_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(result ?? { error: 'not_found', post_id }) }],
        isError: result === null,
      };
    },
  );

  server.registerTool(
    'update_post_status',
    {
      title: 'Update post status',
      description: 'Transition a post status (e.g. drafting → in_review). Returns { updated }.',
      inputSchema: { post_id: z.string().uuid(), status: postStatusSchema },
    },
    async ({ post_id, status }) => {
      const result = await updatePostStatus(post_id, status);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !result.updated };
    },
  );

  // ── Phase 6: idea inbox (auto-ideas propose only; a human selects before drafting) ──
  server.registerTool(
    'save_idea',
    {
      title: 'Save idea',
      description:
        'Persist a proposed post idea to the idea inbox (status=proposed). For auto-ideas (Hermes cron) and human-saved ideas. Propose only — never drafts or publishes.',
      inputSchema: { idea: z.string().min(1), angle: z.string().optional(), source: z.enum(['auto', 'human']) },
    },
    async ({ idea, angle, source }) => {
      const result = await insertIdea({ idea, angle, source });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  // ── Phase 2: image tools (generate + store only; never publish) ──
  const engine = new ImageEngine();

  server.registerTool(
    'generate_image',
    {
      title: 'Generate image',
      description:
        'Render a single brand-aware image for a post (hero/statement) and store it. Generate + store only — never publishes. Returns { storage_key, model_used }.',
      inputSchema: {
        post_id: z.string().uuid(),
        job_type: imageJobTypeSchema,
        concept: z.string().min(1),
        aspect_ratio: aspectRatioSchema,
        headline_text: z.string().optional(),
        sub_text: z.string().optional(),
        seed: z.number().int().optional(),
      },
    },
    async (a) => {
      const ref = await engine.generateSingle({
        postId: a.post_id,
        jobType: a.job_type,
        concept: a.concept,
        aspectRatio: a.aspect_ratio,
        headlineText: a.headline_text,
        subText: a.sub_text,
        seed: a.seed,
      });
      return { content: [{ type: 'text', text: JSON.stringify({ storage_key: ref.storageKey, model_used: ref.modelUsed }) }] };
    },
  );

  server.registerTool(
    'assemble_carousel',
    {
      title: 'Assemble carousel',
      description:
        'Render an ordered, consistent carousel: ONE locked style spec + ONE seed + uniform aspect ratio across all slides. Generate + store only. Returns { images: [{slide_index, storage_key, model_used}] }.',
      inputSchema: {
        post_id: z.string().uuid(),
        aspect_ratio: aspectRatioSchema,
        style_spec: styleSpecSchema,
        seed: z.number().int(),
        slides: z.array(z.object({ concept: z.string().min(1), headline_text: z.string().optional() })).min(2),
      },
    },
    async (a) => {
      const refs = await engine.assembleCarousel({
        postId: a.post_id,
        aspectRatio: a.aspect_ratio,
        styleSpec: a.style_spec,
        seed: a.seed,
        slides: a.slides.map((s) => ({ concept: s.concept, headlineText: s.headline_text })),
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              images: refs.map((r) => ({ slide_index: r.slideIndex, storage_key: r.storageKey, model_used: r.modelUsed })),
            }),
          },
        ],
      };
    },
  );

  // ── Deterministic render tools (HTML→Chromium; pixel-exact typeset cards; generate + store only) ──
  // Use these (NOT generate_image) whenever the headline/data/quote text must be perfectly legible and the
  // brand frame exact — carousel covers, data points, quote slides, glossary cards. The AI tools above are
  // for editorial/conceptual imagery where typeset text would be hallucinated.
  const render = new RenderEngine();

  const statementDataSchema = z.object({
    headline: z.string().min(1),
    sub: z.string().optional(),
    eyebrow: z.string().optional(),
    footer: z.boolean().optional(),
  });
  const glossaryDataSchema = z.object({
    headline: z.string().min(1),
    paragraphs: z.array(z.string().min(1)).min(1).max(3),
    eyebrow: z.string().optional(),
    banner_url: z.string().url().optional(),
    cta_label: z.string().optional(),
  });
  // Normalize the snake_case tool field to the camelCase the template expects.
  const toGlossary = (d: z.infer<typeof glossaryDataSchema>) => ({
    headline: d.headline,
    paragraphs: d.paragraphs,
    eyebrow: d.eyebrow,
    bannerUrl: d.banner_url,
    ctaLabel: d.cta_label,
  });

  server.registerTool(
    'render_card',
    {
      title: 'Render card (deterministic)',
      description:
        'Render ONE pixel-exact, on-brand typeset card via headless Chromium (no AI) and store it. Text is rendered by a real font engine — never hallucinated. Templates: "statement" (hook/data/quote slide) or "glossary" (the green knowledge card). Generate + store only — never publishes. Returns { storage_key, model_used }.',
      inputSchema: {
        post_id: z.string().uuid(),
        template: z.enum(['statement', 'glossary']),
        aspect_ratio: aspectRatioSchema,
        slide_index: z.number().int().min(0).optional(),
        // Open object — the AUTHORITATIVE per-template parse happens in the handler. (A z.union would match
        // the looser 'statement' schema first and silently strip glossary's 'paragraphs'.)
        data: z.record(z.string(), z.unknown()),
      },
    },
    async (a) => {
      const data =
        a.template === 'glossary'
          ? toGlossary(glossaryDataSchema.parse(a.data))
          : statementDataSchema.parse(a.data);
      const ref = await render.renderCard({
        postId: a.post_id,
        slideIndex: a.slide_index,
        template: a.template,
        aspectRatio: a.aspect_ratio,
        data,
      });
      return { content: [{ type: 'text', text: JSON.stringify({ storage_key: ref.storageKey, model_used: ref.modelUsed }) }] };
    },
  );

  server.registerTool(
    'render_carousel',
    {
      title: 'Render carousel (deterministic)',
      description:
        'Render an ordered, brand-consistent typeset carousel via headless Chromium — same template + uniform aspect ratio across every slide (consistency is GUARANTEED, not seed-dependent). Generate + store only. Returns { images: [{slide_index, storage_key, model_used}] }.',
      inputSchema: {
        post_id: z.string().uuid(),
        template: z.enum(['statement', 'glossary']),
        aspect_ratio: aspectRatioSchema,
        // Open objects — authoritative per-template parse happens in the handler (see render_card note).
        slides: z.array(z.record(z.string(), z.unknown())).min(2),
      },
    },
    async (a) => {
      const slides = a.slides.map((s) =>
        a.template === 'glossary' ? toGlossary(glossaryDataSchema.parse(s)) : statementDataSchema.parse(s),
      );
      const refs = await render.renderCarousel({
        postId: a.post_id,
        template: a.template,
        aspectRatio: a.aspect_ratio,
        slides,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              images: refs.map((r) => ({ slide_index: r.slideIndex, storage_key: r.storageKey, model_used: r.modelUsed })),
            }),
          },
        ],
      };
    },
  );

  // ── Phase 4: MBA-framework "jargon" card (deterministic; a named framework as a clean diagram) ──
  const labeledItem = z.object({ label: z.string().min(1), sub: z.string() });
  const versusSide = z.object({ title: z.string().min(1), line: z.string().min(1), color: z.string().optional() });
  const diagramSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('grid'), items: z.array(labeledItem).min(1).max(4) }),
    z.object({ type: z.literal('steps'), items: z.array(labeledItem).min(2).max(4) }),
    z.object({ type: z.literal('funnel'), items: z.array(labeledItem).min(2).max(5) }),
    z.object({ type: z.literal('pyramid'), items: z.array(labeledItem).min(2).max(5) }),
    z.object({ type: z.literal('curve'), phases: z.array(z.string().min(1)).min(2).max(5) }),
    z.object({ type: z.literal('versus'), a: versusSide, b: versusSide }),
    z.object({
      type: z.literal('focus'),
      items: z.array(z.object({ label: z.string().min(1), highlight: z.boolean().optional() })).min(2).max(5),
    }),
  ]);

  server.registerTool(
    'render_jargon_card',
    {
      title: 'Render MBA-framework card (deterministic)',
      description:
        'Render a pixel-exact "MBA Jargon" framework card via Chromium: masthead → subject chip → accent headline → one-line definition → a framework DIAGRAM (grid | steps | funnel | pyramid | curve | versus | focus) → origin note (names can be <b>bolded</b>). For teaching a named framework (4 Ps, STP, AIDA, Brand Equity…). Generate + store only — never publishes. Returns { storage_key, model_used }.',
      inputSchema: {
        post_id: z.string().uuid(),
        slide_index: z.number().int().min(0).optional(),
        aspect_ratio: aspectRatioSchema.optional(),
        headline: z.string().min(1),
        definition: z.string().min(1),
        diagram: diagramSchema,
        note: z.string().min(1),
        subject: z.string().optional(),
        accent: z.string().optional(),
        banner_url: z.string().url().optional(),
      },
    },
    async (a) => {
      const ref = await render.renderCard({
        postId: a.post_id,
        slideIndex: a.slide_index,
        template: 'jargon',
        aspectRatio: a.aspect_ratio ?? '4:5',
        data: {
          headline: a.headline,
          definition: a.definition,
          diagram: a.diagram,
          note: a.note,
          subject: a.subject,
          accent: a.accent,
          bannerUrl: a.banner_url,
        },
      });
      return { content: [{ type: 'text', text: JSON.stringify({ storage_key: ref.storageKey, model_used: ref.modelUsed }) }] };
    },
  );

  // ── Phase 3: hybrid composition (AI editorial background + deterministic typeset overlay) ──
  // Use this when you want BOTH conceptual AI imagery AND perfectly legible, pixel-exact brand text — the
  // best tier for hero slides and carousel covers. The AI renders only the wordless background; the headline,
  // wordmark and stripe are typeset by Chromium, never hallucinated. Generate + store only — never publishes.
  const hybridDeps: HybridDeps = { image: engine, render, store: createObjectStore() };
  const hybridSlideSchema = z.object({
    concept: z.string().min(1), // the wordless editorial scene for the AI background
    headline: z.string().min(1), // typeset deterministically on top
    sub: z.string().optional(),
    eyebrow: z.string().optional(),
    footer: z.boolean().optional(),
    scrim: z.number().min(0).max(1).optional(),
  });

  server.registerTool(
    'render_hybrid_card',
    {
      title: 'Render hybrid card (AI background + typeset overlay)',
      description:
        'Compose ONE slide: an AI-generated wordless editorial background with the EXACT brand frame + headline typeset over it via Chromium. Best tier for a hero/cover that needs both conceptual imagery and perfectly legible on-brand text. Generate + store only — never publishes. Returns { storage_key, model_used }.',
      inputSchema: {
        post_id: z.string().uuid(),
        aspect_ratio: aspectRatioSchema,
        slide: hybridSlideSchema,
        style_spec: styleSpecSchema.optional(),
        seed: z.number().int().optional(),
      },
    },
    async (a) => {
      const ref = await renderHybridCard(hybridDeps, {
        postId: a.post_id,
        aspectRatio: a.aspect_ratio,
        slides: [a.slide],
        styleSpec: a.style_spec,
        seed: a.seed,
      });
      return { content: [{ type: 'text', text: JSON.stringify({ storage_key: ref.storageKey, model_used: ref.modelUsed }) }] };
    },
  );

  server.registerTool(
    'render_hybrid_carousel',
    {
      title: 'Render hybrid carousel (AI backgrounds + typeset overlay)',
      description:
        'Compose an ordered carousel of hybrid slides: each is an AI editorial background under the exact deterministic brand frame + typeset headline. Uniform aspect ratio (and one locked style spec/seed) across the set for consistency. Generate + store only. Returns { images: [{slide_index, storage_key, model_used}] }.',
      inputSchema: {
        post_id: z.string().uuid(),
        aspect_ratio: aspectRatioSchema,
        slides: z.array(hybridSlideSchema).min(2),
        style_spec: styleSpecSchema.optional(),
        seed: z.number().int().optional(),
      },
    },
    async (a) => {
      const refs = await renderHybridCarousel(hybridDeps, {
        postId: a.post_id,
        aspectRatio: a.aspect_ratio,
        slides: a.slides,
        styleSpec: a.style_spec,
        seed: a.seed,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              images: refs.map((r) => ({ slide_index: r.slideIndex, storage_key: r.storageKey, model_used: r.modelUsed })),
            }),
          },
        ],
      };
    },
  );

  // ── Phase 5: publishers (approval-gated + idempotent; go-live needs OAuth/Meta) ──
  server.registerTool(
    'publish_linkedin_single',
    {
      title: 'Publish to LinkedIn (single image)',
      description:
        'Publish an APPROVED post to LinkedIn as a single-image post. Requires a human approval signal (approved_by) + post_id; refuses otherwise. Idempotent via publish_log.',
      inputSchema: { post_id: z.string().uuid(), approved_by: z.string().min(1) },
    },
    async ({ post_id, approved_by }) => {
      const out = await publishPost(
        { postId: post_id, platform: 'linkedin', format: 'single', approvedBy: approved_by },
        makePublishDeps('linkedin'),
      );
      return { content: [{ type: 'text', text: JSON.stringify({ external_id: out.externalId, skipped: out.skipped }) }] };
    },
  );

  server.registerTool(
    'publish_linkedin_document',
    {
      title: 'Publish to LinkedIn (document / carousel)',
      description:
        'Publish an APPROVED post to LinkedIn as a document (PDF-style carousel) post. Requires approved_by + post_id. Idempotent.',
      inputSchema: { post_id: z.string().uuid(), approved_by: z.string().min(1) },
    },
    async ({ post_id, approved_by }) => {
      const out = await publishPost(
        { postId: post_id, platform: 'linkedin', format: 'document', approvedBy: approved_by },
        makePublishDeps('linkedin'),
      );
      return { content: [{ type: 'text', text: JSON.stringify({ external_id: out.externalId, skipped: out.skipped }) }] };
    },
  );

  server.registerTool(
    'publish_instagram',
    {
      title: 'Publish to Instagram',
      description:
        'Publish an APPROVED post to Instagram (single or carousel, derived from media count) via the 2-step Graph API flow. Requires approved_by + post_id. Idempotent. Gated on Meta app review.',
      inputSchema: { post_id: z.string().uuid(), approved_by: z.string().min(1) },
    },
    async ({ post_id, approved_by }) => {
      const out = await publishPost(
        { postId: post_id, platform: 'instagram', format: 'carousel', approvedBy: approved_by },
        makePublishDeps('instagram'),
      );
      return { content: [{ type: 'text', text: JSON.stringify({ external_id: out.externalId, skipped: out.skipped }) }] };
    },
  );

  // Best-effort: close the shared Chromium on shutdown. The OS reaps it with the stdio process anyway, but
  // closing cleanly avoids an orphaned browser if the server is embedded. Guarded so tests don't stack handlers.
  if (!shutdownWired) {
    shutdownWired = true;
    const cleanup = (): void => void render.close();
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  return server;
}
