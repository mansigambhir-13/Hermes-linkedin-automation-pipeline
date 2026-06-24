# Rehearsal — Image Generation Method

**How the system produces on-brand visuals: single images and consistent carousels.**
This document defines the *technique*, not the code. It adapts the prompt-engineering approach from the marktech reference (rich brand-aware prompts; copy generation kept separate from image generation) to Rehearsal's own brand.

---

## 1. Two core principles (carried from the marktech technique)

1. **Brand spec feeds every image prompt.** Every image prompt is assembled from the brand visual identity (Brand & Voice Spec §6) plus the specific subject — never a bare "make an image of X." The brand DNA (serif-editorial, restrained palette, conceptual illustration, generous space) is injected into every call so output is on-brand by construction.
2. **Copy and image are separate concerns.** The caption-writing step and the image-generation step are distinct. The agent first writes the post, then derives image prompt(s) from it. The two are never fused into one tangled mega-prompt — that's what kept marktech's output clean and it's what keeps Rehearsal's clean.

## 2. Three image job-types (and the right model for each)

Rehearsal posts need different things from an image. Image quality is the priority, so the system picks the **best model per job**, behind a pluggable layer, rather than forcing one model to do everything. (Model landscape is current as of mid-2026; the pluggable layer means swapping is a config change, see §6.)

| Job type | What it must nail | Recommended model(s) |
|---|---|---|
| **Concept / hero** — clean illustrative or photoreal image, *no text* | mood, composition, the conceptual metaphor | Imagen 4 Ultra or Nano Banana Pro (Gemini 3 Pro Image) — lead on photorealism/quality |
| **Statement slide** — a headline/hook typeset *into* the image | legible, accurate in-image text | Ideogram v3 or GPT Image 2 — lead on in-image typography |
| **Carousel set** — N slides that read as one designed piece | cross-slide style consistency | Recraft V4 (built for brand consistency), or a single model with a locked style spec + fixed seed |

The agent (or the format choice) determines the job type. A "single concept image" post uses the hero model. A "bold hook on a poster" uses the text-rendering model. A carousel uses the consistency approach in §4.

## 3. Single-image method

1. Agent writes the caption.
2. Agent derives a **visual concept** — the one metaphorical idea that represents the post (echoing the brief-cover style: a lone figure on a circuit-tree, a cracking money pillar, etc. — conceptual, not literal).
3. Build the image prompt = brand visual identity block + the concept + the target aspect ratio + the explicit "no text" or "headline text = X" instruction.
4. Generate at the platform's aspect ratio (§5).
5. If the post wants a hook baked in, route to the text-rendering model and pass the exact headline string (cleaned of any prompt-label leakage, the way marktech strips "Headline:" prefixes so they never render).

## 4. Carousel method — the consistency technique (the hard part)

This is the highest-risk quality area. A carousel fails when slide 4 looks like a different brand than slide 1. The fix is **deliberate consistency control**, never naive independent looping.

### The locked style spec
Before generating any slide, the agent fixes a **style spec** that every slide inherits verbatim:
- palette (the restrained Rehearsal set + one accent)
- type treatment (editorial serif headline, sans body)
- layout grammar (where the headline sits, how much negative space, margin system)
- illustration style (the conceptual/metaphorical register)
- a **fixed seed and/or a reference image** so the model's "hand" stays constant

### The slide plan
The agent plans the whole carousel as one narrative arc *before* generating:
- **Slide 1** — the hook (often a statement slide with the hook typeset in).
- **Middle slides** — one idea each (tension → turn → proof), visually consistent.
- **Final slide** — the soft CTA / Rehearsal turn.

Each slide's prompt = the locked style spec + that slide's specific content + "slide N of M in a cohesive set" framing. The shared spec + seed/reference is what makes them cohere.

### Consistency checklist (the quality gate)
A carousel passes only if, eyeballed as a set:
- the palette is identical across slides
- the type treatment is identical
- the illustration style reads as one hand
- the layout grammar (headline position, margins, negative space) is consistent
- no single slide looks "off-brand" relative to the others

**Hard rule for the build:** before carousels are wired into publishing, run ~15 real carousels and require this checklist to pass ≥ ~70% of the time. If it doesn't, tune the style spec / switch to the consistency-specialist model before proceeding. Do not build publishing on top of an unproven carousel method.

## 5. Aspect ratios per placement

| Placement | Aspect ratio |
|---|---|
| LinkedIn single image (feed) | 1.91:1 or 1:1 |
| LinkedIn carousel (PDF-style document or image set) | 1:1 |
| Instagram feed single | 4:5 (max feed height) or 1:1 |
| Instagram carousel | 1:1 or 4:5 (must be uniform across all slides) |
| Instagram story | 9:16 |

Instagram carousels must use the **same aspect ratio for every slide** — mixing ratios breaks the swipe experience and can be rejected.

## 6. Pluggability (why this survives model churn)

The image landscape changes monthly. The method above is model-agnostic: the system calls an image layer with (job_type, prompt, aspect_ratio, style_spec, seed) and the layer routes to whichever model is configured best-in-class for that job_type. When a better model ships, it's a config change, not a rewrite. This is the single most important architectural property of the image engine — do not hardcode one vendor.

## 7. Quality, cost, and the publish-time constraint

- **Quality is the priority** (your call), so v1 generates at full quality rather than down-ressing drafts. The pluggable layer leaves room to add "cheap draft → upscale on approval" later without rework.
- **Publish-time constraint (critical for Instagram):** at publish time the image(s) must be reachable at a **public URL**. The image engine must store outputs in object storage that can serve public (or transiently public/presigned) URLs when an Instagram post fires. This shapes the storage choice in the build brief — it is not optional for IG.

## 8. What we explicitly are NOT doing

No hotel/property imagery logic, no seasonal-mood system, no website scraping for brand cues — all of that came from the marktech hotel context and is irrelevant here. We take only the *technique* (brand-aware prompt assembly + copy/image separation + overlay-text cleaning) and apply it to Rehearsal's real, editorial, conceptual-illustration brand.
