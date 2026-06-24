# Rehearsal Social Studio — Build Package

**Everything except code, to build the agent-driven LinkedIn + Instagram post studio for Rehearsal.**

This package gives Claude Code (and the team) the full picture: what Rehearsal is, how it should sound and look, how images get made, what the agent does, how the system is architected on your stack, and what humans must set up. Hand all of it to Claude Code together.

## What's in here

| # | File | What it is | Who reads it |
|---|---|---|---|
| 1 | `01-brand-and-voice-spec.md` | The quality core — who Rehearsal is, how it sounds, how it looks, the bar. | The agent (loaded as context) + the team |
| 2 | `02-image-generation-method.md` | How single images and consistent carousels get made; per-job model routing. | The agent + Claude Code |
| 3 | `03-agent-instructions.md` | The agent's system prompt, the post it outputs, its tools, its hard rules. | Hermes agent + Claude Code |
| 4 | `04-build-brief-for-claude-code.md` | Architecture pinned to Supabase/AWS/Slack: components, data model, publishing constraints, build order. | Claude Code |
| 5 | `05-operational-setup-checklist.md` | Human tasks — accounts, accesses, decisions, quality gates. Start the Meta review today. | The team |
| 6 | `06-system-design-hld-lld.md` | End-to-end technical design: HLD (architecture, services, AWS topology, data flow) + LLD (schemas, API contracts, agent tool signatures, publish state machine, async jobs, sequence flows). | Claude Code (engineering blueprint) |
| ⚑ | `directives/CHANGE-DIRECTIVE-01-hermes-core.md` | **Supersedes the architecture.** Adopts NousResearch Hermes as the core (Option A): Hermes owns the agent loop, Slack, cron, and memory; our image/publish/data logic attaches as MCP tools + a Hermes skill. Architecture rationale + tool seam. | Claude Code |
| ★ | `FINAL-BUILD-PLAN.md` | **THE CANONICAL PLAN — START HERE.** One consolidated build plan merging the Hermes Option-A architecture (directive 01) with the surviving constraints (data model, publishing, stack, team items, quality gates) + the revised phases. Supersedes doc 04 §6 and doc 06 Part A. | Claude Code (canonical entry point) |

## Reading order

- **The team:** read 1 → 5 → CHANGE-DIRECTIVE-01 → 4. (What it is, what you must set up, the architecture change, the constraints.)
- **Claude Code:** read **`FINAL-BUILD-PLAN.md` FIRST** — the canonical plan (it merges directive 01 + the surviving constraints). Then 1–3 (content/behavior specs, realized as the `rehearsal-content` skill + `AGENTS.md`), 2 + 6 §B1/B4/B5/B11 (the tool implementations), and 4 §1/§4/§5/§8 (stack, data model, publishing constraints, team items). `CHANGE-DIRECTIVE-01` is the detailed source for architecture rationale.

## The two things that most determine success

1. **Content quality lives in the Brand & Voice Spec (doc 1), not the orchestration.** A perfect pipeline producing generic edtech copy is a failure. Tune doc 1 until the agent's drafts pass its own bar.
2. **Carousel consistency is the highest-risk build area (doc 2 §4).** Prove the consistency method on ~15 real runs before building publishing on top of it.

## The one critical-path warning

**Instagram publishing requires Meta app review (~2–4 weeks).** Start that paperwork (doc 5, top section) on day one, in parallel with everything else. LinkedIn one-click can ship first; Instagram switches on when review clears. Nothing else has this lead time.

## What this package is NOT

It is not the abandoned earlier plan, and it does not reuse the marktech hotel architecture. The only thing carried from marktech is the *image-prompt technique* (brand-aware prompt assembly + keeping copy and image generation separate), applied to Rehearsal's real brand. Everything else is built from the lifecycle you described: marketer prompts (UI or Slack chat) → agent drafts caption + imagery → manager reviews/refines in Slack → one-click publish or schedule → ideas from humans or Claude.

## Revision — 2026-05-24 (review corrections baked in)

All six docs now live in the project root as the single source of truth. Corrections applied:
- **02** — routing table reframed as *intended picks verified at build time*; Recraft confirmed on the gateway (`recraft/recraft-v4`); fallbacks defined for any model that doesn't resolve.
- **04** — Phase 0 now leads with **task 0.0** (verify gateway roster → author `image_routing.json` born-correct); **locked CTA/hashtags** and **brand assets (2–5 reference images)** promoted from §8 open-items into Phase-0 prerequisites; LinkedIn split into single-image (ships first) vs document/carousel (verify path).
- **05** — Meta-owner language sharpened to *name + start today*; CTA/hashtags and reference images marked *start-now* and tied to the gate each unblocks.
- **06** — caption stored as **editable body** (`caption_body_*`) with locked CTA/hashtags composed at render/publish (edit can't clobber them); post-level **`aspect_ratio`** guard for carousel uniformity; LinkedIn document-post state machine added; failure matrix + build-sequencing note updated.
- **01 / 03 / 05 / 06** — **originality rule** added: reference material (the 22 briefs, product copy, topic territory) is *voice/territory calibration, not a topic queue*; every post and auto-idea originates a fresh hook/angle/carousel concept (*fresh-by-default, brief-by-request*); enforced in the Hermes skill and checked in the Phase-1 caption gate.

## Architecture change — 2026-05-24

`directives/CHANGE-DIRECTIVE-01-hermes-core.md` adopts the **NousResearch Hermes Agent** platform as the core (Option A). Hermes owns the agent loop, Slack gateway, cron, and memory; our domain logic (image engine, publishers, data model, brand/voice) attaches as an **MCP "RSS Tool Server"** + a **`rehearsal-content` skill**. This partially supersedes doc 04 §6 and doc 06 §A/§B12. **`FINAL-BUILD-PLAN.md` is the canonical, consolidated plan** — architecture, revised phases, quality gates, and surviving constraints in one place; read it first. Phase 0 stands unchanged.
