# Version 3 plan — Hermes as draft-assist (committed, sequenced after v1 operation)

**Decision (2026-06-03):** we are moving to a more agentic Hermes (v3). This captures *which* Hermes, *with what safeguards*, and *in what sequence* — so the move improves quality instead of eroding it.

> Supersedes the earlier sketch in `docs/parked-exemplar-regeneration.md` (keep that for the architecture diagram; this doc is the authoritative plan + guardrails).

---

## Two things have lived under the name "Hermes" — name them
- **Hermes-as-decision-engine (v1, shipped):** advises platform fit (Re-evaluate), adapts across platforms on demand (Adapt), answers queue/brand questions (Chat). Deterministic plumbing for pick → review → approve → publish → schedule. **Human commands every publish.** This implements the project's standing rule ("no auto-posting").
- **Hermes-as-draft-assist (v3, this plan):** reads the brief + a curated corpus, retrieves K similar exemplars, produces a *structured first draft*, a human sharpens the editorial judgment, then it flows through the **existing** Slack review/approve/publish loop. **Not autonomous origination.**

The path between them is a real build, not a switch.

## The principle that governs v3
**The machine accelerates; the human owns the part that's actually good.** The anchor exemplars (Paytm carousel, Mock-1342 transcript) are strong because a human chose the company, found the twist, picked the precise collapse moment. v3 drafts the structure; it does **not** replace that editorial judgment. Even "true Hermes" stays draft-assist.

## The non-negotiable safeguard — design it in from day one
**Approved-for-publish ≠ admitted-to-exemplars.** An agent that drafts from the corpus and learns from whatever gets approved will drift toward the mean: approve a few "merely fine" posts → they join the corpus → next generation conditions on a weaker set → quality erodes. Prevent it structurally:
- **Gold corpus** (what Hermes learns from) is a **human-curated, separate** set of blessed best work.
- The **approval queue** (what gets published) does **not** auto-feed the gold corpus.
- Admission to the gold corpus is a deliberate, separate human act. This must exist *before* the first generation, not be bolted on after the mean has drifted.

## Preconditions (the actual blockers — none are code-side)
1. **Share the exemplar folder** (the brief + post corpus mentioned in earlier sessions, never provided). This is *the* blocker for v3.
2. **Curate a gold-exemplar subset** — human-blessed best work, separate from everything else.
3. **Commit to the build** — it's a real project (corpus ingest, embeddings + vector store, retrieval `retrieveSimilar(seed,k)`, few-shot `regenerate(seed)`, a weekly synthesis loop, Hermes runtime).
4. **Lock the gold-corpus separation** safeguard from the start.

## Architecture (when built)
```
gold corpus (curated) ──embed/index──► retrieval (K exemplars)
                                              │ + brief
                                              ▼
                                    few-shot draft (caption via Anthropic,
                                    image via fal, conditioned on exemplars)
                                              │  shows sourceExemplars trail
                                              ▼
                          EXISTING Slack review → human sharpens → approve → publish
```
- Generation is **always** conditioned on retrieved exemplars + the brand brief (no free-form ideation).
- Every draft shows **which** exemplars conditioned it (so reviewers can spot drift).
- A generation that violates §3/§4/§14 of `brand/brief.md` is auto-blocked at review.
- Rejected drafts get a reason tag (avoidance signal); they are **not** silently discarded and **not** admitted to the gold corpus.

## Sequence (the discipline that makes the move pay off)
1. **Ship v1 now** (Render). It's the correct architecture for "human commands every publish" and it's proven (live LinkedIn post).
2. **Operate v1 for 2–3 weeks.** Real use answers what anticipation can't: does platform-fit validation catch what it should? Is Adapt output shippable or always-rewritten? Where's the `/posts` friction? Which of the 3 Claude touchpoints earns its keep?
3. **Decide v3 build with data.** Build it **only if** real use shows the bottleneck is **content production**, not **publishing**. If publishing is the bottleneck, v1 is enough.
4. **If building v3:** draft-assist + gold-corpus safeguard, never autonomous origination. Quality holds because the human stays on the part that's good.

## What the v1 deploy means for v3
The deploy does **not** foreclose v3 — it gives v3 a working, proven publishing system to plug into when it lands. v3 is gated on the exemplar folder + the commitment to the safeguarded build, neither of which the deploy blocks.

## First action when we start v3
Get the exemplar folder. Everything else follows from having a corpus to curate and learn from.
