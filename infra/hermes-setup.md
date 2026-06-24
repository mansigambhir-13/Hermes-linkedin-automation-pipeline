# Hermes setup runbook (Phase H)

How to stand up the **NousResearch Hermes Agent** as the core and wire our skill + tools to it. Hermes is an external Python platform installed on the host; these steps are partly **interactive** (gateway OAuth) and run a **long-lived** process — they're operational, not scripted by Claude Code. Verify exact commands/config against the live Hermes docs.

## 0. Prerequisites
- Host with Python; `HERMES_HOME` on **persistent storage** (EFS/EBS on AWS) — else memory + skills wipe on restart (Directive 01 guardrail).
- Bedrock: AWS creds with `bedrock:InvokeModel` + **Anthropic use-case form approved** in the region (currently the open blocker — see `BLOCKERS.md`).
- Slack app `hermes` (bot token verified).
- `config/locked-config.json` with real CTA + hashtags (for `compose_caption`).
- `DATABASE_URL` (Supabase) — system of record.

## 1. Install Hermes
```
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc   # then: hermes
```

## 2. Model provider → Bedrock (Directive 02)
Configure Hermes' provider for Claude on Amazon Bedrock (IAM auth, region-prefixed inference profile):
```
hermes model        # select Bedrock / custom; set:
  AWS_REGION=eu-west-1
  model = eu.anthropic.claude-sonnet-4-6   (opus-4-7 available)
  AWS creds via the host's IAM role / env (bedrock:InvokeModel)
```
If Hermes' Bedrock support is limited, fallback (Directive 02 §2): a direct Anthropic API key for Hermes' text.

## 3. Slack gateway
```
hermes gateway setup    # connect the `hermes` bot (bot token + signing secret); pick the review + #idea-inbox channels
hermes gateway start    # long-lived
```

## 4. Install the skill + context
Copy our skill + context file into Hermes' skills dir (agentskills.io-compatible):
```
cp -R skills/rehearsal-content ~/.hermes/skills/
cp AGENTS.md ~/.hermes/                # or the project context location Hermes reads
```
Keep `references/brand-voice.md` + `image-method.md` in sync with repo docs 01/02 (they're bundled copies).

## 5. Register the RSS Tool Server (MCP)
Point Hermes' MCP client at `infra/hermes/mcp-servers.json` (fill the absolute path + env). This exposes compose_caption / save_draft / get_post / update_post_status / save_idea / generate_image / assemble_carousel / publish_*.

## 6. Auto-ideas (Phase 6) via Hermes cron
```
hermes cron   # add: "Tue & Fri 09:00 IST — propose 5 fresh Rehearsal post ideas (originality rule),
              #        save each via the save_idea tool, and post them to #idea-inbox for selection."
```
Propose-only — a human selects before drafting; nothing auto-publishes.

## 7. Go-live checklist
- [ ] Bedrock use-case form approved → caption gate passes (~15 in-voice drafts judged).
- [ ] Carousel-consistency gate judged ≥ ~70% (fal renders in `.artifacts/posts/`).
- [ ] CTA/hashtags in `config/locked-config.json`.
- [ ] LinkedIn OAuth target + token (single-image first).
- [ ] Meta app review PASSED → Instagram publish on.
- [ ] Secrets in AWS Secrets Manager (not `.env`); rotate the exposed gateway key + Slack token.
