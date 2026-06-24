# Visual Engine — five modes (AI + deterministic)

Hermes produces post visuals through **two complementary engines**, exposed as MCP tools on the tool-server.
Reasoning stays in Hermes; the tools render/store only and **never publish**.

- **`@rss/image`** — AI generation (fal/gateway). Good at conceptual/editorial imagery; *cannot* reliably typeset text.
- **`@rss/render`** — deterministic HTML→headless-Chromium screenshots. Pixel-exact brand frame, real-font text, guaranteed consistency. Fonts are bundled (no network at render).

Why both: the brand needs *both* conceptual imagery and exact typographic cards. AI does the former; deterministic HTML does the latter. The hybrid mode composites them.

## The five visual modes

| # | Mode | Tool(s) | Engine | Use when |
|---|------|---------|--------|----------|
| 1 | Flat typeset card | `render_card` (`statement` / `glossary`) | render | the words are the point: hook/data/quote slide, definition card |
| 2 | Wordless AI concept | `generate_image` | AI | a metaphorical image with **no** critical text |
| 3 | Hybrid composite | `render_hybrid_card` / `render_hybrid_carousel` | AI + render | you want conceptual imagery **and** perfect headline text |
| 4 | Consistent typeset carousel | `render_carousel` | render | a multi-slide set that's mostly text |
| 5 | Framework diagram card | `render_jargon_card` | render | teach a named framework (4 Ps, STP, AIDA…) as a diagram |

(The AI carousel `assemble_carousel` still exists for wordless conceptual sets.)

### Selection rule (also in the `rehearsal-content` skill)
Words must be legible on a flat brand field → `render_card`. Wordless concept → `generate_image`.
Conceptual imagery **and** perfect text → `render_hybrid_*`. Named framework → `render_jargon_card`.

## Templates (`@rss/render/src/templates.ts`)

- **`statement`** — hook / data / quote on the brand field. Rainbow-gradient headline, optional eyebrow + sub.
- **`glossary`** — the "green knowledge card": masthead → optional banner → rainbow headline → body paragraphs (names can be `<b>`-bolded) → wordmark + CTA.
- **`hybrid`** — full-bleed AI background + a tunable dark **scrim** (0–1, default 0.62) + the exact typeset frame on top.
- **`jargon`** — MBA-framework card: masthead → subject chip → accent headline → one-line definition → a **diagram** → origin note.

### Diagram renderers (`@rss/render/src/diagrams.ts`)
`grid` · `steps` · `funnel` · `pyramid` · `curve` (gradient S-curve SVG) · `versus` · `focus`. Colored from the brand palette.

## How hybrid works (`apps/tool-server/src/hybrid.ts`)
Per slide: (1) `ImageEngine` renders a **wordless editorial background** (editorial mode = no headline) at a private `posts/<id>/_bg/<i>.png` key — with a suitability hint (dark, low-clutter, central negative space); (2) its URL is minted; (3) `RenderEngine` composites the exact brand frame + typeset headline and stores the **final** slide at `posts/<id>/<i>.png`. The AI never typesets text.

## Brand tokens (`@rss/render/src/tokens.ts`)
Exact hex + the rainbow gradient + canvas sizes per aspect ratio. This is the **CSS-side** source of truth, mirroring the **prose** brand block in `@rss/image` `brand.ts` (the AI prompts only ever see prose; the renderer only ever sees hex/fonts). Keep them in sync when the brand changes.

Canvas sizes: `4:5` 1080×1350 · `1:1` 1080×1080 · `9:16` 1080×1920 · `1.91:1` 1200×628.

## Production hardening
**Render path:** Raleway bundled as base64 `@font-face` (no network); browser crash-relaunch; per-render timeout; concurrency semaphore; `file://` images inlined as data URIs (Chromium blocks `file://` subresources on a `setContent` page — prod `https` URLs pass through). Dockerfile installs Chromium + system libs to a pinned `PLAYWRIGHT_BROWSERS_PATH`.

**AI path:** `HardenedAdapter` wraps the chosen adapter with a per-generate timeout + output validation (non-empty bytes, `image/*`); opt-in fallback adapter; fal has a per-attempt timeout inside its retry loop.

