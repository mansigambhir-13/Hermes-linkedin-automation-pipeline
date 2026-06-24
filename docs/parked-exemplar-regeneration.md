# PARKED — Exemplar-Driven Hermes Regeneration Plan

**Status:** **PARKED** — the owner opted for the simpler "no generation" pipeline (CSV/Excel/DB → Slack review → Postiz) because of quality risk. This document preserves the more ambitious design so it can be picked up later if and only if the simple build is operational *and* the team wants to scale beyond hand-authored content.

**Parked on:** 2026-05-29 · **Last live discussion:** "ultrathink" turn.
**Revisit when:** (a) The Postiz-based pipeline is live and stable, (b) the volume of hand-authored MDs exceeds what humans can sustainably produce, AND (c) the owner explicitly asks to try AI-assisted regeneration. Until all three are true, do not start.

---

## Why this was parked

Owner verbatim: *"I don't want hermes to help me generate posts… quality might get compromised."*

The simple build ships verbatim what humans write. The exemplar-driven build proposed here generates new posts *conditioned on* approved exemplars — which solves voice drift in theory but still introduces generation risk in practice. The owner's call was: prove the simpler distribution pipeline first; only re-open this if scale demands it.

---

## The architecture (three layers)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CORPUS layer  ── read-only reference                     │
│    briefs + posts owner provides as exemplars; the source   │
│    of truth for voice, structure, image style.              │
│    Indexed + embedded for retrieval.                        │
└─────────────────────────────────────────────────────────────┘
                          │  few-shot retrieval
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. HERMES — the agent runtime (Directive-01 architecture)   │
│    - reads brand/brief.md as authoritative rules            │
│    - retrieves K most-similar exemplars from the corpus     │
│    - regenerates a draft (caption via LLM, image via fal,   │
│      BOTH conditioned on the exemplars + brief)             │
│    - learns from approve/reject signals over time           │
│    - cron, persistent memory, MCP tool surface              │
└─────────────────────────────────────────────────────────────┘
                          │  proposed draft
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. OPERATIONAL layer  ── the Slack pipeline (kept as-is)    │
│    review (Approve / Edit / Refine / Schedule / Publish),   │
│    durable store, worker, publisher, S3, etc.               │
└─────────────────────────────────────────────────────────────┘
```

The Slack pipeline doesn't change. Hermes feeds drafts into it; the human gates remain.

## Core mechanism: few-shot retrieval

Generation is **always** conditioned on retrieved exemplars + the brand brief. There is no free-form ideation. Pseudocode:

```
regenerate(seed: { pillar, platform, topic }):
  exemplars = vectorStore.retrieveSimilar(seed, k=5)
  prompt = brandBrief + exemplars + seed
  caption = LLM(prompt)
  imagePrompt = derive(caption.visualConcept, exemplars[*].images)
  image = fal.imageEngine(imagePrompt, groundedAgainst=brandAssets)
  return { caption, image, sourceExemplars: exemplars.ids }
