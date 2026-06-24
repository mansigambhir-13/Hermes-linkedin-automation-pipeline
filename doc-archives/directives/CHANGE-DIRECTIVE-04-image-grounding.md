# CHANGE DIRECTIVE 04 — Rebuild the image pipeline on the marktech grounding model

**Why:** the first carousels came out generic/off-topic. Reading marktech's actual `image_generator.py`
(the reference whose output quality is the target), the gap is **not the model — it's four layers of
grounding and specificity marktech has and our pipeline skipped.** This directive rebuilds our image
pipeline to replicate marktech's *technique*, adapted to Rehearsal (no hotel specifics). marktech is the
sole reference for HOW; Rehearsal's brand spec is the WHAT.

**Provider note:** vision-grounding runs on **Gemini** (closest to marktech's proven recipe, and it does
NOT depend on the still-gated Bedrock access — so this whole rework can proceed now). Images stay on fal;
captions stay on Bedrock. New key: `GEMINI_API_KEY` (vision-grounding only).

---

## 1. The four upgrades (in priority order — this is the fix)

### Upgrade A — Rich, specific `visualPrompt` (biggest lever)
marktech never sends a one-line concept. Its prompts are full scenes:
*"Luxury insulated geodesic glass dome under a clear night sky full of stars, cozy warm indoor lighting,
steam rising from outdoor cedar tub."* Subject + setting + lighting + mood + concrete detail.

**Change:** the agent's image-concept step must emit a **complete scene description per slide/image** —
specific subject, composition, lighting, mood, and a concrete metaphor tied to the post's actual topic
(interviews/careers/CV/placements). A vague concept is the direct cause of generic art. This single change
likely moves output from "generic" to "on-topic."

### Upgrade B — Structured multi-section prompt template
marktech's prompt is not a sentence; it's labeled sections, each doing a job. Replicate this structure for
Rehearsal:
```
A [editorial image | designed poster] for "Rehearsal" (interview-prep platform).

VISUAL SUBJECT (HIGH PRIORITY):
{rich visualPrompt from Upgrade A}

BRAND VISUAL DNA:
- Dark editorial canvas (#0a0a0a), Raleway type, the signature gradient
  (#9677f8→#4e44fd→#ff4859→#00c483) as ONE focal accent, generous negative space
- Conceptual/editorial illustration register (NOT literal stock photography)
- Audience/tone: MBA aspirants & placement candidates; sharp, editorial, provocative
- {Reference style description from Upgrade C}

[PHOTOGRAPHIC/DESIGN STYLE block — per mode, see Upgrade D]

CRITICAL REQUISITE:
[per mode — editorial forbids all text; poster mandates the approved copy + COPY SAFETY RULES]
```
Density and structure are what make the model follow the brand instead of inventing generic art.

### Upgrade C — Gemini vision-grounding of the real brand references (the marktech "secret")
marktech's `_get_visual_context_from_image()` takes a reference image, runs it through a **vision model to
describe it in words**, then injects that description into the generation prompt. This is how the brand's
real "look" transfers — far more reliably than passing a bare style reference.

**Change — build this step:**
- Take the real Rehearsal **brief-cover illustrations** (in `references/brand-assets/`).
- Send each to **Gemini vision** (`gemini-2.5-flash` is a fine, cheap default — confirm the current model
  string against ai.google.dev/gemini-api/docs/models; avoid the 2.0 line, shutting down June 2026) with a
  describe-prompt adapted from marktech's: *"Describe the illustration style, color palette, composition,
  level of abstraction, line/texture treatment, and overall visual mood of this image, for use as the
  style guide in an AI image-generation prompt for a premium editorial brand."*
- Inject the returned description into every image prompt as the "Reference style description" line
  (Upgrade B). This is the brand "hand" the generic renders were missing.
- Cache the descriptions (the references don't change) so you don't re-call Gemini every generation.

### Upgrade D — Two distinct modes (editorial vs poster)
marktech separates these and it matters:
- **Editorial mode** — pure concept image, **aggressively forbids ALL text/logos/badges/borders**
  (marktech's CRITICAL REQUISITE). For pure-visual slides.
- **Poster mode** — the designed card where **text IS the focal point**: the hook/punchline typeset in,
  with marktech's **COPY SAFETY RULES verbatim-in-spirit** ("use exactly these approved lines, invent no
  filler/placeholder/camera/prompt fragments, must look like a finished designed ad, not a mockup"). Pass
  the approved copy lines explicitly; run them through an overlay-text cleaner (marktech's
  `_clean_overlay_text`) so labels never render.
- **For Rehearsal social, poster mode is likely the primary mode** (the truth-bomb hook card). For poster
  text, route to the model best at in-image text (Ideogram v3 on fal); for editorial concept images, the
  hero model (Imagen4 ultra on fal). Carousel slides: keep the locked style-spec + the Upgrade-C style
  description across all slides as the consistency anchor (since recraft-v3 on fal has no seed).

## 2. What to drop from marktech (don't copy these)
Hotel footprint, season/lighting mood, architectural-style inference, property-setting cues, the
hotel-specific design archetypes (Scrapbook/Earthy/Cinematic). Replace the brand-DNA block with Rehearsal's
real visual identity (dark/Raleway/gradient/editorial-illustration). Keep only the *technique*: rich prompt
+ structured template + vision-grounding + editorial/poster split + overlay cleaning.

## 3. Run cheap, fail fast (unchanged stopping rule)
- **Probe first:** apply Upgrades A + B + D (the prompt-engineering ones — no new key needed) and generate
  **2-3 images** in poster mode. Judge: on-topic? on-brand? text clean? Cheap, immediate.
- **Then add Upgrade C** (Gemini vision-grounding) and probe again — this is the brand-fidelity jump.
- **Stopping rule (pre-agreed): max 2-3 grounding rounds.** If still not clearing the bar after that,
  text-to-image illustration has hit its ceiling → pivot to typographic brand cards / templates / human
  design (per Directive 03). Don't grind past the ceiling.
- Only scale to the full ~15-set gate once a probe clearly clears the bar.

## 4. Sequencing note
Upgrades A/B/D are pure prompt-engineering — **unblocked, do them now**, they need no new provider and will
likely deliver most of the improvement. Upgrade C needs `GEMINI_API_KEY` (cheap, single-purpose) but does
NOT need Bedrock — so it's independent of the AWS access wait. Captions remain a separate track.

## 5. What stays unchanged
fal image adapter + routing (add Ideogram-for-poster-text routing if not already), the engine's
cross-slide style-spec lock, all non-negotiables, the Bedrock caption path. This is an image-prompt-quality
rework, not an architecture change.

---

### The core insight (so it isn't lost)
marktech's images are good because of **grounding and specificity, not a magic model.** It turns brand +
concept + reference into a dense, structured, vision-grounded instruction. Our pipeline under-specified at
every layer, so the model filled the vacuum with generic art. Replicate the four upgrades and the same model
class will produce dramatically better, on-brand output — or, if it still can't reach Rehearsal's
art-directed bar within the stopping rule, that's the clean signal to switch image methods.
