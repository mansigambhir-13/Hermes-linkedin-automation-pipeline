# BLOCKERS — team-supplied inputs (build against stubs; never invent)

Tracked so build work proceeds against clearly-marked placeholders. Each notes what it gates.
Update status as items are supplied.

## Right now — the build is waiting on you (priority order)

The document/design work is essentially done (canonical plan, Phase 0, the skill + context file). The next moves are **human** and they gate the next phases — "documented" is not "done":

1. **Name the Meta-review owner and start the submission this week** — weeks of latency that begins only when a human with Business-account admin acts; gates Instagram entirely. *(blocker 1)*
2. **Provider status (Directive 02 — Vercel AI Gateway retired):**
   - (a) **fal ✅** — `FAL_API_KEY` set, render verified. **Directive-04 aligned probe RAN** (`./aligned-posts/`): 3 singles + 1 carousel built from the real caption drafts. Heroes/poster (Imagen4/Ideogram) are on-brand + on-topic; carousel reworked over 2 rounds (fixed hex/font text-leak + photoreal default; rerouted slides recraft→Imagen4 seed-pinned) now reads ~75–85% cohesion — **awaiting your consistency judgment** to confirm ≥70%.
   - (b) **Captions ✅ — switched to OpenAI gpt-oss on Bedrock:** `BEDROCK_MODEL=openai.gpt-oss-20b-1:0` (an OpenAI model hosted on Bedrock — NOT Anthropic, so it **bypasses the use-case form** that blocked Claude). Invoke + the **15-caption gate verified** → `./caption-gate/`. The caption-eval uses generateText + tolerant JSON parse (generateObject's strict mode is flaky on a 20B). To **close** the gate: real CTA/hashtags + your voice judgment. Bump to `openai.gpt-oss-120b-1:0` (also available) if 20B reads rough.
   ✅ Slack done. ✅ Provider code swapped to fal + Bedrock; both verified end-to-end.
3. **Provide the real CTA + per-platform hashtags** — lets the Phase-H caption gate actually close (a stubbed-CTA caption is not a pass). *(blockers 2, 3)*
4. ✅ **Done** — brand assets provided + direction chosen (**match the real brand:** dark + Raleway + signature gradient). doc 01 §6 corrected; concrete style-spec basis authored. *(blocker 4 resolved)*
5. *(cheap, whenever)* **Point a Supabase `DATABASE_URL` at us** so the migration is verified against real Postgres, not just typechecked. *(blocker 10)*

| # | Blocker | Gates | Stub / location | Status |
|---|---|---|---|---|
| 1 | **Meta app-review owner + submission started** | Instagram publishing (Phase 5) — ~2–4 wk lead | `infra/meta-review-tracker.md` | ⛔ name owner + start **today** |
| 2 | **Locked CTA wording** (per platform) | Closing the Phase-1 caption gate | `config/locked-config.example.json` | ⛔ open |
| 3 | **Per-platform hashtag sets** (exact, in order, with counts) | Closing the Phase-1 caption gate | `config/locked-config.example.json` | ⛔ open |
| 4 | **Brand visual assets** + **visual direction** | Phase-2 carousel consistency gate | `brand-assets/` (provided) | ✅ **resolved** — direction = **match the real brand** (dark `#0a0a0a` + Raleway + signature gradient `#9677f8/#4e44fd/#ff4859/#00c483`). doc 01 §6 corrected; style-spec basis in skill `references/brand-visual-identity.md`; assets bundled into the skill. |
| 5 | **LinkedIn posting target** (company page vs personal) + OAuth authorizer | Phase-5 LinkedIn publisher | `config/defaults.json` → `linkedin` | ⛔ open |
| 6 | **Carousel default slide count** (or "always ask") | Agent format defaults (Phase 1/2) | `config/defaults.json` → `carouselSlideCount` | ⛔ open |
| 7 | **Auto-idea cadence** + season-awareness | Phase-6 auto-ideas | `config/defaults.json` → `autoIdeaCadence` | ⛔ open |
| 8 | **Image provider — fal** | Image engine, carousel gate | `config/image_routing.json` (fal ids) | ✅ `FAL_API_KEY` set. **Directive-04 prompt rework done** (structured A/B/D template; editorial vs poster modes; brand colours described in prose not hex so models stop typesetting `#0a0a0a`/font names). **Aligned probe ran** → `./aligned-posts/`. Carousel rerouted **recraft → Imagen4 (seed-pinned)** after recraft invented garbled text + photoreal stock; cohesion now ~75–85%. **Upgrade C DONE (2026-05-26): vision-grounding via fal+Gemini** (`fal-ai/any-llm/vision`, gemini-2.5-pro; `pnpm --filter @rss/image ground` → `config/brand-style.grounding.txt`, auto-injected into every prompt). No `GEMINI_API_KEY` needed — runs on `FAL_API_KEY`. Re-run `ground` if brand assets change. |
| 9 | **Caption provider — gpt-oss on Bedrock** | Caption gate, Hermes text | `.env` AWS_* + `BEDROCK_MODEL` | ✅ captions on **`openai.gpt-oss-20b-1:0`** via Bedrock; **gate ran (15/15 drafts)** in `./caption-gate/`. OpenAI-on-Bedrock → Anthropic use-case-form blocker MOOT. Gate **closes** with CTA/hashtags + human voice judgment (bump to gpt-oss-120b if needed). Rotate retired gateway key + Slack token (were plaintext). |
| 10 | **DB migration applied to a real Postgres** | Treating `db/0001_init.sql` as *verified* (it typechecks but has not run against a live DB) | needs a Supabase `DATABASE_URL` | ⛔ pending |
| 11 | **Slack app dashboard wiring** (Request URLs + scopes + public tunnel) | Live `/draft` in Slack | `infra/slack-setup.md` | 🟡 **Pipeline COMPLETE + verified** (`@rss/slack-bot`): `/draft` → review card → Approve · Edit · Refine · Regenerate · Schedule · Publish→LI/IG. Session-backed publish (no DB), approval-gated + fail-safe. composeDraft verified single **and** carousel; smoke + typecheck pass. Going live is operational only: slash-command + interactivity Request URL → `https://<tunnel>/slack/events`, scopes `commands`/`chat:write`/`files:write`. |

**Hard rule:** code is built against these stubs and unit-tested, but the two quality gates cannot *close* until the real values land — #2/#3 for Phase 1, #4 for Phase 2.
