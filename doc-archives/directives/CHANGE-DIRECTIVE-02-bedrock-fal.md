# CHANGE DIRECTIVE 02 — Model providers: Bedrock (captions) + fal (images)

**Read and apply before running the gates. Supersedes the Vercel AI Gateway choice for models.**
**Received 2026-05-25.**

We are dropping the Vercel AI Gateway entirely and splitting the two model jobs across the providers the
team actually has, chosen to protect image quality:

- **Captions / agent reasoning (text → Claude) → Amazon Bedrock.** AWS-native, fits the deployment target.
- **Images (hero / statement / carousel) → fal.ai.** fal hosts **Recraft** (carousel consistency) and
  **Ideogram** (in-image text) — the two models the routing table depends on. Bedrock does not host
  Recraft/Ideogram; losing them would reopen the carousel-consistency gate (the hardest, highest-priority bar).

The two jobs are independent and already separated in the code (Hermes provider for text; the
`ImageModelAdapter` seam for images) — two contained changes, not a rewrite.

## 1. Images → fal.ai
- Write a **fal adapter** implementing the existing `ImageModelAdapter` interface (alongside gateway/stub). `IMAGE_ADAPTER=fal`.
- Credential: `FAL_API_KEY` in `.env` (local) / Secrets Manager (prod).
- **Verify against fal's live docs (do not assume):** exact fal model ids for Recraft v4, Ideogram v3, and the hero model → update `config/image_routing.json` to fal's id format (differs from the gateway's; confirm each resolves). Request/response shape: prompt, aspect_ratio/image size, and **seed** (load-bearing for carousel consistency — confirm fal honors a fixed seed; map it correctly). Async: fal often uses queue/submit→poll for some endpoints — handle it in the adapter, interface unchanged.
- Router, prompt assembly, overlay-text cleaning, and `engine.ts` consistency control (one style spec + one seed + uniform aspect ratio) are unchanged — only the adapter changes.

## 2. Captions / agent → Amazon Bedrock (Claude)
- Point Hermes' provider and the caption-eval at Bedrock (not the gateway, not the direct Anthropic API).
- **Inference profiles, not bare model IDs.** Bedrock requires an inference profile for on-demand Claude; a bare `anthropic.claude-...-v1:0` throws "on-demand throughput isn't supported." Use the region-prefixed inference-profile id (e.g. `us.anthropic.claude-...`) or an application inference profile ARN. Verify the current Claude model + profile id for the region — do not hardcode from memory.
- **Auth is AWS IAM, not an API key:** AWS credentials (IAM role in prod; profile/keys locally) with `bedrock:InvokeModel` (+ `...WithResponseStream` if streaming) on the model/profile ARN. No `ANTHROPIC_API_KEY`.
- **Model access must be enabled** in the Bedrock console for the region (one-time "request model access"; a 403 naming the model = not granted). Team/account action — setup prerequisite.
- **Verify Hermes supports a Bedrock provider** for its loop; confirm via its docs. Fallback if limited: a direct Anthropic key for Hermes' text while keeping Bedrock for the standalone caption-eval — but try Bedrock first.

## 3. Env / config changes
- Add: `FAL_API_KEY`; AWS creds/region (`AWS_REGION`, role or profile); the Bedrock inference-profile id in config.
- Remove/retire: `AI_GATEWAY_API_KEY`. Treat the old gateway key AND the Slack token as compromised (plaintext in `node_modules`) — rotate/retire.
- `IMAGE_ADAPTER=fal`. Drop gateway-specific provider strings from image routing.

## 4. Security cleanup (do now — was pending)
- Delete `node_modules/credentials.txt` and `node_modules/.env`. (Proceed — secrets never live in `node_modules`.)
- Confirm `.env` gitignored (it is); no secret committed in history.
- Rotate the exposed gateway key (retired anyway) and the Slack bot token before go-live.

## 5. What this unblocks, and run order
1. **Carousel-consistency gate (fal, runnable first):** flip image adapter to fal, generate ~15 real carousels against the brand reference images, run the checklist (≥ ~70%). Needs only the fal key + reference images — runnable immediately, independent of captions.
2. **Caption gate (Bedrock):** once Bedrock model access is granted + CTA/hashtags are in `config/locked-config.json`, run the ~15-caption eval into `./caption-gate/`.
Report both as **gates-run with results**, not just "code updated."

## 6. Still needed from the team (post-change)
- fal: `FAL_API_KEY` (have it).
- Bedrock: AWS account with Claude model access enabled in region + IAM `bedrock:InvokeModel` on the inference profile. (Name who grants this — new caption-side prereq, replacing the Anthropic key.)
- CTA + hashtags → `config/locked-config.json`.
- Slack bot token (`xoxb-…`).
- `DATABASE_URL`.

## Rationale
Captions are model-identical wherever Claude runs → Bedrock costs nothing in quality, gains AWS alignment. Images are NOT interchangeable — Recraft/Ideogram are on fal, not Bedrock, and carry the two hardest image jobs. The split protects carousel consistency (the real quality risk) while honoring AWS preference where it's free. Do NOT later move images to Bedrock without re-running the consistency gate on whatever would replace Recraft — that would silently regress the highest-priority bar.
