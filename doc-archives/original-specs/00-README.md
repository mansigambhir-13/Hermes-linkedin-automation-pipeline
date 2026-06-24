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

## Reading order

- **The team:** read 1 → 5 → 4. (What it is, what you must set up, how it's built.)
- **Claude Code:** ingest all five; treat 4 as the master build brief and 1–3 as the specs it implements against.

## The two things that most determine success

1. **Content quality lives in the Brand & Voice Spec (doc 1), not the orchestration.** A perfect pipeline producing generic edtech copy is a failure. Tune doc 1 until the agent's drafts pass its own bar.
2. **Carousel consistency is the highest-risk build area (doc 2 §4).** Prove the consistency method on ~15 real runs before building publishing on top of it.

## The one critical-path warning

**Instagram publishing requires Meta app review (~2–4 weeks).** Start that paperwork (doc 5, top section) on day one, in parallel with everything else. LinkedIn one-click can ship first; Instagram switches on when review clears. Nothing else has this lead time.

## What this package is NOT

It is not the abandoned earlier plan, and it does not reuse the marktech hotel architecture. The only thing carried from marktech is the *image-prompt technique* (brand-aware prompt assembly + keeping copy and image generation separate), applied to Rehearsal's real brand. Everything else is built from the lifecycle you described: marketer prompts (UI or Slack chat) → agent drafts caption + imagery → manager reviews/refines in Slack → one-click publish or schedule → ideas from humans or Claude.