### Env knobs (all optional; see `.env.example`)
`RENDER_CONCURRENCY` (4) · `RENDER_TIMEOUT_MS` (30000) · `IMAGE_TIMEOUT_MS` (90000) · `IMAGE_FALLBACK_ADAPTER` (none) · `FAL_ATTEMPT_TIMEOUT_MS` (60000).

## Testing
- `pnpm test` — CI-safe unit tests (no Chromium): `test/render.test.ts` (templates, diagrams, fonts, `toEmbeddable`, canvas) + `test/tool-server.test.ts` (tool registration). Run from repo root.
- Chromium smokes (visual, need the browser):
  - `node --import tsx packages/render/scripts/smoke.ts` — statement + glossary + carousel
  - `node --import tsx packages/render/scripts/jargon-smoke.ts` — one card per diagram type
  - `IMAGE_ADAPTER=stub node --import tsx apps/tool-server/scripts/hybrid-smoke.ts` — hybrid render + orchestrator wiring
  - Outputs land in `.artifacts/posts/`.

## Known limitations
- **Hybrid legibility** over a busy AI background: mitigated by the scrim + the dark-background prompt hint, not eliminated. Raise `scrim` for busy cases.
- **Hybrid `_bg/` intermediates** are stored permanently (cheap, useful for debugging). Use an S3/Supabase lifecycle rule to expire `posts/*/_bg/*` if desired.
- **Grid diagram** is designed for ~4 cells (2×2); 2–3 items render acceptably, >4 degrade.

## Pipeline integration (end-to-end — this is wired, not just tool-level)

`composeDraft` (`@rss/agent/pipeline.ts`) is the unit every surface drives (the Slack bot today). It now runs visuals through `VisualMode`, **defaulting to `render`** — so `/draft` produces deterministic, on-brand typeset cards with **no fal key**. This is what gives **production** real images (legacy AI `/draft` generation is disabled in prod). `ai`/`hybrid` are opt-in via `ComposeInput.visualMode` or the `VISUAL_MODE` env.

- Carousel + `render` → `render_carousel` (statement template, `i / n` eyebrow, footer on the last slide).
- Single + `render` → a statement card from the hook.
- `hybrid` → the AI-background + typeset composite; `ai` → the legacy wordless fal path.

The hybrid orchestrator lives in `@rss/agent/hybrid.ts` (composes `@rss/image` + `@rss/render`), shared by the pipeline and the MCP tools.

**Store-agnostic media.** Images store via `createObjectStore()` (local in dev; Supabase/S3 in prod → public `https` URLs). The Slack upload reads the local file when present, else fetches bytes from the store URL (`imageBytes()` in `apps/slack-bot/src/app.ts`), so previews work in every store mode. The worker/publisher already use `storageKey` → store URL.

**Verified end-to-end (render mode, no fal):** idea → Anthropic caption + slide headlines → `html-chromium` typeset cards → uploaded to Supabase → publicly fetchable `https` PNG (HTTP 200, `image/png`). That is the exact media path the publisher consumes.

## Go-live checklist
1. **Merge `Social-Media-Automation-v2` → the deployed repo** (`main`). All work here is isolated; the original is untouched.
2. **Build the image** — Docker isn't available in this workspace, but the two failure-prone steps were validated locally: `pnpm install --frozen-lockfile` (lockfile up to date) and `pnpm --filter @rss/render exec playwright install --with-deps chromium` (CLI resolves; Chromium installed). Confirm a render smoke passes in-container.
3. **Object storage** — `OBJECT_STORE=supabase` (+ `SUPABASE_SERVICE_ROLE_KEY`) so renders/backgrounds get `https` URLs (already configured in `.env`; verified working).
4. **(Optional) Register the tool-server with Hermes** — MCP client wiring ("Phase H" in `apps/tool-server/src/index.ts`). The pipeline path works without this; the MCP tools are for the conversational Hermes surface.
5. **Publishing gates unchanged** — OAuth/Meta app review still gate actual publishing; render/AI/hybrid all remain generate-and-store-only.