```

The `sourceExemplars` trail is part of the draft so reviewers can see *which* prior approved posts conditioned this one.

---

## Reusable vs. net-new (rough cuts vs. the existing codebase)

**Stays exactly as built (~70% of work survives):**
- Slack review surface + buttons + modals + progress feedback.
- Draft store (file + Supabase) + scheduling worker.
- Publisher (LinkedIn MultiImage + IG + alt-text + token refresh) — IF still using direct platform APIs (with Postiz in the simple build, this layer becomes Postiz instead; same role).
- Web intake form.
- `brand/brief.md` as voice authority.

**Re-activated from dormant code:**
- `@rss/image` (engine, brand grounding, Directive-04 prompts) — drives fal image gen.
- `@rss/agent` (`draftCaption`, `composeDraft`) — retrofitted to use retrieved exemplars as few-shot context (not free-form).
- `apps/tool-server` (MCP) — Hermes consumes these.

**Net-new to build:**
1. **Corpus ingestor** — reads the brief+post corpus, normalizes to a uniform `Post` record (pillar, platform, brief, caption, image refs, fal prompt if retained, accent, date, performance metrics if any).
2. **Retrieval layer** — embeddings + vector store. `retrieveSimilar(seed, k)` returns ranked exemplars.
3. **Few-shot generation** — `regenerate(seed)` per the pseudocode above.
4. **Hermes runtime** — install Hermes (the Python `hermes` CLI + `~/.hermes/`), register MCP tools, install the rehearsal-content skill.
5. **Feedback loop** — Slack Approve/Reject becomes training signal: approved regenerations join the corpus; rejected ones get a reason tag for future avoidance.
6. **(Optional) Skill distillation** — extract recurring patterns from the corpus into `agentskills/` (one skill per pillar: Brief Roulette recipe, Transcript Cuts recipe, etc.).

---

## Phased plan

| Phase | What | Gates |
|---|---|---|
| **P0 Receive** | Inventory the corpus folder. Classify shape (brief+post pairs, image refs, metadata). No code. | Owner provides the corpus. |
| **P1 Normalize** | Define the in-system `Post` record. Write the ingestor. | P0 done. |
| **P2 Retrieval** | Pick embeddings + vector store; index every post; expose `retrieveSimilar`. | P1 done + decisions in §"Open decisions" locked. |
| **P3 Few-shot regen** | The `regenerate(seed)` function. Drop result into existing Slack review card with `sourceExemplars` trail visible. | P2 done. |
| **P4 Hermes** | Install Hermes; register MCP tools (`retrieveSimilar`, `regenerate`, plus existing publish/store tools); install skill. | P3 done + owner explicitly OK's the runtime add. |
| **P5 Learn loop** | Approve/reject → corpus feedback; cadence-driven auto-regenerate (e.g., Monday morning Brief Roulette draft from news feed). | P4 stable for at least 2 weeks. |

---

## Open decisions to lock before P2

1. **Vector store**
   - **Supabase pgvector** — matches existing stack; one DB to manage; native joins with `draft_records`. ✅ Recommended unless volume is huge.
   - Local (LanceDB, FAISS) — lighter but separate from main DB.

2. **Embeddings provider**
   - **Bedrock Titan Text Embeddings** — matches Bedrock-already-in-use stack.
   - **OpenAI on Bedrock** (text-embedding-3-*) — same access path.
   - **fal Gemini embeddings** (`fal-ai/any-llm` family) — matches the fal-only-for-Gemini directive from the previous brand-grounding phase.

3. **Scope of "learn"** (decide *what* level of learning)
   - **Few-shot retrieval only** (cheapest, most reliable) — exemplars in prompt at generation time. ✅ Recommended start.
   - **Skill distillation** — manual + LLM-assisted pattern extraction into `agentskills/`.
   - **Fine-tuning** — train a model on the corpus. Probably overkill; skip unless retrieval-quality is exhausted.

4. **"Regenerate more" trigger** (when does Hermes act on its own?)
   - Human ask in Slack: `/post-like <id>` or `/more <pillar> <topic>`.
   - Cadence (Hermes cron Mondays at 9am: draft this week's Brief Roulette from the latest Finshots).
   - Topic feed (Hermes watches news source X → drafts a candidate Brief Roulette when something hot drops).
   Probably all three eventually; pick first one for P3.

---

## Questions to answer the moment this is un-parked

1. **Corpus pairing** — is each item one combined artifact (brief + post + image together), or separate folders joined by an ID?
2. **Fal prompt retention** — are the exact prompts that produced each image saved alongside? *Big lever* — yes ⇒ programmatic prompt variation; no ⇒ images are black-box reference and we re-derive prompts.
3. **Volume** — 20 examples? 200? Decides whether simple in-memory similarity is fine or pgvector is needed from day one.
4. **Hermes install timing** — early (every phase built *for* Hermes) vs. late (build retrieval + few-shot in existing Slack bot first, wrap in Hermes only after value is proven). The original "ultrathink" recommendation leaned **late**.

---

## Hard rules if this ever ships

- **Every generation cites its exemplars.** The Slack review card must show which K corpus posts conditioned the draft. Reviewers need to be able to spot drift.
- **Brand brief always wins.** If a generation contradicts §3, §4, or §14 of `brand/brief.md`, it's auto-blocked at the review step (not just lint at end).
- **Rejected drafts are not silently discarded.** They get a reason tag and feed the avoidance signal.
- **Image generation stays grounded.** Upgrade-C grounding (vision-described brand assets) is mandatory for every image prompt.
- **Quality gate before scale.** The first 20 regenerations are human-reviewed in detail. Only after a defined approval rate (e.g., ≥70% approved without edit) does cadence-triggered regeneration get turned on.

---

## Why not Hermes-first

The original Directive-01 architecture put Hermes as the production agent loop. The recommendation here (revisit version) is to **build retrieval + few-shot generation as a regular service first**, prove the regeneration quality clears the bar, *then* wrap in Hermes for orchestration/cron/memory. This avoids paying the Hermes-runtime ops cost (Python install, `~/.hermes/`, skill packaging) before the value is demonstrated.

If Hermes is installed first, every layer below must be built "for Hermes," which compounds rework if any layer changes. Late-Hermes is the lower-risk sequence.

---

**End of parked plan.** When (or if) un-parked, start at §"Questions to answer the moment this is un-parked" and work top-down.
